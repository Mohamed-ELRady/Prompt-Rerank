import { useEffect, useMemo, useState } from 'react';
import { sendMessage } from '@/platform/messaging';
import { type HistoryEntry } from '@/platform/storage';

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const reload = () =>
    sendMessage('history.list', {}).then(({ entries: loaded }) => {
      setEntries(loaded);
    });
  useEffect(() => {
    void sendMessage('history.list', {}).then(({ entries: loaded }) => {
      setEntries(loaded);
    });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!onlyFavorites || e.favorite) &&
        (q === '' ||
          e.original.toLowerCase().includes(q) ||
          e.improved.toLowerCase().includes(q) ||
          e.origin.toLowerCase().includes(q)),
    );
  }, [entries, query, onlyFavorites]);

  return (
    <section aria-labelledby="history-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-heading" className="text-lg font-medium">
          History
        </h2>
        <button
          type="button"
          className="text-sm text-red-600 underline"
          onClick={() => {
            void sendMessage('history.clear', {}).then(reload);
          }}
        >
          Clear all
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <input
          type="search"
          aria-label="Search history"
          placeholder="Search history…"
          className="w-full rounded-md border border-neutral-300 p-2"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        <label className="flex shrink-0 items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => {
              setOnlyFavorites(e.target.checked);
            }}
          />
          Favorites
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {entries.length === 0
            ? 'Improved prompts will appear here.'
            : 'Nothing matches your search.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-neutral-400">
                <span>
                  {new Date(entry.createdAt).toLocaleString()} · {entry.origin} · {entry.actionId}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={entry.favorite}
                    className={entry.favorite ? 'text-amber-500' : 'text-neutral-300'}
                    onClick={() => {
                      void sendMessage('history.toggleFavorite', { id: entry.id }).then(reload);
                    }}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-neutral-700"
                    onClick={() => {
                      void navigator.clipboard.writeText(entry.improved);
                    }}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    aria-label="Delete entry"
                    className="text-neutral-400 hover:text-red-600"
                    onClick={() => {
                      void sendMessage('history.delete', { id: entry.id }).then(reload);
                    }}
                  >
                    ✕
                  </button>
                </span>
              </div>
              <p className="line-clamp-2 text-neutral-400">{entry.original}</p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-neutral-800">
                {entry.improved}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
