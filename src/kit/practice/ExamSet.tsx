/**
 * The timed, mixed exam-style set (README §8.7): a start screen → a paper
 * drawn with a fresh seed (`drawExam`) → every question as `Problem
 * mode="exam"` under a sticky timer (`role="timer"`, announced at 5 and 1
 * minutes only) → Submit all (confirms if questions are unanswered;
 * auto-submits at 0:00) → code answers graded in the sandbox → `scoreExam`
 * → the score, a ✓/× strip and a walkthrough of `Problem mode="review"`.
 * "Try another paper" draws new generated instances.
 *
 *   <ExamSet subjectId="linalg" items={entries} count={8} />
 */
import { signal, type Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { runSandboxed } from '../controls';
import { KitProvider } from '../core/context';
import { domId, drawExam, scoreExam, type ExamOptions, type ExamQuestion, type ExamResponse, type ExamResult } from '../core/exam';
import type { PracticeEntry } from '../core/figures';
import { useProgress } from '../core/hooks';
import { IconCheck, IconCross, IconRefresh } from '../core/icons';
import { getProgress } from '../core/progress';
import { randomSeed } from '../core/rng';
import type { AnswerKind } from '../types';
import { runVerdict } from './code-results';
import { attemptsSummary, defaultMinutes, formatClock, formatDuration, isAnswered, timerAnnouncement } from './exam-state';
import { Problem } from './Problem';

export interface ExamSetProps {
  /** progress.exam key, e.g. 'linalg'. */
  subjectId: string;
  /** The pool: every shipped lesson's PROBLEMS in the subject (README §8.6). */
  items: readonly PracticeEntry[];
  /** Questions per paper; default 8. */
  count?: number;
  /** Time limit; default 3 × the number of questions. */
  minutes?: number;
  /** Difficulty shares; default { 1: 0.25, 2: 0.5, 3: 0.25 }. */
  mix?: ExamOptions['mix'];
  /** Kinds that can't be auto-scored; default ['proof']. */
  exclude?: readonly AnswerKind[];
  title?: string;
}

type Phase = 'start' | 'paper' | 'marking' | 'results';

interface Done {
  result: ExamResult;
  seconds: number;
  graded: Signal<ExamResponse>[];
}

const entryOf = (items: readonly PracticeEntry[], q: ExamQuestion): PracticeEntry | undefined => items.find((it) => it.lessonId === q.lessonId && it.spec.id === q.spec.id);

export function ExamSet({ subjectId, items, count = 8, minutes, mix, exclude, title = 'Exam-style set' }: ExamSetProps) {
  const [phase, setPhase] = useState<Phase>('start');
  const [paper, setPaper] = useState<ExamQuestion[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [responses, setResponses] = useState<Signal<ExamResponse>[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const [confirming, setConfirming] = useState<number[] | null>(null);
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const root = useRef<HTMLElement>(null);
  const focusAfter = useRef<string | null>(null);
  const data = useProgress();
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    const sel = focusAfter.current;
    if (!sel) return;
    focusAfter.current = null;
    const el = root.current?.querySelector<HTMLElement>(sel);
    if (el) {
      if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
      el.focus({ preventScroll: false });
    }
  });

  const pool = items.filter((it) => !(exclude ?? ['proof']).includes(it.spec.answer.kind));
  const perPaper = Math.min(count, pool.length);
  const limit = minutes ?? defaultMinutes(perPaper);
  const deadline = startedAt + limit * 60_000;

  const start = () => {
    const p = drawExam(items, { seed: randomSeed(), count, mix, exclude });
    setPaper(p);
    setResponses(p.map(() => signal<ExamResponse>(null)));
    setAttempt((a) => a + 1);
    setStartedAt(Date.now());
    setDone(null);
    setConfirming(null);
    setNotice('');
    setPhase('paper');
    focusAfter.current = '.exam__bar';
  };

  const submit = async (auto = false) => {
    if (phase !== 'paper') return;
    // peek: ExamSet never subscribes to the answers (typing in one question mustn't re-render the paper).
    const unanswered = responses.map((r, i) => (isAnswered(r.peek()) ? -1 : i)).filter((i) => i >= 0);
    if (!auto && unanswered.length > 0 && !confirming) {
      setConfirming(unanswered);
      focusAfter.current = '.exam__confirm .btn--primary';
      return;
    }
    setConfirming(null);
    setPhase('marking');
    if (auto) setNotice('Time is up: your paper has been submitted.');
    const raw = responses.map((r) => r.peek());
    const graded: ExamResponse[] = [];
    for (let i = 0; i < paper.length; i++) {
      const r = raw[i];
      const a = paper[i].instance.answer;
      if (r && r.kind === 'code' && r.source?.trim() && a.kind === 'code') {
        const out = await runSandboxed({ code: r.source, tests: { entry: a.entry, tests: a.tests }, timeoutMs: a.timeoutMs ?? 2000 });
        graded.push({ ...r, verdict: runVerdict(out) });
      } else graded.push(r);
      if (!alive.current) return;
    }
    const result = scoreExam(paper, graded);
    const seconds = Math.min(limit * 60, Math.round((Date.now() - startedAt) / 1000));
    const store = getProgress();
    store.exam(subjectId, { date: new Date().toISOString(), score: result.score, total: result.total, seconds });
    paper.forEach((q, i) => {
      if (isAnswered(graded[i])) store.attempt(q.lessonId, q.spec.id, result.verdicts[i].correct);
    });
    setDone({ result, seconds, graded: graded.map((g) => signal<ExamResponse>(g)) });
    setPhase('results');
    focusAfter.current = '.exam__results';
  };

  const summary = attemptsSummary(data.exams[subjectId]);

  return (
    <article class={`card exam is-${phase}`} data-exam={subjectId} ref={root} aria-labelledby={`exam-${domId(subjectId)}-label`}>
      <div class="card__head">
        <p class="label" id={`exam-${domId(subjectId)}-label`}>
          {title}
        </p>
        <span class="card__meta">{phase === 'start' ? `${perPaper} questions · ${limit} minutes` : phase === 'results' ? 'Marked' : `Paper ${attempt}`}</span>
      </div>
      <p class="sr-only" aria-live="polite">
        {notice}
      </p>

      {phase === 'start' && (
        <div class="exam__start">
          {perPaper === 0 ? (
            <p class="pset__note">No problems to set yet: this subject’s lessons haven’t shipped.</p>
          ) : (
            <>
              <ul class="exam__facts">
                <li>
                  <span class="exam__fact-n">{perPaper}</span> questions, mixed across the subject’s lessons
                </li>
                <li>
                  <span class="exam__fact-n">{limit}</span> minutes on the clock
                </li>
                <li>No hints and no feedback until you submit; then a full walkthrough</li>
                <li>Generated questions change with every attempt</li>
              </ul>
              {summary.count > 0 && summary.best && summary.last && (
                <p class="exam__history">
                  {`Your best: ${summary.best.score} of ${summary.best.total} · last: ${summary.last.score} of ${summary.last.total} in ${formatDuration(summary.last.seconds)} · ${summary.count} attempt${summary.count === 1 ? '' : 's'}`}
                </p>
              )}
            </>
          )}
          <div class="card__foot">
            <button type="button" class="btn btn--primary" disabled={perPaper === 0} onClick={start}>
              Start the paper
            </button>
          </div>
        </div>
      )}

      {(phase === 'paper' || phase === 'marking') && (
        <div class="exam__paper">
          <ExamBar paper={paper} responses={responses} deadline={deadline} marking={phase === 'marking'} onSubmit={() => void submit()} onExpire={() => void submit(true)} />
          {confirming && (
            <div class="exam__confirm is-entering" role="group" aria-labelledby="exam-confirm-text">
              <p id="exam-confirm-text">
                {confirming.length === 1 ? `Question ${confirming[0] + 1} is unanswered.` : `${confirming.length} questions are unanswered: ${confirming.map((i) => i + 1).join(', ')}.`} Submit anyway?
              </p>
              <div class="btn-row">
                <button type="button" class="btn btn--primary" onClick={() => void submit()}>
                  Submit anyway
                </button>
                <button
                  type="button"
                  class="btn btn--quiet"
                  onClick={() => {
                    setConfirming(null);
                    focusAfter.current = '.exam__submit';
                  }}
                >
                  Keep working
                </button>
              </div>
            </div>
          )}
          <div class="exam__questions" inert={phase === 'marking'}>
            {paper.map((q, i) => {
              const e = entryOf(items, q);
              const fk = q.instance.figure;
              return (
                <KitProvider key={`${attempt}-${q.key}-${i}`} lessonId={q.lessonId} concepts={q.concepts}>
                  <Problem
                    spec={q.spec}
                    instance={q.instance}
                    lessonId={q.lessonId}
                    n={i + 1}
                    total={paper.length}
                    mode="exam"
                    response={responses[i]}
                    figure={fk ? e?.figures?.problems?.[fk] : undefined}
                    custom={fk ? e?.figures?.customs?.[fk] : undefined}
                  />
                </KitProvider>
              );
            })}
          </div>
          {phase === 'paper' && (
            <div class="card__foot exam__end">
              <button type="button" class="btn btn--primary" onClick={() => void submit()}>
                Submit all
              </button>
              <UnansweredNote responses={responses} />
            </div>
          )}
        </div>
      )}

      {phase === 'results' && done && (
        <div class="exam__results" tabIndex={-1}>
          <p class="exam__score">
            <span class="exam__score-n">{`${done.result.score} of ${done.result.total}`}</span>
            <span class="exam__score-time">{` in ${formatDuration(done.seconds)}`}</span>
          </p>
          <ol class="exam__strip" aria-label="Your answers, question by question">
            {done.result.verdicts.map((v, i) => (
              <li key={i}>
                <a href={`#p-${domId(paper[i].key)}`} class={`exam__mark ${v.correct ? 'is-correct' : 'is-wrong'}`} data-hit>
                  {v.correct ? <IconCheck /> : <IconCross />}
                  {i + 1}
                  <span class="sr-only">{v.correct ? ': right' : v.reason === 'empty' ? ': not answered' : ': not right'}</span>
                </a>
              </li>
            ))}
          </ol>
          <div class="card__foot">
            <button type="button" class="btn btn--primary" onClick={start}>
              <IconRefresh /> Try another paper
            </button>
            <span class="problem__meta">Walk through every question below: your answer, the verdict and the full solution.</span>
          </div>
          <p class="label exam__walk">Walkthrough</p>
          {paper.map((q, i) => {
            const e = entryOf(items, q);
            const fk = q.instance.figure;
            return (
              <KitProvider key={`r-${attempt}-${q.key}-${i}`} lessonId={q.lessonId} concepts={q.concepts}>
                <Problem
                  spec={q.spec}
                  instance={q.instance}
                  lessonId={q.lessonId}
                  n={i + 1}
                  total={paper.length}
                  mode="review"
                  response={done.graded[i]}
                  verdict={done.result.verdicts[i]}
                  figure={fk ? e?.figures?.problems?.[fk] : undefined}
                  custom={fk ? e?.figures?.customs?.[fk] : undefined}
                />
              </KitProvider>
            );
          })}
        </div>
      )}
    </article>
  );
}

/** The sticky bar: timer, answered count, jump links, Submit all. It (not ExamSet) subscribes to the answers. */
function ExamBar({ paper, responses, deadline, marking, onSubmit, onExpire }: { paper: readonly ExamQuestion[]; responses: readonly Signal<ExamResponse>[]; deadline: number; marking: boolean; onSubmit: () => void; onExpire: () => void }) {
  const answered = responses.map((r) => isAnswered(r.value));
  const n = answered.filter(Boolean).length;
  return (
    <div class="exam__bar" aria-label="Exam controls" role="group">
      {marking ? <span class="exam__timer">Marking…</span> : <ExamTimer deadline={deadline} onExpire={onExpire} />}
      <span class="exam__answered">{`${n} of ${paper.length} answered`}</span>
      <nav class="exam__jump" aria-label="Jump to a question">
        <ol>
          {paper.map((q, i) => (
            <li key={q.key + i}>
              <a href={`#p-${domId(q.key)}`} class={`exam__qlink${answered[i] ? ' is-answered' : ''}`} data-hit>
                {i + 1}
                <span class="sr-only">{answered[i] ? ', answered' : ', not answered'}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <button type="button" class="btn btn--primary btn--sm exam__submit" data-hit disabled={marking} onClick={onSubmit}>
        Submit all
      </button>
    </div>
  );
}

function UnansweredNote({ responses }: { responses: readonly Signal<ExamResponse>[] }) {
  const left = responses.filter((r) => !isAnswered(r.value)).length;
  return <span class="problem__meta">{left ? `${left} unanswered` : 'Every question answered'}</span>;
}

/** "12:30 left": ticks once a second from the deadline (so a throttled tab never drifts); speaks only at 5 and 1 minutes. */
function ExamTimer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const left = () => Math.max(0, (deadline - Date.now()) / 1000);
  const [secs, setSecs] = useState(left);
  const [said, setSaid] = useState('');
  const prev = useRef(secs);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    const id = setInterval(() => {
      const now = left();
      const a = timerAnnouncement(prev.current, now);
      if (a) setSaid(a);
      prev.current = now;
      setSecs(now);
      if (now <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        expire.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const low = secs <= 60;
  return (
    <>
      <span class={`exam__timer${low ? ' is-low' : ''}`} role="timer" aria-live="off" aria-atomic="true">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="9" r="5.5" />
          <path d="M8 6v3l2 1.5M6.5 2h3" />
        </svg>
        {`${formatClock(secs)} left`}
      </span>
      <span class="sr-only" aria-live="polite">
        {said}
      </span>
    </>
  );
}

