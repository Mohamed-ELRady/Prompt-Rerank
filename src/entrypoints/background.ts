import { browser, defineBackground } from '#imports';

export default defineBackground(() => {
  // M1 will replace this with the message/port orchestrator.
  browser.runtime.onInstalled.addListener((details) => {
    console.debug('[promptpolish] installed', details.reason);
  });
});
