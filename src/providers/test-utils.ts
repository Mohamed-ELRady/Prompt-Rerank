import { vi } from 'vitest';
import { type FetchLike } from './types';

/** Builds a Response streaming the given SSE lines. */
export function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(status: number, body = ''): Response {
  return new Response(body, { status });
}

/** vi.fn typed as fetch, so adapters can be constructed around it. */
export function mockFetch(...responses: Response[]): FetchLike & ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  return fn as FetchLike & ReturnType<typeof vi.fn>;
}
