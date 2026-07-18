import { describe, it, expect, beforeEach } from 'vitest';
import { buildBook, regenerateBook } from './worldbook';
import { mergeSettings, type Settings } from './settings';
import type { GeneratedEntry } from './generation';

/**
 * End-to-end check of the ADR-0004 promise: regenerate replaces only the plugin's
 * unchanged entries and preserves user additions and in-place edits.
 *
 * A fake context supplies createWorldInfoEntry, so getHostFns never imports world-info.js.
 * The same context object is reused across tests to keep getHostFns' internal cache valid.
 */

const worlds = new Map<string, STWorldInfoData>();
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
  generateQuietPrompt: async () => JSON.stringify(genResponse),
} as unknown as SillyTavernContext;

const BOOK = 'Universe - Test';
let settings: Settings;

beforeEach(() => {
  worlds.clear();
  uidCounter = 0;
  settings = mergeSettings({});
});

describe('build → user-edit → regenerate', () => {
  it('preserves user additions and in-place edits while replacing untouched plugin entries', async () => {
    genResponse = [
      { title: 'A', keys: ['a'], content: 'alpha' },
      { title: 'B', keys: ['b'], content: 'beta' },
      { title: 'C', keys: ['c'], content: 'gamma' },
    ];
    const added = await buildBook(ctx, settings, BOOK, 'Test', 3);
    expect(added).toBe(3);
    expect(Object.keys(settings.ownership[BOOK]!)).toHaveLength(3);

    // User edits one plugin entry (uid 1) in place and adds their own entry (uid 999).
    const data = (await ctx.loadWorldInfo(BOOK))!;
    data.entries['1']!.content = 'EDITED BY USER';
    data.entries['999'] = { ...fullEntry(999), key: ['u'], content: 'USER LORE', comment: 'mine' };
    await ctx.saveWorldInfo(BOOK, data);

    // Regenerate with a fresh (different-sized) generation.
    genResponse = [
      { title: 'D', keys: ['d'], content: 'delta' },
      { title: 'E', keys: ['e'], content: 'epsilon' },
    ];
    await regenerateBook(ctx, settings, BOOK, 'Test', 2);

    const after = (await ctx.loadWorldInfo(BOOK))!;
    const contents = Object.values(after.entries).map((e) => e.content);

    // User work survives.
    expect(after.entries['999']?.content).toBe('USER LORE');
    expect(after.entries['1']?.content).toBe('EDITED BY USER');
    // Untouched plugin entries (uid 0, 2) were replaced.
    expect(after.entries['0']).toBeUndefined();
    expect(after.entries['2']).toBeUndefined();
    // Fresh entries were added.
    expect(contents).toContain('delta');
    expect(contents).toContain('epsilon');
    // Ownership now covers exactly the two fresh entries — not the edited or user ones.
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
    // The snapshot is the pre-regenerate state (contains 'alpha').
    const snapshot = settings.backups[BOOK]!.data;
    const snapContents = Object.values(snapshot.entries).map((e) => e.content);
    expect(snapContents).toContain('alpha');
  });
});
