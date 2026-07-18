# Worldbook Sync

A [SillyTavern](https://github.com/SillyTavern/SillyTavern) extension that detects which
**franchise** a character belongs to and maintains a shared **universe book** of that franchise's
lore — created once and linked across every character in it, so a world's lore lives in one place
instead of being duplicated or missing per character.

See [`CONTEXT.md`](./CONTEXT.md) for the design and [`docs/adr/`](./docs/adr/) for the decisions
behind it.

## What it does

When you open a character, Worldbook Sync:

1. **Detects its franchise** with one LLM call (name + description + tags), on your own configured
   connection. The result is cached, so it's a one-time cost per character.
2. **Asks you to confirm** the detected franchise once — you can accept it, correct it, or mark the
   character as *original* (no franchise) or *multiversal*. Personas are never touched.
3. **Links a shared universe book** for that franchise to the character (as an auxiliary book — your
   character's own primary lorebook is left alone).
4. Optionally **builds** the universe book — a focused core of ~8–15 concise, keyword-triggered lore
   entries — either automatically (if you enable it) or when you click **Build**.

Regenerating a book **preserves your edits**: entries you added, or plugin entries you changed in
place, are detected and kept; only untouched plugin entries are replaced. Every rewrite is snapshotted
first so it can be restored.

## Requirements

- A recent SillyTavern (staging-era World Info APIs).
- A configured LLM connection (the extension uses your active connection).

## Install

In SillyTavern: **Extensions → Install extension**, and paste this repo's git URL. The built
`index.js` is committed, so no build step is needed to install.

## Usage

Open the **Worldbook Sync** panel in the Extensions settings drawer:

- **Enabled** — master switch for the automatic on-open behavior.
- **Auto-build a universe book on first engage** — off by default. When off, the book is created and
  linked but stays empty until you click Build (so no LLM generation fires unless you ask).
- **Book depth** — target entry count for a build (default 12).
- **Re-detect franchise** — re-run detection + confirm for the open character.
- **Build / regenerate book** — build the open character's universe book, or regenerate it
  (preserving your edits) if it already has content.
- **Restore last backup** — roll back the last rewrite of the open character's book.

## How it works

- Universe lore only — never per-character lore (your card is already always in-context).
- Entries are atomic and **keyword-triggered** (no always-on primer, no vector activation), written as
  concise prose, with whole-word matching and character-definition scanning enabled so they fire even
  from the card's own text.
- All plugin state (detection verdicts, entry ownership + content hashes, the franchise→book registry,
  backups) lives in the extension's own settings. **The plugin never writes to character cards.**

## Limitations (v1)

- **Franchises only.** Original/invented settings get an "original" verdict and no book.
- **Group chats** aren't part of the automatic on-open flow yet — engage each character solo to link
  its book (they then combine automatically in a group).
- **Connection profile** selection isn't wired yet; the active connection is used. (The setting is
  reserved for a later version.)

## Development

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm test            # vitest (pure logic + the regenerate integration test)
pnpm run build       # esbuild → index.js (committed)
pnpm run watch       # rebuild on change
pnpm run check       # typecheck + test + build
```

Pure logic (detection/generation parsing, canonicalization, edit-detection, book naming, settings) is
test-driven. The SillyTavern glue is compile-checked and, for the safety-critical regenerate path,
covered by an integration test with a fake host; runtime behavior is verified inside SillyTavern.
