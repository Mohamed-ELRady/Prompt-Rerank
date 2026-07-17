import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_CAP, addHistoryEntry, historyRepo, type HistoryEntry } from './history';

function entry(id: number, favorite = false): HistoryEntry {
  return {
    id: String(id),
    createdAt: id,
    origin: 'https://example.com',
    actionId: 'improve',
    original: 'o',
    improved: 'i',
    favorite,
  };
}

describe('history', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('prepends newest entries', async () => {
    await addHistoryEntry(entry(1));
    await addHistoryEntry(entry(2));
    const { entries } = await historyRepo.get();
    expect(entries.map((e) => e.id)).toEqual(['2', '1']);
  });

  it('evicts oldest non-favorites past the cap, keeping favorites', async () => {
    const favorite = entry(0, true);
    await historyRepo.set({
      entries: [...Array.from({ length: HISTORY_CAP - 1 }, (_, i) => entry(i + 1)), favorite],
    });
    await addHistoryEntry(entry(HISTORY_CAP + 1));
    const { entries } = await historyRepo.get();
    expect(entries).toHaveLength(HISTORY_CAP);
    expect(entries.some((e) => e.id === favorite.id)).toBe(true);
    // the oldest non-favorite fell off instead
    expect(entries.some((e) => e.id === String(HISTORY_CAP - 1))).toBe(false);
  });
});
