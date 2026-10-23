/**
 * Two small ink controls (DESIGN.md §9):
 *
 *   <Toggle value={explain} label="Explain this" />                      // button.switch[role=switch]
 *   <Segmented value={method} label="Riemann sum" options={[{ value: 'left', label: 'Left' }, …]} />   // .seg, aria-pressed
 *
 * Both write the signal they are given and read it back in render (README
 * §1.2: never copied into local state). Labels are Rich, so `$\eta$` works.
 */
import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { RichText } from '../core/RichText';
import type { Rich } from '../types';

export interface ToggleProps {
  value: Signal<boolean>;
  /** Shown beside the switch; also its accessible name. */
  label: Rich;
  disabled?: boolean;
  /** Side effects only (logging); the signal is already written. */
  onChange?: (on: boolean) => void;
  class?: string;
  id?: string;
}

/** An on/off switch: `button.switch[role=switch][aria-checked]`, 44px tall, ink track and thumb. */
export function Toggle({ value, label, disabled, onChange, class: cls, id }: ToggleProps) {
  const on = value.value;
  return (
    <button
      type="button"
      id={id}
      class={['switch', cls].filter(Boolean).join(' ')}
      role="switch"
      aria-checked={on ? 'true' : 'false'}
      disabled={disabled}
      onClick={() => {
        value.value = !value.peek();
        onChange?.(value.peek());
      }}
    >
      <span class="switch__track" aria-hidden="true" />
      <RichText inline text={label} class="switch__label" />
    </button>
  );
}

export interface SegmentedOption<T> {
  value: T;
  label: Rich;
  disabled?: boolean;
}

export interface SegmentedProps<T> {
  value: Signal<T>;
  options: readonly SegmentedOption<T>[];
  /** The group's accessible name ("Sum type"). Plain text. */
  label: string;
  /** Side effects only. */
  onChange?: (v: T) => void;
  class?: string;
  id?: string;
}

/**
 * One-of-n buttons: `.seg[role=group]` of `.seg__btn[aria-pressed]`. Every
 * button is a tab stop (so a keyboard user hears each choice); ← → also
 * move focus along the row, skipping disabled options.
 */
export function Segmented<T>({ value, options, label, onChange, class: cls, id }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const current = value.value;
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const buttons = [...(group.current?.querySelectorAll<HTMLButtonElement>('.seg__btn:not(:disabled)') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0 || buttons.length === 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };
  return (
    <div ref={group} id={id} class={['seg', cls].filter(Boolean).join(' ')} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, k) => {
        const pressed = Object.is(o.value, current);
        return (
          <button
            key={k}
            type="button"
            class="seg__btn"
            aria-pressed={pressed ? 'true' : 'false'}
            disabled={o.disabled}
            onClick={() => {
              if (Object.is(value.peek(), o.value)) return;
              value.value = o.value;
              onChange?.(o.value);
            }}
          >
            <RichText inline text={o.label} />
          </button>
        );
      })}
    </div>
  );
}
