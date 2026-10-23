/**
 * The rules behind a worked example's live parameters and step reveals
 * (README §8.1), pure and tested (example-state.test.ts):
 *
 * - every change goes through the example's `accept()` guard: an accepted
 *   change replaces the values, a rejected one leaves them as they were and
 *   says why (the control snaps back on release);
 * - a choice option that `accept()` would reject with the other values as
 *   they are is disabled, with the reason;
 * - "k steps revealed" is a count that survives parameter changes, clamped
 *   to the new number of steps.
 */
import { acceptParams, exampleDefaults } from '../core/problems';
import type { ChoiceParam, ExampleLevel, ExampleParam, LiveParam, ParamValues, WorkedExampleSpec } from '../types';

export type Proposal = { accepted: true; values: ParamValues } | { accepted: false; reason: string; values: ParamValues };

/** Snap a numeric value onto its parameter's range and step (log scales keep the value, clamped). */
export function snapParam(p: LiveParam, x: number): number {
  if (!Number.isFinite(x)) return p.value;
  const c = Math.min(p.max, Math.max(p.min, x));
  if (p.scale === 'log') return c;
  const k = Math.round((c - p.min) / p.step);
  return Math.min(p.max, Number((p.min + k * p.step).toFixed(10)));
}

/** Clean a patch: unknown names dropped, numbers snapped, choice indices clamped to real options. */
export function cleanPatch(spec: WorkedExampleSpec, patch: Partial<ParamValues>): ParamValues {
  const out: ParamValues = {};
  const params = (spec.params ?? {}) as Readonly<Record<string, ExampleParam>>;
  for (const [k, v] of Object.entries(patch)) {
    const p = params[k];
    if (!p || typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (p.kind === 'choice') out[k] = Math.max(0, Math.min(p.options.length - 1, Math.round(v)));
    else out[k] = snapParam(p, v);
  }
  return out;
}

/** Try a change: `accept()` decides. A rejected proposal keeps the current values and carries the reason. */
export function proposeParams(spec: WorkedExampleSpec, current: ParamValues, patch: Partial<ParamValues>): Proposal {
  const next = { ...current, ...cleanPatch(spec, patch) };
  const ok = acceptParams(spec, next);
  return ok === true ? { accepted: true, values: next } : { accepted: false, reason: ok, values: current };
}

/** The values to start from: the defaults, or `start` when it passes `accept()` (an external signal's value). */
export function startValues(spec: WorkedExampleSpec, start?: ParamValues): ParamValues {
  const def = exampleDefaults(spec);
  if (!start) return def;
  const merged = { ...def, ...cleanPatch(spec, start) };
  return acceptParams(spec, merged) === true ? merged : def;
}

/** For each option of a choice parameter: true, or the reason `accept()` gives with the other values as they are. */
export function choiceAvailability(spec: WorkedExampleSpec, current: ParamValues, name: string): (true | string)[] {
  const p = (spec.params as Readonly<Record<string, ExampleParam>> | undefined)?.[name];
  if (!p || p.kind !== 'choice') return [];
  return p.options.map((_, i) => (i === current[name] ? true : acceptParams(spec, { ...current, [name]: i })));
}

/** Steps revealed, clamped to [1, total] (0 when there are no steps). */
export function clampReveal(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(1, Math.min(total, Math.floor(count)));
}

/** The example's parameters in order, split by control. */
export function paramEntries(spec: WorkedExampleSpec): ({ name: string; kind: 'number'; p: LiveParam } | { name: string; kind: 'choice'; p: ChoiceParam })[] {
  return (Object.entries(spec.params ?? {}) as [string, ExampleParam][]).map(([name, p]) =>
    p.kind === 'choice' ? { name, kind: 'choice' as const, p } : { name, kind: 'number' as const, p },
  );
}

const LEVELS: Readonly<Record<ExampleLevel, { stars: string; word: string; short: string }>> = {
  direct: { stars: '★', word: 'Direct', short: 'direct' },
  combined: { stars: '★★', word: 'Combined', short: 'combined' },
  exam: { stars: '★★★', word: 'Exam level', short: 'exam level' },
};

/** ★ Direct · ★★ Combined · ★★★ Exam level. */
export const levelInfo = (level: ExampleLevel) => LEVELS[level] ?? LEVELS.direct;

/** Tab labels, numbered only where two examples share a level ("Direct 1", "Direct 2"). */
export function tabLabels(levels: readonly ExampleLevel[]): string[] {
  const total = new Map<ExampleLevel, number>();
  for (const l of levels) total.set(l, (total.get(l) ?? 0) + 1);
  const seen = new Map<ExampleLevel, number>();
  return levels.map((l) => {
    const k = (seen.get(l) ?? 0) + 1;
    seen.set(l, k);
    return (total.get(l) ?? 0) > 1 ? `${levelInfo(l).word} ${k}` : levelInfo(l).word;
  });
}

/** Arrow-key movement in a tab list (wraps); null for keys a tab list ignores. */
export function nextTab(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
