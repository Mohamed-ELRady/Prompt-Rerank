import { z } from 'zod';
import { defineRepository } from './repository';

export const themeSchema = z.enum(['system', 'light', 'dark']);

export const providerSettingsSchema = z.object({
  /** provider id from the registry, e.g. "openai", "ollama" */
  activeId: z.string(),
  /** per-provider overrides; empty object means adapter defaults */
  configs: z.record(
    z.string(),
    z.object({
      baseUrl: z.string().optional(),
      model: z.string().optional(),
    }),
  ),
});

export const settingsSchema = z.object({
  theme: themeSchema,
  /** ActionDefinition id (core/actions, M4); free-form string until then. */
  defaultActionId: z.string(),
  /** Origins where the content script stays inert, e.g. "https://bank.com" */
  disabledOrigins: z.array(z.string()),
  /** Origins whose prompts are never written to history. */
  historyExcludedOrigins: z.array(z.string()),
  provider: providerSettingsSchema,
});

export type Settings = z.output<typeof settingsSchema>;
export type ProviderSettings = z.output<typeof providerSettingsSchema>;

export const defaultSettings: Settings = {
  theme: 'system',
  defaultActionId: 'improve',
  disabledOrigins: [],
  historyExcludedOrigins: [],
  provider: {
    activeId: 'openai',
    configs: {},
  },
};

export const settingsRepo = defineRepository({
  key: 'settings',
  version: 2,
  schema: settingsSchema,
  defaults: defaultSettings,
  migrations: {
    // v1 predates the provider layer.
    1: (old) => ({ ...(old as object), provider: defaultSettings.provider }),
  },
});
