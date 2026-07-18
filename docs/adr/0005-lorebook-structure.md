# ADR-0005 — Lorebook structure: atomic keyword-only entries, concise prose, focused core

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

How a universe book is structured decides both quality and how much context it consumes. Community
guidance and the official docs converge on some points and genuinely disagree on others. Settled by the
sources (not open): one concept per entry is the base unit (a single "whole setting" block is an
explicit anti-pattern); keyword matching is preferred over vector/embedding activation for predictable
results; there is no documented per-entry length limit — the token budget governs scale.

## Decision

- **Atomic, keyword-triggered entries, no always-on primer.** Every concept is its own
  keyword-triggered entry; nothing is injected unconditionally. This fits franchises-first: the model
  already knows the setting, so the book's job is to pin canon on demand, not to teach the world — and
  it keeps per-message context cost at zero until a keyword fires.
- **Concise prose** for entry content — readable, low risk of formatting leaking into replies, portable
  across models including small local ones.
- **Focused core (~8–15 entries)** on the first pass — major factions, key locations, central
  characters, core tech/rules; the canon the model holds solidly. Depth is a correctness dial: deeper
  asks invite hallucinated "canon." Growable via Regenerate.
- **Keyword quality is load-bearing** for a primer-less book, so two defaults are baked in: generate
  rich key sets (proper nouns, synonyms, plurals — not generic words), and enable ST's "scan character
  definitions" so entries can fire from the card's own text, not only from what the user types.

## Alternatives considered

- **Constant primer + keyed details** — the most commonly recommended shape, but the always-on primer
  spends context every message and is largely redundant when the model already knows the franchise.
  Rejected for v1 given the franchises-first premise.
- **Interlinked bible (recursion)** — rich, but recursion can cascade and eat budget, needs careful
  bounding, and is the hardest for an LLM to generate correctly. Deferred to v2.
- **Monolithic dump** — an explicit anti-pattern. Rejected.
- **PList / in-voice (Ali:Chat) content** — PList is terser but risks bracket leakage and is finicky on
  small models; in-voice suits character voice, not impersonal world lore. Rejected.
- **Vector/embedding activation** — the docs advise against it for predictable results. Rejected.

## Consequences

- Zero baseline context cost; entries earn their place only if their keys realistically appear.
- Under-triggering is the failure mode to watch; the key-quality and scan-definitions defaults mitigate it.
