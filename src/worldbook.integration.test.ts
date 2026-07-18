import { describe, it, expect, beforeEach } from 'vitest';
import { buildBook, regenerateBook, ensureChatBook, updateStoryLore } from './worldbook';
import { mergeSettings, type Settings } from './settings';
import type { GeneratedEntry } from './generation';

/**
 * End-to-end checks of the ADR-0004 promise (regenerate preserves user work) and the
 * ADR-0008 story path (per-chat book + empty-result no-op).
 *
 * A fake context supplies createWorldInfoEntry, so getHostFns never imports world-info.js.
 * The same context object is reused across tests to keep host.ts's module cache valid.
 */

const worlds = new Map<string, STWorldInfoData>();
const chatMetadata: Record<string, unknown> = {};
let uidCounter = 0;
let genResponse: GeneratedEntry[] = [];

function fullEntry(uid: number): STWorldInfoEntry {
  return {
    uid,
    key: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    vectorized: false,
    selective: false,
    selectiveLogic: 0,
    order: 100,
    position: 0,
    disable: false,
    excludeRecursion: false,
    preventRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: '',
    matchWholeWords: null,
    caseSensitive: null,
    automationId: '',
    role: null,
  };
}

const ctx = {
  getWorldInfoNames: () => [...worlds.keys()],
  loadWorldInfo: async (name: string) =>
    worlds.has(name) ? structuredClone(worlds.get(name)!) : null,
  saveWorldInfo: async (name: string, data: STWorldInfoData) => {
    worlds.set(name, structuredClone(data));
  },
  updateWorldInfoList: async () => {},
  reloadWorldInfoEditor: () => {},
  saveSettingsDebounced: () => {},
  createWorldInfoEntry: (_name: string, data: STWorldInfoData) => {
    const uid = uidCounter++;
    const entry = fullEntry(uid);
    data.entries[String(uid)] = entry;
    return entry;
  },
  // Canon path is chat-blind; story path sees the chat. Both return the canned response here.
  generateRaw: async () => JSON.stringify(genResponse),
  generateQuietPrompt: async () => JSON.stringify(genResponse),
  getCurrentChatId: () => 'test-chat-1',
  chatMetadata,
  saveMetadata: async () => {},
} as unknown as SillyTavernContext;

const BOOK = 'Universe - Test';
let settings: Settings;

beforeEach(() => {
  worlds.clear();
  for (const k of Object.keys(chatMetadata)) delete chatMetadata[k];
  uidCounter = 0;
  settings = mergeSettings({});
});

describe('canon build → user-edit → regenerate', () => {
  it('preserves user additions and in-place edits while replacing untouched plugin entries', async () => {
    genResponse = [
      { title: 'A', keys: ['a'], content: 'alpha' },
      { title: 'B', keys: ['b'], content: 'beta' },
      { title: 'C', keys: ['c'], content: 'gamma' },
    ];
    const added = await buildBook(ctx, settings, BOOK, 'Test', 3);
    expect(added).toBe(3);
    expect(Object.keys(settings.ownership[BOOK]!)).toHaveLength(3);

    const data = (await ctx.loadWorldInfo(BOOK))!;
    data.entries['1']!.content = 'EDITED BY USER';
    data.entries['999'] = { ...fullEntry(999), key: ['u'], content: 'USER LORE', comment: 'mine' };
    await ctx.saveWorldInfo(BOOK, data);

    genResponse = [
      { title: 'D', keys: ['d'], content: 'delta' },
      { title: 'E', keys: ['e'], content: 'epsilon' },
    ];
    await regenerateBook(ctx, settings, BOOK, 'Test', 2);

    const after = (await ctx.loadWorldInfo(BOOK))!;
    const contents = Object.values(after.entries).map((e) => e.content);
    expect(after.entries['999']?.content).toBe('USER LORE');
    expect(after.entries['1']?.content).toBe('EDITED BY USER');
    expect(after.entries['0']).toBeUndefined();
    expect(after.entries['2']).toBeUndefined();
    expect(contents).toContain('delta');
    expect(contents).toContain('epsilon');
    const owned = settings.ownership[BOOK]!;
    expect(Object.keys(owned)).toHaveLength(2);
    expect(owned['1']).toBeUndefined();
    expect(owned['999']).toBeUndefined();
  });

  it('snapshots the book before a rewrite so it can be restored', async () => {
    genResponse = [{ title: 'A', keys: ['a'], content: 'alpha' }];
    await buildBook(ctx, settings, BOOK, 'Test', 1);
    genResponse = [{ title: 'B', keys: ['b'], content: 'beta' }];
    await regenerateBook(ctx, settings, BOOK, 'Test', 1);
    expect(settings.backups[BOOK]).toBeDefined();
    const snapContents = Object.values(settings.backups[BOOK]!.data.entries).map((e) => e.content);
    expect(snapContents).toContain('alpha');
  });
});

describe('story path (per-chat book)', () => {
  it('creates and binds a chat-scoped book', async () => {
    const name = await ensureChatBook(ctx);
    expect(name).toBe('Story Lore - test-chat-1');
    expect(chatMetadata['world_info']).toBe(name);
    expect(worlds.has(name!)).toBe(true);
  });

  it('writes story entries to the chat book', async () => {
    const name = (await ensureChatBook(ctx))!;
    genResponse = [{ title: 'Arasaka fell', keys: ['Arasaka'], content: 'Razed by the player.' }];
    const n = await updateStoryLore(ctx, settings, name, 'Cyberpunk 2077', 15);
    expect(n).toBe(1);
    const book = (await ctx.loadWorldInfo(name))!;
    expect(Object.values(book.entries).map((e) => e.content)).toContain('Razed by the player.');
  });

  it('is a no-op when nothing notable happened (empty result never wipes the book)', async () => {
    const name = (await ensureChatBook(ctx))!;
    genResponse = [{ title: 'Arasaka fell', keys: ['Arasaka'], content: 'Razed by the player.' }];
    await updateStoryLore(ctx, settings, name, 'Cyberpunk 2077', 15);

    genResponse = []; // model reports nothing new
    const n = await updateStoryLore(ctx, settings, name, 'Cyberpunk 2077', 15);
    expect(n).toBe(0);
    const book = (await ctx.loadWorldInfo(name))!;
    expect(Object.keys(book.entries)).toHaveLength(1); // prior entry survives
  });
});
