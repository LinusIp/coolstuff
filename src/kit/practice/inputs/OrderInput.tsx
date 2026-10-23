/**
 * Put items in order (drag mode 'order'; also Quiz's order questions): drag
 * a row by its grip (mouse or touch), or use its ↑ / ↓ buttons (keyboard).
 * Focus follows the moved row, and each move is announced.
 */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { RichText } from '../../core/RichText';
import { richToPlain } from '../../core/richtext';
import { announce } from '../../util';
import type { Rich } from '../../types';
import { dropIndex, moveItem } from '../arrange';

export interface OrderInputProps {
  items: readonly Rich[];
  /** Item indices in their current order. */
  order: readonly number[];
  onOrder: (order: number[]) => void;
  idBase: string;
  disabled?: boolean;
  /** Accessible name of the list. */
  label?: string;
  /** Per-position state after a check (review / quiz): right place or not. */
  marks?: readonly ('correct' | 'wrong' | null)[];
}

interface Drag {
  from: number;
  pointer: number;
  startY: number;
  dy: number;
  to: number;
  mids: number[];
}

export function OrderInput({ items, order, onOrder, idBase, disabled, label = 'Items to put in order', marks }: OrderInputProps) {
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const latest = useRef(order);
  latest.current = order;
  const [drag, setDrag] = useState<Drag | null>(null);
  const pendingFocus = useRef<{ item: number; dir: 'up' | 'down' } | null>(null);

  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const pos = order.indexOf(p.item);
    const row = rows.current[pos];
    if (!row) return;
    const want = row.querySelector<HTMLButtonElement>(`.order__${p.dir}:not(:disabled)`) ?? row.querySelector<HTMLButtonElement>('.order__up:not(:disabled), .order__down:not(:disabled)');
    want?.focus();
  }, [order]);

  const move = (from: number, to: number, dir?: 'up' | 'down') => {
    const cur = latest.current; // the latest order, even before a re-render
    if (to < 0 || to >= cur.length || to === from) return;
    const item = cur[from];
    if (dir) pendingFocus.current = { item, dir };
    const next = moveItem(cur, from, to);
    latest.current = next;
    onOrder(next);
    announce(`${richToPlain(items[item])}: moved to position ${to + 1} of ${cur.length}.`);
  };

  const onPointerDown = (pos: number) => (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const mids = rows.current.slice(0, order.length).map((r) => {
      const b = r?.getBoundingClientRect();
      return b ? b.top + b.height / 2 : 0;
    });
    setDrag({ from: pos, pointer: e.pointerId, startY: e.clientY, dy: 0, to: pos, mids });
  };
  const onPointerMove = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dy = e.clientY - drag.startY;
    const to = dropIndex(drag.mids, drag.mids[drag.from] + dy, drag.from);
    setDrag({ ...drag, dy, to });
  };
  const onPointerUp = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { from, to } = drag;
    setDrag(null);
    if (to !== from) move(from, to);
  };

  return (
    <ol class={`order${drag ? ' is-sorting' : ''}`} aria-label={label} id={`${idBase}-order`}>
      {order.map((item, pos) => {
        const dragging = drag?.from === pos;
        const dropMark = drag && !dragging && drag.to === pos ? (drag.to > drag.from ? ' is-drop-after' : ' is-drop-before') : '';
        const mark = marks?.[pos];
        const plain = richToPlain(items[item]);
        return (
          <li
            key={item}
            ref={(el) => {
              rows.current[pos] = el;
            }}
            class={`order__item${dragging ? ' is-dragging' : ''}${dropMark}${mark === 'correct' ? ' is-correct' : mark === 'wrong' ? ' is-wrong' : ''}`}
            style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <span
              class="order__grip"
              aria-hidden="true"
              data-touch-capture
              onPointerDown={onPointerDown(pos)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
            >
              <svg viewBox="0 0 12 18" aria-hidden="true">
                <circle cx="3.5" cy="4" r="1.4" />
                <circle cx="8.5" cy="4" r="1.4" />
                <circle cx="3.5" cy="9" r="1.4" />
                <circle cx="8.5" cy="9" r="1.4" />
                <circle cx="3.5" cy="14" r="1.4" />
                <circle cx="8.5" cy="14" r="1.4" />
              </svg>
            </span>
            <span class="order__n" aria-hidden="true">
              {pos + 1}
            </span>
            <RichText inline class="order__text" text={items[item]} />
            {mark && <span class="sr-only">{mark === 'correct' ? ' (in the right place)' : ' (not in the right place)'}</span>}
            <span class="order__btns">
              <button type="button" class="icon-btn order__up" disabled={disabled || pos === 0} aria-label={`Move “${plain}” up`} onClick={() => move(pos, pos - 1, 'up')}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 14.5 12 9l5.5 5.5" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn order__down"
                disabled={disabled || pos === order.length - 1}
                aria-label={`Move “${plain}” down`}
                onClick={() => move(pos, pos + 1, 'down')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 9.5 12 15l5.5-5.5" />
                </svg>
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
