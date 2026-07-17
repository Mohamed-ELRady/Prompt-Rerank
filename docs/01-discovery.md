# Phase 1 — Discovery

**Project:** PromptPolish _(working title — easy to rename later; nothing in the architecture depends on it)_
**Document status:** Draft for approval
**Date:** 2026-07-17

---

## 1. Vision summary

A Chrome (Manifest V3) extension that acts as a "Grammarly for AI prompts": the user selects prompt text in any editable field on any website, a lightweight floating toolbar appears near the selection, and the user picks an action (Improve, Fix Issues, Explain Weaknesses, Optimize for Coding, …). The extension analyzes the prompt with a Prompt Intelligence Engine, rewrites it via the user's chosen AI provider, shows a before/after preview, and replaces the selection in place — preserving the user's original intent while maximizing response quality from the target AI model.

## 2. Assumptions (to be confirmed)

These are the defaults the design is built on. Each is reversible, but changing one later costs more than confirming it now.

| #   | Assumption                                                                                                                                                                                                                 | Rationale                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **BYOK (Bring Your Own Key), no backend.** The user supplies their own API key(s); all AI calls go directly from the extension's service worker to the provider.                                                           | Zero server cost, no account system, strongest privacy story, fastest path to open source. A hosted/freemium tier can be layered on later behind the same provider abstraction. |
| A2  | **Ollama / LM Studio support means the extension works fully offline-capable** with local models — this is a first-class provider, not an afterthought.                                                                    | Differentiator for the open-source audience; also removes the "you must pay for a key" onboarding cliff.                                                                        |
| A3  | **Chrome first, cross-browser ready.** We build on a framework (WXT) that compiles to Firefox/Edge with near-zero changes, but only Chrome is tested/shipped in v1.                                                        | Focus. Edge accepts Chrome extensions almost as-is anyway.                                                                                                                      |
| A4  | **English-first UI**, i18n-ready message catalog from day one (`_locales`), translations later.                                                                                                                            | Cheap to wire early, expensive to retrofit.                                                                                                                                     |
| A5  | **No telemetry/analytics in v1.**                                                                                                                                                                                          | Open-source trust; can add opt-in later.                                                                                                                                        |
| A6  | **The rewrite itself is done by an LLM**, guided by a locally-computed structural analysis. The local Prompt Intelligence Engine does deterministic analysis (heuristics + rules); it does not attempt local ML inference. | Deterministic analysis is fast, testable, and free; the LLM does what LLMs are good at.                                                                                         |
| A7  | **Selection-based workflow is primary.** "Improve the whole field without selecting" is a convenience action (keyboard shortcut / field icon), not a separate architecture.                                                | One pipeline, two entry points.                                                                                                                                                 |

## 3. Functional requirements

### FR-A: Capture & UI surfaces

- **FR-A1** Detect text selection inside `<textarea>`, `<input type="text">`, and `contenteditable` elements on any `http(s)` page.
- **FR-A2** Show a floating action toolbar near the selection, rendered in a Shadow DOM so host-page CSS cannot break it and ours cannot leak out.
- **FR-A3** Floating panel shows analysis results, streamed rewrite output, and a before/after diff view with **Apply / Copy / Retry / Dismiss**.
- **FR-A4** Extension (toolbar) popup: quick improve of clipboard/pasted text, recent prompts, link to settings.
- **FR-A5** Full settings page (options UI): providers & keys, model choice, default action, per-site enable/disable, appearance, shortcuts.
- **FR-A6** Keyboard shortcuts (via `chrome.commands`): trigger improve on current selection/field; user-remappable in `chrome://extensions/shortcuts`.
- **FR-A7** Dark/light theme (follows system, overridable), full keyboard navigation, ARIA-correct, reduced-motion support.

### FR-B: Actions

All actions share one pipeline (analyze → rewrite with action-specific strategy → present):
Improve Prompt · Make More Powerful · Fix Issues · Rewrite Professionally · Expand · Shorten · Explain Weaknesses (analysis-only, no rewrite) · Generate Better Alternative · Compare Before vs After · Optimize for Model (ChatGPT/Claude/Gemini/…) · Optimize for Domain (Coding / Writing / Research / Business / Education).

Actions are **data, not code**: each is a declarative `ActionDefinition` (id, label, icon, strategy, prompt-template fragments), so adding an action is a config change.

### FR-C: Prompt Intelligence Engine

- **FR-C1** Local deterministic analysis producing a structured `PromptAnalysis`: detected task type, inferred objective, complexity estimate, quality score (0–100) with per-dimension subscores (clarity, specificity, context, constraints, output-spec, structure), and a list of typed findings (missing output format, ambiguous pronouns, vague quantifiers, no role, no examples, wall-of-text structure, conflicting instructions, …).
- **FR-C2** The analysis is injected into the rewrite meta-prompt so the LLM fixes _identified_ weaknesses rather than rewriting blindly.
- **FR-C3** The meta-prompt system encodes cross-vendor best practices (clear instructions, role/persona, delimiters, few-shot examples, output format spec, decomposition, "let the model think", target-model-specific idioms such as XML tags for Claude) as composable rule fragments — synthesized, not copied from any one vendor's docs.
- **FR-C4** Hard invariant: **intent preservation**. The meta-prompt forbids inventing requirements, changing the task, or answering the prompt instead of rewriting it.

### FR-D: AI provider layer

- **FR-D1** `AIProvider` interface with streaming completion, model listing, key validation, and error normalization.
- **FR-D2** v1 adapters: OpenAI, Anthropic, Google Gemini, plus one **OpenAI-compatible generic adapter** that covers DeepSeek, OpenRouter, Ollama, LM Studio, and most future providers via base-URL configuration.
- **FR-D3** All network calls happen only in the background service worker. Keys never enter content scripts or page context.
- **FR-D4** Provider/model selection per-request override; sensible defaults in settings.

### FR-E: Text insertion (site adapters)

- **FR-E1** Generic insertion strategies for plain `textarea`/`input` and for `contenteditable` (using `beforeinput`/`execCommand('insertText')` paths that keep site frameworks' state in sync).
- **FR-E2** A **site adapter registry** for platforms with rich editors (ChatGPT ProseMirror, Gemini Quill, Claude Lexical, Monaco-based editors, …): each adapter declares URL match patterns, input locator, insertion method, and optional target-model hint (so "Optimize for Model" can auto-detect that the user is on Claude). Adding a platform = adding one adapter file.
- **FR-E3** Fallback ladder: site adapter → generic strategy → copy-to-clipboard with a toast ("couldn't insert here — copied instead"). The feature must never silently fail.

### FR-F: Library & history

- **FR-F1** Prompt history (original + improved + analysis + timestamp + source site), capped with LRU eviction; user-clearable; excludable per-site.
- **FR-F2** Favorites and a template/library system (starter templates shipped, user templates CRUD, variables like `{{topic}}`).
- **FR-F3** Import/export of templates and settings (JSON), excluding API keys.

## 4. Non-functional requirements

| Category        | Requirement                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Performance     | Content script initial footprint < 50 KB gzip; floating UI lazy-loaded on first selection; no `MutationObserver` on the whole document (event-driven `selectionchange` with debounce); zero measurable impact on page interaction (no long tasks > 50 ms).                                                                                             |
| Memory          | Service worker is ephemeral (MV3): all state persisted to `chrome.storage`; no in-memory singletons assumed alive.                                                                                                                                                                                                                                     |
| Security        | MV3 CSP; no remote code; keys in `chrome.storage.local` (never `sync`); all provider responses treated as untrusted text (no `innerHTML` of model output); minimal permissions (`storage`, `activeTab` where possible, host permissions only for API endpoints + content-script matches); typed message protocol validated with zod at every boundary. |
| Privacy         | Prompt text leaves the machine only to the user-configured provider; history stored locally only; no third-party calls.                                                                                                                                                                                                                                |
| Reliability     | Every provider error mapped to a typed, user-actionable message (bad key, rate limit, quota, network, model-not-found); automatic retry with backoff for transient failures; streaming aborts cleanly.                                                                                                                                                 |
| Quality         | TypeScript `strict`; ≥ 80 % unit coverage on `core/` and `providers/`; E2E smoke on a fixture page + ChatGPT DOM snapshot; CI gates on lint + typecheck + test + build.                                                                                                                                                                                |
| Accessibility   | WCAG 2.1 AA for all extension-owned UI; toolbar and panel fully operable by keyboard; focus trapped and restored correctly.                                                                                                                                                                                                                            |
| Maintainability | Clean layering (`core` has zero Chrome/DOM/React imports); adding a provider, action, or site adapter never touches existing modules (open/closed).                                                                                                                                                                                                    |

## 5. Key challenges & mitigations

1. **Reliable insertion into framework-controlled editors** (the hardest problem — React/ProseMirror/Lexical ignore naive `element.value =` writes). → Mitigation: native-setter + `input` event technique for React inputs; `document.execCommand('insertText')` / synthetic `beforeinput` for contenteditable; per-site adapters for the big platforms; clipboard fallback so UX never dead-ends. Covered by E2E tests against real editor libraries.
2. **MV3 service-worker lifetime** — the worker dies after ~30 s idle and mid-stream keepalive is needed. → Streaming via `chrome.runtime.connect` ports (port activity extends lifetime); all durable state in storage; idempotent startup.
3. **CORS / provider access from the extension.** Background fetches with host permissions bypass page CORS; Anthropic additionally requires the `anthropic-dangerous-direct-browser-access` header for browser-side calls — handled inside the Anthropic adapter. Ollama needs `OLLAMA_ORIGINS` guidance in docs.
4. **Chrome Web Store review with broad host permissions.** `<all_urls>` content scripts draw scrutiny. → Ship with `http(s)://*/*` but document justification; per-site disable list; investigate optional host permissions + on-demand injection as a post-v1 hardening item.
5. **Prompt-injection via selected text** (selected text could contain instructions to the rewriting LLM). → Meta-prompt wraps user text in explicit delimiters and instructs the model to treat it as data; analysis engine flags suspicious instruction-like content; output is always shown for review before Apply — never auto-applied.
6. **Cost/latency of LLM calls.** → Response streaming for perceived speed; local analysis is instant and free; short-lived in-memory + storage cache keyed by (text, action, model); explicit token-size guardrail with "prompt too long" messaging.

## 6. Out of scope for v1

Accounts/auth, hosted backend, billing, team features, browser sync of keys, Firefox/Safari store submission, mobile, telemetry, non-English UI translations (wiring is in, translations aren't), in-page "underline problems as you type" mode (Grammarly-style passive linting — great v2 candidate; the analysis engine is built to support it).

## 7. Success criteria for v1.0

- Select → improve → apply works on ChatGPT, Claude, Gemini, Perplexity, DeepSeek, and any plain textarea/contenteditable page.
- Works with at least OpenAI, Anthropic, Gemini, OpenRouter, and Ollama as providers.
- Lighthouse-style page-impact audit shows no measurable degradation of host pages.
- A contributor can add a new action, provider, or site adapter by following the developer guide without modifying core files.
- Clean CI, tagged `v1.0.0`, publishable Chrome Web Store zip produced by CI.
