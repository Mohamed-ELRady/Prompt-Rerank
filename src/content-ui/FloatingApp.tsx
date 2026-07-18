import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { connectPort } from '@/platform/messaging/port';
import { improvePort } from '@/platform/messaging/improve-port';
import { applyToTarget } from '@/site-adapters/generic/insert';
import { type CapturedTarget } from '@/site-adapters/types';

/** Actions offered in M3; M4 replaces this with the core action registry. */
const ACTIONS = [
  { id: 'improve', label: 'Improve' },
  { id: 'fix', label: 'Fix issues' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
] as const;

interface Anchor {
  top: number;
  bottom: number;
  left: number;
}

type UiState =
  | { phase: 'hidden' }
  | { phase: 'toolbar'; target: CapturedTarget; anchor: Anchor }
  | { phase: 'streaming'; target: CapturedTarget; anchor: Anchor; actionId: string; text: string }
  | {
      phase: 'done';
      target: CapturedTarget;
      anchor: Anchor;
      actionId: string;
      improved: string;
      note?: string;
    }
  | { phase: 'error'; target: CapturedTarget; anchor: Anchor; actionId: string; message: string };

export interface FloatingAppHandle {
  showToolbar(target: CapturedTarget, rect: DOMRect): void;
  selectionCleared(): void;
}

export const FloatingApp = forwardRef<FloatingAppHandle>(function FloatingApp(_props, ref) {
  const [state, setState] = useState<UiState>({ phase: 'hidden' });
  const disconnectRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    showToolbar(target, rect) {
      setState((current) =>
        current.phase === 'hidden' || current.phase === 'toolbar'
          ? {
              phase: 'toolbar',
              target,
              anchor: { top: rect.top, bottom: rect.bottom, left: rect.left },
            }
          : current,
      );
    },
    selectionCleared() {
      setState((current) => (current.phase === 'toolbar' ? { phase: 'hidden' } : current));
    },
  }));

  const close = useCallback(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    setState({ phase: 'hidden' });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [close]);

  const run = useCallback((target: CapturedTarget, anchor: Anchor, actionId: string) => {
    disconnectRef.current?.();
    setState({ phase: 'streaming', target, anchor, actionId, text: '' });

    const port = connectPort(improvePort);
    disconnectRef.current = () => {
      port.disconnect();
    };
    port.onMessage((message) => {
      if (message.type === 'chunk') {
        setState((current) =>
          current.phase === 'streaming'
            ? { ...current, text: current.text + message.delta }
            : current,
        );
      } else if (message.type === 'done') {
        disconnectRef.current = null;
        port.disconnect();
        setState((current) =>
          current.phase === 'streaming'
            ? { phase: 'done', target, anchor, actionId, improved: message.improved }
            : current,
        );
      } else {
        disconnectRef.current = null;
        port.disconnect();
        setState((current) =>
          current.phase === 'streaming'
            ? { phase: 'error', target, anchor, actionId, message: message.message }
            : current,
        );
      }
    });
    port.post({ type: 'start', text: target.text, actionId, origin: location.origin });
  }, []);

  const apply = useCallback((target: CapturedTarget, improved: string) => {
    if (applyToTarget(target, improved) === 'inserted') {
      disconnectRef.current?.();
      disconnectRef.current = null;
      setState({ phase: 'hidden' });
      return;
    }
    void navigator.clipboard.writeText(improved).then(() => {
      setState((current) =>
        current.phase === 'done'
          ? { ...current, note: 'Could not insert here — copied to clipboard instead.' }
          : current,
      );
    });
  }, []);

  if (state.phase === 'hidden') {
    return null;
  }

  const { anchor } = state;
  const viewportW = window.innerWidth;

  if (state.phase === 'toolbar') {
    const top = Math.max(anchor.top - 44, 8);
    const left = Math.min(Math.max(anchor.left, 8), viewportW - 320);
    return (
      <div
        role="toolbar"
        aria-label="PromptPolish actions"
        className="fixed z-[2147483647] flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 font-sans shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        style={{ top, left }}
      >
        <span className="px-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
          PromptPolish
        </span>
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className="rounded-md px-2 py-1 text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onMouseDown={(e) => {
              // keep the page selection/focus alive through the click
              e.preventDefault();
            }}
            onClick={() => {
              run(state.target, anchor, action.id);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  const panelTop = Math.min(anchor.bottom + 8, window.innerHeight - 260);
  const panelLeft = Math.min(Math.max(anchor.left, 8), viewportW - 400);

  return (
    <section
      aria-label="PromptPolish result"
      className="fixed z-[2147483647] w-96 rounded-lg border border-neutral-200 bg-white p-3 font-sans shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      style={{ top: Math.max(panelTop, 8), left: panelLeft }}
    >
      <header className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
          PromptPolish
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded px-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          onClick={close}
        >
          ✕
        </button>
      </header>

      {state.phase === 'error' ? (
        <div>
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <PanelButton
              primary
              onClick={() => {
                run(state.target, anchor, state.actionId);
              }}
            >
              Retry
            </PanelButton>
            <PanelButton onClick={close}>Dismiss</PanelButton>
          </div>
        </div>
      ) : (
        <div>
          <output
            aria-live="polite"
            className="block max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {state.phase === 'streaming' ? state.text || 'Improving…' : state.improved}
          </output>
          {state.phase === 'done' && (
            <div className="mt-3 flex items-center gap-2">
              <PanelButton
                primary
                onClick={() => {
                  apply(state.target, state.improved);
                }}
              >
                Apply
              </PanelButton>
              <PanelButton
                onClick={() => {
                  void navigator.clipboard.writeText(state.improved);
                }}
              >
                Copy
              </PanelButton>
              <PanelButton
                onClick={() => {
                  run(state.target, anchor, state.actionId);
                }}
              >
                Retry
              </PanelButton>
              {state.note !== undefined && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{state.note}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
});

function PanelButton({
  primary = false,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        primary
          ? 'rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700'
          : 'rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-800 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800'
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}
