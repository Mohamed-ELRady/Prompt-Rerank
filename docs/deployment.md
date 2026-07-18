# Deployment Guide

## Release flow

1. Ensure `main` is green and the manual site checklist ([adding-a-site-adapter.md](adding-a-site-adapter.md) §3) has been run against the major platforms.
2. Bump the version: `npm pkg set version=X.Y.Z` (WXT derives `manifest.version` from it; prerelease suffixes are dropped in the manifest).
3. Update `CHANGELOG.md` (changesets: `pnpm changeset version` once changesets accumulate).
4. Commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`, push with tags.
5. The **release workflow** (`.github/workflows/release.yml`) builds, runs the bundle budget, zips `.output/chrome-mv3`, and attaches `promptpolish-X.Y.Z-chrome.zip` to a draft GitHub Release. Review and publish.

## Chrome Web Store

- Upload the zip from the GitHub Release to the [developer dashboard](https://chrome.google.com/webstore/devconsole) (first upload creates the listing; afterwards `wxt submit` can automate it with `CHROME_*` secrets).
- **Privacy disclosures** for review: single purpose = "improve AI prompts the user selects"; remote code = none; data use = prompt text sent to the user-configured AI provider only on user action; no data sold/transferred. Justify host permissions as: content script needs to run where users write prompts; API hosts are the bundled providers.
- Keys/store assets live outside the repo. Screenshots: floating toolbar on a chat site, result panel with diff, settings provider tab.

## Local verification of a release build

```bash
pnpm build && pnpm budget && pnpm zip   # .output/promptpolish-X.Y.Z-chrome.zip
```

Load `.output/chrome-mv3` unpacked and run through the user-guide flow once with a local provider.

## Firefox (post-1.0)

`pnpm build:firefox` already compiles. Store submission (AMO signing, `browser_specific_settings.gecko.id`) is tracked as a post-1.0 item in the roadmap.
