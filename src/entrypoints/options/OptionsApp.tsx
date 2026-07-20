import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendMessage, type MessageOutput } from '@/platform/messaging';
import { type Settings } from '@/platform/storage';
import { useTheme } from '@/ui/useTheme';
import { AdvancedView } from './AdvancedView';
import { HistoryView } from './HistoryView';
import { TemplatesView } from './TemplatesView';

/** "https://api.example.com/v1" → "https://api.example.com/*" match pattern. */
function originPattern(url: string): string | null {
  try {
    return `${new URL(url).origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Custom / edited Base URLs point at hosts outside the bundled grant, so we
 * ask for access to that specific host the first time it's used. Bundled
 * hosts (and localhost) already have it, so request() resolves instantly with
 * no prompt. Must be called directly from a click handler (user gesture).
 */
async function ensureHostPermission(effectiveBaseUrl: string): Promise<boolean> {
  const pattern = originPattern(effectiveBaseUrl);
  if (!pattern) {
    return true; // let the real request surface a clear "check your Base URL" error
  }
  try {
    return await browser.permissions.request({ origins: [pattern] });
  } catch {
    // e.g. http:// hosts Chrome won't grant via optional permissions — let the
    // fetch attempt proceed and report a normal network error if it fails.
    return true;
  }
}

type ProviderInfo = MessageOutput<'providers.list'>['providers'][number];

const TABS = [
  { id: 'providers', label: 'Provider' },
  { id: 'history', label: 'History' },
  { id: 'templates', label: 'Templates' },
  { id: 'advanced', label: 'Advanced' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function OptionsApp() {
  const [tab, setTab] = useState<TabId>('providers');
  const [settings, setSettings] = useState<Settings>();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [welcome, setWelcome] = useState(() => location.hash === '#welcome');
  useTheme(settings?.theme);

  useEffect(() => {
    void Promise.all([sendMessage('settings.get', {}), sendMessage('providers.list', {})]).then(
      ([loadedSettings, { providers: loadedProviders }]) => {
        setSettings(loadedSettings);
        setProviders(loadedProviders);
      },
    );
  }, []);

  const patchSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await sendMessage('settings.update', { patch }));
  }, []);

  const refreshProviders = useCallback(async () => {
    setProviders((await sendMessage('providers.list', {})).providers);
  }, []);

  if (!settings) {
    return <p className="p-8 text-sm text-neutral-500">Loading settings…</p>;
  }

  const active = providers.find((p) => p.id === settings.provider.activeId);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto max-w-2xl space-y-8 p-8">
        <header>
          <h1 className="text-2xl font-semibold">PromptPolish Settings</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your API keys stay on this device and are only ever sent to the provider you choose.
          </p>
        </header>

        {welcome && (
          <section
            aria-label="Getting started"
            className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm dark:border-violet-800 dark:bg-violet-950/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-violet-800 dark:text-violet-300">
                  Welcome to PromptPolish 👋
                </h2>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-700 dark:text-neutral-200">
                  <li>
                    Pick an AI provider below — Ollama and LM Studio work locally with no key.
                  </li>
                  <li>Paste an API key if the provider needs one, then hit “Test connection”.</li>
                  <li>
                    On any AI site, select your prompt text and click <strong>Improve</strong> in
                    the toolbar that appears.
                  </li>
                </ol>
              </div>
              <button
                type="button"
                aria-label="Dismiss welcome"
                className="rounded px-1.5 text-neutral-500 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                onClick={() => {
                  setWelcome(false);
                  history.replaceState(null, '', location.pathname);
                }}
              >
                ✕
              </button>
            </div>
          </section>
        )}

        <nav className="flex gap-1 border-b border-neutral-200" aria-label="Settings sections">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={tab === entry.id ? 'page' : undefined}
              className={`rounded-t-md px-3 py-1.5 text-sm ${
                tab === entry.id
                  ? 'border border-b-0 border-neutral-200 bg-white font-medium text-violet-700'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {tab === 'history' && <HistoryView />}
        {tab === 'templates' && <TemplatesView />}
        {tab === 'advanced' && <AdvancedView />}

        {tab !== 'providers' ? null : (
          <>
            <section className="space-y-4" aria-labelledby="provider-heading">
              <h2 id="provider-heading" className="text-lg font-medium">
                AI Provider
              </h2>
              <div className="text-sm">
                <label htmlFor="provider-select" className="mb-1 block font-medium">
                  Provider
                </label>
                <select
                  id="provider-select"
                  className="w-full rounded-md border border-neutral-300 p-2"
                  value={settings.provider.activeId}
                  onChange={(e) => {
                    void patchSettings({
                      provider: { ...settings.provider, activeId: e.target.value },
                    });
                  }}
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              {active && (
                <ProviderConfigPanel
                  key={active.id}
                  provider={active}
                  settings={settings}
                  onPatch={patchSettings}
                  onVaultChange={refreshProviders}
                />
              )}
            </section>

            <section className="space-y-4" aria-labelledby="appearance-heading">
              <h2 id="appearance-heading" className="text-lg font-medium">
                Appearance
              </h2>
              <div className="text-sm">
                <label htmlFor="theme-select" className="mb-1 block font-medium">
                  Theme
                </label>
                <select
                  id="theme-select"
                  className="w-full rounded-md border border-neutral-300 p-2"
                  value={settings.theme}
                  onChange={(e) => {
                    void patchSettings({ theme: e.target.value as Settings['theme'] });
                  }}
                >
                  <option value="system">Follow system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ProviderConfigPanel({
  provider,
  settings,
  onPatch,
  onVaultChange,
}: {
  provider: ProviderInfo;
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => Promise<void>;
  onVaultChange: () => Promise<void>;
}) {
  const config = settings.provider.configs[provider.id] ?? {};
  const [keyDraft, setKeyDraft] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string }>();

  const patchConfig = (patch: { baseUrl?: string; model?: string }) =>
    onPatch({
      provider: {
        ...settings.provider,
        configs: {
          ...settings.provider.configs,
          [provider.id]: { ...config, ...patch },
        },
      },
    });

  const saveKey = async () => {
    if (keyDraft.trim() === '') {
      return;
    }
    await sendMessage('vault.set', { providerId: provider.id, key: keyDraft.trim() });
    setKeyDraft('');
    await onVaultChange();
  };

  const removeKey = async () => {
    await sendMessage('vault.delete', { providerId: provider.id });
    await onVaultChange();
  };

  const effectiveBaseUrl = config.baseUrl ?? provider.defaultBaseUrl;

  // Ask for host access (and require a Base URL) before any real request.
  // Returns false + sets an error when we can't proceed.
  const prepareRequest = async (): Promise<boolean> => {
    if (effectiveBaseUrl.trim() === '') {
      setStatus({
        kind: 'error',
        text: 'Enter a Base URL first (e.g. https://api.groq.com/openai/v1).',
      });
      return false;
    }
    if (!(await ensureHostPermission(effectiveBaseUrl))) {
      setStatus({ kind: 'error', text: 'Permission to reach this host was denied.' });
      return false;
    }
    return true;
  };

  const testConnection = async () => {
    if (!(await prepareRequest())) {
      return;
    }
    setStatus({ kind: 'busy', text: 'Testing connection…' });
    const result = await sendMessage('providers.validate', { providerId: provider.id });
    setStatus(
      result.ok
        ? { kind: 'ok', text: 'Connected successfully.' }
        : { kind: 'error', text: result.message },
    );
  };

  const loadModels = async () => {
    if (!(await prepareRequest())) {
      return;
    }
    setStatus({ kind: 'busy', text: 'Loading models…' });
    const result = await sendMessage('providers.models', { providerId: provider.id });
    if (result.ok) {
      setModels(result.models);
      setStatus({ kind: 'ok', text: `${String(result.models.length)} models available.` });
    } else {
      setStatus({ kind: 'error', text: result.message });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-4">
      {provider.requiresKey && (
        <div className="text-sm">
          <span className="mb-1 block font-medium">API key</span>
          {provider.keyPreview !== undefined ? (
            <div className="flex items-center gap-3">
              <code className="rounded bg-neutral-100 px-2 py-1">{provider.keyPreview}</code>
              <button
                type="button"
                className="text-red-600 underline"
                onClick={() => void removeKey()}
              >
                Remove key
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                className="w-full rounded-md border border-neutral-300 p-2"
                placeholder="Paste your API key"
                value={keyDraft}
                autoComplete="off"
                onChange={(e) => {
                  setKeyDraft(e.target.value);
                }}
              />
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-40"
                disabled={keyDraft.trim() === ''}
                onClick={() => void saveKey()}
              >
                Save
              </button>
            </div>
          )}
          {provider.keyHint !== undefined && (
            <p className="mt-1 text-xs text-neutral-500">{provider.keyHint}</p>
          )}
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Base URL</span>
        <input
          type="url"
          className="w-full rounded-md border border-neutral-300 p-2"
          placeholder={provider.defaultBaseUrl}
          value={config.baseUrl ?? ''}
          onChange={(e) => {
            void patchConfig({ baseUrl: e.target.value === '' ? undefined : e.target.value });
          }}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Model</span>
        <div className="flex gap-2">
          <input
            type="text"
            className="w-full rounded-md border border-neutral-300 p-2"
            placeholder={provider.defaultModel}
            list={`models-${provider.id}`}
            value={config.model ?? ''}
            onChange={(e) => {
              void patchConfig({ model: e.target.value === '' ? undefined : e.target.value });
            }}
          />
          <datalist id={`models-${provider.id}`}>
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <button
            type="button"
            className="whitespace-nowrap rounded-md border border-neutral-300 px-3 py-2"
            onClick={() => void loadModels()}
          >
            Load models
          </button>
        </div>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          onClick={() => void testConnection()}
        >
          Test connection
        </button>
        {status && (
          <p
            role="status"
            className={`text-sm ${
              status.kind === 'error'
                ? 'text-red-600'
                : status.kind === 'ok'
                  ? 'text-green-700'
                  : 'text-neutral-500'
            }`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
