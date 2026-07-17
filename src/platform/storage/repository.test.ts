import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineRepository } from './repository';

const schemaV2 = z.object({ name: z.string(), tags: z.array(z.string()) });

function makeRepo() {
  return defineRepository({
    key: 'test-doc',
    version: 2,
    schema: schemaV2,
    defaults: { name: 'default', tags: [] },
    migrations: {
      // v1 stored a single `tag: string`
      1: (old) => {
        const v1 = z.object({ name: z.string(), tag: z.string() }).parse(old);
        return { name: v1.name, tags: [v1.tag] };
      },
    },
  });
}

describe('defineRepository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when nothing is stored', async () => {
    await expect(makeRepo().get()).resolves.toEqual({ name: 'default', tags: [] });
  });

  it('round-trips set/get', async () => {
    const repo = makeRepo();
    await repo.set({ name: 'a', tags: ['x'] });
    await expect(repo.get()).resolves.toEqual({ name: 'a', tags: ['x'] });
  });

  it('applies update atomically against current state', async () => {
    const repo = makeRepo();
    await repo.set({ name: 'a', tags: [] });
    await repo.update((s) => ({ ...s, tags: [...s.tags, 'new'] }));
    await expect(repo.get()).resolves.toEqual({ name: 'a', tags: ['new'] });
  });

  it('migrates old versions forward on read', async () => {
    await fakeBrowser.storage.local.set({
      'test-doc': { version: 1, data: { name: 'legacy', tag: 'only' } },
    });
    await expect(makeRepo().get()).resolves.toEqual({ name: 'legacy', tags: ['only'] });
  });

  it('falls back to defaults on corrupt data instead of throwing', async () => {
    await fakeBrowser.storage.local.set({
      'test-doc': { version: 2, data: { name: 42 } },
    });
    await expect(makeRepo().get()).resolves.toEqual({ name: 'default', tags: [] });
  });

  it('falls back to defaults when stored version is newer than the code', async () => {
    await fakeBrowser.storage.local.set({
      'test-doc': { version: 99, data: { name: 'future', tags: [] } },
    });
    await expect(makeRepo().get()).resolves.toEqual({ name: 'default', tags: [] });
  });
});
