import { browser, defineBackground } from '#imports';
import { registerMessageHandlers } from '@/platform/messaging';
import { createLogger } from '@/platform/logging';
import { settingsRepo } from '@/platform/storage';

const log = createLogger('background');

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    log.info(`installed (${details.reason})`);
    // Reading every repo runs pending migrations exactly once per update
    // instead of lazily on first use.
    void settingsRepo.get().then((settings) => settingsRepo.set(settings));
  });

  registerMessageHandlers({
    ping: () => Promise.resolve({ ok: true, version: browser.runtime.getManifest().version }),
    'settings.get': () => settingsRepo.get(),
    'settings.update': ({ patch }) => settingsRepo.update((current) => ({ ...current, ...patch })),
  });
});
