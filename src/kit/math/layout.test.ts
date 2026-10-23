import { describe, expect, it } from 'vitest';
import { forceLayout, layeredLayout, layoutInorder, layoutTidy, type TreeNode } from './layout';

const bst: TreeNode = {
  id: '5',
  children: [
    { id: '3', children: [{ id: '1' }, { id: '4' }] },
    { id: '8', children: [null, { id: '9' }] },
  ],
};

describe('tree layouts', () => {
  it('in-order layout puts a BST in sorted order left to right', () => {
    const nodes = layoutInorder(bst);
    const byX = [...nodes].sort((a, b) => a.x - b.x).map((n) => n.id);
    expect(byX).toEqual(['1', '3', '4', '5', '8', '9']);
    expect(nodes.find((n) => n.id === '5')!.depth).toBe(0);
    expect(nodes.find((n) => n.id === '9')!.parent).toBe('8');
  });

  it('a missing left child keeps the right child to the right of its parent', () => {
    const nodes = layoutInorder(bst);
    const x = (id: string) => nodes.find((n) => n.id === id)!.x;
    expect(x('9')).toBeGreaterThan(x('8'));
  });

  it('tidy layout centres parents over children', () => {
    const t: TreeNode = { id: 'r', children: [{ id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b' }] };
    const nodes = layoutTidy(t);
    const x = (id: string) => nodes.find((n) => n.id === id)!.x;
    expect([x('a1'), x('a2'), x('b')]).toEqual([0, 1, 2]);
    expect(x('a')).toBe(0.5);
    expect(x('r')).toBe(1.25);
    expect(layoutTidy(null)).toEqual([]);
  });
});

describe('force layout', () => {
  const g = {
    nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id })),
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
    ],
  };

  it('is deterministic for a seed and stays in the unit square', () => {
    const p1 = forceLayout(g);
    const p2 = forceLayout(g);
    expect([...p1.entries()]).toEqual([...p2.entries()]);
    for (const [x, y] of p1.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('keeps nodes apart and respects pinned positions', () => {
    const p = forceLayout(g);
    const pts = [...p.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThan(0.05);
    const pinned = forceLayout({ nodes: [{ id: 'a', x: 0.1, y: 0.2 }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] });
    expect(pinned.get('a')).toEqual([0.1, 0.2]);
  });
});

describe('layered layout', () => {
  it('puts every edge left to right and orders sources first', () => {
    const g = {
      nodes: ['x', 'w', 'mul', 'b', 'add', 'loss'].map((id) => ({ id })),
      edges: [
        { from: 'x', to: 'mul' },
        { from: 'w', to: 'mul' },
        { from: 'mul', to: 'add' },
        { from: 'b', to: 'add' },
        { from: 'add', to: 'loss' },
      ],
    };
    const L = layeredLayout(g);
    for (const e of g.edges) expect(L.get(e.from)!.layer).toBeLessThan(L.get(e.to)!.layer);
    expect(L.get('x')!.layer).toBe(0);
    expect(L.get('loss')!.layer).toBe(3);
    // Orders within a layer are a permutation 0..k-1.
    const layer0 = [...L.values()].filter((n) => n.layer === 0).map((n) => n.order).sort();
    expect(layer0).toEqual([0, 1, 2]);
    expect([...layeredLayout(g).entries()]).toEqual([...L.entries()]);
  });

  it('survives a cycle and reduces an obvious crossing', () => {
    const cyc = layeredLayout({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] });
    expect(cyc.get('a')!.layer).toBe(0);
    expect(cyc.get('b')!.layer).toBe(1);
    // a1→b2 and a2→b1 would cross if b kept input order.
    const L = layeredLayout({
      nodes: [{ id: 'a1' }, { id: 'a2' }, { id: 'b1' }, { id: 'b2' }],
      edges: [{ from: 'a1', to: 'b2' }, { from: 'a2', to: 'b1' }],
    });
    expect(L.get('b2')!.order).toBeLessThan(L.get('b1')!.order);
  });
});
