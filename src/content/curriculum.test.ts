import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_BY_ID, PATHS, SUBJECTS, expandPath } from './curriculum';

describe('curriculum', () => {
  it('has unique ids of the form <subject>/<slug>', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LESSONS) {
      expect(l.id).toMatch(/^[a-z0-9]+\/[a-z0-9-]+$/);
      expect(l.id).toBe(`${l.subject}/${l.slug}`);
    }
  });

  it('only references lessons that exist', () => {
    for (const l of LESSONS) for (const p of l.prerequisites) expect(LESSON_BY_ID.has(p), `${l.id} → ${p}`).toBe(true);
    for (const path of PATHS) for (const id of path.lessons) expect(LESSON_BY_ID.has(id), `${path.id} → ${id}`).toBe(true);
  });

  it('has no prerequisite cycles', () => {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') throw new Error(`cycle: ${[...trail, id].join(' → ')}`);
      state.set(id, 'visiting');
      for (const p of LESSON_BY_ID.get(id)!.prerequisites) visit(p, [...trail, id]);
      state.set(id, 'done');
    };
    for (const l of LESSONS) expect(() => visit(l.id, [])).not.toThrow();
  });

  it('matches the subjects and lesson counts in CLAUDE.md §9', () => {
    const counts = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.units.reduce((n, u) => n + u.lessons.length, 0)]));
    expect(counts).toEqual({
      calc1: 12, calc2: 12, calc3: 12, diffeq: 9, linalg: 20, prob: 13, discrete: 6, dsa: 27,
      sysdesign: 18, systems: 11, ml: 18, dl: 22, diffusion: 13, llm: 20, phys1: 20, phys2: 18, beyond: 21,
    });
  });

  it('numbers lessons 1..n within each subject', () => {
    for (const s of SUBJECTS) {
      const orders = s.units.flatMap((u) => u.lessons.map((l) => l.order));
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
  });

  it('gives every subject a distinct hue', () => {
    const hues = SUBJECTS.map((s) => s.hue);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('has the six learning paths from §7', () => {
    expect(PATHS.map((p) => p.title)).toEqual([
      'Calculus from zero', 'ML math foundations', 'Zero to LLMs', 'Interview-ready DSA', 'System design', 'Physics for engineers',
    ]);
  });

  it('expands a path into a valid study order', () => {
    for (const path of PATHS) {
      const order = expandPath(path.lessons);
      const pos = new Map(order.map((id, i) => [id, i]));
      for (const id of order) for (const p of LESSON_BY_ID.get(id)!.prerequisites) expect(pos.get(p)!).toBeLessThan(pos.get(id)!);
      for (const target of path.lessons) expect(pos.has(target)).toBe(true);
    }
  });

  it('makes diffusion visibly depend on Gaussians, KL divergence, U-Nets and SDEs', () => {
    const need = new Set(expandPath(['diffusion/consistency-models']));
    for (const id of ['prob/multivariate-gaussian', 'prob/entropy', 'dl/unets', 'diffusion/sde-ode']) expect(need.has(id), id).toBe(true);
  });
});
