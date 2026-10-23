/**
 * Keyboard navigation for the views' roving tab stop (README §9.6), as pure
 * functions: given the key pressed and where focus is, where it goes next
 * (or null when the key isn't theirs, so the page keeps it).
 *
 *   ArrayView  ← → (↑ ↓ too) · Home End
 *   TableView  ← → ↑ ↓ · Home End (row) · Ctrl+Home Ctrl+End (table)
 *   TreeView   ↑ parent · ↓ first child · binary trees: ← left child, → right child;
 *              other trees: ← → siblings · Home root · End last node in layout order
 *   GraphView  nodes in id order with each node's edges after it: ← ↑ previous,
 *              → ↓ next · Home End
 */
import type { TreeNode } from '../math/layout';
import type { GraphSpec } from '../types';
import { edgeKey } from './geometry';

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
export const isNavKey = (key: string): boolean => NAV_KEYS.has(key);

/** A row of n items (arrays, graph sequences). */
export function navLinear(key: string, i: number, n: number): number | null {
  if (n <= 0) return null;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, i - 1);
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(n - 1, i + 1);
    case 'Home':
      return 0;
    case 'End':
      return n - 1;
    default:
      return null;
  }
}

/** A rows × cols grid; `ctrl` turns Home/End into the first/last cell of the table. */
export function navGrid(key: string, r: number, c: number, rows: number, cols: number, ctrl = false): [number, number] | null {
  if (rows <= 0 || cols <= 0) return null;
  const cl = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  switch (key) {
    case 'ArrowLeft':
      return [r, cl(c - 1, cols)];
    case 'ArrowRight':
      return [r, cl(c + 1, cols)];
    case 'ArrowUp':
      return [cl(r - 1, rows), c];
    case 'ArrowDown':
      return [cl(r + 1, rows), c];
    case 'Home':
      return ctrl ? [0, 0] : [r, 0];
    case 'End':
      return ctrl ? [rows - 1, cols - 1] : [r, cols - 1];
    default:
      return null;
  }
}

export interface TreeIndex {
  root: string | null;
  parent: ReadonlyMap<string, string | null>;
  /** Child slots as given (null keeps left/right distinct). */
  slots: ReadonlyMap<string, readonly (string | null)[]>;
  /** Every node has at most two child slots. */
  binary: boolean;
  /** Ids in the order the layout draws them left to right (in-order for binary trees, else pre-order). */
  order: readonly string[];
}

export function indexTree(root: TreeNode | null): TreeIndex {
  const parent = new Map<string, string | null>();
  const slots = new Map<string, (string | null)[]>();
  let binary = true;
  const pre: string[] = [];
  const walk = (n: TreeNode, p: string | null) => {
    parent.set(n.id, p);
    const kids = n.children ?? [];
    if (kids.length > 2) binary = false;
    slots.set(
      n.id,
      kids.map((k) => (k ? k.id : null)),
    );
    pre.push(n.id);
    kids.forEach((k) => k && walk(k, n.id));
  };
  if (root) walk(root, null);
  let order = pre;
  if (binary && root) {
    const ino: string[] = [];
    const go = (id: string | null | undefined) => {
      if (!id) return;
      const [l, r] = slots.get(id) ?? [];
      go(l);
      ino.push(id);
      go(r);
    };
    go(root.id);
    order = ino;
  }
  return { root: root?.id ?? null, parent, slots, binary, order };
}

export function navTree(key: string, id: string, t: TreeIndex): string | null {
  const real = (t.slots.get(id) ?? []).filter((x): x is string => !!x);
  switch (key) {
    case 'ArrowUp':
      return t.parent.get(id) ?? id;
    case 'ArrowDown':
      return real[0] ?? id;
    case 'ArrowLeft':
    case 'ArrowRight': {
      const left = key === 'ArrowLeft';
      if (t.binary) {
        const s = t.slots.get(id) ?? [];
        return (left ? s[0] : s[1]) ?? id;
      }
      const p = t.parent.get(id);
      if (!p) return id;
      const sibs = (t.slots.get(p) ?? []).filter((x): x is string => !!x);
      const k = sibs.indexOf(id);
      return sibs[Math.min(sibs.length - 1, Math.max(0, k + (left ? -1 : 1)))] ?? id;
    }
    case 'Home':
      return t.root;
    case 'End':
      return t.order[t.order.length - 1] ?? null;
    default:
      return null;
  }
}

export type GraphItem = { kind: 'node'; id: string; key: string } | { kind: 'edge'; from: string; to: string; key: string };

/** The roving order of a graph: nodes in natural id order, each followed by the edges it is the source of. */
export function graphSequence(g: GraphSpec, which: { nodes: boolean; edges: boolean }): GraphItem[] {
  const ids = g.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const known = new Set(ids);
  const out: GraphItem[] = [];
  for (const id of ids) {
    if (which.nodes) out.push({ kind: 'node', id, key: `n:${id}` });
    if (which.edges) for (const e of g.edges) if (e.from === id) out.push({ kind: 'edge', from: e.from, to: e.to, key: `e:${edgeKey(e.from, e.to)}` });
  }
  if (which.edges) for (const e of g.edges) if (!known.has(e.from)) out.push({ kind: 'edge', from: e.from, to: e.to, key: `e:${edgeKey(e.from, e.to)}` });
  return out;
}
