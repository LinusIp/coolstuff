/**
 * Every barrel must load in Node with no DOM: lesson tests import the pure
 * entry, the site's Node scripts import contracts, and a component module
 * that touches document/window/matchMedia/Worker at import time would break
 * them all. Each barrel is imported on its own (fresh module graph) so an
 * import cycle that only bites in one evaluation order shows up here too.
 */
import { describe, expect, it, vi } from 'vitest';

const BARRELS = ['./pure', './index', './core/index', './math/index', './util/index', './text/index', './visual/index', './practice/index', './controls/index', './shell/index', './structures/index'] as const;

describe('barrels load in Node, alone and together', () => {
  for (const b of BARRELS) {
    it(`${b} imports with no DOM`, async () => {
      vi.resetModules();
      expect(typeof document).toBe('undefined');
      const mod = await import(/* @vite-ignore */ b);
      expect(mod).toBeTypeOf('object');
    });
  }
  it('the pure entry carries no Preact component', async () => {
    vi.resetModules();
    const pure = await import('./pure');
    for (const [k, v] of Object.entries(pure)) {
      if (typeof v === 'function' && /^[A-Z]/.test(k) && !/Error$|^ConceptSet$/.test(k)) throw new Error(`@kit/pure exports "${k}", which looks like a component`);
    }
    expect(pure.auditLesson).toBeTypeOf('function');
  });
});
