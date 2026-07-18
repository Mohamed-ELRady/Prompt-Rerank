import { describe, expect, it } from 'vitest';
import { parseSseStream } from './sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const events: string[] = [];
  for await (const data of parseSseStream(stream)) {
    events.push(data);
  }
  return events;
}

describe('parseSseStream', () => {
  it('parses simple data events', async () => {
    await expect(collect(streamOf('data: one\n\ndata: two\n\n'))).resolves.toEqual(['one', 'two']);
  });

  it('handles events split across network chunks', async () => {
    await expect(collect(streamOf('data: hel', 'lo\n', '\ndata: world\n\n'))).resolves.toEqual([
      'hello',
      'world',
    ]);
  });

  it('joins multi-line data fields', async () => {
    await expect(collect(streamOf('data: line1\ndata: line2\n\n'))).resolves.toEqual([
      'line1\nline2',
    ]);
  });

  it('handles CRLF line endings', async () => {
    await expect(collect(streamOf('data: a\r\n\r\ndata: b\r\n\r\n'))).resolves.toEqual(['a', 'b']);
  });

  it('ignores comments and non-data fields', async () => {
    await expect(
      collect(streamOf(': keepalive\nevent: message\nid: 3\ndata: payload\n\n')),
    ).resolves.toEqual(['payload']);
  });

  it('flushes a final event with no trailing blank line', async () => {
    await expect(collect(streamOf('data: tail'))).resolves.toEqual(['tail']);
  });
});
