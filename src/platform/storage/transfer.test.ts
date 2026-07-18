import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, settingsRepo } from './settings';
import { fillTemplate, templateVariables } from './starter-templates';
import { templatesRepo, type Template } from './templates';
import { exportData, importData } from './transfer';

const userTemplate: Template = {
  id: 't1',
  name: 'Mine',
  content: 'Do {{thing}}',
  favorite: true,
  createdAt: 1,
  userOwned: true,
};

const starter: Template = {
  id: 's1',
  name: 'Starter',
  content: 'x',
  favorite: false,
  createdAt: 0,
  userOwned: false,
};

describe('transfer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('round-trips settings and user templates, excluding starters', async () => {
    await settingsRepo.set({ ...defaultSettings, theme: 'dark' });
    await templatesRepo.set({ templates: [starter, userTemplate] });

    const json = await exportData();
    expect(json).not.toContain('"Starter"');
    expect(json).not.toContain('vault');

    fakeBrowser.reset();
    await expect(importData(json)).resolves.toEqual({ ok: true });
    const settings = await settingsRepo.get();
    expect(settings.theme).toBe('dark');
    const { templates } = await templatesRepo.get();
    expect(templates.map((t) => t.id)).toEqual(['t1']);
  });

  it('rejects invalid payloads without touching storage', async () => {
    await settingsRepo.set({ ...defaultSettings, theme: 'dark' });
    await expect(importData('{"kind":"other"}')).resolves.toMatchObject({ ok: false });
    await expect(importData('not json')).resolves.toMatchObject({ ok: false });
    expect((await settingsRepo.get()).theme).toBe('dark');
  });
});

describe('template variables', () => {
  it('extracts unique variables in order', () => {
    expect(templateVariables('a {{x}} b {{ y }} c {{x}}')).toEqual(['x', 'y']);
  });

  it('fills provided values and leaves unknowns intact', () => {
    expect(fillTemplate('{{a}} and {{b}}', { a: 'one' })).toBe('one and {{b}}');
  });
});
