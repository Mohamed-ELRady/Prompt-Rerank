# Changelog

All notable changes to PromptPolish are documented here. The format follows [Keep a Changelog](https://keepachangelog.com) and the project adheres to [Semantic Versioning](https://semver.org). From 1.0.0 onward, entries are generated per-PR via [changesets](https://github.com/changesets/changesets).

## [1.0.0] — 2026-07-18

First stable release.

### Added

- **Prompt Intelligence Engine**: deterministic local analysis with 12 typed finding rules, task-type/complexity detection, and a weighted 0–100 quality score; findings drive the rewrite.
- **16 actions** covering improve/powerful/fix/explain/professional/expand/shorten/alternative plus optimize-for-domain (coding, writing, research, business, education) and optimize-for-model (ChatGPT, Claude, Gemini).
- **Composable meta-prompt system** with hard intent-preservation and prompt-injection-containment invariants.
- **Provider layer**: OpenAI, Anthropic, Google Gemini adapters plus an OpenAI-compatible adapter powering DeepSeek, OpenRouter, Ollama and LM Studio presets; streaming with abort, retry-once policy, normalized error codes; background-only key custody with masked previews.
- **Floating UI** on any http(s) page: selection toolbar, streaming result panel with analysis card and word-level Before/After diff, apply/copy/retry, clipboard fallback; ~2 kB always-loaded watcher with the UI in a lazy Shadow-DOM chunk.
- **Site profiles** for ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Poe, HuggingChat, Grok and Mistral, with automatic target-model tuning and composer targeting for the keyboard shortcut (`Ctrl/Cmd+Shift+U`).
- **History** (search, favorites, per-site exclusion, cap with favorite-preserving eviction), **template library** with `{{variables}}` and five starters, **JSON import/export** that never includes API keys.
- **Popup** quick-improve with recent prompts; tabbed settings (provider, history, templates, advanced).
- **Polish**: dark/light/system theming, reduced-motion-aware animations, i18n catalog, first-install onboarding, focus management and axe-verified accessibility.

[1.0.0]: ../../releases/tag/v1.0.0
