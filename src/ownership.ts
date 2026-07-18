/**
 * Provenance and edit-detection for plugin-owned entries (ADR-0004).
 *
 * The plugin records a content hash for every entry it writes. On regenerate it
 * consults that record to decide what it may touch: entries whose content still
 * matches the recorded hash are the plugin's to replace; anything else — user
 * edits, user additions, user deletions — is left alone.
 */

export interface RegenerationPlan {
  /** Owned, still present, unchanged since we wrote it → safe to delete and regenerate. */
  removableUids: string[];
  /** Owned, still present, but edited by the user → keep the entry, relinquish ownership. */
  releasedUids: string[];
  /** Owned but no longer present (user deleted it) → drop from ownership. */
  vanishedUids: string[];
}

/** Normalize content so trivial formatting differences don't read as user edits. */
function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

/** Deterministic FNV-1a (32-bit) hash of normalized content, as 8 hex chars. */
export function hashContent(content: string): string {
  const s = normalize(content);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Classify the current entries of a book against the plugin's ownership record,
 * yielding the plan a rewrite must obey. Pure — the glue applies it.
 */
export function planRegeneration(
  ownedHashes: Record<string, string>,
  currentEntries: Record<string, { content: string }>,
): RegenerationPlan {
  const plan: RegenerationPlan = { removableUids: [], releasedUids: [], vanishedUids: [] };
  for (const [uid, storedHash] of Object.entries(ownedHashes)) {
    const entry = currentEntries[uid];
    if (!entry) {
      plan.vanishedUids.push(uid);
    } else if (hashContent(entry.content) === storedHash) {
      plan.removableUids.push(uid);
    } else {
      plan.releasedUids.push(uid);
    }
  }
  return plan;
}
