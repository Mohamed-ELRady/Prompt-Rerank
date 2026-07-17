import { browser, type Browser } from 'wxt/browser';
import { type z } from 'zod';
import { createLogger } from '../logging';

/**
 * Typed long-lived port helpers for streaming flows (SDD §5.4, §6).
 *
 * Ports rather than one-shot messages because (a) chunked results need a
 * channel, and (b) port traffic resets the MV3 service-worker idle timer, so
 * a stream cannot be killed mid-flight by worker teardown. Client disconnect
 * must abort server-side work — handlers receive an AbortSignal wired to it.
 */

const log = createLogger('port');

export interface PortProtocol<ClientMsg extends z.ZodType, ServerMsg extends z.ZodType> {
  name: string;
  clientMessage: ClientMsg;
  serverMessage: ServerMsg;
}

export function definePortProtocol<C extends z.ZodType, S extends z.ZodType>(
  protocol: PortProtocol<C, S>,
): PortProtocol<C, S> {
  return protocol;
}

export interface PortClient<C extends z.ZodType, S extends z.ZodType> {
  post(message: z.input<C>): void;
  onMessage(listener: (message: z.output<S>) => void): void;
  onDisconnect(listener: () => void): void;
  disconnect(): void;
}

/** Opens a validated port from any surface to the background. */
export function connectPort<C extends z.ZodType, S extends z.ZodType>(
  protocol: PortProtocol<C, S>,
): PortClient<C, S> {
  const port = browser.runtime.connect({ name: protocol.name });
  return {
    post(message) {
      port.postMessage(protocol.clientMessage.parse(message));
    },
    onMessage(listener) {
      port.onMessage.addListener((raw: unknown) => {
        const parsed = protocol.serverMessage.safeParse(raw);
        if (!parsed.success) {
          log.warn(`${protocol.name}: dropping malformed server message`, parsed.error.issues);
          return;
        }
        listener(parsed.data);
      });
    },
    onDisconnect(listener) {
      port.onDisconnect.addListener(listener);
    },
    disconnect() {
      port.disconnect();
    },
  };
}

export interface PortSession<C extends z.ZodType, S extends z.ZodType> {
  post(message: z.input<S>): void;
  onMessage(listener: (message: z.output<C>) => void): void;
  /** Aborted when the client disconnects (tab closed, panel dismissed). */
  signal: AbortSignal;
}

/** Background-side accept loop for a port protocol. */
export function onPortConnect<C extends z.ZodType, S extends z.ZodType>(
  protocol: PortProtocol<C, S>,
  onSession: (session: PortSession<C, S>) => void,
): void {
  browser.runtime.onConnect.addListener((port: Browser.runtime.Port) => {
    if (port.name !== protocol.name) {
      return;
    }
    const abort = new AbortController();
    port.onDisconnect.addListener(() => {
      abort.abort();
    });
    onSession({
      post(message) {
        if (!abort.signal.aborted) {
          port.postMessage(protocol.serverMessage.parse(message));
        }
      },
      onMessage(listener) {
        port.onMessage.addListener((raw: unknown) => {
          const parsed = protocol.clientMessage.safeParse(raw);
          if (!parsed.success) {
            log.warn(`${protocol.name}: dropping malformed client message`, parsed.error.issues);
            return;
          }
          listener(parsed.data);
        });
      },
      signal: abort.signal,
    });
  });
}
