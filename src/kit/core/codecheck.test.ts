import { describe, expect, it } from 'vitest';
import { cloneIssue, runCodeTests, runSnippet, sanitizeReport, stable, toCloneable } from './codecheck';

describe('runSnippet (Code it cells, tested in Node)', () => {
  it('emits: last value per name, and every value in order as snapshots', () => {
    const r = runSnippet('const path = [];\nlet w = 0;\nfor (let k = 0; k < 3; k++) { w -= 0.5 * 2 * (w - 3); path.push(w); emit("path", path); }\nemit("w", w);\nconsole.log("done", w);');
    expect(r.ok).toBe(true);
    expect(r.emits.w).toBe(3);
    expect(r.streams.path).toEqual([[3], [3, 3], [3, 3, 3]]);
    expect(r.logs).toEqual(['done 3']);
  });

  it('a shipped gradient-descent snippet converges (the kind of assertion a lesson test makes)', () => {
    const code = 'let w = w0;\nfor (let k = 0; k < steps; k++) {\n  w = w - eta * grad(w);\n  emit("w", w);\n}\nreturn w;';
    const r = runSnippet(code, { inputs: { w0: 0, eta: 0.1, steps: 100 }, helpers: { grad: '(w) => 2 * (w - 3)' } });
    expect(r.returned).toBeCloseTo(3, 6);
    expect(r.streams.w).toHaveLength(100);
    const diverge = runSnippet(code, { inputs: { w0: 0, eta: 1.1, steps: 50 }, helpers: { grad: '(w) => 2 * (w - 3)' } });
    expect(Math.abs(diverge.returned as number)).toBeGreaterThan(1e3);
  });

  it('inputs are read-only clones; helpers and prelude are hidden source', () => {
    const data = { xs: [1, 2, 3] };
    const r = runSnippet('data.xs.push(4);', { inputs: { data } });
    expect(r.ok).toBe(false); // frozen
    expect(data.xs).toEqual([1, 2, 3]);
    const p = runSnippet('return loss(5) + grad(5) + K;', { prelude: 'const K = 100;', helpers: { loss: 'function loss(w) { return (w - 3) ** 2; }', grad: (w: number) => 2 * (w - 3) } });
    expect(p.returned).toBe(108);
  });

  it('errors carry the line in the visible code, even after a prelude', () => {
    const r = runSnippet('let a = 1;\nlet b = 2;\nnull.boom;', { prelude: 'const x = 1;\nconst y = 2;\nconst z = 3;' });
    expect(r.error).toMatchObject({ line: 3, where: 'code' });
    const inPre = runSnippet('ok();', { prelude: 'function ok() { return 1; }\nnull.boom;' });
    expect(inPre.error?.where).toBe('prelude');
    const syntax = runSnippet('let a = (;');
    expect(syntax.ok).toBe(false);
    expect(runSnippet('emit("f", () => 1);').error?.message).toMatch(/emit plain data/);
    expect(runSnippet('emit(3, 1);').error?.message).toMatch(/needs a name/);
    expect(runSnippet('', { inputs: { 'bad name': 1 } }).error?.message).toMatch(/isn't a valid identifier/);
  });
});

describe('structured-clone safety', () => {
  it('cloneIssue names the bad part', () => {
    expect(cloneIssue({ a: [1, { b: 2 }], m: new Map([[1, 'x']]), d: new Date(0), t: new Float64Array(2) })).toBeNull();
    expect(cloneIssue({ f: [0, () => 1] })).toMatch(/value\.f\[1\] is a function/);
    expect(cloneIssue({ s: Symbol('x') })).toMatch(/symbol/);
    class Point {
      constructor(readonly x: number) {}
      len() {
        return this.x;
      }
    }
    expect(cloneIssue([new Point(1)])).toMatch(/Point instance/);
    const cyc: Record<string, unknown> = { a: 1 };
    cyc.self = cyc;
    expect(cloneIssue(cyc)).toBeNull(); // structured clone handles cycles
    expect(toCloneable(() => 1)).toBe('a function');
  });

  it('sanitizeReport hides hidden tests and makes results postable', () => {
    const rep = runCodeTests('function f(x) { return x === 3 ? () => 1 : x * 2; }', {
      entry: 'f',
      tests: [
        { args: [1], expect: 2 },
        { args: [3], expect: 6 },
        { args: [5], expect: 99, hidden: true },
      ],
    });
    const safe = sanitizeReport(rep);
    expect(safe.results[0]).toMatchObject({ ok: true, got: '2', args: [1], expected: 2 });
    expect(safe.results[1].got).toBe('a function');
    expect(safe.results[2]).toEqual({ name: 'test 3', ok: false, hidden: true });
    expect(() => structuredClone(safe)).not.toThrow();
  });

  it('runCodeTests accepts helpers too, and -0 counts as 0', () => {
    const rep = runCodeTests('function f(x) { return sq(x); }', { entry: 'f', tests: [{ args: [3], expect: 9 }] }, { helpers: { sq: '(x) => x * x' } });
    expect(rep.ok).toBe(true);
    expect(stable(-0)).toBe(stable(0));
  });
});
