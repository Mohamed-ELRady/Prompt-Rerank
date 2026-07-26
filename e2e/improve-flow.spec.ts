import { type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

const MOCK_IMPROVED = 'This is the improved prompt.';

/** boundingBox() is nullable; fail with a clear message instead of asserting. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('expected the element to be laid out and have a bounding box');
  }
  return box;
}

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
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();

  await toolbar.getByRole('button', { name: 'Improve' }).click();
  const panel = page.getByRole('region', { name: 'Prompt Rerank result' });
  await expect(panel).toContainText(MOCK_IMPROVED);

  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#ta')).toHaveValue(MOCK_IMPROVED);
  await expect(panel).toBeHidden();
});

test('apply replaces the WHOLE field even when only a fragment was selected', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  // select only the first few words, not the entire prompt
  await page.click('#ta');
  await page.evaluate(() => {
    const el = document.querySelector('#ta') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(0, 5);
  });

  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Improve' }).click();
  const panel = page.getByRole('region', { name: 'Prompt Rerank result' });
  await expect(panel).toContainText(MOCK_IMPROVED);

  await panel.getByRole('button', { name: 'Apply' }).click();
  // old text is gone entirely — the field holds only the rewritten prompt
  await expect(page.locator('#ta')).toHaveValue(MOCK_IMPROVED);
});

test('improve → apply works in contenteditable', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  await selectAllIn(page, '#ce');
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();

  await toolbar.getByRole('button', { name: 'Improve' }).click();
  const panel = page.getByRole('region', { name: 'Prompt Rerank result' });
  await expect(panel).toContainText(MOCK_IMPROVED);

  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#ce')).toContainText(MOCK_IMPROVED);
});

test('insertion sticks in a framework-controlled field', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/controlled.html');

  await selectAllIn(page, '#controlled');
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Improve' }).click();

  const panel = page.getByRole('region', { name: 'Prompt Rerank result' });
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
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Improve' }).click();

  const panel = page.getByRole('region', { name: 'Prompt Rerank result' });
  await expect(panel).toContainText(MOCK_IMPROVED);
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#editor')).toContainText(MOCK_IMPROVED);
  // outlive two "render" ticks — a naive DOM write would be reverted
  await page.waitForTimeout(150);
  await expect(page.locator('#editor')).toContainText(MOCK_IMPROVED);
});

test('the More menu stays inside the viewport when the field is near the bottom', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/bottom.html');

  await selectAllIn(page, '#ta');
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'More ▾' }).click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const box = await boxOf(menu);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  // fully on screen — it used to drop below the fold and be unreachable
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);
  // and its items are actually clickable
  await expect(menu.getByRole('menuitem', { name: 'Shorten' })).toBeVisible();
});

test('the toolbar itself stays inside the viewport when the field is near the right edge', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/right-edge.html');

  await selectAllIn(page, '#ta');
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();

  const box = await boxOf(toolbar);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  // fully on screen — it used to overflow the right edge because its
  // position was clamped against a hardcoded width guess far smaller than
  // its real content width
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  // and stayed a single line — a fixed-position element with no explicit
  // width lets the browser's shrink-to-fit sizing wrap every button label
  // onto several lines once the available space runs out
  expect(box.height).toBeLessThan(40);

  // "More" is the rightmost item, so it's the first to go off-screen —
  // confirm it's still reachable
  await toolbar.getByRole('button', { name: 'More ▾' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
});

test('the toolbar can be dragged out of the way', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:8787/plain.html');

  await selectAllIn(page, '#ta');
  const toolbar = page.getByRole('toolbar', { name: 'Prompt Rerank actions' });
  await expect(toolbar).toBeVisible();
  const before = await boxOf(toolbar);

  // drag by the grip label (never a button, so the drag isn't swallowed)
  const gripBox = await boxOf(toolbar.getByTitle('Drag to move'));
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2 + 120, gripBox.y + gripBox.height / 2 + 90, {
    steps: 8,
  });
  await page.mouse.up();

  const after = await boxOf(toolbar);
  expect(after.x - before.x).toBeGreaterThan(80);
  expect(after.y - before.y).toBeGreaterThan(60);
  // the actions still work after moving it
  await toolbar.getByRole('button', { name: 'Improve' }).click();
  await expect(page.getByRole('region', { name: 'Prompt Rerank result' })).toContainText(
    MOCK_IMPROVED,
  );
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
  await expect(page.getByRole('toolbar', { name: 'Prompt Rerank actions' })).toHaveCount(0);
});
