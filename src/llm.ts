/**
 * Version-tolerant wrappers around SillyTavern's generation calls.
 *
 * Current staging takes an OBJECT param (`generateRaw({prompt})`,
 * `generateQuietPrompt({quietPrompt})`); older/stable builds are POSITIONAL
 * (`generateRaw(prompt, …)`, `generateQuietPrompt(quietPrompt, quietToLoud, skipWIAN, …)`).
 * Calling the wrong form silently returns `undefined`, which is what broke the story path.
 *
 * We try the object form first (it's the documented current source), then fall back to
 * positional, and only accept a non-empty string. If neither yields one, we surface the
 * underlying error rather than letting an `undefined` reach the parser.
 */

type AnyFn = (...args: unknown[]) => Promise<unknown>;

async function firstUsableString(attempts: Array<() => Promise<unknown>>): Promise<string> {
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (typeof result === 'string' && result.trim().length > 0) return result;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return '';
}

/** Chat-BLIND generation (canon). */
export function generateChatBlind(
  ctx: SillyTavernContext,
  prompt: string,
  responseLength = 2048,
): Promise<string> {
  const raw = ctx.generateRaw as unknown as AnyFn;
  return firstUsableString([
    () => ctx.generateRaw({ prompt, responseLength }),
    () => raw(prompt),
  ]);
}

/** Chat-AWARE generation (story) — the model sees the current conversation. */
export function generateChatAware(
  ctx: SillyTavernContext,
  prompt: string,
  responseLength = 2048,
): Promise<string> {
  const quiet = ctx.generateQuietPrompt as unknown as AnyFn;
  return firstUsableString([
    () => ctx.generateQuietPrompt({ quietPrompt: prompt, skipWIAN: true, responseLength }),
    () => quiet(prompt, false, true),
  ]);
}
