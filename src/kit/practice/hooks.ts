/**
 * `useSyncSignalEffect`: like @preact/signals' `useSignalEffect`, but the
 * effect re-runs *synchronously* when a signal it read changes.
 * `useSignalEffect` defers re-runs to the next animation frame, so a value a
 * learner sets with a key press and checks straight away (arrow, then Enter)
 * could be read before it arrived, and a slider's release could snap back a
 * value that was about to be accepted. Practice inputs must never lose an edit.
 */
import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

export function useSyncSignalEffect(cb: () => void | (() => void)): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => effect(() => ref.current()), []);
}
