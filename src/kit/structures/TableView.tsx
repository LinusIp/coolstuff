/**
 * TableView (README §9.4): a real <table> (DP tables, truth tables, hash
 * buckets) with headers as `th scope`, marked cells, and dependency arrows in
 * an SVG overlay ("where this value came from"). A cell whose value changes
 * flashes (the table filling in); it scrolls inside its own box on phones.
 *
 *   <TableView state={dpState} label="Edit distance between KITTEN and SITTING" />
 *
 * DOM: div.ds.ds-table.plate__stage > .ds-scroll > .ds-table__wrap >
 * table.ds-table__t (caption.sr-only = label; thead th[scope=col]; tbody
 * th[scope=row] + td.ds-tcell[data-mark] (a <button> with onCellClick)) +
 * svg.ds-table__arrows · p.sr-only summary.
 */
import type { JSX } from 'preact';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useKit } from '../core/context';
import { useElementSize } from '../core/hooks';
import type { ConceptSet } from '../theme';
import type { Mark, TableState } from '../types';
import { cellText, summarizeTable, tableCellLabel } from './describe';
import { edgeGeometry } from './geometry';
import { markClass, markInfo } from './marks';
import { navGrid } from './nav';
import { conceptStroke, MarkGlyph, readState, useChanges, useRoving, type StateProp } from './shared';

export interface TableViewProps {
  /** cells, rowHeaders?, colHeaders?, marks ("r,c"), arrows (types.ts §8). */
  state: StateProp<TableState>;
  /** Accessible name; also the table's (visually hidden) <caption>. */
  label: string;
  /** Minimum cell size in px (default 44, never below 44). */
  cellSize?: number;
  /** Makes cells buttons (one tab stop; arrows move, Home/End row ends, Ctrl+Home/End table corners). */
  onCellClick?: (r: number, c: number) => void;
  /** Replace the spoken label of a cell (default "row 2, column 3: 5, current, from row 1 column 2"). */
  describeCell?: (r: number, c: number, state: TableState) => string;
  class?: string;
}

interface ArrowGeom {
  key: string;
  d: string;
  head: string | null;
  mark?: Mark;
}

function arrowClass(mark: Mark | undefined, concepts?: ConceptSet) {
  const info = markInfo(mark, concepts);
  return { info, cls: ['ds-arrow', markClass(info)].filter(Boolean).join(' ') };
}

export function TableView({ state, label, cellSize = 44, onCellClick, describeCell, class: cls }: TableViewProps) {
  const s = readState(state);
  const { concepts } = useKit();
  const sumId = useId();
  const size = Math.max(44, Math.round(cellSize));
  const rows = s.cells.length;
  const cols = Math.max(0, ...s.cells.map((r) => r.length));
  const interactive = !!onCellClick;

  const keys = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(`${r},${c}`);
    return out;
  }, [rows, cols]);
  const roving = useRoving(interactive ? keys : []);
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLElement>) => {
    const rk = (e.target as HTMLElement).dataset?.rk;
    if (!interactive || !rk) return;
    const [r, c] = rk.split(',').map(Number);
    const next = navGrid(e.key, r, c, rows, cols, e.ctrlKey || e.metaKey);
    if (!next) return;
    e.preventDefault();
    roving.focusKey(`${next[0]},${next[1]}`);
  };

  const { changed, flash } = useChanges(keys.map((k) => [k, s.cells[Number(k.split(',')[0])]?.[Number(k.split(',')[1])] ?? null] as const));

  // Arrows: measured from the rendered cells (headers make column widths vary).
  const wrap = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<ArrowGeom[]>([]);
  const wrapSize = useElementSize(wrap);
  useLayoutEffect(() => {
    const el = wrap.current;
    const list = s.arrows ?? [];
    if (!el || list.length === 0) {
      if (arrows.length) setArrows([]);
      return;
    }
    const origin = el.getBoundingClientRect();
    const centre = (r: number, c: number): [number, number, number] | null => {
      const td = el.querySelector<HTMLElement>(`[data-cell="${r},${c}"]`);
      if (!td) return null;
      const b = td.getBoundingClientRect();
      return [b.left - origin.left + b.width / 2, b.top - origin.top + b.height / 2, Math.min(b.width, b.height) / 2];
    };
    const next: ArrowGeom[] = [];
    list.forEach((a, i) => {
      const p = centre(a.from[0], a.from[1]);
      const q = centre(a.to[0], a.to[1]);
      if (!p || !q) return;
      const g = edgeGeometry([p[0], p[1]], [q[0], q[1]], { r1: p[2] * 0.55, r2: q[2] * 0.62, arrow: 7 });
      if (g.d) next.push({ key: `${i}:${a.from.join(',')}>${a.to.join(',')}`, d: g.d, head: g.head, mark: a.mark });
    });
    const same = next.length === arrows.length && next.every((a, i) => a.d === arrows[i].d && a.mark === arrows[i].mark);
    if (!same) setArrows(next);
  }, [s, wrapSize.width, wrapSize.height]);

  const scrollEl = useRef<HTMLDivElement>(null);
  const box = useElementSize(scrollEl);
  const overflow = box.width > 0 && wrapSize.width > box.width + 1;

  const hasRowHeads = !!s.rowHeaders?.length;
  return (
    <div
      class={['ds', 'ds-table', 'plate__stage', interactive ? 'is-interactive' : '', cls].filter(Boolean).join(' ')}
      style={{ '--cell': `${size}px` }}
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
        {rows === 0 || cols === 0 ? (
          <p class="ds-empty">Empty table</p>
        ) : (
          <div class="ds-table__wrap" ref={wrap}>
            <table class="ds-table__t" aria-describedby={sumId}>
              <caption class="sr-only">{label}</caption>
              {s.colHeaders?.length ? (
                <thead>
                  <tr>
                    {hasRowHeads && <td class="ds-table__corner" />}
                    {Array.from({ length: cols }, (_, c) => (
                      <th scope="col" key={c}>
                        {s.colHeaders![c] ?? ''}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {s.cells.map((row, r) => (
                  <tr key={r}>
                    {hasRowHeads && <th scope="row">{s.rowHeaders![r] ?? ''}</th>}
                    {Array.from({ length: cols }, (_, c) => {
                      const k = `${r},${c}`;
                      const v = row[c] ?? null;
                      const info = markInfo(s.marks?.[k], concepts);
                      const tdCls = ['ds-tcell', markClass(info), changed.has(k) ? `ds-flash-${flash}` : '', v === null || v === '' ? 'is-empty' : '']
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <td key={c} class={tdCls} data-mark={info?.mark} data-cell={k}>
                          {interactive ? (
                            <button
                              type="button"
                              class="ds-tcell__btn"
                              data-rk={k}
                              tabIndex={roving.tabIndex(k)}
                              aria-label={describeCell ? describeCell(r, c, s) : tableCellLabel(s, r, c, concepts)}
                              onClick={() => {
                                roving.setActive(k);
                                onCellClick!(r, c);
                              }}
                            >
                              {cellText(v)}
                              <MarkGlyph info={info} />
                            </button>
                          ) : (
                            <>
                              {cellText(v)}
                              <MarkGlyph info={info} />
                              {info && <span class="sr-only">, {info.word}</span>}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {arrows.length > 0 && (
              <svg class="ds-table__arrows" width={wrapSize.width} height={wrapSize.height} aria-hidden="true">
                {arrows.map((a) => {
                  const { info, cls: ac } = arrowClass(a.mark, concepts);
                  const st = conceptStroke(info, 2, concepts);
                  return (
                    <g key={a.key} class={ac} data-mark={info?.mark}>
                      <path class="ds-arrow__line" d={a.d} stroke-dasharray={st.dash} stroke-linecap={st.cap} />
                      {a.head && <path class="ds-arrow__head" d={a.head} />}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </div>
      <p class="sr-only" id={sumId}>
        {summarizeTable(s, concepts)}
      </p>
    </div>
  );
}
