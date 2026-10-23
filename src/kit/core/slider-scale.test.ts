import { describe, expect, it } from 'vitest';
import { decimalsForStep, formatSliderValue, magnetDetent, sliderExtreme, sliderPosition, sliderValue, snapSliderValue, stepSliderValue, validateSliderScale, type SliderScale } from './slider-scale';

describe('slider scales', () => {
  const lin: SliderScale = { min: -2, max: 2, step: 0.25 };
  const eta: SliderScale = { min: 0.001, max: 1.5, scale: 'log' };
  const h: SliderScale = { min: -2, max: 2, step: 0.01, exclude: [0] };

  it('linear: position ↔ value round-trips on the step grid', () => {
    expect(sliderValue(0, lin)).toBe(-2);
    expect(sliderValue(1, lin)).toBe(2);
    expect(sliderValue(0.5, lin)).toBe(0);
    expect(sliderValue(0.57, lin)).toBe(0.25);
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

describe('detents and extremes (G4 Slider)', () => {
  const lin: SliderScale = { min: -2, max: 4, step: 0.05 };
  const eta: SliderScale = { min: 0.001, max: 1.5, scale: 'log' };

  it('magnetic within 1.5 steps on a linear scale; the nearest detent wins', () => {
    const detents = [1, { value: 3, label: 'λ₁' }];
    expect(magnetDetent(1.07, detents, lin)).toBe(1);
    expect(magnetDetent(0.93, detents, lin)).toBe(1);
    expect(magnetDetent(1.1, detents, lin)).toBe(1.1);
    expect(magnetDetent(2.95, detents, lin)).toBe(3);
    expect(magnetDetent(2, detents, lin)).toBe(2);
    expect(magnetDetent(1.04, [1, 1.1], lin, 0.2)).toBe(1);
    expect(magnetDetent(1.06, [1, 1.1], lin, 0.2)).toBe(1.1);
  });

  it('respects an explicit radius, and ignores excluded or out-of-range detents', () => {
    expect(magnetDetent(1.4, [1], lin, 0.5)).toBe(1);
    expect(magnetDetent(0.02, [0], { ...lin, exclude: [0] })).toBe(0.02);
    expect(magnetDetent(4, [9], lin, 10)).toBe(4);
    expect(magnetDetent(1, undefined, lin)).toBe(1);
  });

  it('on a log scale the radius is a fraction of the track, so it works at both ends', () => {
    expect(magnetDetent(0.0011, [0.001], eta)).toBe(0.001);
    expect(magnetDetent(1.45, [1.5], eta)).toBe(1.5);
    expect(magnetDetent(0.0015, [0.001], eta)).toBe(0.0015);
  });

  it('Home and End land on allowed values', () => {
    expect(sliderExtreme('min', lin)).toBe(-2);
    expect(sliderExtreme('max', lin)).toBe(4);
    expect(sliderExtreme('min', { min: 0, max: 1, step: 0.1, exclude: [0] })).toBe(0.1);
    expect(sliderExtreme('max', eta)).toBe(1.5);
    expect(sliderExtreme('min', eta)).toBe(0.001);
  });
});
