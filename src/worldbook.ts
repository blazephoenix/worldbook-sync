import type { GeneratedEntry } from './generation';
import { generateUniverseEntries } from './generation';
import { getCreateEntry, getLinkAux } from './host';
import { hashContent, planRegeneration } from './ownership';
import { persistSettings, type Settings } from './settings';

/**
 * The World Info field policy for a plugin-authored entry (ADR-0005):
 * keyword-triggered (not constant, not vectorized), whole-word matching, enabled,
 * and set to also match the character's own card text so entries fire without the
 * user typing a keyword.
 *
 * Pure — returns the fields to merge onto an entry created via the host's
 * `createWorldInfoEntry` (which assigns the uid and other defaults).
 */
export function entryFieldsFor(gen: GeneratedEntry): Partial<STWorldInfoEntry> {
  return {
    key: [...gen.keys],
    keysecondary: [],
    comment: gen.title,
    content: gen.content,
    constant: false,
    vectorized: false,
    selective: false,
    disable: false,
    matchWholeWords: true,
    order: 100,
    position: 0,
    probability: 100,
    useProbability: false,
    // Also scan the character's own card text (ADR-0005) so entries can fire from it.
    matchCharacterDescription: true,
    matchCharacterPersonality: true,
    matchScenario: true,
  };
}

/** Ensure a world book exists on the backend. Returns true if it already existed. */
export async function ensureBook(ctx: SillyTavernContext, bookName: string): Promise<boolean> {
  const names = ctx.getWorldInfoNames?.() ?? [];
  if (names.includes(bookName)) return true;
  await ctx.saveWorldInfo(bookName, { entries: {} }, true);
  await ctx.updateWorldInfoList();
  return false;
}

/** Link a book to a character as an auxiliary (extra) book. Returns false if unavailable. */
export async function linkAuxBook(
  ctx: SillyTavernContext,
  characterAvatar: string,
  bookName: string,
): Promise<boolean> {
  const linkAux = await getLinkAux(ctx);
  if (!linkAux) {
    toastr.warning(
      `Couldn't auto-link "${bookName}". Link it to this character manually via the globe menu.`,
      'Worldbook Sync',
    );
    return false;
  }
  // charUpdateAddAuxWorld expects the raw avatar key (with extension); it strips it internally.
  await linkAux(characterAvatar, bookName);
  return true;
}

/** Snapshot a book into settings before a rewrite, for recovery (ADR-0004). */
async function backupBook(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
): Promise<void> {
  const data = await ctx.loadWorldInfo(bookName);
  if (!data) return;
  settings.backups[bookName] = { data: structuredClone(data), at: Date.now() };
}

/** Create WI entries from generated lore, recording ownership hashes. Returns entries added. */
async function appendEntries(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  data: STWorldInfoData,
  gen: GeneratedEntry[],
): Promise<number> {
  const createEntry = await getCreateEntry(ctx);
  if (!createEntry) {
    throw new Error('createWorldInfoEntry is unavailable (world-info.js import failed)');
  }
  const owned = settings.ownership[bookName] ?? (settings.ownership[bookName] = {});
  let added = 0;
  for (const g of gen) {
    const entry = createEntry(bookName, data);
    if (!entry) continue;
    Object.assign(entry, entryFieldsFor(g));
    entry.addMemo = true; // show the title/comment in the WI editor
    owned[String(entry.uid)] = hashContent(g.content);
    added++;
  }
  return added;
}

/** Content-only view of a book's entries, for regeneration planning. */
function contentMap(entries: Record<string, STWorldInfoEntry>): Record<string, { content: string }> {
  const out: Record<string, { content: string }> = {};
  for (const [uid, entry] of Object.entries(entries)) {
    out[uid] = { content: String(entry.content ?? '') };
  }
  return out;
}

/** First-time fill of a (typically empty) universe book. Returns entries added. */
export async function buildBook(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  franchiseDisplay: string,
  depth: number,
): Promise<number> {
  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  await backupBook(ctx, settings, bookName);
  const data = (await ctx.loadWorldInfo(bookName)) ?? { entries: {} };
  const added = await appendEntries(ctx, settings, bookName, data, gen);
  await ctx.saveWorldInfo(bookName, data);
  ctx.reloadWorldInfoEditor?.(bookName);
  persistSettings(ctx);
  return added;
}

/**
 * Rewrite a book while preserving user work (ADR-0004): only plugin-owned,
 * unchanged entries are replaced; user-added and user-edited entries stay.
 * Returns the number of freshly generated entries.
 */
export async function regenerateBook(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  franchiseDisplay: string,
  depth: number,
): Promise<number> {
  const createEntry = await getCreateEntry(ctx);
  if (!createEntry) {
    throw new Error('createWorldInfoEntry is unavailable (world-info.js import failed)');
  }
  const data = await ctx.loadWorldInfo(bookName);
  if (!data) throw new Error(`Universe book not found: ${bookName}`);

  await backupBook(ctx, settings, bookName);

  const owned = settings.ownership[bookName] ?? {};
  const plan = planRegeneration(owned, contentMap(data.entries));

  // Remove only owned, unchanged entries; user additions/edits are left untouched.
  for (const uid of plan.removableUids) delete data.entries[uid];

  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  const nextOwned: Record<string, string> = {};
  for (const g of gen) {
    const entry = createEntry(bookName, data);
    if (!entry) continue;
    Object.assign(entry, entryFieldsFor(g));
    entry.addMemo = true;
    nextOwned[String(entry.uid)] = hashContent(g.content);
  }
  // Released (user-edited) and vanished entries drop out of ownership; user entries were never in it.
  settings.ownership[bookName] = nextOwned;

  await ctx.saveWorldInfo(bookName, data);
  ctx.reloadWorldInfoEditor?.(bookName);
  persistSettings(ctx);
  return gen.length;
}

/** Restore the last snapshot of a book, if one exists. */
export async function restoreBackup(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
): Promise<boolean> {
  const backup = settings.backups[bookName];
  if (!backup) return false;
  await ctx.saveWorldInfo(bookName, structuredClone(backup.data), true);
  ctx.reloadWorldInfoEditor?.(bookName);
  return true;
}
