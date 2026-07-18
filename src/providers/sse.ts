/**
 * Minimal Server-Sent-Events parser shared by all streaming adapters.
 *
 * Yields the `data:` payload of each event as a string. Handles multi-line
 * data fields, CRLF, and events split across network chunks. Comment lines
 * and other fields (`event:`, `id:`) are ignored — every vendor we target
 * carries its JSON in `data:`.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  function* flushEvent(): Generator<string> {
    if (dataLines.length > 0) {
      yield dataLines.join('\n');
      dataLines = [];
    }
  }

  try {
    for (;;) {
      if (signal?.aborted) {
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        if (line === '') {
          yield* flushEvent();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }
    // stream ended without trailing newline(s): parse the leftover line, then flush
    const tail = buffer.replace(/\r$/, '');
    if (tail.startsWith('data:')) {
      dataLines.push(tail.slice(5).replace(/^ /, ''));
    }
    yield* flushEvent();
  } finally {
    reader.releaseLock();
  }
}
