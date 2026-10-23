/**
 * One practice problem (README §8.2, DESIGN.md §8): statement → answer input
 * for its kind → Check → feedback (✓ / × / ⚠ with words) → the common-wrong
 * note when the answer matches one → the hint ladder (① Nudge ② Strategy
 * ③ First step, each unlocking the next) → the full solution (after a right
 * answer, or Show solution = giving up, which asks once) → Another one.
 *
 *   <Problem spec={PROBLEMS[3]} n={4} total={8} figure={FIGURES.problems?.['gd-step']} />
 *   <Problem spec={q.spec} instance={q.instance} lessonId={q.lessonId} mode="exam" response={answers[3]} />
 *   <Problem spec={q.spec} instance={q.instance} lessonId={q.lessonId} mode="review" response={answers[3]} verdict={v} />
 *
 * The input model is pure (draft.ts); this component renders it and writes
 * progress (attempt, hint, reveal) under its own lesson id.
 */
import { signal, type Signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { runSandboxed, Slider } from '../controls';
import { checkAnswer } from '../core/answers';
import { useKit } from '../core/context';
import { domId, problemKey, type ExamResponse } from '../core/exam';
import type { ProblemCustom, ProblemFigure } from '../core/figures';
import { IconCheck, IconPlay, IconRefresh } from '../core/icons';
import { drawProblem } from '../core/problems';
import { getProgress } from '../core/progress';
import { randomSeed } from '../core/rng';
import { RichText } from '../core/RichText';
import { formatSliderValue } from '../core/slider-scale';
import { announce } from '../util';
import type { CodeAnswer, CustomTarget, ProblemInstance, ProblemProgress, ProblemSpec, SliderTarget, Verdict } from '../types';
import { runVerdict, testLines, testsRan, type TestLine } from './code-results';
import {
  choiceOrder,
  countsAsAttempt,
  draftFromResponse,
  draftToCheck,
  draftToResponse,
  initialDraft,
  kindLabel,
  metaLine,
  nextInstance,
  optionLetter,
  wrongNoteTitle,
  type Draft,
  type DraftUpdate,
} from './draft';
import { ChoiceInput } from './inputs/ChoiceInput';
import { CodeEditor, TestResults } from './inputs/CodeInput';
import { MatchInput } from './inputs/MatchInput';
import { OrderInput } from './inputs/OrderInput';
import { PointInput } from './inputs/PointInput';
import { ProofInput } from './inputs/ProofInput';
import { TextAnswer } from './inputs/TextAnswer';
import { AnswerBox, Sanity, StepItem, Stars, VerdictText, WrongNote, toneOf } from './parts';
import { useSyncSignalEffect } from './hooks';

export interface ProblemProps {
  spec: ProblemSpec;
  /** "Problem 4 · numeric · 4 of 8". */
  n?: number;
  total?: number;
  /** (instance) => …: rendered above the input and again in the solution. In a set: figures[spec.figure]. */
  figure?: ProblemFigure;
  /** (state, instance) => … for drag mode 'custom'. In a set: customs[spec.figure]. */
  custom?: ProblemCustom;
  /**
   * Progress key; default useKit().lessonId. Passing it also namespaces the DOM
   * key (`problemKey(lessonId, id)`), as pages that mix lessons need.
   */
  lessonId?: string;
  /** A pre-drawn instance (ExamSet's paper); default drawProblem(spec, 0). */
  instance?: ProblemInstance;
  /** Default 'practice'. */
  mode?: 'practice' | 'exam' | 'review';
  /** Exam: the answer as it stands, written on every edit. Review: the answer to show. */
  response?: Signal<ExamResponse>;
  /** Review: the scored verdict. */
  verdict?: Verdict;
  onSolved?: (instance: ProblemInstance) => void;
  /** Set-internal: a non-current problem in a paged set (the article stays in the DOM). */
  hidden?: boolean;
  /** Set-internal: render only the head and prompt until first shown (README §1.10). */
  dormant?: boolean;
}

const HINTS = ['Nudge', 'Strategy', 'First step'] as const;

/** One problem's progress record; re-renders only when that record changes. */
export function useProblemProgress(lessonId: string | undefined, problemId: string): ProblemProgress | undefined {
  const store = getProgress();
  const read = () => (lessonId ? store.read().lessons[lessonId]?.problems[problemId] : undefined);
  const [p, setP] = useState(read);
  useEffect(() => {
    setP(read());
    return store.subscribe((d) => {
      const next = lessonId ? d.lessons[lessonId]?.problems[problemId] : undefined;
      setP((prev) => (prev === next ? prev : next));
    });
  }, [lessonId, problemId]);
  return p;
}

export function Problem(props: ProblemProps) {
  const { spec, n, total, figure, custom, mode = 'practice', response, verdict: givenVerdict, onSolved, hidden, dormant } = props;
  const kit = useKit();
  const lessonId = props.lessonId ?? kit.lessonId;
  const key = props.lessonId ? problemKey(props.lessonId, spec.id) : spec.id;
  const dom = `p-${domId(key)}`;
  const practice = mode === 'practice';
  const review = mode === 'review';
  const exam = mode === 'exam';

  const [inst, setInst] = useState<ProblemInstance>(() => props.instance ?? drawProblem(spec, 0));
  const [round, setRound] = useState(0); // bumps on "Another one": remounts the inputs
  const [draft, setDraftState] = useState<Draft>(() => (response ? draftFromResponse(inst.answer, response.peek()) : initialDraft(inst.answer)));
  const draftRef = useRef(draft);
  const setDraft = (d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const [shown, setShown] = useState<Verdict | null>(null);
  const [tests, setTests] = useState<{ lines: TestLine[] | null; logs: string[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [unlocked, setUnlocked] = useState(0);
  const [open, setOpen] = useState<readonly boolean[]>([false, false, false]);
  const [sol, setSol] = useState<'hidden' | 'confirm' | 'shown'>(review ? 'shown' : 'hidden');
  const [noMore, setNoMore] = useState(false);
  const asked = useRef(false);
  const runToken = useRef(0);
  const alive = useRef(true);
  const focusAfter = useRef<'prompt' | 'solution' | 'confirm' | 'ask' | 'reason' | null>(null);
  const root = useRef<HTMLElement>(null);
  const pp = useProblemProgress(lessonId, spec.id);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const el = root.current;
    const target =
      f === 'prompt'
        ? el?.querySelector<HTMLElement>('.problem__prompt')
        : f === 'solution'
          ? el?.querySelector<HTMLElement>('.solution')
          : f === 'confirm'
            ? el?.querySelector<HTMLElement>('.reveal-confirm .btn--primary')
            : f === 'reason'
              ? el?.querySelector<HTMLElement>('.field--reason')
              : el?.querySelector<HTMLElement>('.problem__show');
    if (target && target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target?.focus();
  });

  // Exam: the external response may be replaced (a new paper reuses the component only through a new key; this keeps them in step anyway).
  const verdict = review ? (givenVerdict ?? null) : shown;
  const a = inst.answer;
  const order = useMemo(() => (a.kind === 'choice' ? choiceOrder(a, `${key}#${inst.seed}`) : []), [a, key, inst.seed]);
  const letters = useMemo(() => {
    const out: string[] = [];
    order.forEach((orig, pos) => (out[orig] = optionLetter(pos)));
    return out;
  }, [order]);
  const missingCustom = a.kind === 'drag' && a.target.mode === 'custom' && !custom;
  useEffect(() => {
    if (missingCustom && !dormant) console.error(`Problem "${spec.id}": drag mode 'custom' needs a \`custom\` renderer (FIGURES.customs["${spec.figure ?? '?'}"]).`);
  }, [missingCustom, dormant]);

  const edit = (u: DraftUpdate) => {
    const d = typeof u === 'function' ? u(draftRef.current) : u;
    if (d === draftRef.current) return;
    setDraft(d);
    if (exam && response) response.value = draftToResponse(a, d);
    if (practice && shown && a.kind !== 'code') setShown(null);
  };

  const record = (v: Verdict, counts: boolean) => {
    setShown(v);
    if (counts && lessonId) getProgress().attempt(lessonId, spec.id, v.correct);
    if (v.correct) {
      setSol('shown');
      onSolved?.(inst);
    }
  };

  const runTests = async () => {
    const cur = draftRef.current;
    if (running || a.kind !== 'code' || cur.kind !== 'code') return;
    const code = a as CodeAnswer;
    const token = ++runToken.current;
    setRunning(true);
    const r = await runSandboxed({ code: cur.source, tests: { entry: code.entry, tests: code.tests }, timeoutMs: code.timeoutMs ?? 2000 });
    if (!alive.current || token !== runToken.current) return;
    setRunning(false);
    setTests({ lines: r.report ? testLines(r.report, code.entry) : null, logs: r.report?.logs ?? r.logs ?? [] });
    record(runVerdict(r), testsRan(r));
  };

  const check = () => {
    if (!practice) return;
    if (a.kind === 'code') {
      void runTests();
      return;
    }
    const draft = draftRef.current;
    if (a.kind === 'choice' && a.askReason && draft.kind === 'choice' && draft.selected.length > 0 && !draft.reason.trim()) {
      setShown({ correct: false, reason: 'empty', message: 'Add a one-line reason first: why that option?' });
      focusAfter.current = 'reason';
      return;
    }
    const r = draftToCheck(a, draft);
    if (!r) return;
    const v = checkAnswer(a, r, inst.commonWrong);
    record(v, countsAsAttempt(v, a.kind));
  };

  const onSubmit = (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    check();
  };

  const openHint = (level: number) => {
    if (level > unlocked + 1) return;
    if (level > unlocked) {
      setUnlocked(level);
      if (lessonId) getProgress().hint(lessonId, spec.id, level);
    }
    setOpen((o) => o.map((x, k) => (k === level - 1 ? !x : x)));
  };

  const solved = !!pp?.solved;
  const askSolution = () => {
    if (sol === 'shown') {
      setSol('hidden');
      return;
    }
    if (solved || asked.current || pp?.revealed) {
      setSol('shown');
      focusAfter.current = 'solution';
      return;
    }
    setSol('confirm');
    focusAfter.current = 'confirm';
  };
  const confirmReveal = () => {
    asked.current = true;
    setSol('shown');
    focusAfter.current = 'solution';
    if (lessonId) getProgress().reveal(lessonId, spec.id);
  };

  const another = () => {
    const next = nextInstance(spec, inst, randomSeed);
    if (!next) {
      setNoMore(true);
      return;
    }
    runToken.current++;
    setInst(next);
    setRound((r) => r + 1);
    setDraft(initialDraft(next.answer));
    setShown(null);
    setTests(null);
    setRunning(false);
    setUnlocked(0);
    setOpen([false, false, false]);
    setSol('hidden');
    setNoMore(false);
    asked.current = false;
    focusAfter.current = 'prompt';
    announce('A new version of this problem.');
  };

  const fbId = `${dom}-fb`;
  const solId = `${dom}-solution`;
  const tone = verdict ? toneOf(verdict, a.kind) : null;
  const status = tone === 'correct' ? 'correct' : tone === 'wrong' ? 'wrong' : null;
  const cwIndex = verdict && !verdict.correct ? verdict.commonWrong : undefined;
  const cw = cwIndex !== undefined ? inst.commonWrong[cwIndex] : undefined;
  const several = inst.commonWrong.length > 1;
  const proofReady = a.kind !== 'proof' || (draft.kind === 'proof' && draft.compared);

  const checkButton = practice && proofReady && !missingCustom && (
    <button type="submit" class="btn btn--primary problem__check" disabled={running}>
      {a.kind === 'code' ? (
        <>
          <IconPlay /> {running ? 'Running…' : 'Run tests'}
        </>
      ) : a.kind === 'proof' ? (
        'Check my answer'
      ) : (
        'Check'
      )}
    </button>
  );

  const head = (
    <div class="card__head">
      <p class="label" id={`${dom}-label`}>
        Problem{n ? ` ${n}` : ''}
        <span class="label__sep">·</span>
        {kindLabel(a)}
      </p>
      {inst.title && <span class="problem__title">{inst.title}</span>}
      <Stars level={inst.difficulty} />
      {n && total ? <span class="card__meta">{`${n} of ${total}`}</span> : null}
    </div>
  );

  if (dormant) {
    return (
      <article class="card problem" data-problem={key} id={dom} aria-labelledby={`${dom}-label`} hidden={hidden}>
        {head}
        <RichText class="lead problem__prompt" text={inst.prompt} />
      </article>
    );
  }

  const inputKey = `${inst.seed}:${round}`;
  let input: ComponentChildren;
  switch (a.kind) {
    case 'numeric':
    case 'symbolic':
      input = <TextAnswer key={inputKey} answer={a} draft={draft} onDraft={edit} idBase={dom} disabled={review} status={status} action={checkButton} feedbackId={fbId} preview={!review} checked={!!verdict} />;
      break;
    case 'choice':
      input = draft.kind === 'choice' && <ChoiceInput key={inputKey} answer={a} draft={draft} onDraft={edit} idBase={dom} order={order} verdict={verdict} review={review} disabled={review} feedbackId={fbId} />;
      break;
    case 'drag': {
      const t = a.target;
      if (draft.kind !== 'drag') break;
      if (t.mode === 'point') input = <PointInput key={inputKey} target={t} draft={draft} onDraft={edit} disabled={review} correct={status === 'correct'} />;
      else if (t.mode === 'order')
        input = <OrderInput key={inputKey} items={t.items} order={draft.state as number[]} onOrder={(o) => edit({ kind: 'drag', state: o, touched: true })} idBase={dom} disabled={review} />;
      else if (t.mode === 'match')
        input = <MatchInput key={inputKey} target={t} slots={draft.state as number[]} onSlots={(s) => edit({ kind: 'drag', state: s, touched: true })} idBase={dom} disabled={review} />;
      else if (t.mode === 'slider') input = <SliderTargetInput key={inputKey} target={t} draft={draft} onDraft={edit} disabled={review} idBase={dom} />;
      else if (custom) input = <CustomInput key={inputKey} target={t} custom={custom} inst={inst} draft={draft} onDraft={edit} disabled={review} />;
      else input = <p class="problem__missing">This problem’s visual is missing, so it can’t be answered here.</p>;
      break;
    }
    case 'proof':
      input = draft.kind === 'proof' && <ProofInput key={inputKey} answer={a} draft={draft} onDraft={edit} idBase={dom} disabled={review} examMode={exam} />;
      break;
    case 'code':
      input = draft.kind === 'code' && (
        <CodeEditor
          key={inputKey}
          value={draft.source}
          onChange={review ? undefined : (s) => edit({ kind: 'code', source: s })}
          readOnly={review}
          label="Your code"
          idBase={dom}
          starter={a.starter}
          onRun={practice ? () => void runTests() : undefined}
        />
      );
      break;
  }

  const typed = a.kind === 'numeric' || a.kind === 'symbolic';
  return (
    <article ref={root} class={`card problem${review ? ' problem--review' : ''}${exam ? ' problem--exam' : ''}`} data-problem={key} id={dom} aria-labelledby={`${dom}-label`} hidden={hidden}>
      {head}
      <RichText class="lead problem__prompt" text={inst.prompt} id={`${dom}-prompt`} />
      {figure && <div class="problem__figure">{figure(inst)}</div>}
      <form class="problem__form" onSubmit={onSubmit} aria-label={review ? 'Your answer' : 'Answer'} noValidate>
        {review && <p class="label problem__yours">Your answer{givenVerdict?.reason === 'empty' ? ': not answered' : ''}</p>}
        {input}
        {!typed && checkButton && <div class="answer-row answer-row--action">{checkButton}</div>}
        {a.kind === 'code' && tests?.lines && <TestResults lines={tests.lines} logs={tests.logs} />}
        {a.kind === 'code' && tests && !tests.lines && tests.logs.length > 0 && <TestResults lines={[]} logs={tests.logs} />}
        {!exam && (
          <p id={fbId} class={`feedback${tone ? ` feedback--${tone}` : ''}`} aria-live="polite">
            {verdict && <VerdictText verdict={verdict} kind={a.kind} />}
          </p>
        )}
      </form>
      {cw && <WrongNote title={wrongNoteTitle(a, cw, several, letters)} why={cw.why} />}
      {practice && (
        <div class="hints">
          <div class="seg" role="group" aria-label="Hints">
            {HINTS.map((name, k) => (
              <button
                key={name}
                type="button"
                class={`seg__btn${open[k] ? ' is-open' : ''}`}
                aria-expanded={open[k] ? 'true' : 'false'}
                aria-controls={open[k] ? `${dom}-hint-${k + 1}` : undefined}
                disabled={k > unlocked}
                onClick={() => openHint(k + 1)}
              >
                <span class="seg__n" aria-hidden="true">
                  {k + 1}
                </span>
                {name}
                {k > unlocked && <span class="sr-only"> (open the {HINTS[k - 1].toLowerCase()} first)</span>}
              </button>
            ))}
          </div>
          {inst.hints.map(
            (h, k) =>
              open[k] && (
                <div class="hint" id={`${dom}-hint-${k + 1}`} key={k}>
                  <p class="label hint__label">
                    Hint {k + 1}
                    <span class="label__sep">·</span>
                    {HINTS[k].toLowerCase()}
                  </p>
                  <RichText text={h} />
                </div>
              ),
          )}
        </div>
      )}
      {sol === 'shown' && <SolutionBlock inst={inst} figure={figure} except={cwIndex} letters={letters} id={solId} idBase={dom} />}
      {practice && (
        <div class="card__foot">
          {sol === 'confirm' ? (
            <div class="reveal-confirm" role="group" aria-labelledby={`${dom}-confirm`}>
              <span class="reveal-confirm__text" id={`${dom}-confirm`}>
                Show the full solution? It counts as giving up on this one.
              </span>
              <button type="button" class="btn btn--primary btn--sm" data-hit onClick={confirmReveal}>
                Show it
              </button>
              <button
                type="button"
                class="btn btn--quiet btn--sm"
                data-hit
                onClick={() => {
                  setSol('hidden');
                  focusAfter.current = 'ask';
                }}
              >
                Keep trying
              </button>
            </div>
          ) : (
            <button type="button" class="btn problem__show" aria-expanded={sol === 'shown' ? 'true' : 'false'} aria-controls={sol === 'shown' ? solId : undefined} onClick={askSolution}>
              {sol === 'shown' ? 'Hide solution' : 'Show solution'}
            </button>
          )}
          {spec.generate && sol !== 'confirm' && (
            <button type="button" class="btn btn--quiet problem__another" onClick={another}>
              <IconRefresh /> Another one
            </button>
          )}
          {noMore && <span class="problem__meta">No other version turned up; try again.</span>}
          {solved && (
            <span class="badge badge--correct problem__solved">
              <IconCheck /> {pp && (pp.hintsUsed > 0 || pp.revealed) ? 'Solved with help' : 'Solved'}
            </span>
          )}
          <span class="problem__meta">{metaLine(pp)}</span>
        </div>
      )}
    </article>
  );
}

/** The full worked solution: steps, boxed answer, check, the figure again, and every common-wrong note (bar the one already shown). */
function SolutionBlock({ inst, figure, except, letters, id, idBase }: { inst: ProblemInstance; figure?: ProblemFigure; except?: number; letters: readonly string[]; id: string; idBase: string }) {
  const s = inst.solution;
  const a = inst.answer;
  const several = inst.commonWrong.length > 1;
  return (
    <div class="solution" id={id} tabIndex={-1} aria-labelledby={`${id}-label`}>
      <p class="label solution__label" id={`${id}-label`}>
        Solution
      </p>
      {figure && <div class="problem__figure problem__figure--solution">{figure(inst)}</div>}
      <ol class="steps">
        {s.steps.map((st, k) => (
          <StepItem key={k} step={st} />
        ))}
      </ol>
      <AnswerBox answer={s.answer} />
      {s.check && <Sanity text={s.check} label="Check" />}
      {a.kind === 'choice' && a.reasoning && (
        <div class="solution__extra">
          <p class="label">Reasoning</p>
          <RichText text={a.reasoning} />
        </div>
      )}
      {a.kind === 'code' && <CodeEditor value={a.solution} readOnly label="Reference solution" idBase={`${idBase}-ref`} />}
      {inst.commonWrong.map((w, k) => (k === except ? null : <WrongNote key={k} title={wrongNoteTitle(a, w, several, letters)} why={w.why} />))}
    </div>
  );
}

/** Drag mode 'slider': G4's Slider over the target's range. */
function SliderTargetInput({ target, draft, onDraft, disabled, idBase }: { target: SliderTarget; draft: Extract<Draft, { kind: 'drag' }>; onDraft: (u: DraftUpdate) => void; disabled?: boolean; idBase: string }) {
  const sig = useMemo(() => signal<number>(draft.state as number), []);
  const first = useRef(true);
  const send = useRef(onDraft);
  send.current = onDraft;
  useSyncSignalEffect(() => {
    const v = sig.value;
    if (first.current) {
      first.current = false;
      return;
    }
    send.current({ kind: 'drag', state: v, touched: true });
  });
  const scale = { min: target.min, max: target.max, step: target.step };
  return (
    <div class="problem__slider">
      <Slider
        id={`${idBase}-slider`}
        value={sig}
        min={target.min}
        max={target.max}
        step={target.step}
        label={target.label}
        disabled={disabled}
        format={(v) => `${formatSliderValue(v, scale)}${target.unit ? ` ${target.unit}` : ''}`}
      />
    </div>
  );
}

/** Drag mode 'custom': the lesson's own visual holds the state in a signal; `describe` says it in words. */
function CustomInput({
  target,
  custom,
  inst,
  draft,
  onDraft,
  disabled,
}: {
  target: CustomTarget;
  custom: ProblemCustom;
  inst: ProblemInstance;
  draft: Extract<Draft, { kind: 'drag' }>;
  onDraft: (u: DraftUpdate) => void;
  disabled?: boolean;
}) {
  const sig = useMemo(() => signal<unknown>(draft.state), []);
  const first = useRef(true);
  const send = useRef(onDraft);
  send.current = onDraft;
  useSyncSignalEffect(() => {
    const v = sig.value;
    if (first.current) {
      first.current = false;
      return;
    }
    send.current({ kind: 'drag', state: v, touched: true });
  });
  let said = '';
  try {
    said = target.describe?.(sig.value) ?? '';
  } catch {
    said = '';
  }
  return (
    <div class="problem__custom" inert={disabled}>
      {custom(sig, inst)}
      {said && (
        <p class="problem__describe" aria-live="polite">
          Your answer: {said}
        </p>
      )}
    </div>
  );
}
