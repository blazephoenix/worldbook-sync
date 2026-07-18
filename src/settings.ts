import type { CachedVerdict } from './types';

/** The extension's config + persisted state, stored under one key in extensionSettings. */
export interface Settings {
  /** Master on/off for the extension's automatic behavior. */
  enabled: boolean;
  /** Build a missing universe book automatically on first engage (ADR-0004, default OFF). */
  autoBuild: boolean;
  /** Target entry count for a focused-core generation (ADR-0005). */
  bookDepth: number;
  /** Connection profile name to use for LLM calls, or null for the active connection. */
  connectionProfile: string | null;

  // --- persisted state (ADR-0007: all plugin memory lives here, never on cards) ---
  /** Detection verdicts keyed by character avatar filename. */
  verdicts: Record<string, CachedVerdict>;
  /** Canonical franchise key → universe book name. */
  registry: Record<string, string>;
  /** Book name → { entry uid → content hash } for plugin-owned entries. */
  ownership: Record<string, Record<string, string>>;
  /** Book name → last pre-rewrite snapshot, for recovery (ADR-0004). */
  backups: Record<string, { data: STWorldInfoData; at: number }>;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoBuild: false,
  bookDepth: 12,
  connectionProfile: null,
  verdicts: {},
  registry: {},
  ownership: {},
  backups: {},
};

/** Fill missing fields from defaults without dropping stored config or state. Pure. */
export function mergeSettings(stored: Partial<Settings>): Settings {
  return {
    enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
    autoBuild: stored.autoBuild ?? DEFAULT_SETTINGS.autoBuild,
    bookDepth: stored.bookDepth ?? DEFAULT_SETTINGS.bookDepth,
    connectionProfile: stored.connectionProfile ?? DEFAULT_SETTINGS.connectionProfile,
    verdicts: { ...(stored.verdicts ?? {}) },
    registry: { ...(stored.registry ?? {}) },
    ownership: { ...(stored.ownership ?? {}) },
    backups: { ...(stored.backups ?? {}) },
  };
}

/** Key under which everything is stored in `context.extensionSettings`. */
export const MODULE_KEY = 'worldbook-sync';

/**
 * Load settings from the host, normalizing and writing the merged object back so the
 * returned reference is the one persisted by {@link persistSettings}. Glue.
 */
export function loadSettings(ctx: SillyTavernContext): Settings {
  const raw = (ctx.extensionSettings[MODULE_KEY] ?? {}) as Partial<Settings>;
  const merged = mergeSettings(raw);
  ctx.extensionSettings[MODULE_KEY] = merged;
  return merged;
}

/** Persist settings mutated in place. Glue. */
export function persistSettings(ctx: SillyTavernContext): void {
  ctx.saveSettingsDebounced();
}
