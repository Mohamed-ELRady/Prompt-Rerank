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
  ];
}
