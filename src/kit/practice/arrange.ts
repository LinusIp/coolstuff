/**
 * Pure helpers behind the order and match inputs (Problem's drag modes and
 * Quiz's drag questions): moving an item, where a dragged row lands, placing
 * an item in a slot, and the plain-words summaries screen readers hear.
 * Tested in arrange.test.ts.
 */
import { richToPlain } from '../core/richtext';
import type { MatchTarget, OrderTarget } from '../types';

/** A copy of `xs` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(xs: readonly T[], from: number, to: number): T[] {
  const out = xs.slice();
  if (out.length === 0) return out;
  const f = Math.max(0, Math.min(out.length - 1, from));
  const t = Math.max(0, Math.min(out.length - 1, to));
  const [it] = out.splice(f, 1);
  out.splice(t, 0, it);
  return out;
}

/**
 * Where a dragged row lands: `mids` are the vertical midpoints of the rows in
 * their current order, `y` the pointer, `from` the dragged row's index. The
 * row moves past every other row whose midpoint it has crossed.
 */
export function dropIndex(mids: readonly number[], y: number, from: number): number {
  let to = from;
  for (let k = from + 1; k < mids.length; k++) if (y > mids[k]) to = k;
  for (let k = from - 1; k >= 0; k--) if (y < mids[k]) to = k;
  return to;
}

/** Put `item` into `slot` (−1 takes it out). Several items may share a slot. */
export function placeMatch(slots: readonly number[], item: number, slot: number): number[] {
  const out = slots.slice();
  if (item >= 0 && item < out.length) out[item] = slot;
  return out;
}

/** Items currently in `slot`, in item order. */
export function itemsInSlot(slots: readonly number[], slot: number): number[] {
  const out: number[] = [];
  slots.forEach((s, i) => s === slot && out.push(i));
  return out;
}

/** "1. Form A − λI; 2. Solve det(A − λI) = 0; …" */
export function orderSummary(t: Pick<OrderTarget, 'items'>, order: readonly number[]): string {
  return order.map((i, k) => `${k + 1}. ${richToPlain(t.items[i] ?? '')}`).join('; ');
}

/** "eigenvector → nonzero vector A only stretches; eigenvalue → not placed" */
export function matchSummary(t: Pick<MatchTarget, 'items' | 'slots'>, slots: readonly number[]): string {
  return t.items.map((it, i) => `${richToPlain(it)} → ${slots[i] >= 0 ? richToPlain(t.slots[slots[i]] ?? '') : 'not placed'}`).join('; ');
}

/** How many items are placed. */
export const placedCount = (slots: readonly number[]): number => slots.filter((s) => s >= 0).length;
