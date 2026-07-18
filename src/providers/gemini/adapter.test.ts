import { describe, expect, it } from 'vitest';
import { type ProviderConfig } from '../types';
import { jsonResponse, mockFetch, sseResponse } from '../test-utils';
import { createGeminiProvider } from './adapter';

const config: ProviderConfig = { apiKey: 'AIza-test', model: 'gemini-test' };

function geminiChunk(text: string): string {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });
}

describe('gemini adapter', () => {
  it('streams candidate part text', async () => {
    const fetchFn = mockFetch(sseResponse([geminiChunk('One'), geminiChunk(' two')]));
    const chunks: string[] = [];

    const result = await createGeminiProvider(fetchFn).complete(
      { system: 'sys', user: 'usr' },
      config,
      (delta) => chunks.push(delta),
      new AbortController().signal,
    );

    expect(chunks).toEqual(['One', ' two']);
    expect(result.text).toBe('One two');
  });

  it('sends the key as a header, never in the URL', async () => {
    const fetchFn = mockFetch(sseResponse([]));
    await createGeminiProvider(fetchFn).complete(
      { system: 'sys', user: 'usr' },
      config,
      () => undefined,
      new AbortController().signal,
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':streamGenerateContent?alt=sse');
    expect(url).not.toContain('AIza-test');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      systemInstruction: { parts: [{ text: 'sys' }] },
      contents: [{ role: 'user', parts: [{ text: 'usr' }] }],
    });
  });

  it('lists models supporting generateContent, stripping the models/ prefix', async () => {
    const fetchFn = mockFetch(
      jsonResponse({
        models: [
          { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    );
    await expect(createGeminiProvider(fetchFn).listModels(config)).resolves.toEqual([
      { id: 'gemini-pro' },
    ]);
  });
});
