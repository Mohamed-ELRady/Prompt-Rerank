# PromptPolish *(working title)*

A Chrome extension that works like Grammarly — but for AI prompts. Select a prompt in ChatGPT, Claude, Gemini, or any editable field on the web, and get an analysis-guided, intent-preserving rewrite that applies modern prompt-engineering best practices. Bring your own API key (OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, or local models via Ollama / LM Studio) — no backend, no account, no telemetry.

> **Status: design phase.** No implementation yet — the project is currently at the design-approval gate.

## Project documents

1. [Phase 1 — Discovery](docs/01-discovery.md): assumptions, functional & non-functional requirements, risks
2. [Phase 2 — Software Design Document](docs/02-sdd.md): architecture, stack decisions, abstractions, security, testing
3. [Phase 3 — Roadmap](docs/03-roadmap.md): milestones M0–M8 to v1.0.0

Implementation (Phase 4) begins after the design documents are approved.

## Planned stack

WXT (Manifest V3) · TypeScript (strict) · React · Tailwind CSS v4 · Zustand · zod · Vitest · Playwright · pnpm · GitHub Actions · Changesets

## License

MIT (to be added with the M0 scaffold).
