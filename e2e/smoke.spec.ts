import { expect, test } from './fixtures';

test('extension loads and popup renders', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'Prompt Rerank' })).toBeVisible();
});

test('options page lists providers and persists settings', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const providerSelect = page.getByLabel('Provider', { exact: true });
  await expect(providerSelect).toBeVisible();
  // all bundled providers are offered, including the free-tier presets and
  // the Custom escape hatch
  await expect(providerSelect.locator('option')).toHaveText([
    'OpenAI',
    'Groq (free tier)',
    'xAI (Grok)',
    'Mistral (free tier)',
    'Together AI',
    'DeepSeek',
    'OpenRouter',
    'Ollama (local)',
    'LM Studio (local)',
    'Custom (any OpenAI-compatible API)',
    'Anthropic',
    'Google Gemini',
  ]);
  // switching provider persists through the background worker
  await providerSelect.selectOption('ollama');
  await page.reload();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('ollama');
});
