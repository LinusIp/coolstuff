/**
 * The pure logic behind ArrayView, TreeView, GraphView and TableView: marks,
 * text alternatives, keyboard navigation, pixel geometry and FLIP planning.
 */
import { describe, expect, it } from 'vitest';
import { defineConcepts } from '../theme';
import type { ArrayState, GraphSpec, GraphState, TableState, TreeState } from '../types';
import type { TreeNode } from '../math/layout';
import { conceptLabel, conceptLine, isMarkState, markClass, markInfo, MARK_STATES } from './marks';
import {
  arrayCellLabel,
  cellText,
  graphEdgeLabel,
  graphNodeLabel,
  listText,
  rangesText,
  summarizeArray,
  summarizeGraph,
  summarizeTable,
  summarizeTree,
  tableCellLabel,
  treeNodeLabel,
} from './describe';
import { graphSequence, indexTree, navGrid, navLinear, navTree } from './nav';
import {
  boxExit,
  boxLinkGeometry,
  defaultGraphLayout,
  edgeGeometry,
  edgeKey,
  edgeMarkOf,
  graphBox,
  graphUnitPositions,
  hasReverse,
  nodeWidth,
  placeUnit,
  selfLoopGeometry,
  treeGeometry,
  unitFromPixel,
} from './geometry';
import { enteredKeys, flipFrame, flipMoves, planFlip, type Pos } from './flip';

const C = defineConcepts({ pivot: { hue: 'rose', label: 'the pivot' }, input: { hue: 'input', label: 'key' } });

describe('marks', () => {
  it('classifies built-in states with a word and a non-colour glyph', () => {
    expect(MARK_STATES).toHaveLength(8);
    expect(markInfo('done')).toEqual({ mark: 'done', kind: 'state', glyph: '✓', word: 'done' });
    expect(markInfo('found')?.glyph).toBe('✓');
    expect(markInfo('error')?.glyph).toBe('×');
    expect(markInfo('compare')).toMatchObject({ glyph: null, word: 'being compared' });
    expect(markInfo(undefined)).toBeNull();
    expect(isMarkState('visited')).toBe(true);
    expect(isMarkState('pivot')).toBe(false);
  });
  it('reads any other string as a lesson concept, labelled and line-styled', () => {
    const info = markInfo('pivot', C);
    expect(info).toMatchObject({ kind: 'concept', concept: 'pivot', word: 'marked the pivot' });
    expect(markClass(info)).toBe('ct ct-pivot ds-concept');
    expect(conceptLine('pivot', C)).toBe('double');
    // Global meanings work without a concept set; unknown names fall back gracefully.
    expect(conceptLine('output')).toBe('dashed');
    expect(conceptLabel('prob')).toBe('probability');
    expect(conceptLabel('hot-key')).toBe('hot key');
    expect(conceptLine('nope')).toBe('solid');
  });
});

describe('text alternatives', () => {
  it('formats values for cells and speech', () => {
    expect(cellText(-3)).toBe('−3');
    expect(cellText(0.1 + 0.2)).toBe('0.3');
    expect(cellText(Infinity)).toBe('∞');
    expect(cellText(-Infinity)).toBe('−∞');
    expect(cellText(null)).toBe('');
    expect(cellText(-0)).toBe('0');
    expect(cellText('abc')).toBe('abc');
    expect(listText(['a', 'b', 'c'])).toBe('a, b and c');
    expect(rangesText([5, 0, 1, 2, 7, 8])).toBe('0 to 2, 5, 7 and 8');
  });

  const arr: ArrayState = {
    values: [1, 3, 4, 7, 9, 11, 15, 20],
    marks: { 3: 'compare', 4: 'compare', 0: 'dim', 1: 'dim' },
    pointers: { lo: 2, mid: 3, hi: 7 },
    window: [2, 7],
  };
  it('labels array cells with value, mark, pointers and window', () => {
    expect(arrayCellLabel(arr, 3)).toBe('index 3: 7, being compared, pointer mid');
    expect(arrayCellLabel(arr, 0)).toBe('index 0: 1, set aside, outside the window');
    expect(arrayCellLabel({ values: [null] }, 0)).toBe('index 0: empty');
    expect(arrayCellLabel({ values: [5], marks: { 0: 'pivot' }, pointers: { i: 0, j: 0 } }, 0, C)).toBe('index 0: 5, marked the pivot, pointers i and j');
  });
  it('summarises an array frame', () => {
    expect(summarizeArray(arr)).toBe(
      '8 cells: 1, 3, 4, 7, 9, 11, 15, 20. Pointers: lo at 2, mid at 3, hi at 7. Window: indices 2 to 7. Set aside: indices 0 and 1. Being compared: indices 3 and 4.',
    );
    expect(summarizeArray({ values: [] })).toBe('Empty array.');
    expect(summarizeArray({ values: Array.from({ length: 50 }, (_, i) => i) }, undefined, 3)).toBe('50 cells: 0, 1, 2 and 47 more.');
  });

  const bst: TreeNode = { id: '5', children: [{ id: '3', children: [{ id: '1' }, { id: '4' }] }, { id: '8', children: [null, { id: '9' }] }] };
  const tree: TreeState = { root: bst, marks: { '4': 'current', '9': 'found' }, badges: { '8': 'balance +1' } };
  it('labels tree nodes by position', () => {
    expect(treeNodeLabel(tree, '5')).toBe('node 5, root');
    expect(treeNodeLabel(tree, '4')).toBe('node 4, right child of 3, leaf, current');
    expect(treeNodeLabel(tree, '9')).toBe('node 9, right child of 8, leaf, found');
    expect(treeNodeLabel(tree, '8')).toBe('node 8, right child of 5, balance +1');
    expect(treeNodeLabel({ root: { id: 'a', children: [{ id: 'b' }] } }, 'b')).toBe('node b, only child of a, leaf');
    expect(treeNodeLabel(tree, 'zz')).toBe('node zz');
  });
  it('summarises a tree in order or by level', () => {
    expect(summarizeTree(tree, 'inorder')).toBe('Tree of 6 nodes, height 2, root 5. In order: 1, 3, 4, 5, 8, 9. Current: 4. Found: 9.');
    expect(summarizeTree(tree, 'tidy')).toBe('Tree of 6 nodes, height 2, root 5. By level: 5; 3 8; 1 4 9. Current: 4. Found: 9.');
    expect(summarizeTree({ root: null })).toBe('Empty tree.');
    expect(summarizeTree({ root: bst, edgeMarks: { '5->3': 'visited', '3->4': 'visited' } }, 'inorder')).toBe(
      'Tree of 6 nodes, height 2, root 5. In order: 1, 3, 4, 5, 8, 9. Edges visited: 5→3 and 3→4.',
    );
  });

  const g: GraphSpec = {
    directed: true,
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C', label: 'city C' }],
    edges: [
      { from: 'A', to: 'B', weight: 4 },
      { from: 'B', to: 'C', weight: 1 },
      { from: 'A', to: 'C', weight: 7 },
    ],
  };
  const gs: GraphState = { graph: g, nodeMarks: { A: 'done', B: 'current' }, edgeMarks: { 'A->B': 'done' }, nodeBadges: { A: '0', B: '4', C: '∞' } };
  it('labels graph nodes and edges', () => {
    expect(graphNodeLabel(gs, 'B')).toBe('node B, 4, current, 2 edges');
    expect(graphNodeLabel(gs, 'C')).toBe('node city C, ∞, 2 edges');
    expect(graphEdgeLabel(gs, 'A', 'B')).toBe('edge A→B, weight 4, done');
    const und: GraphState = { graph: { ...g, directed: false }, edgeMarks: { 'B->A': 'visited' } };
    expect(graphEdgeLabel(und, 'A', 'B')).toBe('edge A–B, weight 4, visited');
  });
  it('summarises a graph', () => {
    expect(summarizeGraph(gs)).toBe('Directed graph, 3 nodes and 3 edges. Done: A. Current: B. Edges done: A→B. Labels: A 0, B 4, city C ∞.');
    expect(summarizeGraph({ graph: { nodes: [], edges: [] } })).toBe('Empty graph.');
  });

  const table: TableState = {
    cells: [
      [0, 0, 0],
      [0, 1, null],
    ],
    rowHeaders: ['ε', 'a'],
    colHeaders: ['ε', 'a', 'b'],
    marks: { '1,1': 'current' },
    arrows: [{ from: [0, 0], to: [1, 1] }],
  };
  it('labels table cells with headers and where the value came from', () => {
    expect(tableCellLabel(table, 1, 1)).toBe('a, a: 1, current, from ε ε');
    expect(tableCellLabel(table, 1, 2)).toBe('a, b: empty');
    expect(tableCellLabel({ cells: [[3]] }, 0, 0)).toBe('row 0, column 0: 3');
  });
  it('summarises a table', () => {
    expect(summarizeTable(table)).toBe('Table of 2 rows and 3 columns, 5 filled. Current: a a. Arrows: ε ε → a a.');
    expect(summarizeTable({ cells: [] })).toBe('Empty table.');
  });
});

describe('keyboard navigation', () => {
  it('moves along a row and clamps at the ends', () => {
    expect(navLinear('ArrowRight', 2, 5)).toBe(3);
    expect(navLinear('ArrowRight', 4, 5)).toBe(4);
    expect(navLinear('ArrowLeft', 0, 5)).toBe(0);
    expect(navLinear('Home', 3, 5)).toBe(0);
    expect(navLinear('End', 0, 5)).toBe(4);
    expect(navLinear('Enter', 0, 5)).toBeNull();
    expect(navLinear('ArrowRight', 0, 0)).toBeNull();
  });
  it('moves around a grid', () => {
    expect(navGrid('ArrowDown', 0, 1, 3, 3)).toEqual([1, 1]);
    expect(navGrid('ArrowUp', 0, 1, 3, 3)).toEqual([0, 1]);
    expect(navGrid('End', 1, 0, 3, 4)).toEqual([1, 3]);
    expect(navGrid('Home', 2, 2, 3, 4, true)).toEqual([0, 0]);
    expect(navGrid('End', 0, 0, 3, 4, true)).toEqual([2, 3]);
    expect(navGrid('x', 0, 0, 3, 4)).toBeNull();
  });
  it('walks a binary tree: up to the parent, left and right to the children', () => {
    const t = indexTree({ id: '5', children: [{ id: '3', children: [{ id: '1' }, { id: '4' }] }, { id: '8', children: [null, { id: '9' }] }] });
    expect(t.binary).toBe(true);
    expect(t.order).toEqual(['1', '3', '4', '5', '8', '9']);
    expect(navTree('ArrowLeft', '5', t)).toBe('3');
    expect(navTree('ArrowRight', '5', t)).toBe('8');
    expect(navTree('ArrowLeft', '8', t)).toBe('8'); // no left child: stay
    expect(navTree('ArrowRight', '8', t)).toBe('9');
    expect(navTree('ArrowUp', '9', t)).toBe('8');
    expect(navTree('ArrowUp', '5', t)).toBe('5');
    expect(navTree('ArrowDown', '8', t)).toBe('9');
    expect(navTree('Home', '9', t)).toBe('5');
    expect(navTree('End', '1', t)).toBe('9');
    expect(navTree('q', '1', t)).toBeNull();
  });
  it('walks a general tree: left and right between siblings', () => {
    const t = indexTree({ id: 'r', children: [{ id: 'a' }, { id: 'b', children: [{ id: 'b1' }] }, { id: 'c' }] });
    expect(t.binary).toBe(false);
    expect(navTree('ArrowRight', 'a', t)).toBe('b');
    expect(navTree('ArrowRight', 'c', t)).toBe('c');
    expect(navTree('ArrowLeft', 'b', t)).toBe('a');
    expect(navTree('ArrowDown', 'b', t)).toBe('b1');
    expect(navTree('ArrowLeft', 'r', t)).toBe('r');
    expect(navTree('End', 'r', t)).toBe('c');
  });
  it('orders a graph as nodes by id, each followed by its edges', () => {
    const g: GraphSpec = { nodes: [{ id: 'b' }, { id: 'a' }, { id: '10' }, { id: '2' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'a', to: '2' }, { from: 'zz', to: 'a' }] };
    expect(graphSequence(g, { nodes: true, edges: true }).map((x) => x.key)).toEqual(['n:2', 'n:10', 'n:a', 'e:a->b', 'e:a->2', 'n:b', 'e:b->a', 'e:zz->a']);
    expect(graphSequence(g, { nodes: true, edges: false }).map((x) => x.key)).toEqual(['n:2', 'n:10', 'n:a', 'n:b']);
    expect(graphSequence(g, { nodes: false, edges: true }).map((x) => x.key)).toEqual(['e:a->b', 'e:a->2', 'e:b->a', 'e:zz->a']);
  });
});

describe('geometry', () => {
  it('keys edges and finds undirected marks either way round', () => {
    expect(edgeKey('a', 'b')).toBe('a->b');
    expect(edgeMarkOf({ 'b->a': 'done' }, 'a', 'b', false)).toBe('done');
    expect(edgeMarkOf({ 'b->a': 'done' }, 'a', 'b', true)).toBeUndefined();
    expect(edgeMarkOf(undefined, 'a', 'b', false)).toBeUndefined();
  });

  it('places a BST in order with ≥ 44px nodes and no overlaps on a level', () => {
    const root: TreeNode = { id: '5', children: [{ id: '3', children: [{ id: '1' }, { id: '4' }] }, { id: '8', children: [null, { id: '9' }] }] };
    const geo = treeGeometry(root, 'inorder', { node: 44 });
    const xs = [...geo.nodes].sort((a, b) => a.x - b.x).map((n) => n.id);
    expect(xs).toEqual(['1', '3', '4', '5', '8', '9']);
    for (const a of geo.nodes)
      for (const b of geo.nodes) if (a !== b && a.depth === b.depth) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((a.w + b.w) / 2);
    expect(geo.edges.map((e) => e.key).sort()).toEqual(['3->1', '3->4', '5->3', '5->8', '8->9']);
    expect(geo.width).toBeGreaterThan(5 * 44);
    expect(geo.height).toBe(12 * 2 + 44 + 2 * (44 + 36));
    expect(treeGeometry(null, 'tidy', { node: 44 })).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('widens nodes into pills for long labels', () => {
    expect(nodeWidth('7', 44)).toBe(44);
    expect(nodeWidth('10 · 20 · 30', 44)).toBeGreaterThan(44);
    const geo = treeGeometry({ id: 'r', label: 'root key', children: [{ id: 'a' }, { id: 'b' }] }, 'tidy', { node: 44 });
    const r = geo.nodes.find((n) => n.id === 'r')!;
    expect(r.w).toBe(nodeWidth('root key', 44));
  });

  const dag: GraphSpec = {
    directed: true,
    nodes: ['x', 'w', 'mul', 'b', 'add', 'loss'].map((id) => ({ id })),
    edges: [
      { from: 'x', to: 'mul' },
      { from: 'w', to: 'mul' },
      { from: 'mul', to: 'add' },
      { from: 'b', to: 'add' },
      { from: 'add', to: 'loss' },
    ],
  };
  it('lays out a DAG left to right and keeps every unit position in [0, 1]', () => {
    const p = graphUnitPositions(dag, 'layered');
    for (const e of dag.edges) expect(p.get(e.from)![0]).toBeLessThan(p.get(e.to)![0]);
    for (const [x, y] of p.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    expect(p.get('loss')).toEqual([1, 0.5]);
    expect(graphUnitPositions({ nodes: [{ id: 'a' }], edges: [] }, 'layered').get('a')).toEqual([0.5, 0.5]);
  });

  it('chooses given positions when every node has them, else force', () => {
    expect(defaultGraphLayout({ nodes: [{ id: 'a', x: 0, y: 0 }], edges: [] })).toBe('given');
    expect(defaultGraphLayout({ nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b' }], edges: [] })).toBe('force');
    expect(defaultGraphLayout({ nodes: [], edges: [] })).toBe('force');
    const given = graphUnitPositions({ nodes: [{ id: 'a', x: 0.2, y: 0.8 }], edges: [] }, 'given');
    expect(given.get('a')).toEqual([0.2, 0.8]);
    const circ = graphUnitPositions({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [] }, 'circle');
    expect(circ.get('a')).toEqual([0.5, 0]);
    const f1 = graphUnitPositions(dag, 'force');
    expect([...graphUnitPositions(dag, 'force').entries()]).toEqual([...f1.entries()]);
  });

  it('sizes the box so nodes never crowd (phones scroll inside the view)', () => {
    const big: GraphSpec = { nodes: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}` })), edges: [] };
    const box = graphBox(big, 'force', 350);
    expect(box.width).toBeGreaterThan(350);
    expect(graphBox(big, 'force', 1000).width).toBe(1000);
    const lb = graphBox(dag, 'layered', 300);
    expect(lb.width).toBeGreaterThanOrEqual(300);
    expect(lb.height).toBeGreaterThanOrEqual(160);
    const p = placeUnit([0.5, 0.5], box);
    expect(unitFromPixel(p, box)).toEqual([0.5, 0.5]);
    expect(unitFromPixel([-100, 1e6], box)).toEqual([0, 1]);
    expect(placeUnit([0, 0], box)).toEqual([box.pad, box.pad]);
  });

  it('trims straight edges to the node radii and puts the arrowhead on the target', () => {
    const e = edgeGeometry([0, 0], [100, 0], { r1: 20, r2: 20, arrow: 10 });
    expect(e.d).toBe('M20 0L72 0');
    expect(e.head).toBe('M80 0L70 5.5L70 -5.5Z');
    expect(e.mid).toEqual([50, 0]);
    const plain = edgeGeometry([0, 0], [0, 100], { r1: 22, r2: 22 });
    expect(plain.d).toBe('M0 22L0 78');
    expect(plain.head).toBeNull();
    expect(edgeGeometry([0, 0], [30, 0], { r1: 20, r2: 20 }).d).toBe('');
  });

  it('bends two-way pairs apart and draws self-loops above the node', () => {
    const g: GraphSpec = { directed: true, nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] };
    expect(hasReverse(g, 'a', 'b')).toBe(true);
    expect(hasReverse({ ...g, directed: false }, 'a', 'b')).toBe(false);
    const ab = edgeGeometry([0, 0], [100, 0], { r1: 20, r2: 20, bend: 16, arrow: 10 });
    const ba = edgeGeometry([100, 0], [0, 0], { r1: 20, r2: 20, bend: 16, arrow: 10 });
    expect(ab.d.startsWith('M')).toBe(true);
    expect(ab.d).toContain('Q');
    // The two bends sit on opposite sides of the straight line.
    expect(Math.sign(ab.mid[1])).toBe(-Math.sign(ba.mid[1]));
    expect(Math.abs(ab.mid[1])).toBeGreaterThan(6);
    expect(Math.abs(ab.mid[1])).toBeLessThan(16);
    const loop = selfLoopGeometry([50, 50], 22, 8);
    expect(loop.d).toContain('C');
    expect(loop.mid[1]).toBeLessThan(50 - 22);
    expect(loop.head).not.toBeNull();
  });

  it('trims links between boxes to their borders', () => {
    expect(boxExit([40, 20], [1, 0])).toBe(40);
    expect(boxExit([40, 20], [0, 1])).toBe(20);
    const l = boxLinkGeometry([0, 0], [200, 0], [40, 20], [40, 20], 8, 0);
    expect(l.start).toEqual([40, 0]);
    expect(l.end).toEqual([160, 0]);
    expect(boxLinkGeometry([0, 0], [50, 0], [40, 20], [40, 20]).d).toBe('');
  });
});

describe('FLIP planning', () => {
  const m = (o: Record<string, Pos>) => new Map(Object.entries(o));
  it('moves what moved, enters what is new, drops what left', () => {
    const plan = planFlip(m({ a: [0, 0], b: [48, 0], gone: [96, 0] }), m({ a: [48, 0], b: [0, 0], c: [96, 0] }));
    expect(plan.moves.map((x) => x.key).sort()).toEqual(['a', 'b']);
    expect(plan.entered).toEqual(['c']);
    expect(plan.exited).toEqual(['gone']);
    expect(flipMoves(plan)).toBe(true);
    expect(flipMoves(planFlip(m({ a: [0, 0] }), m({ a: [0.2, 0] })))).toBe(false);
  });
  it('interpolates eased positions and lands exactly on the targets', () => {
    const targets = m({ a: [100, 0], c: [5, 5] });
    const plan = planFlip(m({ a: [0, 0] }), targets);
    expect(flipFrame(plan, targets, 0).get('a')).toEqual([0, 0]);
    expect(flipFrame(plan, targets, 1).get('a')).toEqual([100, 0]);
    const half = flipFrame(plan, targets, 0.5, (t) => t).get('a')!;
    expect(half[0]).toBeCloseTo(50);
    expect(flipFrame(plan, targets, 0.3).get('c')).toEqual([5, 5]);
    expect(flipFrame(plan, targets, 7).get('a')).toEqual([100, 0]);
  });
  it('flags entered keys only after the first render', () => {
    expect(enteredKeys(null, ['a'])).toEqual(new Set());
    expect(enteredKeys(new Set(['a']), ['a', 'b'])).toEqual(new Set(['b']));
  });
});
