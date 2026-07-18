import { describe, it, expect } from 'vitest';
import { parseDetectionResponse } from './detection';

describe('parseDetectionResponse', () => {
  it('parses a clean franchise verdict with canonical key', () => {
    const v = parseDetectionResponse('{"verdict": "franchise", "franchise": "The Witcher"}');
    expect(v).toEqual({ kind: 'franchise', display: 'The Witcher', canonical: 'witcher' });
  });

  it('parses JSON wrapped in a ```json code fence', () => {
    const raw = '```json\n{"verdict":"franchise","franchise":"Cyberpunk 2077"}\n```';
    expect(parseDetectionResponse(raw)).toEqual({
      kind: 'franchise',
      display: 'Cyberpunk 2077',
      canonical: 'cyberpunk 2077',
    });
  });

  it('parses JSON embedded in surrounding prose', () => {
    const raw = 'Sure! Here is the result: {"verdict":"franchise","franchise":"Naruto"} — hope it helps.';
    expect(parseDetectionResponse(raw)).toMatchObject({ kind: 'franchise', display: 'Naruto' });
  });

  it('maps the "original" verdict', () => {
    expect(parseDetectionResponse('{"verdict":"original","franchise":null}')).toEqual({
      kind: 'original',
    });
  });

  it('maps the "multiversal" verdict', () => {
    expect(parseDetectionResponse('{"verdict":"multiversal","franchise":null}')).toEqual({
      kind: 'multiversal',
    });
  });

  it('is case-insensitive about the verdict value', () => {
    expect(parseDetectionResponse('{"verdict":"ORIGINAL"}')).toEqual({ kind: 'original' });
  });

  it('infers a franchise when verdict is absent but a name is present', () => {
    expect(parseDetectionResponse('{"franchise":"Halo"}')).toMatchObject({
      kind: 'franchise',
      canonical: 'halo',
    });
  });

  it('treats a franchise verdict with an empty/sentinel name as original', () => {
    expect(parseDetectionResponse('{"verdict":"franchise","franchise":""}')).toEqual({
      kind: 'original',
    });
    expect(parseDetectionResponse('{"verdict":"franchise","franchise":"none"}')).toEqual({
      kind: 'original',
    });
  });

  it('throws when no JSON object can be found', () => {
    expect(() => parseDetectionResponse('I could not determine anything.')).toThrow();
  });

  it('throws on malformed JSON', () => {
    expect(() => parseDetectionResponse('{"verdict": franchise,}')).toThrow();
  });
});
