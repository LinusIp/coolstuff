/**
 * Eigenvectors and eigenvalues: the pure maths behind the visuals. Node-safe
 * (only @kit/math), so lesson.test.ts checks every function against known
 * values and against the kit's own eig2.
 *
 * The central picture: a matrix A sends an arrow v to Av. Measure how far
 * A turns the LINE through v (not the arrow: Av = −2v is still on v's line).
 * That turn is 0 exactly along the eigen-directions; sweeping v once round a
 * half-turn of directions draws the "turn curve", whose zeros are the
 * eigen-directions (two crossings, one touch for a shear, none for a
 * rotation).
 */
import { apply2, cross, dot, eig2, norm, type Mat2, type Vec2 } from '@kit/math';

const DEG = 180 / Math.PI;

// ── How A treats the line through v ─────────────────────────────────────────

/**
 * The signed angle, in degrees, from the line through v to the line through
 * Av, in (−90°, 90°]: positive = counter-clockwise. 0 exactly when Av lies on
 * v's own line, either way along it (Av = 3v and Av = −v both give 0), and 0
 * when Av = 0 (the zero vector lies on every line). NaN for v = 0, which has
 * no direction.
 */
export function turnDeg(A: Readonly<Mat2>, v: Readonly<Vec2>): number {
  const nv = norm(v);
  if (nv < 1e-12) return NaN;
  const w = apply2(A, v);
  const scale = Math.max(1, Math.abs(A[0]), Math.abs(A[1]), Math.abs(A[2]), Math.abs(A[3]));
  if (norm(w) < 1e-12 * scale * nv) return 0;
  let a = Math.atan2(cross(v, w), dot(v, w)) * DEG; // (−180°, 180°]
  if (a > 90) a -= 180;
  else if (a <= -90) a += 180;
  return a + 0; // no −0
}

/** The stretch factor along v's line: the λ with Av = λv when v is an eigenvector (the projection ratio v·Av / v·v otherwise). */
export function stretchAlong(A: Readonly<Mat2>, v: Readonly<Vec2>): number {
  const vv = dot(v, v);
  if (vv < 1e-24) return NaN;
  return dot(v, apply2(A, v)) / vv + 0;
}

/** Plain words for what A does along a kept line: "stretched ×3", "left as it is ×1", "flipped ×−1", "squashed to zero ×0". */
export function stretchWords(lambda: number): string {
  const r = Math.round(lambda * 100) / 100 + 0;
  const n = (Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2)).replace('-', '−');
  if (Math.abs(r) < 1e-9) return 'squashed to zero ×0';
  if (Math.abs(r - 1) < 1e-9) return 'left as it is ×1';
  if (Math.abs(r + 1) < 1e-9) return 'flipped ×−1';
  if (r < 0) return Math.abs(r) > 1 ? `flipped and stretched ×${n}` : `flipped and shrunk ×${n}`;
  return r > 1 ? `stretched ×${n}` : `shrunk ×${n}`;
}

// ── The eigen-directions, in the form the figures need ──────────────────────

export interface KeptLine {
  /** Unit direction, canonical sign (first nonzero component positive). */
  dir: Vec2;
  lambda: number;
  /** Direction of the line in degrees, [0°, 180°). */
  deg: number;
}

export type EigenPicture =
  | { kind: 'lines'; lines: KeptLine[] }
  | { kind: 'every'; lambda: number }
  | { kind: 'none'; re: number; im: number };

/** Every line A keeps (real eigen-directions), every line (A = λI), or none (a complex pair re ± i·im). */
export function eigenPicture(A: Readonly<Mat2>): EigenPicture {
  const e = eig2(A);
  if (!e.real) return { kind: 'none', re: e.values[0].re, im: Math.abs(e.values[0].im) };
  if (e.everyDirection) return { kind: 'every', lambda: e.values[0] };
  return { kind: 'lines', lines: e.vectors.map((dir) => ({ dir, lambda: stretchAlong(A, dir), deg: lineDeg(dir) })) };
}

/** The direction of the line through v, in degrees, [0°, 180°). */
export function lineDeg(v: Readonly<Vec2>): number {
  let d = Math.atan2(v[1], v[0]) * DEG;
  if (d < 0) d += 180;
  if (d >= 180 - 1e-12) d -= 180;
  return Math.abs(d) < 1e-12 ? 0 : d;
}

/** The unit vector at `deg` degrees. */
export const unitAt = (deg: number): Vec2 => [Math.cos(deg / DEG) + 0, Math.sin(deg / DEG) + 0];

/** The kept line within `tolDeg` of v's line, if any. */
export function keptLineNear(pic: EigenPicture, v: Readonly<Vec2>, tolDeg: number): KeptLine | null {
  if (pic.kind !== 'lines' || norm(v) < 1e-12) return null;
  const d = lineDeg(v);
  for (const l of pic.lines) if (lineGap(d, l.deg) <= tolDeg) return l;
  return null;
}

/** The angle between two line directions given in degrees (lines, so 0° and 180° are the same): [0°, 90°]. */
export function lineGap(a: number, b: number): number {
  const d = (((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
}

// ── Keeping the picture on the plate ────────────────────────────────────────

export interface PlateFit {
  /** Half-widths of the visible plate in world units. */
  hx: number;
  hy: number;
  /** Keep v at least this long (a tiny arrow has no visible direction). */
  minLength: number;
}

/**
 * The drag constraint for the input arrow: keep v's direction, but shorten it
 * so that both v and Av stay inside the plate, and lengthen it to at least
 * `minLength`. Along a direction A stretches ×3 the arrow can only be a third
 * as long as along one it leaves alone, which the learner feels as a soft
 * wall, never a jump.
 */
export function fitArrow(A: Readonly<Mat2>, p: Readonly<Vec2>, fit: PlateFit): Vec2 {
  const L = norm(p);
  const dir: Vec2 = L < 1e-9 ? [1, 0] : [p[0] / L, p[1] / L];
  const w = apply2(A, dir);
  const lim = (half: number, c: number) => (Math.abs(c) < 1e-12 ? Infinity : half / Math.abs(c));
  const maxLen = Math.min(lim(fit.hx, dir[0]), lim(fit.hy, dir[1]), lim(fit.hx, w[0]), lim(fit.hy, w[1]));
  const len = Math.min(Math.max(L, fit.minLength), Math.max(maxLen, fit.minLength * 0.5));
  return [dir[0] * len + 0, dir[1] * len + 0];
}

// ── Sweeping every direction: the turn curve and its explored trail ─────────

/** Bins of `BIN_DEG` degrees covering the half-turn [0°, 180°) of line directions. */
export const BIN_DEG = 2;
export const BIN_COUNT = 180 / BIN_DEG;

export const emptySweep = (): boolean[] => new Array<boolean>(BIN_COUNT).fill(false);

const binOf = (deg: number): number => Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((((deg % 180) + 180) % 180) / BIN_DEG)));

/**
 * Mark the directions passed through when v's line moves from `fromDeg` to
 * `toDeg` (the shorter way round, so a fast drag leaves no gaps). Returns the
 * same array when nothing new was explored (cheap equality for signals).
 */
export function sweep(bins: readonly boolean[], fromDeg: number | null, toDeg: number): readonly boolean[] {
  const to = binOf(toDeg);
  const marks: number[] = [];
  if (fromDeg === null) marks.push(to);
  else {
    const from = binOf(fromDeg);
    let delta = (to - from + BIN_COUNT) % BIN_COUNT;
    let dir = 1;
    if (delta > BIN_COUNT / 2) {
      delta = BIN_COUNT - delta;
      dir = -1;
    }
    for (let k = 0; k <= delta; k++) marks.push((from + dir * k + BIN_COUNT) % BIN_COUNT);
  }
  if (marks.every((b) => bins[b])) return bins;
  const out = bins.slice();
  for (const b of marks) out[b] = true;
  return out;
}

/** Fraction of directions explored, 0…1. */
export const coverage = (bins: readonly boolean[]): number => bins.filter(Boolean).length / bins.length;

/** The turn curve: the turn of each line direction θ ∈ [0°, 180°], sampled every `stepDeg` degrees. */
export function turnCurve(A: Readonly<Mat2>, stepDeg = 1): Vec2[] {
  const out: Vec2[] = [];
  for (let d = 0; d <= 180 + 1e-9; d += stepDeg) out.push([d, turnDeg(A, unitAt(d))]);
  return out;
}

/**
 * The explored part of the turn curve as polylines (one per explored run,
 * broken where the curve wraps between +90° and −90°), for the trail under
 * the main figure. Runs that touch both ends join across 180° = 0°.
 */
export function sweptRuns(A: Readonly<Mat2>, bins: readonly boolean[], samplesPerBin = 3): Vec2[][] {
  const runs: Vec2[][] = [];
  let cur: Vec2[] = [];
  const flush = () => {
    if (cur.length > 1) runs.push(cur);
    cur = [];
  };
  for (let b = 0; b < BIN_COUNT; b++) {
    if (!bins[b]) {
      flush();
      continue;
    }
    for (let s = 0; s <= samplesPerBin; s++) {
      if (s === 0 && cur.length) continue;
      const d = b * BIN_DEG + (BIN_DEG * s) / samplesPerBin;
      const t = turnDeg(A, unitAt(d));
      const prev = cur[cur.length - 1];
      if (prev && Math.abs(t - prev[1]) > 90) flush();
      cur.push([d, t]);
    }
  }
  flush();
  return runs;
}

// ── Matrices to play with ───────────────────────────────────────────────────

export interface PlayMatrix {
  id: 'stretch' | 'shear' | 'turn' | 'flip';
  /** Segmented-control label (words, no maths: the Play section has no formulas). */
  name: string;
  A: Mat2;
  /** A start for v that is visibly turned. */
  v0: Vec2;
}

/** The Play section's matrices: two kept lines, one (a shear), none (a quarter turn), and a flip (λ = −1). */
export const PLAY_MATRICES: readonly PlayMatrix[] = [
  { id: 'stretch', name: 'Stretch', A: [2, 1, 1, 2], v0: [1.4, 0.2] },
  { id: 'shear', name: 'Shear', A: [1, 1, 0, 1], v0: [0.6, 1.4] },
  { id: 'turn', name: 'Turn', A: [0, -1, 1, 0], v0: [1.6, 0.6] },
  { id: 'flip', name: 'Flip', A: [0, 1, 1, 0], v0: [1.6, 0.4] },
];

// ── Power iteration (the "simulate it" cell) ────────────────────────────────

/** One step of power iteration: Av, rescaled to length 1. */
export function powerStep(A: Readonly<Mat2>, v: Readonly<Vec2>): Vec2 {
  const w = apply2(A, v);
  const n = norm(w);
  return n < 1e-15 ? [0, 0] : [w[0] / n, w[1] / n];
}

/** v0, then n power-iteration steps (n + 1 unit vectors). */
export function powerIterates(A: Readonly<Mat2>, v0: Readonly<Vec2>, n: number): Vec2[] {
  const n0 = norm(v0);
  const out: Vec2[] = [n0 < 1e-15 ? [0, 0] : [v0[0] / n0, v0[1] / n0]];
  for (let k = 0; k < n; k++) out.push(powerStep(A, out[k]));
  return out;
}

// ── Judging a guess of the kept directions (the Hook's Predict) ─────────────

export interface DirectionVerdict {
  ok: boolean;
  /** For each guess (in order), the gap in degrees to the kept line it was matched with (NaN when there was none to match). */
  gaps: number[];
}

/**
 * Match guessed arrows to A's kept lines (best one-to-one pairing) and say
 * whether every kept line has a guess within `tolDeg`. Arrows count as lines,
 * so (−1, −1) is as good a guess as (1, 1). A matrix with no kept lines is
 * never "found" by a guess.
 */
export function judgeDirections(A: Readonly<Mat2>, guesses: readonly Readonly<Vec2>[], tolDeg: number): DirectionVerdict {
  const pic = eigenPicture(A);
  const lines = pic.kind === 'lines' ? pic.lines.map((l) => l.deg) : [];
  const g = guesses.map((v) => (norm(v) < 1e-9 ? NaN : lineDeg(v)));
  if (lines.length === 0 || g.length === 0) return { ok: false, gaps: g.map(() => NaN) };
  // Give every kept line its own guess, trying every assignment (a handful here: 2 lines × 2 guesses).
  let bestWorst = Infinity;
  let bestPick: number[] = [];
  const walk = (j: number, pick: number[]) => {
    if (j === lines.length) {
      const worst = Math.max(...pick.map((i, jj) => (Number.isNaN(g[i]) ? Infinity : lineGap(g[i], lines[jj]))));
      if (worst < bestWorst) {
        bestWorst = worst;
        bestPick = pick.slice();
      }
      return;
    }
    for (let i = 0; i < g.length; i++) if (!pick.includes(i)) walk(j + 1, [...pick, i]);
  };
  walk(0, []);
  const gaps = g.map((d, i) => {
    const j = bestPick.indexOf(i);
    return j < 0 || Number.isNaN(d) ? NaN : lineGap(d, lines[j]);
  });
  return { ok: g.length >= lines.length && bestWorst <= tolDeg, gaps };
}

/** The Hook's matrix (also Play's "Stretch"): î ↦ (2, 1), ĵ ↦ (1, 2); kept lines y = x (×3) and y = −x (×1). */
export const HOOK_A: Mat2 = [2, 1, 1, 2];
/** How close (degrees) a guessed direction must be to count. */
export const GUESS_TOL = 10;

/** "your arrows are 4° and 12° off the two kept directions" (for the Predict's verdict line). */
export function describeDirectionGuess(A: Readonly<Mat2>, guesses: readonly Readonly<Vec2>[]): string {
  const v = judgeDirections(A, guesses, GUESS_TOL);
  const shown = v.gaps.filter((x) => Number.isFinite(x)).map((x) => `${Math.round(x)}°`);
  if (shown.length === 0) return 'two arrows';
  return `arrows ${shown.join(' and ')} off the two directions A keeps`;
}
