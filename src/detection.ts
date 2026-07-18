import { canonicalizeFranchise } from './canonical';
import type { Verdict } from './types';

/** Franchise-name values that actually mean "no franchise". */
const NON_FRANCHISE_SENTINELS = new Set(['', 'none', 'null', 'n/a', 'na', 'unknown', 'original']);

/** Pull the outermost `{…}` JSON object out of a model response, tolerating fences/prose. */
function extractJsonObject(raw: string): unknown {
  const withoutFences = raw.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('parseDetectionResponse: no JSON object found in response');
  }
  return JSON.parse(withoutFences.slice(start, end + 1));
}

/**
 * Parse a detection response into a {@link Verdict}.
 *
 * Tolerates code fences and surrounding prose; throws if no parseable JSON object
 * is present. Defensive by design: an unrecognized or empty franchise resolves to
 * `original` rather than fabricating a universe.
 */
export function parseDetectionResponse(raw: string): Verdict {
  const parsed = extractJsonObject(raw);
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('parseDetectionResponse: response is not a JSON object');
  }
  const obj = parsed as Record<string, unknown>;

  const verdict = typeof obj.verdict === 'string' ? obj.verdict.trim().toLowerCase() : undefined;
  const name = typeof obj.franchise === 'string' ? obj.franchise.trim() : '';

  if (verdict === 'multiversal') return { kind: 'multiversal' };
  if (verdict === 'original') return { kind: 'original' };

  const looksLikeFranchise = verdict === 'franchise' || (verdict === undefined && name !== '');
  if (looksLikeFranchise) {
    if (NON_FRANCHISE_SENTINELS.has(name.toLowerCase())) return { kind: 'original' };
    const canonical = canonicalizeFranchise(name);
    if (canonical === '') return { kind: 'original' };
    return { kind: 'franchise', display: name, canonical };
  }

  return { kind: 'original' };
}

/** Inputs the detection prompt draws on (a subset of a character card). */
export interface DetectionInput {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  tags?: string[];
}

const clip = (s: string | undefined, n: number): string => (s ? s.slice(0, n) : '');

/** Build the detection prompt. Pure — no host calls — so it is unit-testable. */
export function buildDetectionPrompt(input: DetectionInput): string {
  const tags = input.tags && input.tags.length > 0 ? input.tags.join(', ') : '(none)';
  return [
    'You are identifying which existing fictional FRANCHISE a roleplay character belongs to.',
    'A franchise is a recognizable published work or shared universe',
    '(e.g. "The Witcher", "Cyberpunk 2077", "Naruto", "Star Wars").',
    '',
    'Rules:',
    '- If the character clearly belongs to a well-known franchise, return its shortest canonical name.',
    '- If the character is original or not from any recognizable franchise, use verdict "original".',
    '- If the character is explicitly a cross-universe / world-hopping character with no single home,',
    '  use verdict "multiversal".',
    '- Do not guess wildly. When unsure, prefer "original".',
    '',
    'Respond with ONLY a JSON object — no prose, no code fence — in exactly this shape:',
    '{"verdict": "franchise" | "original" | "multiversal", "franchise": "<canonical name>" | null}',
    '',
    '--- CHARACTER ---',
    `Name: ${input.name}`,
    `Tags: ${tags}`,
    `Description: ${clip(input.description, 1500)}`,
    `Personality: ${clip(input.personality, 500)}`,
    `Scenario: ${clip(input.scenario, 500)}`,
  ].join('\n');
}

/**
 * Detect a character's franchise via the user's configured LLM connection.
 *
 * Glue: exercises the host `generateQuietPrompt` and cannot be unit-tested without a
 * running SillyTavern. Retries once on a parse failure before giving up.
 */
export async function detectFranchise(
  ctx: SillyTavernContext,
  character: STCharacter,
): Promise<Verdict> {
  const prompt = buildDetectionPrompt({
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    tags: character.tags ?? character.data?.tags,
  });

  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // quietToLoud=false (background), skipWIAN=true (don't feed WI/author's note into detection).
    const raw = await ctx.generateQuietPrompt(prompt, false, true);
    try {
      return parseDetectionResponse(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `detectFranchise: no parseable verdict after ${maxAttempts} attempts (${String(lastError)})`,
  );
}
