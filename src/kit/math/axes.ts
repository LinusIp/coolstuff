/**
 * Axis ticks and compact number labels. For fixed-decimal readouts use
 * `formatNumber` from `@kit/notation` instead (tabular, never jitters).
 */
import { snapTo } from './scalar';

/** A "nice" step (1, 2 or 5 × 10^k) close to `rough`, for grid lines and ticks. */
export function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const f = rough / base;
  const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return m * base;
}

/** Multiples of step inside [min, max]. */
export function ticks(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !Number.isFinite(min) || !Number.isFinite(max) || (max - min) / step > 10000) return [];
  const out: number[] = [];
  for (let k = Math.ceil(min / step - 1e-9); k * step <= max + step * 1e-9; k++) out.push(snapTo(k * step, step / 1000));
  return out;
}

/** Decimal places needed to print multiples of `step` without noise. */
export const decimalsFor = (step: number): number => Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9)));

/**
 * Compact label: trims float noise and trailing zeros, uses a real minus sign
 * (U+2212), and switches to exponent notation for |x| ≥ 10⁶. "undefined" for NaN.
 */
export function fmt(x: number, digits = 2): string {
  if (Number.isNaN(x)) return 'undefined';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  let s: string;
  if (Math.abs(x) >= 1e6) s = x.toExponential(digits).replace('e+', 'e');
  else {
    s = x.toFixed(digits);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  if (s === '-0') s = '0';
  return s.replace(/^-/, '−');
}
