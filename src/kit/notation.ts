/**
 * Site-wide maths notation (see NOTATION.md) and the KaTeX settings every
 * component shares, plus relation chains: multi-line maths that breaks at
 * relations on a phone and lines up under the first relation.
 *
 * Pure: works in Node (tests, build-time prerender) and the browser.
 */
import katex, { type KatexOptions } from 'katex';

/**
 * The notation macros. Every lesson gets these; a lesson adds its own concept
 * shorthands from `defineConcepts(...).macros()`.
 */
export const TEX_MACROS: Readonly<Record<string, string>> = {
  // Colour and annotation (classes, never inline colours, so terms re-theme instantly)
  '\\colorTerm': '\\htmlClass{ct ct-#1}{#2}',
  '\\ct': '\\htmlClass{ct ct-#1}{#2}',
  '\\anchor': '\\htmlData{anchor=#1}{#2}',
  '\\chg': '\\htmlClass{chg}{#1}',

  // Vectors and matrices
  '\\vec': '\\mathbf{#1}',
  '\\bm': '\\boldsymbol{#1}',
  '\\uvec': '\\hat{\\mathbf{#1}}',
  '\\ihat': '\\hat{\\boldsymbol{\\imath}}',
  '\\jhat': '\\hat{\\boldsymbol{\\jmath}}',
  '\\khat': '\\hat{\\mathbf{k}}',
  '\\zerovec': '\\mathbf{0}',
  '\\T': '{\\top}',
  '\\inv': '^{-1}',
  '\\norm': '\\left\\lVert #1 \\right\\rVert',
  '\\abs': '\\left\\lvert #1 \\right\\rvert',
  '\\inner': '\\langle #1,\\, #2 \\rangle',
  '\\rank': '\\operatorname{rank}',
  '\\tr': '\\operatorname{tr}',
  '\\diag': '\\operatorname{diag}',
  '\\spn': '\\operatorname{span}',
  '\\nullsp': '\\operatorname{null}',
  '\\colsp': '\\operatorname{col}',
  '\\proj': '\\operatorname{proj}',

  // Sets
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',

  // Calculus
  '\\d': '\\mathrm{d}',
  '\\dv': '\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}',
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
  '\\grad': '\\nabla',
  '\\divg': '\\nabla\\cdot',
  '\\curl': '\\nabla\\times',
  '\\eval': '\\left. #1 \\right|',

  // Probability and statistics
  '\\E': '\\mathbb{E}',
  '\\Var': '\\operatorname{Var}',
  '\\Cov': '\\operatorname{Cov}',
  '\\Prob': '\\operatorname{P}',
  '\\given': '\\,\\middle|\\,',
  '\\Normal': '\\mathcal{N}',
  '\\KL': 'D_{\\mathrm{KL}}',
  '\\iid': '\\overset{\\text{iid}}{\\sim}',

  // Optimisation, ML, algorithms
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\softmax': '\\operatorname{softmax}',
  '\\loss': '\\mathcal{L}',
  '\\bigO': '\\mathcal{O}',

  // Definitions and units
  '\\defeq': '\\coloneqq',
  '\\unit': '#1\\,\\mathrm{#2}',
};

/** KaTeX options shared by runtime rendering and build-time prerender. */
export function texOptions(displayMode: boolean, extra: KatexOptions = {}): KatexOptions {
  const { macros, ...rest } = extra;
  return {
    displayMode,
    throwOnError: false,
    output: 'htmlAndMathml',
    // \htmlClass / \htmlData are the only trusted commands; never print strict-mode warnings at runtime.
    strict: 'ignore',
    trust: (ctx) => ctx.command === '\\htmlClass' || ctx.command === '\\htmlData',
    // KaTeX mutates the macros object on \gdef, so every render gets a fresh copy.
    macros: { ...TEX_MACROS, ...(macros ?? {}) },
    ...rest,
  };
}

/** TeX → KaTeX HTML (+ MathML for screen readers). */
export function texToHtml(tex: string, displayMode = false, extra?: KatexOptions): string {
  return katex.renderToString(tex, texOptions(displayMode, extra));
}

// ── Relation chains ──────────────────────────────────────────────────────

/**
 * Relations that start a new clause: a consequence reads best on its own line.
 * Kept at the front of the clause they introduce.
 */
const MAJOR_RELATIONS = new Set([
  '\\implies',
  '\\impliedby',
  '\\iff',
  '\\Rightarrow',
  '\\Leftarrow',
  '\\Leftrightarrow',
  '\\Longrightarrow',
  '\\Longleftarrow',
  '\\Longleftrightarrow',
  '\\therefore',
]);
/** Relations that chain within a clause: continuation lines start with one, aligned under the first. */
const MINOR_RELATIONS = new Set([
  '\\le',
  '\\leq',
  '\\ge',
  '\\geq',
  '\\ne',
  '\\neq',
  '\\lt',
  '\\gt',
  '\\approx',
  '\\equiv',
  '\\cong',
  '\\propto',
  '\\sim',
  '\\simeq',
  '\\coloneqq',
  '\\defeq',
  '\\to',
  '\\mapsto',
  '\\leqslant',
  '\\geqslant',
]);
/** Spacing at the top level that separates list items ("λ₁ = 5, \quad λ₂ = 2"). */
const SOFT_SEPARATORS = new Set(['\\quad', '\\qquad']);
const OPEN = new Set(['{', '(', '[']);
const CLOSE = new Set(['}', ')', ']']);

export interface ChainClause {
  /** Everything before the clause's first minor relation (a major relation, if any, leads it). */
  lhs: string;
  /** Each minor relation with its right-hand side, e.g. "= \lambda^2 - 7\lambda + 10". */
  segs: string[];
  /**
   * A list item joined to the clause before it by ",\ " or "\quad"
   * ("\lambda_1 = 5,\ \lambda_2 = 2"). Joined clauses travel together and
   * wrap as one unit, so "\lambda_2 = 2" is never stranded on its own line.
   */
  joined?: true;
}

interface Token {
  text: string;
  /** Bracket depth before this token. */
  depth: number;
}

function tokenize(tex: string): Token[] {
  const out: Token[] = [];
  let depth = 0;
  let i = 0;
  while (i < tex.length) {
    const ch = tex[i];
    let text: string;
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(tex.slice(i));
      text = m ? m[0] : '\\';
    } else {
      text = ch;
    }
    const before = depth;
    if (text === '\\left' || text === '\\begin' || text === '\\bigl' || text === '\\Bigl') {
      depth++;
      // The delimiter after \left is part of it: swallow it so it doesn't count twice.
      if (text.endsWith('left') || text.endsWith('l')) {
        const rest = tex.slice(i + text.length);
        const d = /^\s*(\\[a-zA-Z]+|\\.|.)/.exec(rest);
        if (d && text !== '\\begin') text += d[0];
      }
    } else if (text === '\\right' || text === '\\end' || text === '\\bigr' || text === '\\Bigr') {
      depth = Math.max(0, depth - 1);
      if (text !== '\\end') {
        const rest = tex.slice(i + text.length);
        const d = /^\s*(\\[a-zA-Z]+|\\.|.)/.exec(rest);
        if (d) text += d[0];
      }
    } else if (OPEN.has(text) || text === '\\{' || text === '\\langle') {
      depth++;
    } else if (CLOSE.has(text) || text === '\\}' || text === '\\rangle') {
      depth = Math.max(0, depth - 1);
    }
    out.push({ text, depth: Math.min(before, depth) });
    i += text.length;
  }
  return out;
}

const isMinor = (t: string): boolean => t === '=' || t === '<' || t === '>' || MINOR_RELATIONS.has(t);

/**
 * Split TeX at its top-level relations into clauses of relation chains.
 * Braces protect a group from splitting: `{\lambda_1 = 5}` stays whole.
 *
 *   "(\lambda-5)(\lambda-2) = 0 \implies \lambda_1 = 5,\ \lambda_2 = 2"
 *   → [ { lhs: "(\lambda-5)(\lambda-2)", segs: ["= 0"] },
 *       { lhs: "\implies \lambda_1", segs: ["= 5,"] },
 *       { lhs: "\lambda_2", segs: ["= 2"] } ]
 */
export function splitRelations(tex: string): ChainClause[] {
  const tokens = tokenize(tex.trim());
  const clauses: ChainClause[] = [];
  let cur: ChainClause = { lhs: '', segs: [] };
  let joinNext = false;
  const push = (s: string) => {
    if (cur.segs.length) cur.segs[cur.segs.length - 1] += s;
    else cur.lhs += s;
  };
  const flush = () => {
    const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
    cur.lhs = tidy(cur.lhs);
    // A tiny right-hand side ("= 0") stays on the line before it: no line is just "= 0".
    cur.segs = cur.segs.map(tidy).filter(Boolean).reduce<string[]>((acc, seg) => {
      const rhs = seg.replace(/^(\\[a-zA-Z]+|[=<>])\s*/, '');
      if (acc.length && rhs.replace(/[\s,.;]/g, '').length <= 2) acc[acc.length - 1] += ' ' + seg;
      else acc.push(seg);
      return acc;
    }, []);
    if (cur.lhs || cur.segs.length) clauses.push(cur);
    cur = joinNext && clauses.length ? { lhs: '', segs: [], joined: true } : { lhs: '', segs: [] };
    joinNext = false;
  };
  for (let k = 0; k < tokens.length; k++) {
    const { text, depth } = tokens[k];
    if (depth === 0 && MAJOR_RELATIONS.has(text)) {
      flush();
      cur.lhs = text + ' ';
      continue;
    }
    if (depth === 0 && isMinor(text) && (cur.lhs.trim() || cur.segs.length)) {
      cur.segs.push(text + ' ');
      continue;
    }
    if (depth === 0 && SOFT_SEPARATORS.has(text) && cur.segs.length) {
      joinNext = true;
      flush();
      continue;
    }
    // ",\ " or ", \quad" after a relation ends a list item.
    if (depth === 0 && text === ',' && cur.segs.length) {
      let j = k + 1;
      while (j < tokens.length && tokens[j].text === ' ') j++;
      const next = tokens[j]?.text;
      if (next === '\\ ' || next === '\\quad' || next === '\\qquad' || next === '~') {
        push(',');
        joinNext = true;
        flush();
        k = j;
        continue;
      }
    }
    push(text);
  }
  flush();
  return clauses;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Render a relation chain: each piece is set inline with \displaystyle, so
 * fractions keep display size, and the flex layout in components.css (.mchain)
 * wraps whole "relation + right-hand side" pieces, aligned under the first
 * relation. A single MathML copy of the whole expression serves screen readers.
 */
export function mathChainHtml(tex: string, extra?: KatexOptions): string {
  const piece = (src: string) =>
    katex.renderToString(`\\displaystyle ${src}`, texOptions(false, { ...extra, output: 'html' }));
  const groups: ChainClause[][] = [];
  for (const c of splitRelations(tex)) {
    if (c.joined && groups.length) groups[groups.length - 1].push(c);
    else groups.push([c]);
  }
  const clauseHtml = (c: ChainClause) => {
    const lhs = c.lhs ? `<span class="mchain__lhs">${piece(c.lhs)}</span>` : '';
    const rest = c.segs.length
      ? `<span class="mchain__rest">${c.segs.map((s) => `<span class="mchain__seg">${piece(s)}</span>`).join('')}</span>`
      : '';
    return `<span class="mchain__clause">${lhs}${rest}</span>`;
  };
  const clauses = groups
    .map((g) => (g.length === 1 ? clauseHtml(g[0]) : `<span class="mchain__group">${g.map(clauseHtml).join('')}</span>`))
    .join('');
  const mathml = katex.renderToString(tex, texOptions(true, { ...extra, output: 'mathml' }));
  return `<div class="mchain" data-tex="${esc(tex)}"><span class="sr-only">${mathml}</span><span class="mchain__visual" aria-hidden="true">${clauses}</span></div>`;
}

// ── Numbers for readouts, ticks and prose ───────────────────────────────

/**
 * A number for a readout, tick or sentence: fixed decimals (tabular figures
 * don't jitter), a true minus sign (U+2212), and no "−0.00".
 */
export function formatNumber(x: number, decimals = 2): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? '—' : x > 0 ? '∞' : '−∞';
  const s = x.toFixed(decimals);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s.replace('-', '−');
}

/** `(1.40, −0.20)`: a vector as the tuple readouts show. */
export function formatVector(v: readonly number[], decimals = 2): string {
  return `(${v.map((x) => formatNumber(x, decimals)).join(', ')})`;
}
