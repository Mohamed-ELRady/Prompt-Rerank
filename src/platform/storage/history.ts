import { z } from 'zod';
import { defineRepository } from './repository';

export const historyEntrySchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  /** origin of the page the prompt was improved on */
  origin: z.string(),
  actionId: z.string(),
  original: z.string(),
  improved: z.string(),
  favorite: z.boolean(),
});

export type HistoryEntry = z.output<typeof historyEntrySchema>;

const historyStateSchema = z.object({
  entries: z.array(historyEntrySchema),
});

export const HISTORY_CAP = 200;

export const historyRepo = defineRepository({
  key: 'history',
  version: 1,
  schema: historyStateSchema,
  defaults: { entries: [] },
});

/** Prepends an entry, evicting the oldest non-favorite entries past the cap. */
export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  await historyRepo.update((state) => {
    const entries = [entry, ...state.entries];
    if (entries.length <= HISTORY_CAP) {
      return { entries };
    }
    const overflow = entries.length - HISTORY_CAP;
    const evictable = new Set(
      entries
        .filter((e) => !e.favorite)
        .slice(-overflow)
        .map((e) => e.id),
    );
    return { entries: entries.filter((e) => !evictable.has(e.id)) };
  });
}
