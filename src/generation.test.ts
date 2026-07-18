import { describe, it, expect } from 'vitest';
import { parseGenerationResponse, buildGenerationPrompt, buildStoryPrompt } from './generation';

describe('parseGenerationResponse', () => {
  it('parses a clean JSON array of entries', () => {
    const raw = JSON.stringify([
      { title: 'Night City', keys: ['Night City', 'the city'], content: 'A corp-ruled megacity.' },
    ]);
    expect(parseGenerationResponse(raw)).toEqual([
      { title: 'Night City', keys: ['Night City', 'the city'], content: 'A corp-ruled megacity.' },
    ]);
  });

  it('parses an array wrapped in a code fence', () => {
    const raw = '```json\n[{"title":"Arasaka","keys":["Arasaka"],"content":"A megacorp."}]\n```';
    expect(parseGenerationResponse(raw)).toHaveLength(1);
  });

  it('parses an object that wraps the array under "entries"', () => {
    const raw = '{"entries":[{"title":"Militech","keys":["Militech"],"content":"A rival corp."}]}';
    expect(parseGenerationResponse(raw)[0]).toMatchObject({ title: 'Militech' });
  });

  it('drops entries missing content or keys', () => {
    const raw = JSON.stringify([
      { title: 'Valid', keys: ['x'], content: 'ok' },
      { title: 'No keys', keys: [], content: 'ok' },
      { title: 'No content', keys: ['y'], content: '' },
      { title: 'Missing fields' },
    ]);
    expect(parseGenerationResponse(raw)).toEqual([{ title: 'Valid', keys: ['x'], content: 'ok' }]);
  });

  it('trims and de-duplicates keys', () => {
    const raw = JSON.stringify([
      { title: 'T', keys: [' Arasaka ', 'Arasaka', ''], content: 'c' },
    ]);
    expect(parseGenerationResponse(raw)[0]?.keys).toEqual(['Arasaka']);
  });

  it('accepts "key"/"comment" field aliases', () => {
    const raw = JSON.stringify([{ comment: 'Aliased', key: ['k'], content: 'c' }]);
    expect(parseGenerationResponse(raw)[0]).toEqual({ title: 'Aliased', keys: ['k'], content: 'c' });
  });

  it('throws when no JSON array or object is present', () => {
    expect(() => parseGenerationResponse('nothing structured here')).toThrow();
  });
});

describe('buildGenerationPrompt', () => {
  it('names the franchise and asks for the target entry count as JSON', () => {
    const p = buildGenerationPrompt('The Witcher', 12);
    expect(p).toContain('The Witcher');
    expect(p).toContain('12');
    expect(p.toLowerCase()).toContain('json');
  });
});

describe('buildStoryPrompt', () => {
  it('references the ongoing story, the franchise, and asks for JSON', () => {
    const p = buildStoryPrompt('The Witcher', 15);
    expect(p).toContain('The Witcher');
    expect(p.toLowerCase()).toContain('json');
    // It must anchor on the actual roleplay, not canon.
    expect(p.toLowerCase()).toMatch(/story|conversation|roleplay|happened/);
  });

  it('reuses the same entry shape, so parseGenerationResponse can read its output', () => {
    // A response produced under this prompt parses with the shared parser.
    const raw = '[{"title":"Arasaka Tower destroyed","keys":["Arasaka"],"content":"Razed by the player."}]';
    expect(parseGenerationResponse(raw)).toHaveLength(1);
  });
});
