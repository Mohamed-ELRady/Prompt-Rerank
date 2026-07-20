# Phase 2 — Software Design Document (SDD)

**Project:** Prompt Rerank _(working title)_
**Document status:** Draft for approval
**Date:** 2026-07-17

---

## 1. System overview

Prompt Rerank is a Manifest V3 browser extension with four runtime surfaces sharing one domain core:

```
┌─────────────────────────── Host web page ────────────────────────────┐
│  ┌────────────────────┐         ┌──────────────────────────────┐     │
│  │ User's text field  │◄───────►│ Content script                │     │
│  │ (textarea / CE /   │ insert  │  • selection detection        │     │
│  │  ProseMirror / …)  │         │  • site adapters              │     │
│  └────────────────────┘         │  • Shadow-DOM floating UI     │     │
│                                 └──────────────┬───────────────┘     │
└────────────────────────────────────────────────┼─────────────────────┘
                                     typed messages / streaming port
                                                 │
                       ┌─────────────────────────▼─────────────────────┐
                       │ Background service worker (MV3)               │
                       │  • request orchestration  • provider registry │
                       │  • settings/secret access • cache, retry      │
                       └──────┬──────────────────────────────┬─────────┘
                              │ fetch (streaming SSE)        │ chrome.storage
                    ┌─────────▼─────────┐          ┌─────────▼─────────┐
                    │ AI providers      │          │ Local storage      │
                    │ OpenAI/Anthropic/ │          │ settings · history │
                    │ Gemini/OpenAI-    │          │ templates · cache  │
                    │ compatible (Ollama│          └───────────────────┘
                    │ OpenRouter, …)    │
                    └───────────────────┘

  + Toolbar popup (React)   + Options page (React)   — talk to the same
    background worker over the same typed message protocol.
```

**Core principle:** `packages-style layering inside one app` — the domain core (analysis engine, action definitions, meta-prompt builder) is pure TypeScript with **zero** imports of Chrome APIs, DOM, or React. Everything platform-specific is an adapter around it.

## 2. Technology decisions

| Choice               | Decision                                                                                                          | Justification / alternatives considered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension framework  | **WXT** (wxt.dev)                                                                                                 | The de-facto modern standard for MV3 development: file-based entrypoints, auto-generated manifest, HMR for extension pages _and_ content scripts, first-class Shadow-DOM UI helper (`createShadowRootUi`), cross-browser output (`-b firefox`), built on Vite. Alternatives: raw Vite + `@crxjs/vite-plugin` (crxjs has had maintainer-continuity problems and weaker content-script DX); Plasmo (heavier abstraction, more lock-in, slower releases). WXT keeps us closest to the platform while removing MV3 boilerplate pain. |
| Language             | **TypeScript, `strict`**                                                                                          | Non-negotiable for a multi-surface codebase; message protocol and provider layer depend on discriminated unions.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UI                   | **React 18**                                                                                                      | Team-familiar, huge ecosystem, fine at this scale. Considered Svelte/Solid (smaller bundles) — real win is small because the content-script _core_ ships no framework at all; React loads only in lazy UI chunks and extension pages. Consistency across surfaces beats ~20 KB.                                                                                                                                                                                                                                                  |
| Styling              | **Tailwind CSS v4**                                                                                               | Fast iteration, tiny purged output, trivially themeable via CSS variables (dark mode), and compiles to a single stylesheet we inject into the Shadow DOM (no global leakage by construction).                                                                                                                                                                                                                                                                                                                                    |
| State                | **Zustand** (UI state) + **custom typed storage layer** (persistent state)                                        | Zustand is tiny and works in content-script contexts. Persistent truth lives in `chrome.storage` behind a versioned, zod-validated repository — _not_ in a JS store — because the MV3 worker is ephemeral.                                                                                                                                                                                                                                                                                                                       |
| Server-state lib     | **None (dropped TanStack Query)**                                                                                 | Our "server" is the background worker over a message port; requests are single-flight streams, not cacheable queries. TanStack Query would model this badly and add 12 KB. A small `useStreamingRequest` hook covers it.                                                                                                                                                                                                                                                                                                         |
| Validation           | **zod**                                                                                                           | Runtime validation at every trust boundary: messages, storage reads (migration), provider responses, imported JSON.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Testing              | **Vitest** (unit/integration, happy-dom) + **Playwright** (E2E with real extension loaded via persistent context) | Standard, fast, both first-class with Vite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Lint/format          | **ESLint (flat config, typescript-eslint) + Prettier**                                                            | Plus `eslint-plugin-boundaries` to _enforce_ the layering rules in CI (core cannot import chrome/react/dom).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Package manager      | **pnpm**                                                                                                          | Fast, strict node_modules prevents phantom deps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CI                   | **GitHub Actions**                                                                                                | Lint → typecheck → unit → build → E2E; release workflow builds, zips, tags, drafts release notes via changesets.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Versioning/changelog | **Changesets**                                                                                                    | PR-driven semver + CHANGELOG generation; better mono-flow fit than semantic-release for a reviewed OSS repo.                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 3. Folder structure

```
.
├── docs/                      # This SDD, roadmap, ADRs, guides
│   └── adr/                   # Architecture Decision Records
├── public/                    # Static assets, _locales/
├── src/
│   ├── core/                  # ★ PURE domain logic — no chrome/dom/react imports
│   │   ├── analysis/          # Prompt Intelligence Engine
│   │   │   ├── analyzers/     # one file per finding type (rule objects)
│   │   │   ├── scoring.ts     # quality score aggregation
│   │   │   └── engine.ts      # runs analyzers → PromptAnalysis
│   │   ├── actions/           # ActionDefinition registry (data-driven)
│   │   ├── meta-prompt/       # composable rule fragments → system prompt builder
│   │   └── types.ts           # PromptAnalysis, Finding, ActionId, …
│   ├── providers/             # AI provider abstraction
│   │   ├── types.ts           # AIProvider, ProviderError, StreamHandle
│   │   ├── registry.ts        # id → factory, DI seam
│   │   ├── openai-compat/     # base adapter (OpenAI, DeepSeek, OpenRouter,
│   │   │                      #   Ollama, LM Studio via baseUrl config)
│   │   ├── anthropic/
│   │   ├── gemini/
│   │   └── sse.ts             # shared SSE/stream parsing
│   ├── platform/              # Chrome-API wrappers (thin, mockable)
│   │   ├── storage/           # versioned repos: settings, history, templates, vault
│   │   ├── messaging/         # typed protocol + zod schemas + port helpers
│   │   └── logging.ts         # structured logger (level-filtered, ring buffer)
│   ├── entrypoints/           # WXT entrypoints
│   │   ├── background.ts      # orchestrator: handles ImproveRequest streams
│   │   ├── content.ts         # selection watcher + lazy UI loader (tiny!)
│   │   ├── popup/             # React toolbar popup
│   │   └── options/           # React settings/history/library app
│   ├── content-ui/            # lazy-loaded floating toolbar + panel (React, Shadow DOM)
│   ├── site-adapters/         # per-platform insertion/detection modules
│   │   ├── types.ts           # SiteAdapter interface
│   │   ├── registry.ts
│   │   ├── generic/           # textarea / input / contenteditable strategies
│   │   ├── chatgpt.ts  claude.ts  gemini.ts  perplexity.ts  …
│   └── ui/                    # shared React components, theme, hooks
├── e2e/                       # Playwright specs + fixture pages (real editors)
├── .github/workflows/
└── wxt.config.ts
```

Dependency rule (CI-enforced): `entrypoints → {content-ui, ui, site-adapters, platform, providers, core}`; `providers → core`; `site-adapters → core`; `core → (nothing)`.

## 4. Data flow — "Improve Prompt" happy path

1. User selects text in a field → content script's debounced `selectionchange` handler validates the selection (editable, length bounds) → lazy-imports the floating toolbar chunk on first use and positions it near the caret (Shadow DOM host, `position: fixed`, flip-aware).
2. User clicks **Improve** → content UI opens a long-lived `chrome.runtime.connect` port and sends `improve.start { text, actionId, siteHint, targetModelHint }` (zod-validated on receipt).
3. Background worker: loads settings → runs `core/analysis` (sync, <5 ms) → `core/meta-prompt` composes the system prompt from the action's strategy + analysis findings + target-model idioms → provider registry resolves the configured `AIProvider` → adapter streams the completion.
4. Chunks flow back over the port as `improve.chunk`; the panel renders streamed output, then the final `improve.done { improved, analysis }` enables **Apply / Copy / Retry** and the before/after diff tab. Port disconnect aborts the fetch via `AbortController`.
5. **Apply** → content script asks the site-adapter registry for the best adapter for this element/URL → adapter replaces the original selection (or whole field) using its insertion strategy → success toast; on failure, clipboard fallback + toast.
6. Background appends a history entry (storage repo) fire-and-forget.

"Explain Weaknesses" short-circuits at step 3: analysis (plus an optional LLM elaboration) renders as a findings report; no insertion.

## 5. Key abstractions

### 5.1 AIProvider

```ts
interface AIProvider {
  readonly id: ProviderId;
  readonly meta: { label: string; requiresKey: boolean; defaultBaseUrl?: string };
  listModels(cfg: ProviderConfig): Promise<ModelInfo[]>;
  validate(cfg: ProviderConfig): Promise<ValidationResult>;
  complete(
    req: CompletionRequest,
    cfg: ProviderConfig,
    onChunk: (delta: string) => void,
    signal: AbortSignal,
  ): Promise<CompletionResult>;
}
```

- Adapters normalize errors to a closed `ProviderError` union (`invalid_key | rate_limited | quota | context_length | network | model_not_found | unknown`) so the UI never string-matches vendor payloads.
- The **openai-compat** adapter is parameterized by `baseUrl` + auth style; DeepSeek/OpenRouter/Ollama/LM Studio are ~10-line configs on top of it. Adding a genuinely novel API = one new folder implementing the interface + one registry entry.
- Registry uses factory functions (constructor injection of `fetch` and logger) — this is the DI seam that makes providers unit-testable with a mocked fetch.

### 5.2 SiteAdapter

```ts
interface SiteAdapter {
  readonly id: string;
  matches(url: URL): boolean; // specificity-ordered registry
  isSupportedField(el: Element): boolean;
  getText(el: Element): { full: string; selection?: Range | [number, number] };
  insertText(
    el: Element,
    text: string,
    mode: 'replace-selection' | 'replace-all',
  ): Promise<InsertResult>; // ok | failed (→ fallback ladder)
  targetModelHint?(): TargetModel | undefined; // e.g. 'claude' on claude.ai
}
```

Generic strategies (shipped as the lowest-specificity adapter):

- `textarea`/`input`: set via the **native value setter** (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set`) then dispatch `input` — this is what keeps React/Vue controlled inputs in sync.
- `contenteditable`: restore saved Range → `document.execCommand('insertText', …)`, falling back to synthetic `beforeinput` (`insertReplacementText`) — both paths route through the editor framework's own event handling (ProseMirror/Lexical/Quill listen to these), so editor state stays consistent.

### 5.3 Prompt Intelligence Engine

- `engine.analyze(text, ctx): PromptAnalysis` runs an ordered list of **analyzer rule objects** (`{ id, dimension, detect(textModel): Finding[] }`) over a pre-tokenized text model (sentences, imperative verbs, question marks, delimiters, code fences, length stats).
- Findings are typed (`missing_output_format`, `ambiguous_reference`, `vague_quantifier`, `no_role`, `no_examples`, `mixed_tasks`, `conflicting_instructions`, `injection_suspect`, …) with severity and a human explanation + suggestion — reused verbatim by the "Explain Weaknesses" report.
- Score = weighted aggregation per dimension → 0–100 with subscores; weights in one config object so tuning is a data change with snapshot tests.
- **Meta-prompt builder** composes: base rewriter contract (intent preservation, "rewrite, never answer", delimiter-wrapped user text treated as data) + action strategy fragment + finding-driven fix instructions + target-model idiom fragment (e.g. XML-tag structure for Claude, system-message conventions for GPT) + output contract ("return only the rewritten prompt"). Every fragment is an independently unit-tested pure function.

### 5.4 Messaging protocol

Single source of truth in `platform/messaging/protocol.ts`: a zod-described discriminated union per direction (`ClientToBg`, `BgToClient`) with helper `definePort`/`sendTyped` wrappers. Every `onMessage`/`onConnect` handler parses before acting; malformed messages are logged and dropped. This is both a type-safety and a security boundary (content scripts run in hostile pages).

## 6. Extension lifecycle

- **Service worker** is stateless-by-design: every handler re-reads config from storage; streams run over ports (port traffic resets the MV3 idle timer); `AbortController` tied to port disconnect prevents orphan fetches. `chrome.runtime.onInstalled` seeds default settings + starter templates and runs storage migrations (versioned `schemaVersion` key).
- **Content script** registered at `document_idle`, `run_at` on `http(s)://*/*`. The registered chunk is a ~few-KB watcher; all React/UI code is dynamically imported on first real selection. A per-site kill switch (settings) makes it exit immediately on disabled origins.
- **Popup/Options** are ordinary React SPAs; they never touch providers directly — always via background messages, so behavior is identical across surfaces.

## 7. Security architecture

1. **Key custody:** keys live in `chrome.storage.local` only (never `sync` — sync replicates to every signed-in device and is a larger attack surface), accessed exclusively by the background worker through a `SecretVault` repo. Options UI masks keys after save; export excludes them. (MV3 storage is plaintext-on-disk by platform design; we document this honestly rather than fake-encrypt with a key stored beside the data.)
2. **Least privilege:** permissions = `storage`, `clipboardWrite`, `commands`; host permissions = provider API origins + content-script matches. No `tabs`, no `history`, no `scripting` beyond declared content scripts.
3. **Injection defense:** extension UI renders model output as text nodes only (no `dangerouslySetInnerHTML` anywhere — ESLint-banned); site insertion uses text-insertion APIs, never HTML; all inbound messages zod-validated; content script treats page DOM as hostile (no eval of page data, `world: ISOLATED`).
4. **Prompt-injection containment:** user-selected text is wrapped in explicit delimiters in the meta-prompt with a "treat as data" instruction; results are always human-reviewed before Apply.
5. **CSP:** MV3 defaults (no remote code, no eval); all assets bundled; no CDN fetches at runtime.
6. **Supply chain:** pnpm lockfile, Dependabot, `pnpm audit` in CI, minimal runtime deps (react, zod, zustand — everything else dev-time).

## 8. Performance strategy

- **Code splitting:** content entry ≈ watcher only; floating UI, diff view, options app all separate lazy chunks. Bundle-size budget asserted in CI (`content.js` < 50 KB gz).
- **No global observers:** `selectionchange` + `focusin` listeners, debounced 150 ms; site adapters query DOM only on demand. No polling, no whole-document MutationObserver.
- **Streaming-first UX** hides LLM latency; local analysis renders instantly while the rewrite streams.
- **Caching:** LRU result cache keyed by hash(text, action, model, provider) in `storage.session` — instant Retry/Compare, fewer paid calls.
- Tree-shaking friendly modules (no side-effectful barrels), `sideEffects: false`, Tailwind purge, no moment/lodash-class deps.

## 9. Error handling & logging

- All fallible operations return typed results or throw typed errors caught at surface boundaries; the UI has a single `ErrorView` mapping every `ProviderError`/`AppError` code to a plain-language message + recovery action ("Open settings to fix your key", "Retry").
- Retry policy: exponential backoff (2 tries) for `network`/`rate_limited` only; never for auth/validation errors.
- `platform/logging.ts`: leveled structured logger (`debug` stripped in prod builds), last-200-events ring buffer in `storage.session`, surfaced on the options page's "Diagnostics" tab for bug reports. No prompt content at `info`+ level (privacy).

## 10. Testing strategy

| Layer         | Tool                                                                                                                                  | What                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `core/`       | Vitest                                                                                                                                | Analyzer rules (fixture prompts → expected findings), scoring snapshots, meta-prompt composition golden files. Target ≥ 90 %. |
| `providers/`  | Vitest + mocked fetch                                                                                                                 | Request shaping, SSE parsing (recorded fixtures per vendor), error normalization for every `ProviderError` code.              |
| `platform/`   | Vitest + `chrome` mock (`@webext-core/fake-browser` or wxt's testing utils)                                                           | Storage migrations, protocol validation, vault.                                                                               |
| UI            | Vitest + Testing Library (happy-dom)                                                                                                  | Toolbar, panel states (loading/stream/error), a11y roles; `vitest-axe` for automated a11y checks.                             |
| Site adapters | Playwright against local fixture pages embedding _real_ ProseMirror/Lexical/Quill/Monaco + plain fields                               | The insertion matrix — the highest-risk logic gets the most realistic tests.                                                  |
| E2E           | Playwright with the built extension loaded in a persistent Chromium context, provider stubbed via a local mock server (Ollama-shaped) | Full flows: select → improve → stream → apply; settings; history.                                                             |
| Performance   | Playwright trace assertions                                                                                                           | No long tasks from our scripts on fixture pages; bundle budgets in CI.                                                        |
| Regression    | All of the above in CI on every PR; snapshot suites for scores/meta-prompts catch unintended drift.                                   |

Live-provider smoke tests exist but run only manually/nightly with repo secrets — never on PRs.

## 11. Deployment strategy

- **CI (every PR):** install → lint → typecheck → unit/integration → build (chrome + firefox targets) → E2E → bundle-budget check.
- **Release:** merge of a changesets "Version Packages" PR → tag `vX.Y.Z` → workflow builds production zip, attaches to GitHub Release with generated notes; Chrome Web Store upload via `wxt submit` / store API added once the listing exists. `manifest.version` derived from package version.
- Branch model: trunk-based — short-lived `feat/…`, `fix/…` branches → PR → squash-merge to `main`; `main` always releasable. Conventional Commits enforced by commitlint + PR title check.

## 12. Future scalability

Explicit extension points, each already load-bearing in v1: new **action** = data entry; new **provider** = adapter folder + registry line (or just an openai-compat config); new **site** = one adapter file; new **surface** (e.g. side panel, passive linting mode) = new entrypoint reusing `core` + messaging; **hosted tier** = one more `AIProvider` that talks to our future backend — nothing else changes; **cross-browser** = WXT build targets; **i18n** = `_locales` catalog already in place. ADRs in `docs/adr/` record every decision of this document's weight going forward.
