import { z } from 'zod';
import { promptAnalysisSchema } from '@/core/types';
import { historyEntrySchema } from '../storage/history';
import { settingsSchema } from '../storage/settings';
import { templateSchema } from '../storage/templates';

/**
 * Single source of truth for request/response messages (SDD §5.4).
 *
 * Every message crossing a context boundary is validated with zod on receipt;
 * content scripts run inside hostile pages, so nothing is trusted on shape
 * alone. Streaming flows use ports (see port.ts), not this request/response
 * map.
 */

export const MESSAGE_KIND = 'promptpolish' as const;

export const messageDefinitions = {
  ping: {
    input: z.object({}),
    output: z.object({ ok: z.literal(true), version: z.string() }),
  },
  /** Local deterministic analysis (FR-C1) — instant, no provider involved. */
  analyze: {
    input: z.object({ text: z.string().min(1).max(50_000) }),
    output: promptAnalysisSchema,
  },
  'settings.get': {
    input: z.object({}),
    output: settingsSchema,
  },
  'settings.update': {
    input: z.object({ patch: settingsSchema.partial() }),
    output: settingsSchema,
  },
  // Provider metadata + per-provider state for the settings UI. Shapes are
  // declared here (data only); the background fills them from the registry.
  'providers.list': {
    input: z.object({}),
    output: z.object({
      providers: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          requiresKey: z.boolean(),
          defaultBaseUrl: z.string(),
          defaultModel: z.string(),
          keyHint: z.string().optional(),
          /** masked preview like "sk-…4f2a"; undefined = no key stored */
          keyPreview: z.string().optional(),
        }),
      ),
    }),
  },
  'providers.models': {
    input: z.object({ providerId: z.string() }),
    output: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true), models: z.array(z.string()) }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() }),
    ]),
  },
  'providers.validate': {
    input: z.object({ providerId: z.string() }),
    output: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() }),
    ]),
  },
  'vault.set': {
    input: z.object({ providerId: z.string(), key: z.string().min(1) }),
    output: z.object({ keyPreview: z.string() }),
  },
  'vault.delete': {
    input: z.object({ providerId: z.string() }),
    output: z.object({}),
  },
  'history.list': {
    input: z.object({}),
    output: z.object({ entries: z.array(historyEntrySchema) }),
  },
  'history.toggleFavorite': {
    input: z.object({ id: z.string() }),
    output: z.object({}),
  },
  'history.delete': {
    input: z.object({ id: z.string() }),
    output: z.object({}),
  },
  'history.clear': {
    input: z.object({}),
    output: z.object({}),
  },
  'templates.list': {
    input: z.object({}),
    output: z.object({ templates: z.array(templateSchema) }),
  },
  'templates.save': {
    input: z.object({ template: templateSchema }),
    output: z.object({ templates: z.array(templateSchema) }),
  },
  'templates.delete': {
    input: z.object({ id: z.string() }),
    output: z.object({ templates: z.array(templateSchema) }),
  },
  'data.export': {
    input: z.object({}),
    output: z.object({ json: z.string() }),
  },
  'data.import': {
    input: z.object({ json: z.string() }),
    output: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), message: z.string() }),
    ]),
  },
} as const;

export type MessageType = keyof typeof messageDefinitions;

export type MessageInput<T extends MessageType> = z.output<(typeof messageDefinitions)[T]['input']>;
export type MessageOutput<T extends MessageType> = z.output<
  (typeof messageDefinitions)[T]['output']
>;

export const envelopeSchema = z.object({
  kind: z.literal(MESSAGE_KIND),
  type: z.string(),
  payload: z.unknown(),
});

export type Envelope = z.output<typeof envelopeSchema>;
