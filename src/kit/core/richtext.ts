/**
 * RichText: the one prose format for problems, hints, solutions, quiz options
 * and captions (types.ts `Rich`). Pure string → HTML (KaTeX rendered to a
 * string), so it works in Node tests, in audits, and at build time.
 *
 *   $inline TeX$            $$display TeX$$ (its own block; scrolls inside its box)
 *   **bold**   *italic*     `code`
 *   [link text](url)        [term text]{concept}  → coloured, hover-linked concept term
 *   [[term]]  [[term|shown text]]                 → glossary term (Glossary enhances it)
 *   blank line → new paragraph;  "- item" / "1. item" lines → lists;  \$ → a literal dollar
 */
import { texToHtml } from '../notation';
import type { Rich } from '../types';

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'math'; tex: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'term'; concept: string; c: Inline[] }
  | { t: 'gloss'; term: string; c: Inline[] };

export type Block = { t: 'p'; c: Inline[] } | { t: 'math'; tex: string } | { t: 'ul' | 'ol'; items: Inline[][] };

// Placeholders use private-use characters that never appear in authored text.
const PH_OPEN = '';
const PH_CLOSE = '';
const DOLLAR = '';

interface Protected {
  text: string;
  math: string[];
  display: string[];
  code: string[];
}

/** Pull out code spans, display maths and inline maths so markdown can't mangle them. */
function protect(src: string): Protected {
  const math: string[] = [];
  const display: string[] = [];
  const code: string[] = [];
  let text = src.replace(/\\\$/g, DOLLAR);
  text = text.replace(/`([^`\n]+)`/g, (_, c: string) => `${PH_OPEN}C${code.push(c) - 1}${PH_CLOSE}`);
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => `${PH_OPEN}D${display.push(t.trim()) - 1}${PH_CLOSE}`);
  text = text.replace(/\$([^$\n]+?)\$/g, (_, t: string) => `${PH_OPEN}M${math.push(t.trim()) - 1}${PH_CLOSE}`);
  return { text, math, display, code };
}

const restoreDollars = (s: string): string => s.replace(new RegExp(DOLLAR, 'g'), '$');

const CONCEPT_RE = /^[a-z][a-z0-9-]*$/;

function parseInlineProtected(s: string, P: Protected): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: restoreDollars(buf) });
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === PH_OPEN) {
      const end = s.indexOf(PH_CLOSE, i);
      const kind = s[i + 1];
      const n = Number(s.slice(i + 2, end));
      flush();
      if (kind === 'M') out.push({ t: 'math', tex: restoreDollars(P.math[n]) });
      else if (kind === 'C') out.push({ t: 'code', v: restoreDollars(P.code[n]) });
      else out.push({ t: 'math', tex: restoreDollars(P.display[n]) }); // display inside a run of text: shown inline
      i = end + 1;
      continue;
    }
    if (ch === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'strong', c: parseInlineProtected(s.slice(i + 2, end), P) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '*' && s[i + 1] !== ' ' && s[i + 1] !== '*') {
      const end = s.indexOf('*', i + 1);
      if (end > i + 1 && s[end - 1] !== ' ') {
        flush();
        out.push({ t: 'em', c: parseInlineProtected(s.slice(i + 1, end), P) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[' && s[i + 1] === '[') {
      const end = s.indexOf(']]', i + 2);
      if (end > i + 2) {
        const body = s.slice(i + 2, end);
        const bar = body.indexOf('|');
        const term = (bar >= 0 ? body.slice(0, bar) : body).trim();
        const shown = bar >= 0 ? body.slice(bar + 1) : body;
        flush();
        out.push({ t: 'gloss', term, c: parseInlineProtected(shown, P) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '[') {
      const close = matchBracket(s, i);
      if (close > 0) {
        const after = s[close + 1];
        if (after === '(') {
          const end = matchParen(s, close + 1);
          if (end > close + 1) {
            flush();
            out.push({ t: 'link', href: s.slice(close + 2, end).trim(), c: parseInlineProtected(s.slice(i + 1, close), P) });
            i = end + 1;
            continue;
          }
        }
        if (after === '{') {
          const end = s.indexOf('}', close + 2);
          const concept = end > 0 ? s.slice(close + 2, end).trim() : '';
          if (CONCEPT_RE.test(concept)) {
            flush();
            out.push({ t: 'term', concept, c: parseInlineProtected(s.slice(i + 1, close), P) });
            i = end + 1;
            continue;
          }
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Index of the ")" closing the "(" at `open`, honouring nesting (so "Bessel_(function)" stays whole); −1 if none. */
function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Links may be relative (`../calc1/limits/`, `#section`), http(s) or mailto.
 * Anything else (`javascript:`, `data:`, `vbscript:`) renders as plain text.
 */
export function safeHref(href: string): string | null {
  const h = href.trim();
  // Control characters are stripped on purpose: browsers ignore them inside schemes ("java\0script:").
  // eslint-disable-next-line no-control-regex
  const scheme =/^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(h.replace(/[\u0000-\u0020]/g, ''));
  if (!scheme) return h;
  return /^(https?|mailto)$/i.test(scheme[1]) ? h : null;
}

/** Index of the "]" closing the "[" at `open`, honouring nesting; −1 if none. */
function matchBracket(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Inline content only (labels, options, one-line hints): newlines become spaces. */
export function parseInline(text: Rich): Inline[] {
  const P = protect(text);
  return parseInlineProtected(P.text.replace(/\s*\n\s*/g, ' '), P);
}

/** Full block structure: paragraphs, display maths, lists. */
export function parseRich(text: Rich): Block[] {
  const P = protect(text.trim());
  const blocks: Block[] = [];
  for (const chunk of P.text.split(/\n[ \t]*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every((l) => /^[-*•] /.test(l))) {
      blocks.push({ t: 'ul', items: lines.map((l) => parseInlineProtected(l.replace(/^[-*•] /, ''), P)) });
      continue;
    }
    if (lines.every((l) => /^\d+[.)] /.test(l))) {
      blocks.push({ t: 'ol', items: lines.map((l) => parseInlineProtected(l.replace(/^\d+[.)] /, ''), P)) });
      continue;
    }
    // Split a paragraph around display maths: text / $$…$$ / text.
    const joined = lines.join(' ');
    const parts = joined.split(new RegExp(`(${PH_OPEN}D\\d+${PH_CLOSE})`));
    for (const part of parts) {
      const m = new RegExp(`^${PH_OPEN}D(\\d+)${PH_CLOSE}$`).exec(part);
      if (m) blocks.push({ t: 'math', tex: restoreDollars(P.display[Number(m[1])]) });
      else if (part.trim()) blocks.push({ t: 'p', c: parseInlineProtected(part.trim(), P) });
    }
  }
  return blocks;
}

// ── HTML ────────────────────────────────────────────────────────────────

export interface RichOptions {
  /** KaTeX macros (the lesson's concept shorthands from `C.macros()`). */
  macros?: Readonly<Record<string, string>>;
  /** Inline only: no <p>, lists or display blocks. */
  inline?: boolean;
}

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Typographic touches for prose: real minus in "−3", curly quotes, en dash ranges. */
function typo(s: string): string {
  return s
    .replace(/(^|[\s(])-(\d)/g, '$1−$2')
    .replace(/(\d)-(\d)/g, '$1–$2')
    .replace(/(^|[\s(“])"(?=\S)/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/(^|[\s(])'(?=\S)/g, '$1‘')
    .replace(/'/g, '’');
}

function inlineHtml(nodes: Inline[], o: RichOptions): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case 'text':
          return escapeHtml(typo(n.v));
        case 'math':
          return `<span class="math-inline">${texToHtml(n.tex, false, { macros: o.macros })}</span>`;
        case 'code':
          return `<code>${escapeHtml(n.v)}</code>`;
        case 'strong':
          return `<strong>${inlineHtml(n.c, o)}</strong>`;
        case 'em':
          return `<em>${inlineHtml(n.c, o)}</em>`;
        case 'link': {
          const href = safeHref(n.href);
          return href === null ? inlineHtml(n.c, o) : `<a href="${escapeHtml(href)}">${inlineHtml(n.c, o)}</a>`;
        }
        case 'term':
          return `<span class="term ct ct-${n.concept}" data-concept="${n.concept}">${inlineHtml(n.c, o)}</span>`;
        case 'gloss':
          return `<dfn class="gloss" data-gloss="${escapeHtml(n.term)}">${inlineHtml(n.c, o)}</dfn>`;
      }
    })
    .join('');
}

const cache = new WeakMap<object, Map<string, string>>();
const NO_MACROS = {};

/** Rich text → HTML string. Memoised per macros object. */
export function richToHtml(text: Rich, opts: RichOptions = {}): string {
  const key = opts.macros ?? NO_MACROS;
  let m = cache.get(key);
  if (!m) cache.set(key, (m = new Map()));
  const ck = `${opts.inline ? 'i' : 'b'}${text}`;
  const hit = m.get(ck);
  if (hit !== undefined) return hit;
  let html: string;
  if (opts.inline) html = inlineHtml(parseInline(text), opts);
  else {
    html = parseRich(text)
      .map((b) => {
        if (b.t === 'p') return `<p>${inlineHtml(b.c, opts)}</p>`;
        if (b.t === 'math') return `<div class="math-display">${texToHtml(b.tex, true, { macros: opts.macros })}</div>`;
        const tag = b.t;
        return `<${tag}>${b.items.map((it) => `<li>${inlineHtml(it, opts)}</li>`).join('')}</${tag}>`;
      })
      .join('');
  }
  if (m.size > 2000) m.clear();
  m.set(ck, html);
  return html;
}

/** Plain text for aria-labels, titles, search and test snapshots (maths keeps a readable TeX source). */
export function richToPlain(text: Rich): string {
  const walk = (ns: Inline[]): string =>
    ns
      .map((n) => {
        if (n.t === 'text' || n.t === 'code') return n.v;
        if (n.t === 'math') return texToPlain(n.tex);
        return walk(n.c);
      })
      .join('');
  return parseRich(text)
    .map((b) => (b.t === 'p' ? walk(b.c) : b.t === 'math' ? texToPlain(b.tex) : b.items.map(walk).join('; ')))
    .join('\n')
    .trim();
}

/** A rough plain reading of TeX: "\frac{a}{b}" → "a/b", "\lambda" → "λ", macros dropped. */
export function texToPlain(tex: string): string {
  const GREEK: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ',
    tau: 'τ', phi: 'φ', omega: 'ω', rho: 'ρ', eta: 'η', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', nabla: '∇', infty: '∞',
    cdot: '·', times: '×', le: '≤', ge: '≥', ne: '≠', approx: '≈', to: '→', pm: '±',
  };
  let s = tex;
  for (let k = 0; k < 4; k++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\(?:colorTerm|ct|anchor)\{[^{}]*\}/g, '');
  s = s.replace(/\\([A-Za-z]+)/g, (_, w: string) => GREEK[w] ?? (/^(sin|cos|tan|log|ln|exp|det|lim|max|min)$/.test(w) ? w : ''));
  return s.replace(/[{}]/g, '').replace(/\\[,;: !]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Every TeX snippet inside a Rich string (for audits: render each and look for KaTeX errors). */
export function richTex(text: Rich): string[] {
  const P = protect(text);
  return [...P.math, ...P.display].map(restoreDollars);
}
