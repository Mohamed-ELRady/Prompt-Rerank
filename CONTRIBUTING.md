# Contributing to PromptPolish

Thanks for your interest! This document covers the essentials; the [Software Design Document](docs/02-sdd.md) explains _why_ the codebase looks the way it does — read it before large changes.

## Getting started

```bash
pnpm install        # also runs `wxt prepare` (generates .wxt/ types)
pnpm dev            # dev build with HMR; load .output/chrome-mv3-dev in Chrome
pnpm test           # unit tests (Vitest)
pnpm build && pnpm e2e   # end-to-end tests (needs `pnpm exec playwright install chromium`)
```

Load the extension: Chrome → `chrome://extensions` → Developer mode → _Load unpacked_ → `.output/chrome-mv3` (or the `-dev` folder when using `pnpm dev`).

## Project rules

- **Architecture layering is CI-enforced** (`eslint-plugin-boundaries`): `src/core` imports nothing outside itself; see SDD §3 for the full dependency rules. If ESLint blocks your import, the fix is to move the code, not to disable the rule.
- **No `innerHTML` / `dangerouslySetInnerHTML`** anywhere — model output and page data are untrusted (SDD §7).
- **TypeScript strict**; no `any` without an eslint-disable comment explaining why.
- New actions/providers/site-adapters follow the extension-point patterns in SDD §5 — they should not require edits to existing modules.

## Workflow

1. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
2. Small, focused commits following [Conventional Commits](https://www.conventionalcommits.org) (`feat(providers): …`, `fix(content): …`). Commitlint runs on every commit and in CI.
3. Add a **changeset** (`pnpm changeset`) for any user-facing change — it drives versioning and the CHANGELOG.
4. Open a PR. CI must be green: format, lint, typecheck, unit tests, build (chrome + firefox), e2e.
5. Update docs in the same PR as the behavior they describe.

## Tests

- Pure logic (`src/core`, `src/providers`) gets unit tests next to the source (`*.test.ts`).
- Anything touching insertion into web pages gets a Playwright spec in `e2e/`.
- Never call live AI provider APIs from tests — use the mocked-fetch/fixture patterns.

## Reporting bugs / proposing features

Use the GitHub issue templates. For security issues, see `SECURITY.md` (do not open a public issue).
