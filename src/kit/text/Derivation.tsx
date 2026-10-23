/**
 * Derivation: algebra that shows what changed (README §5.2, DESIGN.md §7).
 *
 *   <Derivation {...DERIVATIONS[0]} />
 *
 * One step shows at first; the Stepper (‹ Step 2 of 4 ›) reveals the next,
 * "Show all" reveals the rest. A new step enters (`.is-entering`, 420ms),
 * `\chg{…}` gets the highlighter sweep, and symbols tagged with the same
 * `\anchor` id slide from the step above into their new places (FLIP),
 * paired k-th occurrence to k-th (`flipPlan` → `pairAnchors`); unpaired
 * symbols of the old step drop away and fade, new ones fade in. Reduced
 * motion: no slides or sweeps, the steps still appear. Printing and `?all`
 * in the URL show every step.
 */
import { useSignal, type Signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { Stepper } from '../controls';
import { useMacros } from '../core/context';
import { useReducedMotion } from '../core/hooks';
import { RichText } from '../core/RichText';
import { richToPlain, texToPlain } from '../core/richtext';
import { mathChainHtml, texToHtml } from '../notation';
import type { DerivationStep } from '../types';
import { announce } from '../util/dom';
import { BarLabel } from './Label';
import { ENTER_DELAY_MS, ENTER_MS, FLIP_MS, LEAVE_MS, flipPlan, flipTransform, visibleSteps, type Rect } from './flip';

export interface DerivationProps {
  /** `{ rel?, tex, why }` each; mark what changed with `\chg{…}`, tag symbols that move with `\anchor{id}{…}`. */
  steps: readonly DerivationStep[];
  /** DerivationSpec.id: the DOM id and `data-derivation`. */
  id?: string;
  /** Default "Derivation". */
  label?: string;
  /** Steps visible at first (default 1). Ignored when `step` is given. */
  start?: number;
  /** External control: the 0-based index of the last visible step (e.g. a Scrolly's step). */
  step?: Signal<number>;
  macros?: Readonly<Record<string, string>>;
}

const EASE = 'cubic-bezier(.45,0,.2,1)';

function relRect(el: Element, frame: DOMRect): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left - frame.left, top: r.top - frame.top, width: r.width, height: r.height };
}

/** A copy of an anchor's KaTeX, absolutely placed over `rect` in the overlay. */
function ghost(el: HTMLElement, layer: HTMLElement, frame: DOMRect): HTMLElement {
  const r = el.getBoundingClientRect();
  const wrap = document.createElement('span');
  wrap.className = 'katex derivation__ghost';
  wrap.style.fontSize = getComputedStyle(el).fontSize;
  wrap.style.left = `${r.left - frame.left}px`;
  wrap.style.top = `${r.top - frame.top}px`;
  const copy = el.cloneNode(true) as HTMLElement;
  copy.style.visibility = '';
  wrap.appendChild(copy);
  layer.appendChild(wrap);
  // Line boxes differ between the original and the copy: nudge the copy onto the original exactly.
  const c = copy.getBoundingClientRect();
  wrap.style.left = `${r.left - frame.left + (r.left - c.left)}px`;
  wrap.style.top = `${r.top - frame.top + (r.top - c.top)}px`;
  return wrap;
}

const anchorsOf = (li: Element): HTMLElement[] => [...li.querySelectorAll<HTMLElement>('.mchain__visual [data-anchor]')];

export function Derivation({ steps, id, label = 'Derivation', start = 1, step, macros }: DerivationProps) {
  const n = steps.length;
  const internal = useSignal(Math.max(0, Math.min(n, Math.max(1, start)) - 1));
  const k = step ?? internal;
  const printing = useSignal(false);
  const showAllParam = useMemo(() => typeof location !== 'undefined' && new URLSearchParams(location.search).has('all'), []);
  const reduced = useReducedMotion();
  const current = Math.min(Math.max(0, Math.floor(k.value)), Math.max(0, n - 1));
  const visible = visibleSteps(current, n, showAllParam || printing.value);

  // Which steps just appeared (decided in render so they enter on their first frame).
  const prevVisible = useRef(visible);
  const entering = useRef<{ from: number; to: number; at: number }>({ from: visible, to: visible, at: 0 });
  if (visible > prevVisible.current) entering.current = { from: prevVisible.current, to: visible, at: Date.now() };
  const grew = visible - prevVisible.current;
  prevVisible.current = visible;

  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const flights = useRef<Animation[]>([]);

  // FLIP the shared anchors from the step above into the new step.
  useLayoutEffect(() => {
    if (grew <= 0) return;
    for (const a of flights.current.splice(0)) a.finish();
    const ol = list.current;
    const box = root.current;
    const lay = layer.current;
    const lis = ol ? [...ol.querySelectorAll<HTMLElement>(':scope > li')] : [];
    const newLi = lis[visible - 1];
    if (newLi && grew === 1) {
      const s = steps[visible - 1];
      announce(`${texToPlain(s.tex)}. ${richToPlain(s.why)}`);
    }
    if (grew !== 1 || reduced || !box || !lay || !newLi || visible < 2 || typeof newLi.animate !== 'function') return;
    const oldLi = lis[visible - 2];
    const oldEls = anchorsOf(oldLi);
    const newEls = anchorsOf(newLi);
    if (oldEls.length === 0 && newEls.length === 0) return;
    const frame = box.getBoundingClientRect();
    const plan = flipPlan(
      oldEls.map((e) => e.dataset.anchor ?? ''),
      newEls.map((e) => e.dataset.anchor ?? ''),
      oldEls.map((e) => relRect(e, frame)),
      newEls.map((e) => relRect(e, frame)),
    );
    for (const mv of plan.moves) {
      const target = newEls[mv.to];
      const g = ghost(target, lay, frame);
      target.style.visibility = 'hidden';
      const anim = g.animate([{ transform: flipTransform(mv) }, { transform: 'none' }], { duration: FLIP_MS, easing: EASE });
      const done = () => {
        g.remove();
        target.style.visibility = '';
      };
      anim.onfinish = done;
      anim.oncancel = done;
      flights.current.push(anim);
    }
    for (const i of plan.leaving) {
      const g = ghost(oldEls[i], lay, frame);
      const anim = g.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateY(0.45em)' },
        ],
        { duration: LEAVE_MS, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' },
      );
      const done = () => g.remove();
      anim.onfinish = done;
      anim.oncancel = done;
      flights.current.push(anim);
    }
    for (const j of plan.entering) {
      flights.current.push(newEls[j].animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTER_MS, delay: ENTER_DELAY_MS, easing: 'ease-out', fill: 'backwards' }));
    }
  }, [visible]);

  // Drop the entering classes once their animations are over.
  useEffect(() => {
    if (grew <= 0) return;
    const t = setTimeout(() => {
      entering.current = { from: visible, to: visible, at: 0 };
      list.current?.querySelectorAll('.dstep.is-entering').forEach((li) => li.classList.remove('is-entering'));
    }, 700);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => () => flights.current.splice(0).forEach((a) => a.cancel()), []);

  // Printing shows every step (hidden steps mount just for it).
  useEffect(() => {
    const on = () => (printing.value = true);
    const off = () => (printing.value = false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
    };
  }, [printing]);

  const allShown = visible >= n;
  const enter = entering.current;
  return (
    <div class="derivation" ref={root} id={id} data-derivation={id ?? ''}>
      <div class="derivation__bar">
        <BarLabel text={label} />
        {n > 1 && !showAllParam && (
          <div class="derivation__controls">
            <Stepper value={k} count={n} name={`${label}: steps`} />
            <button
              type="button"
              class="btn btn--sm btn--quiet derivation__all"
              onClick={() => {
                k.value = allShown ? 0 : n - 1;
              }}
            >
              {allShown ? 'Start over' : 'Show all'}
            </button>
          </div>
        )}
      </div>
      <ol class="derivation__steps" ref={list}>
        {steps.slice(0, visible).map((s, i) => (
          <DStep key={i} step={s} current={i === visible - 1} entering={i >= enter.from && i < enter.to && Date.now() - enter.at < 700} macros={macros} />
        ))}
      </ol>
      <div class="derivation__flip" ref={layer} aria-hidden="true" />
    </div>
  );
}

function DStep({ step, current, entering, macros }: { step: DerivationStep; current: boolean; entering: boolean; macros?: Readonly<Record<string, string>> }) {
  const m = useMacros(macros);
  const rel = useMemo(() => (step.rel ? texToHtml(step.rel, false, { macros: m }) : ''), [step.rel, m]);
  const math = useMemo(() => mathChainHtml(step.tex, { macros: m }), [step.tex, m]);
  return (
    <li class={`dstep${current ? ' is-current' : ''}${entering ? ' is-entering' : ''}`} aria-current={current ? 'step' : undefined}>
      <span class="dstep__rel" dangerouslySetInnerHTML={{ __html: rel }} />
      <div class="dstep__math" dangerouslySetInnerHTML={{ __html: math }} />
      <RichText inline class="dstep__why" text={step.why} macros={macros} />
    </li>
  );
}
