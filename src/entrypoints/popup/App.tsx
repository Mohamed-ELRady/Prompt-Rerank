import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { actions } from '@/core/actions';
import { sendMessage } from '@/platform/messaging';
import { improvePort } from '@/platform/messaging/improve-port';
import { connectPort } from '@/platform/messaging/port';
import { type HistoryEntry } from '@/platform/storage';
import { useTheme } from '@/ui/useTheme';

const quickActions = actions.filter((a) => a.group === 'primary' && a.producesRewrite);

type RunState =
  | { phase: 'idle' }
  | { phase: 'streaming'; text: string }
  | { phase: 'done'; improved: string }
  | { phase: 'error'; message: string };

export function App() {
  const [input, setInput] = useState('');
  const [actionId, setActionId] = useState('improve');
  const [run, setRun] = useState<RunState>({ phase: 'idle' });
  const [recents, setRecents] = useState<HistoryEntry[]>([]);
  const disconnectRef = useRef<(() => void) | null>(null);

  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>();
  useTheme(theme);

  useEffect(() => {
    void sendMessage('history.list', {}).then(({ entries }) => {
      setRecents(entries.slice(0, 5));
    });
    void sendMessage('settings.get', {}).then((settings) => {
      setTheme(settings.theme);
    });
    return () => {
      disconnectRef.current?.();
    };
  }, []);

  const improve = () => {
    const text = input.trim();
    if (text === '') {
      return;
    }
    disconnectRef.current?.();
    setRun({ phase: 'streaming', text: '' });
    const port = connectPort(improvePort);
    disconnectRef.current = () => {
      port.disconnect();
    };
    port.onMessage((message) => {
      if (message.type === 'chunk') {
        setRun((s) => (s.phase === 'streaming' ? { ...s, text: s.text + message.delta } : s));
      } else if (message.type === 'done') {
        port.disconnect();
        disconnectRef.current = null;
        setRun({ phase: 'done', improved: message.improved });
      } else {
        port.disconnect();
        disconnectRef.current = null;
        setRun({ phase: 'error', message: message.message });
      }
    });
    port.post({ type: 'start', text, actionId, origin: 'popup' });
  };

  return (
    <main className="w-96 space-y-3 bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-violet-700">Prompt Rerank</h1>
        <button
          type="button"
          className="text-xs text-neutral-500 underline"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </header>

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="sr-only">Prompt to improve</span>
          <textarea
            rows={4}
            placeholder="Paste a prompt to improve…"
            className="w-full rounded-md border border-neutral-300 p-2 text-sm"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
          />
        </label>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="popup-action">
            Action
          </label>
          <select
            id="popup-action"
            className="rounded-md border border-neutral-300 p-1.5 text-sm"
            value={actionId}
            onChange={(e) => {
              setActionId(e.target.value);
            }}
          >
            {quickActions.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex-1 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            disabled={input.trim() === '' || run.phase === 'streaming'}
            onClick={improve}
          >
            {run.phase === 'streaming' ? 'Improving…' : 'Improve'}
          </button>
        </div>
      </div>

      {run.phase === 'error' && <p className="text-sm text-red-600">{run.message}</p>}
      {(run.phase === 'streaming' || run.phase === 'done') && (
        <div>
          <output
            aria-live="polite"
            className="block max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-sm"
          >
            {run.phase === 'streaming' ? run.text || 'Working…' : run.improved}
          </output>
          {run.phase === 'done' && (
            <button
              type="button"
              className="mt-2 rounded-md border border-neutral-300 px-3 py-1.5 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(run.improved);
              }}
            >
              Copy result
            </button>
          )}
        </div>
      )}

      {recents.length > 0 && (
        <section aria-labelledby="recents-heading">
          <h2
            id="recents-heading"
            className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400"
          >
            Recent
          </h2>
          <ul className="space-y-1">
            {recents.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-neutral-600">{entry.improved}</span>
                <button
                  type="button"
                  className="shrink-0 text-neutral-400 underline hover:text-neutral-700"
                  onClick={() => {
                    void navigator.clipboard.writeText(entry.improved);
                  }}
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
