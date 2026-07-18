import { describe, it, expect } from 'vitest';
import { canonicalizeFranchise } from './canonical';

describe('canonicalizeFranchise', () => {
  it('lowercases and trims surrounding whitespace', () => {
    expect(canonicalizeFranchise('  Cyberpunk 2077  ')).toBe('cyberpunk 2077');
  });

  it('collapses runs of internal whitespace to a single space', () => {
    expect(canonicalizeFranchise('the   witcher')).toBe('witcher');
  });

  it('strips a leading "the" article', () => {
    expect(canonicalizeFranchise('The Witcher')).toBe('witcher');
  });

  it('only strips "the" as a whole leading word, not as a prefix', () => {
    expect(canonicalizeFranchise('Theatrhythm')).toBe('theatrhythm');
  });

  it('turns separator punctuation into spaces', () => {
    expect(canonicalizeFranchise('Nier: Automata')).toBe('nier automata');
    expect(canonicalizeFranchise('Fate/stay night')).toBe('fate stay night');
    expect(canonicalizeFranchise('Spider-Man')).toBe('spider man');
  });

  it('removes apostrophes without inserting a gap', () => {
    expect(canonicalizeFranchise("Assassin's Creed")).toBe('assassins creed');
    expect(canonicalizeFranchise('Assassin’s Creed')).toBe('assassins creed');
  });

  it('preserves numbers as part of the name', () => {
    expect(canonicalizeFranchise('Cyberpunk 2077')).toBe('cyberpunk 2077');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(canonicalizeFranchise('')).toBe('');
    expect(canonicalizeFranchise('   ')).toBe('');
  });
});
