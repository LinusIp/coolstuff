/**
 * The derivative as slope and as rate: the lesson's tests (CLAUDE.md §10). While the content is a wip
 * stub (no problems yet), the audits, the answer checks and the snippet
 * check are skipped; from the first problem on they all run, and the answer
 * check fails until it is written.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSON_BY_ID } from '@content/curriculum';
import { auditFigureKeys, auditLesson, runSnippet } from '@kit/pure';
import { FIGURES } from './figures';
import { noisyLine, samplePoints } from './math';
import * as content from './problems';

/** The skeleton `npm run new` made: no problems written yet. */
const STUB = content.PROBLEMS.length === 0;

/** meta.json, read as text so this file also loads inside scripts/lesson-template, where it still has {{placeholders}}. */
function readMeta(): { status?: string } | null {
  try {
    return JSON.parse(readFileSync(new URL('./meta.json', import.meta.url), 'utf8')) as { status?: string };
  } catch {
    return null;
  }
}

describe('calc1/derivative', () => {
  it('stays "wip" while it is a skeleton', () => {
    const meta = readMeta();
    if (STUB && meta) expect(meta.status).toBe('wip');
  });

  it.skipIf(STUB)('passes the kit audits', () => {
    expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]); // §4/§5/§10/§11 in one call
    expect(auditFigureKeys(content, FIGURES)).toEqual([]); // every figure key has a renderer
  });

  it.skipIf(STUB)('every stated answer is right (computed independently)', () => {
    // wip: recompute every worked example's `value` and every problem's answer here, with an
    // independent method (README §0), and every generated problem over many seeds (forEachSeed).
    expect.fail('wip: write the independent answer checks');
  });

  it.skipIf(STUB)('the Code it snippet runs and does what the lesson says', () => {
    const r = runSnippet(content.SNIPPETS.main, { inputs: {} });
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
    // wip: assert what the shipped snippet computes (it converges, it matches math.ts, …).
  });

  it('math.ts: sampled points lie on the curve; datasets are reproducible', () => {
    const pts = samplePoints((x) => x * x, -1, 1, 5);
    expect(pts).toEqual([
      [-1, 1],
      [-0.5, 0.25],
      [0, 0],
      [0.5, 0.25],
      [1, 1],
    ]);
    expect(noisyLine(7, 10, 2, 1)).toEqual(noisyLine(7, 10, 2, 1));
  });
});
