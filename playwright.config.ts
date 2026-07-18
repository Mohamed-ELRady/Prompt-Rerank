import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Extension tests need a real (headed-capable) persistent Chromium context;
  // workers share nothing, but keep 1 locally to avoid profile-dir races.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    port: 8787,
    reuseExistingServer: !process.env.CI,
  },
});
