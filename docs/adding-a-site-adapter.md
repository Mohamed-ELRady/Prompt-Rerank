# Adding support for a new AI platform

Support for a platform is one entry in [`src/site-adapters/profiles.ts`](../src/site-adapters/profiles.ts). The generic capture/insertion strategies already speak the input-event protocols that ProseMirror, Lexical, Quill, and plain form fields listen to, so most sites need **no site-specific insertion code at all**.

## 1. Add a profile

```ts
{
  id: 'examplechat',
  hosts: /(^|\.)chat\.example\.com$/,   // matched against location.host
  targetModel: 'gpt',                    // omit if the site isn't tied to one model family
  composerSelector: 'textarea#composer', // main prompt box, for the keyboard shortcut
}
```

- `hosts` must anchor the domain (`(^|\.)…$`) so lookalike domains never match — this is a security boundary, and `profiles.test.ts` has a lookalike test you should extend.
- `targetModel` makes every action on that site automatically apply that model family's prompt idioms.
- `composerSelector` lets the keyboard shortcut improve the whole composer when nothing is selected. Prefer stable ids/attributes over class soup; list fallbacks comma-separated.

## 2. Add tests

- Extend the table in `src/site-adapters/profiles.test.ts` (host → id → model hint).
- If the site's editor behaves unusually, add a fixture page under `e2e/fixtures/` reproducing that behavior and a spec in `e2e/improve-flow.spec.ts`. The existing fixtures already cover: plain fields, React-style controlled textareas, and framework-controlled contenteditable (state-owning editors that revert untracked DOM writes).

## 3. Manual verification checklist (live site)

Live DOMs churn, so before each release verify on the real site:

1. Select prompt text → toolbar appears near the selection.
2. Improve → result streams → **Apply** replaces exactly the selection.
3. Typing afterwards behaves normally (editor state not corrupted; undo works).
4. Keyboard shortcut with no selection targets the composer.
5. Site still works with the extension disabled for the origin (settings kill switch).

## 4. If generic insertion fails on the site

Only then add a bespoke path: give the profile an `insertOverride(target, text)` (extend the `SiteProfile` interface — the apply flow is designed to consult it before the generic ladder) and document _why_ the generic strategy fails, so future maintainers can retire the override when the site changes.
