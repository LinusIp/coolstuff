import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, randomSeed } from './rng';
import { clearHighlight, highlight, isLit, link, linkProps, linkTargetOf } from './link';

describe('seeded rng', () => {
  it('is deterministic per seed and per string', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.int(1, 6), a.float(0, 1)]).toEqual([b.next(), b.int(1, 6), b.float(0, 1)]);
    expect(createRng('linalg#p1').next()).toBe(createRng('linalg#p1').next());
    expect(createRng('a').seed).toBe(hashSeed('a'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(randomSeed()).toBeGreaterThan(0);
  });

  it('int is inclusive and uniform-ish; intExcept skips values', () => {
    const r = createRng(1);
    const counts = new Map<number, number>();
    for (let i = 0; i < 6000; i++) {
      const k = r.int(1, 6);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const c of counts.values()) expect(Math.abs(c - 1000)).toBeLessThan(150);
    for (let i = 0; i < 200; i++) expect(r.intExcept(-2, 2, [0])).not.toBe(0);
    expect(() => r.intExcept(0, 0, [0])).toThrow();
  });

  it('pick, shuffle, sign, chance, normal, fork', () => {
    const r = createRng(9);
    const xs = [1, 2, 3, 4, 5];
    expect(xs).toContain(r.pick(xs));
    const s = r.shuffle(xs);
    expect([...s].sort()).toEqual(xs);
    expect(xs).toEqual([1, 2, 3, 4, 5]); // not mutated
    expect([1, -1]).toContain(r.sign());
    expect(typeof r.chance(0.5)).toBe('boolean');
    const ns = Array.from({ length: 4000 }, () => r.normal(10, 2));
    const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
    expect(Math.abs(mean - 10)).toBeLessThan(0.15);
    expect(r.fork('x').next()).toBe(createRng(9).fork('x').next());
    expect(r.fork('x').next()).not.toBe(r.fork('y').next());
    expect(() => r.pick([])).toThrow();
  });
});

describe('link bus', () => {
  it('highlights and clears by source', () => {
    highlight({ concept: 'input' }, { source: 'a' });
    expect(isLit('input')).toBe(true);
    expect(isLit('output')).toBe(false);
    clearHighlight('b'); // not b's highlight
    expect(link.value.concept).toBe('input');
    clearHighlight('a');
    expect(link.value.concept).toBeNull();
  });

  it('several concepts, terms, and sticky taps', () => {
    highlight({ concept: 'input output', term: 'lam' });
    expect(isLit('output')).toBe(true);
    expect(isLit(null, 'lam')).toBe(true);
    highlight({ concept: 'matrix' }, { sticky: true });
    highlight({ concept: 'input' }); // hover can't override a pinned highlight
    expect(link.value.concept).toBe('matrix');
    clearHighlight(); // nor can a plain clear
    expect(link.value.concept).toBe('matrix');
    clearHighlight(undefined, true);
    expect(link.value.concept).toBeNull();
  });

  it('finds the concept and term of an element and its ancestors', () => {
    type Fake = { attrs: Record<string, string>; parentElement: Fake | null; tagName: string; getAttribute(k: string): string | null };
    const el = (attrs: Record<string, string>, parent: Fake | null = null, tagName = 'SPAN'): Fake => ({
      attrs,
      parentElement: parent,
      tagName,
      getAttribute(k) {
        return this.attrs[k] ?? null;
      },
    });
    const body = el({}, null, 'BODY');
    const anchor = el({ 'data-anchor': 'lam' }, body);
    const colored = el({ class: 'mord ct ct-eigenvalue' }, anchor);
    const leaf = el({ class: 'mord mathnormal' }, colored);
    expect(linkTargetOf(leaf as unknown as Element)).toEqual({ concept: 'eigenvalue', term: 'lam' });
    expect(linkTargetOf(el({ class: 'select-box' }, body) as unknown as Element)).toBeNull(); // "ct-" inside a word doesn't count
    expect(linkTargetOf(el({ class: 'ct ct-correct' }, body) as unknown as Element)).toBeNull(); // a state, not a concept
    expect(linkTargetOf(el({ 'data-concept': 'output' }, body) as unknown as Element)).toEqual({ concept: 'output', term: null });
  });

  it('linkProps publishes on hover and focus', () => {
    const p = linkProps({ concept: 'input', term: 'v' });
    expect(p['data-concept']).toBe('input');
    p.onPointerEnter();
    expect(isLit(null, 'v')).toBe(true);
    p.onPointerLeave();
    expect(isLit('input')).toBe(false);
  });
});
