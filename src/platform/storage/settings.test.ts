import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, settingsRepo } from './settings';

describe('settings repository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('migrates v1 settings (pre-provider) to v2, preserving user choices', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        version: 1,
        data: {
          theme: 'dark',
          defaultActionId: 'improve',
          disabledOrigins: ['https://bank.example'],
          historyExcludedOrigins: [],
        },
      },
    });

    const settings = await settingsRepo.get();
    expect(settings.theme).toBe('dark');
    expect(settings.disabledOrigins).toEqual(['https://bank.example']);
    expect(settings.provider).toEqual(defaultSettings.provider);
  });
});
