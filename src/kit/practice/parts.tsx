/**
 * Small pieces the practice components share: a solution step, difficulty
 * stars, the common-wrong note, the verdict line and the boxed answer.
 */
import type { ComponentChildren, Ref } from 'preact';
import { MathChain } from '../core/Tex';
import { RichText } from '../core/RichText';
import { IconCheck, IconCross, IconWarn } from '../core/icons';
import type { Difficulty, Rich, StepSpec, Verdict } from '../types';
import { difficultyWord } from './draft';

/** One numbered step: sans title, a relation chain, prose, an italic justification. */
export function StepItem({ step, entering, itemRef, id }: { step: StepSpec; entering?: boolean; itemRef?: Ref<HTMLLIElement>; id?: string }) {
  return (
    <li class={`step${entering ? ' is-entering' : ''}`} ref={itemRef} id={id} tabIndex={itemRef ? -1 : undefined}>
      {step.title && (
        <p class="step__title">
          <RichText inline text={step.title} />
        </p>
      )}
      {step.math && <MathChain tex={step.math} />}
      {step.text && <RichText class="step__text" text={step.text} />}
      <RichText as="p" inline class="step__why" text={step.why} />
    </li>
  );
}

/** ★★☆ standard: ink stars with a word, never a hue. */
export function Stars({ level }: { level: Difficulty }) {
  return (
    <span class="difficulty">
      <span class="stars" aria-hidden="true">
        {'★'.repeat(level)}
        <span class="stars__off">{'★'.repeat(3 - level)}</span>
      </span>
      <span class="sr-only">Difficulty: </span>
      {difficultyWord(level)}
    </span>
  );
}

/** "Why 6 is the common wrong answer" ⚠ on a red wash. */
export function WrongNote({ title, why, id }: { title: Rich; why: Rich; id?: string }) {
  return (
    <div class="wrong-note is-entering" id={id}>
      <p class="wrong-note__head">
        <IconWarn /> <RichText inline text={title} />
      </p>
      <RichText text={why} />
    </div>
  );
}

/** Feedback tone: right, wrong, or a fix-it note (empty field, typo, missing unit, too rough) that isn't counted. */
export type Tone = 'correct' | 'wrong' | 'note';

export function toneOf(v: Verdict, kind?: string): Tone {
  if (v.correct) return 'correct';
  if (v.reason === 'wrong' || v.reason === 'unit-dimension' || (kind === 'proof' && v.reason === 'incomplete')) return 'wrong';
  return 'note';
}

/** The verdict line's contents: ✓ / × / ⚠ + the message (the element itself is the caller's aria-live `p.feedback`). */
export function VerdictText({ verdict, kind, prefix }: { verdict: Verdict; kind?: string; prefix?: ComponentChildren }) {
  const tone = toneOf(verdict, kind);
  return (
    <>
      {tone === 'correct' ? <IconCheck /> : tone === 'wrong' ? <IconCross /> : <IconWarn />}
      <span>
        {prefix}
        {verdict.message}
      </span>
    </>
  );
}

/** The boxed final answer (green rule) or its veil. */
export function AnswerBox({ answer, hidden, hint }: { answer: Rich; hidden?: boolean; hint?: string }) {
  if (hidden) {
    return (
      <div class="answer answer--hidden">
        <span class="label answer__label">Answer</span>
        <span class="answer__veil" aria-hidden="true" />
        {hint && <span class="answer__hint">{hint}</span>}
      </div>
    );
  }
  return (
    <div class="answer">
      <span class="label answer__label">Answer</span>
      <span class="answer__body">
        <RichText inline text={answer} />
      </span>
    </div>
  );
}

/** ✓ Sanity check / ✓ Check line. */
export function Sanity({ text, label = 'Sanity check' }: { text: Rich; label?: string }) {
  return (
    <p class="sanity">
      <span class="label sanity__label">
        <IconCheck /> {label}
      </span>
      <RichText inline text={text} />
    </p>
  );
}
