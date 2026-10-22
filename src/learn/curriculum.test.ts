import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_BY_SLUG, PATHS, SUBJECTS } from './curriculum';

describe('curriculum', () => {
  it('has unique, well-formed slugs', () => {
    const slugs = LESSONS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^learn-[a-z0-9]+-[a-z0-9-]+$/);
  });

  it('only references lessons that exist', () => {
    for (const l of LESSONS) for (const p of l.prerequisites) expect(LESSON_BY_SLUG.has(p), `${l.slug} → ${p}`).toBe(true);
    for (const path of PATHS) for (const s of path.lessons) expect(LESSON_BY_SLUG.has(s), `${path.id} → ${s}`).toBe(true);
  });

  it('has no prerequisite cycles', () => {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (slug: string, trail: string[]): void => {
      if (state.get(slug) === 'done') return;
      if (state.get(slug) === 'visiting') throw new Error(`cycle: ${[...trail, slug].join(' → ')}`);
      state.set(slug, 'visiting');
      for (const p of LESSON_BY_SLUG.get(slug)!.prerequisites) visit(p, [...trail, slug]);
      state.set(slug, 'done');
    };
    for (const l of LESSONS) expect(() => visit(l.slug, [])).not.toThrow();
  });

  it('covers every subject in CLAUDE.md §8.4', () => {
    expect(SUBJECTS.map((s) => s.id)).toEqual([
      'calc1', 'calc2', 'calc3', 'diffeq', 'linalg', 'prob', 'discrete', 'dsa',
      'sysdesign', 'systems', 'ml', 'dl', 'diffusion', 'llm', 'phys1', 'phys2', 'beyond',
    ]);
    expect(SUBJECTS.find((s) => s.id === 'dsa')!.units.flatMap((u) => u.lessons)).toHaveLength(27);
    expect(SUBJECTS.find((s) => s.id === 'linalg')!.units.flatMap((u) => u.lessons)).toHaveLength(20);
  });
});
