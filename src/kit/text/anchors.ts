/**
 * Repeated `\anchor` ids (README §5.1–5.2), pure and tested so Formula and
 * Derivation agree on one rule:
 *
 * - An id may tag several occurrences (`\anchor{v}{…}` on both sides of
 *   A v = λ v). The FIRST occurrence carries the explain note, its leader and
 *   the inline live value; EVERY occurrence lights on hover (`data-anchor`).
 * - Between two derivation steps, occurrences of the same id are paired in
 *   order (1st with 1st, 2nd with 2nd) and FLIP-slide; unpaired extras fade
 *   out (old step) or fade in (new step).
 *
 * Kit architect seed, handed to G1 with its tests (PLAN.md §2).
 */

/** Every `\anchor{id}{…}` occurrence in a TeX string, in reading order (ids may repeat). */
export function anchorOccurrences(tex: string): string[] {
  return [...tex.matchAll(/\\anchor\s*\{\s*([^{}\s]+)\s*\}/g)].map((m) => m[1]);
}

/** For each occurrence, whether it carries the explain note / leader / live value (the first of its id). */
export function noteCarriers(occurrences: readonly string[]): boolean[] {
  const seen = new Set<string>();
  return occurrences.map((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export interface AnchorPairing {
  /** [index in `from`, index in `to`]: these occurrences slide from the old position to the new one. */
  pairs: [number, number][];
  /** Indices in `from` with no partner: fade out. */
  leaving: number[];
  /** Indices in `to` with no partner: fade in. */
  entering: number[];
}

/**
 * Pair the anchor occurrences of two consecutive derivation steps: the k-th
 * occurrence of an id in `from` with the k-th occurrence of the same id in `to`.
 */
export function pairAnchors(from: readonly string[], to: readonly string[]): AnchorPairing {
  const queues = new Map<string, number[]>();
  from.forEach((id, i) => {
    const q = queues.get(id);
    if (q) q.push(i);
    else queues.set(id, [i]);
  });
  const pairs: [number, number][] = [];
  const entering: number[] = [];
  to.forEach((id, j) => {
    const i = queues.get(id)?.shift();
    if (i === undefined) entering.push(j);
    else pairs.push([i, j]);
  });
  const paired = new Set(pairs.map(([i]) => i));
  const leaving = from.map((_, i) => i).filter((i) => !paired.has(i));
  return { pairs, leaving, entering };
}

// ── Anchor contents (G1 additions) ────────────────────────────────────────

export interface AnchorSpan {
  id: string;
  /** The TeX inside the anchor's second argument (brace-matched). */
  content: string;
  /** Index of the `\anchor` in the source. */
  start: number;
  /** Index just after the closing brace. */
  end: number;
  /** How many anchors enclose this one. */
  depth: number;
}

/** Index of the brace closing the one at `open` (escaped braces skipped); −1 if unbalanced. */
function closeBrace(tex: string, open: number): number {
  let depth = 0;
  for (let i = open; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '\\') {
      i++; // skip the escaped character (\{ \} \\)
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Every `\anchor{id}{content}` with its content, in reading order (the order
 * of `anchorOccurrences`), so a formula can show a symbol in its key, its
 * live-value column and its screen-reader text without re-typing it.
 */
export function anchorSpans(tex: string): AnchorSpan[] {
  const out: AnchorSpan[] = [];
  for (const m of tex.matchAll(/\\anchor\s*\{\s*([^{}\s]+)\s*\}\s*/g)) {
    const start = m.index ?? 0;
    const open = start + m[0].length;
    if (tex[open] !== '{') continue;
    const close = closeBrace(tex, open);
    if (close < 0) continue;
    out.push({ id: m[1], content: tex.slice(open + 1, close), start, end: close + 1, depth: 0 });
  }
  for (const a of out) a.depth = out.filter((b) => b !== a && b.start < a.start && b.end >= a.end).length;
  return out;
}

/** The first occurrence of each anchor id, in order of first appearance. */
export function firstSpans(tex: string): AnchorSpan[] {
  const seen = new Set<string>();
  return anchorSpans(tex).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

/** `Matrix` → `matrix`, `EigenValue` → `eigen-value` (the inverse of theme.ts `shorthandMacro`). */
const fromShorthand = (name: string): string => name.replace(/[A-Z]/g, (c, i: number) => (i ? '-' : '') + c.toLowerCase());

/**
 * The concept a TeX snippet colours first: `\colorTerm{x}{…}`, `\ct{x}{…}`, or
 * a `\c<Name>` shorthand (looked up in `macros` when given, else derived from
 * the name). Null when it colours nothing. Explain notes use it as their
 * default concept (types.ts `ExplainNote.concept`).
 */
export function conceptInTex(tex: string, macros?: Readonly<Record<string, string>>): string | null {
  const re = /\\(?:colorTerm|ct)\s*\{\s*([a-z][a-z0-9-]*)\s*\}|\\c([A-Z][A-Za-z0-9]*)(?![A-Za-z0-9])/g;
  for (const m of tex.matchAll(re)) {
    if (m[1]) return m[1];
    const macro = `\\c${m[2]}`;
    const body = macros?.[macro];
    if (body) {
      const inner = /\\(?:colorTerm|ct)\s*\{\s*([a-z][a-z0-9-]*)\s*\}/.exec(body);
      if (inner) return inner[1];
      continue;
    }
    if (!macros) return fromShorthand(m[2]);
  }
  return null;
}

/** TeX with every `\anchor{id}{…}` wrapper removed (its content kept): for showing a symbol outside its formula. */
export function stripAnchors(tex: string): string {
  let s = tex;
  for (let guard = 0; guard < 64; guard++) {
    const m = /\\anchor\s*\{\s*[^{}\s]+\s*\}\s*/.exec(s);
    if (!m) break;
    const open = m.index + m[0].length;
    if (s[open] !== '{') break;
    const close = closeBrace(s, open);
    if (close < 0) break;
    s = s.slice(0, m.index) + '{' + s.slice(open + 1, close) + '}' + s.slice(close + 1);
  }
  return s;
}
