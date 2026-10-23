/**
 * The link bus: "hovering a term highlights it everywhere" (CLAUDE.md §2, §3).
 *
 * One page-wide signal holds what is lit: a CONCEPT (colour-level: every
 * `.ct-<name>` in prose, KaTeX and SVG) and optionally a TERM (symbol-level:
 * every element with a matching `data-term`, or `data-anchor` from KaTeX's
 * `\anchor{id}{…}`). Two ways in:
 *
 * 1. Automatic. `installLinking()` (LessonPage and the gallery call it once)
 *    delegates pointer, focus and tap events: anything with a `ct-<concept>`
 *    class or `data-concept`, and anything with `data-term`/`data-anchor`,
 *    publishes on hover/focus and clears on leave/blur. A tap (touch/pen)
 *    makes it sticky until the next tap elsewhere. So prose terms
 *    (`[text]{concept}` in RichText), `\colorTerm` in formulas and `.ct`
 *    marks in figures link with no code at all.
 * 2. Explicit. `highlight({ concept, term }, { source })` / `clearHighlight(source)`
 *    for things events can't express (a slider being dragged lights its
 *    concept; a scrolly step lights a symbol).
 *
 * The DOM mirror sets `<html data-hl="concept …">` (CSS in components.css
 * lights every match via `--lit`) and toggles `.is-linked` on matching
 * `[data-term]` / `[data-anchor]` elements. Components that draw on canvas
 * read `link.value` (or `isLit()`) during render/draw: signals re-render them.
 */
import { effect, signal } from '@preact/signals';

export interface LinkState {
  /** Lit concept name(s), space-separated ("input output"), or null. */
  concept: string | null;
  /** Lit term id (matches data-term / data-anchor), or null. */
  term: string | null;
  /** Who set it (so a component only clears its own highlight). */
  source: string | null;
  /** Set by a tap: survives pointer-leave until the next tap elsewhere. */
  sticky: boolean;
}

const EMPTY: LinkState = { concept: null, term: null, source: null, sticky: false };

/** The page-wide highlight. Read `.value` in render to re-render on change. */
export const link = signal<LinkState>(EMPTY);

export interface LinkTarget {
  concept?: string | null;
  term?: string | null;
}

/** Light a concept and/or term. */
export function highlight(target: LinkTarget, opts: { source?: string; sticky?: boolean } = {}): void {
  const next: LinkState = { concept: target.concept ?? null, term: target.term ?? null, source: opts.source ?? null, sticky: !!opts.sticky };
  const cur = link.peek();
  if (cur.concept === next.concept && cur.term === next.term && cur.source === next.source && cur.sticky === next.sticky) return;
  if (cur.sticky && !next.sticky) return; // a tap-pinned highlight wins over hover
  link.value = next;
}

/**
 * Clear the highlight. With `source`, only if that source set it; sticky
 * highlights clear only with `force` (or a tap elsewhere).
 */
export function clearHighlight(source?: string, force = false): void {
  const cur = link.peek();
  if (cur === EMPTY || (!cur.concept && !cur.term)) return;
  if (cur.sticky && !force) return;
  if (source !== undefined && cur.source !== source) return;
  link.value = EMPTY;
}

/** Is this concept (and/or term) lit right now? Reading it inside render subscribes the component. */
export function isLit(concept?: string | null, term?: string | null): boolean {
  const s = link.value;
  if (term && s.term === term) return true;
  if (concept && s.concept) return s.concept.split(' ').includes(concept);
  return false;
}

const CT_RE = /(?:^|\s)ct-([a-z][a-z0-9-]*)/;

/** The concept and term an element (or its nearest ancestors) links to. */
export function linkTargetOf(el: Element | null, stopAt?: Element | null): LinkTarget | null {
  let concept: string | null = null;
  let term: string | null = null;
  for (let e: Element | null = el; e && e !== stopAt; e = e.parentElement) {
    if (!term) term = e.getAttribute('data-term') ?? e.getAttribute('data-anchor');
    if (!concept) {
      const dc = e.getAttribute('data-concept');
      if (dc) concept = dc;
      else {
        const m = CT_RE.exec(e.getAttribute('class') ?? '');
        if (m && m[1] !== 'correct') concept = m[1];
      }
    }
    if (concept && term) break;
    if (e.tagName === 'BODY') break;
  }
  return concept || term ? { concept, term } : null;
}

/** Spread on an element that should publish a link without classes: `<g {...linkProps({ concept: 'input' })}>`. */
export function linkProps(target: LinkTarget, source = `props:${target.concept ?? ''}:${target.term ?? ''}`) {
  const on = () => highlight(target, { source });
  const off = () => clearHighlight(source);
  return {
    'data-concept': target.concept ?? undefined,
    'data-term': target.term ?? undefined,
    onPointerEnter: on,
    onPointerLeave: off,
    onFocus: on,
    onBlur: off,
  };
}

let installed = 0;
let teardown: (() => void) | null = null;

/**
 * Install event delegation and the DOM mirror on a document. Idempotent and
 * reference-counted: call it from every root that needs linking; the returned
 * function undoes it when the last caller leaves.
 */
export function installLinking(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): () => void {
  if (!doc) return () => {};
  installed++;
  if (installed === 1) teardown = install(doc);
  return () => {
    installed = Math.max(0, installed - 1);
    if (installed === 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}

function install(doc: Document): () => void {
  const root = doc.documentElement;
  const SRC = 'delegate';
  let lit: Element[] = [];

  const stop = effect(() => {
    const { concept, term } = link.value;
    if (concept) root.setAttribute('data-hl', concept);
    else root.removeAttribute('data-hl');
    for (const el of lit) el.classList.remove('is-linked');
    lit = [];
    if (term) {
      const t = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(term) : term.replace(/["\\]/g, '\\$&');
      lit = [...doc.querySelectorAll(`[data-term="${t}"],[data-anchor="${t}"]`)];
      for (const el of lit) el.classList.add('is-linked');
    }
  });

  const over = (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.pointerType && pe.pointerType !== 'mouse') return; // touch publishes on tap instead
    const t = linkTargetOf(e.target as Element);
    if (t) highlight(t, { source: SRC });
    else clearHighlight(SRC);
  };
  const leaveDoc = (e: Event) => {
    if (!(e as PointerEvent).relatedTarget) clearHighlight(SRC);
  };
  const focusIn = (e: Event) => {
    const t = linkTargetOf(e.target as Element);
    if (t) highlight(t, { source: SRC });
  };
  const focusOut = () => clearHighlight(SRC);
  const tap = (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.pointerType === 'mouse') return;
    const t = linkTargetOf(e.target as Element);
    const cur = link.peek();
    if (t && !(cur.sticky && cur.concept === (t.concept ?? null) && cur.term === (t.term ?? null))) {
      link.value = { concept: t.concept ?? null, term: t.term ?? null, source: SRC, sticky: true };
    } else if (cur.sticky) {
      link.value = EMPTY;
    }
  };

  doc.addEventListener('pointerover', over);
  doc.addEventListener('pointerout', leaveDoc);
  doc.addEventListener('focusin', focusIn);
  doc.addEventListener('focusout', focusOut);
  doc.addEventListener('pointerdown', tap);
  return () => {
    stop();
    doc.removeEventListener('pointerover', over);
    doc.removeEventListener('pointerout', leaveDoc);
    doc.removeEventListener('focusin', focusIn);
    doc.removeEventListener('focusout', focusOut);
    doc.removeEventListener('pointerdown', tap);
    root.removeAttribute('data-hl');
    for (const el of lit) el.classList.remove('is-linked');
    link.value = EMPTY;
  };
}
