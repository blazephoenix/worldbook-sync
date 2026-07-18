import type { GeneratedEntry } from './generation';
import { generateStoryEntries, generateUniverseEntries } from './generation';
import { getCreateEntry, getLinkAux } from './host';
import { hashContent, planRegeneration } from './ownership';
import { persistSettings, type Settings } from './settings';

/** chat_metadata key holding a chat's bound world name (world-info.js: METADATA_KEY). */
const CHAT_BOOK_METADATA_KEY = 'world_info';

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

/**
 * Get-or-create the current chat's bound Chat Lore book and return its name, or null if
 * no chat is open. Binds via chatMetadata['world_info'] + saveMetadata (mirrors ST's
 * /getchatbook), so the book applies only to this conversation.
 */
export async function ensureChatBook(ctx: SillyTavernContext): Promise<string | null> {
  const chatId = ctx.getCurrentChatId?.() ?? ctx.chatId;
  if (!chatId) return null;

  const names = ctx.getWorldInfoNames?.() ?? [];
  const bound = ctx.chatMetadata?.[CHAT_BOOK_METADATA_KEY];
  if (typeof bound === 'string' && bound && names.includes(bound)) return bound;

  const safeId = String(chatId).replace(/[^a-z0-9 -]/gi, '_').replace(/_{2,}/g, '_').slice(0, 48);
  const name = `Story Lore - ${safeId}`;
  if (!names.includes(name)) {
    await ctx.saveWorldInfo(name, { entries: {} }, true);
    await ctx.updateWorldInfoList();
  }
  ctx.chatMetadata[CHAT_BOOK_METADATA_KEY] = name;
  await ctx.saveMetadata();
  return name;
}

/** Content-only view of a book's entries, for regeneration planning. */
function contentMap(entries: Record<string, STWorldInfoEntry>): Record<string, { content: string }> {
  const out: Record<string, { content: string }> = {};
  for (const [uid, entry] of Object.entries(entries)) {
    out[uid] = { content: String(entry.content ?? '') };
  }
  return out;
}

/**
 * Apply a fresh set of generated entries to a book while preserving user work (ADR-0004):
 * snapshot for recovery, then replace only plugin-owned, unchanged entries — user additions
 * and in-place edits are left intact. Shared by the canon and story paths. Returns entries added.
 */
async function applyGeneratedEntries(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  gen: GeneratedEntry[],
): Promise<number> {
  const createEntry = await getCreateEntry(ctx);
  if (!createEntry) {
    throw new Error('createWorldInfoEntry is unavailable (world-info.js import failed)');
  }

  const data = (await ctx.loadWorldInfo(bookName)) ?? { entries: {} };
  settings.backups[bookName] = { data: structuredClone(data), at: Date.now() };

  const owned = settings.ownership[bookName] ?? {};
  const plan = planRegeneration(owned, contentMap(data.entries));
  for (const uid of plan.removableUids) delete data.entries[uid];

  const nextOwned: Record<string, string> = {};
  let added = 0;
  for (const g of gen) {
    const entry = createEntry(bookName, data);
    if (!entry) continue;
    Object.assign(entry, entryFieldsFor(g));
    entry.addMemo = true; // show the title/comment in the WI editor
    nextOwned[String(entry.uid)] = hashContent(g.content);
    added++;
  }
  // Released (user-edited) and vanished entries drop out of ownership; user entries were never in it.
  settings.ownership[bookName] = nextOwned;

  await ctx.saveWorldInfo(bookName, data);
  ctx.reloadWorldInfoEditor?.(bookName);
  persistSettings(ctx);
  return added;
}

/** First-time fill of a universe book from chat-blind franchise canon. Returns entries added. */
export async function buildBook(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  franchiseDisplay: string,
  depth: number,
): Promise<number> {
  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  return applyGeneratedEntries(ctx, settings, bookName, gen);
}

/**
 * Rewrite a universe book from fresh canon while preserving user work (ADR-0004).
 * Returns the number of freshly generated entries.
 */
export async function regenerateBook(
  ctx: SillyTavernContext,
  settings: Settings,
  bookName: string,
  franchiseDisplay: string,
  depth: number,
): Promise<number> {
  const gen = await generateUniverseEntries(ctx, franchiseDisplay, depth);
  return applyGeneratedEntries(ctx, settings, bookName, gen);
}

/**
 * Update the per-chat story book from the ongoing roleplay (ADR-0008). Uses chat-aware
 * generation. An empty result is a no-op — nothing notable happened, so we never wipe an
 * existing story book. Returns entries written (0 if unchanged).
 */
export async function updateStoryLore(
  ctx: SillyTavernContext,
  settings: Settings,
  chatBookName: string,
  franchiseDisplay: string,
  softCap: number,
): Promise<number> {
  const gen = await generateStoryEntries(ctx, franchiseDisplay, softCap);
  if (gen.length === 0) return 0; // nothing to record; leave the book as-is
  return applyGeneratedEntries(ctx, settings, chatBookName, gen);
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
