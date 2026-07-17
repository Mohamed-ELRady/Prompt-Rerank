/**
 * Structured, leveled logger (SDD §9).
 *
 * Events are mirrored into an in-memory ring buffer so the options page can
 * offer a "Diagnostics" dump without us ever shipping telemetry. Prompt
 * content must never be logged at info level or above — pass it only to
 * `debug`, which is compiled out of production builds.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  readonly at: number;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}

const RING_BUFFER_SIZE = 200;
const buffer: LogEvent[] = [];

function record(event: LogEvent): void {
  buffer.push(event);
  if (buffer.length > RING_BUFFER_SIZE) {
    buffer.splice(0, buffer.length - RING_BUFFER_SIZE);
  }
  const line = `[promptpolish:${event.scope}] ${event.message}`;

  const sink = event.level === 'debug' ? console.debug : console[event.level];
  if (event.data === undefined) {
    sink(line);
  } else {
    sink(line, event.data);
  }
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export function createLogger(scope: string): Logger {
  const log =
    (level: LogLevel) =>
    (message: string, data?: unknown): void => {
      if (level === 'debug' && !import.meta.env.DEV) {
        return;
      }
      record({ at: Date.now(), level, scope, message, data });
    };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}

/** Most recent events, oldest first. For the diagnostics view only. */
export function getRecentLogEvents(): readonly LogEvent[] {
  return [...buffer];
}

/** Test hook. */
export function clearLogEvents(): void {
  buffer.length = 0;
}
