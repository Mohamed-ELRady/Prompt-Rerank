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

const chunkSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
});

const modelsSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      supportedGenerationMethods: z.array(z.string()).optional(),
    }),
  ),
});

export function createGeminiProvider(fetchFn: FetchLike = globalThis.fetch): AIProvider {
  const meta = {
    label: 'Google Gemini',
    requiresKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'aistudio.google.com/apikey',
  };

  // Key goes in a header, never a query parameter, so it cannot end up in
  // request logs or copied URLs (SDD §7).
  function headers(config: ProviderConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey ?? '' };
  }

  function baseUrl(config: ProviderConfig): string {
    return (config.baseUrl ?? meta.defaultBaseUrl).replace(/\/$/, '');
  }

  async function listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    try {
      const response = await fetchFn(`${baseUrl(config)}/models`, { headers: headers(config) });
      if (!response.ok) {
        throw errorFromStatus(response.status, await response.text());
      }
      return modelsSchema
        .parse(await response.json())
        .models.filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
        .map((m) => ({ id: m.name.replace(/^models\//, '') }));
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
      const url = `${baseUrl(config)}/models/${config.model}:streamGenerateContent?alt=sse`;
      const response = await fetchFn(url, {
        method: 'POST',
        headers: headers(config),
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
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
        const parsed = chunkSchema.safeParse(JSON.parse(data));
        if (!parsed.success) {
          continue;
        }
        for (const part of parsed.data.candidates?.[0]?.content?.parts ?? []) {
          if (part.text !== undefined && part.text !== '') {
            text += part.text;
            onChunk(part.text);
          }
        }
      }
      return { text };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  return {
    id: 'gemini',
    meta,
    listModels,
    async validate(config) {
      await listModels(config);
    },
    complete,
  };
}
