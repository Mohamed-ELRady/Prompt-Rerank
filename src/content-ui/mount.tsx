import ReactDOM from 'react-dom/client';
import { browser, type ContentScriptContext } from '#imports';
import '@/assets/tailwind.css';
import { sendMessage } from '@/platform/messaging/messenger';
import { applyTheme } from '@/ui/theme';
import { targetAnchorRect } from '@/site-adapters/generic/capture';
import { type CapturedTarget } from '@/site-adapters/types';
import { FloatingApp, type FloatingAppHandle } from './FloatingApp';

export interface UiController {
  notifySelection(target: CapturedTarget | null): void;
}

/**
 * Mounts the floating UI in a closed world (FR-A2): a Shadow DOM host whose
 * stylesheet (this chunk's extracted Tailwind CSS) is injected directly into
 * the shadow root, so host-page CSS cannot restyle us and ours never leaks
 * out. Mounted manually rather than via createShadowRootUi because this code
 * ships in the lazily-imported unlisted chunk, whose CSS asset WXT's helper
 * cannot locate (it resolves paths for regular content-script entries only).
 */
// WXT's PublicPath typegen only covers entrypoint outputs, not build-emitted
// assets like this chunk's extracted stylesheet.
const CSS_PATH = '/assets/content-ui.css' as Parameters<typeof browser.runtime.getURL>[0];

export async function createUi(ctx: ContentScriptContext): Promise<UiController> {
  const css = await fetch(browser.runtime.getURL(CSS_PATH)).then((r) => r.text());

  const host = document.createElement('promptpolish-ui');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `:host{all:initial !important;}\n${css}`;
  shadow.append(style);

  const container = document.createElement('div');
  shadow.append(container);
  document.body.append(host);

  // Theme inside the shadow world follows the user's setting (FR-A7).
  void sendMessage('settings.get', {}).then((settings) => {
    applyTheme(container, settings.theme);
  });

  let handle: FloatingAppHandle | null = null;
  // root.render commits asynchronously; notifications arriving before the
  // ref attaches (always true for the very first selection) are queued.
  let pending: CapturedTarget | null | undefined;

  const deliver = (h: FloatingAppHandle, target: CapturedTarget | null) => {
    if (target) {
      h.showToolbar(target, targetAnchorRect(target));
    } else {
      h.selectionCleared();
    }
  };

  const root = ReactDOM.createRoot(container);
  root.render(
    <FloatingApp
      ref={(h) => {
        handle = h;
        if (h && pending !== undefined) {
          deliver(h, pending);
          pending = undefined;
        }
      }}
    />,
  );

  ctx.onInvalidated(() => {
    root.unmount();
    host.remove();
    handle = null;
  });

  return {
    notifySelection(target) {
      if (handle) {
        deliver(handle, target);
      } else {
        pending = target;
      }
    },
  };
}
