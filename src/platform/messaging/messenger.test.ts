import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_KIND } from './protocol';
import { registerMessageHandlers, sendMessage, type MessageHandlers } from './messenger';
import { defaultSettings } from '../storage/settings';

function registerTestHandlers(overrides: Partial<MessageHandlers> = {}): MessageHandlers {
  const handlers: MessageHandlers = {
    ping: vi.fn(() => Promise.resolve({ ok: true as const, version: '0.0.0' })),
    analyze: vi.fn(() =>
      Promise.resolve({
        taskType: 'general' as const,
        complexity: 'simple' as const,
        wordCount: 0,
        score: {
          overall: 100,
          byDimension: {
            clarity: 100,
            specificity: 100,
            context: 100,
            constraints: 100,
            outputSpec: 100,
            structure: 100,
          },
        },
        findings: [],
      }),
    ),
    'settings.get': vi.fn(() => Promise.resolve(defaultSettings)),
    'settings.update': vi.fn(({ patch }) => Promise.resolve({ ...defaultSettings, ...patch })),
    'providers.list': vi.fn(() => Promise.resolve({ providers: [] })),
    'providers.models': vi.fn(() =>
      Promise.resolve({ ok: false as const, code: 'unknown', message: 'stub' }),
    ),
    'providers.validate': vi.fn(() => Promise.resolve({ ok: true as const })),
    'vault.set': vi.fn(() => Promise.resolve({ keyPreview: '••••' })),
    'vault.delete': vi.fn(() => Promise.resolve({})),
    ...overrides,
  };
  registerMessageHandlers(handlers);
  return handlers;
}

describe('messenger', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('round-trips a typed request/response', async () => {
    registerTestHandlers();
    await expect(sendMessage('ping', {})).resolves.toEqual({ ok: true, version: '0.0.0' });
  });

  it('passes validated payloads to handlers', async () => {
    const handlers = registerTestHandlers();
    const result = await sendMessage('settings.update', { patch: { theme: 'dark' } });
    expect(result.theme).toBe('dark');
    expect(handlers['settings.update']).toHaveBeenCalledWith({ patch: { theme: 'dark' } });
  });

  it('ignores messages that are not ours', async () => {
    const handlers = registerTestHandlers();
    await fakeBrowser.runtime.sendMessage({ kind: 'other-extension', type: 'ping' });
    expect(handlers.ping).not.toHaveBeenCalled();
  });

  it('drops malformed payloads without invoking the handler', async () => {
    const handlers = registerTestHandlers();
    await fakeBrowser.runtime.sendMessage({
      kind: MESSAGE_KIND,
      type: 'settings.update',
      payload: { patch: { theme: 'neon' } },
    });
    expect(handlers['settings.update']).not.toHaveBeenCalled();
  });

  it('drops unknown message types', async () => {
    const handlers = registerTestHandlers();
    await fakeBrowser.runtime.sendMessage({ kind: MESSAGE_KIND, type: 'nope', payload: {} });
    expect(handlers.ping).not.toHaveBeenCalled();
  });
});
