/**
 * Live values: numbers that flow from an interactive (a dragged handle, a
 * slider, a CodeCell's output) into formulas, readouts and other visuals.
 * The kit's convention is SIGNALS: a lesson owns `signal()`s, controls write
 * them, everything else reads them, and Preact re-renders exactly what used
 * the value.
 *
 *   const v = signal<Vec2>([1, 0.2]);               // lesson state
 *   const Av = computed(() => apply2(A, v.value));   // derived
 *   <Handle value={v} … />                           // G2 writes it
 *   <Formula live={{ v, Av }} … />                   // G1 shows it under the symbols
 *   <Slider value={lam} … />                         // G4 writes it
 */
import type { ReadonlySignal, Signal } from '@preact/signals';
import { formatNumber, formatVector } from '../notation';

/** A value a control reads AND writes. */
export type Bindable<T> = Signal<T>;

export type LiveScalar = number | string;
export type LiveData = LiveScalar | readonly number[] | readonly (readonly number[])[];

/** Something a formula or readout can show live: a signal, a computed, or a getter. */
export type LiveValue = ReadonlySignal<LiveData> | (() => LiveData);

export function isSignalLike(v: unknown): v is ReadonlySignal<unknown> {
  return !!v && typeof v === 'object' && 'value' in v && 'peek' in v;
}

/** Read a live value (subscribes when called during render). */
export function readLive(v: LiveValue): LiveData {
  return isSignalLike(v) ? v.value : v();
}

/**
 * The readout form of a live value: fixed decimals with tabular figures
 * (NOTATION.md §7): 2.00, (1.40, −0.20), or matrix rows "[2.00 1.00; 1.00 2.00]".
 */
export function formatLive(v: LiveData, decimals = 2): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return formatNumber(v, decimals);
  if (v.length > 0 && Array.isArray(v[0])) {
    return `[${(v as readonly (readonly number[])[]).map((row) => row.map((x) => formatNumber(x, decimals)).join(' ')).join('; ')}]`;
  }
  return formatVector(v as readonly number[], decimals);
}
