/**
 * G2 — visuals (README §6). Stage2D and its primitives, Plot, MatrixGrid.
 *
 * Stage3D (with its primitives and MatrixGrid3D) is NOT re-exported here:
 * import it from '@kit/visual/Stage3D' so only lessons that need 3D pay for it.
 */
export { Stage2D, type Stage2DProps } from './Stage2D';
export { useStage, type StageApi, type MaybeSignal, type Emphasis } from './context';
export {
  Vector,
  Segment,
  Line,
  Point,
  Curve,
  Polyline,
  Polygon,
  Label,
  Band,
  Arc,
  CanvasLayer,
  ConceptGroup,
  type MarkProps,
  type VectorProps,
  type SegmentProps,
  type LineProps,
  type PointProps,
  type CurveProps,
  type PolylineProps,
  type PolygonProps,
  type LabelProps,
  type BandProps,
  type ArcProps,
  type CanvasLayerProps,
} from './primitives';
export { Handle, type HandleProps } from './Handle';
export { Plot, type PlotProps, type PlotSeries, type Fn1, type Fn2 } from './Plot';
export { MatrixGrid, imageOf, imageValue, isWritableSignal, type MatrixGridProps, type MatrixGridVector } from './MatrixGrid';
export type { Constraint } from './constraints';
export {
  makeScale,
  fitView,
  normalizeView,
  sameView,
  panView,
  zoomView,
  zoomLevel,
  clampZoomFactor,
  gridStep,
  tickLabel,
  axisLayout,
  clipSegment,
  clipLine,
  arrowGeometry,
  polylinePath,
  anchorBox,
  anchorForDirection,
  clampToPlate,
  type StageScale,
  type AxisLayout,
  type AxisTick,
  type ClipRect,
  type LabelAnchor,
} from './scales';
