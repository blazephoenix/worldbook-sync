# ADR-0006 — TypeScript + esbuild build, git-URL distribution

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

SillyTavern installs a client-side extension by cloning its git repo and loading the `js` entry named in
`manifest.json` directly in the browser — so whatever ships must be browser-runnable as-is, or a build
output must be committed. The World Info and character-card data models have dozens of fields, so type
safety has real value against silent shape mistakes.

## Decision

- Write the extension in **TypeScript**, bundled with **esbuild** to a single committed `dist` file that
  `manifest.json`'s `js` points at. esbuild is chosen for near-instant, minimal-config single-file output.
- Distribute via **git URL** (ST's native "Install extension" flow).

## Alternatives considered

- **Vanilla JS, no build (optionally JSDoc-typed)** — the ST ecosystem norm; zero tooling and
  install-from-URL just works. Rejected in favor of full type safety against the fiddly data models.
- **Vanilla JS, no types** — fastest to hack, least safety. Rejected as thin ice for maintenance.

## Consequences

- A build step exists; the built `dist` must be committed (or built on install) so the git-URL install
  loads a runnable file.
- Type definitions for the `getContext()` surface / World Info entry shape may need to be hand-authored
  or sourced, since they aren't guaranteed to ship as a typed package.
