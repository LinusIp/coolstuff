/**
 * ‹ Step 2 of 3 › — walks a 0-based index through `count` positions
 * (Derivation, WorkedExample, any stepped figure).
 *
 *   const k = signal(0);
 *   <Stepper value={k} count={4} />
 *   <Stepper value={k} count={4} label={(i, n) => `Pass ${i + 1} of ${n}`} wrap />
 *
 * Prev/next are 44px `icon-btn`s, disabled at the ends unless `wrap`; the
 * label is a polite live region; ← → step while focus is anywhere inside.
 * When an end button disables under the keyboard, focus moves to the other
 * one, so it is never dropped onto the page.
 */
import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { IconNext, IconPrev } from '../core/icons';
import { stepIndex } from './timeline';

export interface StepperProps {
  /** 0-based position. */
  value: Signal<number>;
  count: number;
  /** Live label; default "Step 2 of 3". */
  label?: (i: number, count: number) => string;
  /** Next on the last step goes back to the first (and prev on the first to the last). */
  wrap?: boolean;
  /** Accessible name of the group (its buttons are "Previous" and "Next" within it); default "Steps". */
  name?: string;
  /** Side effects only. */
  onChange?: (i: number) => void;
  class?: string;
}

const defaultLabel = (i: number, n: number) => `Step ${i + 1} of ${n}`;

export function Stepper({ value, count, label = defaultLabel, wrap = false, name = 'Steps', onChange, class: cls }: StepperProps) {
  const root = useRef<HTMLDivElement>(null);
  const i = Math.min(Math.max(0, value.value), Math.max(0, count - 1));
  const atStart = !wrap && i <= 0;
  const atEnd = !wrap && i >= count - 1;

  const go = (dir: 1 | -1) => {
    const next = stepIndex(value.peek(), dir, count, wrap);
    if (next === value.peek()) return;
    const el = root.current;
    const hadFocus = !!el && el.contains(document.activeElement);
    value.value = next;
    onChange?.(next);
    // A focused button that disables itself drops focus to <body>: hand it to the other button.
    if (hadFocus)
      requestAnimationFrame(() => {
        const a = document.activeElement as HTMLButtonElement | null;
        if (!el || (a && el.contains(a) && !a.disabled)) return;
        el.querySelector<HTMLButtonElement>(dir > 0 ? '.stepper__prev' : '.stepper__next')?.focus();
      });
  };

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    }
  };

  return (
    <div ref={root} class={['stepper', cls].filter(Boolean).join(' ')} role="group" aria-label={name} onKeyDown={onKeyDown}>
      <button type="button" class="icon-btn stepper__prev" aria-label="Previous" disabled={atStart || count < 2} onClick={() => go(-1)}>
        <IconPrev />
      </button>
      <span class="stepper__label" aria-live="polite" aria-atomic="true">
        {count > 0 ? label(i, count) : ''}
      </span>
      <button type="button" class="icon-btn stepper__next" aria-label="Next" disabled={atEnd || count < 2} onClick={() => go(1)}>
        <IconNext />
      </button>
    </div>
  );
}
