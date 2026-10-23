/**
 * Worked examples (README §8.1, DESIGN.md §8): statement → what we know /
 * what we want → strategy → steps revealed one at a time, each after a "try
 * the next step yourself" pause → the boxed answer → a sanity check.
 *
 *   <WorkedExampleSet examples={EXAMPLES} figures={FIGURES.examples} />     // ★ / ★★ / ★★★ tabs
 *   <WorkedExample spec={EXAMPLES[1]} n={2} figure={(p, set) => …} params={sharedParams} />
 *
 * Live parameters: a Slider per numeric parameter and a Segmented per choice
 * parameter, above the statement. Every change goes through the example's
 * `accept()` (example-state.ts): a rejected value is never shown, the control
 * that caused it snaps back on release, and the reason sits beside it. The
 * reveal state is a count that survives parameter changes.
 */
import { signal, useSignal, type Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Segmented, Slider } from '../controls';
import { useKit } from '../core/context';
import type { ExampleFigure, LessonFigures } from '../core/figures';
import { acceptParams, exampleDefaults, resolveExample } from '../core/problems';
import { getProgress } from '../core/progress';
import { RichText } from '../core/RichText';
import { richToPlain } from '../core/richtext';
import { formatSliderValue } from '../core/slider-scale';
import type { ChoiceParam, LiveParam, ParamValues, Rich, WorkedExampleSpec } from '../types';
import { choiceAvailability, clampReveal, levelInfo, nextTab, paramEntries, proposeParams, startValues, tabLabels } from './example-state';
import { AnswerBox, Sanity, StepItem } from './parts';
import { useSyncSignalEffect } from './hooks';

export interface WorkedExampleProps {
  spec: WorkedExampleSpec;
  /** "Worked example 2". */
  n?: number;
  /** Its own small interactive: (params, setParams) => …; setParams goes through accept(). */
  figure?: ExampleFigure;
  /** External live params (a figure elsewhere drives them); default internal. */
  params?: Signal<ParamValues>;
  /** Steps revealed at first (default 1; a number ≥ the step count shows the whole solution, e.g. for print). */
  start?: number;
}

export interface WorkedExampleSetProps {
  /** ★ direct · ★★ combined · ★★★ exam level. */
  examples: readonly WorkedExampleSpec[];
  /** FIGURES.examples, by spec.figure key. */
  figures?: LessonFigures['examples'];
}

const sameValues = (a: ParamValues, b: ParamValues): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
};

/** A standalone worked example: `article.card.example[data-worked-example]`. */
export function WorkedExample({ spec, n, figure, params, start }: WorkedExampleProps) {
  const uid = useId();
  const idBase = `we-${uid.replace(/[^A-Za-z0-9_-]/g, '')}`;
  useMissingFigure(spec, figure, 'WorkedExample');
  return (
    <article class="card example" data-worked-example={spec.id} aria-labelledby={`${idBase}-label`}>
      <ExampleBody spec={spec} n={n} figure={figure} params={params} mounted idBase={idBase} start={start} />
    </article>
  );
}

/** One `article.card.example` with difficulty tabs; every panel is in the DOM, inactive ones `hidden`. */
export function WorkedExampleSet({ examples, figures }: WorkedExampleSetProps) {
  const uid = useId();
  const base = `wes-${uid.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = useMemo(() => tabLabels(examples.map((e) => e.level)), [examples]);
  useEffect(() => {
    for (const ex of examples) if (ex.figure && !figures?.[ex.figure]) console.error(`WorkedExampleSet: no renderer for figure "${ex.figure}" (example "${ex.id}"); add it to FIGURES.examples in figures.tsx.`);
  }, [examples, figures]);

  const select = (i: number, focus = false) => {
    setActive(i);
    setMounted((m) => (m.has(i) ? m : new Set([...m, i])));
    if (focus) tabs.current[i]?.focus();
  };
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const i = nextTab(active, e.key, examples.length);
    if (i === null) return;
    e.preventDefault();
    select(i, true);
  };
  if (examples.length === 0) return null;
  return (
    <article class="card example example-set">
      <div class="ex-tabs" role="tablist" aria-label="Worked examples" onKeyDown={onKeyDown}>
        {examples.map((ex, i) => (
          <button
            key={ex.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            class="ex-tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === active ? 'true' : 'false'}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
          >
            <span class="stars" aria-hidden="true">
              {levelInfo(ex.level).stars}
            </span>
            {labels[i]}
          </button>
        ))}
      </div>
      {examples.map((ex, i) => (
        <div
          key={ex.id}
          role="tabpanel"
          class="example__panel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          data-worked-example={ex.id}
          hidden={i !== active}
          tabIndex={0}
        >
          <ExampleBody spec={ex} n={i + 1} total={examples.length} figure={ex.figure ? figures?.[ex.figure] : undefined} mounted={mounted.has(i)} idBase={`${base}-${i}`} />
        </div>
      ))}
    </article>
  );
}

function useMissingFigure(spec: WorkedExampleSpec, figure: ExampleFigure | undefined, who: string) {
  useEffect(() => {
    if (spec.figure && !figure) console.error(`${who}: example "${spec.id}" names figure "${spec.figure}" but no \`figure\` renderer was passed.`);
  }, [spec, figure]);
}

interface BodyProps {
  spec: WorkedExampleSpec;
  n?: number;
  total?: number;
  figure?: ExampleFigure;
  params?: Signal<ParamValues>;
  /** False for a tab panel never shown yet: only statement, known/want, strategy and step 1 render. */
  mounted: boolean;
  idBase: string;
  start?: number;
}

function ExampleBody({ spec, n, total, figure, params, mounted, idBase, start = 1 }: BodyProps) {
  const { lessonId } = useKit();
  const own = useMemo(() => signal<ParamValues>(startValues(spec, params?.peek())), []);
  const values = params ?? own;
  const lastGood = useRef<ParamValues>(startValues(spec, values.peek()));
  const externalWhy = useSignal<string | null>(null);

  // What to show: the values if accept() passes, else the last accepted ones (an external write it rejects is never shown).
  const raw = { ...exampleDefaults(spec), ...values.value };
  const okNow = acceptParams(spec, raw) === true;
  const shown = okNow ? raw : lastGood.current;
  if (okNow && !sameValues(shown, lastGood.current)) lastGood.current = shown;
  useEffect(() => {
    if (okNow) return;
    const why = acceptParams(spec, raw);
    externalWhy.value = typeof why === 'string' ? why : null;
    values.value = lastGood.current; // snap the outside writer back
  });

  const set = (patch: Partial<ParamValues>): string | null => {
    const p = proposeParams(spec, lastGood.current, patch);
    if (!p.accepted) return p.reason;
    if (!sameValues(p.values, values.peek())) values.value = p.values;
    externalWhy.value = null;
    return null;
  };
  const setFromFigure = (patch: Partial<ParamValues>) => {
    const why = set(patch);
    if (why) externalWhy.value = why;
  };

  const key = JSON.stringify(shown);
  const ex = useMemo(() => resolveExample(spec, shown), [spec, key]);
  const steps = ex.steps;
  const count = useSignal(Math.max(1, start));
  const revealed = clampReveal(count.value, steps.length);
  useEffect(() => {
    if (count.peek() > steps.length && steps.length > 0) count.value = steps.length;
  }, [steps.length]);
  const justRevealed = useRef<number | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    // Only after a reveal (never after a parameter change): the pause's button is gone, so focus the new step.
    const k = pendingFocus.current;
    pendingFocus.current = null;
    if (k !== null) stepRefs.current[k]?.focus();
  }, [revealed]);

  const reveal = () => {
    const next = clampReveal(revealed + 1, steps.length);
    justRevealed.current = next - 1;
    pendingFocus.current = next - 1;
    count.value = next;
    if (lessonId) getProgress().example(lessonId, spec.id, next, steps.length);
  };

  const entries = paramEntries(spec);
  const lvl = levelInfo(spec.level);
  const done = revealed >= steps.length;
  const visible = mounted ? steps.slice(0, revealed) : steps.slice(0, 1);
  const nextStep = mounted && !done ? steps[revealed] : undefined;

  return (
    <>
      <div class="card__head">
        <p class="label" id={`${idBase}-label`}>
          Worked example{n ? ` ${n}` : ''}
          <span class="label__sep">·</span>
          {lvl.short}
        </p>
        {spec.title && <span class="example__title">{spec.title}</span>}
        {total ? <span class="card__meta">{`${n ?? 1} of ${total}`}</span> : null}
      </div>
      {mounted && entries.length > 0 && (
        <div class="params" role="group" aria-label="Change the numbers">
          {entries.map((e) =>
            e.kind === 'number' ? (
              <ParamSlider key={e.name} name={e.name} p={e.p} values={values} set={set} idBase={idBase} />
            ) : (
              <ParamChoice key={e.name} name={e.name} p={e.p} spec={spec} shown={shown} values={values} set={set} />
            ),
          )}
          <p class="params__note">Change the numbers: every step and the answer recompute.</p>
        </div>
      )}
      <RichText class="lead example__statement" text={ex.statement} />
      {mounted && figure && (
        <div class="example__figure">
          {figure(shown, setFromFigure)}
        </div>
      )}
      {mounted && (
        <p class="param__why" aria-live="polite">
          {externalWhy.value}
        </p>
      )}
      <dl class="knowwant">
        <div>
          <dt class="label">What we know</dt>
          <dd>
            <RichList items={ex.known} />
          </dd>
        </div>
        <div>
          <dt class="label">What we want</dt>
          <dd>
            <RichList items={ex.want} />
          </dd>
        </div>
      </dl>
      <p class="strategy">
        <span class="runin">Strategy.</span> <RichText inline text={ex.strategy} />
      </p>
      <ol class="steps" aria-label="Solution steps">
        {visible.map((s, k) => (
          <StepItem key={k} step={s} entering={k > 0 && k === justRevealed.current} itemRef={(el) => {
              stepRefs.current[k] = el;
            }} />
        ))}
        {nextStep && (
          <li class="step step--pause">
            <div class="pause">
              <p class="pause__title">Try the next step yourself</p>
              {nextStep.tryIt && <RichText class="pause__prompt" text={nextStep.tryIt} />}
              <div class="btn-row">
                <button type="button" class="btn btn--primary" onClick={reveal}>
                  Reveal step {revealed + 1}
                </button>
                <button type="button" class="btn btn--quiet" onClick={reveal}>
                  I’ve done it, compare
                </button>
              </div>
            </div>
          </li>
        )}
      </ol>
      {mounted && <AnswerBox answer={ex.answer} hidden={!done} hint={`appears after step ${steps.length}`} />}
      {mounted && done && <Sanity text={ex.sanity} />}
    </>
  );
}

function RichList({ items }: { items: readonly Rich[] }) {
  if (items.length === 1) return <RichText inline text={items[0]} />;
  return (
    <ul class="knowwant__list">
      {items.map((t, k) => (
        <RichText key={k} as="li" inline text={t} />
      ))}
    </ul>
  );
}

/** A numeric parameter: its slider shows what the learner drags; the example only takes values accept() allows. */
function ParamSlider({ name, p, values, set, idBase }: { name: string; p: LiveParam; values: Signal<ParamValues>; set: (patch: Partial<ParamValues>) => string | null; idBase: string }) {
  const raw = useMemo(() => signal<number>(values.peek()[name] ?? p.value), []);
  const why = useSignal<string | null>(null);
  // The learner moved the slider: try it (a rejected value stays on the thumb until release, never in the example).
  useSyncSignalEffect(() => {
    const r = raw.value;
    if (Object.is(r, values.peek()[name])) return;
    const reason = set({ [name]: r });
    why.value = reason;
  });
  // The values changed elsewhere (a figure, another control): follow them.
  useSyncSignalEffect(() => {
    const v = values.value[name];
    if (v !== undefined && !Object.is(v, raw.peek())) raw.value = v;
  });
  const scale = { min: p.min, max: p.max, step: p.step, scale: p.scale };
  const format = p.unit ? (v: number) => `${formatSliderValue(v, scale)} ${p.unit}` : undefined;
  return (
    <div class="param">
      <Slider
        id={`${idBase}-${name}`}
        value={raw}
        min={p.min}
        max={p.max}
        step={p.step}
        scale={p.scale}
        label={p.label}
        concept={p.concept}
        detents={p.detents}
        format={format}
        onCommit={() => {
          const v = values.peek()[name];
          if (v !== undefined && !Object.is(raw.peek(), v)) raw.value = v; // snap back to the last accepted value
        }}
      />
      <p class="param__why" aria-live="polite">
        {why.value}
      </p>
    </div>
  );
}

/** A choice parameter: options accept() would reject with the other values as they are are disabled, with the reason. */
function ParamChoice({
  name,
  p,
  spec,
  shown,
  values,
  set,
}: {
  name: string;
  p: ChoiceParam;
  spec: WorkedExampleSpec;
  shown: ParamValues;
  values: Signal<ParamValues>;
  set: (patch: Partial<ParamValues>) => string | null;
}) {
  const sel = useMemo(() => signal<number>(values.peek()[name] ?? p.value), []);
  const why = useSignal<string | null>(null);
  useSyncSignalEffect(() => {
    const r = sel.value;
    if (Object.is(r, values.peek()[name])) return;
    const reason = set({ [name]: r });
    why.value = reason;
    if (reason) sel.value = values.peek()[name] ?? p.value;
  });
  useSyncSignalEffect(() => {
    const v = values.value[name];
    if (v !== undefined && !Object.is(v, sel.peek())) sel.value = v;
  });
  const avail = choiceAvailability(spec, shown, name);
  const blocked = avail.map((a, i) => (a === true ? null : { i, why: a })).filter((x): x is { i: number; why: string } => !!x);
  return (
    <div class="param param--choice">
      <span class="param__label" aria-hidden="true">
        <RichText inline text={p.label} />
      </span>
      <Segmented value={sel} label={richToPlain(p.label)} options={p.options.map((o, i) => ({ value: i, label: o, disabled: avail[i] !== true }))} />
      <p class="param__why" aria-live="polite">
        {why.value}
        {blocked.map((b) => (
          <span key={b.i} class="param__blocked">
            <RichText inline text={p.options[b.i]} />: {b.why}
          </span>
        ))}
      </p>
    </div>
  );
}
