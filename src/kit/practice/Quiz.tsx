/**
 * Quick check (README §8.4, DESIGN.md §8): 4–6 fast questions, one at a
 * time. Picking an option checks it immediately (wrong → red, × and that
 * option's why; right → green, ✓ and why); multi-select and drag questions
 * check with a button. The first answer is the score; Try again lets the
 * learner pick again. The end shows the score and the misses to review.
 *
 *   <Quiz questions={QUIZ} figures={FIGURES.quiz} />
 */
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useKit } from '../core/context';
import type { LessonFigures } from '../core/figures';
import { IconCheck, IconCross, IconRefresh } from '../core/icons';
import { getProgress } from '../core/progress';
import { RichText } from '../core/RichText';
import { richToPlain } from '../core/richtext';
import type { MatchTarget, OrderTarget, QuizQuestion, QuizSpec } from '../types';
import { optionLetter } from './draft';
import { MatchInput } from './inputs/MatchInput';
import { OrderInput } from './inputs/OrderInput';
import { answerQuestion, goToQuestion, judgeQuiz, nextQuestion, quizMisses, quizScore, quizStart, retryQuestion, type QuizState } from './quiz-state';

export interface QuizProps {
  questions: QuizSpec;
  title?: string;
  /** FIGURES.quiz, by question.figure. */
  figures?: LessonFigures['quiz'];
}

type ChoiceQ = Extract<QuizQuestion, { kind: 'choice' }>;
type DragQ = Extract<QuizQuestion, { kind: 'drag' }>;

const startArrangement = (t: OrderTarget | MatchTarget): number[] => (t.mode === 'order' ? t.items.map((_, i) => i) : t.items.map(() => -1));
const isMulti = (q: ChoiceQ) => typeof q.correct !== 'number';

export function Quiz({ questions, title = 'Quick check', figures }: QuizProps) {
  const { lessonId } = useKit();
  const uid = `quiz-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const [s, setS] = useState<QuizState>(() => quizStart(questions.length));
  const [pending, setPending] = useState<number[][]>(() => questions.map((q) => (q.kind === 'drag' ? startArrangement(q.target) : [])));
  const [live, setLive] = useState('');
  const root = useRef<HTMLElement>(null);
  const focusAfter = useRef<'summary' | 'question' | null>(null);

  useEffect(() => {
    for (const q of questions) if (q.figure && !figures?.[q.figure]) console.error(`Quiz: no renderer for figure "${q.figure}" (question "${q.id}"); add it to FIGURES.quiz in figures.tsx.`);
  }, [questions, figures]);
  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const el = f === 'summary' ? root.current?.querySelector<HTMLElement>('.quiz__summary') : root.current?.querySelectorAll<HTMLElement>('.quiz__set')[s.current]?.querySelector<HTMLElement>('legend');
    if (el) {
      if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
      el.focus();
    }
  });

  const save = (next: QuizState, done = false) => {
    if (!lessonId) return;
    const sc = quizScore(next);
    getProgress().quiz(lessonId, { ...sc, done });
    if (done) getProgress().complete(lessonId);
  };

  const answer = (i: number, picked: readonly number[]) => {
    const q = questions[i];
    const correct = judgeQuiz(q, picked);
    const next = answerQuestion(s, i, picked, correct);
    setS(next);
    save(next);
    const why = q.kind === 'choice' ? (picked.length === 1 ? q.options[picked[0]]?.why : correct ? q.options.find((_, k) => (q.correct as readonly number[]).includes(k))?.why : undefined) : correct ? q.whyRight : q.whyWrong;
    setLive(`${correct ? 'Right.' : 'Not quite.'} ${why ? richToPlain(why) : ''}`);
  };

  const goNext = () => {
    const next = nextQuestion(s);
    setS(next);
    if (next.done) {
      save(next, true);
      focusAfter.current = 'summary';
    } else focusAfter.current = 'question';
    setLive('');
  };

  const retry = (i: number) => {
    setS(retryQuestion(s, i));
    const q = questions[i];
    setPending((p) => p.map((x, k) => (k === i ? (q.kind === 'drag' ? startArrangement(q.target) : []) : x)));
    setLive('');
    focusAfter.current = 'question';
  };

  const restart = () => {
    setS(quizStart(questions.length));
    setPending(questions.map((q) => (q.kind === 'drag' ? startArrangement(q.target) : [])));
    setLive('');
    focusAfter.current = 'question';
  };

  if (questions.length === 0) return null;
  const cur = s.current;
  const rec = s.records[cur];
  const score = quizScore(s);
  const lastToAnswer = !s.records.some((r, k) => !r && k !== cur);

  return (
    <article class="card quiz" ref={root} aria-labelledby={`${uid}-title`}>
      <div class="quiz__top">
        <p class="label quiz__title" id={`${uid}-title`}>
          {title}
        </p>
        <ol class="quiz__dots" aria-label="Progress through the questions">
          {questions.map((q, k) => {
            const r = s.records[k];
            return (
              <li
                key={q.id}
                class={r ? (r.firstCorrect ? 'is-correct' : 'is-wrong') : undefined}
                aria-current={!s.done && k === cur ? 'step' : undefined}
                aria-label={`Question ${k + 1}: ${r ? (r.firstCorrect ? 'right' : 'missed') : 'not answered'}`}
              />
            );
          })}
        </ol>
        <span class="quiz__count">{s.done ? `${score.correct} of ${score.total} right` : `Question ${cur + 1} of ${questions.length}`}</span>
      </div>
      {questions.map((q, k) => (
        <fieldset key={q.id} class="quiz__set" data-quiz-question={q.id} hidden={s.done || k !== cur}>
          <legend class="quiz__q">
            <RichText inline text={q.prompt} />
          </legend>
          {q.figure && figures?.[q.figure] && <div class="quiz__figure">{figures[q.figure]()}</div>}
          {q.kind === 'choice' ? (
            <ChoiceQuestion q={q} rec={s.records[k]} pending={pending[k]} onPending={(p) => setPending((all) => all.map((x, j) => (j === k ? p : x)))} onAnswer={(p) => answer(k, p)} />
          ) : (
            <DragQuestion
              q={q}
              rec={s.records[k]}
              arrangement={pending[k]}
              onArrangement={(p) => setPending((all) => all.map((x, j) => (j === k ? p : x)))}
              onCheck={() => answer(k, pending[k])}
              idBase={`${uid}-${k}`}
            />
          )}
        </fieldset>
      ))}
      <p class="sr-only" aria-live="polite">
        {live}
      </p>
      {s.done ? (
        <Summary questions={questions} s={s} onReview={(i) => {
          setS(goToQuestion(s, i));
          focusAfter.current = 'question';
        }} onRestart={restart} />
      ) : (
        <div class="card__foot">
          {rec?.shown && !rec.correct && (
            <button type="button" class="btn" onClick={() => retry(cur)}>
              <IconRefresh /> Try again
            </button>
          )}
          <button type="button" class={`btn${rec ? ' btn--primary' : ''}`} disabled={!rec} onClick={goNext}>
            {rec && lastToAnswer ? 'See your score' : 'Next question'}
          </button>
        </div>
      )}
    </article>
  );
}

function ChoiceQuestion({
  q,
  rec,
  pending,
  onPending,
  onAnswer,
}: {
  q: ChoiceQ;
  rec: QuizState['records'][number];
  pending: readonly number[];
  onPending: (p: number[]) => void;
  onAnswer: (p: readonly number[]) => void;
}) {
  const multi = isMulti(q);
  const shown = !!rec?.shown;
  const picked = shown ? rec!.picked : multi ? pending : [];
  const correct = typeof q.correct === 'number' ? [q.correct] : [...q.correct];
  const box = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const btns = [...(box.current?.querySelectorAll<HTMLButtonElement>('.choice__btn') ?? [])];
    const at = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    btns[(at + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
  };
  return (
    <>
      {multi && <p class="answer-row__help choices__help">Choose every option that is true, then check.</p>}
      <div class="quiz__options" ref={box} onKeyDown={onKeyDown}>
        {q.options.map((o, k) => {
          const isPicked = picked.includes(k);
          let st: 'correct' | 'wrong' | 'missed' | null = null;
          if (shown) {
            if (isPicked) st = correct.includes(k) ? 'correct' : 'wrong';
            else if (multi && correct.includes(k) && !rec!.correct) st = 'missed';
          }
          return (
            <div key={k} class={`choice${st === 'correct' ? ' is-correct' : st === 'wrong' ? ' is-wrong' : st === 'missed' ? ' is-answer' : ''}${!shown && isPicked ? ' is-picked' : ''}`}>
              <button
                type="button"
                class="choice__btn"
                aria-pressed={isPicked ? 'true' : 'false'}
                aria-disabled={shown ? 'true' : undefined}
                onClick={() => {
                  if (shown) return;
                  if (multi) onPending(isPicked ? pending.filter((x) => x !== k) : [...pending, k].sort((a, b) => a - b));
                  else onAnswer([k]);
                }}
              >
                <span class="choice__key" aria-hidden="true">
                  {optionLetter(k)}
                </span>
                <RichText inline text={o.text} />
                <span class="choice__mark">
                  {st === 'correct' ? <IconCheck /> : st === 'wrong' ? <IconCross /> : null}
                  {st && <span class="sr-only">{st === 'correct' ? 'right' : st === 'wrong' ? 'not right' : 'also true'}</span>}
                </span>
              </button>
              {st && (
                <div class="choice__why">
                  <p class="choice__verdict">{st === 'wrong' ? 'Not quite.' : st === 'missed' ? 'Also true.' : 'Right.'}</p>
                  <RichText text={o.why} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {multi && !shown && (
        <div class="answer-row answer-row--action">
          <button type="button" class="btn btn--primary" disabled={pending.length === 0} onClick={() => onAnswer(pending)}>
            Check
          </button>
        </div>
      )}
      {multi && shown && (
        <p class={`feedback feedback--${rec!.correct ? 'correct' : 'wrong'}`}>
          {rec!.correct ? <IconCheck /> : <IconCross />}
          <span>{rec!.correct ? 'Right: exactly those.' : 'Not quite: compare the options marked above.'}</span>
        </p>
      )}
    </>
  );
}

function DragQuestion({
  q,
  rec,
  arrangement,
  onArrangement,
  onCheck,
  idBase,
}: {
  q: DragQ;
  rec: QuizState['records'][number];
  arrangement: readonly number[];
  onArrangement: (a: number[]) => void;
  onCheck: () => void;
  idBase: string;
}) {
  const shown = !!rec?.shown;
  const state = shown ? rec!.picked : arrangement;
  const t = q.target;
  const marks = shown ? (t.mode === 'order' ? state.map((it, pos) => (it === t.correct[pos] ? 'correct' : 'wrong')) : state.map((sl, i) => (sl === t.correct[i] ? 'correct' : 'wrong'))) : undefined;
  const incomplete = t.mode === 'match' && arrangement.some((x) => x < 0);
  return (
    <>
      {t.mode === 'order' ? (
        <OrderInput items={t.items} order={state} onOrder={onArrangement} idBase={idBase} disabled={shown} marks={marks as ('correct' | 'wrong')[] | undefined} />
      ) : (
        <MatchInput target={t} slots={state} onSlots={onArrangement} idBase={idBase} disabled={shown} marks={marks as ('correct' | 'wrong')[] | undefined} />
      )}
      {!shown ? (
        <div class="answer-row answer-row--action">
          <button type="button" class="btn btn--primary" disabled={incomplete} onClick={onCheck}>
            Check
          </button>
          {incomplete && <span class="answer-row__help">Place every item first.</span>}
        </div>
      ) : (
        <div class={`quiz__drag-why ${rec!.correct ? 'is-correct' : 'is-wrong'}`}>
          <p class={`feedback feedback--${rec!.correct ? 'correct' : 'wrong'}`}>
            {rec!.correct ? <IconCheck /> : <IconCross />}
            <span>{rec!.correct ? 'Right.' : 'Not quite.'}</span>
          </p>
          <RichText text={rec!.correct ? q.whyRight : q.whyWrong} />
        </div>
      )}
    </>
  );
}

function Summary({ questions, s, onReview, onRestart }: { questions: QuizSpec; s: QuizState; onReview: (i: number) => void; onRestart: () => void }) {
  const sc = quizScore(s);
  const misses = quizMisses(s);
  return (
    <div class="quiz__summary" tabIndex={-1}>
      <p class="quiz__score">
        <span class="quiz__score-n">
          {sc.correct} of {sc.total}
        </span>{' '}
        right on the first try.
      </p>
      {misses.length === 0 ? (
        <p class="quiz__praise">
          <IconCheck /> Every one. You have this.
        </p>
      ) : (
        <>
          <p class="label">Review your misses</p>
          <ul class="quiz__misses">
            {misses.map((i) => (
              <li key={i}>
                <button type="button" class="btn btn--quiet quiz__miss" onClick={() => onReview(i)}>
                  <span class="quiz__miss-n">Question {i + 1}</span>
                  <RichText inline text={questions[i].prompt} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div class="card__foot">
        <button type="button" class="btn" onClick={onRestart}>
          <IconRefresh /> Start again
        </button>
      </div>
    </div>
  );
}
