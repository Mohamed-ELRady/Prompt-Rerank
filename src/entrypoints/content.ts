import { browser, defineContentScript } from '#imports';
// `import type` (not `import { type … }`): with verbatimModuleSyntax the
// inline form emits a side-effect import that would inline the whole UI
// chunk into this entry.
import type { UiController } from '@/content-ui/mount';
import { captureSelection } from '@/site-adapters/generic/capture';

/**
 * Always-loaded watcher (SDD §6, §8). Everything heavy — React, zod,
 * messaging, the floating UI — lives in the lazily imported content-ui
 * chunk, loaded on the first real selection. This entry must stay tiny
 * (CI enforces a bundle budget) and add no page-visible overhead:
 * one debounced selectionchange listener, no observers, no polling.
 */

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  async main(ctx) {
    // Per-site kill switch. Raw storage read on purpose: pulling the zod
    // schema into this entry would triple its size; the shape is validated
    // properly everywhere else.
    const stored: { settings?: { data?: { disabledOrigins?: unknown } } } =
      await browser.storage.local.get('settings');
    const disabledOrigins = stored.settings?.data?.disabledOrigins;
    if (Array.isArray(disabledOrigins) && disabledOrigins.includes(location.origin)) {
      return;
    }

    let uiPromise: Promise<UiController> | undefined;
    const ensureUi = () =>
      (uiPromise ??= (async () => {
        // Runtime URL import instead of a bare import(): Vite would inline the
        // chunk into this IIFE entry, defeating lazy loading (SDD §8). The
        // unlisted script hands its factory over via an isolated-world global.
        await import(/* @vite-ignore */ browser.runtime.getURL('/content-ui.js'));
        const createUi = globalThis.__promptpolishCreateUi;
        if (!createUi) {
          throw new Error('content-ui chunk failed to initialize');
        }
        return createUi(ctx);
      })());

    let debounce: number | undefined;
    let disposed = false;

    async function evaluateSelection(): Promise<void> {
      const target = captureSelection();
      if (!target) {
        // Nothing selected: only bother the UI if it was ever loaded.
        if (uiPromise) {
          (await uiPromise).notifySelection(null);
        }
        return;
      }
      const ui = await ensureUi();
      if (!disposed) {
        ui.notifySelection(target);
      }
    }

    const onSelectionMaybeChanged = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void evaluateSelection();
      }, 180);
    };

    document.addEventListener('selectionchange', onSelectionMaybeChanged);

    // Keyboard command relayed by the background; validated loosely here to
    // keep zod out of this entry (the real protocol boundary is bg-side).
    browser.runtime.onMessage.addListener((raw: unknown) => {
      const message = raw as { kind?: string; type?: string };
      if (message.kind === 'promptpolish' && message.type === 'command.improve') {
        void evaluateSelection();
      }
    });

    ctx.onInvalidated(() => {
      disposed = true;
      document.removeEventListener('selectionchange', onSelectionMaybeChanged);
    });
  },
});
