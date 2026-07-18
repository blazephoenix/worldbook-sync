import { canonicalizeFranchise } from './canonical';
import { universeBookName } from './books';
import { detectFranchise } from './detection';
import { loadSettings, persistSettings, type Settings } from './settings';
import { confirmVerdict, renderSettingsPanel, type ConfirmResult, type PanelHandlers } from './ui';
import { buildBook, ensureBook, linkAuxBook, regenerateBook, restoreBackup } from './worldbook';
import type { Verdict } from './types';

const LOG = '[worldbook-sync]';

let busy = false;

/**
 * Always read a FRESH context. getContext() returns a snapshot (characterId/groupId
 * are copied at call time — st-context.js), so a captured context goes stale the moment
 * the user changes chats. Never cache the returned object across events.
 */
function getCtx(): SillyTavernContext {
  return SillyTavern.getContext();
}

/** The solo character currently being played, or null (no selection / group chat). */
function activeCharacter(ctx: SillyTavernContext): STCharacter | null {
  if (ctx.groupId) return null; // group chats are not part of the v1 auto flow
  const id = ctx.characterId;
  if (id === undefined || id === null) return null;
  return ctx.characters[id as number] ?? null;
}

function resultToVerdict(result: ConfirmResult): Verdict | null {
  switch (result.action) {
    case 'franchise':
      return { kind: 'franchise', display: result.display, canonical: canonicalizeFranchise(result.display) };
    case 'original':
      return { kind: 'original' };
    case 'multiversal':
      return { kind: 'multiversal' };
    case 'cancel':
      return null;
  }
}

/** Ensure a confirmed verdict exists for a character, detecting + confirming if needed. */
async function ensureVerdict(
  ctx: SillyTavernContext,
  settings: Settings,
  character: STCharacter,
  forceRedetect = false,
): Promise<Verdict | null> {
  if (!forceRedetect) {
    const cached = settings.verdicts[character.avatar];
    if (cached) return cached.verdict;
  }

  let detected: Verdict;
  try {
    detected = await detectFranchise(ctx, character);
  } catch (error) {
    console.warn(LOG, 'detection failed; defaulting to original', error);
    detected = { kind: 'original' };
  }

  const verdict = resultToVerdict(await confirmVerdict(character.name, detected));
  if (!verdict) return null; // cancelled → don't cache; we'll ask again next engage

  settings.verdicts[character.avatar] = { verdict, confirmedAt: Date.now() };
  persistSettings(ctx);
  return verdict;
}

/** Resolve (find-or-register) the universe book name for a franchise verdict. */
function bookNameFor(settings: Settings, verdict: Verdict): string {
  if (verdict.kind !== 'franchise') throw new Error('bookNameFor: verdict is not a franchise');
  const existing = settings.registry[verdict.canonical];
  if (existing) return existing;
  const name = universeBookName(verdict.display);
  settings.registry[verdict.canonical] = name;
  return name;
}

/** Full engage flow for one character: detect(if needed) → link → optionally build. */
async function processCharacter(
  ctx: SillyTavernContext,
  settings: Settings,
  character: STCharacter,
  forceRedetect = false,
): Promise<void> {
  const verdict = await ensureVerdict(ctx, settings, character, forceRedetect);
  if (!verdict || verdict.kind !== 'franchise') return; // cancelled / original / multiversal → no book

  const bookName = bookNameFor(settings, verdict);
  persistSettings(ctx);

  const existed = await ensureBook(ctx, bookName);
  await linkAuxBook(ctx, character.avatar, bookName);

  if (existed) return; // never auto-rewrite an existing book (ADR-0004)

  if (settings.autoBuild) {
    toastr.info(`Building universe book "${bookName}"…`, 'Worldbook Sync');
    const added = await buildBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
    toastr.success(`Added ${added} lore entries to "${bookName}".`, 'Worldbook Sync');
  } else {
    toastr.info(
      `Linked "${bookName}". Use "Build" in Worldbook Sync settings to fill it.`,
      'Worldbook Sync',
    );
  }
}

function onChatChanged(settings: Settings): void {
  if (!settings.enabled || busy) return;
  const ctx = getCtx();
  const character = activeCharacter(ctx);
  if (!character) return;
  busy = true;
  processCharacter(ctx, settings, character)
    .catch((error) => {
      console.error(LOG, 'processCharacter failed', error);
      toastr.error('Worldbook Sync hit an error — see the console.', 'Worldbook Sync');
    })
    .finally(() => {
      busy = false;
    });
}

/** Run an async panel action guarded against concurrency, with error surfacing. */
async function runAction(label: string, fn: () => Promise<void>): Promise<void> {
  if (busy) {
    toastr.info('Worldbook Sync is busy — try again in a moment.', 'Worldbook Sync');
    return;
  }
  busy = true;
  try {
    await fn();
  } catch (error) {
    console.error(LOG, `${label} failed`, error);
    toastr.error(`${label} failed — see the console.`, 'Worldbook Sync');
  } finally {
    busy = false;
  }
}

function buildHandlers(settings: Settings): PanelHandlers {
  const requireCharacter = (): { ctx: SillyTavernContext; character: STCharacter } | null => {
    const ctx = getCtx();
    const character = activeCharacter(ctx);
    if (!character) {
      toastr.warning('Open a single character first (group chats not supported yet).', 'Worldbook Sync');
      return null;
    }
    return { ctx, character };
  };

  return {
    onEnabledChange: (value) => {
      settings.enabled = value;
      persistSettings(getCtx());
    },
    onAutoBuildChange: (value) => {
      settings.autoBuild = value;
      persistSettings(getCtx());
    },
    onDepthChange: (value) => {
      settings.bookDepth = value;
      persistSettings(getCtx());
    },
    onRedetect: () => {
      const active = requireCharacter();
      if (active) {
        void runAction('Re-detect', () =>
          processCharacter(active.ctx, settings, active.character, true),
        );
      }
    },
    onBuildOrRegenerate: () => {
      const active = requireCharacter();
      if (!active) return;
      const { ctx, character } = active;
      void runAction('Build/regenerate', async () => {
        const verdict = await ensureVerdict(ctx, settings, character);
        if (!verdict || verdict.kind !== 'franchise') {
          toastr.info('No franchise for this character — nothing to build.', 'Worldbook Sync');
          return;
        }
        const bookName = bookNameFor(settings, verdict);
        persistSettings(ctx);
        const existed = await ensureBook(ctx, bookName);
        await linkAuxBook(ctx, character.avatar, bookName);
        const data = await ctx.loadWorldInfo(bookName);
        const hasEntries = existed && data && Object.keys(data.entries).length > 0;
        if (hasEntries) {
          toastr.info(`Regenerating "${bookName}" (your edits are preserved)…`, 'Worldbook Sync');
          const n = await regenerateBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
          toastr.success(`Regenerated "${bookName}" with ${n} entries.`, 'Worldbook Sync');
        } else {
          toastr.info(`Building "${bookName}"…`, 'Worldbook Sync');
          const n = await buildBook(ctx, settings, bookName, verdict.display, settings.bookDepth);
          toastr.success(`Added ${n} entries to "${bookName}".`, 'Worldbook Sync');
        }
      });
    },
    onRestore: () => {
      const active = requireCharacter();
      if (!active) return;
      const { ctx, character } = active;
      void runAction('Restore', async () => {
        const cached = settings.verdicts[character.avatar]?.verdict;
        if (!cached || cached.kind !== 'franchise') {
          toastr.info('No franchise book for this character.', 'Worldbook Sync');
          return;
        }
        const bookName = bookNameFor(settings, cached);
        const restored = await restoreBackup(ctx, settings, bookName);
        toastr[restored ? 'success' : 'info'](
          restored ? `Restored the last backup of "${bookName}".` : 'No backup to restore.',
          'Worldbook Sync',
        );
      });
    },
  };
}

function boot(): void {
  const ctx = getCtx();
  if (!ctx) {
    console.error(LOG, 'no SillyTavern context; extension not started');
    return;
  }
  // Settings live in the shared extensionSettings object, so this reference stays valid
  // across fresh getContext() calls; only the per-call scalars (characterId) go stale.
  const settings = loadSettings(ctx);
  const eventTypes = ctx.eventTypes ?? ctx.event_types ?? {};

  const renderPanel = (): void =>
    renderSettingsPanel(
      { enabled: settings.enabled, autoBuild: settings.autoBuild, bookDepth: settings.bookDepth },
      buildHandlers(settings),
    );

  renderPanel(); // if the container isn't ready yet, APP_READY re-attempts (both are no-op-safe)
  ctx.eventSource.on(eventTypes.APP_READY ?? 'app_ready', renderPanel);
  ctx.eventSource.on(eventTypes.CHAT_CHANGED ?? 'chat_id_changed', () => onChatChanged(settings));

  console.log(LOG, 'loaded');
}

boot();
