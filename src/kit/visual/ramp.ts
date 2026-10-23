/**
 * Colour ramps for heat maps and height-coloured surfaces (README §6.2): a
 * sequential ramp from the plate colour to the concept's ink, and a
 * diverging one through the plate colour (negative side in a neutral warm
 * ink, positive side in the concept's ink), so hue keeps meaning "this
 * concept". Pure (tested in ramp.test.ts): canvas code reads the bytes.
 */
import { parseHex } from '../theme';

export type RampScheme = 'sequential' | 'diverging';

/** A 256-entry RGB lookup table. `from` is t = 0, `to` is t = 1; diverging passes through `mid` at t = 0.5. */
export function rampLUT(scheme: RampScheme, from: string, to: string, mid?: string): Uint8ClampedArray {
  const a = parseHex(from);
  const b = parseHex(to);
  const m = parseHex(mid ?? from);
  const lut = new Uint8ClampedArray(256 * 3);
  // Mix in linear light so the middle of a ramp isn't muddy.
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const enc = (l: number) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
  const mixc = (p: readonly number[], q: readonly number[], t: number, k: number) => enc(lin(p[k]) + (lin(q[k]) - lin(p[k])) * t);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    for (let k = 0; k < 3; k++) {
      if (scheme === 'sequential') lut[i * 3 + k] = mixc(a, b, t, k);
      else lut[i * 3 + k] = t < 0.5 ? mixc(a, m, t * 2, k) : mixc(m, b, (t - 0.5) * 2, k);
    }
  }
  return lut;
}

/** Where a value falls on the ramp (0…1). Diverging ramps centre 0 when the range straddles it (symmetric), else the midpoint. */
export function rampPosition(v: number, min: number, max: number, scheme: RampScheme): number {
  if (!Number.isFinite(v)) return NaN;
  if (!(max > min)) return 0.5;
  if (scheme === 'diverging' && min < 0 && max > 0) {
    const r = Math.max(-min, max);
    return Math.min(1, Math.max(0, 0.5 + v / (2 * r)));
  }
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/**
 * RGBA pixels for a grid of values (row 0 = the BOTTOM row of the plot), in
 * canvas order (row 0 = top). Non-finite values are transparent.
 */
export function heatPixels(values: ArrayLike<number>, nx: number, ny: number, min: number, max: number, lut: Uint8ClampedArray, scheme: RampScheme, alpha = 255): Uint8ClampedArray {
  const out = new Uint8ClampedArray(nx * ny * 4);
  for (let j = 0; j < ny; j++) {
    const row = ny - 1 - j;
    for (let i = 0; i < nx; i++) {
      const t = rampPosition(values[j * nx + i], min, max, scheme);
      const o = (row * nx + i) * 4;
      if (Number.isNaN(t)) continue;
      const k = Math.round(t * 255) * 3;
      out[o] = lut[k];
      out[o + 1] = lut[k + 1];
      out[o + 2] = lut[k + 2];
      out[o + 3] = alpha;
    }
  }
  return out;
}

/** CSS colour stops for a ramp key (a few evenly spaced samples of the LUT). */
export function rampStops(lut: Uint8ClampedArray, n = 5): string[] {
  const out: string[] = [];
  for (let s = 0; s < n; s++) {
    const k = Math.round((s / (n - 1)) * 255) * 3;
    out.push(`rgb(${lut[k]}, ${lut[k + 1]}, ${lut[k + 2]})`);
  }
  return out;
}
