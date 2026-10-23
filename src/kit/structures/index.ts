/**
 * G5 — data structures & systems (README §9). Views render a state (types.ts
 * §8) and animate the change from the previous one; ArchDiagram runs the
 * pure, seeded `arch-sim`. The pure helpers (marks, text alternatives,
 * keyboard navigation, geometry, FLIP planning, the simulation) are exported
 * too, so lessons can test their traces against the same words and layouts.
 */
export * from './types';
export { ArrayView, type ArrayViewProps } from './ArrayView';
export { TreeView, type TreeViewProps } from './TreeView';
export { GraphView, type GraphViewProps } from './GraphView';
export { TableView, type TableViewProps } from './TableView';
export { ArchDiagram, metricsText, describeArch, type ArchDiagramProps } from './ArchDiagram';
export { createArchSim, histQuantile, DEFAULT_MAX_QUEUE, type ArchSim, type ArchSimOptions, type ArchHop, type ArchTotals } from './arch-sim';
export { MARK_STATES, MARK_WORDS, isMarkState, markInfo, markClass, conceptLabel, conceptLine, type MarkInfo } from './marks';
export {
  cellText,
  arrayCellLabel,
  summarizeArray,
  treeNodeLabel,
  summarizeTree,
  graphNodeLabel,
  graphEdgeLabel,
  summarizeGraph,
  tableCellLabel,
  summarizeTable,
} from './describe';
export { navLinear, navGrid, navTree, indexTree, graphSequence, type TreeIndex, type GraphItem } from './nav';
export {
  edgeKey,
  edgeMarkOf,
  treeGeometry,
  graphUnitPositions,
  graphBox,
  defaultGraphLayout,
  edgeGeometry,
  selfLoopGeometry,
  boxLinkGeometry,
  type GraphLayoutName,
  type TreeGeom,
  type EdgeGeom,
} from './geometry';
