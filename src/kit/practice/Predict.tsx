/**
 * "Make your guess" (README §8.5): prompt → guess (choice rows, a Slider for
 * a number, or the children's own visual through `setGuess`) → Lock in my
 * guess (disabled until a guess exists) → the reveal, with a ✓ / × line. The
 * guess can't change once locked; "Reset my guess" starts over.
 *
 *   <Predict spec={PREDICTS[0]}>
 *     {({ locked, setGuess }) => <MatrixGrid … vectors={[{ value: v, onDragEnd: setGuess, … }]} show={{ eigen: locked }} />}
 *   </Predict>
 */
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Slider } from '../controls';
import { useKit } from '../core/context';
import { IconCheck, IconCross, IconRefresh } from '../core/icons';
import { getProgress } from '../core/progress';
import { RichText } from '../core/RichText';
import { formatSliderValue } from '../core/slider-scale';
import type { PredictSpec } from '../types';
import { optionLetter } from './draft';
import { describeGuess, hasGuess, judgeGuess, numberGuessStart } from './predict-state';
import { useSyncSignalEffect } from './hooks';

export interface PredictRenderState {
  locked: boolean;
  guess: unknown;
  /** Ignored once locked. */
  setGuess: (g: unknown) => void;
  /** null until locked. */
  correct: boolean | null;
}

export interface PredictProps {
  spec: PredictSpec;
  /** The visual: it decides what to hide while `!locked`; for a custom guess it calls `setGuess`. */
  children?: (s: PredictRenderState) => ComponentChildren;
}

export function Predict({ spec, children }: PredictProps) {
  const { lessonId } = useKit();
  const uid = `pr-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const g = spec.guess;
  const [guess, setGuessState] = useState<unknown>(undefined);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const focusReveal = useRef(false);
  const num = useMemo(() => (g.kind === 'number' ? signal(numberGuessStart(g)) : null), []);
  const suppress = useRef(true); // the effect's first run (mount) and programmatic resets aren't guesses
  useSyncSignalEffect(() => {
    const v = num?.value;
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (v !== undefined && !lockedRef.current) setGuessState(v);
  });
  useEffect(() => {
    if (focusReveal.current && locked) {
      focusReveal.current = false;
      revealRef.current?.focus();
    }
  }, [locked]);

  const setGuess = (v: unknown) => {
    if (!lockedRef.current) setGuessState(v);
  };
  const ready = hasGuess(g, guess);
  const correct = locked ? judgeGuess(g, guess) : null;
  const lock = () => {
    if (!ready || lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    focusReveal.current = true;
    if (lessonId) getProgress().predict(lessonId, spec.id, judgeGuess(g, guess));
  };
  const reset = () => {
    lockedRef.current = false;
    setLocked(false);
    setGuessState(undefined);
    if (num && g.kind === 'number' && num.peek() !== numberGuessStart(g)) {
      suppress.current = true;
      num.value = numberGuessStart(g);
    }
  };

  const answerText = g.kind === 'number' ? `${formatSliderValue(g.answer, { min: g.min, max: g.max, step: g.step })}${g.unit ? ` ${g.unit}` : ''}` : null;
  return (
    <div class={`card predict${locked ? ' is-locked' : ''}`} data-predict={spec.id} aria-labelledby={`${uid}-label`}>
      <div class="card__head">
        <p class="label" id={`${uid}-label`}>
          Make your guess
        </p>
        <span class="card__meta">{locked ? 'Locked in' : 'Guess first, then see'}</span>
      </div>
      <RichText class="lead predict__prompt" text={spec.prompt} />
      {children?.({ locked, guess, setGuess, correct })}
      {g.kind === 'choice' && (
        <div class="predict__options" role="group" aria-label="Your guess">
          {g.options.map((o, k) => {
            const picked = guess === k;
            const st = locked ? (picked ? (k === g.answer ? 'correct' : 'wrong') : k === g.answer ? 'answer' : null) : null;
            return (
              <div key={k} class={`choice${st === 'correct' ? ' is-correct' : st === 'wrong' ? ' is-wrong' : st === 'answer' ? ' is-answer' : ''}${!locked && picked ? ' is-picked' : ''}`}>
                <button type="button" class="choice__btn" aria-pressed={picked ? 'true' : 'false'} aria-disabled={locked ? 'true' : undefined} onClick={() => setGuess(k)}>
                  <span class="choice__key" aria-hidden="true">
                    {optionLetter(k)}
                  </span>
                  <RichText inline text={o} />
                  <span class="choice__mark">
                    {st === 'correct' ? <IconCheck /> : st === 'wrong' ? <IconCross /> : st === 'answer' ? <span class="choice__tag">the answer</span> : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {g.kind === 'number' && num && (
        <div class="predict__slider">
          <Slider
            id={`${uid}-slider`}
            value={num}
            min={g.min}
            max={g.max}
            step={g.step}
            label={g.label}
            disabled={locked}
            format={(v) => `${formatSliderValue(v, { min: g.min, max: g.max, step: g.step })}${g.unit ? ` ${g.unit}` : ''}`}
          />
        </div>
      )}
      {!locked ? (
        <div class="answer-row answer-row--action">
          <button type="button" class="btn btn--primary" disabled={!ready} onClick={lock}>
            Lock in my guess
          </button>
          {!ready && <span class="answer-row__help predict__wait">{g.kind === 'custom' ? 'Make your guess on the figure first.' : g.kind === 'number' ? 'Move the slider to your guess first.' : 'Pick an option first.'}</span>}
        </div>
      ) : (
        <div class="predict__reveal is-entering" ref={revealRef} tabIndex={-1}>
          <p class={`feedback feedback--${correct ? 'correct' : 'wrong'}`}>
            {correct ? <IconCheck /> : <IconCross />}
            <span>
              {`Your guess: ${describeGuess(g, guess) || 'locked in'}. `}
              {correct ? 'Right.' : answerText ? `Not quite: it’s ${answerText}.` : 'Not quite.'}
            </span>
          </p>
          <RichText class="predict__text" text={spec.reveal} />
          {correct && spec.right && <RichText class="predict__extra" text={spec.right} />}
          {!correct && spec.wrong && <RichText class="predict__extra" text={spec.wrong} />}
          <div class="card__foot">
            <button type="button" class="btn btn--quiet btn--sm" data-hit onClick={reset}>
              <IconRefresh /> Reset my guess
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
