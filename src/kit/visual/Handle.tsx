/**
 * A draggable point (README §6.1, DESIGN.md §6): a 5.5px dot inside a 14px
 * ring on a 13% wash, over a 44px transparent hit area. Pointer, touch and
 * keyboard (arrows, Shift ×5, Home/End along a curve/line) all go through the
 * same pure pipeline (constraints.ts). Writes reach the signal at most once
 * per animation frame; `touch-action: none` sits on the handle only, so the
 * page still scrolls around the figure.
 */
import type { Signal } from '@preact/signals';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { clearHighlight, highlight } from '../core/link';
import { formatLive } from '../core/live';
import type { Vec2 } from '../math/vec';
import type { ViewBox } from '../types';
import { constraintEnds, keyMove, resolveHandle, type Constraint, type KeyDir } from './constraints';
import { capturePointer, cx, readValue, useConcept, useRenderCount, useStageContext, type MaybeSignal } from './context';
import { createFrameWriter } from './frame';
import { hintPlacement, r2 } from './scales';

export interface HandleProps {
  value: Signal<Vec2>;
  /** Accessible name: "the input arrow v". */
  label: string;
  concept?: string;
  constrain?: Constraint;
  /** A grid step, or magnetic point targets (within 12px). */
  snap?: number | readonly Readonly<Vec2>[];
  /** Magnetic directions from `origin` (within 3°): an arrow tip that clicks onto a line through the origin. */
  snapDirections?: readonly Readonly<Vec2>[];
  /** Origin for `snapDirections` (default [0, 0]). */
  origin?: Readonly<Vec2>;
  /** Arrow-key step in world units (Shift ×5). Default: the grid snap, else 0.1. */
  step?: number;
  /** Where the handle may go. Default: the visible view. */
  bounds?: ViewBox;
  /** Found it: the handle turns green (pair with `correct` on the line it sits on). */
  correct?: MaybeSignal<boolean>;
  /** Symbol for the spoken value: `v` → "v = (1.40, 0.20)". */
  symbol?: string;
  /** Spoken value text; default "(x, y)" (prefixed with `symbol =`). */
  valueText?: (v: Vec2) => string;
  disabled?: boolean;
  onDragStart?(): void;
  /** Called once when a drag ends (and after each keyboard move), with the final value. */
  onDragEnd?(value: Vec2): void;
}

let handleSeq = 0;
const KEYS: Record<string, KeyDir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

export function Handle(props: HandleProps) {
  useRenderCount();
  const { value, label, concept, constrain, snap, snapDirections, origin, bounds, correct, symbol, valueText, disabled, onDragStart, onDragEnd } = props;
  const ctx = useStageContext();
  const id = useMemo(() => `handle-${(++handleSeq).toString(36)}`, []);
  const rc = useConcept(concept);
  const [dragging, setDragging] = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const grab = useRef<{ dx: number; dy: number; rect: DOMRect } | null>(null);
  const writer = useMemo(() => createFrameWriter<Vec2>((v) => (value.value = v)), [value]);
  const p = value.value;
  const ok = correct !== undefined && readValue(correct, 'dynamic');

  // The first handle on a stage carries the breathing ring and the hint.
  useLayoutEffect(() => {
    if (!ctx) return;
    if (ctx.firstHandle.peek() === null) ctx.firstHandle.value = id;
    return () => {
      if (ctx.firstHandle.peek() === id) ctx.firstHandle.value = null;
    };
  }, [ctx?.firstHandle]);

  if (!ctx) return null;
  const s = ctx.scale;
  const lim = bounds ?? s.view;
  const step = props.step ?? (typeof snap === 'number' ? snap : 0.1);
  const isFirst = ctx.firstHandle.value === id;
  const touched = ctx.touched.value;
  const fresh = isFirst && !touched;
  const pos = s.toPx(p);

  const resolve = (raw: Vec2) => resolveHandle(raw, { constrain, snap, snapDirections, origin, targetRadius: 12 / s.pxPerUnit, bounds: lim, prev: value.peek() });

  const touch = () => {
    if (!ctx.touched.peek()) {
      ctx.touched.value = true;
      window.setTimeout(() => setHintGone(true), 450);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as SVGGElement;
    capturePointer(el, e.pointerId);
    const rect = (el.ownerSVGElement ?? el).getBoundingClientRect();
    const here = s.toPx(value.peek());
    grab.current = { dx: e.clientX - rect.left - here[0], dy: e.clientY - rect.top - here[1], rect };
    setDragging(true);
    touch();
    if (concept) highlight({ concept }, { source: id });
    onDragStart?.();
  };
  const onPointerMove = (e: PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    e.preventDefault();
    const w = s.toWorld([e.clientX - g.rect.left - g.dx, e.clientY - g.rect.top - g.dy]);
    writer.push(resolve(w));
  };
  const end = (e: PointerEvent) => {
    if (!grab.current) return;
    grab.current = null;
    (e.currentTarget as SVGGElement).releasePointerCapture?.(e.pointerId);
    writer.flush();
    setDragging(false);
    clearHighlight(id);
    onDragEnd?.(value.peek());
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    const dir = KEYS[e.key];
    let next: Vec2 | null = null;
    const cur = value.peek();
    const keyOpts = { constrain, snap: typeof snap === 'number' ? snap : undefined, bounds: lim, prev: cur };
    if (dir) next = resolveHandle(keyMove(cur, dir, step * (e.shiftKey ? 5 : 1), constrain), keyOpts);
    else if (e.key === 'Home' || e.key === 'End') {
      const ends = constraintEnds(constrain, lim);
      if (ends) next = resolveHandle(e.key === 'Home' ? ends[0] : ends[1], keyOpts);
    }
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    touch();
    if (concept) highlight({ concept }, { source: id });
    value.value = next;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (KEYS[e.key] || e.key === 'Home' || e.key === 'End') onDragEnd?.(value.peek());
  };

  const spoken = valueText ? valueText(p) : `${symbol ? `${symbol} = ` : ''}${formatLive(p)}`;
  const hintText = ctx.hint;
  const showHint = isFirst && hintText && !hintGone;
  const hint = showHint ? hintPlacement(pos, s.width, s.height, hintText.length * 7.4 + 4) : null;

  return (
    <g class={cx('s2-handle', rc.className)}>
      <g
        class={cx('fig-handle', dragging && 'is-dragging', fresh && 'is-fresh', ok && 'is-correct', disabled && 'is-disabled')}
        transform={`translate(${r2(pos[0])} ${r2(pos[1])})`}
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-label={label}
        aria-roledescription="draggable point"
        aria-valuetext={spoken}
        aria-valuenow={Math.round(p[0] * 100) / 100}
        aria-valuemin={Math.round(lim.x[0] * 100) / 100}
        aria-valuemax={Math.round(lim.x[1] * 100) / 100}
        aria-disabled={disabled ? 'true' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => clearHighlight(id)}
      >
        <circle class="fig-handle__hit" r="22.5" />
        <circle class="fig-handle__ring" r="14" />
        <circle class="fig-handle__dot" r="5.5" />
        <circle class="fig-handle__focus" r="20" />
      </g>
      {hint && hintText && (
        <g class={cx('fig-annot', touched && 'is-gone')} aria-hidden="true">
          <text x={hint.x} y={hint.y}>
            {hintText}
          </text>
          <path d={hint.arrow} />
          <path d={hint.tip} />
        </g>
      )}
    </g>
  );
}
