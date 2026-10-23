/**
 * Pure layout algorithms for TreeView and GraphView (no DOM, unit-tested).
 * Positions are in abstract units; the views scale them to pixels.
 */
import { mulberry32 } from './stats';

export interface TreeNode {
  id: string;
  label?: string;
  /** Use `null` for a missing child in a binary tree so left/right stay distinct. */
  children?: readonly (TreeNode | null)[];
}

export interface LaidOutNode {
  id: string;
  /** Horizontal slot (0, 1, 2, … or a half-slot for a centred parent). */
  x: number;
  depth: number;
  parent: string | null;
}

/**
 * Binary-tree layout by in-order index: x is the node's rank in an in-order
 * walk, so a BST reads left-to-right in sorted order and rotations visibly
 * keep that order.
 */
export function layoutInorder(root: TreeNode | null): LaidOutNode[] {
  const out: LaidOutNode[] = [];
  let counter = 0;
  const walk = (n: TreeNode | null | undefined, depth: number, parent: string | null): void => {
    if (!n) return;
    const [left, right] = n.children ?? [];
    walk(left, depth + 1, n.id);
    out.push({ id: n.id, x: counter++, depth, parent });
    walk(right, depth + 1, n.id);
  };
  walk(root, 0, null);
  return out;
}

/**
 * General ("tidy") layout: leaves get consecutive x slots in left-to-right
 * order and each parent is centred over its children. Deterministic; fine for
 * the small trees lessons draw (heaps, tries, recursion trees, B-trees).
 *
 * A `null` child next to a real one keeps an empty slot, so a lone right
 * child still sits to the right of its parent (and a lone left child to the
 * left): binary trees keep left and right distinct in this layout too. A node
 * whose children are all `null` is a leaf.
 */
export function layoutTidy(root: TreeNode | null): LaidOutNode[] {
  const out: LaidOutNode[] = [];
  let nextLeaf = 0;
  const walk = (n: TreeNode, depth: number, parent: string | null): number => {
    const slots = n.children ?? [];
    const entry: LaidOutNode = { id: n.id, x: 0, depth, parent };
    out.push(entry);
    let x: number;
    if (!slots.some((c) => !!c)) x = nextLeaf++;
    else {
      // A null slot beside a real child is a phantom leaf: it takes a slot but draws nothing.
      const xs = slots.map((k) => (k ? walk(k, depth + 1, n.id) : nextLeaf++));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    entry.x = x;
    return x;
  };
  if (root) walk(root, 0, null);
  return out;
}

/**
 * Nodes evenly spaced on a circle inscribed in the unit square, in the given
 * order, the first at the top and going clockwise (y grows downwards, as on
 * screen). One node sits in the centre.
 */
export function circleLayout(ids: readonly string[]): Map<string, [number, number]> {
  const n = ids.length;
  const out = new Map<string, [number, number]>();
  ids.forEach((id, i) => {
    if (n === 1) return out.set(id, [0.5, 0.5]);
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    // Round away float noise so tests and snapshots stay stable (cos(π/2) = 6e-17).
    const r = (v: number) => Math.round(v * 1e9) / 1e9;
    out.set(id, [r(0.5 + 0.5 * Math.cos(a)), r(0.5 + 0.5 * Math.sin(a))]);
  });
  return out;
}

export interface GraphLayoutInput {
  nodes: readonly { id: string; x?: number; y?: number }[];
  edges: readonly { from: string; to: string }[];
}

/**
 * Fruchterman–Reingold force layout in the unit square, seeded so the same
 * graph always lands the same way. Nodes with given x/y (0..1) stay pinned.
 */
export function forceLayout(g: GraphLayoutInput, opts: { iterations?: number; seed?: number } = {}): Map<string, [number, number]> {
  const { iterations = 300, seed = 7 } = opts;
  const rng = mulberry32(seed);
  const n = g.nodes.length;
  const pos = new Map<string, [number, number]>();
  const pinned = new Set<string>();
  g.nodes.forEach((node, i) => {
    if (node.x !== undefined && node.y !== undefined) {
      pos.set(node.id, [node.x, node.y]);
      pinned.add(node.id);
    } else {
      // Start on a jittered circle: avoids the degenerate all-at-one-point start.
      const a = (2 * Math.PI * i) / Math.max(1, n);
      pos.set(node.id, [0.5 + 0.35 * Math.cos(a) + (rng() - 0.5) * 0.02, 0.5 + 0.35 * Math.sin(a) + (rng() - 0.5) * 0.02]);
    }
  });
  if (n <= 1 || pinned.size === n) return pos;
  const k = Math.sqrt(1 / n) * 0.9;
  const ids = g.nodes.map((v) => v.id);
  for (let it = 0; it < iterations; it++) {
    const temp = 0.1 * (1 - it / iterations) + 0.002;
    const disp = new Map<string, [number, number]>(ids.map((id) => [id, [0, 0]]));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        let dx = a[0] - b[0];
        let dy = a[1] - b[1];
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = (rng() - 0.5) * 1e-3;
          dy = (rng() - 0.5) * 1e-3;
          d = Math.hypot(dx, dy);
        }
        const f = (k * k) / d;
        const da = disp.get(ids[i])!;
        const db = disp.get(ids[j])!;
        da[0] += (dx / d) * f;
        da[1] += (dy / d) * f;
        db[0] -= (dx / d) * f;
        db[1] -= (dy / d) * f;
      }
    }
    for (const e of g.edges) {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) continue;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const d = Math.max(1e-6, Math.hypot(dx, dy));
      const f = (d * d) / k;
      const da = disp.get(e.from)!;
      const db = disp.get(e.to)!;
      da[0] -= (dx / d) * f;
      da[1] -= (dy / d) * f;
      db[0] += (dx / d) * f;
      db[1] += (dy / d) * f;
    }
    for (const id of ids) {
      if (pinned.has(id)) continue;
      const p = pos.get(id)!;
      const d = disp.get(id)!;
      const len = Math.max(1e-9, Math.hypot(d[0], d[1]));
      p[0] = Math.min(1, Math.max(0, p[0] + (d[0] / len) * Math.min(len, temp)));
      p[1] = Math.min(1, Math.max(0, p[1] + (d[1] / len) * Math.min(len, temp)));
    }
  }
  // Normalise to fill the unit square (keeps pinned layouts untouched).
  if (pinned.size === 0) {
    const xs = [...pos.values()].map((p) => p[0]);
    const ys = [...pos.values()].map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (const p of pos.values()) {
      p[0] = x1 - x0 < 1e-9 ? 0.5 : (p[0] - x0) / (x1 - x0);
      p[1] = y1 - y0 < 1e-9 ? 0.5 : (p[1] - y0) / (y1 - y0);
    }
  }
  return pos;
}

export interface LayeredNode {
  id: string;
  /** Column: 1 + the longest chain of predecessors (sources are layer 0). */
  layer: number;
  /** Position within the layer, 0 = top. */
  order: number;
}

/**
 * Layered (left → right) layout for DAGs: computation graphs, prerequisite
 * chains, topological sort. Longest-path layering, then a few barycentre
 * sweeps to reduce crossings. Back edges of a cyclic input are ignored, so bad
 * data can't hang the page. Deterministic: ties keep input order.
 */
export function layeredLayout(g: GraphLayoutInput, opts: { sweeps?: number } = {}): Map<string, LayeredNode> {
  const { sweeps = 4 } = opts;
  const ids = g.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  const succs = new Map<string, string[]>(ids.map((id) => [id, []]));
  // Drop back edges found by DFS so the rest is a DAG.
  const state = new Map<string, 0 | 1 | 2>();
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of g.edges) if (index.has(e.from) && index.has(e.to) && e.from !== e.to) adj.get(e.from)!.push(e.to);
  const visit = (u: string): void => {
    state.set(u, 1);
    for (const v of adj.get(u)!) {
      const s = state.get(v) ?? 0;
      if (s === 1) continue; // back edge
      preds.get(v)!.push(u);
      succs.get(u)!.push(v);
      if (s === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.get(id)) visit(id);

  const layer = new Map<string, number>();
  const layerOf = (u: string): number => {
    const known = layer.get(u);
    if (known !== undefined) return known;
    let l = 0;
    for (const p of preds.get(u)!) l = Math.max(l, layerOf(p) + 1);
    layer.set(u, l);
    return l;
  };
  ids.forEach(layerOf);
  const maxLayer = Math.max(0, ...layer.values());
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of ids) layers[layer.get(id)!].push(id);

  const orderOf = new Map<string, number>();
  const renumber = () => layers.forEach((col) => col.forEach((id, i) => orderOf.set(id, i)));
  renumber();
  const bary = (id: string, nbrs: string[]): number =>
    nbrs.length ? nbrs.reduce((s, n) => s + orderOf.get(n)!, 0) / nbrs.length : orderOf.get(id)!;
  for (let s = 0; s < sweeps; s++) {
    const down = s % 2 === 0;
    const seq = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const col of seq) {
      const keyed = col.map((id, i) => ({ id, i, b: bary(id, down ? preds.get(id)! : succs.get(id)!) }));
      keyed.sort((a, b) => a.b - b.b || a.i - b.i);
      col.splice(0, col.length, ...keyed.map((k) => k.id));
      col.forEach((id, i) => orderOf.set(id, i));
    }
  }
  const out = new Map<string, LayeredNode>();
  for (const id of ids) out.set(id, { id, layer: layer.get(id)!, order: orderOf.get(id)! });
  return out;
}
