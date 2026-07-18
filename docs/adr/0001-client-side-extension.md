# ADR-0001 — Build as a client-side extension, not a server plugin

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

SillyTavern offers two extension surfaces: client-side **Extensions** (a `manifest.json` + JS module
loaded in the browser, installed via git URL) and server-side **Plugins** (Node.js in `/plugins`, full
filesystem/HTTP access, gated behind `enableServerPlugins`). The tool must read across many characters,
read/create/update World Info, and call an LLM to reason about content.

## Decision

Build worldbook-sync as a **client-side Extension**.

Everything it needs is reachable from `SillyTavern.getContext()` in the browser:
- enumerate all characters via the in-memory `characters` array (full parsed card data, no filesystem);
- read/create/update World Info via `loadWorldInfo` / `saveWorldInfo` / `createWorldInfoEntry`;
- call the LLM on the user's already-configured connection via `generateQuietPrompt` /
  `ConnectionManagerRequestService`.

## Alternatives considered

- **Server plugin.** Warranted only for things the browser can't do — bulk-scanning card PNGs on disk
  that aren't loaded into the app, or heavy Node-only processing. We need none of that; the loaded
  `characters` array already exposes every card. Rejected as unnecessary weight (and it requires the
  user to enable server plugins and trust unsandboxed Node code).

## Consequences

- No filesystem access; we operate entirely on what ST has loaded and on ST's own save APIs.
- Trivial install (git URL) and reuse of the user's existing LLM connection.
- If a future need for on-disk batch scanning appears, a companion server plugin can be added without
  disturbing this one.
