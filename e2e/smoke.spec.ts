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

test('clicking the model dropdown arrow shows every fetched model', async ({
  context,
  extensionId,
}) => {
  // Regression: this used to be a native <input list>/<datalist> combo.
  // Chrome's suggestion popup for that is browser-chrome UI outside the
  // page — invisible to automated checks, and per repeated real-world
  // reports it sometimes just never opened, even with the fetched models
  // sitting right there in the DOM. Replaced with a plain in-page list so
  // "the arrow shows the models" is a real, assertable DOM fact.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByLabel('Provider', { exact: true }).selectOption('ollama');
  await page.getByLabel('Base URL').fill('http://localhost:8787/v1');

  const modelList = page.getByRole('listbox', { name: 'Fetched models' });
  await expect(modelList).toBeHidden();

  await page.getByRole('button', { name: 'Load models' }).click();
  await expect(page.getByRole('status')).toHaveText('15 models available.');

  // the list opens on its own once models arrive …
  await expect(modelList).toBeVisible();
  await expect(modelList.getByRole('option')).toHaveCount(15);
  await expect(modelList.getByRole('option').first()).toHaveText('mock-model-1');

  // … and the arrow toggles it, since a user should be able to reopen it later
  await page.getByRole('button', { name: 'Hide fetched models' }).click();
  await expect(modelList).toBeHidden();
  await page.getByRole('button', { name: 'Show fetched models' }).click();
  await expect(modelList).toBeVisible();

  // picking one fills the field and closes the list
  await modelList.getByRole('option', { name: 'mock-model-7' }).click();
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('mock-model-7');
  await expect(modelList).toBeHidden();
});
