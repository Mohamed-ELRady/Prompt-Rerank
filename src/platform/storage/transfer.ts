import { z } from 'zod';
import { settingsRepo, settingsSchema } from './settings';
import { templateSchema, templatesRepo } from './templates';

/**
 * Settings/templates import & export (FR-F3). API keys are deliberately not
 * part of the format: the vault is never serialized out of storage (SDD §7).
 */

export const exportFileSchema = z.object({
  kind: z.literal('promptpolish-export'),
  version: z.literal(1),
  settings: settingsSchema,
  templates: z.array(templateSchema),
});

export type ExportFile = z.output<typeof exportFileSchema>;

export async function exportData(): Promise<string> {
  const [settings, { templates }] = await Promise.all([settingsRepo.get(), templatesRepo.get()]);
  const file: ExportFile = {
    kind: 'promptpolish-export',
    version: 1,
    settings,
    templates: templates.filter((t) => t.userOwned),
  };
  return JSON.stringify(file, null, 2);
}

export async function importData(
  json: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Not valid JSON.' };
  }
  const file = exportFileSchema.safeParse(parsed);
  if (!file.success) {
    return { ok: false, message: 'Not a valid PromptPolish export file.' };
  }
  await settingsRepo.set(file.data.settings);
  await templatesRepo.update(({ templates }) => {
    const imported = file.data.templates.map((t) => ({ ...t, userOwned: true }));
    const importedIds = new Set(imported.map((t) => t.id));
    return { templates: [...templates.filter((t) => !importedIds.has(t.id)), ...imported] };
  });
  return { ok: true };
}
