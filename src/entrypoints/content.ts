import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    // M3 will replace this with the selection watcher + lazy UI loader.
    // Until then the content script is intentionally inert.
  },
});
