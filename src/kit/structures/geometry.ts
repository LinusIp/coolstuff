/**
 * Pixel geometry for the data-structure views: tree and graph layouts placed
 * in a box, edges trimmed to their nodes with arrowheads, bends for
 * two-way pairs, self-loops, and links between boxes (ArchDiagram). Pure
 * (no DOM) and unit-tested; the abstract layouts come from `math/layout.ts`.
 */
import { circleLayout, forceLayout, layeredLayout, layoutInorder, layoutTidy, type TreeNode } from '../math/layout';
import type { GraphSpec, Mark } from '../types';

export type Pt = readonly [number, number];

/** "from->to": how edges are keyed in marks and click handlers (README §9.3). */
export const edgeKey = (from: string, to: string): string => `${from}->${to}`;

/** The mark of an edge; an undirected edge also answers to "to->from". */
export function edgeMarkOf(marks: Readonly<Record<string, Mark>> | undefined, from: string, to: string, directed: boolean): Mark | undefined {
  if (!marks) return undefined;
  return marks[edgeKey(from, to)] ?? (directed ? undefined : marks[edgeKey(to, from)]);
}

const r1 = (x: number): number => Math.round(x * 10) / 10;
const fmtPt = (p: Pt): string => `${r1(p[0])} ${r1(p[1])}`;

// ── Trees ─────────────────────────────────────────────────────────────────

/** Width of a node box: a circle of `node` px, or a pill when the label needs more room. */
export function nodeWidth(label: string, node: number): number {
  return Math.max(node, Math.ceil(label.length * 9.2 + 20));
}

export interface TreeNodeGeom {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Box width (≥ node size). */
  w: number;
  depth: number;
  parent: string | null;
}

export interface TreeGeom {
  nodes: TreeNodeGeom[];
  /** Parent → child, keyed "parentId->childId". */
  edges: { key: string; from: string; to: string }[];
  width: number;
  height: number;
}

export interface TreeGeomOptions {
  /** Node diameter (px). */
  node: number;
  /** Horizontal gap between neighbouring slots; default 35% of the node. */
  gap?: number;
  /** Distance between levels; default node + 36. */
  level?: number;
  /** Padding around the drawing; default 12. */
  pad?: number;
  /** Extra room on the right for badges; default 0. */
  right?: number;
}

/** Place a tree: `tidy` (parents over children) or `inorder` (BST order, left to right). */
export function treeGeometry(root: TreeNode | null, layout: 'tidy' | 'inorder', o: TreeGeomOptions): TreeGeom {
  const laid = layout === 'inorder' ? layoutInorder(root) : layoutTidy(root);
  if (laid.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
  const labels = new Map<string, string>();
  const walk = (n: TreeNode | null | undefined) => {
    if (!n) return;
    labels.set(n.id, n.label ?? n.id);
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  const pad = o.pad ?? 12;
  const gap = o.gap ?? Math.round(o.node * 0.35);
  const level = o.level ?? o.node + 36;
  const widths = laid.map((n) => nodeWidth(labels.get(n.id) ?? n.id, o.node));
  const maxW = Math.max(...widths);
  const slot = maxW + gap;
  const xs = laid.map((n) => n.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxDepth = Math.max(...laid.map((n) => n.depth));
  const nodes = laid.map((n, i) => ({
    id: n.id,
    label: labels.get(n.id) ?? n.id,
    x: pad + maxW / 2 + (n.x - minX) * slot,
    y: pad + o.node / 2 + n.depth * level,
    w: widths[i],
    depth: n.depth,
    parent: n.parent,
  }));
  const edges = laid.filter((n) => n.parent !== null).map((n) => ({ key: edgeKey(n.parent!, n.id), from: n.parent!, to: n.id }));
  return {
    nodes,
    edges,
    width: Math.ceil(2 * pad + maxW + (maxX - minX) * slot + (o.right ?? 0)),
    height: Math.ceil(2 * pad + o.node + maxDepth * level),
  };
}

// ── Graphs ────────────────────────────────────────────────────────────────

export type GraphLayoutName = 'given' | 'force' | 'layered' | 'circle';

/** README §9.3: 'given' when every node has x and y, else 'force'. */
export function defaultGraphLayout(g: GraphSpec): GraphLayoutName {
  return g.nodes.length > 0 && g.nodes.every((n) => n.x !== undefined && n.y !== undefined) ? 'given' : 'force';
}

/** Node positions in the unit square (y down) for a layout. Deterministic. */
export function graphUnitPositions(g: GraphSpec, layout: GraphLayoutName, seed = 7): Map<string, [number, number]> {
  switch (layout) {
    case 'given':
    case 'force':
      // forceLayout pins nodes that have x/y, so 'given' with a few missing still works.
      return forceLayout(g, { seed });
    case 'circle':
      return circleLayout(g.nodes.map((n) => n.id));
    case 'layered': {
      const L = layeredLayout(g);
      const maxLayer = Math.max(0, ...[...L.values()].map((n) => n.layer));
      const counts = new Map<number, number>();
      for (const n of L.values()) counts.set(n.layer, (counts.get(n.layer) ?? 0) + 1);
      const maxCount = Math.max(1, ...counts.values());
      const out = new Map<string, [number, number]>();
      for (const n of L.values()) {
        const count = counts.get(n.layer) ?? 1;
        const x = maxLayer === 0 ? 0.5 : n.layer / maxLayer;
        const y = maxCount === 1 ? 0.5 : (n.order + (maxCount - count) / 2) / (maxCount - 1);
        out.set(n.id, [x, y]);
      }
      return out;
    }
  }
}

export interface GraphBox {
  width: number;
  height: number;
  /** Inset of node centres from the edges (room for the node, badges and loops). */
  pad: number;
}

/**
 * The drawing box for a graph: at least wide enough that nodes don't crowd
 * (phones then scroll inside the view's own box), else the available width.
 */
export function graphBox(g: GraphSpec, layout: GraphLayoutName, available: number, o: { node?: number; aspect?: number } = {}): GraphBox {
  const node = o.node ?? 44;
  const n = g.nodes.length;
  const pad = Math.round(node / 2 + 22);
  if (layout === 'layered') {
    const L = layeredLayout(g);
    const layers = Math.max(0, ...[...L.values()].map((x) => x.layer)) + 1;
    const counts = new Map<number, number>();
    for (const x of L.values()) counts.set(x.layer, (counts.get(x.layer) ?? 0) + 1);
    const maxCount = Math.max(1, ...counts.values());
    const width = Math.max(available, layers * (node + 64) + 2 * pad - (node + 64) + node);
    const height = o.aspect ? Math.round(width * o.aspect) : Math.max(160, (maxCount - 1) * (node + 34) + 2 * pad);
    return { width: Math.round(width), height, pad };
  }
  const minW = Math.max(300, Math.ceil(Math.sqrt(Math.max(1, n)) * (node + 46)));
  const width = Math.max(available, minW);
  const aspect = o.aspect ?? (layout === 'circle' ? 0.86 : 0.62);
  const height = Math.round(Math.min(Math.max(width * aspect, 2 * pad + node), Math.max(560, minW * aspect)));
  return { width: Math.round(width), height, pad };
}

/** Unit square → pixels inside the box. */
export function placeUnit(p: Pt, box: GraphBox): [number, number] {
  return [box.pad + p[0] * (box.width - 2 * box.pad), box.pad + p[1] * (box.height - 2 * box.pad)];
}

/** Pixels → unit square (clamped), for dragging nodes. */
export function unitFromPixel(p: Pt, box: GraphBox): [number, number] {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return [c((p[0] - box.pad) / Math.max(1, box.width - 2 * box.pad)), c((p[1] - box.pad) / Math.max(1, box.height - 2 * box.pad))];
}

/** A directed edge whose reverse also exists is drawn bent, so the pair doesn't overlap. */
export function hasReverse(g: GraphSpec, from: string, to: string): boolean {
  return !!g.directed && from !== to && g.edges.some((e) => e.from === to && e.to === from);
}

export interface EdgeGeom {
  /** Path for the stroke (ends where the arrowhead begins). Empty when the nodes overlap. */
  d: string;
  /** Arrowhead triangle path, or null. */
  head: string | null;
  /** Where a weight label sits. */
  mid: [number, number];
}

/**
 * An edge between two round nodes: trimmed to their radii, straight or bent
 * by `bend` px to the left of the direction of travel, with an arrowhead of
 * `arrow` px at the end (0 = none).
 */
export function edgeGeometry(a: Pt, b: Pt, o: { r1: number; r2: number; bend?: number; arrow?: number }): EdgeGeom {
  const bend = o.bend ?? 0;
  const arrow = o.arrow ?? 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const mid0: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (len < o.r1 + o.r2 + 1) return { d: '', head: null, mid: mid0 };
  const u: Pt = [dx / len, dy / len];
  const n: Pt = [-u[1], u[0]]; // left normal (screen y down → this is to the right visually; consistent per direction)
  const unit = (p: Pt, q: Pt): Pt => {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
  };
  const head = (tip: Pt, t: Pt): string => {
    const base: Pt = [tip[0] - t[0] * arrow, tip[1] - t[1] * arrow];
    const w = arrow * 0.55;
    return `M${fmtPt(tip)}L${fmtPt([base[0] - t[1] * w, base[1] + t[0] * w])}L${fmtPt([base[0] + t[1] * w, base[1] - t[0] * w])}Z`;
  };
  if (bend === 0) {
    const start: Pt = [a[0] + u[0] * o.r1, a[1] + u[1] * o.r1];
    const tip: Pt = [b[0] - u[0] * o.r2, b[1] - u[1] * o.r2];
    const end: Pt = arrow ? [tip[0] - u[0] * arrow * 0.8, tip[1] - u[1] * arrow * 0.8] : tip;
    return { d: `M${fmtPt(start)}L${fmtPt(end)}`, head: arrow ? head(tip, u) : null, mid: [(start[0] + tip[0]) / 2, (start[1] + tip[1]) / 2] };
  }
  const c: Pt = [mid0[0] + n[0] * bend, mid0[1] + n[1] * bend];
  const ua = unit(a, c);
  const ub = unit(b, c);
  const start: Pt = [a[0] + ua[0] * o.r1, a[1] + ua[1] * o.r1];
  const tip: Pt = [b[0] + ub[0] * o.r2, b[1] + ub[1] * o.r2];
  const t = unit(c, tip);
  const end: Pt = arrow ? [tip[0] - t[0] * arrow * 0.8, tip[1] - t[1] * arrow * 0.8] : tip;
  const mid: [number, number] = [0.25 * start[0] + 0.5 * c[0] + 0.25 * tip[0], 0.25 * start[1] + 0.5 * c[1] + 0.25 * tip[1]];
  return { d: `M${fmtPt(start)}Q${fmtPt(c)} ${fmtPt(end)}`, head: arrow ? head(tip, t) : null, mid };
}

/** A self-loop drawn above a node of radius r. */
export function selfLoopGeometry(p: Pt, r: number, arrow = 0): EdgeGeom {
  const at = (deg: number): Pt => [p[0] + r * Math.cos((deg * Math.PI) / 180), p[1] + r * Math.sin((deg * Math.PI) / 180)];
  const s = at(-125);
  const e = at(-55);
  const lift = r * 1.9;
  const c1: Pt = [s[0] - r * 0.6, s[1] - lift];
  const c2: Pt = [e[0] + r * 0.6, e[1] - lift];
  const t: Pt = (() => {
    const l = Math.hypot(e[0] - c2[0], e[1] - c2[1]) || 1;
    return [(e[0] - c2[0]) / l, (e[1] - c2[1]) / l];
  })();
  const end: Pt = arrow ? [e[0] - t[0] * arrow * 0.8, e[1] - t[1] * arrow * 0.8] : e;
  const w = arrow * 0.55;
  const base: Pt = [e[0] - t[0] * arrow, e[1] - t[1] * arrow];
  return {
    d: `M${fmtPt(s)}C${fmtPt(c1)} ${fmtPt(c2)} ${fmtPt(end)}`,
    head: arrow ? `M${fmtPt(e)}L${fmtPt([base[0] - t[1] * w, base[1] + t[0] * w])}L${fmtPt([base[0] + t[1] * w, base[1] - t[0] * w])}Z` : null,
    mid: [p[0], p[1] - r - lift * 0.72],
  };
}

/** Distance from a box's centre to its border along a unit direction. */
export function boxExit(half: Pt, u: Pt): number {
  const tx = Math.abs(u[0]) < 1e-9 ? Infinity : half[0] / Math.abs(u[0]);
  const ty = Math.abs(u[1]) < 1e-9 ? Infinity : half[1] / Math.abs(u[1]);
  return Math.min(tx, ty);
}

/** A straight link between two boxes (centres a, b; half sizes ha, hb), trimmed to their borders, with an arrowhead. */
export function boxLinkGeometry(a: Pt, b: Pt, ha: Pt, hb: Pt, arrow = 0, gap = 3): EdgeGeom & { start: [number, number]; end: [number, number] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { d: '', head: null, mid: [a[0], a[1]], start: [a[0], a[1]], end: [b[0], b[1]] };
  const u: Pt = [dx / len, dy / len];
  const s0 = boxExit(ha, u) + gap;
  const e0 = boxExit(hb, u) + gap;
  if (s0 + e0 >= len) return { d: '', head: null, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], start: [a[0], a[1]], end: [b[0], b[1]] };
  const start: [number, number] = [a[0] + u[0] * s0, a[1] + u[1] * s0];
  const tip: [number, number] = [b[0] - u[0] * e0, b[1] - u[1] * e0];
  const g = edgeGeometry(start, tip, { r1: 0, r2: 0, arrow });
  return { ...g, start, end: tip };
}
