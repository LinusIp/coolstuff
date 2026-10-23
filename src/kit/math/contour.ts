/**
 * Contour lines of f(x, y) by marching squares: contour maps (calc3), loss
 * landscapes (ML gradient descent), constraint curves (Lagrange), norm balls
 * (L1/L2), covariance ellipses. Pure; Plot's `contour` series draws the
 * result. Saddle cells are resolved by the cell-centre value, and segments
 * are joined into polylines through shared grid edges, so a closed level set
 * comes back as one closed loop (first point repeated at the end).
 */
import { niceStep, ticks } from './axes';
import type { Vec2 } from './vec';

export interface ContourView {
  x: readonly [number, number];
  y: readonly [number, number];
}

export interface ContourLevel {
  level: number;
  /** Polylines in world coordinates. Closed loops repeat their first point at the end. */
  lines: Vec2[][];
}

/**
 * Nice contour levels strictly inside [min, max]: about `n` of them on a
 * 1–2–5 step (so labels read 0.5, 1, 1.5 … rather than 0.4731).
 */
export function contourLevels(min: number, max: number, n = 8): number[] {
  if (!(max > min)) return [];
  const step = niceStep((max - min) / Math.max(1, n));
  return ticks(min, max, step).filter((v) => v > min && v < max);
}

/**
 * Sample f on a grid over `view` and trace each level.
 * `levels`: explicit values, or a count of nice levels between the sampled min and max.
 * `res`: cells along each axis (number) or [nx, ny]. Default 64.
 * Non-finite samples (poles, outside a domain) leave holes instead of garbage.
 */
export function contours(f: (x: number, y: number) => number, view: ContourView, levels: readonly number[] | number = 8, res: number | readonly [number, number] = 64): ContourLevel[] {
  const [nx, ny] = typeof res === 'number' ? [res, res] : res;
  const [x0, x1] = view.x;
  const [y0, y1] = view.y;
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  // v[j][i] = f(x_i, y_j), i = 0…nx, j = 0…ny.
  const v: number[][] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const z = f(x0 + i * dx, y0 + j * dy);
      row.push(z);
      if (Number.isFinite(z)) {
        if (z < lo) lo = z;
        if (z > hi) hi = z;
      }
    }
    v.push(row);
  }
  const lv = typeof levels === 'number' ? contourLevels(lo, hi, levels) : [...levels];
  return lv.map((level) => ({ level, lines: traceLevel(v, level, nx, ny, x0, y0, dx, dy) }));
}

/** Edge-crossing segments for one level, joined into polylines. */
function traceLevel(v: number[][], L: number, nx: number, ny: number, x0: number, y0: number, dx: number, dy: number): Vec2[][] {
  const pts = new Map<string, Vec2>();
  const adj = new Map<string, number[]>();
  const segs: [string, string][] = [];
  const t = (a: number, b: number) => (a === b ? 0.5 : (L - a) / (b - a));
  // Edge keys: h:i,j is the horizontal edge (i,j)–(i+1,j); v:i,j the vertical edge (i,j)–(i,j+1).
  const edgePoint = (key: string, i: number, j: number, horizontal: boolean): string => {
    if (!pts.has(key)) {
      if (horizontal) pts.set(key, [x0 + (i + t(v[j][i], v[j][i + 1])) * dx, y0 + j * dy]);
      else pts.set(key, [x0 + i * dx, y0 + (j + t(v[j][i], v[j + 1][i])) * dy]);
    }
    return key;
  };
  const addSeg = (a: string, b: string) => {
    const k = segs.push([a, b]) - 1;
    for (const e of [a, b]) {
      const l = adj.get(e);
      if (l) l.push(k);
      else adj.set(e, [k]);
    }
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = v[j][i];
      const b = v[j][i + 1];
      const c = v[j + 1][i + 1];
      const d = v[j + 1][i];
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) continue;
      const idx = (a >= L ? 1 : 0) | (b >= L ? 2 : 0) | (c >= L ? 4 : 0) | (d >= L ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const B = () => edgePoint(`h:${i},${j}`, i, j, true);
      const R = () => edgePoint(`v:${i + 1},${j}`, i + 1, j, false);
      const T = () => edgePoint(`h:${i},${j + 1}`, i, j + 1, true);
      const Lf = () => edgePoint(`v:${i},${j}`, i, j, false);
      const centreAbove = (a + b + c + d) / 4 >= L;
      switch (idx) {
        case 1:
        case 14:
          addSeg(Lf(), B());
          break;
        case 2:
        case 13:
          addSeg(B(), R());
          break;
        case 3:
        case 12:
          addSeg(Lf(), R());
          break;
        case 4:
        case 11:
          addSeg(R(), T());
          break;
        case 6:
        case 9:
          addSeg(B(), T());
          break;
        case 7:
        case 8:
          addSeg(Lf(), T());
          break;
        case 5: // a, c above
          if (centreAbove) {
            addSeg(B(), R());
            addSeg(T(), Lf());
          } else {
            addSeg(Lf(), B());
            addSeg(R(), T());
          }
          break;
        case 10: // b, d above
          if (centreAbove) {
            addSeg(Lf(), B());
            addSeg(R(), T());
          } else {
            addSeg(B(), R());
            addSeg(T(), Lf());
          }
          break;
      }
    }
  }
  // Join: open chains first (they start at a degree-1 edge point on the boundary or a hole), then loops.
  const used = new Array<boolean>(segs.length).fill(false);
  const lines: Vec2[][] = [];
  const walk = (start: string) => {
    const keys = [start];
    let cur = start;
    for (;;) {
      const k = (adj.get(cur) ?? []).find((s) => !used[s]);
      if (k === undefined) break;
      used[k] = true;
      cur = segs[k][0] === cur ? segs[k][1] : segs[k][0];
      keys.push(cur);
    }
    if (keys.length > 1) lines.push(keys.map((key) => pts.get(key)!));
  };
  for (const [key, list] of adj) if (list.length === 1 && !used[list[0]]) walk(key);
  for (let k = 0; k < segs.length; k++) if (!used[k]) walk(segs[k][0]);
  return lines;
}
