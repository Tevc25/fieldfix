import { describe, it, expect } from 'vitest';
import { computeResize } from '../../src/media/camera.ts';

const MAX = 1600;

describe('computeResize', () => {
  it('does not upscale images smaller than 1600px on long edge', () => {
    const { sw, sh } = computeResize(800, 600);
    expect(sw).toBe(800);
    expect(sh).toBe(600);
  });

  it('does not change exactly-1600-wide image', () => {
    const { sw, sh } = computeResize(1600, 900);
    expect(sw).toBe(1600);
    expect(sh).toBe(900);
  });

  it('scales down landscape image keeping aspect ratio', () => {
    const { sw, sh } = computeResize(3200, 2400);
    expect(sw).toBe(MAX);
    expect(sh).toBe(1200);
    // Ratio must be preserved: 3200/2400 === 1600/1200
    expect(sw / sh).toBeCloseTo(3200 / 2400, 5);
  });

  it('scales down portrait image keeping aspect ratio', () => {
    const { sw, sh } = computeResize(2400, 3200);
    expect(sh).toBe(MAX);
    expect(sw).toBe(1200);
    expect(sw / sh).toBeCloseTo(2400 / 3200, 5);
  });

  it('scales down square image', () => {
    const { sw, sh } = computeResize(2000, 2000);
    expect(sw).toBe(MAX);
    expect(sh).toBe(MAX);
  });

  it('produces integer pixel dimensions', () => {
    // Odd source dimensions — result must be integer
    const { sw, sh } = computeResize(3001, 2001);
    expect(Number.isInteger(sw)).toBe(true);
    expect(Number.isInteger(sh)).toBe(true);
  });
});
