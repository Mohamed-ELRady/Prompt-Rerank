import { z } from 'zod';
import { definePortProtocol } from './port';

/**
 * Streaming protocol for the improve pipeline (SDD §4). Data shapes only —
 * the background implements the server side, content UI / popup the client.
 */

export const providerErrorCodeSchema = z.enum([
  'invalid_key',
  'rate_limited',
  'quota_exceeded',
  'context_length',
  'model_not_found',
  'network',
  'unknown',
]);

export const improveClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    text: z.string().min(1).max(50_000),
    actionId: z.string(),
    /** page origin, for history attribution and per-site rules */
    origin: z.string().optional(),
  }),
]);

export const improveServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), delta: z.string() }),
  z.object({ type: z.literal('done'), improved: z.string() }),
  z.object({
    type: z.literal('error'),
    code: providerErrorCodeSchema,
    message: z.string(),
  }),
]);

export type ImproveClientMessage = z.output<typeof improveClientMessage>;
export type ImproveServerMessage = z.output<typeof improveServerMessage>;

export const improvePort = definePortProtocol({
  name: 'improve',
  clientMessage: improveClientMessage,
  serverMessage: improveServerMessage,
});
