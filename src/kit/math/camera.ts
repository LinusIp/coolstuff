/**
 * A tiny orbit camera for SVG/canvas 3D (Stage3D can draw surfaces without
 * three.js using this). World z points up.
 */
import { cross3, dot3, normalize3, sub3, type Vec3 } from './vec';

export interface OrbitBasis {
  /** Screen-right direction in world space. */
  right: Vec3;
  /** Screen-up direction in world space. */
  up: Vec3;
  /** Unit vector from the target toward the camera. */
  back: Vec3;
}

/**
 * Camera axes for an orbit view around a target, with world z pointing up.
 * azimuth: angle around z measured from +x (radians); elevation: angle above the xy-plane.
 */
export function orbitBasis(azimuth: number, elevation: number): OrbitBasis {
  const ce = Math.cos(elevation);
  const back: Vec3 = [ce * Math.cos(azimuth), ce * Math.sin(azimuth), Math.sin(elevation)];
  const right: Vec3 = normalize3([-Math.sin(azimuth), Math.cos(azimuth), 0]);
  const up = cross3(back, right);
  return { right, up, back };
}

/**
 * Project a world point into camera space: x right, y up, depth = distance
 * toward the camera (bigger = nearer). With `distance` finite the projection is
 * perspective with unit scale at the target plane; Infinity gives orthographic.
 */
export function projectOrbit(
  p: Readonly<Vec3>,
  basis: OrbitBasis,
  target: Readonly<Vec3> = [0, 0, 0],
  distance = Infinity,
): { x: number; y: number; depth: number; scale: number } {
  const rel = sub3(p, target);
  const x = dot3(rel, basis.right);
  const y = dot3(rel, basis.up);
  const depth = dot3(rel, basis.back);
  const s = Number.isFinite(distance) ? distance / Math.max(distance - depth, distance * 0.05) : 1;
  return { x: x * s, y: y * s, depth, scale: s };
}
