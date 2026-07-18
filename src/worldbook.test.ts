import { describe, it, expect } from 'vitest';
import { entryFieldsFor } from './worldbook';

describe('entryFieldsFor', () => {
  const gen = { title: 'Night City', keys: ['Night City', 'the city'], content: 'A corp-ruled megacity.' };

  it('maps title→comment, keys→key, content→content', () => {
    const f = entryFieldsFor(gen);
    expect(f.comment).toBe('Night City');
    expect(f.key).toEqual(['Night City', 'the city']);
    expect(f.content).toBe('A corp-ruled megacity.');
  });

  it('produces keyword-triggered, non-constant, non-vectorized entries (ADR-0005)', () => {
    const f = entryFieldsFor(gen);
    expect(f.constant).toBe(false);
    expect(f.vectorized).toBe(false);
    expect(f.selective).toBe(false);
  });

  it('enables whole-word matching and leaves the entry enabled', () => {
    const f = entryFieldsFor(gen);
    expect(f.matchWholeWords).toBe(true);
    expect(f.disable).toBe(false);
  });
});
