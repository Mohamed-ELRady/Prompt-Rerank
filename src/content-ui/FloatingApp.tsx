import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { actions, type ActionDefinition } from '@/core/actions';
import { type PromptAnalysis } from '@/core/types';
import { sendMessage } from '@/platform/messaging/messenger';
import { connectPort } from '@/platform/messaging/port';
import { improvePort } from '@/platform/messaging/improve-port';
import { applyToTarget } from '@/site-adapters/generic/insert';
import { findSiteProfile } from '@/site-adapters/profiles';
import { type CapturedTarget } from '@/site-adapters/types';
import { AnalysisCard } from './AnalysisCard';
import { DiffView } from './DiffView';

const primaryActions = actions.filter((a) => a.group === 'primary');
const menuGroups: { title: string; items: ActionDefinition[] }[] = [
  { title: 'Refine', items: actions.filter((a) => a.group === 'refine') },
  { title: 'Optimize for task', items: actions.filter((a) => a.group === 'domain') },
  { title: 'Optimize for model', items: actions.filter((a) => a.group === 'model') },
];

interface Anchor {
  top: number;
  bottom: number;
  left: number;
}

interface RunContext {
  target: CapturedTarget;
  anchor: Anchor;
  action: ActionDefinition;
  analysis?: PromptAnalysis;
}

type UiState =
  | { phase: 'hidden' }
  | { phase: 'toolbar'; target: CapturedTarget; anchor: Anchor; menuOpen: boolean }
  | ({ phase: 'streaming'; text: string } & RunContext)
  | ({ phase: 'done'; improved: string; view: 'result' | 'diff'; note?: string } & RunContext)
  | ({ phase: 'error'; message: string } & RunContext);

export interface FloatingAppHandle {
  showToolbar(target: CapturedTarget, rect: DOMRect): void;
  selectionCleared(): void;
}

export const FloatingApp = forwardRef<FloatingAppHandle>(function FloatingApp(_props, ref) {
  const [state, setState] = useState<UiState>({ phase: 'hidden' });
  const disconnectRef = useRef<(() => void) | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  // Move focus into the panel when a run starts, so keyboard and screen-
  // reader users land on the live result region (FR-A7).
  const streamingStarted = state.phase === 'streaming';
  useEffect(() => {
    if (streamingStarted) {
      panelRef.current?.focus();
    }
  }, [streamingStarted]);

  useImperativeHandle(ref, () => ({
    showToolbar(target, rect) {
      setState((current) =>
        current.phase === 'hidden' || current.phase === 'toolbar'
          ? {
              phase: 'toolbar',
              target,
              anchor: { top: rect.top, bottom: rect.bottom, left: rect.left },
              menuOpen: false,
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

  const run = useCallback((target: CapturedTarget, anchor: Anchor, action: ActionDefinition) => {
    disconnectRef.current?.();
    setState({ phase: 'streaming', target, anchor, action, text: '' });

    // Local analysis renders instantly while the rewrite streams (SDD §8).
    void sendMessage('analyze', { text: target.text }).then((analysis) => {
      setState((current) =>
        current.phase === 'streaming' || current.phase === 'done' || current.phase === 'error'
          ? { ...current, analysis }
          : current,
      );
    });

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
            ? { ...current, phase: 'done', improved: message.improved, view: 'result' }
            : current,
        );
      } else {
        disconnectRef.current = null;
        port.disconnect();
        setState((current) =>
          current.phase === 'streaming'
            ? { ...current, phase: 'error', message: message.message }
            : current,
        );
      }
    });
    port.post({
      type: 'start',
      text: target.text,
      actionId: action.id,
      origin: location.origin,
      // e.g. claude.ai → 'claude', so plain Improve is already model-tuned
      targetModel: findSiteProfile(location.host)?.targetModel,
    });
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

  if (state.phase === 'toolbar') {
    const top = Math.max(anchor.top - 44, 8);
    const left = Math.min(Math.max(anchor.left, 8), window.innerWidth - 360);
    const keepSelection = (e: React.MouseEvent) => {
      e.preventDefault();
    };
    return (
      <div
        role="toolbar"
        aria-label="PromptPolish actions"
        className="pp-pop-in fixed z-[2147483647] flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 font-sans shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        style={{ top, left }}
      >
        <span className="px-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
          PromptPolish
        </span>
        {primaryActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="rounded-md px-2 py-1 text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onMouseDown={keepSelection}
            onClick={() => {
              run(state.target, anchor, action);
            }}
          >
            {action.label}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={state.menuOpen}
            className="rounded-md px-2 py-1 text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onMouseDown={keepSelection}
            onClick={() => {
              setState({ ...state, menuOpen: !state.menuOpen });
            }}
          >
            More ▾
          </button>
          {state.menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-7 max-h-80 w-52 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
            >
              {menuGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {group.title}
                  </p>
                  {group.items.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                      onMouseDown={keepSelection}
                      onClick={() => {
                        run(state.target, anchor, action);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const panelTop = Math.max(Math.min(anchor.bottom + 8, window.innerHeight - 320), 8);
  const panelLeft = Math.min(Math.max(anchor.left, 8), window.innerWidth - 440);

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="PromptPolish result"
      className="pp-pop-in fixed z-[2147483647] w-[26rem] rounded-lg border border-neutral-200 bg-white p-3 font-sans text-neutral-900 shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      style={{ top: panelTop, left: panelLeft }}
    >
      <header className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
          PromptPolish · {state.action.label}
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

      {state.analysis && <AnalysisCard analysis={state.analysis} />}

      {state.phase === 'error' ? (
        <div>
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <PanelButton
              primary
              onClick={() => {
                run(state.target, anchor, state.action);
              }}
            >
              Retry
            </PanelButton>
            <PanelButton onClick={close}>Dismiss</PanelButton>
          </div>
        </div>
      ) : (
        <div>
          {state.phase === 'done' && state.action.producesRewrite && (
            <div className="mb-2 flex gap-1" role="tablist" aria-label="Result view">
              <ViewTab
                selected={state.view === 'result'}
                onClick={() => {
                  setState({ ...state, view: 'result' });
                }}
              >
                Result
              </ViewTab>
              <ViewTab
                selected={state.view === 'diff'}
                onClick={() => {
                  setState({ ...state, view: 'diff' });
                }}
              >
                Before / After
              </ViewTab>
            </div>
          )}

          {state.phase === 'done' && state.view === 'diff' ? (
            <DiffView before={state.target.text} after={state.improved} />
          ) : (
            <output
              aria-live="polite"
              className="block max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {state.phase === 'streaming' ? state.text || 'Working…' : state.improved}
            </output>
          )}

          {state.phase === 'done' && (
            <div className="mt-3 flex items-center gap-2">
              {state.action.producesRewrite && (
                <PanelButton
                  primary
                  onClick={() => {
                    apply(state.target, state.improved);
                  }}
                >
                  Apply
                </PanelButton>
              )}
              <PanelButton
                onClick={() => {
                  void navigator.clipboard.writeText(state.improved);
                }}
              >
                Copy
              </PanelButton>
              <PanelButton
                onClick={() => {
                  run(state.target, anchor, state.action);
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

function ViewTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`rounded-md px-2 py-1 text-xs ${
        selected
          ? 'bg-violet-100 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

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
