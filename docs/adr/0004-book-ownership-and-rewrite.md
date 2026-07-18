# ADR-0004 — Universe book ownership: plugin-managed with edit-preserving rewrite

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

The universe book is a plugin artifact, but SillyTavern users routinely hand-edit their lorebooks — and
the LLM will sometimes generate a franchise detail that's wrong and needs correcting. A design that
rewrites the book wholesale would silently destroy those edits; a design that never modifies anything
lets staleness and the plugin's own mistakes accumulate. We want a "Regenerate" button that does **not**
lose user work.

## Decision

The plugin **manages the book but respects provenance**:

- Every entry the plugin creates is **marked**, and its generated content is recorded as a **hash**.
- **Regenerate** rewrites only entries whose current content still matches the stored hash. Anything the
  user **added** (untagged) or **edited in place** (hash no longer matches) is detected and left alone.
- A book is **snapshotted before any rewrite** for recoverability.

Automation (see [ADR-0002](./0002-scope-universe-books.md) core loop): detection + linking happen
automatically on engage; **building a missing book is gated by an auto-build flag (default OFF)**;
existing books are never auto-rewritten — Regenerate is always an explicit action.

## Alternatives considered

- **Plugin owns the whole book (opaque, rewrite freely)** — the user's first instinct, but it destroys
  hand-edits on every rewrite. Preserving edits is impossible without provenance, so this was upgraded
  to the marked-entry model above.
- **Additive-only, never modify** — zero clobber risk, but stale/duplicate entries pile up and the
  plugin can't fix its own mistakes. Rejected as the default.
- **Explicit lock toggle** / **diff-and-review on rewrite** — both good *additions* later, but each asks
  the user to remember something or sit through a review. Auto-detect is the default spine; these can be
  layered on.
- **Auto-refresh on every engage** — burns an LLM generation each time and surprises the user. Rejected.

## Consequences

- "Regenerate" and "keep my edits" coexist.
- The plugin must track per-entry ownership + hashes (in extension storage — see
  [ADR-0007](./0007-never-write-character-cards.md)).
