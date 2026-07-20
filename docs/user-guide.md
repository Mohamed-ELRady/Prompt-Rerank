# Prompt Rerank User Guide

## Setup

1. Open the extension's **Settings** (toolbar icon → Settings, or right-click the icon → Options).
2. **Provider tab**: choose who rewrites your prompts.
   - **Local, free, private**: Ollama (`OLLAMA_ORIGINS=chrome-extension://* ollama serve`) or LM Studio (enable its local server). No key needed.
   - **Free API tiers**: Groq, Mistral, xAI (Grok), Together — sign up, grab a free key (the hint under the key field links to the right console), and paste it.
   - **Cloud**: OpenAI, Anthropic, Google Gemini, DeepSeek, or OpenRouter — paste an API key. The key is stored only on this device and sent only to that provider.
   - **Custom (any OpenAI-compatible API)**: pick this to use _any_ other provider. Paste its **Base URL** (e.g. `https://api.example.com/v1`), a **model** name, and a key if it needs one. The first time you **Test connection**, Chrome asks permission to reach that host — approve it once and it works everywhere afterward. Almost every modern AI API (including most free ones) is OpenAI-compatible and works here.
3. Click **Test connection**. Optionally **Load models** and pick one.

## Improving a prompt

- **Select text** in any prompt box → the floating toolbar appears:
  - **Improve** — the all-round rewrite.
  - **Make more powerful** — maximal strengthening (role, criteria, structure).
  - **Fix issues** — minimal touch: repairs ambiguity/contradictions only.
  - **Explain weaknesses** — a report instead of a rewrite.
  - **More ▾** — refine (professional / expand / shorten / alternative), optimize-for-task (coding, writing, research, business, education) and optimize-for-model (ChatGPT, Claude, Gemini).
- The panel shows your prompt's **quality score and findings** instantly, then streams the result. Use the **Before / After** tab to see exactly what changed, then **Apply** (replaces your selection), **Copy**, or **Retry**.
- **Keyboard**: `Ctrl+Shift+U` (`Cmd+Shift+U` on Mac). With nothing selected on a known AI site, it grabs the whole composer. Remap at `chrome://extensions/shortcuts`. `Esc` closes the UI.
- On sites we recognize (claude.ai, chatgpt.com, gemini.google.com, …) every rewrite is automatically tuned to that site's model family.

## Popup, history, templates

- **Toolbar popup**: paste any prompt → Improve → copy the result. Your five most recent improvements are one click away.
- **Settings → History**: search everything you've improved, star favorites (favorites survive the size cap), delete entries or clear all. Add a site to _history-excluded origins_ to keep its prompts out.
- **Settings → Templates**: reusable prompts with `{{variables}}` — click Copy and fill the variables inline. Five starter templates are included; add your own.
- **Settings → Advanced**: export/import settings + your templates as JSON. **API keys are never exported.**

## Privacy & control

- Selected text leaves your machine **only** when you click an action, and only to your configured provider. With Ollama/LM Studio it never leaves at all.
- Disable Prompt Rerank on any site by adding its origin to _disabled origins_ in settings.
- If the result can't be inserted (exotic editor), it's copied to your clipboard and the panel tells you so.

## Troubleshooting

| Symptom                                 | Fix                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| "The API key was rejected"              | Re-paste the key in Settings; check the provider console that it's active.                                              |
| "Could not reach the provider"          | Check your network / base URL; for Ollama confirm `ollama serve` is running with `OLLAMA_ORIGINS=chrome-extension://*`. |
| "rate limiting requests"                | Wait a moment and Retry — Prompt Rerank already retried once for you.                                                   |
| Toolbar doesn't appear                  | Confirm the site isn't in disabled origins and the selection is inside an editable field.                               |
| "The prompt is too long for this model" | Shorten the selection or pick a larger-context model.                                                                   |
