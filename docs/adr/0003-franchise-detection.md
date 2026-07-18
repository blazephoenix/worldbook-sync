# ADR-0003 — Franchise detection: LLM identify + cache, confirm once

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

The plugin must decide which franchise a character belongs to (v1 handles recognizable franchises, not
original settings — see [ADR-0002](./0002-scope-universe-books.md)). For a named IP, "do two characters
share a universe?" reduces to "same canonical franchise name?" — no fuzzy overlap analysis. Detection
can be wrong, and some characters have no franchise or no fixed one.

## Decision

- **LLM identification, cached.** One cheap LLM call per character (name + description + tags →
  canonical franchise name / *original* / *multiversal*), cached in extension storage so it's a
  one-time cost. Tags are a hint, not the verdict; the LLM also handles canonicalization
  ("The Witcher 3" → "The Witcher").
- **Confirm once, then remember.** On first engage, show the guess and offer Confirm / Change /
  Original / Multiversal. One tap, cached forever after — seamless from the second engage on. This same
  prompt handles wrong guesses *and* franchise-less characters.
- A **registry** in storage maps canonical name → universe book file so aliases collapse to one book.

## Alternatives considered

- **Keyword/tag matching only** — needs a forever-growing franchise+alias table and silently fails on
  untagged cards. Franchises are exactly where an LLM beats a keyword table. Rejected.
- **Hybrid gate** (tag lookup first, LLM on miss) — a reasonable cost optimization, but still requires
  maintaining a franchise list plus gating logic. Deferred; can be layered on later.
- **Auto-apply with undo** / **confidence-gated** — a wrong guess auto-builds and links a whole wrong
  book before the user can weigh in; confidence-gating leans on unreliable self-reported confidence.
  Rejected in favor of the one-tap confirm.

## Consequences

- Detection is a one-time, low-cost, user-confirmed step per character.
- The confirm prompt is the single choke point for correctness and for the no-franchise cases.
