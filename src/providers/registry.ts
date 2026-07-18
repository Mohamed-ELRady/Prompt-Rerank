import { createAnthropicProvider } from './anthropic/adapter';
import { createGeminiProvider } from './gemini/adapter';
import { createOpenAiCompatPresets } from './openai-compat/presets';
import { ProviderError, type AIProvider, type FetchLike } from './types';

/**
 * Provider registry (SDD §5.1). The factory-function seam lets tests inject a
 * mocked fetch; production code uses the default registry below.
 */
export function createProviderRegistry(fetchFn?: FetchLike): ReadonlyMap<string, AIProvider> {
  const providers = [
    ...createOpenAiCompatPresets(fetchFn),
    createAnthropicProvider(fetchFn),
    createGeminiProvider(fetchFn),
  ];
  return new Map(providers.map((provider) => [provider.id, provider]));
}

export const providerRegistry = createProviderRegistry();

export function getProvider(id: string, registry = providerRegistry): AIProvider {
  const provider = registry.get(id);
  if (!provider) {
    throw new ProviderError('unknown', `Unknown provider "${id}".`, false);
  }
  return provider;
}
