import { z } from 'zod';
import { defineRepository } from './repository';

/**
 * API-key custody (SDD §7).
 *
 * Keys live only in `storage.local` (never `sync` — sync replicates to every
 * signed-in device) and this module must only ever be imported by background
 * code. Content scripts and page UIs talk to keys exclusively through
 * background messages that return masked previews.
 */

const vaultSchema = z.object({
  /** providerId → API key */
  keys: z.record(z.string(), z.string()),
});

const vaultRepo = defineRepository({
  key: 'vault',
  version: 1,
  schema: vaultSchema,
  defaults: { keys: {} },
});

export async function getApiKey(providerId: string): Promise<string | undefined> {
  return (await vaultRepo.get()).keys[providerId];
}

export async function setApiKey(providerId: string, key: string): Promise<void> {
  await vaultRepo.update((state) => ({ keys: { ...state.keys, [providerId]: key } }));
}

export async function deleteApiKey(providerId: string): Promise<void> {
  await vaultRepo.update((state) => {
    const { [providerId]: _removed, ...rest } = state.keys;
    return { keys: rest };
  });
}

/** "sk-…4f2a" style preview that is safe to show in the options UI. */
export async function getMaskedKeyPreview(providerId: string): Promise<string | undefined> {
  const key = await getApiKey(providerId);
  if (key === undefined) {
    return undefined;
  }
  if (key.length <= 8) {
    return '••••';
  }
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}
