import { describe, expect, it } from 'vitest';
import { heatPixels, rampLUT, rampPosition, rampStops } from './ramp';

describe('ramps', () => {
  it('sequential: from → to, monotone in each channel', () => {
    const lut = rampLUT('sequential', '#ffffff', '#000000');
    expect([...lut.slice(0, 3)]).toEqual([255, 255, 255]);
    expect([...lut.slice(255 * 3)]).toEqual([0, 0, 0]);
    for (let i = 1; i < 256; i++) expect(lut[i * 3]).toBeLessThanOrEqual(lut[(i - 1) * 3]);
  });
  it('diverging passes through the middle colour', () => {
    const lut = rampLUT('diverging', '#0000ff', '#ff0000', '#ffffff');
    const mid = Math.round(0.5 * 255) * 3;
    expect(lut[mid]).toBeGreaterThan(240);
    expect(lut[mid + 1]).toBeGreaterThan(240);
    expect([...lut.slice(0, 3)]).toEqual([0, 0, 255]);
  });
  it('positions: clamp, centre 0 for diverging ranges that straddle it', () => {
    expect(rampPosition(5, 0, 10, 'sequential')).toBe(0.5);
    expect(rampPosition(20, 0, 10, 'sequential')).toBe(1);
    expect(rampPosition(0, -1, 4, 'diverging')).toBe(0.5);
    expect(rampPosition(-1, -1, 4, 'diverging')).toBeCloseTo(0.375);
    expect(rampPosition(4, -1, 4, 'diverging')).toBe(1);
    expect(Number.isNaN(rampPosition(NaN, 0, 1, 'sequential'))).toBe(true);
    expect(rampPosition(3, 2, 2, 'sequential')).toBe(0.5);
  });
  it('heat pixels flip rows (bottom row of data = last canvas row) and leave holes transparent', () => {
    const lut = rampLUT('sequential', '#000000', '#ffffff');
    const px = heatPixels([0, 1, NaN, 1], 2, 2, 0, 1, lut, 'sequential');
    // data row 0 (bottom): [0, 1] → canvas row 1
    expect([...px.slice(8, 12)]).toEqual([0, 0, 0, 255]);
    expect([...px.slice(12, 16)]).toEqual([255, 255, 255, 255]);
    // data row 1 (top): [NaN, 1] → canvas row 0
    expect(px[3]).toBe(0);
    expect([...px.slice(4, 8)]).toEqual([255, 255, 255, 255]);
  });
  it('key stops are CSS colours', () => {
    expect(rampStops(rampLUT('sequential', '#000000', '#ffffff'), 3)).toEqual(['rgb(0, 0, 0)', 'rgb(188, 188, 188)', 'rgb(255, 255, 255)']);
  });
});
