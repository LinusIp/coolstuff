/**
 * A slider that drives maths (DESIGN.md §7, §9): the thumb wears the
 * concept's ink and looks like a figure handle, detents mark meaningful
 * values, and the value reads in tabular mono.
 *
 *   const h = signal(0.5);
 *   <Slider value={h} min={-2} max={2} step={0.01} exclude={[0]} label="$h$" concept="rate" />
 *   <Slider value={eta} min={0.001} max={1.5} scale="log" label="learning rate $\eta$" concept="eta" detents={[{ value: 0.1, label: 'safe' }]} />
 *
 * Every value goes through core/slider-scale.ts (tested): the native range
 * input runs on track positions 0…1000 and the component maps them through
 * the scale, so log scales keep resolution at both ends, excluded values are
 * never landed on (by drag or by key), and every key press lands on a new
 * allowed value. Dragging lights the concept on the link bus.
 */
import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useId, useMemo, useRef } from 'preact/hooks';
import { clearHighlight, highlight } from '../core/link';
import { RichText } from '../core/RichText';
import { richToPlain } from '../core/richtext';
import {
  detentValue,
  formatSliderValue,
  magnetDetent,
  sliderExtreme,
  sliderPosition,
  sliderValue,
  stepSliderValue,
  validateSliderScale,
  type SliderDetent,
  type SliderScale,
} from '../core/slider-scale';
import type { Rich } from '../types';

export interface SliderProps {
  value: Signal<number>;
  min: number;
  max: number;
  /** Linear: default (max − min)/100. Log: an absolute grid if given, else `sig` significant figures. */
  step?: number;
  /** 'log' needs min > 0: equal track distance = equal ratio (a learning rate from 0.001 to 1.5). */
  scale?: 'linear' | 'log';
  /** Values never landed on, by drag or key (h never reaches 0). */
  exclude?: readonly number[];
  /** Log scale without a step: significant figures to snap to (default 2). */
  sig?: number;
  /** Shown on the left; its plain text is also the accessible name. */
  label: Rich;
  /** Thumb and value in the concept's ink; dragging lights the concept everywhere. */
  concept?: string;
  /** Ticks under the track at meaningful values; magnetic within `snapRadius` while dragging. */
  detents?: readonly SliderDetent[];
  /** Linear: world units (default 1.5 steps). Log: track fraction (default 0.015). */
  snapRadius?: number;
  /** Value text; default formatSliderValue (step decimals, or significant figures on log). */
  format?: (v: number) => string;
  /** aria-valuetext ("lambda 3.00, determinant 0.00"); default the formatted value. */
  valueText?: (v: number) => string;
  disabled?: boolean;
  /** Called on release (pointer up) and after each key press, never during a drag. */
  onCommit?: (v: number) => void;
  class?: string;
  id?: string;
}

const TRACK = 1000;
const KEYS = new Set(['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

export function Slider(props: SliderProps) {
  const { value, min, max, step, scale, exclude, sig, label, concept, detents, snapRadius, format, valueText, disabled, onCommit } = props;
  const autoId = useId();
  const id = props.id ?? `slider-${autoId}`;
  const source = `slider:${id}`;
  const s: SliderScale = useMemo(() => ({ min, max, step, scale, exclude, sig }), [min, max, step, scale, exclude, sig]);
  const problem = useMemo(() => {
    try {
      validateSliderScale(s);
      return null;
    } catch (err) {
      if (import.meta.env.DEV) throw err;
      console.error((err as Error).message); // a lesson bug: smoke fails the page on it
      return (err as Error).message;
    }
  }, [s]);
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef<{ start: number } | null>(null);
  const keyed = useRef(false);

  const v = value.value;
  const pos = problem ? 0 : sliderPosition(v, s);
  const fmt = format ?? ((x: number) => formatSliderValue(x, s));
  const plainLabel = useMemo(() => richToPlain(label), [label]);

  const write = (next: number) => {
    if (Object.is(next, value.peek())) {
      // The input may have moved to an unsnapped position: put it back on the value.
      if (input.current) input.current.value = String(Math.round(sliderPosition(next, s) * TRACK));
      return;
    }
    value.value = next;
  };

  const onInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    if (problem) return;
    const raw = sliderValue(Number(e.currentTarget.value) / TRACK, s, value.peek());
    write(magnetDetent(raw, detents, s, snapRadius));
  };

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (problem || !KEYS.has(e.key)) return;
    e.preventDefault();
    const cur = value.peek();
    let next: number;
    if (e.key === 'Home') next = sliderExtreme('min', s);
    else if (e.key === 'End') next = sliderExtreme('max', s);
    else {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp' ? 1 : -1;
      next = stepSliderValue(cur, dir, s, e.key === 'PageUp' || e.key === 'PageDown');
    }
    keyed.current = true;
    write(next);
  };

  const onKeyUp = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (keyed.current && KEYS.has(e.key)) {
      keyed.current = false;
      onCommit?.(value.peek());
    }
  };

  const onPointerDown = () => {
    if (disabled || problem) return;
    dragging.current = { start: value.peek() };
    if (concept) highlight({ concept }, { source });
    const up = () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = dragging.current;
      dragging.current = null;
      if (concept && document.activeElement !== input.current) clearHighlight(source);
      if (d && !Object.is(d.start, value.peek())) onCommit?.(value.peek());
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const ticks = (detents ?? []).filter((d) => detentValue(d) >= min && detentValue(d) <= max);
  const cls = ['slider', concept ? `ct ct-${concept}` : '', disabled || problem ? 'is-disabled' : '', props.class].filter(Boolean).join(' ');

  return (
    <div class={cls} data-concept={concept}>
      <label class="slider__label" for={id}>
        <RichText inline text={label} />
      </label>
      <div class="slider__track">
        <input
          ref={input}
          id={id}
          type="range"
          min={0}
          max={TRACK}
          step={1}
          value={Math.round(pos * TRACK)}
          style={{ '--fill': `${(pos * 100).toFixed(2)}%` }}
          aria-label={plainLabel}
          aria-valuetext={problem ? problem : valueText ? valueText(v) : fmt(v)}
          disabled={disabled || !!problem}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onPointerDown={onPointerDown}
          onFocus={() => concept && highlight({ concept }, { source })}
          onBlur={() => concept && !dragging.current && clearHighlight(source)}
        />
        {ticks.length > 0 && (
          <div class="slider__ticks" aria-hidden="true">
            {ticks.map((d, k) => {
              const at = detentValue(d);
              const text = typeof d === 'number' ? fmt(d) : (d.label ?? fmt(d.value));
              return (
                <span key={k} class={`slider__tick${Object.is(at, v) ? ' is-on' : ''}`} style={{ left: `${(sliderPosition(at, s) * 100).toFixed(2)}%` }}>
                  {text}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <span class="slider__value" aria-hidden="true">
        {problem ? '—' : fmt(v)}
      </span>
    </div>
  );
}
