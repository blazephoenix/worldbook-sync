import { describe, it, expect } from 'vitest';
import { universeBookName, isPluginBookName } from './books';

describe('universeBookName', () => {
  it('prefixes the display name so plugin books are recognizable', () => {
    expect(universeBookName('The Witcher')).toBe('Universe - The Witcher');
  });

  it('keeps numbers', () => {
    expect(universeBookName('Cyberpunk 2077')).toBe('Universe - Cyberpunk 2077');
  });

  it('replaces filesystem-hostile characters with spaces and collapses them', () => {
    expect(universeBookName('Nier: Automata')).toBe('Universe - Nier Automata');
    expect(universeBookName('Fate/stay night')).toBe('Universe - Fate stay night');
  });
});

describe('isPluginBookName', () => {
  it('recognizes names produced by universeBookName', () => {
    expect(isPluginBookName(universeBookName('Halo'))).toBe(true);
  });

  it('rejects unrelated book names', () => {
    expect(isPluginBookName('My Handwritten Lore')).toBe(false);
    expect(isPluginBookName('Universe')).toBe(false);
  });
});
