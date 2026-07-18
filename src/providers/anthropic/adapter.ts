import { z } from 'zod';
import { parseSseStream } from '../sse';
import {
  errorFromStatus,
  ProviderError,
  toProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
  type FetchLike,
  type ModelInfo,
  type ProviderConfig,
} from '../types';

const API_VERSION = '2023-06-01';

const eventSchema = z.object({
  type: z.string(),
  delta: z.object({ type: z.string().optional(), text: z.string().optional() }).optional(),
});

const modelsSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

export function createAnthropicProvider(fetchFn: FetchLike = globalThis.fetch): AIProvider {
  const meta = {
    label: 'Anthropic',
    requiresKey: true,
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-5',
    keyHint: 'console.anthropic.com/settings/keys',
  };

  function headers(config: ProviderConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': API_VERSION,
      // Required by Anthropic for direct calls from browser contexts. Safe
      // here: the key never leaves the user's machine except to Anthropic.
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  function baseUrl(config: ProviderConfig): string {
    return (config.baseUrl ?? meta.defaultBaseUrl).replace(/\/$/, '');
  }

  async function listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
      const response = await fetchFn(`${baseUrl(config)}/v1/models`, { headers: headers(config) });
      if (!response.ok) {
        throw errorFromStatus(response.status, await response.text());
      }
      return modelsSchema.parse(await response.json()).data.map(({ id }) => ({ id }));
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async function complete(
    request: CompletionRequest,
    config: ProviderConfig,
    onChunk: (delta: string) => void,
    signal: AbortSignal,
  ): Promise<CompletionResult> {
    try {
      const response = await fetchFn(`${baseUrl(config)}/v1/messages`, {
        method: 'POST',
        headers: headers(config),
        signal,
        body: JSON.stringify({
          model: config.model,
          stream: true,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
        }),
      });
      if (!response.ok) {
        throw errorFromStatus(response.status, await response.text());
      }
      if (!response.body) {
        throw new ProviderError('unknown', 'Provider returned an empty response body.');
      }
      let text = '';
      for await (const data of parseSseStream(response.body, signal)) {
        const parsed = eventSchema.safeParse(JSON.parse(data));
        if (!parsed.success) {
          continue;
        }
        if (parsed.data.type === 'content_block_delta' && parsed.data.delta?.text !== undefined) {
          text += parsed.data.delta.text;
          onChunk(parsed.data.delta.text);
        }
        if (parsed.data.type === 'message_stop') {
          break;
        }
      }
      return { text };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  return {
    id: 'anthropic',
    meta,
    listModels,
    async validate(config) {
      await listModels(config);
    },
    complete,
  };
}
