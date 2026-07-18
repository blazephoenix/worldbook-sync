import { describe, it, expect } from 'vitest';
import { generateChatBlind, generateChatAware } from './llm';

describe('generateChatBlind (version-tolerant generateRaw)', () => {
  it('uses the object-form result when it returns a string', async () => {
    const ctx = {
      generateRaw: async (a: unknown) => (typeof a === 'object' ? 'OBJECT' : 'POSITIONAL'),
    } as unknown as SillyTavernContext;
    expect(await generateChatBlind(ctx, 'p')).toBe('OBJECT');
  });

  it('falls back to positional when the object form returns undefined', async () => {
    const ctx = {
      generateRaw: async (a: unknown) => (typeof a === 'object' ? undefined : 'POSITIONAL'),
    } as unknown as SillyTavernContext;
    expect(await generateChatBlind(ctx, 'p')).toBe('POSITIONAL');
  });

  it('falls back to positional when the object form throws', async () => {
    const ctx = {
      generateRaw: async (a: unknown) => {
        if (typeof a === 'object') throw new Error('wrong signature');
        return 'POSITIONAL';
      },
    } as unknown as SillyTavernContext;
    expect(await generateChatBlind(ctx, 'p')).toBe('POSITIONAL');
  });
});

describe('generateChatAware (version-tolerant generateQuietPrompt)', () => {
  it('falls back to positional generateQuietPrompt when the object form returns undefined', async () => {
    const ctx = {
      generateQuietPrompt: async (a: unknown) => (typeof a === 'object' ? undefined : 'POSITIONAL'),
    } as unknown as SillyTavernContext;
    expect(await generateChatAware(ctx, 'p')).toBe('POSITIONAL');
  });
});
