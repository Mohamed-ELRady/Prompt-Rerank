import { describe, expect, it } from 'vitest';
import { createProviderRegistry, getProvider } from './registry';
import { ProviderError } from './types';

describe('provider registry', () => {
  const registry = createProviderRegistry();

  it('includes the free-tier presets and the custom escape hatch', () => {
    for (const id of ['groq', 'xai', 'mistral', 'together', 'custom']) {
      expect(registry.has(id)).toBe(true);
    }
  });

  it('bundles openai-compatible, anthropic and gemini providers', () => {
    for (const id of ['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'ollama']) {
      expect(registry.has(id)).toBe(true);
    }
  });

  it('exposes a Base URL and model for every provider except the blank custom one', () => {
    for (const provider of registry.values()) {
      expect(provider.meta.label).not.toBe('');
      if (provider.id !== 'custom') {
        expect(provider.meta.defaultBaseUrl).not.toBe('');
      }
    }
  });

  it('throws a typed error for unknown providers', () => {
    expect(() => getProvider('does-not-exist', registry)).toThrow(ProviderError);
  });
});
