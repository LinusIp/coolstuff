/**
 * Formula: KaTeX that comes alive (README §5.1, DESIGN.md §7).
 *
 *   <Formula {...FORMULAS[0]} live={{ v, lam }} />
 *
 * - **Colour-linked terms.** `\cMatrix`, `\colorTerm{…}` and `\anchor{id}{…}`
 *   tag the symbols; the link bus lights a concept or a single symbol
 *   everywhere (prose, figure, notes) on hover, focus or tap.
 * - **Explain this.** Each explained anchor gets a note: under its symbol on
 *   wide blocks (bold concept word + gloss, curved leaders that never cross),
 *   or a dotted-rule key with line-style stubs under the symbols when the
 *   block is narrower than 560px. Brackets name groups above the maths. The
 *   space for brackets is reserved, so toggling never moves the maths.
 * - **Live values.** Signals in `live` hang under their symbols (`.lv`) and
 *   update without touching the KaTeX (each value is its own tiny component);
 *   the *Live values* switch opens the exploded view (`.lv-grid`).
 *
 * The geometry is pure and tested (explain-layout.ts); this file measures the
 * rendered maths and applies it. Repeated anchors (§1.6): the note, leader,
 * stub and inline value hang from the FIRST occurrence; every occurrence
 * lights.
 */
import { useSignal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Toggle } from '../controls';
import { useMacros } from '../core/context';
import { isSignalLike, readLive, type LiveData, type LiveValue } from '../core/live';
import { RichText } from '../core/RichText';
import { texToPlain } from '../core/richtext';
import { Tex } from '../core/Tex';
import { texToHtml } from '../notation';
import type { ExplainMap, ExplainNote, FormulaBracket, Rich } from '../types';
import { anchorSpans, conceptInTex, firstSpans, stripAnchors, type AnchorSpan } from './anchors';
import { boxCx, explainMode, layoutBrackets, layoutLiveRow, layoutStubs, layoutWide, type Box } from './explain-layout';
import { BarLabel } from './Label';
import { liveCells, liveRank, liveSpeech, throttleLatest, type LiveCells } from './live-format';

/** A live value, or one with formatting: `{ value: m, decimals: 1, unit: 'kg' }`, `{ value: A, shape: [2, 2] }` for a flat Mat2. */
export type FormulaLive = LiveValue | { value: LiveValue; decimals?: number; unit?: string; shape?: readonly [number, number] };

export interface FormulaProps {
  /** TeX: tag symbols with `\anchor{id}{…}`, colour them with the `\cX` shorthands. */
  tex: string;
  /** FormulaSpec.id: the DOM id and the `data-formula` value. */
  id?: string;
  /** Bar label: "Definition", "Key formula". Default "Formula". */
  label?: string;
  /** Default 'key' (math-key); 'hero' for the Formalize definition. */
  size?: 'display' | 'key' | 'hero';
  /** One note per anchor id → the *Explain this* switch. */
  explain?: ExplainMap;
  /** Labels above groups of symbols. */
  brackets?: readonly FormulaBracket[];
  explainDefault?: boolean;
  /** Anchor id → signal / computed / getter; inline values show whenever this is set, the switch opens the grid. */
  live?: Readonly<Record<string, FormulaLive>>;
  liveDefault?: boolean;
  /** The *In words* sentence, terms in their inks: "[the matrix]{matrix} …". */
  inWords?: Rich;
  macros?: Readonly<Record<string, string>>;
  class?: string;
}

interface NoteItem {
  id: string;
  note: ExplainNote;
  concept: string | null;
  /** The symbol's TeX, anchors stripped (for the key and screen readers). */
  sym: string;
}

interface LiveItem {
  id: string;
  value: LiveValue;
  decimals: number;
  unit?: string;
  shape?: readonly [number, number];
  concept: string | null;
  sym: string | null;
  spoken: string;
  /** Has an anchor in the maths (so it can hang under its symbol). */
  inline: boolean;
}

const GLYPHS = '.mord, .mop, .mbin, .mrel, .mopen, .mclose, .minner, .mpunct';
const NOTE_MAX = 200;
const SIZE_CLASS = { display: 'math-display', key: 'math-display math-key', hero: 'math-display math-hero' } as const;
const SVGNS = 'http://www.w3.org/2000/svg';

/** Tight box of an anchor's glyphs (KaTeX struts and spaces excluded), relative to `origin`. */
function glyphBox(el: Element, origin: DOMRect): Box {
  const parts = [...el.querySelectorAll(GLYPHS)];
  const rects = (parts.length ? parts : [el]).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
  if (rects.length === 0) {
    const r = el.getBoundingClientRect();
    return { left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top };
  }
  return {
    left: Math.min(...rects.map((r) => r.left)) - origin.left,
    right: Math.max(...rects.map((r) => r.right)) - origin.left,
    top: Math.min(...rects.map((r) => r.top)) - origin.top,
    bottom: Math.max(...rects.map((r) => r.bottom)) - origin.top,
  };
}

const isLiveObject = (e: FormulaLive): e is Exclude<FormulaLive, LiveValue> => typeof e === 'object' && e !== null && !isSignalLike(e);

function svgEl(tag: string, attrs: Record<string, string | number>, parent: Element): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e;
}

const raf = (fn: () => void): (() => void) => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
};

export function Formula({ tex, id, label = 'Formula', size = 'key', explain, brackets, explainDefault = false, live, liveDefault = false, inWords, macros, class: cls }: FormulaProps) {
  const m = useMacros(macros);
  const renders = useRef(0);
  renders.current++;

  const html = useMemo(() => texToHtml(tex, true, { macros: m }), [tex, m]);
  const spans = useMemo(() => anchorSpans(tex), [tex]);
  const firsts = useMemo(() => new Map(firstSpans(tex).map((s) => [s.id, s] as const)), [tex]);

  const notes = useMemo<NoteItem[]>(() => {
    const list: (NoteItem & { mid: number })[] = [];
    for (const [k, note] of Object.entries(explain ?? {})) {
      const s = firsts.get(k);
      if (!s) continue;
      list.push({ id: k, note, concept: note.concept ?? conceptInTex(s.content, m), sym: stripAnchors(s.content), mid: (s.start + s.end) / 2 });
    }
    return list.sort((a, b) => a.mid - b.mid);
  }, [explain, firsts, m]);
  const conceptOf = (s: AnchorSpan): string | null => explain?.[s.id]?.concept ?? conceptInTex(s.content, m);

  const liveItems = useMemo<LiveItem[]>(
    () =>
      Object.entries(live ?? {}).map(([k, e]) => {
        const obj = isLiveObject(e) ? e : null;
        const s = firsts.get(k);
        const sym = s ? stripAnchors(s.content) : null;
        return {
          id: k,
          value: obj ? obj.value : (e as LiveValue),
          decimals: obj?.decimals ?? 2,
          unit: obj?.unit,
          shape: obj?.shape,
          concept: explain?.[k]?.concept ?? (s ? conceptInTex(s.content, m) : null),
          sym,
          spoken: sym ? texToPlain(sym) || k : k,
          inline: !!s,
        };
      }),
    [live, firsts, explain, m],
  );

  const hasNotes = notes.length > 0;
  const hasLive = liveItems.length > 0;
  const hasInline = liveItems.some((l) => l.inline);
  const explainOn = useSignal(explainDefault);
  const liveOn = useSignal(liveDefault);
  const showExplain = hasNotes && explainOn.value;
  const showGrid = hasLive && liveOn.value;
  // Notes and the grid mount on first open (README §1.10), then stay mounted.
  const notesMounted = useRef(false);
  if (showExplain) notesMounted.current = true;
  const gridMounted = useRef(false);
  if (showGrid) gridMounted.current = true;

  const [stacked, setStacked] = useState(false);
  // Leaders draw in the first time explain is switched on (not when it starts on): decided in render, so the first frame already animates.
  const prevShow = useRef(showExplain);
  const entering = useRef(false);
  if (showExplain && !prevShow.current) entering.current = true;
  prevShow.current = showExplain;
  const said = useSignal('');

  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const mathEl = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const lvRow = useRef<HTMLDivElement>(null);
  const notesEl = useRef<HTMLOListElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const texRenders = useRef(0);
  const state = useRef({ stacked, showExplain, width: -1, wideFailedAt: -1 });
  state.current.stacked = stacked;
  state.current.showExplain = showExplain;

  // ── Layout ──────────────────────────────────────────────────────────────
  const layoutLive = (): boolean => {
    const row = lvRow.current;
    const st = stage.current;
    const mx = mathEl.current;
    if (!row || !st || !mx) return false;
    const origin = row.getBoundingClientRect();
    const els = [...row.querySelectorAll<HTMLElement>(':scope > .lv')];
    const items = els
      .map((el) => {
        const a = mx.querySelector(`.katex-html [data-anchor="${CSS.escape(el.dataset.lv ?? '')}"]`);
        if (!a) return null;
        return { id: el.dataset.lv ?? '', cx: boxCx(glyphBox(a, origin)), w: el.offsetWidth, rank: Number(el.dataset.rank ?? 0) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const placed = layoutLiveRow(items, row.clientWidth, 16);
    let h = 0;
    for (const el of els) {
      const p = placed.find((q) => q.id === el.dataset.lv);
      if (!p) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = '';
      el.style.left = `${p.left}px`;
      el.style.setProperty('--tick', `${p.tick}px`);
      h = Math.max(h, el.offsetHeight);
    }
    const height = `${Math.ceil(h + 6)}px`;
    const changed = row.style.height !== height;
    row.style.height = height;
    return changed;
  };

  const layout = () => {
    const st = stage.current;
    const mx = mathEl.current;
    const s = svg.current;
    if (!st || !mx || !s) return;
    const W = st.clientWidth;
    if (W === 0) return;
    const wantStacked = explainMode(W) === 'stacked' || state.current.wideFailedAt === W;
    if (wantStacked !== state.current.stacked) {
      state.current.stacked = wantStacked;
      setStacked(wantStacked);
      return; // re-runs after the render
    }
    s.replaceChildren();
    st.querySelectorAll(':scope > .term-stub').forEach((x) => x.remove());
    const anchorsIn = (frame: DOMRect) => {
      const first = new Map<string, Box>();
      for (const el of mx.querySelectorAll<HTMLElement>('.katex-html [data-anchor]')) {
        const k = el.dataset.anchor ?? '';
        if (!first.has(k)) first.set(k, glyphBox(el, frame));
      }
      return first;
    };

    // 1. Brackets: space always reserved (so toggling never moves the maths), drawn only with explain on.
    const ov = over.current;
    if (ov) {
      const labels = [...ov.querySelectorAll<HTMLElement>('.bracket')];
      const mRect = mx.getBoundingClientRect();
      const boxes = anchorsIn(mRect);
      const items = labels.flatMap((lbl) => {
        const b = boxes.get(lbl.dataset.for ?? '');
        return b ? [{ anchor: lbl.dataset.for ?? '', box: b, w: lbl.offsetWidth, h: lbl.offsetHeight }] : [];
      });
      // The maths' left edge in stage coordinates (labels pack across the whole stage).
      const sRect = st.getBoundingClientRect();
      const dx = mRect.left - sRect.left;
      const B = layoutBrackets(
        items.map((it) => ({ ...it, box: { ...it.box, left: it.box.left + dx, right: it.box.right + dx } })),
        { width: W },
      );
      const H0 = ov.offsetHeight;
      const mathTop = mRect.top - sRect.top;
      const overTop = ov.getBoundingClientRect().top - sRect.top;
      // Smallest height that keeps the top label inside the reserved band (the maths' own margin counts).
      const H = items.length ? Math.max(0, Math.ceil(overTop + H0 - mathTop - B.top + 2)) : 0;
      ov.style.height = `${H}px`;
      const shift = mathTop - H0 + H; // the maths' top after the height change
      B.items.forEach((b) => {
        const lbl = labels.find((l) => l.dataset.for === b.anchor);
        if (!lbl) return;
        lbl.style.left = `${b.left}px`;
        lbl.style.top = `${b.top + shift - overTop}px`;
        if (state.current.showExplain) {
          const c = lbl.dataset.concept;
          const g = svgEl('g', { class: `bracket-mark${c ? ` ct ct-${c}` : ''}`, transform: `translate(0 ${shift})` }, s);
          svgEl('path', { class: 'leader', d: b.d }, g);
          svgEl('path', { class: 'leader', d: b.stem }, g);
        }
      });
    }

    // 2. Inline live values under their symbols.
    if (lvRow.current) layoutLive();

    if (!state.current.showExplain) {
      if (lvRow.current) lvRow.current.style.marginTop = '';
      return;
    }
    const ol = notesEl.current;
    if (!ol) return;
    const lis = [...ol.querySelectorAll<HTMLElement>(':scope > li')];
    const sRect = st.getBoundingClientRect();
    const boxes = anchorsIn(sRect);

    // 3a. Stacked: stubs in each term's line style under the symbols (the key below names them).
    if (state.current.stacked) {
      ol.style.height = '';
      let stubBottom = -Infinity;
      for (const li of lis) li.style.left = li.style.top = li.style.width = '';
      const conceptOfNote = new Map(lis.map((li) => [li.dataset.for ?? '', li.dataset.concept]));
      // Only notes with a concept get a stub: the stub IS the concept's line style.
      const obstacles: Box[] = [];
      for (const g of mx.querySelectorAll('.katex-html .frac-line, .katex-html .mord, .katex-html .mop, .katex-html .mbin, .katex-html .mrel')) {
        const r = g.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) obstacles.push({ left: r.left - sRect.left, right: r.right - sRect.left, top: r.top - sRect.top, bottom: r.bottom - sRect.top });
      }
      const stubs = layoutStubs(
        lis.flatMap((li) => {
          const b = boxes.get(li.dataset.for ?? '');
          return b && li.dataset.concept ? [{ id: li.dataset.for ?? '', box: b }] : [];
        }),
        7,
        obstacles,
      );
      for (const stub of stubs) {
        const c = conceptOfNote.get(stub.id);
        const el = document.createElement('span');
        el.className = `term-stub${c ? ` ct-${c}` : ''}`;
        el.setAttribute('aria-hidden', 'true');
        el.dataset.for = stub.id;
        el.style.left = `${stub.left}px`;
        el.style.width = `${stub.width}px`;
        el.style.top = `${stub.top}px`;
        st.appendChild(el);
        stubBottom = Math.max(stubBottom, stub.top + 4);
      }
      const row = lvRow.current;
      if (row) {
        row.style.marginTop = '';
        const rowTop = row.getBoundingClientRect().top - sRect.top;
        if (stubBottom + 4 > rowTop) row.style.marginTop = `${Math.ceil(stubBottom + 4 - rowTop)}px`;
      }
      return;
    }
    if (lvRow.current) lvRow.current.style.marginTop = '';

    // 3b. Wide: notes in one row under their symbols, leaders that never cross.
    for (const li of lis) li.style.width = 'max-content';
    const natural = lis.map((li) => Math.min(NOTE_MAX, Math.ceil(li.offsetWidth) + 1));
    let contentBottom = 0;
    for (const g of mx.querySelectorAll('.katex-html ' + GLYPHS.split(', ').join(', .katex-html '))) {
      const r = g.getBoundingClientRect();
      if (r.height > 0) contentBottom = Math.max(contentBottom, r.bottom - sRect.top);
    }
    const row = lvRow.current;
    const floorY = row ? row.getBoundingClientRect().bottom - sRect.top + 6 : contentBottom - 2;
    const L = layoutWide(
      lis.flatMap((li, k) => {
        const b = boxes.get(li.dataset.for ?? '');
        return b ? [{ id: li.dataset.for ?? '', box: b, width: natural[k] }] : [];
      }),
      { width: W, floorY },
    );
    if (!L) {
      lis.forEach((li) => (li.style.width = ''));
      state.current.wideFailedAt = W;
      state.current.stacked = true;
      setStacked(true);
      return;
    }
    const olTop = ol.getBoundingClientRect().top - sRect.top;
    for (const n of L.notes) {
      const li = lis.find((x) => x.dataset.for === n.id);
      if (!li) continue;
      li.style.width = `${n.width}px`;
      li.style.left = `${n.left}px`;
      li.style.top = `${L.top - olTop}px`;
    }
    const maxH = Math.max(0, ...lis.map((li) => li.offsetHeight));
    ol.style.height = `${Math.ceil(L.top - olTop + maxH)}px`;
    for (const l of L.leaders) {
      const c = lis.find((x) => x.dataset.for === l.id)?.dataset.concept;
      const g = svgEl('g', { class: `leader-mark${c ? ` ct ct-${c}` : ''}` }, s);
      svgEl('circle', { class: 'leader-dot', cx: Math.round(l.x1 * 10) / 10, cy: Math.round(l.yDot * 10) / 10, r: 2.2 }, g);
      const p = svgEl('path', { class: 'leader', d: l.d }, g) as SVGPathElement;
      if (entering.current && typeof p.getTotalLength === 'function') p.style.setProperty('--len', String(Math.ceil(p.getTotalLength())));
    }
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Every render (toggles, mode changes): lay out before paint.
  useLayoutEffect(() => {
    layoutRef.current();
    root.current?.setAttribute('data-renders', String(renders.current));
  });

  // New KaTeX in the DOM: count it (dev counter), and give each anchor its concept's ink for term-level washes.
  useLayoutEffect(() => {
    texRenders.current++;
    const mx = mathEl.current;
    if (!mx) return;
    mx.setAttribute('data-tex-renders', String(texRenders.current));
    const els = [...mx.querySelectorAll<HTMLElement>('.katex-html [data-anchor]')];
    els.forEach((el, k) => {
      const s = spans[k];
      const c = s && s.id === el.dataset.anchor ? conceptOf(s) : null;
      if (c) el.style.setProperty('--c', `var(--ct-${c})`);
    });
  }, [html]);

  // Resize, fonts and horizontal scroll of a long formula re-run the layout.
  useEffect(() => {
    const st = stage.current;
    const mx = mathEl.current;
    if (!st || !mx) return;
    const run = raf(() => layoutRef.current());
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        const w = st.clientWidth;
        if (w === state.current.width) return;
        state.current.width = w;
        if (state.current.wideFailedAt !== w) state.current.wideFailedAt = -1;
        run();
      });
      ro.observe(st);
    }
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    let alive = true;
    fonts?.ready.then(() => alive && run());
    fonts?.addEventListener?.('loadingdone', run);
    mx.addEventListener('scroll', run, { passive: true });
    return () => {
      alive = false;
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', run);
      mx.removeEventListener('scroll', run);
    };
  }, []);

  useEffect(() => {
    if (!entering.current) return;
    const t = setTimeout(() => {
      entering.current = false;
      root.current?.classList.remove('is-entering');
    }, 700);
    return () => clearTimeout(t);
  }, [showExplain]);

  // Live values: re-place the inline row after a value changes; announce at most once a second.
  const announcer = useMemo(() => throttleLatest((t) => (said.value = t), 1000), [said]);
  useEffect(() => () => announcer.cancel(), [announcer]);
  const liveText = useRef(new Map<string, string>());
  const onLive = useMemo(() => {
    const relayout = raf(() => {
      if (layoutLive() && state.current.showExplain && !state.current.stacked) layoutRef.current();
    });
    return (item: LiveItem, v: LiveData) => {
      relayout();
      const text = liveSpeech(item.spoken, v, { decimals: item.decimals, unit: item.unit, shape: item.shape });
      const prev = liveText.current.get(item.id);
      liveText.current.set(item.id, text);
      if (prev !== undefined && prev !== text) announcer.push([...liveText.current.values()].join('; '));
    };
  }, [announcer]);

  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.key;
  const classes = ['formula', `formula--${size}`, stacked && 'is-stacked', entering.current && 'is-entering', cls].filter(Boolean).join(' ');
  return (
    <div
      ref={root}
      class={classes}
      id={id}
      data-formula={id ?? ''}
      data-explain={hasNotes ? (showExplain ? 'on' : 'off') : undefined}
      data-live={hasLive ? (showGrid ? 'on' : 'off') : undefined}
    >
      <div class="formula__bar">
        <BarLabel text={label} />
        {(hasLive || hasNotes) && (
          <div class="formula__toggles">
            {hasLive && <Toggle value={liveOn} label="Live values" />}
            {hasNotes && <Toggle value={explainOn} label="Explain this" />}
          </div>
        )}
      </div>
      <div class="formula__stage" ref={stage}>
        {brackets && brackets.length > 0 && (
          <div class="formula__over" ref={over} aria-hidden="true">
            {brackets.map((b) => {
              const s = firsts.get(b.anchor);
              const c = b.concept ?? (s ? conceptOf(s) : null);
              return (
                <span key={b.anchor} class={`bracket${c ? ` ct ct-${c}` : ''}`} data-for={b.anchor} data-term={b.anchor} data-concept={c ?? undefined}>
                  <RichText inline text={b.text} macros={macros} />
                </span>
              );
            })}
          </div>
        )}
        <div ref={mathEl} class={`formula__math ${sizeClass}`} dangerouslySetInnerHTML={{ __html: html }} />
        {hasInline && (
          <div class="lv-row" ref={lvRow} aria-hidden="true">
            {liveItems
              .filter((l) => l.inline)
              .map((l) => (
                <LiveInline key={l.id} item={l} onValue={onLive} />
              ))}
          </div>
        )}
        {notesMounted.current && (
          <ol class="formula__notes" ref={notesEl} aria-label="What each symbol means" hidden={!showExplain}>
            {notes.map((n) => (
              <li key={n.id} data-for={n.id} data-term={n.id} data-concept={n.concept ?? undefined} class={n.concept ? `ct-${n.concept}` : undefined} tabIndex={0}>
                <span class="note__sym">
                  <Tex tex={n.sym} macros={macros} />
                </span>
                <span class="note__text">
                  <RichText inline class={`note__word${n.concept ? ` ct ct-${n.concept}` : ''}`} text={n.note.word} macros={macros} />{' '}
                  <RichText inline class="note__gloss" text={n.note.gloss} macros={macros} />
                </span>
              </li>
            ))}
          </ol>
        )}
        <svg class="formula__leaders" ref={svg} aria-hidden="true" />
      </div>
      {gridMounted.current && (
        <div class="lv-grid" role="group" aria-label="Live values" hidden={!showGrid}>
          {liveItems.map((l) => (
            <LiveColumn key={l.id} item={l} macros={macros} />
          ))}
        </div>
      )}
      {inWords && (
        <p class="in-words">
          <span class="label in-words__label">In words</span> <RichText inline text={inWords} macros={macros} />
        </p>
      )}
      {hasLive && (
        <p class="sr-only" aria-live="polite">
          {said}
        </p>
      )}
    </div>
  );
}

// ── Live values ───────────────────────────────────────────────────────────

function Cells({ c }: { c: LiveCells }) {
  if (c.kind === 'vector' || c.kind === 'matrix') {
    return (
      <span class={`lv-vec${c.kind === 'matrix' ? ' lv-vec--mat' : ''}`} style={c.kind === 'matrix' ? { '--cols': c.cols } : undefined}>
        {c.cells.map((x, k) => (
          <span key={k}>{x}</span>
        ))}
      </span>
    );
  }
  return <span class="lv__num">{c.cells[0]}</span>;
}

/** One value hanging under its symbol. Reads its own signal, so only it re-renders when the value changes. */
function LiveInline({ item, onValue }: { item: LiveItem; onValue: (item: LiveItem, v: LiveData) => void }) {
  const v = readLive(item.value);
  const c = liveCells(v, { decimals: item.decimals, shape: item.shape });
  useLayoutEffect(() => onValue(item, v));
  return (
    <span class={`lv${item.concept ? ` ct-${item.concept}` : ''}`} data-lv={item.id} data-rank={liveRank(c.kind)} data-concept={item.concept ?? undefined}>
      <span class="lv__val">
        <Cells c={c} />
        {item.unit && <span class="lv__unit">{item.unit}</span>}
      </span>
    </span>
  );
}

/** One column of the exploded view: the symbol over its line-style stub, then the value. */
function LiveColumn({ item, macros }: { item: LiveItem; macros?: Readonly<Record<string, string>> }) {
  const v = readLive(item.value);
  const c = liveCells(v, { decimals: item.decimals, shape: item.shape });
  return (
    <div class={`lv-col${item.concept ? ` ct ct-${item.concept}` : ''}`} data-lv={item.id}>
      <span class="lv-col__sym">{item.sym ? <Tex tex={item.sym} macros={macros} /> : <span class="lv-col__name">{item.id}</span>}</span>
      <span class="lv-col__val">
        {c.kind === 'scalar' || c.kind === 'text' ? <span class="lv">{c.cells[0]}</span> : <Cells c={c} />}
        {item.unit && <span class="lv__unit">{item.unit}</span>}
      </span>
      <span class="sr-only">{liveSpeech(item.spoken, v, { decimals: item.decimals, unit: item.unit, shape: item.shape })}</span>
    </div>
  );
}
