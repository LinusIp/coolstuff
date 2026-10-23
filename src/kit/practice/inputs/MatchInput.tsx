/**
 * Match items to slots (drag mode 'match'; also Quiz's match questions):
 * each item has a select menu (keyboard, screen readers, phones), and can
 * also be dragged by its grip onto a slot. The slots show what's in them.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { RichText } from '../../core/RichText';
import { richToPlain } from '../../core/richtext';
import { announce } from '../../util';
import type { MatchTarget } from '../../types';
import { itemsInSlot, placeMatch } from '../arrange';

export interface MatchInputProps {
  target: Pick<MatchTarget, 'items' | 'slots'>;
  /** Slot index per item, −1 = not placed. */
  slots: readonly number[];
  onSlots: (slots: number[]) => void;
  idBase: string;
  disabled?: boolean;
  /** Per-item state after a check (review / quiz). */
  marks?: readonly ('correct' | 'wrong' | null)[];
}

interface Drag {
  item: number;
  pointer: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  over: number | null;
}

export function MatchInput({ target, slots, onSlots, idBase, disabled, marks }: MatchInputProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(slots);
  latest.current = slots;

  const place = (item: number, slot: number) => {
    const next = placeMatch(latest.current, item, slot); // the latest placement, even before a re-render
    latest.current = next;
    onSlots(next);
    announce(slot >= 0 ? `${richToPlain(target.items[item])} → ${richToPlain(target.slots[slot])}.` : `${richToPlain(target.items[item])}: not placed.`);
  };

  const slotAt = (x: number, y: number): number | null => {
    const els = root.current?.querySelectorAll<HTMLElement>('.match__slot') ?? [];
    for (const el of els) {
      const b = el.getBoundingClientRect();
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return Number(el.dataset.slot);
    }
    return null;
  };

  const onPointerDown = (item: number) => (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ item, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, over: null });
  };
  const onPointerMove = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    setDrag({ ...drag, dx: e.clientX - drag.x0, dy: e.clientY - drag.y0, over: slotAt(e.clientX, e.clientY) });
  };
  const onPointerUp = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const over = slotAt(e.clientX, e.clientY);
    const item = drag.item;
    setDrag(null);
    if (over !== null && over !== slots[item]) place(item, over);
  };

  return (
    <div class={`match${drag ? ' is-dragging' : ''}`} ref={root}>
      <ol class="match__items" aria-label="Items">
        {target.items.map((it, i) => {
          const dragging = drag?.item === i;
          const mark = marks?.[i];
          const plain = richToPlain(it);
          return (
            <li
              key={i}
              class={`match__item${dragging ? ' is-lifted' : ''}${mark === 'correct' ? ' is-correct' : mark === 'wrong' ? ' is-wrong' : ''}`}
              style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
            >
              <span
                class="order__grip match__grip"
                aria-hidden="true"
                data-touch-capture
                onPointerDown={onPointerDown(i)}
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
              <label class="match__text" for={`${idBase}-m${i}`}>
                <RichText inline text={it} />
              </label>
              <select
                class={`field match__select${slots[i] < 0 ? ' is-empty' : ''}`}
                id={`${idBase}-m${i}`}
                value={String(slots[i] ?? -1)}
                disabled={disabled}
                aria-label={`Where does “${plain}” go?`}
                onChange={(e) => place(i, Number(e.currentTarget.value))}
              >
                <option value="-1">Choose…</option>
                {target.slots.map((s, k) => (
                  <option key={k} value={String(k)}>
                    {richToPlain(s)}
                  </option>
                ))}
              </select>
              {mark && <span class="sr-only">{mark === 'correct' ? 'right' : 'not right'}</span>}
            </li>
          );
        })}
      </ol>
      <ul class="match__slots" aria-label="Slots">
        {target.slots.map((s, k) => {
          const here = itemsInSlot(slots, k);
          return (
            <li key={k} class={`match__slot${drag?.over === k ? ' is-over' : ''}`} data-slot={String(k)}>
              <RichText inline class="match__slot-text" text={s} />
              <span class="match__placed">
                {here.length === 0 ? (
                  <span class="match__empty">{drag ? 'drop here' : 'empty'}</span>
                ) : (
                  here.map((i) => (
                    <span key={i} class="chip match__chip">
                      <RichText inline text={target.items[i]} />
                    </span>
                  ))
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
