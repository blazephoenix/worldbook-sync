# ADR-0008 — Story-aware lore: a separate per-chat book

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** blazephoenix

## Context

Beyond chat-blind franchise canon, the user wants their roleplay — persona actions — to affect
lore: "my actions change the course of the story and affect lore." This collides with
[ADR-0002](./0002-scope-universe-books.md): the universe book is **shared, stable, cross-character
canon**, but story-driven lore is inherently **per-playthrough**. Letting a chat rewrite the shared
book would leak one playthrough into every other character and every future chat.

Two host facts shape the options: SillyTavern has a **Chat Lore** scope (a book bound to a single
conversation via `chatMetadata['world_info']`), and it inserts *ahead* of character/global lore.
`generateRaw` generates without chat context; `generateQuietPrompt` generates with it.

## Decision

- **One-shot, on demand.** A distinct **"Update this chat's story lore"** action — not background
  auto-evolution. The user controls when it runs.
- **A separate per-chat book.** Story lore is written to a Chat Lore book bound to the current
  conversation; the shared universe book is never touched by it. Precedence falls out for free —
  Chat Lore inserts ahead of the canon book, so a story entry overrides canon on the same keyword.
- **Two paths, two generation modes.** Canon (detection + build/regenerate) uses **chat-blind
  `generateRaw`**; the story action uses **`generateQuietPrompt`**, which sees the ongoing chat. This
  also resolves the earlier privacy concern: canon never sees your roleplay.
- **What it captures:** durable world-state changes & events, plus the player character's standing
  (reputation, bonds, grudges). Not passing scene detail; does not restate canon.
- **Entry policy:** the same keyword-triggered concise prose as canon (ADR-0005).
- **Reuses the safety machinery:** plugin-ownership + hash-based edit-preservation + pre-rewrite
  backup, keyed by the chat-book name. **An empty generation is a no-op** — nothing notable happened,
  so an existing story book is never wiped.

## Alternatives considered

- **Write the shared universe book** — pollutes canon for every character/chat. Rejected.
- **Per-character book** — still bleeds one playthrough into another. Rejected.
- **Living/auto-evolving lore** (background capture as you play) — much larger; needs triggers and
  change-detection. Deferred.
- **Always-on / hybrid activation** for story entries — the user chose all keyword-triggered for
  context economy and consistency with canon, accepting that the model may drift toward stock canon
  between keyword hits.

## Consequences

- Two clearly-named actions targeting two different books; no hidden mode-flag.
- Story lore is scoped to the conversation and layered over canon by ST's insertion order.
- Keyed-only story entries surface only when their subject is named — the accepted tradeoff.
