/**
 * Lesson-level audits and the problems.ts module contract (CLAUDE.md §4,
 * §10, §11). A lesson's test calls ONE function:
 *
 *   import * as content from './problems';
 *   expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]);
 *
 * which runs auditProblems / auditExamples / auditQuiz and adds: TL;DR (3
 * points, valid formula), 2–4 traps each with a counterexample figure,
 * caption and description, ≥ 2 references, ≥ 1 key formula whose every
 * `\anchor` has an explain note (and vice versa), derivations with ≥ 2
 * justified steps, predictions, glossary terms, and concept names that
 * resolve against `C`. Pure (Node-safe).
 */
import { GLOBAL_CONCEPTS, type ConceptSet } from '../theme';
import { auditConceptRef, auditExamples, auditProblems, auditQuiz, auditRich, auditTex, type AuditOptions } from './problems';
import type { DerivationSpec, FormulaSpec, GlossaryTerm, LessonContent, PredictSpec, Reference, TldrSpec, TrapSpec } from '../types';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function uniqueIds(what: string, items: readonly { id: string }[], out: string[]): void {
  const seen = new Set<string>();
  for (const it of items) {
    if (!ID_RE.test(it.id)) out.push(`${what} id "${it.id}" should be lowercase-with-dashes`);
    if (seen.has(it.id)) out.push(`duplicate ${what} id "${it.id}"`);
    seen.add(it.id);
  }
}

/** The revision card: exactly 3 points and a valid key formula. */
export function auditTldr(t: TldrSpec | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  if (!t) return ['TLDR is missing'];
  if (t.points.length !== 3) out.push(`TLDR has ${t.points.length} points; needs exactly 3`);
  t.points.forEach((p, k) => auditRich(`TLDR point ${k + 1}`, p, o, out));
  if (!t.formula?.trim()) out.push('TLDR: the key formula is empty');
  auditTex('TLDR formula', t.formula, o, out);
  t.key?.forEach((k, i) => {
    auditTex(`TLDR key ${i + 1}`, k.tex, o, out);
    auditRich(`TLDR key ${i + 1} text`, k.text, o, out);
  });
  return out;
}

/** Common traps (§4.8): 2–4, each with a myth, explanation, truth and a counterexample figure with caption and description. */
export function auditTraps(traps: readonly TrapSpec[] | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  const list = traps ?? [];
  if (list.length < 2 || list.length > 4) out.push(`${list.length} common traps; need 2–4`);
  uniqueIds('trap', list, out);
  for (const t of list) {
    auditRich(`trap ${t.id} myth`, t.myth, o, out);
    auditRich(`trap ${t.id} explanation`, t.explanation, o, out);
    auditRich(`trap ${t.id} truth`, t.truth, o, out);
    if (!t.figure?.trim()) out.push(`trap ${t.id}: needs a counterexample figure key (§4.8)`);
    auditRich(`trap ${t.id} figureCaption`, t.figureCaption, o, out);
    if (!t.figureDescription?.trim()) out.push(`trap ${t.id}: figureDescription (for screen readers) is empty`);
    else if (t.figureDescription.trim().length < 30) out.push(`trap ${t.id}: figureDescription is too thin to describe a figure`);
  }
  return out;
}

/** References (§10): at least two, each with authors, title and a year or URL. */
export function auditReferences(refs: readonly Reference[] | undefined): string[] {
  const out: string[] = [];
  const list = refs ?? [];
  if (list.length < 2) out.push(`${list.length} reference(s); cite at least 2 (§10)`);
  list.forEach((r, k) => {
    if (!r.authors?.trim()) out.push(`reference ${k + 1}: authors missing`);
    if (!r.title?.trim()) out.push(`reference ${k + 1}: title missing`);
    if (r.year === undefined && !r.url) out.push(`reference ${k + 1}: give a year (or a URL for web notes)`);
    if (r.year !== undefined && (!Number.isInteger(r.year) || r.year < 1600 || r.year > 2100)) out.push(`reference ${k + 1}: odd year ${r.year}`);
    if (r.url && !/^https?:\/\//.test(r.url)) out.push(`reference ${k + 1}: url should start with https://`);
  });
  return out;
}

/** `\anchor{id}{…}` ids in a TeX string, in order of first occurrence. */
export function anchorIds(tex: string): string[] {
  const ids: string[] = [];
  for (const m of tex.matchAll(/\\anchor\s*\{\s*([^{}\s]+)\s*\}/g)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

/** Key formulas (§3, §11): valid TeX; every anchor explained and every note anchored; brackets on real anchors. */
export function auditFormulas(formulas: readonly FormulaSpec[] | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  const list = formulas ?? [];
  if (list.length === 0) out.push('no key formula (FORMULAS); the Formalize section needs at least one, with "explain this" notes');
  uniqueIds('formula', list, out);
  for (const f of list) {
    const w = `formula ${f.id}`;
    if (!f.tex?.trim()) out.push(`${w}: tex is empty`);
    auditTex(w, f.tex, o, out);
    const anchors = anchorIds(f.tex ?? '');
    const notes = Object.keys(f.explain ?? {});
    if (anchors.length === 0) out.push(`${w}: tag its symbols with \\anchor{id}{…} so "explain this" can point at them`);
    for (const a of anchors) if (!notes.includes(a)) out.push(`${w}: \\anchor{${a}} has no explain note`);
    for (const n of notes) if (!anchors.includes(n)) out.push(`${w}: explain note "${n}" has no \\anchor{${n}} in the TeX`);
    for (const [id, note] of Object.entries(f.explain ?? {})) {
      auditRich(`${w} explain ${id} word`, note.word, o, out);
      auditRich(`${w} explain ${id} gloss`, note.gloss, o, out);
      auditConceptRef(`${w} explain ${id}`, note.concept, o, out);
    }
    f.brackets?.forEach((b, k) => {
      if (!anchors.includes(b.anchor)) out.push(`${w} bracket ${k + 1}: anchor "${b.anchor}" isn't in the TeX`);
      auditRich(`${w} bracket ${k + 1}`, b.text, o, out);
      auditConceptRef(`${w} bracket ${k + 1}`, b.concept, o, out);
    });
    auditRich(`${w} inWords`, f.inWords, o, out, false);
  }
  return out;
}

/** Derivations: ≥ 2 steps, valid TeX, a justification on every step after the first. */
export function auditDerivations(derivations: readonly DerivationSpec[] | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  const list = derivations ?? [];
  uniqueIds('derivation', list, out);
  for (const d of list) {
    if (d.steps.length < 2) out.push(`derivation ${d.id}: needs at least 2 steps`);
    d.steps.forEach((s, k) => {
      const w = `derivation ${d.id} step ${k + 1}`;
      if (!s.tex?.trim()) out.push(`${w}: tex is empty`);
      auditTex(w, s.tex, o, out);
      if (s.rel) auditTex(`${w} rel`, s.rel, o, out);
      auditRich(`${w} why`, s.why, o, out, k > 0);
    });
  }
  return out;
}

/** Predict prompts: a guess that can be judged and a reveal. */
export function auditPredicts(predicts: readonly PredictSpec[] | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  const list = predicts ?? [];
  uniqueIds('predict', list, out);
  for (const p of list) {
    auditRich(`predict ${p.id} prompt`, p.prompt, o, out);
    auditRich(`predict ${p.id} reveal`, p.reveal, o, out);
    auditRich(`predict ${p.id} right`, p.right, o, out, false);
    auditRich(`predict ${p.id} wrong`, p.wrong, o, out, false);
    const g = p.guess;
    if (g.kind === 'choice') {
      if (g.options.length < 2 || g.answer < 0 || g.answer >= g.options.length) out.push(`predict ${p.id}: needs ≥ 2 options and a valid answer index`);
      g.options.forEach((x, k) => auditRich(`predict ${p.id} option ${k + 1}`, x, o, out));
    } else if (g.kind === 'number') {
      if (!(g.min < g.max) || g.answer < g.min || g.answer > g.max || !(g.tolerance > 0)) out.push(`predict ${p.id}: answer must lie in [min, max] with tolerance > 0`);
      auditRich(`predict ${p.id} label`, g.label, o, out);
    }
  }
  return out;
}

/** Glossary terms: a term and a Rich definition each, no duplicates. */
export function auditGlossary(terms: readonly GlossaryTerm[] | undefined, o: AuditOptions = {}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of terms ?? []) {
    if (!g.term?.trim()) out.push('glossary: a term is empty');
    if (seen.has(g.term.toLowerCase())) out.push(`glossary: "${g.term}" appears twice`);
    seen.add(g.term.toLowerCase());
    auditRich(`glossary ${g.term}`, g.definition, o, out);
  }
  return out;
}

export interface LessonAuditOptions {
  /** Lesson ids that exist, e.g. `LESSON_BY_ID.keys()` from curriculum.ts (checks worked examples' `uses`). */
  knownLessons?: Iterable<string>;
  /** Generated instances per problem. Default 60. */
  seeds?: number;
}

/**
 * Everything a lesson's content must satisfy, in one call. Pass the
 * problems.ts module itself (`import * as content from './problems'`).
 * Returns a list of problems, each prefixed by its section; empty = pass.
 */
export function auditLesson(content: Partial<LessonContent>, opts: LessonAuditOptions = {}): string[] {
  const C = content.C;
  if (!C) return ['problems.ts must export the lesson\'s concepts as `C` (defineConcepts)'];
  const o: AuditOptions = { concepts: C, macros: C.macros(), seeds: opts.seeds, knownLessons: opts.knownLessons ? [...opts.knownLessons] : undefined };
  const tag = (section: string, xs: string[]) => xs.map((x) => `${section}: ${x}`);
  return [
    ...tag('tldr', auditTldr(content.TLDR, o)),
    ...tag('formalize', auditFormulas(content.FORMULAS, o)),
    ...tag('formalize', auditDerivations(content.DERIVATIONS, o)),
    ...tag('examples', content.EXAMPLES ? auditExamples(content.EXAMPLES, o) : ['EXAMPLES is missing']),
    ...tag('traps', auditTraps(content.TRAPS, o)),
    ...tag('practice', content.PROBLEMS ? auditProblems(content.PROBLEMS, o) : ['PROBLEMS is missing']),
    ...tag('quickcheck', content.QUIZ ? auditQuiz(content.QUIZ, o) : ['QUIZ is missing']),
    ...tag('next', auditReferences(content.REFERENCES)),
    ...tag('predict', auditPredicts(content.PREDICTS, o)),
    ...tag('glossary', auditGlossary(content.GLOSSARY, o)),
    ...tag('code', Object.entries(content.SNIPPETS ?? {}).flatMap(([k, src]) => (typeof src === 'string' && src.trim() ? [] : [`SNIPPETS.${k} is empty`]))),
  ];
}

/** The figure keys a lesson's content refers to, by the `LessonFigures` map that must render them. */
export interface FigureKeys {
  examples: string[];
  problems: string[];
  customs: string[];
  traps: string[];
  quiz: string[];
}

/** Every `figure` key in the content: worked examples, problems (custom drag targets go to `customs`), traps, quiz questions. */
export function figureKeys(content: Partial<LessonContent>): FigureKeys {
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const problems = content.PROBLEMS ?? [];
  const isCustom = (p: (typeof problems)[number]) => p.answer.kind === 'drag' && p.answer.target.mode === 'custom';
  return {
    examples: uniq((content.EXAMPLES ?? []).map((e) => e.figure)),
    problems: uniq(problems.filter((p) => !isCustom(p)).map((p) => p.figure)),
    customs: uniq(problems.filter(isCustom).map((p) => p.figure)),
    traps: uniq((content.TRAPS ?? []).map((t) => t.figure)),
    quiz: uniq((content.QUIZ ?? []).map((q) => q.figure)),
  };
}

/**
 * Every figure key the content uses has a renderer in the lesson's
 * figures.tsx `FIGURES` (and no renderer is orphaned). lesson.test.ts can
 * import figures.tsx (it has no side effects) and call:
 *
 *   expect(auditFigureKeys(content, FIGURES)).toEqual([]);
 */
export function auditFigureKeys(content: Partial<LessonContent>, figures: Partial<Record<keyof FigureKeys, Readonly<Record<string, unknown>> | undefined>>): string[] {
  const out: string[] = [];
  const keys = figureKeys(content);
  for (const group of Object.keys(keys) as (keyof FigureKeys)[]) {
    const have = Object.keys(figures[group] ?? {});
    for (const k of keys[group]) if (!have.includes(k)) out.push(`figures.tsx: FIGURES.${group}["${k}"] is missing (used by the content)`);
    for (const k of have) if (!keys[group].includes(k)) out.push(`figures.tsx: FIGURES.${group}["${k}"] is never used`);
  }
  return out;
}

const isConceptSet = (c: unknown): c is ConceptSet => !!c && typeof (c as ConceptSet).macros === 'function' && Array.isArray((c as ConceptSet).names);

/**
 * The minimal export contract practice pages rely on, checked by
 * scripts/build-index.ts for every lesson folder with a problems.ts: `C` is
 * a ConceptSet, `PROBLEMS` a non-empty array of specs with unique ids.
 * (The full content is audited by the lesson's own test.)
 */
export function validateLessonModule(mod: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (!isConceptSet(mod.C)) out.push('problems.ts must export `C` = defineConcepts({...})');
  const P = mod.PROBLEMS;
  if (!Array.isArray(P) || P.length === 0) out.push('problems.ts must export `PROBLEMS`, a non-empty array of ProblemSpec');
  else {
    const ids = new Set<string>();
    for (const p of P as { id?: unknown; difficulty?: unknown }[]) {
      if (typeof p?.id !== 'string' || !ID_RE.test(p.id)) out.push(`PROBLEMS: bad id ${JSON.stringify(p?.id)}`);
      else if (ids.has(p.id)) out.push(`PROBLEMS: duplicate id "${p.id}"`);
      else ids.add(p.id);
      if (p?.difficulty !== 1 && p?.difficulty !== 2 && p?.difficulty !== 3) out.push(`PROBLEMS: "${String(p?.id)}" needs difficulty 1, 2 or 3`);
    }
  }
  for (const k of Object.keys(mod)) {
    if (/^[A-Z][A-Z_]*$/.test(k) && !['C', 'TLDR', 'FORMULAS', 'DERIVATIONS', 'EXAMPLES', 'PROBLEMS', 'QUIZ', 'TRAPS', 'REFERENCES', 'PREDICTS', 'GLOSSARY', 'SNIPPETS'].includes(k)) {
      // Extra upper-case exports are allowed (lesson constants), but warn about likely typos of the contract names.
      if (/^(PROBLEM|EXAMPLE|TRAP|REFERENCE|FORMULA|DERIVATION|PREDICT|SNIPPET)$/.test(k)) out.push(`problems.ts exports "${k}"; did you mean "${k}S"?`);
    }
  }
  return out;
}

/** The global concept names (input, output, error, prob, correct) every page knows without defining them. */
export const GLOBAL_CONCEPT_NAMES: readonly string[] = Object.keys(GLOBAL_CONCEPTS);
