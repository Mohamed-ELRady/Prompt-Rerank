import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  // User-applied drag offsets, so neither surface can end up stuck where it
  // can't be read or reached on small screens. Reset when they close.
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [toolbarDrag, setToolbarDrag] = useState({ x: 0, y: 0 });
  // The toolbar's width depends on its content (action labels), so it can't
  // be guessed up front — a hardcoded budget overflowed the viewport edge
  // whenever the real width exceeded it, pushing "More" (and its menu)
  // off-screen. Measured after paint and corrected via this offset instead.
  const [toolbarAutoOffset, setToolbarAutoOffset] = useState({ x: 0, y: 0 });
  const [menuDrag, setMenuDrag] = useState({ x: 0, y: 0 });
  /**
   * The toolbar's real on-screen box plus the origin of its containing block.
   *
   * Both matter because host pages often put a transform/will-change/contain
   * on an ancestor of our Shadow host, which makes THAT element — not the
   * viewport — the containing block for our `position: fixed` surfaces. Fixed
   * coordinates then diverge from viewport coordinates by the containing
   * block's offset, so anything positioned from viewport math (like deciding
   * whether the menu has room below) has to be converted back through
   * `origin` before it's written to `top`/`left`.
   */
  const [toolbarGeometry, setToolbarGeometry] = useState<{
    rect: { top: number; bottom: number; left: number; right: number };
    origin: { x: number; y: number };
  } | null>(null);
  /**
   * Correction applied to the menu after measuring where it actually landed.
   *
   * Computing the right position up front has repeatedly failed because it
   * depends on things we can't see from here (the containing block, ancestor
   * transforms, zoom, stale geometry after a scroll). Measuring the rendered
   * box and nudging it back on screen is independent of all of that, so it
   * holds whatever the host page does.
   */
  const [menuAutoOffset, setMenuAutoOffset] = useState({ x: 0, y: 0 });
  /** Bumped on scroll/resize so measured geometry can't go stale. */
  const [viewportTick, setViewportTick] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastAnchorRef = useRef<{ top: number; left: number } | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  // Watchdog against a stuck "Working…": if no chunk/done/error arrives within
  // the idle window (provider not streaming, worker died mid-request, network
  // black hole), surface an actionable error instead of hanging forever.
  const watchdogRef = useRef<number | undefined>(undefined);

  const failStuck = useCallback(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    setState((current) =>
      current.phase === 'streaming'
        ? {
            ...current,
            phase: 'error',
            message:
              'No response from the AI provider (timed out). Open Settings and check your provider, API key, model name, and Base URL — then Retry.',
          }
        : current,
    );
  }, []);

  const armWatchdog = useCallback(() => {
    window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(failStuck, 45_000);
  }, [failStuck]);

  useEffect(
    () => () => {
      window.clearTimeout(watchdogRef.current);
    },
    [],
  );

  /**
   * Pointer-drag handler shared by the toolbar and the result panel. Presses
   * that land on a button are ignored, so dragging never swallows an action;
   * preventDefault also keeps the page selection alive through the drag.
   */
  const dragHandler =
    (offset: { x: number; y: number }, setOffset: (next: { x: number; y: number }) => void) =>
    (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = offset.x;
      const originY = offset.y;
      const onMove = (moveEvent: PointerEvent) => {
        setOffset({
          x: originX + (moveEvent.clientX - startX),
          y: originY + (moveEvent.clientY - startY),
        });
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    };

  // Move focus into the panel when a run starts, so keyboard and screen-
  // reader users land on the live result region (FR-A7).
  const streamingStarted = state.phase === 'streaming';
  useEffect(() => {
    if (streamingStarted) {
      panelRef.current?.focus();
    }
  }, [streamingStarted]);

  // The toolbar's width depends on its action labels, so its base position can
  // only clamp against the left/top edges, not the right/bottom ones — measure
  // the real rendered box after layout and nudge it back on screen if it
  // overflows. The same measurement yields the containing-block origin (the
  // gap between where we asked it to be and where it actually landed), which
  // the menu needs to position itself in true viewport terms. Converges in at
  // most one correction; manual drags are the user's choice and aren't undone.
  useLayoutEffect(() => {
    if (state.phase !== 'toolbar') {
      return;
    }
    const el = toolbarRef.current;
    if (!el) {
      return;
    }
    const EDGE = 8;
    const rect = el.getBoundingClientRect();
    // A surface wider/taller than the viewport can't satisfy both edges: it
    // must be pinned to one, or the two corrections fight each other and the
    // effect re-renders forever (which froze the toolbar entirely on narrow
    // windows before this guard existed).
    const dx =
      rect.width > window.innerWidth - 2 * EDGE
        ? EDGE - rect.left
        : rect.right > window.innerWidth - EDGE
          ? window.innerWidth - EDGE - rect.right
          : rect.left < EDGE
            ? EDGE - rect.left
            : 0;
    const dy =
      rect.height > window.innerHeight - 2 * EDGE
        ? EDGE - rect.top
        : rect.bottom > window.innerHeight - EDGE
          ? window.innerHeight - EDGE - rect.bottom
          : rect.top < EDGE
            ? EDGE - rect.top
            : 0;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      setToolbarAutoOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return; // re-measure on the next pass, once the correction has applied
    }
    // Where the browser actually put it vs. where we asked it to be: nonzero
    // whenever a transformed/contained ancestor is the containing block.
    const origin = {
      x: rect.left - (parseFloat(el.style.left) || 0),
      y: rect.top - (parseFloat(el.style.top) || 0),
    };
    setToolbarGeometry((prev) =>
      prev &&
      Math.abs(prev.rect.top - rect.top) < 0.5 &&
      Math.abs(prev.rect.left - rect.left) < 0.5 &&
      Math.abs(prev.rect.right - rect.right) < 0.5 &&
      Math.abs(prev.origin.x - origin.x) < 0.5 &&
      Math.abs(prev.origin.y - origin.y) < 0.5
        ? prev
        : {
            rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            origin,
          },
    );
  }, [state, toolbarAutoOffset, viewportTick]);

  /**
   * Keep the open menu on screen by measuring where it really is.
   *
   * This is the guarantee, not the placement math above: whatever coordinate
   * space the host page imposes, the rendered box is ground truth. Skipped
   * once the user has dragged it — then the position is their choice, not
   * ours to override.
   */
  useLayoutEffect(() => {
    if (state.phase !== 'toolbar' || !state.menuOpen) {
      return;
    }
    if (menuDrag.x !== 0 || menuDrag.y !== 0) {
      return;
    }
    const el = menuRef.current;
    if (!el) {
      return;
    }
    const EDGE = 8;
    const rect = el.getBoundingClientRect();
    // When a surface is larger than the viewport it can't satisfy both edges,
    // so pin it to the top/left instead of oscillating between them.
    const dy =
      rect.height > window.innerHeight - 2 * EDGE
        ? EDGE - rect.top
        : rect.bottom > window.innerHeight - EDGE
          ? window.innerHeight - EDGE - rect.bottom
          : rect.top < EDGE
            ? EDGE - rect.top
            : 0;
    const dx =
      rect.width > window.innerWidth - 2 * EDGE
        ? EDGE - rect.left
        : rect.right > window.innerWidth - EDGE
          ? window.innerWidth - EDGE - rect.right
          : rect.left < EDGE
            ? EDGE - rect.left
            : 0;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      setMenuAutoOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, [state, menuDrag, menuAutoOffset, toolbarGeometry, viewportTick]);

  // Measured geometry goes stale when the page scrolls or the window resizes
  // (and under a transformed ancestor our surfaces scroll with the page), so
  // refresh it. rAF-coalesced: scroll fires far more often than we need.
  useEffect(() => {
    if (state.phase === 'hidden') {
      return;
    }
    let queued = false;
    const bump = () => {
      if (queued) {
        return;
      }
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setViewportTick((tick) => tick + 1);
      });
    };
    window.addEventListener('resize', bump);
    window.addEventListener('scroll', bump, true);
    return () => {
      window.removeEventListener('resize', bump);
      window.removeEventListener('scroll', bump, true);
    };
  }, [state.phase]);

  useImperativeHandle(ref, () => ({
    showToolbar(target, rect) {
      // Only a genuinely new position needs a fresh width measurement —
      // otherwise the debounced re-fire on every selectionchange tick would
      // wipe the correction and flicker every ~180ms while a selection sits
      // still. Read via ref, not `state`, so this stays a plain event
      // handler rather than a side effect inside the setState updater.
      const lastAnchor = lastAnchorRef.current;
      const moved =
        !lastAnchor ||
        Math.abs(lastAnchor.top - rect.top) > 1 ||
        Math.abs(lastAnchor.left - rect.left) > 1;
      lastAnchorRef.current = { top: rect.top, left: rect.left };
      if (moved) {
        setToolbarAutoOffset({ x: 0, y: 0 });
      }
      setState((current) => {
        // A repeated selectionchange must not tear down an open "More" menu.
        if (current.phase === 'toolbar' && current.menuOpen) {
          return current;
        }
        return current.phase === 'hidden' || current.phase === 'toolbar'
          ? {
              phase: 'toolbar',
              target,
              anchor: { top: rect.top, bottom: rect.bottom, left: rect.left },
              menuOpen: false,
            }
          : current;
      });
    },
    selectionCleared() {
      lastAnchorRef.current = null;
      setToolbarDrag({ x: 0, y: 0 });
      setToolbarAutoOffset({ x: 0, y: 0 });
      setMenuDrag({ x: 0, y: 0 });
      setMenuAutoOffset({ x: 0, y: 0 });
      setState((current) => (current.phase === 'toolbar' ? { phase: 'hidden' } : current));
    },
  }));

  const close = useCallback(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    window.clearTimeout(watchdogRef.current);
    lastAnchorRef.current = null;
    setDrag({ x: 0, y: 0 });
    setToolbarDrag({ x: 0, y: 0 });
    setToolbarAutoOffset({ x: 0, y: 0 });
    setMenuDrag({ x: 0, y: 0 });
    setMenuAutoOffset({ x: 0, y: 0 });
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

  const run = useCallback(
    (target: CapturedTarget, anchor: Anchor, action: ActionDefinition) => {
      disconnectRef.current?.();
      armWatchdog();
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
          armWatchdog(); // progress: reset the idle timer
          setState((current) =>
            current.phase === 'streaming'
              ? { ...current, text: current.text + message.delta }
              : current,
          );
        } else if (message.type === 'done') {
          window.clearTimeout(watchdogRef.current);
          disconnectRef.current = null;
          port.disconnect();
          setState((current) =>
            current.phase === 'streaming'
              ? { ...current, phase: 'done', improved: message.improved, view: 'result' }
              : current,
          );
        } else {
          window.clearTimeout(watchdogRef.current);
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
    },
    [armWatchdog],
  );

  const apply = useCallback((target: CapturedTarget, improved: string) => {
    // Replace the whole field: the user is swapping the entire old prompt for
    // the rewritten one, not editing a fragment.
    if (applyToTarget(target, improved, 'replace-all') === 'inserted') {
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
    // Only the left/top edges can be clamped without knowing the toolbar's
    // real width (see the measurement effect above for the right/bottom
    // correction, applied via toolbarAutoOffset).
    const top = Math.max(anchor.top - 44, 8) + toolbarDrag.y + toolbarAutoOffset.y;
    const left = Math.max(anchor.left, 8) + toolbarDrag.x + toolbarAutoOffset.x;
    // The menu is a fixed-position card placed from the toolbar's MEASURED
    // on-screen box, not from `top`/`left` above: those are containing-block
    // coordinates, which diverge from viewport coordinates under a
    // transformed ancestor — deciding "is there room below?" from them put
    // the menu hundreds of pixels off-screen on real sites. Viewport math
    // here, converted back through `origin` when written to style.
    const MENU_WIDTH = 224;
    const MENU_MAX_HEIGHT = 320;
    const EDGE = 8;
    const GAP = 6;
    const menuStyle = ((): React.CSSProperties | null => {
      if (!state.menuOpen || !toolbarGeometry) {
        return null;
      }
      const { rect, origin } = toolbarGeometry;
      const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
      const roomAbove = rect.top - GAP - EDGE;
      const below = roomBelow >= roomAbove;
      const maxHeight = Math.max(140, Math.min(MENU_MAX_HEIGHT, below ? roomBelow : roomAbove));
      // viewport-space target, then clamped inside every edge
      const viewportTop = below
        ? rect.bottom + GAP
        : Math.max(EDGE, rect.top - GAP - Math.min(maxHeight, MENU_MAX_HEIGHT));
      const viewportLeft = Math.max(
        EDGE,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - EDGE),
      );
      return {
        top: viewportTop - origin.y + menuDrag.y + menuAutoOffset.y,
        left: viewportLeft - origin.x + menuDrag.x + menuAutoOffset.x,
        width: MENU_WIDTH,
        maxHeight,
      };
    })();
    const keepSelection = (e: React.MouseEvent) => {
      e.preventDefault();
    };
    return (
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Prompt Rerank actions"
        onPointerDown={dragHandler(toolbarDrag, setToolbarDrag)}
        className="pp-fade-in fixed z-[2147483647] flex w-max max-w-[calc(100vw-1rem)] touch-none select-none flex-wrap items-center gap-1 whitespace-nowrap rounded-lg border border-neutral-200 bg-white p-1 font-sans shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        style={{ top, left }}
      >
        <span
          title="Drag to move"
          className="flex cursor-move items-center gap-1 px-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400"
        >
          <span aria-hidden="true" className="text-neutral-400">
            ⠿
          </span>
          Prompt Rerank
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
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={state.menuOpen}
          className="rounded-md px-2 py-1 text-xs text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
          onMouseDown={keepSelection}
          onClick={() => {
            setMenuDrag({ x: 0, y: 0 });
            setMenuAutoOffset({ x: 0, y: 0 });
            setState({ ...state, menuOpen: !state.menuOpen });
          }}
        >
          More ▾
        </button>
        {menuStyle && (
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="pp-fade-in fixed z-[2147483647] flex touch-none select-none flex-col rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div
              onPointerDown={dragHandler(menuDrag, setMenuDrag)}
              title="Drag to move"
              className="flex shrink-0 cursor-move items-center justify-between border-b border-neutral-200 px-2 py-1 dark:border-neutral-700"
            >
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                <span aria-hidden="true">⠿</span>
                More actions
              </span>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onMouseDown={keepSelection}
                onClick={() => {
                  setState({ ...state, menuOpen: false });
                }}
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
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
          </div>
        )}
      </div>
    );
  }

  // Responsive placement: never wider than the viewport, always clamped on
  // screen. The user can then drag it anywhere via the header.
  const panelWidth = Math.min(416, window.innerWidth - 16);
  const panelTop = Math.max(Math.min(anchor.bottom + 8, window.innerHeight - 200), 8) + drag.y;
  const panelLeft =
    Math.min(Math.max(anchor.left, 8), Math.max(8, window.innerWidth - panelWidth - 8)) + drag.x;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="Prompt Rerank result"
      className="pp-pop-in fixed z-[2147483647] flex max-h-[calc(100vh-1rem)] flex-col rounded-lg border border-neutral-200 bg-white p-3 font-sans text-neutral-900 shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      style={{ top: panelTop, left: panelLeft, width: panelWidth }}
    >
      <header
        onPointerDown={dragHandler(drag, setDrag)}
        className="mb-2 flex cursor-move touch-none select-none items-center justify-between"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
          <span aria-hidden="true" className="text-neutral-400">
            ⠿
          </span>
          Prompt Rerank · {state.action.label}
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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
      </div>
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
