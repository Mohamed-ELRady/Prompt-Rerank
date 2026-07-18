import { type createUi } from './mount';

declare global {
  // Handoff slot between the content-ui unlisted script and the watcher
  // (see src/entrypoints/content-ui.ts for why a global is used).
  var __promptpolishCreateUi: typeof createUi | undefined;
}

export {};
