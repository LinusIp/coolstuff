/**
 * The plate around any visual (DESIGN.md §5, README §4.3): stage(s) as
 * children, then a mono readout strip joined under them, then the "Try it"
 * mission and keyboard line, the legend and the caption. Text-width plates
 * float their caption into the margin at ≥ 1000px; wide plates (`wide`)
 * span text + margin with mission/keys beside legend/caption; phones go
 * full-bleed (layout.css).
 *
 *   <Figure name="eigen-play" central wide interactive
 *     caption="One matrix, the whole plane." description="An arrow v and its image Av …"
 *     readout={<><ReadoutPair concept="input" sym="$\vec v$" value={v} /> …</>}
 *     mission={{ goals: [{ text: 'Land $\\vec v$ on a line it keeps', done: found }] }}
 *     legend={[{ concept: 'input', label: 'input $\\vec v$' }]}>
 *     <MatrixGrid … />
 *   </Figure>
 */
import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import { isValidElement, toChildArray, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { IconCheck } from '../core/icons';
import { LineSwatch } from '../core/LineSwatch';
import { formatLive, isSignalLike, readLive, type LiveData, type LiveValue } from '../core/live';
import { RichText } from '../core/RichText';
import { richToPlain } from '../core/richtext';
import type { Hue, LineStyle } from '../theme';
import type { Rich } from '../types';
import { announce } from '../util/dom';

/** A value that may be fixed or a signal (read in render, so the component follows it). */
export type Reactive<T> = T | ReadonlySignal<T>;
const read = <T,>(v: Reactive<T> | undefined): T | undefined => (isSignalLike(v) ? (v as ReadonlySignal<T>).value : (v as T | undefined));

export interface LegendItem {
  /** Lesson or global concept: swatch in its ink and line style; the row lights it on hover and focus. */
  concept?: string;
  line?: LineStyle;
  hue?: Hue;
  label: Rich;
}

export interface MissionGoal {
  text: Rich;
  done: Reactive<boolean>;
}

export interface MissionProps {
  /** Default "Try it". */
  title?: string;
  goals: readonly MissionGoal[];
  /** One sentence naming the result in words; turns green with `correct`. */
  status?: Reactive<Rich>;
  correct?: Reactive<boolean>;
}

export interface FigureProps {
  /** `data-figure`; unique per page, kebab-case. Also the prefix of the caption and description ids. */
  name: string;
  caption: Rich;
  /** Longer plain-text description for screen readers (a visually hidden paragraph). */
  description: string;
  /** Default "Figure n", numbered in page order (figures inside problems, examples, quiz questions and traps get no number). */
  label?: string;
  /** Text + margin (912px) at ≥ 1000px. */
  wide?: boolean;
  /** The lesson's central interactive: `data-thumb` frames the 1200×750 thumbnail. */
  central?: boolean;
  /** The mono strip joined under the stage (`aria-live="polite"`). A `<Readout>` is used as is; anything else is wrapped in one. */
  readout?: ComponentChildren;
  /** Knobs for the figure (Slider, Segmented, Toggle…), set under the readout. */
  controls?: ComponentChildren;
  mission?: MissionProps;
  /** Keyboard help line; defaults to the standard handle text when `interactive`. */
  keys?: ComponentChildren;
  interactive?: boolean;
  legend?: readonly LegendItem[];
  class?: string;
  children: ComponentChildren;
}

/** Contexts whose figures are not numbered (they sit inside a card with its own label). */
const UNNUMBERED = '[data-problem], [data-worked-example], [data-quiz-question], [data-trap], [data-predict]';

/** Bumped whenever a Figure mounts or unmounts, so every figure re-reads its number in page order. */
const figureEpoch = signal(0);

function useFigureNumber(el: HTMLElement | null, enabled: boolean): number | null {
  const epoch = figureEpoch.value;
  const [n, setN] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !el || typeof document === 'undefined') return;
    if (el.closest(UNNUMBERED)) return setN(null);
    const all = [...document.querySelectorAll('figure.plate[data-figure]')].filter((f) => !f.closest(UNNUMBERED));
    const k = all.indexOf(el);
    setN(k >= 0 ? k + 1 : null);
  }, [el, epoch, enabled]);
  useLayoutEffect(() => {
    figureEpoch.value++;
    return () => {
      figureEpoch.value++;
    };
  }, []);
  return n;
}

/** The standard keyboard line under an interactive figure (DESIGN.md §5). */
export function DefaultKeys() {
  return (
    <>
      Keyboard: <kbd>Tab</kbd> to the ring, then <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> to move it; hold <kbd>Shift</kbd> for bigger steps.
    </>
  );
}

export function Figure(props: FigureProps) {
  const { name, caption, description, wide, central, readout, controls, mission, keys, interactive, legend, children } = props;
  const [el, setEl] = useState<HTMLElement | null>(null);
  const n = useFigureNumber(el, props.label === undefined);
  const label = props.label ?? (n !== null ? `Figure ${n}` : undefined);
  const capId = `${name}-cap`;
  const descId = `${name}-desc`;
  const keyLine = keys ?? (interactive ? <DefaultKeys /> : null);
  const cap = (
    <figcaption class="caption" id={capId}>
      {label && <span class="label caption__label">{label}</span>}
      <RichText inline text={caption} />
    </figcaption>
  );
  const hasBelow = !!(mission || keyLine || legend?.length || wide);
  const isReadout = isValidElement(readout) && readout.type === Readout;
  return (
    <figure
      ref={setEl}
      class={['plate', wide ? 'is-wide' : '', props.class].filter(Boolean).join(' ')}
      data-figure={name}
      data-thumb={central ? '' : undefined}
      aria-describedby={`${capId} ${descId}`}
    >
      {!wide && cap}
      {children}
      {readout !== undefined && readout !== null && (isReadout ? readout : <Readout>{readout}</Readout>)}
      {controls !== undefined && controls !== null && <div class="plate__controls">{controls}</div>}
      {hasBelow && (
        <div class="plate__below">
          {(mission || keyLine) && (
            <div class="plate__main">
              {mission && <Mission {...mission} />}
              {keyLine && <FigKeys>{keyLine}</FigKeys>}
            </div>
          )}
          {(legend?.length || wide) && (
            <div class="plate__side">
              {legend?.length ? <Legend items={legend} /> : null}
              {wide && cap}
            </div>
          )}
        </div>
      )}
      <p class="sr-only" id={descId}>
        {description}
      </p>
    </figure>
  );
}

export interface ReadoutProps {
  /** Status at the end of the strip ("turned 22.8°", "✓ not turned"); Rich text or JSX. */
  status?: ComponentChildren | ReadonlySignal<Rich>;
  /** Status in "correct" green with a ✓. */
  correct?: Reactive<boolean>;
  children?: ComponentChildren;
}

/** The mono strip of live numbers under a stage: `div.readout[aria-live=polite]`. */
export function Readout({ status, correct, children }: ReadoutProps) {
  const ok = !!read(correct);
  const st = isSignalLike(status) ? (status as ReadonlySignal<Rich>).value : status;
  return (
    <div class="readout" aria-live="polite">
      {children}
      {st !== undefined && st !== null && st !== '' && (
        <span class={`readout__status${ok ? ' is-correct' : ''}`}>
          {ok && <IconCheck />}
          {typeof st === 'string' ? <RichText inline text={st} /> : (st as ComponentChildren)}
        </span>
      )}
    </div>
  );
}

export interface ReadoutPairProps {
  /** Concept ink for the pair (and it lights with the concept). */
  concept?: string;
  /** The symbol, Rich: '$\\vec v$'. */
  sym: Rich;
  /** A signal, computed or getter (formatted with formatLive), a fixed number/vector, or JSX. */
  value: LiveValue | LiveData | ComponentChildren;
  /** Decimals for numbers (default 2). */
  decimals?: number;
}

/** `v = (1.40, 0.20)` inside a Readout. */
export function ReadoutPair({ concept, sym, value, decimals = 2 }: ReadoutPairProps) {
  let shown: ComponentChildren;
  if (isSignalLike(value) || typeof value === 'function') shown = formatLive(readLive(value as LiveValue), decimals);
  else if (typeof value === 'number' || (Array.isArray(value) && value.every((x) => typeof x === 'number' || Array.isArray(x)))) shown = formatLive(value as LiveData, decimals);
  else shown = value as ComponentChildren;
  return (
    <span class={['readout__pair', concept ? `ct ct-${concept}` : ''].filter(Boolean).join(' ')}>
      <RichText inline text={sym} class="readout__sym" />
      <span class="readout__sep">=</span>
      <span class="readout__val">{shown}</span>
    </span>
  );
}

const Tick = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);

/** "Try it": goals tick green (240ms) and each new tick is announced. */
export function Mission({ title = 'Try it', goals, status, correct }: MissionProps) {
  const done = goals.map((g) => !!read(g.done));
  const prev = useRef<boolean[] | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = done;
    if (!before) return;
    const newly = goals.filter((_, k) => done[k] && !before[k]);
    if (newly.length) announce(`Done: ${newly.map((g) => richToPlain(g.text)).join('; ')}`);
  });
  const st = read(status);
  const ok = !!read(correct);
  return (
    <div class="mission">
      <p class="label mission__title">{title}</p>
      <ul>
        {goals.map((g, k) => (
          <li key={k} class={done[k] ? 'is-done' : undefined}>
            <span class="mission__box" aria-hidden="true">
              <Tick />
            </span>
            <span class="mission__text">
              <RichText inline text={g.text} />
              <span class="sr-only">{done[k] ? ' Done.' : ' Not yet.'}</span>
            </span>
          </li>
        ))}
      </ul>
      {st ? (
        <p class={`mission__status${ok ? ' is-correct' : ''}`} aria-live="polite">
          {ok && <IconCheck />} <RichText inline text={st} />
        </p>
      ) : null}
    </div>
  );
}

/** Legend rows: line-style swatch + words; concept rows are focusable and light their concept. */
export function Legend({ items, label = 'Key' }: { items: readonly LegendItem[]; label?: string }) {
  return (
    <ul class="legend" aria-label={label}>
      {items.map((it, k) => (
        <li key={k} class={it.concept ? `ct ct-${it.concept}` : undefined} tabIndex={it.concept ? 0 : undefined}>
          <LineSwatch concept={it.concept} hue={it.hue} line={it.line} />
          <RichText inline text={it.label} />
        </li>
      ))}
    </ul>
  );
}

/** The keyboard line under an interactive figure: `p.fig-keys`. */
export function FigKeys({ children }: { children?: ComponentChildren }) {
  const content = toChildArray(children).length ? children : <DefaultKeys />;
  return <p class="fig-keys">{content}</p>;
}
