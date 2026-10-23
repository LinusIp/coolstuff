import { describe, expect, it } from 'vitest';
import { det3, type Mat3 } from '../math/mat';
import { buildSurface, surfaceGeometry, dashArray, displayMatrix3, latticeLines3, makeProjector, normalizer, painterOrder, parallelepipedFaces, resolutionAt, shade, volumeNote, withColumn3, columnOf3 } from './scene3d';

const B = { x: [-3, 3], y: [-2, 2], z: [0, 5] } as const;

describe('normalizer', () => {
  it('equal: one scale for every axis, largest span → [−1, 1]', () => {
    const n = normalizer(B);
    expect(n.scale).toEqual([1 / 3, 1 / 3, 1 / 3]);
    n.to([3, 2, 5]).forEach((v, i) => expect(v).toBeCloseTo([1, 2 / 3, 2.5 / 3][i], 12));
  });
  it('cube: every axis the same length (z a little shorter)', () => {
    const n = normalizer(B, 'cube');
    expect(n.to([3, 2, 5])).toEqual([1, 1, 0.8]);
    expect(n.radius).toBeCloseTo(Math.hypot(1, 1, 0.8));
  });
});

describe('makeProjector', () => {
  const corners = (b: typeof B) => {
    const out: [number, number, number][] = [];
    for (const x of b.x) for (const y of b.y) for (const z of b.z) out.push([x, y, z]);
    return out;
  };
  it('the default camera shows the whole bounds, and so does every other angle', () => {
    for (const [az, el] of [[-60, 25], [0, 0], [45, 80], [170, -30], [90, 10]]) {
      const P = makeProjector(B, { azimuth: az, elevation: el }, 600, 400);
      for (const c of corners(B)) {
        const s = P.project(c);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(600);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(400);
      }
    }
  });
  it('the centre of the bounds projects to the middle of the plate', () => {
    const P = makeProjector(B, { azimuth: 30, elevation: 20 }, 600, 400);
    const s = P.project([0, 0, 2.5]);
    expect(s.x).toBeCloseTo(300);
    expect(s.y).toBeCloseTo(200);
  });
  it('depth grows toward the camera; up is up on screen', () => {
    const P = makeProjector(B, { azimuth: 0, elevation: 0, distance: Infinity }, 600, 400);
    // azimuth 0: the camera sits on +x looking back at the origin.
    expect(P.project([3, 0, 2.5]).depth).toBeGreaterThan(P.project([-3, 0, 2.5]).depth);
    expect(P.project([0, 0, 5]).y).toBeLessThan(P.project([0, 0, 0]).y);
  });
  it('a screen drag maps back to a world move in the camera plane', () => {
    const P = makeProjector(B, { azimuth: -60, elevation: 25, distance: Infinity }, 600, 400);
    const p: [number, number, number] = [1, 0.5, 2];
    const d = P.screenDeltaToWorld(30, -20);
    const a = P.project(p);
    const b = P.project([p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
    expect(b.x - a.x).toBeCloseTo(30, 6);
    expect(b.y - a.y).toBeCloseTo(-20, 6);
  });
  it('zoom scales about the centre', () => {
    const P1 = makeProjector(B, { azimuth: 0, elevation: 30 }, 600, 400);
    const P2 = makeProjector(B, { azimuth: 0, elevation: 30, zoom: 2 }, 600, 400);
    expect(P2.k).toBeCloseTo(2 * P1.k);
  });
});

describe('surfaces', () => {
  const n = normalizer({ x: [-1, 1], y: [-1, 1], z: [0, 2] });
  it('a bowl: vertex count, z range, upward normals at the bottom', () => {
    const m = buildSurface((x, y) => x * x + y * y, [-1, 1], [-1, 1], 10, 10, n);
    expect(m.pos.length).toBe(11 * 11 * 3);
    expect(m.zmin).toBeCloseTo(0);
    expect(m.zmax).toBeCloseTo(2);
    const mid = 5 * 10 + 5; // a quad touching the bottom
    expect(Math.abs(m.normals[mid * 3 + 2])).toBeGreaterThan(0.9);
    expect(m.height.every((h) => h >= 0 && h <= 1)).toBe(true);
  });
  it('undefined points become holes (NaN), not garbage', () => {
    const m = buildSurface((x, y) => (x > 0.5 ? NaN : x + y), [-1, 1], [-1, 1], 4, 4, n);
    expect(Number.isNaN(m.pos[4 * 3 + 2])).toBe(true);
  });
  it('shading is two-sided and bounded; painter order is far → near', () => {
    expect(shade([0, 0, 1], [0, 0, 1])).toBe(1);
    expect(shade([0, 0, -1], [0, 0, 1])).toBe(1);
    expect(shade([1, 0, 0], [0, 0, 1])).toBe(0.5);
    expect([...painterOrder([3, -1, 2])]).toEqual([1, 2, 0]);
  });
  it('quality levels scale the resolution down, never below 6', () => {
    expect(resolutionAt(60, 3)).toBe(60);
    expect(resolutionAt(60, 0)).toBe(24);
    expect(resolutionAt(10, 0)).toBe(6);
  });
});

describe('MatrixGrid3D geometry', () => {
  const M: Mat3 = [1, 1, 0, 0, 2, 0, 0, 0, -1];
  it('morph from the identity', () => {
    expect(displayMatrix3(M, 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(displayMatrix3(M, 1)).toEqual(M);
  });
  it('lattice lines: 3 directions × (2R+1)²', () => {
    expect(latticeLines3(M, 1)).toHaveLength(27);
  });
  it('the parallelepiped faces are spanned by the columns; its volume is |det|', () => {
    const f = parallelepipedFaces(M);
    expect(f).toHaveLength(6);
    expect(f[1][0]).toEqual(columnOf3(M, 2));
    // volume from the three edges at the origin
    const [a, b, c] = [f[0][1], f[0][3], f[1][0]];
    const triple = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    expect(triple).toBeCloseTo(det3(M));
  });
  it('volume in words: scale, flip, collapse', () => {
    expect(volumeNote(M)).toMatchObject({ det: -2, flipped: true, words: 'volume × 2.00, orientation flipped' });
    expect(volumeNote([2, 0, 0, 0, 1, 0, 0, 0, 1]).words).toBe('volume × 2.00');
    expect(volumeNote([1, 2, 3, 2, 4, 6, 0, 0, 1])).toMatchObject({ flat: true, words: 'volume 0: space squashed onto a plane (or line)' });
  });
  it('columns', () => {
    expect(withColumn3(M, 1, [7, 8, 9])).toEqual([1, 7, 0, 0, 8, 0, 0, 9, -1]);
  });
  it('dash arrays parse for canvas', () => {
    expect(dashArray('6 2.4')).toEqual([6, 2.4]);
    expect(dashArray(null)).toEqual([]);
  });
});

describe('surfaceGeometry (what WebGL uploads)', () => {
  const n = normalizer({ x: [-1, 1], y: [-1, 1], z: [0, 2] });
  it('two triangles per defined quad, unit vertex normals, colours from the ramp', () => {
    const m = buildSurface((x, y) => x * x + y * y, [-1, 1], [-1, 1], 8, 8, n);
    const lut = new Uint8ClampedArray(256 * 3).map((_, i) => Math.floor(i / 3));
    const g = surfaceGeometry(m, { lut, base: [0, 0, 0], wire: [0, 0, 0, 0.2], wireEvery: 4, contours: [[[[0, 0, 0], [0.1, 0, 0], [0.2, 0.1, 0]]]], contourColor: [1, 0, 0, 1] });
    expect(g.idx.length).toBe(8 * 8 * 6);
    expect(g.idx).toBeInstanceOf(Uint16Array);
    for (let k = 0; k < g.nrm.length / 3; k++) expect(Math.hypot(g.nrm[k * 3], g.nrm[k * 3 + 1], g.nrm[k * 3 + 2])).toBeCloseTo(1, 5);
    // the lowest vertex (centre) gets the start of the ramp, the corners the end
    const centre = 4 * 9 + 4;
    expect(g.col[centre * 4]).toBeLessThan(g.col[0]);
    // wire: lines at i, j ∈ {0, 4, 8}: 3 columns × 8 + 3 rows × 8 segments; plus 2 contour segments
    expect(g.lines.pos.length / 6).toBe(3 * 8 + 3 * 8 + 2);
  });
  it('quads touching a hole are dropped', () => {
    const m = buildSurface((x, y) => (x > 0.6 ? NaN : x + y), [-1, 1], [-1, 1], 4, 4, n);
    const g = surfaceGeometry(m, { base: [10, 20, 30] });
    expect(g.idx.length).toBe(3 * 4 * 6);
    expect([...g.col.slice(0, 3)].map((x) => Math.round(x * 255))).toEqual([10, 20, 30]);
  });
});
