/**
 * The pure core of Stage3D (README §6.4): fitting the scene's bounds into
 * the plate for any camera, orbit projection (via `orbitBasis` /
 * `projectOrbit`), surface meshes built once per (f, x, y, resolution),
 * painter's-order sorting, Lambert shading, and MatrixGrid3D's geometry.
 * No DOM; tested in scene3d.test.ts.
 */
import { orbitBasis, projectOrbit, type OrbitBasis } from '../math/camera';
import { det3, IDENTITY3, lerpMat3, type Mat3 } from '../math/mat';
import { normalize3, type Vec3 } from '../math/vec';

export interface Bounds3 {
  x: readonly [number, number];
  y: readonly [number, number];
  z: readonly [number, number];
}

/** Camera angles in DEGREES; `distance` in units of the scene's bounding radius (default 4; Infinity = orthographic); `zoom` multiplies the fitted scale. */
export interface Camera3 {
  azimuth: number;
  elevation: number;
  distance?: number;
  zoom?: number;
}

export const DEFAULT_CAMERA: Camera3 = { azimuth: -60, elevation: 25 };

/** 'equal': one unit is the same length on every axis. 'cube': each axis is scaled to the same length (z to 0.8 of it), for surfaces whose z range differs wildly. */
export type BoxMode = 'equal' | 'cube';

export interface Normalizer {
  center: Vec3;
  /** World → normalized multipliers per axis. */
  scale: Vec3;
  /** Radius of the normalized bounding box (half its diagonal). */
  radius: number;
  to(p: Readonly<Vec3>): Vec3;
}

export function normalizer(b: Bounds3, box: BoxMode = 'equal'): Normalizer {
  const span = (r: readonly [number, number]) => Math.max(1e-9, Math.abs(r[1] - r[0]));
  const center: Vec3 = [(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2, (b.z[0] + b.z[1]) / 2];
  const sx = span(b.x);
  const sy = span(b.y);
  const sz = span(b.z);
  let scale: Vec3;
  if (box === 'cube') scale = [2 / sx, 2 / sy, 1.6 / sz];
  else {
    const m = 2 / Math.max(sx, sy, sz);
    scale = [m, m, m];
  }
  const half: Vec3 = [(sx * scale[0]) / 2, (sy * scale[1]) / 2, (sz * scale[2]) / 2];
  const radius = Math.hypot(half[0], half[1], half[2]);
  return {
    center,
    scale,
    radius,
    to: (p) => [(p[0] - center[0]) * scale[0], (p[1] - center[1]) * scale[1], (p[2] - center[2]) * scale[2]],
  };
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** Bigger = nearer the camera. */
  depth: number;
}

export interface Projector {
  W: number;
  H: number;
  /** Pixels per normalized unit at the target plane. */
  k: number;
  basis: OrbitBasis;
  norm: Normalizer;
  /** Camera distance in normalized units (Infinity = orthographic). */
  dist: number;
  project(p: Readonly<Vec3>): ScreenPoint;
  /** Project an already-normalized point. */
  projectN(p: Readonly<Vec3>): ScreenPoint;
  /** A screen-space drag (px, y down) as a world-space move in the plane facing the camera. */
  screenDeltaToWorld(dx: number, dy: number): Vec3;
  /** Light direction (normalized space) fixed to the camera: from the upper left, in front. */
  light: Vec3;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** The projector for a camera: the whole bounds fit the plate (with 8% margin) at zoom 1, from every angle. */
export function makeProjector(b: Bounds3, cam: Camera3, W: number, H: number, box: BoxMode = 'equal'): Projector {
  const norm = normalizer(b, box);
  const basis = orbitBasis(rad(cam.azimuth), rad(Math.max(-89.9, Math.min(89.9, cam.elevation))));
  const dist = (cam.distance ?? 4) * norm.radius;
  const persp = Number.isFinite(dist) ? dist / Math.max(dist - norm.radius, 1e-6) : 1;
  const k = ((0.92 * Math.min(W, H)) / (2 * norm.radius * persp)) * (cam.zoom ?? 1);
  const projectN = (p: Readonly<Vec3>): ScreenPoint => {
    const q = projectOrbit(p, basis, [0, 0, 0], dist);
    return { x: W / 2 + q.x * k, y: H / 2 - q.y * k, depth: q.depth };
  };
  const { right, up, back } = basis;
  const light = normalize3([back[0] * 0.75 + up[0] * 0.55 - right[0] * 0.35, back[1] * 0.75 + up[1] * 0.55 - right[1] * 0.35, back[2] * 0.75 + up[2] * 0.55 - right[2] * 0.35]);
  return {
    W,
    H,
    k,
    basis,
    norm,
    dist,
    project: (p) => projectN(norm.to(p)),
    projectN,
    screenDeltaToWorld: (dx, dy) => {
      const ux = dx / k;
      const uy = -dy / k;
      return [(right[0] * ux + up[0] * uy) / norm.scale[0], (right[1] * ux + up[1] * uy) / norm.scale[1], (right[2] * ux + up[2] * uy) / norm.scale[2]];
    },
    light,
  };
}

// ── Surfaces ────────────────────────────────────────────────────────────────

export interface SurfaceMesh {
  nx: number;
  ny: number;
  /** (nx+1)(ny+1) normalized vertex positions, xyz interleaved; NaN where f is undefined. */
  pos: Float64Array;
  /** Per quad (nx·ny): unit normal in normalized space, xyz interleaved. */
  normals: Float64Array;
  /** Per quad: height position 0…1 between zmin and zmax (for colouring). */
  height: Float64Array;
  /** Per vertex: height position 0…1 (NaN where undefined). */
  vheight: Float64Array;
  zmin: number;
  zmax: number;
}

/** Sample z = f(x, y) on an (nx+1) × (ny+1) grid, in normalized space. Built once per (f, x, y, resolution). */
export function buildSurface(f: (x: number, y: number) => number, xr: readonly [number, number], yr: readonly [number, number], nx: number, ny: number, norm: Normalizer): SurfaceMesh {
  const pos = new Float64Array((nx + 1) * (ny + 1) * 3);
  const raw = new Float64Array((nx + 1) * (ny + 1));
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = xr[0] + ((xr[1] - xr[0]) * i) / nx;
      const y = yr[0] + ((yr[1] - yr[0]) * j) / ny;
      let z: number;
      try {
        z = f(x, y);
      } catch {
        z = NaN;
      }
      const k = j * (nx + 1) + i;
      raw[k] = Number.isFinite(z) ? z : NaN;
      if (Number.isFinite(z)) {
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
      const n = norm.to([x, y, Number.isFinite(z) ? z : 0]);
      pos[k * 3] = n[0];
      pos[k * 3 + 1] = n[1];
      pos[k * 3 + 2] = Number.isFinite(z) ? n[2] : NaN;
    }
  }
  const normals = new Float64Array(nx * ny * 3);
  const height = new Float64Array(nx * ny);
  const span = zmax > zmin ? zmax - zmin : 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = (j * (nx + 1) + i) * 3;
      const b = a + 3;
      const d = a + (nx + 1) * 3;
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[d] - pos[a];
      const vy = pos[d + 1] - pos[a + 1];
      const vz = pos[d + 2] - pos[a + 2];
      let n0 = uy * vz - uz * vy;
      let n1 = uz * vx - ux * vz;
      let n2 = ux * vy - uy * vx;
      const L = Math.hypot(n0, n1, n2) || 1;
      n0 /= L;
      n1 /= L;
      n2 /= L;
      const q = j * nx + i;
      normals[q * 3] = n0;
      normals[q * 3 + 1] = n1;
      normals[q * 3 + 2] = n2;
      const k = j * (nx + 1) + i;
      const zs = [raw[k], raw[k + 1], raw[k + nx + 1], raw[k + nx + 2]].filter(Number.isFinite);
      height[q] = zs.length ? (zs.reduce((s, z) => s + z, 0) / zs.length - zmin) / span : 0;
    }
  }
  const vheight = new Float64Array((nx + 1) * (ny + 1));
  for (let k = 0; k < vheight.length; k++) vheight[k] = Number.isFinite(raw[k]) ? (raw[k] - zmin) / span : NaN;
  return { nx, ny, pos, normals, height, vheight, zmin: Number.isFinite(zmin) ? zmin : 0, zmax: Number.isFinite(zmax) ? zmax : 1 };
}

export interface SurfaceGeometryOptions {
  /** 256-entry RGB ramp (rampLUT) for colour by height; omit for a flat colour. */
  lut?: Uint8ClampedArray;
  /** Flat colour (0…255 rgb) when there is no ramp. */
  base: readonly [number, number, number];
  opacity?: number;
  /** Wireframe every n-th grid line in this rgba (0…1). */
  wire?: readonly [number, number, number, number];
  wireEvery?: number;
  /** Contour polylines in normalized space and their rgba. */
  contours?: readonly (readonly (readonly Vec3[])[])[];
  contourColor?: readonly [number, number, number, number];
}

/**
 * Triangles (smooth vertex normals, colour by height) plus wireframe and
 * contour line segments for a surface mesh: what the WebGL renderer uploads.
 * Quads touching an undefined vertex are left out.
 */
export function surfaceGeometry(m: SurfaceMesh, o: SurfaceGeometryOptions) {
  const nv = (m.nx + 1) * (m.ny + 1);
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 4);
  const a = o.opacity ?? 1;
  for (let k = 0; k < nv; k++) {
    pos[k * 3] = m.pos[k * 3];
    pos[k * 3 + 1] = m.pos[k * 3 + 1];
    pos[k * 3 + 2] = Number.isFinite(m.pos[k * 3 + 2]) ? m.pos[k * 3 + 2] : 0;
    const h = m.vheight[k];
    let rgb: readonly number[] = o.base;
    if (o.lut && Number.isFinite(h)) {
      const li = Math.round((0.18 + 0.78 * h) * 255) * 3;
      rgb = [o.lut[li], o.lut[li + 1], o.lut[li + 2]];
    }
    col[k * 4] = rgb[0] / 255;
    col[k * 4 + 1] = rgb[1] / 255;
    col[k * 4 + 2] = rgb[2] / 255;
    col[k * 4 + 3] = a;
  }
  // Vertex normals: the average of the adjacent quads' normals.
  const tris: number[] = [];
  for (let j = 0; j < m.ny; j++) {
    for (let i = 0; i < m.nx; i++) {
      const q = j * m.nx + i;
      const v = [j * (m.nx + 1) + i, j * (m.nx + 1) + i + 1, (j + 1) * (m.nx + 1) + i + 1, (j + 1) * (m.nx + 1) + i];
      if (v.some((k) => !Number.isFinite(m.pos[k * 3 + 2]))) continue;
      for (const k of v) {
        nrm[k * 3] += m.normals[q * 3];
        nrm[k * 3 + 1] += m.normals[q * 3 + 1];
        nrm[k * 3 + 2] += m.normals[q * 3 + 2];
      }
      tris.push(v[0], v[1], v[2], v[0], v[2], v[3]);
    }
  }
  for (let k = 0; k < nv; k++) {
    const L = Math.hypot(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]) || 1;
    nrm[k * 3] /= L;
    nrm[k * 3 + 1] /= L;
    nrm[k * 3 + 2] /= L;
  }
  const idx = nv < 65536 ? new Uint16Array(tris) : new Uint32Array(tris);
  const lp: number[] = [];
  const lc: number[] = [];
  const push = (p: Readonly<Vec3>, c: readonly number[]) => {
    lp.push(p[0], p[1], p[2]);
    lc.push(c[0], c[1], c[2], c[3]);
  };
  const ok = (k: number) => Number.isFinite(m.pos[k * 3 + 2]);
  const vtx = (k: number): Vec3 => [m.pos[k * 3], m.pos[k * 3 + 1], m.pos[k * 3 + 2]];
  if (o.wire) {
    const every = Math.max(1, o.wireEvery ?? Math.round(m.nx / 10));
    for (let j = 0; j <= m.ny; j++)
      for (let i = 0; i <= m.nx; i++) {
        const k = j * (m.nx + 1) + i;
        if (i % every === 0 && j < m.ny && ok(k) && ok(k + m.nx + 1)) {
          push(vtx(k), o.wire);
          push(vtx(k + m.nx + 1), o.wire);
        }
        if (j % every === 0 && i < m.nx && ok(k) && ok(k + 1)) {
          push(vtx(k), o.wire);
          push(vtx(k + 1), o.wire);
        }
      }
  }
  if (o.contours && o.contourColor)
    for (const level of o.contours)
      for (const ln of level)
        for (let k = 1; k < ln.length; k++) {
          push(ln[k - 1], o.contourColor);
          push(ln[k], o.contourColor);
        }
  return { pos, nrm, col, idx, lines: { pos: new Float32Array(lp), col: new Float32Array(lc) } };
}

/** Lambert term for a two-sided surface: 0.5 ambient + 0.5 diffuse. */
export function shade(n: Readonly<Vec3>, light: Readonly<Vec3>): number {
  return 0.5 + 0.5 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
}

/** Indices 0…n−1 ordered far → near (painter's order) by the given depths. */
export function painterOrder(depths: ArrayLike<number>): Uint32Array {
  const idx = new Uint32Array(depths.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  return idx.sort((a, b) => depths[a] - depths[b]);
}

/** Effective mesh resolution for a quality level 0…3 (QualityGovernor scales detail down to hold the frame rate). */
export function resolutionAt(resolution: number, quality: number): number {
  const f = [0.4, 0.6, 0.8, 1][Math.max(0, Math.min(3, Math.round(quality)))];
  return Math.max(6, Math.round(resolution * f));
}

// ── MatrixGrid3D geometry ───────────────────────────────────────────────────

/** The matrix shown at morph t (identity at 0). */
export function displayMatrix3(A: Readonly<Mat3>, t?: number): Mat3 {
  if (t === undefined) return [...A] as Mat3;
  return lerpMat3(IDENTITY3, A, Math.min(1, Math.max(0, t)));
}

const ap3 = (M: Readonly<Mat3>, x: number, y: number, z: number): Vec3 => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];

/** The images of the integer lattice lines through [−R, R]³ (3 directions × (2R+1)² lines), as world segments. */
export function latticeLines3(M: Readonly<Mat3>, R: number): [Vec3, Vec3][] {
  const out: [Vec3, Vec3][] = [];
  for (let a = -R; a <= R; a++) {
    for (let b = -R; b <= R; b++) {
      out.push([ap3(M, -R, a, b), ap3(M, R, a, b)]);
      out.push([ap3(M, a, -R, b), ap3(M, a, R, b)]);
      out.push([ap3(M, a, b, -R), ap3(M, a, b, R)]);
    }
  }
  return out;
}

/** The unit cube's image: 6 faces (each 4 corners), the parallelepiped spanned by the columns. */
export function parallelepipedFaces(M: Readonly<Mat3>): Vec3[][] {
  const c = (x: number, y: number, z: number) => ap3(M, x, y, z);
  return [
    [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)],
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)],
    [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)],
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)],
  ];
}

export interface VolumeNote {
  det: number;
  flipped: boolean;
  flat: boolean;
  words: string;
}

/** The determinant as volume scaling in words (README §6.4). */
export function volumeNote(M: Readonly<Mat3>, tol = 1e-9): VolumeNote {
  const det = det3(M);
  const flat = Math.abs(det) < tol;
  const n = (Math.abs(det) < 0.005 ? 0 : det).toFixed(2).replace('-', '−');
  if (flat) return { det: 0, flipped: false, flat, words: 'volume 0: space squashed onto a plane (or line)' };
  if (det < 0) return { det, flipped: true, flat, words: `volume × ${n.replace('−', '')}, orientation flipped` };
  return { det, flipped: false, flat, words: `volume × ${n}` };
}

/** The 3×3 stepper names, row-major. */
export const ENTRY_NAMES_3 = ['row 1, column 1', 'row 1, column 2', 'row 1, column 3', 'row 2, column 1', 'row 2, column 2', 'row 2, column 3', 'row 3, column 1', 'row 3, column 2', 'row 3, column 3'] as const;

/** M with column k replaced. */
export function withColumn3(M: Readonly<Mat3>, k: 0 | 1 | 2, v: Readonly<Vec3>): Mat3 {
  const out = [...M] as Mat3;
  out[k] = v[0];
  out[3 + k] = v[1];
  out[6 + k] = v[2];
  return out;
}

export const columnOf3 = (M: Readonly<Mat3>, k: 0 | 1 | 2): Vec3 => [M[k], M[3 + k], M[6 + k]];

/** Parse an SVG dasharray ("6 2.4") into numbers for canvas `setLineDash`. */
export function dashArray(d: string | null): number[] {
  return d ? d.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x)) : [];
}
