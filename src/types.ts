/** Domain types for worldbook-sync. See CONTEXT.md for the ubiquitous language. */

export type VerdictKind = 'franchise' | 'original' | 'multiversal';

/** A character was placed in a recognizable franchise. */
export interface FranchiseVerdict {
  kind: 'franchise';
  /** Human-facing franchise name as returned by the model (e.g. "The Witcher"). */
  display: string;
  /** Normalized registry key derived from {@link canonicalizeFranchise}. */
  canonical: string;
}

/** No recognizable franchise — an original character. */
export interface OriginalVerdict {
  kind: 'original';
}

/** No fixed franchise — a world-hopping/crossover character. */
export interface MultiversalVerdict {
  kind: 'multiversal';
}

export type Verdict = FranchiseVerdict | OriginalVerdict | MultiversalVerdict;

/** A verdict as persisted in extension storage, keyed by character avatar. */
export interface CachedVerdict {
  verdict: Verdict;
  /** Epoch ms when the user confirmed it. */
  confirmedAt: number;
}
