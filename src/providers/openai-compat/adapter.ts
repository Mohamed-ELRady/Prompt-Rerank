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
  type ProviderMeta,
} from '../types';

/**
 * Adapter for every OpenAI-Chat-Completions-compatible API (SDD §5.1):
 * OpenAI itself plus DeepSeek, OpenRouter, Ollama, LM Studio and most future
 * vendors, which differ only in base URL and whether a key is required.
 */

export interface OpenAiCompatOptions {
  id: string;
  meta: ProviderMeta;
}

const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
});

const modelsSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

export function createOpenAiCompatProvider(
  options: OpenAiCompatOptions,
  fetchFn: FetchLike = globalThis.fetch,
): AIProvider {
  const { id, meta } = options;

  function headers(config: ProviderConfig): HeadersInit {
    const result: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey !== undefined && config.apiKey !== '') {
      result.Authorization = `Bearer ${config.apiKey}`;
    }
    return result;
  }

  function baseUrl(config: ProviderConfig): string {
    return (config.baseUrl ?? meta.defaultBaseUrl).replace(/\/$/, '');
  }

  async function listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
      const response = await fetchFn(`${baseUrl(config)}/models`, { headers: headers(config) });
      if (!response.ok) {
        throw errorFromStatus(response.status, await response.text(), meta.requiresKey);
      }
      return modelsSchema.parse(await response.json()).data.map(({ id: modelId }) => ({
        id: modelId,
      }));
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
      const response = await fetchFn(`${baseUrl(config)}/chat/completions`, {
        method: 'POST',
        headers: headers(config),
        signal,
        body: JSON.stringify({
          model: config.model,
          stream: true,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });
      if (!response.ok) {
        throw errorFromStatus(response.status, await response.text(), meta.requiresKey);
      }
      if (!response.body) {
        throw new ProviderError('unknown', 'Provider returned an empty response body.');
      }
      let text = '';
      for await (const data of parseSseStream(response.body, signal)) {
        if (data === '[DONE]') {
          break;
        }
        const parsed = chunkSchema.safeParse(JSON.parse(data));
        const delta = parsed.success ? (parsed.data.choices?.[0]?.delta?.content ?? '') : '';
        if (delta !== '') {
          text += delta;
          onChunk(delta);
        }
      }
      return { text };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  return {
    id,
    meta,
    listModels,
    async validate(config) {
      await listModels(config);
    },
    complete,
  };
}
