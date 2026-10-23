/**
 * A common trap (README §5.5, DESIGN.md §8): the myth in the student's words,
 * why it fails, "What's true.", and a small counterexample plate beside it
 * (stacked on phones).
 *
 *   {TRAPS.map((t, i) => <Trap spec={t} n={i + 1} figures={FIGURES.traps} />)}
 *
 * The counterexample is `figure` (wins) or `figures[spec.figure]()`. A missing
 * renderer renders NO <figure> (an empty one would be a blank figure) and logs
 * one console.error naming the key, which fails smoke, so it can't ship.
 * Trap renders its own figure markup: it never imports the shell's Figure
 * (PLAN §3).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId } from 'preact/hooks';
import type { LessonFigures } from '../core/figures';
import { IconWarn } from '../core/icons';
import { RichText } from '../core/RichText';
import type { TrapSpec } from '../types';

export interface TrapProps {
  spec: TrapSpec;
  /** Shown as "Trap n". */
  n?: number;
  /** FIGURES.traps from figures.tsx: renders `figures[spec.figure]()`. */
  figures?: LessonFigures['traps'];
  /** Or the counterexample directly (wins over `figures`). */
  figure?: ComponentChildren;
}

/** Keys already reported, so a re-render doesn't log the same missing renderer twice. */
const reported = new Set<string>();

export function Trap({ spec, n, figures, figure }: TrapProps) {
  const uid = useId();
  const render = figure === undefined ? figures?.[spec.figure] : undefined;
  const missing = figure === undefined && !render;
  useEffect(() => {
    if (!missing || reported.has(`${spec.id}:${spec.figure}`)) return;
    reported.add(`${spec.id}:${spec.figure}`);
    console.error(`Trap "${spec.id}": no figure renderer for key "${spec.figure}". Add it to FIGURES.traps in figures.tsx (or pass \`figure\`).`);
  }, [missing, spec.id, spec.figure]);
  const fig = figure ?? render?.();
  const capId = `${uid}-cap`;
  const descId = `${uid}-desc`;
  return (
    <article class="card trap" data-trap={spec.id} aria-labelledby={`${uid}-title`}>
      <h3 class="trap__title" id={`${uid}-title`}>
        <IconWarn />
        {n !== undefined && (
          <>
            <span class="trap__n">Trap {n}</span>
            <span class="trap__sep" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span class="trap__myth">
          “<RichText inline text={spec.myth} />”
        </span>
      </h3>
      <div class="trap__body">
        <div class="trap__text">
          <RichText text={spec.explanation} />
          <div class="trap__truth">
            <p>
              <strong>What’s true.</strong> <RichText inline text={spec.truth} />
            </p>
          </div>
        </div>
        {!missing && (
          <figure class="trap__fig" data-figure={`trap-${spec.id}`} aria-labelledby={capId} aria-describedby={descId}>
            <div class="trap__stage">{fig}</div>
            <RichText as="figcaption" inline id={capId} text={spec.figureCaption} />
            <p class="sr-only" id={descId}>
              {spec.figureDescription}
            </p>
          </figure>
        )}
      </div>
    </article>
  );
}
