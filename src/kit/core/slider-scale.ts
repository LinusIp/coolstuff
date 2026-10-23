/**
 * Slider value ↔ position mapping, pure and tested, for G4's `Slider` (and
 * anything else with a track): linear or log scales, step snapping, values
 * to avoid (h never reaches 0), keyboard steps and sig-fig-aware labels.
 *
 *   const s = { min: 0.001, max: 1.5, scale: 'log' } as const;   // a learning rate
 *   sliderValue(0.5, s)          → 0.039 (the geometric middle, snapped to 2 significant figures)
 *   formatSliderValue(0.001, s)  → '0.001'
 *   const h = { min: -2, max: 2, step: 0.01, exclude: [0] };
 *   snapSliderValue(0.002, h)    → 0.01 (never 0)
 */

export interface SliderScale {
  min: number;
  max: number;
  /** Linear: snap to multiples of step from min (default (max − min)/100). Log: snap to this absolute step if given, else to `sig` significant figures. */
  step?: number;
  /** Default 'linear'. 'log' needs min > 0 (for a two-sided log quantity, pair a sign toggle with a positive log slider). */
  scale?: 'linear' | 'log';
  /** Values the slider must never land on (within half a step): `[0]` keeps h off zero. */
  exclude?: readonly number[];
  /** Significant figures a log slider snaps to when it has no step. Default 2. */
  sig?: number;
}

/** Throws on a scale that can't work (so a lesson's mistake fails its test, not the page). */
export function validateSliderScale(s: SliderScale): void {
  if (!(s.max > s.min)) throw new Error(`Slider: max (${s.max}) must be greater than min (${s.min})`);
  if (s.scale === 'log' && !(s.min > 0)) throw new Error(`Slider: a log scale needs min > 0 (got ${s.min}); use a sign toggle for negative values`);
  if (s.step !== undefined && !(s.step > 0)) throw new Error('Slider: step must be > 0');
}

const roundSigFig = (x: number, sig: number): number => (x === 0 ? 0 : Number(x.toPrecision(sig)));
const clean = (x: number): number => Number(x.toPrecision(12));

/** Where `value` sits on the track, 0…1. */
export function sliderPosition(value: number, s: SliderScale): number {
  const v = Math.min(s.max, Math.max(s.min, value));
  if (s.scale === 'log') return (Math.log(v) - Math.log(s.min)) / (Math.log(s.max) - Math.log(s.min));
  return (v - s.min) / (s.max - s.min);
}

/** Snap a raw value to the scale's grid, clamp it, and step off excluded values (towards `prev` when given). */
export function snapSliderValue(raw: number, s: SliderScale, prev?: number): number {
  let v = Math.min(s.max, Math.max(s.min, raw));
  const step = s.step ?? (s.scale === 'log' ? undefined : (s.max - s.min) / 100);
  if (step !== undefined) v = s.min + Math.round((v - s.min) / step) * step;
  else v = roundSigFig(v, s.sig ?? 2);
  v = clean(Math.min(s.max, Math.max(s.min, v)));
  const ex = s.exclude ?? [];
  const tooClose = (x: number) => ex.some((e) => Math.abs(x - e) < (step ?? Math.abs(x) * 0.01 + 1e-12) / 2);
  if (tooClose(v)) {
    const d = step ?? Math.max(Math.abs(v) * 0.05, 1e-6);
    const e = ex.find((x) => Math.abs(v - x) < d)!;
    // Move one step away from the excluded value: in the direction of travel, else away from it.
    const dir = prev !== undefined && prev !== v ? Math.sign(v - prev) || 1 : Math.sign(raw - e) || 1;
    let w = clean(e + dir * d);
    if (w > s.max || w < s.min) w = clean(e - dir * d);
    v = Math.min(s.max, Math.max(s.min, w));
  }
  return v;
}

/** The value at track position `pos` (0…1), snapped. */
export function sliderValue(pos: number, s: SliderScale, prev?: number): number {
  const t = Math.min(1, Math.max(0, pos));
  const raw = s.scale === 'log' ? Math.exp(Math.log(s.min) + t * (Math.log(s.max) - Math.log(s.min))) : s.min + t * (s.max - s.min);
  return snapSliderValue(raw, s, prev);
}

/**
 * Keyboard step: arrows move one step (linear) or 1/100 of the track (log);
 * PageUp/PageDown (`big`) move 10 of those. Always lands on a new allowed value
 * when one exists in that direction.
 */
export function stepSliderValue(value: number, dir: 1 | -1, s: SliderScale, big = false): number {
  const k = big ? 10 : 1;
  let next: number;
  if (s.scale === 'log') {
    let pos = sliderPosition(value, s);
    next = value;
    for (let i = 0; i < 200 && next === value; i++) {
      pos += (dir * k) / 100;
      next = sliderValue(pos, s, value);
      if (pos <= 0 || pos >= 1) break;
    }
  } else {
    const step = s.step ?? (s.max - s.min) / 100;
    next = snapSliderValue(value + dir * step * k, s, value);
  }
  return next;
}

/** Decimals a step implies (0.25 → 2, 0.1 → 1, 5 → 0). */
export function decimalsForStep(step: number): number {
  if (!(step > 0)) return 2;
  for (let d = 0; d <= 10; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  return 10;
}

/**
 * The value as slider text: linear scales use the step's decimals; log
 * scales keep `sig` significant figures (0.001, 0.012, 0.15, 1.5). U+2212 minus.
 */
export function formatSliderValue(value: number, s: SliderScale): string {
  let out: string;
  if (s.scale === 'log' && s.step === undefined) {
    const v = roundSigFig(value, s.sig ?? 2);
    out = Math.abs(v) >= 1e-4 || v === 0 ? String(v) : v.toExponential(1);
  } else {
    out = value.toFixed(decimalsForStep(s.step ?? (s.max - s.min) / 100));
  }
  if (/^-0(\.0*)?$/.test(out)) out = out.slice(1);
  return out.replace(/^-/, '−');
}

/** A detent: a meaningful value marked under the track (the eigenvalues), optionally labelled. */
export type SliderDetent = number | { value: number; label?: string };

/** The detent's value. */
export const detentValue = (d: SliderDetent): number => (typeof d === 'number' ? d : d.value);

/**
 * Magnetic detents for dragging: if `value` is within `radius` of a detent,
 * return that detent's value, else `value`. `radius` is in world units on a
 * linear scale (default 1.5 steps) and in track fraction on a log scale
 * (default 0.015, i.e. 1.5% of the track). Excluded or out-of-range detents
 * never attract; the nearest detent wins.
 */
export function magnetDetent(value: number, detents: readonly SliderDetent[] | undefined, s: SliderScale, radius?: number): number {
  if (!detents?.length) return value;
  const log = s.scale === 'log';
  const r = radius ?? (log ? 0.015 : 1.5 * (s.step ?? (s.max - s.min) / 100));
  const ex = s.exclude ?? [];
  const exStep = s.step ?? (s.max - s.min) / 100;
  let best = value;
  let bestD = Infinity;
  for (const raw of detents) {
    const d = detentValue(raw);
    if (!(d >= s.min && d <= s.max)) continue;
    if (ex.some((e) => Math.abs(d - e) < exStep / 2)) continue;
    const dist = log ? Math.abs(sliderPosition(value, s) - sliderPosition(d, s)) : Math.abs(value - d);
    if (dist <= r && dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

/** Home/End: the smallest or largest value the slider can actually land on (snapped, never excluded). */
export function sliderExtreme(which: 'min' | 'max', s: SliderScale): number {
  return which === 'min' ? snapSliderValue(s.min, s, s.min - 1) : snapSliderValue(s.max, s, s.max + 1);
}
