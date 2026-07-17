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
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
