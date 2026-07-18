# ADR-0007 — Never write to character cards; all metadata in extension storage

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

The plugin must remember things: each character's detection **verdict**, which entries it **owns**,
per-entry content **hashes** for edit-detection (see [ADR-0004](./0004-book-ownership-and-rewrite.md)),
and the franchise→book **registry**. That memory can live on the character card (the card spec's
`data.extensions.<tool>` field is sanctioned for exactly this and would travel with the card) or in the
extension's own storage. Character cards are user data, and many users object to any plugin modifying
their cards.

## Decision

The plugin writes **only** to the universe books it manages and to its **own extension storage**.
Character cards and personas are **never** modified. All plugin memory — verdicts, entry ownership,
hashes, the registry — lives in extension storage.

## Alternatives considered

- **Cache the verdict on the card** (`data.extensions.<tool>`) — portable and spec-legal, and it would
  survive reinstalls, but it modifies the user's card file and still needs plugin storage for the
  hashes/registry anyway. Rejected to keep a clean "never touches cards" invariant.
- **Hybrid** (verdict on card, rest in storage) — best portability, but still writes to cards and adds
  moving parts. Rejected for the same reason.

## Consequences

- A clean, trustworthy invariant: the plugin cannot corrupt a card or persona.
- Verdicts are **local** — a card moved to another install is re-detected — and are keyed by avatar
  filename, so a rename loses the cached verdict. Accepted as the cost of not touching cards.
