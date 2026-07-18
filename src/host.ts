/**
 * Bridge to SillyTavern functions that may not be on the stable `getContext()` surface.
 *
 * `createWorldInfoEntry` and `charUpdateAddAuxWorld` live in `world-info.js`. We import
 * that module dynamically and lazily — only when a needed function isn't already on the
 * context — resolved against this bundle's URL (…/third-party/<name>/index.js →
 * ../../../world-info.js). The import is guarded so a path/version mismatch degrades
 * gracefully (the affected action reports unavailable) instead of throwing at load.
 */

type CreateEntryFn = (name: string, data: STWorldInfoData) => STWorldInfoEntry | undefined;
type LinkAuxFn = (characterKey: string, nameOrNames: string | string[]) => Promise<void>;

type WorldInfoModule = Partial<{
  createWorldInfoEntry: CreateEntryFn;
  charUpdateAddAuxWorld: LinkAuxFn;
}>;

let moduleCache: WorldInfoModule | null | undefined;

/** Import world-info.js once, caching success or failure (null). */
async function loadWorldInfoModule(): Promise<WorldInfoModule | null> {
  if (moduleCache !== undefined) return moduleCache;
  try {
    moduleCache = (await import('../../../world-info.js')) as WorldInfoModule;
  } catch (error) {
    console.warn(
      '[worldbook-sync] could not import world-info.js — some actions will be unavailable',
      error,
    );
    moduleCache = null;
  }
  return moduleCache;
}

/** Resolve `createWorldInfoEntry`, preferring the context method (no import needed there). */
export async function getCreateEntry(ctx: SillyTavernContext): Promise<CreateEntryFn | null> {
  if (typeof ctx.createWorldInfoEntry === 'function') {
    const fn = ctx.createWorldInfoEntry;
    return (name, data) => fn.call(ctx, name, data);
  }
  const mod = await loadWorldInfoModule();
  return mod?.createWorldInfoEntry ?? null;
}

/** Resolve `charUpdateAddAuxWorld` (only available via world-info.js). */
export async function getLinkAux(_ctx: SillyTavernContext): Promise<LinkAuxFn | null> {
  const mod = await loadWorldInfoModule();
  return mod?.charUpdateAddAuxWorld ?? null;
}
