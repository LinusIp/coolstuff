/**
 * Ready-made `parse` functions for CodeCell outputs (README §7.6): each takes
 * whatever learner code emitted and returns the value a visual can draw, or
 * throws an Error whose message the cell shows under the code. Pure.
 *
 *   outputs={{ path: codeOutput(path, parsePoints, 'last'), loss: codeOutput(loss, parseNumber) }}
 */

const what = (v: unknown): string => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `a list of ${v.length}`;
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  return typeof v === 'object' ? 'an object' : typeof v === 'string' ? `the text ${JSON.stringify(v.length > 20 ? v.slice(0, 19) + '…' : v)}` : `${typeof v} ${String(v)}`;
};

/** A finite number. */
export function parseNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  throw new Error(`expected a number, got ${what(v)}`);
}

/** A list of finite numbers (a series, a histogram). */
export function parseNumbers(v: unknown): number[] {
  if (!Array.isArray(v)) throw new Error(`expected a list of numbers, got ${what(v)}`);
  return v.map((x, k) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`expected a list of numbers, but item ${k} is ${what(x)}`);
    return x;
  });
}

/** A 2D vector [x, y]. */
export function parseVec2(v: unknown): [number, number] {
  if (!Array.isArray(v) || v.length !== 2) throw new Error(`expected a vector [x, y], got ${what(v)}`);
  const [x, y] = v;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`expected a vector [x, y] of numbers, got [${what(x)}, ${what(y)}]`);
  return [x, y];
}

/** A list of [x, y] points (a path, a scatter). Objects {x, y} are accepted too. */
export function parsePoints(v: unknown): [number, number][] {
  if (!Array.isArray(v)) throw new Error(`expected a list of [x, y] points, got ${what(v)}`);
  return v.map((p, k) => {
    const pt = p && typeof p === 'object' && !Array.isArray(p) && 'x' in p && 'y' in p ? [(p as { x: unknown }).x, (p as { y: unknown }).y] : p;
    try {
      return parseVec2(pt);
    } catch {
      throw new Error(`expected a list of [x, y] points, but item ${k} is ${what(p)}`);
    }
  });
}

/**
 * A 2×2 matrix as the kit's Mat2 [a, b, c, d] (row-major). Accepts
 * [[a, b], [c, d]] (rows) or a flat [a, b, c, d].
 */
export function parseMat2(v: unknown): [number, number, number, number] {
  let flat: unknown[] | null = null;
  if (Array.isArray(v) && v.length === 2 && Array.isArray(v[0]) && Array.isArray(v[1]) && v[0].length === 2 && v[1].length === 2) flat = [...v[0], ...v[1]];
  else if (Array.isArray(v) && v.length === 4) flat = v;
  if (!flat) throw new Error(`expected a 2×2 matrix [[a, b], [c, d]], got ${what(v)}`);
  if (!flat.every((x) => typeof x === 'number' && Number.isFinite(x))) throw new Error('expected a 2×2 matrix of numbers');
  return flat as [number, number, number, number];
}
