# ADR-0002 — Scope: shared universe books only; characters, never personas

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

"Create/update worldbooks for characters" could mean many things: generating a per-character book,
enriching one, or maintaining shared lore across characters in the same universe. The repo name is
*worldbook-sync*. Separately, characters that share a universe risk having the same world facts
duplicated in each of their books — the classic drift-out-of-sync failure.

## Decision

1. **Two tiers.** Shared world lore lives once in a **universe book** that every member character
   **links** to; a character's own lore stays in its **personal book** (or card), which the plugin
   never authors. No duplicated shared lore.
2. **The plugin authors the universe book only.** A character's core — description, personality,
   scenario — is already always in-context from the card, so the plugin does not generate per-character
   lore.
3. **Characters only, never personas.** Personas are the user's own identity; they are never detected,
   linked, or written to. This is also what dissolves the "character I play across every universe"
   problem — that entity is a persona, so it's simply out of scope, and crossovers resolve naturally
   because each *character* brings its own universe book.

## Alternatives considered

- **Per-character copies kept in sync** — redundant, and reconciling copies is the hardest, most
  bug-prone version of the whole project. Rejected.
- **One shared book holding everything (incl. per-character facts)** — bloats every member's context
  with others' details. Rejected.
- **Also authoring personal books** — narrow value (the card is already in-context) and real risk of
  clobbering user-authored lore. Deferred/rejected for v1.
- **Acting on personas too** — breaks the model (a persona has no single universe) and touches the
  user's own identity data. Rejected.

## Consequences

- "Sync" means one honest thing: maintain the single shared universe book.
- Group-chat crossovers need no special handling — ST merges each present character's linked book.
- Original/multiversal characters (see [ADR-0003](./0003-franchise-detection.md)) simply get no book.
