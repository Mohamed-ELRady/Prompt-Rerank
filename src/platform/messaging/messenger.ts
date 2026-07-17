import { browser } from 'wxt/browser';
import { createLogger } from '../logging';
import {
  MESSAGE_KIND,
  envelopeSchema,
  messageDefinitions,
  type MessageInput,
  type MessageOutput,
  type MessageType,
} from './protocol';

const log = createLogger('messaging');

/** Sends a typed request to the background and validates the response. */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageInput<T>,
): Promise<MessageOutput<T>> {
  const raw: unknown = await browser.runtime.sendMessage({
    kind: MESSAGE_KIND,
    type,
    payload,
  });
  return messageDefinitions[type].output.parse(raw) as MessageOutput<T>;
}

export type MessageHandlers = {
  [T in MessageType]: (payload: MessageInput<T>) => Promise<MessageOutput<T>>;
};

/**
 * Registers the background's handler map. Messages that are not ours, or that
 * fail validation, are logged and ignored — never crashed on.
 */
export function registerMessageHandlers(handlers: MessageHandlers): void {
  // The polyfill contract (and fake-browser) awaits a promise returned from
  // the listener; Chrome ignores it in favor of sendResponse. Both handled.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
    const envelope = envelopeSchema.safeParse(raw);
    if (!envelope.success) {
      return; // not a promptpolish message
    }
    const type = envelope.data.type;
    if (!(type in messageDefinitions)) {
      log.warn(`dropping message with unknown type "${type}"`);
      return;
    }
    const definition = messageDefinitions[type as MessageType];
    const payload = definition.input.safeParse(envelope.data.payload);
    if (!payload.success) {
      log.warn(`dropping malformed "${type}" message`, payload.error.issues);
      return;
    }
    const handler = handlers[type as MessageType] as (input: unknown) => Promise<unknown>;
    const result = handler(payload.data).catch((error: unknown) => {
      log.error(`handler for "${type}" failed`, error);
      return undefined;
    });
    // Chrome passes a sendResponse callback and expects `return true` to keep
    // the channel open; the webextension-polyfill (and fake-browser in tests)
    // instead awaits a returned promise. Support both.
    if (typeof sendResponse === 'function') {
      result.then(sendResponse, sendResponse);
      return true;
    }
    return result;
  });
}
