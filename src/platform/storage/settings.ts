import { z } from 'zod';
import { defineRepository } from './repository';

export const themeSchema = z.enum(['system', 'light', 'dark']);

export const settingsSchema = z.object({
  theme: themeSchema,
  /** ActionDefinition id (core/actions, M4); free-form string until then. */
  defaultActionId: z.string(),
  /** Origins where the content script stays inert, e.g. "https://bank.com" */
  disabledOrigins: z.array(z.string()),
  /** Origins whose prompts are never written to history. */
  historyExcludedOrigins: z.array(z.string()),
});

export type Settings = z.output<typeof settingsSchema>;

export const defaultSettings: Settings = {
  theme: 'system',
  defaultActionId: 'improve',
  disabledOrigins: [],
  historyExcludedOrigins: [],
};

export const settingsRepo = defineRepository({
  key: 'settings',
  version: 1,
  schema: settingsSchema,
  defaults: defaultSettings,
});
