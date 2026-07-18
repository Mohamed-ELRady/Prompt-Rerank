import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Explicit imports only — auto-imports hide dependencies and confuse tooling.
  imports: false,
  manifest: {
    name: 'PromptPolish',
    description:
      'AI prompt optimization assistant — analyze, strengthen, and rewrite prompts for any AI model.',
    permissions: ['storage'],
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
