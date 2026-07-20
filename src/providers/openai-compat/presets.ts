import { type FetchLike, type AIProvider } from '../types';
import { createOpenAiCompatProvider } from './adapter';

/** OpenAI-compatible vendors are configuration, not code (SDD §5.1). */
export function createOpenAiCompatPresets(fetchFn?: FetchLike): AIProvider[] {
  return [
    createOpenAiCompatProvider(
      {
        id: 'openai',
        meta: {
          label: 'OpenAI',
          requiresKey: true,
          defaultBaseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4o-mini',
          keyHint: 'platform.openai.com/api-keys',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'groq',
        meta: {
          label: 'Groq (free tier)',
          requiresKey: true,
          defaultBaseUrl: 'https://api.groq.com/openai/v1',
          defaultModel: 'llama-3.3-70b-versatile',
          keyHint: 'Free key at console.groq.com/keys',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'xai',
        meta: {
          label: 'xAI (Grok)',
          requiresKey: true,
          defaultBaseUrl: 'https://api.x.ai/v1',
          defaultModel: 'grok-2-latest',
          keyHint: 'console.x.ai',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'mistral',
        meta: {
          label: 'Mistral (free tier)',
          requiresKey: true,
          defaultBaseUrl: 'https://api.mistral.ai/v1',
          defaultModel: 'mistral-small-latest',
          keyHint: 'Free key at console.mistral.ai',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'together',
        meta: {
          label: 'Together AI',
          requiresKey: true,
          defaultBaseUrl: 'https://api.together.xyz/v1',
          defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
          keyHint: 'api.together.xyz/settings/api-keys',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'deepseek',
        meta: {
          label: 'DeepSeek',
          requiresKey: true,
          defaultBaseUrl: 'https://api.deepseek.com/v1',
          defaultModel: 'deepseek-chat',
          keyHint: 'platform.deepseek.com/api_keys',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'openrouter',
        meta: {
          label: 'OpenRouter',
          requiresKey: true,
          defaultBaseUrl: 'https://openrouter.ai/api/v1',
          defaultModel: 'anthropic/claude-sonnet-4.5',
          keyHint: 'openrouter.ai/keys',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'ollama',
        meta: {
          label: 'Ollama (local)',
          requiresKey: false,
          defaultBaseUrl: 'http://localhost:11434/v1',
          defaultModel: 'llama3.1',
          keyHint:
            'Run `OLLAMA_ORIGINS=chrome-extension://* ollama serve` to allow extension access',
        },
      },
      fetchFn,
    ),
    createOpenAiCompatProvider(
      {
        id: 'lmstudio',
        meta: {
          label: 'LM Studio (local)',
          requiresKey: false,
          defaultBaseUrl: 'http://localhost:1234/v1',
          defaultModel: 'local-model',
          keyHint: 'Enable the local server in LM Studio (Developer tab)',
        },
      },
      fetchFn,
    ),
    // Escape hatch: works with ANY OpenAI-compatible API. Set the Base URL,
    // model, and key in settings; the extension will ask permission to reach
    // that host the first time you test the connection.
    createOpenAiCompatProvider(
      {
        id: 'custom',
        meta: {
          label: 'Custom (any OpenAI-compatible API)',
          requiresKey: true,
          defaultBaseUrl: '',
          defaultModel: '',
          keyHint: 'Paste the provider’s Base URL and model below. Most free APIs work here.',
        },
      },
      fetchFn,
    ),
  ];
}
