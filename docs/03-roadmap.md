# Phase 3 — Implementation Roadmap

**Document status:** Draft for approval · **Date:** 2026-07-17

Milestones are strictly ordered by dependency; each ends with a green CI run and a tagged pre-release where noted. Complexity: S (≤ half day), M (1–2 days), L (3–5 days) of focused work.

---

## M0 — Repository & toolchain foundation (Complexity: S–M, deps: none)

**Objectives:** a contributor can clone, install, build, test, and load the (empty) extension in Chrome.

**Deliverables:** WXT + React + TS strict scaffold; Tailwind v4; ESLint flat config (+ `eslint-plugin-boundaries` layer rules, `no-innerHTML` bans), Prettier, commitlint + husky; Vitest and Playwright wired with one trivial test each; GitHub Actions CI (lint/typecheck/test/build); changesets; LICENSE (MIT), README stub, CONTRIBUTING, issue/PR templates.

**Testing:** CI itself is the test — all gates green on a hello-world extension.
**Commits:** `chore: scaffold wxt extension with react and typescript`, `chore: configure eslint, prettier, commitlint`, `ci: add lint/test/build workflow`, `docs: add contributing guide and templates`.

## M1 — Platform layer: storage, messaging, logging (M, deps: M0)

**Objectives:** the trust boundaries and persistence spine everything else sits on.

**Deliverables:** zod-typed message protocol + port helpers; versioned storage repositories (settings, history, templates, secret vault) with migration runner seeded on `onInstalled`; structured logger with ring buffer; `chrome` mocked test harness.

**Testing:** unit tests for protocol validation (malformed-message rejection), storage round-trips and a v0→v1 migration, vault access.
**Commits:** `feat(platform): add typed messaging protocol`, `feat(platform): add versioned storage repositories`, `feat(platform): add structured logger`.

## M2 — Provider layer + settings UI (L, deps: M1) → tag `v0.1.0-alpha`

**Objectives:** background worker can stream a completion from any configured provider.

**Deliverables:** `AIProvider` interface, registry, error union; **openai-compat** adapter (OpenAI, DeepSeek, OpenRouter, Ollama, LM Studio presets); Anthropic and Gemini adapters; shared SSE parser; background orchestrator handling `improve.start` ports with abort + retry policy; options page v1 (provider config, key entry/validation/masking, model picker, default action).

**Testing:** mocked-fetch unit tests per adapter incl. every error code; SSE fixture-replay tests; integration test: port request → mocked provider → streamed chunks. Manual smoke against Ollama.
**Commits:** `feat(providers): add provider abstraction and registry`, `feat(providers): add openai-compatible adapter`, `feat(providers): add anthropic adapter`, `feat(providers): add gemini adapter`, `feat(background): stream completions over ports`, `feat(options): provider settings ui`.

## M3 — Content script: selection, floating UI, generic insertion (L, deps: M1; parallel with M2) → tag `v0.2.0-alpha`

**Objectives:** the Grammarly-style loop works end-to-end on plain fields (echo/mock rewrite until M2 merges).

**Deliverables:** tiny selection-watcher entry (debounce, editable-only, per-site kill switch); lazy-loaded Shadow-DOM toolbar + result panel (streamed text, Apply/Copy/Retry/Dismiss, positioning with viewport flip); generic site adapters (native-setter textarea/input strategy, execCommand/beforeinput contenteditable strategy, clipboard fallback ladder); keyboard shortcut command.

**Testing:** Playwright fixture pages: plain textarea, React-controlled textarea, vanilla contenteditable — select → improve → apply asserted; bundle budget test (content entry < 50 KB gz); axe pass on toolbar/panel.
**Commits:** `feat(content): selection detection and lazy ui loading`, `feat(content-ui): floating toolbar and result panel`, `feat(site-adapters): generic insertion strategies`, `perf(content): enforce bundle budget`.

## M4 — Prompt Intelligence Engine + action system (L, deps: M2+M3) → tag `v0.3.0-beta`

**Objectives:** the product's brain — analysis-guided rewriting with the full action set.

**Deliverables:** text model + analyzer rules (≈12 finding types), scoring config, `PromptAnalysis`; meta-prompt fragment library (base contract, per-action strategies, target-model idioms, injection containment); all actions from the spec wired as `ActionDefinition` data incl. Explain Weaknesses report and Before/After diff view; analysis card in panel (score + findings).

**Testing:** the deepest unit suite: fixture prompts → expected findings; score snapshots; meta-prompt golden files per (action × target model); property test — rewriter contract never leaks user text outside delimiters. Qualitative eval doc: 20 sample prompts before/after across 3 providers.
**Commits:** `feat(core): prompt analysis engine`, `feat(core): quality scoring`, `feat(core): meta-prompt composition`, `feat(actions): full action registry`, `feat(content-ui): analysis and diff views`.

## M5 — Site adapters for major AI platforms (M–L, deps: M3, deps M4 for model hints) 

**Objectives:** first-class reliability on the sites that matter.

**Deliverables:** adapters for ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, Poe, HuggingChat + target-model auto-hints; adapter conformance kit (shared test contract) and `docs/adding-a-site-adapter.md`.

**Testing:** Playwright fixture pages embedding real ProseMirror/Lexical/Quill/Monaco editors run the shared conformance suite; manual checklist against live sites per release (documented, since live DOMs churn).
**Commits:** one `feat(site-adapters): add <site> adapter` per site, `test(site-adapters): conformance kit`.

## M6 — History, templates, library, popup (M, deps: M1, M4) → tag `v0.4.0-beta`

**Deliverables:** history capture + browse/search/clear + per-site exclusion; favorites; template CRUD with `{{variables}}` + starter library; import/export (keys excluded); toolbar popup (quick improve, recents, settings link).

**Testing:** storage-repo unit tests (LRU eviction, search), Testing Library specs for popup and library views, E2E history flow.
**Commits:** `feat(history): capture and browse improved prompts`, `feat(templates): template library with variables`, `feat(popup): quick improve popup`.

## M7 — Polish: theming, a11y, animations, i18n wiring, onboarding (M, deps: M6)

**Deliverables:** dark/light with system-follow; full keyboard nav + focus management + ARIA audit fixes; `prefers-reduced-motion`-aware micro-animations; `_locales` extraction; first-run onboarding (provider setup walkthrough); empty/edge states everywhere.

**Testing:** `vitest-axe` across all surfaces, manual screen-reader pass (VoiceOver), visual review both themes.
**Commits:** `feat(ui): dark mode and theming`, `feat(a11y): keyboard navigation and aria coverage`, `feat(onboarding): first-run setup flow`.

## M8 — Hardening, docs, release 1.0 (M, deps: all) → tag `v1.0.0`

**Deliverables:** full docs set (README with GIFs, User Guide, Developer Guide, Architecture doc refresh, API/provider docs, Installation & Deployment guides, SECURITY.md); performance audit (long-task traces, memory); permission review; store listing assets + privacy disclosure; CI release workflow producing the store zip; CHANGELOG via changesets; GitHub Discussions enabled.

**Testing:** full regression matrix, live-provider nightly smoke enabled, external beta feedback round.
**Commits:** `docs: complete user and developer guides`, `perf: audit fixes`, `chore(release): v1.0.0`.

---

### Post-1.0 candidates (recorded, unscheduled)
Passive "lint as you type" underlines · optional host permissions / on-demand injection · Firefox & Edge store releases · hosted freemium provider · prompt A/B testing harness · community template sharing.

### Standing workflow rules (all milestones)
Feature branches + PRs even solo (review-readiness discipline); Conventional Commits; changeset per user-facing change; docs updated in the same PR as the feature; `main` always green and loadable.
