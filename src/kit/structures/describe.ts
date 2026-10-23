/**
 * Text alternatives for the data-structure views (README §9): one label per
 * element ("index 3: 7, being compared, pointer mid") and a short summary of
 * the whole frame for screen readers. Pure and tested; the views call these
 * unless a lesson passes its own `describe…` function.
 */
import type { ConceptSet } from '../theme';
import type { ArrayState, GraphSpec, GraphState, Mark, TableState, TreeState } from '../types';
import type { TreeNode } from '../math/layout';
import { markInfo } from './marks';
import { edgeKey, edgeMarkOf } from './geometry';

const MINUS = '−';

/** How a cell value is shown and spoken: integers as is, decimals trimmed to 3 places, U+2212 minus, ∞, empty for null. */
export function cellText(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (Number.isNaN(v)) return '—';
  if (v === Infinity) return '∞';
  if (v === -Infinity) return `${MINUS}∞`;
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  return s === '-0' ? '0' : s.replace('-', MINUS);
}

const spoken = (v: number | string | null | undefined): string => (v === null || v === undefined || v === '' ? 'empty' : cellText(v));

/** "a", "a and b", "a, b and c". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Sorted integers as runs: [0, 1, 2, 5] → "0 to 2 and 5". */
export function rangesText(indices: readonly number[]): string {
  const xs = [...new Set(indices)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < xs.length; ) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    if (j - i >= 2) runs.push(`${xs[i]} to ${xs[j]}`);
    else for (let k = i; k <= j; k++) runs.push(String(xs[k]));
    i = j + 1;
  }
  return listText(runs);
}

/** Group keys by the spoken word of their mark, in first-seen order: [["being compared", [2, 3]], …]. */
function groupMarks<K>(entries: readonly [K, Mark][], concepts?: ConceptSet): [string, K[]][] {
  const groups = new Map<string, K[]>();
  for (const [k, m] of entries) {
    const info = markInfo(m, concepts);
    if (!info) continue;
    const g = groups.get(info.word);
    if (g) g.push(k);
    else groups.set(info.word, [k]);
  }
  return [...groups];
}

const sentence = (parts: readonly (string | false | null | undefined)[]): string =>
  parts
    .filter((p): p is string => !!p)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ');

// ── Arrays ────────────────────────────────────────────────────────────────

const pointersAt = (state: ArrayState, i: number): string[] =>
  Object.entries(state.pointers ?? {})
    .filter(([, at]) => at === i)
    .map(([name]) => name);

const outsideWindow = (state: ArrayState, i: number): boolean => !!state.window && (i < state.window[0] || i > state.window[1]);

/** "index 3: 7, being compared, pointer mid". */
export function arrayCellLabel(state: ArrayState, i: number, concepts?: ConceptSet): string {
  const info = markInfo(state.marks?.[i], concepts);
  const ptrs = pointersAt(state, i);
  return [
    `index ${i}: ${spoken(state.values[i])}`,
    info?.word,
    ptrs.length ? `${ptrs.length > 1 ? 'pointers' : 'pointer'} ${listText(ptrs)}` : '',
    outsideWindow(state, i) ? 'outside the window' : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** "8 cells: 3, 1, 4, 1, 5, 9, 2, 6. Pointers: lo at 0, hi at 7. Window: indices 0 to 7. Being compared: indices 2 and 3." */
export function summarizeArray(state: ArrayState, concepts?: ConceptSet, maxValues = 40): string {
  const n = state.values.length;
  if (n === 0) return 'Empty array.';
  const shown = state.values.slice(0, maxValues).map(spoken);
  const more = n > maxValues ? ` and ${n - maxValues} more` : '';
  const ptrs = Object.entries(state.pointers ?? {}).map(([name, at]) => `${name} at ${at}`);
  const marks = groupMarks(
    Object.entries(state.marks ?? {}).map(([k, m]) => [Number(k), m] as [number, Mark]),
    concepts,
  ).map(([word, idx]) => `${word[0].toUpperCase()}${word.slice(1)}: ${idx.length > 1 ? 'indices' : 'index'} ${rangesText(idx)}`);
  return sentence([
    `${n} ${n === 1 ? 'cell' : 'cells'}: ${shown.join(', ')}${more}`,
    ptrs.length ? `Pointers: ${ptrs.join(', ')}` : '',
    state.window ? `Window: indices ${state.window[0]} to ${state.window[1]}` : '',
    ...marks,
  ]);
}

// ── Trees ─────────────────────────────────────────────────────────────────

interface TreeFacts {
  node: TreeNode;
  parent: TreeNode | null;
  side: 'left' | 'right' | 'only' | 'child' | null;
  depth: number;
}

/** Every node with its parent, side and depth, in pre-order. */
export function treeFacts(root: TreeNode | null): TreeFacts[] {
  const out: TreeFacts[] = [];
  const walk = (n: TreeNode, parent: TreeNode | null, side: TreeFacts['side'], depth: number) => {
    out.push({ node: n, parent, side, depth });
    const slots = n.children ?? [];
    const binary = slots.length === 2;
    const real = slots.filter(Boolean).length;
    slots.forEach((c, i) => {
      if (!c) return;
      const s: TreeFacts['side'] = binary ? (i === 0 ? 'left' : 'right') : real === 1 ? 'only' : 'child';
      walk(c, n, s, depth + 1);
    });
  };
  if (root) walk(root, null, null, 0);
  return out;
}

const nodeName = (n: TreeNode): string => n.label ?? n.id;

/** "node 7, left child of 9, current, balance +1" (badge appended as given). */
export function treeNodeLabel(state: TreeState, id: string, concepts?: ConceptSet): string {
  const f = treeFacts(state.root).find((x) => x.node.id === id);
  if (!f) return `node ${id}`;
  const info = markInfo(state.marks?.[id], concepts);
  const where = !f.parent
    ? 'root'
    : f.side === 'left' || f.side === 'right'
      ? `${f.side} child of ${nodeName(f.parent)}`
      : f.side === 'only'
        ? `only child of ${nodeName(f.parent)}`
        : `child of ${nodeName(f.parent)}`;
  const kids = (f.node.children ?? []).filter(Boolean).length;
  const badge = state.badges?.[id];
  return [`node ${nodeName(f.node)}`, where, kids === 0 && f.parent ? 'leaf' : '', info?.word, badge ? badge : ''].filter(Boolean).join(', ');
}

/** "Tree of 6 nodes, height 2, root 5. In order: 1, 3, 4, 5, 8, 9. Current: 4." */
export function summarizeTree(state: TreeState, layout: 'tidy' | 'inorder' = 'tidy', concepts?: ConceptSet): string {
  const facts = treeFacts(state.root);
  if (facts.length === 0) return 'Empty tree.';
  const height = Math.max(...facts.map((f) => f.depth));
  let order: string;
  if (layout === 'inorder') {
    const seq: string[] = [];
    const walk = (n: TreeNode | null | undefined) => {
      if (!n) return;
      const [l, r] = n.children ?? [];
      walk(l);
      seq.push(nodeName(n));
      walk(r);
    };
    walk(state.root);
    order = `In order: ${seq.join(', ')}`;
  } else {
    const levels: string[][] = [];
    for (const f of facts) (levels[f.depth] ??= []).push(nodeName(f.node));
    order = `By level: ${levels.map((l) => l.join(' ')).join('; ')}`;
  }
  const byId = new Map(facts.map((f) => [f.node.id, nodeName(f.node)]));
  const marks = groupMarks(Object.entries(state.marks ?? {}) as [string, Mark][], concepts).map(
    ([word, ids]) => `${word[0].toUpperCase()}${word.slice(1)}: ${listText(ids.map((i) => byId.get(i) ?? i))}`,
  );
  const edgeMarks = groupMarks(Object.entries(state.edgeMarks ?? {}) as [string, Mark][], concepts).map(([word, keys]) => {
    const names = keys.map((k) => {
      const [a, b] = k.split('->');
      return `${byId.get(a) ?? a}→${byId.get(b ?? '') ?? b}`;
    });
    return `Edges ${word}: ${listText(names)}`;
  });
  return sentence([
    `Tree of ${facts.length} ${facts.length === 1 ? 'node' : 'nodes'}, height ${height}, root ${nodeName(facts[0].node)}`,
    order,
    ...marks,
    ...edgeMarks,
  ]);
}

// ── Graphs ────────────────────────────────────────────────────────────────

const gName = (g: GraphSpec, id: string): string => g.nodes.find((n) => n.id === id)?.label ?? id;

/** "node B, current, 7; 3 edges" (badge as given). */
export function graphNodeLabel(state: GraphState, id: string, concepts?: ConceptSet): string {
  const g = state.graph;
  const info = markInfo(state.nodeMarks?.[id], concepts);
  const degree = g.edges.filter((e) => e.from === id || e.to === id).length;
  const badge = state.nodeBadges?.[id];
  return [`node ${gName(g, id)}`, badge ? badge : '', info?.word, `${degree} ${degree === 1 ? 'edge' : 'edges'}`].filter(Boolean).join(', ');
}

/** "edge A→B, weight 3, done" ("A–B" when undirected). */
export function graphEdgeLabel(state: GraphState, from: string, to: string, concepts?: ConceptSet): string {
  const g = state.graph;
  const e = g.edges.find((x) => x.from === from && x.to === to) ?? (!g.directed ? g.edges.find((x) => x.from === to && x.to === from) : undefined);
  const info = markInfo(edgeMarkOf(state.edgeMarks, from, to, !!g.directed), concepts);
  return [
    `edge ${gName(g, from)}${g.directed ? '→' : '–'}${gName(g, to)}`,
    e?.weight !== undefined ? `weight ${cellText(e.weight)}` : '',
    e?.label ? e.label : '',
    info?.word,
  ]
    .filter(Boolean)
    .join(', ');
}

/** "Directed graph, 6 nodes and 8 edges. Done: A and B. Edges done: A→B. Labels: A 0, B 4, C ∞." */
export function summarizeGraph(state: GraphState, concepts?: ConceptSet): string {
  const g = state.graph;
  if (g.nodes.length === 0) return 'Empty graph.';
  const arrow = g.directed ? '→' : '–';
  const nodeMarks = groupMarks(Object.entries(state.nodeMarks ?? {}) as [string, Mark][], concepts).map(
    ([word, ids]) => `${word[0].toUpperCase()}${word.slice(1)}: ${listText(ids.map((i) => gName(g, i)))}`,
  );
  const edgeMarks = groupMarks(Object.entries(state.edgeMarks ?? {}) as [string, Mark][], concepts).map(
    ([word, keys]) =>
      `Edges ${word}: ${listText(
        keys.map((k) => {
          const [a, b] = k.split('->');
          return `${gName(g, a)}${arrow}${gName(g, b ?? '')}`;
        }),
      )}`,
  );
  const badges = Object.entries(state.nodeBadges ?? {}).map(([id, b]) => `${gName(g, id)} ${b}`);
  return sentence([
    `${g.directed ? 'Directed' : 'Undirected'} graph, ${g.nodes.length} ${g.nodes.length === 1 ? 'node' : 'nodes'} and ${g.edges.length} ${g.edges.length === 1 ? 'edge' : 'edges'}`,
    ...nodeMarks,
    ...edgeMarks,
    badges.length ? `Labels: ${badges.join(', ')}` : '',
  ]);
}

/** Does any edge connect these two nodes (in either direction for undirected graphs)? */
export function hasEdge(g: GraphSpec, from: string, to: string): boolean {
  return g.edges.some((e) => edgeKey(e.from, e.to) === edgeKey(from, to) || (!g.directed && e.from === to && e.to === from));
}

// ── Tables ────────────────────────────────────────────────────────────────

const rowName = (s: TableState, r: number): string => s.rowHeaders?.[r] ?? `row ${r}`;
const colName = (s: TableState, c: number): string => s.colHeaders?.[c] ?? `column ${c}`;

/** "row 2, column 3: 5, current" (headers used when given). */
export function tableCellLabel(state: TableState, r: number, c: number, concepts?: ConceptSet): string {
  const info = markInfo(state.marks?.[`${r},${c}`], concepts);
  const from = (state.arrows ?? []).filter((a) => a.to[0] === r && a.to[1] === c).map((a) => `${rowName(state, a.from[0])} ${colName(state, a.from[1])}`);
  return [`${rowName(state, r)}, ${colName(state, c)}: ${spoken(state.cells[r]?.[c])}`, info?.word, from.length ? `from ${listText(from)}` : '']
    .filter(Boolean)
    .join(', ');
}

/** "Table of 5 rows and 6 columns, 12 filled. Current: row 2 column 3. Arrows: row 1 column 2 → row 2 column 3." */
export function summarizeTable(state: TableState, concepts?: ConceptSet): string {
  const rows = state.cells.length;
  const cols = Math.max(0, ...state.cells.map((r) => r.length));
  if (rows === 0 || cols === 0) return 'Empty table.';
  const filled = state.cells.reduce((s, row) => s + row.filter((v) => v !== null && v !== undefined && v !== '').length, 0);
  const at = (k: string) => {
    const [r, c] = k.split(',').map(Number);
    return `${rowName(state, r)} ${colName(state, c)}`;
  };
  const marks = groupMarks(Object.entries(state.marks ?? {}) as [string, Mark][], concepts).map(
    ([word, keys]) => `${word[0].toUpperCase()}${word.slice(1)}: ${listText(keys.map(at))}`,
  );
  const arrows = (state.arrows ?? []).map((a) => `${at(`${a.from[0]},${a.from[1]}`)} → ${at(`${a.to[0]},${a.to[1]}`)}`);
  return sentence([
    `Table of ${rows} ${rows === 1 ? 'row' : 'rows'} and ${cols} ${cols === 1 ? 'column' : 'columns'}, ${filled} filled`,
    ...marks,
    arrows.length ? `Arrows: ${arrows.join('; ')}` : '',
  ]);
}
