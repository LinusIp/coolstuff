/**
 * Small pieces every data-structure view shares: reading a state that may be
 * a signal, the roving tab stop (README §9.6), "what just changed" tracking
 * for the enter fade and the value flash, concept strokes for SVG marks, and
 * the ✓ / × glyph that pairs a verdict colour with a shape.
 */
import type { ReadonlySignal } from '@preact/signals';
import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { isSignalLike } from '../core/live';
import { strokeFor, type ConceptSet } from '../theme';
import { conceptLine, type MarkInfo } from './marks';

/** A view's `state` prop: a plain value or a signal (read in render, so the view follows it). */
export type StateProp<S> = S | ReadonlySignal<S>;

export const readState = <S,>(s: StateProp<S>): S => (isSignalLike(s) ? (s as ReadonlySignal<S>).value : (s as S));

/** Natural order for ids: "2" before "10", "a" before "b". */
export const byNatural = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });

/** The ✓ / × beside a done, found or error element (aria-hidden: the label says it in words). */
export function MarkGlyph({ info }: { info: MarkInfo | null }) {
  if (!info?.glyph) return null;
  return (
    <span class={`ds-glyph${info.glyph === '×' ? ' is-error' : ''}`} aria-hidden="true">
      {info.glyph}
    </span>
  );
}

/** SVG stroke attributes for a concept mark: dash pattern from the concept's line style (colour comes from `.ct-<name>`). */
export function conceptStroke(info: MarkInfo | null, width: number, concepts?: ConceptSet): { dash?: string; cap: 'round' | 'butt'; double: boolean } {
  if (!info || info.kind !== 'concept' || !info.concept) return { cap: 'round', double: false };
  const s = strokeFor(conceptLine(info.concept, concepts), width);
  return { dash: s.dasharray ?? undefined, cap: s.linecap, double: s.double };
}

/**
 * One tab stop per view (README §9.6). `keys` are the focusable elements in
 * navigation order; the active one gets tabindex 0, the rest −1. `focusKey`
 * moves focus and the tab stop together. Elements carry `data-rk={key}`.
 */
export function useRoving(keys: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLElement | SVGElement | null>(null);
  const current = active !== null && keys.includes(active) ? active : (keys[0] ?? null);
  const focusKey = (k: string | null) => {
    if (k === null) return;
    setActive(k);
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(k) : k.replace(/["\\]/g, '\\$&');
    const el = root.current?.querySelector<HTMLElement | SVGElement>(`[data-rk="${esc}"]`);
    el?.focus({ preventScroll: false });
  };
  return {
    root,
    active: current,
    setActive,
    focusKey,
    tabIndex: (k: string): 0 | -1 => (k === current ? 0 : -1),
  };
}

/** Enter/Space activation for SVG `role=button` elements (HTML buttons do it natively). */
export function onActivate(fn: () => void) {
  return (e: JSX.TargetedKeyboardEvent<Element>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
}

/**
 * Keys that are new since the last committed render (enter fade), and keys
 * whose value changed (value flash). `flash` alternates 'a' / 'b' so a cell
 * that changes on two frames in a row restarts its animation.
 */
export function useChanges(entries: readonly (readonly [string, unknown])[]): { entered: Set<string>; changed: Set<string>; flash: 'a' | 'b' } {
  const prev = useRef<Map<string, unknown> | null>(null);
  const parity = useRef<'a' | 'b'>('a');
  const entered = new Set<string>();
  const changed = new Set<string>();
  const before = prev.current;
  if (before) {
    for (const [k, v] of entries) {
      if (!before.has(k)) entered.add(k);
      else if (!Object.is(before.get(k), v)) changed.add(k);
    }
  }
  const flash = changed.size ? (parity.current === 'a' ? 'b' : 'a') : parity.current;
  useLayoutEffect(() => {
    prev.current = new Map(entries);
    parity.current = flash;
  });
  return { entered, changed, flash };
}

/** A node's shape: a circle, or a pill when the label is long. Shared by TreeView and GraphView. */
export function NodeShape({ w, h, info, concepts, cls, inset = 0 }: { w: number; h: number; info: MarkInfo | null; concepts?: ConceptSet; cls: string; inset?: number }) {
  const st = conceptStroke(info, 2.5, concepts);
  const r = h / 2 - inset;
  const common = { class: cls, 'stroke-dasharray': st.dash, 'stroke-linecap': st.cap };
  const shape = (rr: number, extra: Record<string, unknown> = {}) =>
    w > h ? <rect x={-w / 2 + (h / 2 - rr)} y={-rr} width={w - 2 * (h / 2 - rr)} height={2 * rr} rx={rr} {...common} {...extra} /> : <circle r={rr} {...common} {...extra} />;
  return (
    <>
      {shape(r)}
      {st.double && shape(r - 4.5, { class: `${cls} ds-node__inner` })}
    </>
  );
}

/** The ✓ / × badge on a node's shoulder. */
export function NodeGlyph({ info, x, y }: { info: MarkInfo | null; x: number; y: number }) {
  if (!info?.glyph) return null;
  return (
    <g class={`ds-node__glyph${info.glyph === '×' ? ' is-error' : ''}`} transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r="8.5" />
      <text y="0.5">{info.glyph}</text>
    </g>
  );
}
