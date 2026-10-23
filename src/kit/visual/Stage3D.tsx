/**
 * '@kit/visual/Stage3D': Stage3D, its primitives and MatrixGrid3D (README
 * §6.4). Kept out of the '@kit' barrel so only lessons that need 3D pay for
 * it. No three.js: a canvas renderer on the kit's orbit camera (see
 * stage3d-core.tsx and PLAN.md G2 for why).
 */
export {
  Stage3D,
  Surface,
  Point3D,
  Points3D,
  Polyline3D,
  Vector3D,
  Curve3D,
  Plane3D,
  VectorField3D,
  DEFAULT_CAMERA,
  type Stage3DProps,
  type SurfaceProps,
  type Point3DProps,
  type Points3DProps,
  type Polyline3DProps,
  type Vector3DProps,
  type Curve3DProps,
  type Plane3DProps,
  type VectorField3DProps,
  type V3,
  type V3s,
  type Bounds3,
  type Camera3,
  type BoxMode,
  type Drawable3D,
  type Batch,
  type Palette,
} from './stage3d-core';
export { MatrixGrid3D, imageOf3, type MatrixGrid3DProps, type MatrixGrid3DVector } from './MatrixGrid3D';
