import { describe, expect, it } from 'vitest';
import { ProviderError, type ProviderConfig } from '../types';
import { errorResponse, jsonResponse, mockFetch, sseResponse } from '../test-utils';
import { createOpenAiCompatProvider } from './adapter';

const config: ProviderConfig = { apiKey: 'sk-test', model: 'gpt-test' };

function makeProvider(fetchFn: ReturnType<typeof mockFetch>) {
  return createOpenAiCompatProvider(
    {
      id: 'test',
      meta: {
        label: 'Test',
        requiresKey: true,
        defaultBaseUrl: 'https://api.test.dev/v1',
        defaultModel: 'gpt-test',
      },
    },
    fetchFn,
  );
}

function chatChunk(content: string): string {
  return JSON.stringify({ choices: [{ delta: { content } }] });
}

describe('openai-compat adapter', () => {
  it('streams deltas and returns the joined text', async () => {
    const fetchFn = mockFetch(sseResponse([chatChunk('Hel'), chatChunk('lo'), '[DONE]']));
    const provider = makeProvider(fetchFn);
    const chunks: string[] = [];

    const result = await provider.complete(
      { system: 'sys', user: 'usr' },
      config,
      (delta) => chunks.push(delta),
      new AbortController().signal,
    );

    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result.text).toBe('Hello');
  });

  it('shapes the request correctly (endpoint, auth, messages, stream flag)', async () => {
    const fetchFn = mockFetch(sseResponse(['[DONE]']));
    await makeProvider(fetchFn).complete(
      { system: 'sys', user: 'usr', temperature: 0.3 },
      config,
      () => undefined,
      new AbortController().signal,
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test.dev/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'gpt-test',
      stream: true,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ],
    });
  });

  it('respects a baseUrl override and omits auth without a key', async () => {
    const fetchFn = mockFetch(jsonResponse({ data: [{ id: 'llama3.1' }] }));
    const models = await makeProvider(fetchFn).listModels({
      model: 'llama3.1',
      baseUrl: 'http://localhost:11434/v1/',
    });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/models');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(models).toEqual([{ id: 'llama3.1' }]);
  });

  it.each([
    [401, '', 'invalid_key'],
    [404, '', 'model_not_found'],
    [429, 'slow down', 'rate_limited'],
    [429, 'insufficient quota', 'quota_exceeded'],
    [400, 'maximum context length exceeded', 'context_length'],
    [500, 'boom', 'unknown'],
  ] as const)('maps HTTP %i (%s) to %s', async (status, body, code) => {
    const provider = makeProvider(mockFetch(errorResponse(status, body)));
    const failure = await provider
      .complete({ system: 's', user: 'u' }, config, () => undefined, new AbortController().signal)
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProviderError);
    expect((failure as ProviderError).code).toBe(code);
  });

  it('maps fetch TypeError to a network error', async () => {
    const fetchFn = mockFetch();
    fetchFn.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const failure = await makeProvider(fetchFn)
      .listModels(config)
      .catch((e: unknown) => e);
    expect((failure as ProviderError).code).toBe('network');
  });
});
