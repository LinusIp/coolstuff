/**
 * ArrayView (README §9.1): a row of cells with indices, marks, pointers and an
 * active window. Cells with stable `ids` glide to their new index (FLIP,
 * 420ms; instant under reduced motion); pointers slide; a value that changes
 * in place flashes. Long arrays scroll inside their own box on phones.
 *
 *   const frame = signal(0);
 *   const state = computed(() => TRACE[frame.value].state);
 *   <PlayScrub frame={frame} count={TRACE.length} notes={…} />
 *   <ArrayView state={state} label="The array being sorted" />
 *
 * DOM: div.ds.ds-array.plate__stage[role=group] > .ds-scroll > .ds-array__track
 * > (.ds-array__window) + ol.ds-array__cells > li.ds-cell > .ds-cell__idx +
 * .ds-cell__box[data-mark] (a <button> with onCellClick) · .ds-array__ptrs ·
 * p.sr-only summary. Cells are keyed by index in the DOM (focus never jumps)
 * and animated by id.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef } from 'preact/hooks';
import { useKit } from '../core/context';
import { useElementSize, useReducedMotion } from '../core/hooks';
import type { ArrayState } from '../types';
import { arrayCellLabel, cellText, summarizeArray } from './describe';
import type { Pos } from './flip';
import { markClass, markInfo } from './marks';
import { useFlip } from './motion';
import { navLinear } from './nav';
import { MarkGlyph, readState, useChanges, useRoving, type StateProp } from './shared';

export interface ArrayViewProps {
  /** values, ids?, marks?, pointers?, window? (types.ts §8). */
  state: StateProp<ArrayState>;
  /** Accessible name of the view. */
  label: string;
  /** 0-based indices above the cells (default true; say "0-based" in prose). */
  showIndices?: boolean;
  /** Cell size in px (default 48, never below 44). */
  cellSize?: number;
  /** Makes cells buttons (one tab stop; ← → Home End move between them). */
  onCellClick?: (index: number) => void;
  /** Replace the spoken label of a cell (default: "index 3: 7, being compared, pointer mid"). */
  describeCell?: (index: number, state: ArrayState) => string;
  class?: string;
}

const PTR_ROW = 24;
const IDX_ROW = 22;

export function ArrayView({ state, label, showIndices = true, cellSize = 48, onCellClick, describeCell, class: cls }: ArrayViewProps) {
  const s = readState(state);
  const { concepts } = useKit();
  const reduced = useReducedMotion();
  const sumId = useId();
  const size = Math.max(44, Math.round(cellSize));
  const n = s.values.length;
  const idOf = (i: number) => String(s.ids?.[i] ?? i);

  // Pointers stack under their cell in name order.
  const pointers = useMemo(() => {
    const byIndex = new Map<number, number>();
    return Object.entries(s.pointers ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, at]) => Number.isFinite(at))
      .map(([name, at]) => {
        const level = byIndex.get(at) ?? 0;
        byIndex.set(at, level + 1);
        return { name, at, level };
      });
  }, [s.pointers]);
  const levels = pointers.length ? Math.max(...pointers.map((p) => p.level)) + 1 : 0;

  const targets = useMemo(() => {
    const m = new Map<string, Pos>();
    for (let i = 0; i < n; i++) m.set(`c:${s.ids?.[i] ?? i}`, [i * size, 0]);
    for (const p of pointers) m.set(`p:${p.name}`, [p.at * size, p.level * PTR_ROW]);
    if (s.window) m.set('w', [s.window[0] * size, (s.window[1] + 1) * size]);
    return m;
  }, [s, size, pointers, n]);

  const cellEls = useRef<(HTMLLIElement | null)[]>([]);
  const ptrEls = useRef(new Map<string, HTMLElement>());
  const band = useRef<HTMLDivElement>(null);
  const idsNow = useRef<string[]>([]);
  idsNow.current = Array.from({ length: n }, (_, i) => idOf(i));

  useFlip(
    targets,
    (pos) => {
      idsNow.current.forEach((id, i) => {
        const p = pos.get(`c:${id}`);
        const el = cellEls.current[i];
        if (p && el) el.style.transform = `translate(${p[0]}px, 0)`;
      });
      for (const [name, el] of ptrEls.current) {
        const p = pos.get(`p:${name}`);
        if (p) el.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      }
      const w = pos.get('w');
      if (w && band.current) {
        band.current.style.transform = `translateX(${w[0]}px)`;
        band.current.style.width = `${Math.max(0, w[1] - w[0])}px`;
      }
    },
    reduced,
  );

  const { entered, changed, flash } = useChanges(Array.from({ length: n }, (_, i) => [idOf(i), s.values[i]] as const));

  const interactive = !!onCellClick;
  const keys = useMemo(() => Array.from({ length: n }, (_, i) => String(i)), [n]);
  const roving = useRoving(interactive ? keys : []);
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLElement>) => {
    const rk = (e.target as HTMLElement).dataset?.rk;
    if (!interactive || rk === undefined) return;
    const next = navLinear(e.key, Number(rk), n);
    if (next === null) return;
    e.preventDefault();
    roving.focusKey(String(next));
  };

  // A scroll box with nothing focusable inside must itself be focusable (keyboard scrolling).
  const [scrollEl, trackW] = [useRef<HTMLDivElement>(null), n * size];
  const box = useElementSize(scrollEl);
  const overflow = box.width > 0 && trackW > box.width + 1;

  const trackH = (showIndices ? IDX_ROW : 0) + size + (levels ? 6 + levels * PTR_ROW : 0);

  return (
    <div
      class={['ds', 'ds-array', 'plate__stage', interactive ? 'is-interactive' : '', cls].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      aria-describedby={sumId}
      style={{ '--cell': `${size}px`, '--idx-row': `${showIndices ? IDX_ROW : 0}px` }}
      ref={roving.root as never}
      onKeyDown={onKeyDown}
    >
      <div
        class="ds-scroll"
        ref={scrollEl}
        tabIndex={overflow && !interactive ? 0 : undefined}
        role={overflow && !interactive ? 'region' : undefined}
        aria-label={overflow && !interactive ? `${label} (scrolls sideways)` : undefined}
      >
        {n === 0 ? (
          <p class="ds-empty">Empty array</p>
        ) : (
          <div class="ds-array__track" style={{ width: `${trackW}px`, height: `${trackH}px` }}>
            {s.window && (
              <div
                class="ds-array__window"
                ref={band}
                aria-hidden="true"
                style={{ transform: `translateX(${s.window[0] * size}px)`, width: `${Math.max(0, s.window[1] - s.window[0] + 1) * size}px` }}
              />
            )}
            <ol class="ds-array__cells">
              {s.values.map((v, i) => {
                const id = idOf(i);
                const info = markInfo(s.marks?.[i], concepts);
                const out = !!s.window && (i < s.window[0] || i > s.window[1]);
                const text = describeCell ? describeCell(i, s) : arrayCellLabel(s, i, concepts);
                const boxCls = ['ds-cell__box', markClass(info), changed.has(id) ? `ds-flash-${flash}` : ''].filter(Boolean).join(' ');
                const content = (
                  <>
                    <span class="ds-cell__val">{cellText(v)}</span>
                    <MarkGlyph info={info} />
                  </>
                );
                return (
                  <li
                    key={i}
                    ref={(el) => {
                      cellEls.current[i] = el;
                    }}
                    class={['ds-cell', out ? 'is-out' : '', entered.has(id) ? 'is-entering' : ''].filter(Boolean).join(' ')}
                    style={{ transform: `translate(${i * size}px, 0)` }}
                  >
                    {showIndices && (
                      <span class="ds-cell__idx" aria-hidden="true">
                        {i}
                      </span>
                    )}
                    {interactive ? (
                      <button
                        type="button"
                        class={boxCls}
                        data-mark={info?.mark}
                        data-rk={String(i)}
                        tabIndex={roving.tabIndex(String(i))}
                        aria-label={text}
                        onClick={() => {
                          roving.setActive(String(i));
                          onCellClick!(i);
                        }}
                      >
                        {content}
                      </button>
                    ) : (
                      <span class={boxCls} data-mark={info?.mark}>
                        <span class="sr-only">{text}</span>
                        <span aria-hidden="true" class="ds-cell__face">
                          {content}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {pointers.length > 0 && (
              <div class="ds-array__ptrs" aria-hidden="true">
                {pointers.map((p) => (
                  <div
                    key={p.name}
                    class="ds-ptr"
                    ref={(el) => {
                      if (el) ptrEls.current.set(p.name, el);
                      else ptrEls.current.delete(p.name);
                    }}
                    style={{ transform: `translate(${p.at * size}px, ${p.level * PTR_ROW}px)` }}
                  >
                    <svg class="ds-ptr__caret" viewBox="0 0 10 6" aria-hidden="true">
                      <path d="M5 0L10 6H0Z" />
                    </svg>
                    <span class="ds-ptr__name">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <p class="sr-only" id={sumId}>
        {summarizeArray(s, concepts)}
      </p>
    </div>
  );
}
