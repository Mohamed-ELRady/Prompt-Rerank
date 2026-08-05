/**
 * E2E support server: serves the fixture pages and mocks an
 * OpenAI-compatible streaming provider so tests never touch live APIs.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = 8787;
export const MOCK_IMPROVED = 'This is the improved prompt.';

const fixturesRoot = new URL('./fixtures/', import.meta.url);

const server = http.createServer((req, res) => {
  void handle(req, res);
});

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname === '/v1/models') {
    res.setHeader('Content-Type', 'application/json');
    // A double-digit count mirrors real providers (Ollama/Groq routinely
    // list a dozen-plus models) and is what exposed the datalist regression.
    const mockModels = Array.from({ length: 15 }, (_, i) => ({
      id: `mock-model-${String(i + 1)}`,
    }));
    res.end(JSON.stringify({ data: mockModels }));
    return;
  }

  if (url.pathname === '/v1/chat/completions') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const content of ['This is ', 'the improved ', 'prompt.']) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  try {
    const pathname = url.pathname === '/' ? '/plain.html' : url.pathname;
    const file = await readFile(new URL(`.${pathname}`, fixturesRoot));
    res.setHeader('Content-Type', pathname.endsWith('.html') ? 'text/html' : 'text/plain');
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}

server.listen(PORT, () => {
  console.log(`e2e fixture server on http://localhost:${PORT}`);
});
