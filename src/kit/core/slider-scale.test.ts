import { describe, expect, it } from 'vitest';
import { decimalsForStep, formatSliderValue, sliderPosition, sliderValue, snapSliderValue, stepSliderValue, validateSliderScale, type SliderScale } from './slider-scale';

describe('slider scales', () => {
  const lin: SliderScale = { min: -2, max: 2, step: 0.25 };
  const eta: SliderScale = { min: 0.001, max: 1.5, scale: 'log' };
  const h: SliderScale = { min: -2, max: 2, step: 0.01, exclude: [0] };

  it('linear: position ↔ value round-trips on the step grid', () => {
    expect(sliderValue(0, lin)).toBe(-2);
    expect(sliderValue(1, lin)).toBe(2);
    expect(sliderValue(0.5, lin)).toBe(0);
    expect(sliderValue(0.53, lin)).toBe(0.25);
    for (let v = -2; v <= 2; v += 0.25) expect(sliderValue(sliderPosition(v, lin), lin)).toBeCloseTo(v, 12);
    expect(sliderPosition(5, lin)).toBe(1);
  });

  it('log: equal track distances are equal ratios, and both ends get resolution', () => {
    expect(sliderValue(0, eta)).toBe(0.001);
    expect(sliderValue(1, eta)).toBe(1.5);
    const mid = sliderValue(0.5, eta);
    expect(mid).toBeCloseTo(Math.sqrt(0.001 * 1.5), 2);
    expect(sliderValue(0.05, eta)).toBeLessThan(0.002); // fine control near 0.001
    expect(sliderPosition(0.039, eta)).toBeCloseTo(0.5, 1);
    for (const v of [0.001, 0.01, 0.1, 1]) expect(sliderValue(sliderPosition(v, eta), eta)).toBeCloseTo(v, 10);
    expect(() => validateSliderScale({ min: 0, max: 1, scale: 'log' })).toThrow(/min > 0/);
    expect(() => validateSliderScale({ min: 1, max: 1 })).toThrow();
  });

  it('excluded values are never landed on (h never reaches 0)', () => {
    expect(snapSliderValue(0, h)).not.toBe(0);
    expect(snapSliderValue(0.002, h)).toBe(0.01);
    expect(snapSliderValue(-0.003, h)).toBe(-0.01);
    expect(snapSliderValue(0, h, 0.01)).toBe(-0.01); // moving down through 0 skips to the other side
    for (let p = 0; p <= 1; p += 0.001) expect(sliderValue(p, h)).not.toBe(0);
    let v = 0.03;
    for (let k = 0; k < 6; k++) v = stepSliderValue(v, -1, h);
    expect(v).toBe(-0.04); // 0.02, 0.01, −0.01, −0.02, −0.03, −0.04
  });

  it('keyboard steps on a log scale always move', () => {
    let v = 0.001;
    const seen = new Set<number>([v]);
    for (let k = 0; k < 30; k++) {
      v = stepSliderValue(v, 1, eta);
      seen.add(v);
    }
    expect(seen.size).toBe(31);
    expect(stepSliderValue(1.5, 1, eta)).toBe(1.5);
    expect(stepSliderValue(0.01, 1, eta, true)).toBeGreaterThan(stepSliderValue(0.01, 1, eta));
  });

  it('formats: step decimals for linear, significant figures for log, real minus', () => {
    expect(formatSliderValue(-0.5, lin)).toBe('−0.50');
    expect(formatSliderValue(0.001, eta)).toBe('0.001');
    expect(formatSliderValue(0.0123, eta)).toBe('0.012');
    expect(formatSliderValue(1.5, eta)).toBe('1.5');
    expect(formatSliderValue(-0.001, { min: -1, max: 1, step: 0.01 })).toBe('0.00');
    expect(decimalsForStep(0.25)).toBe(2);
    expect(decimalsForStep(5)).toBe(0);
  });
});
