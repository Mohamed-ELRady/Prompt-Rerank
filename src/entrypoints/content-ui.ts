import { defineUnlistedScript } from '#imports';
import { createUi } from '@/content-ui/mount';

/**
 * Lazy UI chunk (SDD §8). MV3 content scripts are single-file IIFEs, so code
 * splitting works by shipping the heavy UI (React + messaging + panel) as a
 * separate web-accessible script that the tiny watcher imports on the first
 * real selection. Exports don't survive the IIFE wrapper, so the factory is
 * handed over via a namespaced global in the isolated world.
 */
export default defineUnlistedScript(() => {
  globalThis.__promptpolishCreateUi = createUi;
});
