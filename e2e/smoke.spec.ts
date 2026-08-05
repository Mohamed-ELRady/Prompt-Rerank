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

test('loading models remounts the model field so Chrome refreshes its datalist popup', async ({
  context,
  extensionId,
}) => {
  // Regression: Chrome caches an <input list> as "no suggestions" once it's
  // been focused while the associated <datalist> was empty, and never
  // re-checks after the datalist is mutated in place — clicking the dropdown
  // arrow then does nothing even though the fetched models are in the DOM.
  // The fix keys the input/datalist on the loaded models so a fresh node
  // exists once they arrive; a stale-node reuse regression shows up here as
  // the marker below surviving the "Load models" click.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByLabel('Provider', { exact: true }).selectOption('ollama');
  await page.getByLabel('Base URL').fill('http://localhost:8787/v1');

  // Not `exact: true`: the <label> wraps the input, datalist, and the
  // "Load models" button together, so the computed accessible name is
  // "Model Load models" — a real pre-existing a11y quirk, not something this
  // test should paper over by scoping more narrowly than a real user could.
  const modelInput = page.getByLabel('Model');
  await modelInput.evaluate((el) => {
    el.dataset.preLoadMarker = 'stale-node';
  });

  await page.getByRole('button', { name: 'Load models' }).click();
  await expect(page.getByRole('status')).toHaveText('15 models available.');

  await expect(modelInput).toHaveJSProperty('dataset.preLoadMarker', undefined);
  await expect(page.locator('datalist option')).toHaveCount(15);
});
