/**
 * G2 — visuals. Owned by G2 (see ../PLAN.md); add one export line per
 * component as it lands. Planned:
 *
 *   export { Stage2D, useStage, Vector, Segment, Line, Point, Curve, Polyline, Polygon,
 *            Label, Band, Arc, Handle, CanvasLayer, type Stage2DProps, type StageApi } from './Stage2D';
 *   export { Plot, type PlotProps, type PlotSeries } from './Plot';
 *   export { MatrixGrid, imageOf, type MatrixGridProps, type MatrixGridVector } from './MatrixGrid';
 *   export * from './scales';
 *
 * Stage3D (with its primitives and MatrixGrid3D) is NOT re-exported here (it
 * may pull in three.js): import it from '@kit/visual/Stage3D' so only lessons
 * that need 3D pay for it.
 */
export {};
