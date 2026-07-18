import { expect, test } from './fixtures';

declare const chrome: {
  storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
};

test('popup quick improve streams a result and records history', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      settings: {
        version: 2,
        data: {
          theme: 'system',
          defaultActionId: 'improve',
          disabledOrigins: [],
          historyExcludedOrigins: [],
          provider: {
            activeId: 'ollama',
            configs: { ollama: { baseUrl: 'http://localhost:8787/v1', model: 'mock-model' } },
          },
        },
      },
    });
  });

  await page.getByPlaceholder('Paste a prompt to improve…').fill('write a poem');
  await page.getByRole('button', { name: 'Improve' }).click();
  await expect(page.locator('output')).toContainText('This is the improved prompt.');
  await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible();

  // reopening shows the run under Recent (history capture through the port)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible();
  await expect(page.getByText('This is the improved prompt.').first()).toBeVisible();
});
