/**
 * Glossary terms with hover/focus/tap definitions (README §5.3).
 *
 *   registerGlossary(GLOSSARY.map((g) => ({ ...g, lesson: id })), { macros: C.macros() });
 *   const off = installGlossary();          // enhances every dfn.gloss[data-gloss] (RichText's [[term]])
 *   <Term id="eigenvalue">eigenvalues</Term> // explicit, in JSX
 *   <Glossary entries={GLOSSARY} />          // a <dl> of the lesson's terms
 *
 * LessonPage loads this file directly (never through the text barrel) and
 * calls registerGlossary + installGlossary once. A known term becomes a
 * focusable button-like <dfn> (dotted underline); hover (mouse), focus
 * (keyboard) or a tap opens a small popover right after it in the DOM, so it
 * renders inside the current concept scope and Tab reaches its "Defined in"
 * link. The popover never covers its term and stays on screen at 390px; Esc,
 * a tap elsewhere or moving away closes it. Unknown terms stay plain text and
 * log nothing; the site search index (lazily loaded) supplies terms that
 * other lessons define.
 */
import { LESSON_BY_ID } from '@content/curriculum';
import lessonsIndex from '@content/lessons.json';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import { useKit } from '../core/context';
import { RichText } from '../core/RichText';
import { escapeHtml, richToHtml } from '../core/richtext';
import { createGlossaryRegistry, lessonLink, lessonOfPath, placePopover, rootFromManifest, type GlossaryEntry, type RegisteredTerm } from './glossary-core';

export type { GlossaryEntry } from './glossary-core';

const registry = createGlossaryRegistry();
const SHIPPED = new Set((lessonsIndex as unknown as readonly { id: string; status?: string }[]).filter((l) => l.status === 'shipped').map((l) => l.id));

/** Add terms (a lesson's GLOSSARY, with `lesson` set to its id). `macros`: the lesson's concept shorthands, so definitions can use `\cMatrix`. */
export function registerGlossary(entries: readonly GlossaryEntry[], opts: { macros?: Readonly<Record<string, string>> } = {}): void {
  registry.add(entries.map((e) => ({ ...e, macros: opts.macros })));
  rescan();
}

/** The registered entry for a term as written ("eigenvalues" finds "eigenvalue"), if any. */
export function glossaryEntry(term: string): RegisteredTerm | undefined {
  return registry.get(term);
}

// ── The site index: terms other lessons define (lazy, one chunk, no network beyond the site) ──

let indexState: 'idle' | 'loading' | 'done' = 'idle';
function loadIndex(): void {
  if (indexState !== 'idle') return;
  indexState = 'loading';
  import('@content/search-index.json')
    .then((mod) => {
      const rows = (mod.default ?? mod) as unknown as readonly { kind: string; lesson: string; title: string; text: string }[];
      registry.add(rows.filter((r) => r.kind === 'term').map((r) => ({ term: r.title, definition: r.text, lesson: r.lesson, plain: true })));
    })
    .catch(() => {})
    .finally(() => {
      indexState = 'done';
      rescan();
    });
}

// ── Enhancing dfn.gloss ──────────────────────────────────────────────────

let installs = 0;
let teardown: (() => void) | null = null;
const roots = new Set<Element>();
let uidN = 0;

interface Open {
  dfn: HTMLElement;
  pop: HTMLElement;
  pinned: boolean;
  cleanup: () => void;
}
let open: Open | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;

function enhance(dfn: HTMLElement): void {
  const key = dfn.dataset.gloss ?? '';
  const entry = registry.get(key);
  if (!entry) {
    if (dfn.hasAttribute('data-gloss-ready')) {
      for (const a of ['data-gloss-ready', 'tabindex', 'role', 'aria-expanded', 'aria-controls', 'data-hit']) dfn.removeAttribute(a);
    }
    if (indexState === 'idle') loadIndex();
    return;
  }
  if (dfn.hasAttribute('data-gloss-ready')) return;
  dfn.setAttribute('data-gloss-ready', '');
  dfn.setAttribute('tabindex', '0');
  dfn.setAttribute('role', 'button');
  dfn.setAttribute('aria-expanded', 'false');
  // The visible underline is the reading cue; the 44px hit area is a pseudo-element (smoke: data-hit).
  dfn.setAttribute('data-hit', '');
}

function rescan(): void {
  if (typeof document === 'undefined') return;
  for (const r of roots) r.querySelectorAll<HTMLElement>('dfn.gloss[data-gloss]').forEach(enhance);
}

const currentLesson = (el: Element): string | null =>
  el.closest('[data-lesson]')?.getAttribute('data-lesson') ?? (typeof location !== 'undefined' ? lessonOfPath(location.pathname) : null);

function popoverHtml(entry: RegisteredTerm, from: string | null): string {
  const def = entry.plain ? escapeHtml(entry.definition) : richToHtml(entry.definition, { macros: entry.macros, inline: true });
  let foot = '';
  if (entry.lesson && entry.lesson !== from) {
    const title = LESSON_BY_ID.get(entry.lesson)?.title ?? entry.lesson;
    if (SHIPPED.has(entry.lesson)) {
      const root = rootFromManifest(document.querySelector('link[rel="manifest"]')?.getAttribute('href'), location.pathname);
      foot = `<span class="gloss-pop__from">Defined in <a href="${escapeHtml(lessonLink(entry.lesson, root))}"><cite>${escapeHtml(title)}</cite></a></span>`;
    } else {
      foot = `<span class="gloss-pop__from">Defined in <cite>${escapeHtml(title)}</cite> <span class="gloss-pop__soon">(coming soon)</span></span>`;
    }
  }
  return `<span class="gloss-pop__term">${escapeHtml(entry.term)}</span><span class="gloss-pop__def rich">${def}</span>${foot}`;
}

function place(o: Open): void {
  const t = o.dfn.getBoundingClientRect();
  const rects = o.dfn.getClientRects();
  // A term broken across lines: anchor to the fragment nearest the pointer's line (the first one).
  const r = rects.length > 1 ? rects[0] : t;
  o.pop.style.maxWidth = `${Math.min(320, window.innerWidth - 16)}px`;
  const size = { width: o.pop.offsetWidth, height: o.pop.offsetHeight };
  const p = placePopover({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, size, { width: window.innerWidth, height: window.innerHeight });
  o.pop.style.left = `${Math.round(p.left)}px`;
  o.pop.style.top = `${Math.round(p.top)}px`;
  o.pop.dataset.side = p.side;
}

function openFor(dfn: HTMLElement, pinned: boolean): void {
  if (open?.dfn === dfn) {
    open.pinned = open.pinned || pinned;
    return;
  }
  close(false);
  const entry = registry.get(dfn.dataset.gloss ?? '');
  if (!entry) return;
  const pop = document.createElement('span');
  pop.className = 'gloss-pop';
  pop.id = `gloss-pop-${++uidN}`;
  pop.setAttribute('role', 'group');
  pop.setAttribute('aria-label', `Definition: ${entry.term}`);
  pop.innerHTML = popoverHtml(entry, currentLesson(dfn));
  dfn.after(pop);
  dfn.setAttribute('aria-expanded', 'true');
  dfn.setAttribute('aria-controls', pop.id);
  const o: Open = { dfn, pop, pinned, cleanup: () => {} };
  const reflow = () => (dfn.isConnected ? place(o) : close(false));
  window.addEventListener('scroll', reflow, { passive: true, capture: true });
  window.addEventListener('resize', reflow, { passive: true });
  o.cleanup = () => {
    window.removeEventListener('scroll', reflow, { capture: true });
    window.removeEventListener('resize', reflow);
  };
  open = o;
  place(o);
}

function close(refocus: boolean): void {
  clearTimeout(hoverTimer);
  if (!open) return;
  const o = open;
  open = null;
  o.cleanup();
  const hadFocus = o.pop.contains(document.activeElement);
  o.pop.remove();
  o.dfn.setAttribute('aria-expanded', 'false');
  o.dfn.removeAttribute('aria-controls');
  if ((refocus || hadFocus) && o.dfn.isConnected) o.dfn.focus();
}

const termOf = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('dfn.gloss[data-gloss-ready]') : null);
const popOf = (t: EventTarget | null): HTMLElement | null => (t instanceof Element ? t.closest<HTMLElement>('.gloss-pop') : null);

function install(doc: Document): () => void {
  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const dfn = termOf(e.target);
    if (dfn) {
      clearTimeout(hoverTimer);
      if (open?.dfn !== dfn) hoverTimer = setTimeout(() => openFor(dfn, false), 120);
      return;
    }
    if (popOf(e.target)) clearTimeout(hoverTimer);
  };
  const onOut = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !open || open.pinned) return;
    const to = e.relatedTarget;
    if (termOf(to) === open.dfn || popOf(to) === open.pop) return;
    if (!termOf(e.target) && !popOf(e.target)) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (open && !open.pinned && !open.pop.contains(document.activeElement) && document.activeElement !== open.dfn) close(false);
    }, 200);
  };
  const onFocusIn = (e: FocusEvent) => {
    const dfn = termOf(e.target);
    if (dfn) openFor(dfn, false);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!open) return;
    const to = e.relatedTarget as Node | null;
    if (to && (open.dfn.contains(to) || open.pop.contains(to))) return;
    if (open.pinned && !to) return; // focus left the page (or a tap on non-focusable text): keep a pinned popover
    close(false);
  };
  const onClick = (e: MouseEvent) => {
    const dfn = termOf(e.target);
    if (dfn) {
      e.preventDefault();
      if (open?.dfn === dfn && open.pinned) close(false);
      else {
        openFor(dfn, true);
        if (open) open.pinned = true;
      }
    }
  };
  const onDown = (e: PointerEvent) => {
    if (!open) return;
    if (termOf(e.target) === open.dfn || popOf(e.target) === open.pop) return;
    close(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(true);
      return;
    }
    const dfn = termOf(e.target);
    if (dfn && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (open?.dfn === dfn && open.pinned) close(false);
      else {
        openFor(dfn, true);
        if (open) open.pinned = true;
      }
    }
  };
  doc.addEventListener('pointerover', onOver);
  doc.addEventListener('pointerout', onOut);
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  doc.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', onDown);
  doc.addEventListener('keydown', onKey);
  const mo =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((records) => {
          for (const r of records)
            for (const node of r.addedNodes) {
              if (!(node instanceof Element)) continue;
              if (node.matches('dfn.gloss[data-gloss]')) enhance(node as HTMLElement);
              node.querySelectorAll<HTMLElement>('dfn.gloss[data-gloss]').forEach(enhance);
            }
          if (open && !open.dfn.isConnected) close(false);
        })
      : null;
  mo?.observe(doc.body, { childList: true, subtree: true });
  return () => {
    close(false);
    mo?.disconnect();
    doc.removeEventListener('pointerover', onOver);
    doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('keydown', onKey);
  };
}

/**
 * Make every `dfn.gloss[data-gloss]` under `root` (default: the whole page)
 * a glossary term, now and as new ones mount (hints, solutions, popovers).
 * Reference-counted; the returned function undoes it when the last caller
 * leaves.
 */
export function installGlossary(root?: Element): () => void {
  if (typeof document === 'undefined') return () => {};
  const r = root ?? document.body;
  roots.add(r);
  installs++;
  if (installs === 1) teardown = install(document);
  r.querySelectorAll<HTMLElement>('dfn.gloss[data-gloss]').forEach(enhance);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    installs = Math.max(0, installs - 1);
    if (installs === 0) {
      teardown?.();
      teardown = null;
      roots.clear();
    }
  };
}

// ── Components ───────────────────────────────────────────────────────────

export interface TermProps {
  /** The glossary term ("eigenvalue"). */
  id: string;
  /** What to show (default: the term). */
  children?: ComponentChildren;
}

/** An inline glossary term in JSX: the same `dfn.gloss` RichText's `[[term]]` makes. */
export function Term({ id, children }: TermProps) {
  useEffect(() => installGlossary(), []);
  // The wrapper keeps the popover (inserted after the dfn) out of Preact's way.
  return (
    <span class="gloss-wrap">
      <dfn class="gloss" data-gloss={id}>
        {children ?? id}
      </dfn>
    </span>
  );
}

export interface GlossaryProps {
  entries: readonly (GlossaryEntry | { term: string; definition: string })[];
  /** Register these entries for popovers too (default true). */
  register?: boolean;
  /** Heading level for nothing: the list is a <dl>; give it an accessible name. Default "Glossary". */
  label?: string;
}

/** The lesson's terms as a definition list (e.g. under "Where next"). */
export function Glossary({ entries, register = true, label = 'Glossary' }: GlossaryProps) {
  const { macros, lessonId } = useKit();
  const sorted = useMemo(() => [...entries].sort((a, b) => a.term.localeCompare(b.term)), [entries]);
  useEffect(() => {
    if (register) registerGlossary(entries.map((e) => ({ lesson: lessonId, ...e })), { macros });
  }, [entries, register, macros, lessonId]);
  return (
    <dl class="glossary" aria-label={label}>
      {sorted.map((e) => {
        const lesson = (e as GlossaryEntry).lesson;
        const other = lesson && lesson !== lessonId;
        return (
          <div class="glossary__row" key={e.term}>
            <dt>
              <dfn>{e.term}</dfn>
            </dt>
            <dd>
              <RichText inline text={e.definition} />
              {other && (
                <span class="glossary__from">
                  {' '}
                  Defined in <cite>{LESSON_BY_ID.get(lesson)?.title ?? lesson}</cite>
                  {SHIPPED.has(lesson) ? '' : ' (coming soon)'}.
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
