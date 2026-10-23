/**
 * Callouts and margin notes (README §5.5, DESIGN.md §8 and §3).
 *
 *   <Callout kind="key">An eigenvector keeps its line.</Callout>
 *   <Callout kind="simplify">We’re ignoring air resistance here.</Callout>
 *   <p>… a nonzero vector<Sidenote>Why nonzero? $A\zerovec = \lambda\zerovec$ for every $\lambda$.</Sidenote> that …</p>
 *
 * A sidenote floats into the margin at ≥ 1000px; below that it folds inline
 * behind its numbered marker, a button that opens it as a sunk panel under
 * the line (`aria-expanded`). Numbers follow page order.
 */
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useMediaQuery } from '../core/hooks';
import { RichText } from '../core/RichText';
import type { Rich } from '../types';

export type CalloutKind = 'note' | 'key' | 'simplify';

const LABELS: Record<CalloutKind, string> = { note: 'Note', key: 'Key idea', simplify: 'Simplification' };

export interface CalloutProps {
  kind?: CalloutKind;
  /** Small-caps label; default by kind ("Note", "Key idea", "Simplification"). Pass '' for none. */
  label?: string;
  /** Rich text, or JSX as children. */
  text?: Rich;
  children?: ComponentChildren;
}

export function Callout({ kind = 'note', label, text, children }: CalloutProps) {
  const l = label ?? LABELS[kind];
  return (
    <aside class={`callout${kind === 'note' ? '' : ` callout--${kind}`}`} data-callout={kind} aria-label={l || LABELS[kind]}>
      {l && <p class="label callout__label">{l}</p>}
      {text !== undefined && <RichText text={text} />}
      {children}
    </aside>
  );
}

/** Bumped whenever a sidenote mounts or unmounts, so every marker renumbers in page order. */
const sidenoteEpoch = signal(0);

export interface SidenoteProps {
  /** Rich text, or JSX as children. */
  text?: Rich;
  children?: ComponentChildren;
}

export function Sidenote({ text, children }: SidenoteProps) {
  const id = `sn-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = useRef<HTMLButtonElement>(null);
  const [n, setN] = useState(0);
  const [openNote, setOpen] = useState(false);
  const margin = useMediaQuery('(min-width: 1000px)');
  const epoch = sidenoteEpoch.value;
  useEffect(() => {
    sidenoteEpoch.value++;
    return () => {
      sidenoteEpoch.value++;
    };
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const k = [...document.querySelectorAll('.sn-ref')].indexOf(el) + 1;
    if (k !== n) setN(k);
  }, [epoch]);
  const label = n ? String(n) : '';
  return (
    <>
      <button
        ref={ref}
        type="button"
        class="sn-ref"
        data-hit
        aria-label={margin ? `Note ${label} in the margin` : openNote ? `Hide note ${label}` : `Show note ${label}`}
        aria-expanded={margin ? undefined : openNote ? 'true' : 'false'}
        aria-controls={id}
        onClick={() => {
          if (margin) {
            const note = document.getElementById(id);
            note?.classList.remove('is-flash');
            void note?.offsetWidth;
            note?.classList.add('is-flash');
          } else setOpen(!openNote);
        }}
      >
        {label}
      </button>
      <span class={`sidenote${openNote ? ' is-open' : ''}`} id={id} role="note">
        <span class="sidenote__num" aria-hidden="true">
          {label}
        </span>
        {text !== undefined && <RichText inline text={text} />}
        {children}
      </span>
    </>
  );
}
