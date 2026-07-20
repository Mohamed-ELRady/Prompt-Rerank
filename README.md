# Prompt Rerank

**Grammarly for AI prompts.** Select a prompt in ChatGPT, Claude, Gemini — or any editable field on the web — and Prompt Rerank analyzes it, scores it, and rewrites it using modern prompt-engineering practice, while preserving exactly what you meant.

- 🔍 **Prompt Intelligence Engine** — instant local analysis: quality score (0–100), task type, and typed findings (missing output format, vague wording, contradictions, walls of text, …). No network call, no cost.
- ✨ **16 actions** — Improve, Make More Powerful, Fix Issues, Explain Weaknesses, Rewrite Professionally, Expand, Shorten, Better Alternative, and Optimize-for (Coding / Writing / Research / Business / Education / ChatGPT / Claude / Gemini).
- 🧠 **Analysis-guided rewriting** — the LLM is told exactly which weaknesses to fix, wrapped in a contract that forbids inventing requirements or answering the prompt.
- 🔑 **Bring your own key, or none at all** — OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter out of the box, plus fully local **Ollama** and **LM Studio**. Keys stay on your device and go only to the provider you chose.
- 🕶 **Private by design** — no backend, no account, no telemetry. History lives in local extension storage; export never includes keys.
- ⚡ **Light-touch** — the always-loaded page script is ~2 kB gzip with one debounced listener; the UI loads lazily in an isolated Shadow DOM.

## Install (from source, until the store listing ships)

```bash
pnpm install
pnpm build
```

Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `.output/chrome-mv3`. The onboarding page opens automatically; pick a provider (Ollama needs no key: run `OLLAMA_ORIGINS=chrome-extension://* ollama serve`).

## Use

1. Write a prompt on any AI site and **select it**.
2. Click an action in the floating toolbar (or press `Ctrl/Cmd+Shift+U` — with nothing selected it targets the site's composer).
3. Watch the analysis + rewrite stream in, check the **Before/After** diff, hit **Apply**.

The toolbar popup offers paste-and-improve plus your recent prompts; the settings page holds providers, history, templates (with `{{variables}}`), and import/export.

## Documentation

| For          | Read                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Users        | [User Guide](docs/user-guide.md)                                                                                                      |
| Contributors | [CONTRIBUTING](CONTRIBUTING.md) · [Developer Guide](docs/developer-guide.md) · [Adding a site adapter](docs/adding-a-site-adapter.md) |
| Architecture | [Discovery](docs/01-discovery.md) · [Software Design Document](docs/02-sdd.md) · [Roadmap](docs/03-roadmap.md)                        |
| Security     | [SECURITY.md](SECURITY.md)                                                                                                            |
| Releasing    | [Deployment Guide](docs/deployment.md)                                                                                                |

## Stack

WXT (Manifest V3) · TypeScript strict · React · Tailwind CSS v4 · zod · Vitest · Playwright · pnpm · GitHub Actions. Architecture layering is CI-enforced; see the SDD for why the codebase looks the way it does.

## License

[MIT](LICENSE)
