import { describe, expect, it } from 'vitest';
import { type ProviderConfig } from '../types';
import { mockFetch, sseResponse } from '../test-utils';
import { createAnthropicProvider } from './adapter';

const config: ProviderConfig = { apiKey: 'sk-ant-test', model: 'claude-test' };

describe('anthropic adapter', () => {
  it('streams content_block_delta text and stops at message_stop', async () => {
    const fetchFn = mockFetch(
      sseResponse([
        JSON.stringify({ type: 'message_start' }),
        JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi ' } }),
        JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'there' },
        }),
        JSON.stringify({ type: 'message_stop' }),
      ]),
    );
    const chunks: string[] = [];

    const result = await createAnthropicProvider(fetchFn).complete(
      { system: 'sys', user: 'usr' },
      config,
      (delta) => chunks.push(delta),
      new AbortController().signal,
    );

    expect(chunks).toEqual(['Hi ', 'there']);
    expect(result.text).toBe('Hi there');
  });

  it('shapes the request with anthropic headers and system field', async () => {
    const fetchFn = mockFetch(sseResponse([JSON.stringify({ type: 'message_stop' })]));
    await createAnthropicProvider(fetchFn).complete(
      { system: 'sys', user: 'usr' },
      config,
      () => undefined,
      new AbortController().signal,
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBeDefined();
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(JSON.parse(init.body as string)).toMatchObject({
      system: 'sys',
      messages: [{ role: 'user', content: 'usr' }],
      stream: true,
    });
  });
});
