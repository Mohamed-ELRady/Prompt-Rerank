import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Explicit imports only — auto-imports hide dependencies and confuse tooling.
  imports: false,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'clipboardWrite'],
    web_accessible_resources: [
      {
        // lazy UI chunk + its stylesheet, imported by the content watcher (SDD §8)
        resources: ['content-ui.js', 'assets/content-ui.css'],
        matches: ['http://*/*', 'https://*/*'],
      },
    ],
    commands: {
      'improve-selection': {
        suggested_key: { default: 'Ctrl+Shift+U', mac: 'Command+Shift+U' },
        description: 'Improve the selected prompt text',
      },
    },
    // Background-only fetch targets for the bundled providers (SDD §7).
    // Custom self-hosted base URLs will use optional host permissions later.
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.deepseek.com/*',
      'https://openrouter.ai/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
