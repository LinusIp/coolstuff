/**
 * Scroll-driven steps beside a pinned visual (README §7.5).
 *
 *   const s = signal(0);
 *   <Scrolly step={s} steps={[{ id: 'secant', content: <p>…</p> }, …]}>
 *     {(k) => <SecantFigure stage={k} />}
 *   </Scrolly>
 *
 * Wide screens (≥ 1000px): steps in a column, the visual sticky beside them.
 * Tablets and phones: the visual sticks to the top (at most 45vh) and the
 * steps scroll under it. The current step is the one nearest the reading
 * line (the centre of what the visual leaves free); it gets `.is-current`
 * and `aria-current="step"`, and writes `step`. Nothing is hidden or faded:
 * all steps and the visual read top to bottom without JS or motion, and each
 * step is a tab stop (focusing one makes it current). Each step renders as
 * `article.scrolly__step[data-step]`, so smoke counts Scrolly steps like `Step`s.
 */
import { useSignal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { nearestToLine } from './timeline';

export interface ScrollyStep {
  id: string;
  content: ComponentChildren;
}

export interface ScrollyProps {
  steps: readonly ScrollyStep[];
  /** The current step (written by scrolling; visuals elsewhere can read it). Default internal. */
  step?: Signal<number>;
  /** The pinned visual, given the current step. */
  children: (step: number) => ComponentChildren;
  /** Accessible name for the steps list; default "Steps". */
  label?: string;
  class?: string;
}

export function Scrolly({ steps, step: stepProp, children, label = 'Steps', class: cls }: ScrollyProps) {
  const own = useSignal(0);
  const step = stepProp ?? own;
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const visual = useRef<HTMLDivElement>(null);
  const current = Math.min(Math.max(0, step.value), Math.max(0, steps.length - 1));

  useEffect(() => {
    if (!root) return;
    let queued = false;
    const measure = () => {
      queued = false;
      const items = [...root.querySelectorAll<HTMLElement>(':scope > .scrolly__steps > .scrolly__step')];
      if (!items.length) return;
      const vh = window.innerHeight;
      const v = visual.current?.getBoundingClientRect();
      // Stacked layout: the visual is pinned above the steps, so read in the space below it.
      const first = items[0].getBoundingClientRect();
      const stacked = !!v && v.left < first.right && v.right > first.left && v.bottom <= vh * 0.6;
      const top = stacked && v ? Math.max(0, v.bottom) : 0;
      const line = top + (vh - top) / 2;
      const k = nearestToLine(
        items.map((it) => it.getBoundingClientRect()),
        line,
      );
      if (k !== step.peek()) step.value = k;
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [root, step, steps.length]);

  return (
    <div ref={setRoot} class={['scrolly', 'is-wide', cls].filter(Boolean).join(' ')}>
      <div ref={visual} class="scrolly__visual">
        {children(current)}
      </div>
      <div class="scrolly__steps" aria-label={label} role="group">
        {steps.map((s, k) => (
          <article
            key={s.id}
            id={s.id}
            class={`scrolly__step${k === current ? ' is-current' : ''}`}
            data-step={s.id}
            aria-current={k === current ? 'step' : undefined}
            tabIndex={0}
            onFocus={() => {
              if (step.peek() !== k) step.value = k;
            }}
          >
            {s.content}
          </article>
        ))}
      </div>
    </div>
  );
}
