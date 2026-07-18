import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('ships with auto-build OFF (ADR-0004) and a focused-core depth', () => {
    expect(DEFAULT_SETTINGS.autoBuild).toBe(false);
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.bookDepth).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_SETTINGS.bookDepth).toBeLessThanOrEqual(15);
    expect(DEFAULT_SETTINGS.connectionProfile).toBeNull();
  });
});

describe('mergeSettings', () => {
  it('fills a completely empty object with defaults', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves provided config values while filling the rest', () => {
    const merged = mergeSettings({ autoBuild: true, bookDepth: 20 });
    expect(merged.autoBuild).toBe(true);
    expect(merged.bookDepth).toBe(20);
    expect(merged.enabled).toBe(true);
  });

  it('preserves existing persisted state (verdicts/registry/ownership)', () => {
    const merged = mergeSettings({
      registry: { witcher: 'Universe - The Witcher' },
    });
    expect(merged.registry).toEqual({ witcher: 'Universe - The Witcher' });
    expect(merged.verdicts).toEqual({});
    expect(merged.ownership).toEqual({});
  });

  it('does not alias the default record objects between calls', () => {
    const a = mergeSettings({});
    a.registry['x'] = 'y';
    const b = mergeSettings({});
    expect(b.registry).toEqual({});
  });
});
