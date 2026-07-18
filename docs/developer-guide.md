# Developer Guide

Read the [SDD](02-sdd.md) first — it explains the _why_; this page is the _how_.

## Daily commands

```bash
pnpm install         # + wxt prepare (generates .wxt/ types)
pnpm dev             # HMR dev build → load .output/chrome-mv3-dev
pnpm test            # Vitest unit/integration
pnpm e2e             # Playwright (needs: pnpm build && pnpm exec playwright install chromium)
pnpm lint && pnpm typecheck && pnpm format:check
pnpm build && pnpm budget   # production build + content-script size gate
```

## Map of the code

| Path                 | What lives there                                               | Rules                                                                 |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/core/`          | Analysis engine, scoring, actions, meta-prompts — pure TS      | imports nothing outside `core` (CI-enforced)                          |
| `src/providers/`     | `AIProvider` adapters + registry                               | may import `core`; injectable fetch, no chrome APIs                   |
| `src/platform/`      | storage repos, typed messaging, logging                        | may import `core`; the only place chrome storage/messaging is touched |
| `src/site-adapters/` | capture/insertion strategies + site profiles                   | keep the content-entry import graph tiny                              |
| `src/entrypoints/`   | background, content watcher, content-ui loader, popup, options | wiring only — logic belongs in the layers above                       |
| `src/content-ui/`    | the floating toolbar/panel (lazy chunk)                        |                                                                       |
| `src/ui/`            | shared React utilities (diff, theme)                           |                                                                       |

## Extension points (each is a data change or one new file)

- **Action**: add an `ActionDefinition` in `src/core/actions/index.ts`. Strategy text is composed into the meta-prompt; `producesRewrite: false` renders a report instead of Apply.
- **Provider**: OpenAI-compatible API → one preset entry in `src/providers/openai-compat/presets.ts`. Novel API → new adapter folder implementing `AIProvider` + one registry line; normalize every error to `ProviderError` and add mocked-fetch tests like `anthropic/adapter.test.ts`.
- **Site**: one profile entry — see [adding-a-site-adapter.md](adding-a-site-adapter.md).
- **Analyzer rule**: one rule object in `src/core/analysis/analyzers.ts` + fixture cases in `engine.test.ts`; recalibrate weights in `scoring.ts` (snapshot will flag drift).
- **Protocol message**: schema in `platform/messaging/protocol.ts`, handler in `entrypoints/background.ts`. Both sides validate with zod — never bypass `sendMessage`/ports.

## Sharp edges (learned the hard way)

1. **Never use `import { type X }` for cross-layer type imports** — under `verbatimModuleSyntax` it emits a side-effect import. `import type { X }` is fully erased. ESLint autofix is configured accordingly, and `pnpm budget` fails CI if the content entry bloats.
2. **MV3 content scripts can't code-split.** The floating UI ships as a web-accessible unlisted script (`content-ui.js`) imported via `browser.runtime.getURL`; its factory is handed over through an isolated-world global because IIFE wrappers swallow exports.
3. **The service worker dies at will.** No module-level state that matters; everything durable goes through the storage repos; streams live on ports (port traffic resets the idle timer) with `AbortController` wired to disconnect.
4. **Insertion must go through input events.** Native value setter + `input` for form fields, `execCommand('insertText')`/`beforeinput` for contenteditable. Direct DOM/value writes get reverted by framework-controlled editors — the fixtures in `e2e/fixtures/` simulate exactly that.
5. **`sendResponse` vs promise-return**: Chrome uses the callback + `return true`; the polyfill (and fake-browser in tests) awaits a returned promise. `registerMessageHandlers` supports both — don't "simplify" it.

## Testing conventions

- Pure logic: co-located `*.test.ts`, no mocks beyond `mockFetch`/fixtures.
- Chrome APIs: `fakeBrowser` from `wxt/testing`; call `fakeBrowser.reset()` in `beforeEach`.
- Anything touching page DOM/insertion: Playwright spec against a fixture page served by `e2e/server.mjs` (which also mocks an OpenAI-compatible SSE provider — tests must never hit live APIs).
- Accessibility: `vitest-axe` (`expect(await axe(container)).toHaveNoViolations()`).
