# Security Policy

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** (Security tab → Report a vulnerability) rather than a public issue. You can expect an acknowledgment within a week. Please include reproduction steps and the extension version.

## Security model (what we promise)

- **API keys** live in `chrome.storage.local` only — never `sync`, never exported, never sent anywhere except the provider you configured, and only from the background service worker. The UI only ever sees a masked preview. (Note: extension storage is not encrypted at rest by the platform; anyone with access to your OS profile can read it. We do not pretend otherwise with cosmetic encryption.)
- **Network**: the extension performs no requests except provider API calls you trigger. No telemetry, no update pings, no third parties.
- **Page isolation**: content scripts treat page DOM as hostile; every message crossing a context boundary is schema-validated; model output is rendered as text nodes only (`innerHTML`/`dangerouslySetInnerHTML` are lint-banned repo-wide); host matching for site profiles is domain-anchored against lookalikes.
- **Prompt injection**: selected text is delimiter-wrapped and declared as data in the meta-prompt; results are always human-reviewed before Apply — nothing is auto-applied to the page.
- **Permissions**: `storage`, `clipboardWrite`, `commands`, plus host permissions for the bundled provider APIs and content-script matching. No `tabs` read access, no `history`, no `scripting`.
- **Supply chain**: pnpm lockfile with build-script allowlisting, minimal runtime dependencies (react, zod, zustand), CI on every PR.

## Scope notes for researchers

Interesting areas: message-boundary validation bypasses, ways page content could reach `sendMessage`/ports with forged shapes, key exfiltration paths, insertion XSS via crafted model output, and lookalike-domain matching in `src/site-adapters/profiles.ts`.
