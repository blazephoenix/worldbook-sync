import { describe, it, expect } from 'vitest';
import { hashContent, planRegeneration } from './ownership';

describe('hashContent', () => {
  it('is deterministic for the same content', () => {
    expect(hashContent('Night City is ruled by corps.')).toBe(
      hashContent('Night City is ruled by corps.'),
    );
  });

  it('differs for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('ignores CRLF vs LF and surrounding whitespace (avoids false edit flags)', () => {
    expect(hashContent('line1\r\nline2')).toBe(hashContent('line1\nline2'));
    expect(hashContent('  hello  ')).toBe(hashContent('hello'));
  });

  it('detects a real in-place content change', () => {
    expect(hashContent('The leader is X.')).not.toBe(hashContent('The leader is Y.'));
  });
});

describe('planRegeneration', () => {
  it('marks an unchanged owned entry as removable (safe to regenerate)', () => {
    const owned = { '1': hashContent('orig') };
    const entries = { '1': { content: 'orig' } };
    expect(planRegeneration(owned, entries)).toEqual({
      removableUids: ['1'],
      releasedUids: [],
      vanishedUids: [],
    });
  });

  it('releases (preserves) an owned entry the user edited in place', () => {
    const owned = { '1': hashContent('orig') };
    const entries = { '1': { content: 'orig, but corrected by the user' } };
    expect(planRegeneration(owned, entries)).toEqual({
      removableUids: [],
      releasedUids: ['1'],
      vanishedUids: [],
    });
  });

  it('marks an owned entry the user deleted as vanished', () => {
    const owned = { '1': hashContent('orig') };
    const entries: Record<string, { content: string }> = {};
    expect(planRegeneration(owned, entries)).toEqual({
      removableUids: [],
      releasedUids: [],
      vanishedUids: ['1'],
    });
  });

  it('never lists a user-added (unowned) entry in any bucket', () => {
    const owned = { '1': hashContent('orig') };
    const entries = { '1': { content: 'orig' }, '2': { content: 'user-written lore' } };
    const plan = planRegeneration(owned, entries);
    expect(plan.removableUids).toEqual(['1']);
    expect(plan.releasedUids).toEqual([]);
    expect(plan.vanishedUids).toEqual([]);
  });
});
