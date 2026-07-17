import { z } from 'zod';
import { settingsSchema } from '../storage/settings';

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
  'settings.get': {
    input: z.object({}),
    output: settingsSchema,
  },
  'settings.update': {
    input: z.object({ patch: settingsSchema.partial() }),
    output: settingsSchema,
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
