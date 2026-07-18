# worldbook-sync — Context

A client-side **SillyTavern extension** that detects which **franchise** a character belongs to and
maintains a shared **universe book** of that franchise's lore, automatically linked across every
character in it. Its job is consistency: one place for a world's lore, reused by every character who
lives in that world, instead of duplicated-or-missing per character.

This file is the ubiquitous language and the design at a glance. Each consequential decision has its
own record under [`docs/adr/`](./docs/adr/); read those for the *why* and the alternatives weighed.

## Ubiquitous language

Use these terms exactly; don't drift to synonyms.

- **Character** — an AI character *card* (the bot you chat with). The only thing the plugin acts on.
- **Persona** — the *user's own* identity in a chat. Explicitly **out of scope** — never detected,
  linked, or written to. (A "character I play across every universe" is a persona.)
- **Franchise** — a recognizable existing IP (Cyberpunk 2077, the Nasuverse, Star Wars). The unit a
  universe is keyed on. v1 handles franchises only, not original/invented settings.
- **Universe book** — the shared World Info file holding one franchise's world lore. Plugin-managed.
  Every member character links it as an **auxiliary book**.
- **Personal book** — a character's own lore (their primary linked world / embedded `character_book`).
  The user's domain; the plugin never authors or edits it.
- **Verdict** — the cached detection result for a character: a canonical franchise name, or
  **original** (no franchise), or **multiversal** (no fixed franchise). Both non-franchise verdicts
  mean "no auto book."
- **Canonical name** — the normalized franchise name ("The Witcher 3" and "Witcher" → one name), used
  as the key into the **registry** that maps a franchise to its book file.
- **Owned entry** — a World Info entry the plugin created. The plugin marks it and stores a content
  **hash**; on rewrite it touches only entries whose hash still matches.
- **Engage** — the trigger moment (a character is selected / a chat with it is opened).
- **Auto-build flag** — setting; whether a missing universe book is generated automatically on first
  engage (default **OFF**) or only on an explicit button.
- **Regenerate** — an explicit rewrite of a universe book that preserves user additions and in-place
  edits via hash-based edit-detection.

## Architecture at a glance

- **Form:** a client-side SillyTavern **Extension** (not a server plugin). Everything it needs —
  reading all characters, reading/writing World Info, calling the LLM on the user's own connection —
  is reachable from `SillyTavern.getContext()` in the browser. See [ADR-0001](./docs/adr/0001-client-side-extension.md).
- **Stack:** TypeScript, bundled with esbuild to a committed `dist` that `manifest.json` loads;
  installed via git URL. See [ADR-0006](./docs/adr/0006-typescript-esbuild-build.md).
- **Data boundary:** the plugin writes **only** to the universe books it manages and to its own
  extension storage. Character cards and personas are never modified. All memory (verdicts, entry
  ownership, hashes, the franchise→book registry) lives in extension storage.
  See [ADR-0007](./docs/adr/0007-never-write-character-cards.md).

## Core loop — on **engage**

1. **Persona → stop.** The plugin acts on characters only.
2. **No cached verdict?** One cheap LLM call identifies the franchise from name + description + tags,
   returning a canonical franchise / *original* / *multiversal*. A **confirm-once** prompt
   (Confirm / Change / Original / Multiversal) records the verdict in storage.
   See [ADR-0003](./docs/adr/0003-franchise-detection.md).
3. **Franchise verdict →** find-or-create that franchise's universe book via the registry and link it
   as an **auxiliary book** (never overwriting the character's primary world). *Original / multiversal*
   → no book; the user wires those by hand per chat.
4. **Building** obeys the auto-build flag: ON builds once, hands-free; OFF links now, builds on a
   button. Existing books are **never auto-rewritten** — Regenerate is always explicit.
   See [ADR-0002](./docs/adr/0002-scope-universe-books.md) and [ADR-0004](./docs/adr/0004-book-ownership-and-rewrite.md).

## The universe book

- **Universe lore only** — never per-character lore (the card is already always in-context).
- **Focused core (~8–15 entries)** on the first pass — the canon the model knows solidly; growable
  via Regenerate. Depth is a correctness dial as much as a cost one: deeper asks invite hallucinated
  "canon." See [ADR-0005](./docs/adr/0005-lorebook-structure.md).
- **Atomic, keyword-triggered entries, no always-on primer**, written as **concise prose**. Rich key
  sets (proper nouns, synonyms, plurals), whole-word matching, and ST's "scan character definitions"
  enabled so entries fire even from the card's own text.

## Ownership & safety

- The plugin **owns** its entries but respects your fingerprints: Regenerate rewrites only entries
  whose stored hash still matches, so anything you **added** (untagged) or **edited in place** (hash
  mismatch) survives.
- A book is **snapshotted before any rewrite** for recoverability.

## Crossovers, for free

Each character carries its own auxiliary universe book, so a group chat spanning two franchises simply
merges both books via ST's normal order-sorted World Info. No special crossover machinery.

## Out of scope / deferred

- **Original (non-franchise) settings** — v1 is franchises-only; originals get a "none" verdict and no book.
- **Personas** — never touched, by design.
- **Personal-book authoring** — the plugin never writes a character's own lore.
- **Recursion / interlinked entries** — deferred to v2 (cascade risk, hard to auto-generate correctly).
- **Vector/embedding activation** — rejected; the docs advise keyword matching for predictable results.

## Implementation notes (resolved during the build)

- **"Engage" binds to the `CHAT_CHANGED` event.** There is no `CHARACTER_SELECTED` event; `CHAT_CHANGED`
  fires for both solo and group chats, and the active character is read from the context in the handler.
- **Ownership lives in extension storage, not on entries.** Each book has a `{ uid → content hash }` map
  in settings; nothing is written onto the entries themselves, keeping them clean and honoring ADR-0007.
- **Entry creation and aux-book linking come from `world-info.js`**, imported lazily and guarded — they
  aren't on the stable `getContext()` surface. Book creation and everything else use the context API.
- **Entries also match the card's own text** (`matchCharacterDescription`/`Personality`/`Scenario`) so a
  keyword-only book still fires without the user typing a keyword.

## v1 limitations / follow-ups

- **Group chats** aren't in the automatic on-engage flow yet (each character links its book when engaged
  solo; they then combine naturally in a group).
- **Connection-profile selection** is stored but not yet applied — the active connection is used.
- **Recursion / interlinked entries** remain deferred (see [ADR-0005](./docs/adr/0005-lorebook-structure.md)).
