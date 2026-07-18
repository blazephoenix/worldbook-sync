/**
 * Minimal ambient declarations for the SillyTavern host surface we consume.
 *
 * Hand-authored per ADR-0006 — there is no official typed package for
 * `SillyTavern.getContext()`. These are intentionally partial: add fields as we
 * start using them. A permissive index signature on the context keeps unknown
 * host APIs reachable without fighting the compiler.
 *
 * This file has no top-level import/export, so its declarations are global.
 */

/** A single native World Info entry (the uid-keyed object form on disk). */
interface STWorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: number;
  order: number;
  position: number;
  disable: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  group: string;
  matchWholeWords: boolean | null;
  caseSensitive: boolean | null;
  automationId: string;
  role: number | null;
  [key: string]: unknown;
}

/** A World Info file: `entries` keyed by uid string. */
interface STWorldInfoData {
  entries: Record<string, STWorldInfoEntry>;
  [key: string]: unknown;
}

interface STCharacterData {
  extensions?: Record<string, unknown>;
  tags?: string[];
  [key: string]: unknown;
}

/** A parsed character card as held in `context.characters`. */
interface STCharacter {
  name: string;
  avatar: string;
  description?: string;
  personality?: string;
  scenario?: string;
  tags?: string[];
  data?: STCharacterData;
  [key: string]: unknown;
}

interface STEventSource {
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

interface SillyTavernContext {
  characters: STCharacter[];
  characterId: number | undefined;
  groupId: string | undefined;
  extensionSettings: Record<string, unknown>;
  saveSettingsDebounced: () => void;
  eventSource: STEventSource;
  eventTypes: Record<string, string>;
  loadWorldInfo(name: string): Promise<STWorldInfoData | null>;
  saveWorldInfo(name: string, data: STWorldInfoData, immediately?: boolean): Promise<void>;
  updateWorldInfoList(): Promise<void>;
  reloadWorldInfoEditor(name?: string, loadIfNotSelected?: boolean): void;
  getWorldInfoNames(): string[];
  /** Present in some builds; not guaranteed on the stable surface — we fall back to an import. */
  createWorldInfoEntry?(name: string, data: STWorldInfoData): STWorldInfoEntry | undefined;
  /** Background generation that DOES see the current chat context (object param). */
  generateQuietPrompt(options: {
    quietPrompt: string;
    quietToLoud?: boolean;
    skipWIAN?: boolean;
    responseLength?: number;
    jsonSchema?: unknown;
  }): Promise<string>;
  /** Generation WITHOUT chat context — chat-blind (object param). */
  generateRaw(options: {
    prompt: string;
    systemPrompt?: string;
    responseLength?: number;
    jsonSchema?: unknown;
  }): Promise<string>;
  executeSlashCommandsWithOptions(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<{ pipe?: string } & Record<string, unknown>>;
  /** Per-chat metadata; the chat-bound world name lives at chatMetadata['world_info']. */
  chatMetadata: Record<string, unknown>;
  saveMetadata(): Promise<void>;
  getCurrentChatId?: () => string | null | undefined;
  chatId?: string;
  callGenericPopup(
    content: unknown,
    type: number,
    inputValue?: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  POPUP_TYPE: Record<string, number>;
  // Permissive escape hatch for host APIs we haven't typed yet.
  [key: string]: any;
}

declare const SillyTavern: {
  getContext(): SillyTavernContext;
};

interface Window {
  SillyTavern: { getContext(): SillyTavernContext };
}

declare const toastr: {
  success(message: string, title?: string): void;
  info(message: string, title?: string): void;
  warning(message: string, title?: string): void;
  error(message: string, title?: string): void;
};

/**
 * SillyTavern's world-info module, imported at runtime via a relative path resolved
 * against the installed extension's URL (see host.ts). Only the members we use are
 * declared. Marked external in build.mjs so esbuild leaves the import in place.
 */
declare module '*/world-info.js' {
  export function createWorldInfoEntry(
    name: string,
    data: STWorldInfoData,
  ): STWorldInfoEntry | undefined;
  export function charUpdateAddAuxWorld(
    characterKey: string,
    nameOrNames: string | string[],
  ): Promise<void>;
}
