/**
 * The glossary's pure parts (README §5.3): the term registry, term matching,
 * where a popover goes so it stays on screen and never covers its term, and
 * the relative link to the lesson that defines a term. Tested in Node.
 */
import type { Rich } from '../types';

export interface GlossaryEntry {
  term: string;
  definition: Rich;
  /** The defining lesson's id ('linalg/eigenvectors'). */
  lesson?: string;
}

export interface RegisteredTerm extends GlossaryEntry {
  /** KaTeX macros for the definition (the defining lesson's concept shorthands). */
  macros?: Readonly<Record<string, string>>;
  /** Plain text only (terms from the site search index): no Rich parsing. */
  plain?: boolean;
}

/** Lowercase, single-spaced, curly apostrophes straightened. */
export const normalizeTerm = (t: string): string => t.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

/** Keys to try for a term as written: itself, then simple singular forms ("eigenvalues" → "eigenvalue"). */
export function termCandidates(t: string): string[] {
  const n = normalizeTerm(t);
  const out = [n];
  if (n.endsWith('ies')) out.push(n.slice(0, -3) + 'y');
  if (n.endsWith('es')) out.push(n.slice(0, -2));
  if (n.endsWith('s') && !n.endsWith('ss')) out.push(n.slice(0, -1));
  return [...new Set(out)];
}

export interface GlossaryRegistry {
  /** Add or replace terms (a later lesson-specific entry wins over a site-index one). */
  add(entries: readonly RegisteredTerm[]): void;
  get(term: string): RegisteredTerm | undefined;
  /** Bumped on every add, so enhancers can re-scan. */
  readonly version: number;
  readonly size: number;
}

export function createGlossaryRegistry(): GlossaryRegistry {
  const map = new Map<string, RegisteredTerm>();
  let version = 0;
  return {
    add(entries) {
      for (const e of entries) {
        if (!e.term?.trim()) continue;
        const key = normalizeTerm(e.term);
        const prev = map.get(key);
        if (prev && !prev.plain && e.plain) continue; // never let the search index overwrite a real definition
        map.set(key, e);
      }
      version++;
    },
    get(term) {
      for (const k of termCandidates(term)) {
        const hit = map.get(k);
        if (hit) return hit;
      }
      return undefined;
    },
    get version() {
      return version;
    },
    get size() {
      return map.size;
    },
  };
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
  side: 'below' | 'above';
}

/**
 * Where a popover goes: centred on its term, clamped inside the viewport with
 * `margin`, below the term when it fits there (else above, else whichever side
 * has more room), `gap` away from it, so it never covers the term.
 */
export function placePopover(term: RectLike, pop: { width: number; height: number }, viewport: { width: number; height: number }, margin = 8, gap = 8): PopoverPlacement {
  const width = Math.min(pop.width, Math.max(0, viewport.width - 2 * margin));
  const cx = (term.left + term.right) / 2;
  const left = Math.min(Math.max(cx - width / 2, margin), Math.max(margin, viewport.width - margin - width));
  const roomBelow = viewport.height - margin - (term.bottom + gap);
  const roomAbove = term.top - gap - margin;
  const side: 'below' | 'above' = pop.height <= roomBelow || (pop.height > roomAbove && roomBelow >= roomAbove) ? 'below' : 'above';
  const top = side === 'below' ? term.bottom + gap : term.top - gap - pop.height;
  return { left, top, width, side };
}

/**
 * The site root relative to the current page, from its manifest link (the PWA
 * plugin writes one at every depth), else from the path. Mirrors the shell's
 * `rootFrom` (text never imports the shell, PLAN §3).
 */
export function rootFromManifest(manifestHref: string | null | undefined, pathname = ''): string {
  if (manifestHref) {
    const dir = manifestHref.replace(/[^/]*$/, '');
    if (!/^[a-z]+:|^\//i.test(dir)) return dir || './';
  }
  if (/\/lessons\/[^/]+\/[^/]+\//.test(pathname)) return '../../../';
  const k = /\/kit\/(?:_dev\/)?/.exec(pathname);
  if (k) return k[0].split('/').filter(Boolean).map(() => '../').join('');
  return './';
}

/** Relative link to a lesson page from the current page. */
export function lessonLink(lesson: string, root: string): string {
  return `${root}lessons/${lesson}/`;
}

/** The lesson a page (or a scoped part of one) belongs to: the nearest `data-lesson`, else the URL. */
export function lessonOfPath(pathname: string): string | null {
  const m = /\/lessons\/([^/]+)\/([^/]+)\//.exec(pathname);
  return m ? `${m[1]}/${m[2]}` : null;
}
