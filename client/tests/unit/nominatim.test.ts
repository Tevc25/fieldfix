import { describe, it, expect } from 'vitest';
import { roundCoord, cacheKey } from '../../src/geo/nominatim.ts';

describe('roundCoord', () => {
  it('rounds to 3 decimal places', () => {
    expect(roundCoord(46.55834)).toBe(46.558);
    expect(roundCoord(15.64591)).toBe(15.646);
  });

  it('returns exact value when already 3 dp', () => {
    expect(roundCoord(46.558)).toBe(46.558);
  });

  it('handles negative coordinates', () => {
    expect(roundCoord(-46.55834)).toBe(-46.558);
  });

  it('rounds 0.0005 up', () => {
    expect(roundCoord(1.0005)).toBe(1.001);
  });

  it('rounds 0.00049 down', () => {
    expect(roundCoord(1.0004)).toBe(1.0);
  });
});

describe('cacheKey', () => {
  it('produces deterministic key from lat/lng', () => {
    expect(cacheKey(46.55834, 15.64591)).toBe('46.558,15.646');
  });

  it('same rounded coords → same key', () => {
    // Both 46.5581 and 46.5584 round to 46.558
    expect(cacheKey(46.5581, 15.646)).toBe(cacheKey(46.5584, 15.646));
  });

  it('different rounded coords → different key', () => {
    expect(cacheKey(46.558, 15.646)).not.toBe(cacheKey(46.559, 15.646));
  });
});
