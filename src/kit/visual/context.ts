/**
 * Shared plumbing for Stage2D and its primitives: the stage context (scale,
 * layers, overlay hosts, first-touch state, dev counters), the layer context
 * (static vs dynamic), concept → class/line-style resolution, and reading a
 * value that may be a signal.
 */
import type { ReadonlySignal, Signal } from '@preact/signals';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { isSignalLike } from '../core/live';
import { useKit } from '../core/context';
import { GLOBAL_CONCEPTS, type ConceptSet, type LineStyle, type SemanticRole } from '../theme';
import type { ViewBox } from '../types';
import type { Vec2 } from '../math/vec';
import type { StageScale } from './scales';

export type MaybeSignal<T> = T | ReadonlySignal<T>;
export type Layer = 'static' | 'dynamic';

/** Render counters, per stage (dev aid and test hook: `data-renders` on the stage). */
export interface StageStats {
  static: number;
  dynamic: number;
}

export interface StageContextValue {
  scale: StageScale;
  /** Where primitives portal their HTML labels (null until mounted). */
  overlay: HTMLElement | null;
  /** Hosts for CanvasLayer canvases. */
  canvasStatic: HTMLElement | null;
  canvasDynamic: HTMLElement | null;
  /** First-touch state: the first registered handle breathes and carries the hint. */
  touched: Signal<boolean>;
  firstHandle: Signal<string | null>;
  hint: string | false;
  stats: StageStats;
  /** Publish the counters on the stage element (coalesced per frame). */
  report(): void;
  /** Unique id prefix for ids inside this stage (patterns, titles). */
  uid: string;
}

export const StageContext = createContext<StageContextValue | null>(null);
export const LayerContext = createContext<Layer>('dynamic');

/** The public stage API (README §6.1). */
export interface StageApi {
  view: ViewBox;
  width: number;
  height: number;
  pxPerUnit: number;
  /** Pixels per unit along y (differs from `pxPerUnit` only without equal scale). */
  pxPerUnitY: number;
  toPx(p: Readonly<Vec2>): Vec2;
  toWorld(px: Readonly<Vec2>): Vec2;
}

const FALLBACK: StageApi = {
  view: { x: [0, 1], y: [0, 1] },
  width: 1,
  height: 1,
  pxPerUnit: 1,
  pxPerUnitY: 1,
  toPx: (p) => [p[0], 1 - p[1]],
  toWorld: (q) => [q[0], 1 - q[1]],
};

/** The enclosing stage's scale. Outside a stage it returns a unit identity scale (and draws nothing useful). */
export function useStage(): StageApi {
  const ctx = useContext(StageContext);
  return ctx ? ctx.scale : FALLBACK;
}

export function useStageContext(): StageContextValue | null {
  return useContext(StageContext);
}

export const useLayer = (): Layer => useContext(LayerContext);

/** Count this render in the stage's dev counters (static vs dynamic layer). */
export function useRenderCount(): void {
  const ctx = useContext(StageContext);
  const layer = useContext(LayerContext);
  if (!ctx) return;
  ctx.stats[layer]++;
  ctx.report();
}

/** Join class names, skipping falsy ones. */
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

/**
 * Read a value that may be a signal. On the dynamic layer reading subscribes
 * (the primitive re-renders when it changes); on the static layer it peeks, so
 * the static layer never repaints for a signal (README §6.1).
 */
export function readValue<T>(v: MaybeSignal<T>, layer: Layer): T {
  if (isSignalLike(v)) return layer === 'static' ? (v as ReadonlySignal<T>).peek() : (v as ReadonlySignal<T>).value;
  return v as T;
}

export interface ResolvedConcept {
  /** Classes for the mark's group: `ct ct-<name>` (or none). */
  className: string;
  line: LineStyle;
  /** Hue name for canvas drawing (`--hue-<hue>`), or null for ink. */
  hue: string | null;
}

/** A concept's classes and line style, from the lesson's ConceptSet or the global meanings. `correct` is the green state. */
export function resolveConcept(name: string | undefined, concepts: ConceptSet | undefined): ResolvedConcept {
  if (!name) return { className: '', line: 'solid', hue: null };
  if (concepts && concepts.names.includes(name)) return { className: `ct ct-${name}`, line: concepts.line(name), hue: concepts.get(name).hue };
  const g = GLOBAL_CONCEPTS[name as SemanticRole];
  if (g) return { className: `ct ct-${name}`, line: g.line, hue: g.hue };
  return { className: `ct ct-${name}`, line: 'solid', hue: null };
}

export function useConcept(name: string | undefined): ResolvedConcept {
  const { concepts } = useKit();
  return resolveConcept(name, concepts);
}

/** Stroke widths for the three emphasis levels (DESIGN.md §5). */
export const EMPHASIS = {
  focal: { width: 2.5, cls: 'fig-focal' },
  quiet: { width: 2, cls: 'fig-quiet' },
  context: { width: 1.5, cls: 'fig-context' },
} as const;
export type Emphasis = keyof typeof EMPHASIS;

/** setPointerCapture that never throws (the pointer may already be gone, e.g. a cancelled touch). */
export function capturePointer(el: Element | null | undefined, id: number): void {
  try {
    el?.setPointerCapture?.(id);
  } catch {
    /* no active pointer: nothing to capture */
  }
}
