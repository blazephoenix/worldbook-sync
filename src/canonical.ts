/**
 * Normalize a franchise name into a stable registry key.
 *
 * This is a light normalizer, not a semantic matcher — it collapses trivial
 * variations (case, whitespace, punctuation, a leading "the") so that
 * "The Witcher" and "the  witcher" key to the same book. Semantic collapsing
 * (e.g. "The Witcher 3" → "The Witcher") is the LLM's job at detection time
 * (ADR-0003), backed by the human confirm step; we deliberately keep numbers
 * so distinct entries like "Cyberpunk 2077" stay distinct.
 */
export function canonicalizeFranchise(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/['’]/g, '') // drop apostrophes without inserting a gap
    .replace(/[^a-z0-9]+/g, ' ') // any other separator run → single space
    .trim();
  return normalized.replace(/^the\s+/, '');
}
