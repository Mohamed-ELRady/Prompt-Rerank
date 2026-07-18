import { type BrowserContext, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

const MOCK_IMPROVED = 'This is the improved prompt.';

// Available inside page.evaluate on extension pages.
declare const chrome: {
  storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
};

/** Points the extension at the mock provider (ollama preset = no key needed). */
async function seedMockProvider(context: BrowserContext, extensionId: string): Promise<void> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
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
            configs: {
              ollama: { baseUrl: 'http://localhost:8787/v1', model: 'mock-model' },
            },
          },
        },
      },
    });
  });
  await page.close();
}

async function selectAllIn(page: Page, selector: string): Promise<void> {
  // click first so focus + selectionchange behave like a real user
  await page.click(selector);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.focus();
      el.setSelectionRange(0, el.value.length);
    } else if (el instanceof HTMLElement) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, selector);
}

test.beforeEach(async ({ context, extensionId }) => {
  await seedMockProvider(context, extensionId);
});

test('improve → apply replaces selection in a plain textarea', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  await selectAllIn(page, '#ta');
  const toolbar = page.getByRole('toolbar', { name: 'PromptPolish actions' });
  await expect(toolbar).toBeVisible();

  await toolbar.getByRole('button', { name: 'Improve' }).click();
  const panel = page.getByRole('region', { name: 'PromptPolish result' });
  await expect(panel).toContainText(MOCK_IMPROVED);

  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#ta')).toHaveValue(MOCK_IMPROVED);
  await expect(panel).toBeHidden();
});

test('improve → apply works in contenteditable', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  await selectAllIn(page, '#ce');
  const toolbar = page.getByRole('toolbar', { name: 'PromptPolish actions' });
  await expect(toolbar).toBeVisible();

  await toolbar.getByRole('button', { name: 'Improve' }).click();
  const panel = page.getByRole('region', { name: 'PromptPolish result' });
  await expect(panel).toContainText(MOCK_IMPROVED);

  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#ce')).toContainText(MOCK_IMPROVED);
});

test('insertion sticks in a framework-controlled field', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/controlled.html');

  await selectAllIn(page, '#controlled');
  const toolbar = page.getByRole('toolbar', { name: 'PromptPolish actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Improve' }).click();

  const panel = page.getByRole('region', { name: 'PromptPolish result' });
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#controlled')).toHaveValue(MOCK_IMPROVED);
  // outlive two "render" ticks of the fake framework — a naive write reverts
  await page.waitForTimeout(150);
  await expect(page.locator('#controlled')).toHaveValue(MOCK_IMPROVED);
});

test('insertion sticks in a framework-controlled contenteditable editor', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/editor-ce.html');

  await selectAllIn(page, '#editor');
  const toolbar = page.getByRole('toolbar', { name: 'PromptPolish actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Improve' }).click();

  const panel = page.getByRole('region', { name: 'PromptPolish result' });
  await expect(panel).toContainText(MOCK_IMPROVED);
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#editor')).toContainText(MOCK_IMPROVED);
  // outlive two "render" ticks — a naive DOM write would be reverted
  await page.waitForTimeout(150);
  await expect(page.locator('#editor')).toContainText(MOCK_IMPROVED);
});

test('toolbar does not appear for non-editable selections', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  await page.evaluate(() => {
    const heading = document.querySelector('h1');
    if (heading) {
      const range = document.createRange();
      range.selectNodeContents(heading);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });
  await page.waitForTimeout(400); // longer than the watcher debounce
  await expect(page.getByRole('toolbar', { name: 'PromptPolish actions' })).toHaveCount(0);
});
