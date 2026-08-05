import { z } from 'zod';
import { providerErrorCodeSchema } from './improve-port';
import { definePortProtocol } from './port';

/**
 * Streaming protocol for "Send test message" in settings. A one-shot
 * request/response message was tried first, but a real chat completion can
 * run long enough that the MV3 service worker gets torn down mid-request —
 * exactly what ports exist to prevent (see port.ts) and exactly why the
 * improve pipeline already uses one instead of a plain message.
 */

export const providerTestClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), providerId: z.string() }),
]);

export const providerTestServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('done'), reply: z.string() }),
  z.object({
    type: z.literal('error'),
    code: providerErrorCodeSchema,
    message: z.string(),
  }),
]);

export type ProviderTestClientMessage = z.output<typeof providerTestClientMessage>;
export type ProviderTestServerMessage = z.output<typeof providerTestServerMessage>;

export const providerTestPort = definePortProtocol({
  name: 'provider-test',
  clientMessage: providerTestClientMessage,
  serverMessage: providerTestServerMessage,
});
