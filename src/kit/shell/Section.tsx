/**
 * The §4 lesson sections and the "Build the idea" steps (README §4.2).
 *
 *   <Section id="build" title="From secant to tangent">
 *     <Step title="Two points make a slope">…one sentence + one small Figure…</Step>
 *     <Step title="Slide them together">…</Step>
 *   </Section>
 *
 * A Section inside LessonPage takes its number from its position among the
 * page's sections (LessonPage reads them from its children); the first gets
 * `section--first`. A Step numbers itself by its position among its
 * section's steps unless given `n`.
 */
import { Fragment, createContext, toChildArray, type ComponentChildren, type VNode } from 'preact';
import { useContext, useLayoutEffect, useState } from 'preact/hooks';
import { RichText } from '../core/RichText';
import { SECTION_KICKERS, type LessonSectionId, type Rich } from '../types';

export interface SectionProps {
  /** One per page; the §4 id (also the element id and `data-section`). */
  id: LessonSectionId;
  /** The h2. */
  title: string;
  /** Small-caps running head; default SECTION_KICKERS[id]. */
  kicker?: string;
  /** Number shown in the kicker when the Section is used outside LessonPage. */
  n?: number;
  children?: ComponentChildren;
}

export interface SectionInfo {
  id: LessonSectionId;
  title: string;
  kicker: string;
}

/** LessonPage → Section: the page's sections in order. */
export const SectionsContext = createContext<readonly SectionInfo[] | null>(null);

/** The Sections among a LessonPage's children (fragments and arrays included), in order. */
export function scanSections(children: ComponentChildren): SectionInfo[] {
  const out: SectionInfo[] = [];
  const walk = (c: ComponentChildren) => {
    for (const v of toChildArray(c)) {
      if (typeof v !== 'object' || v === null) continue;
      const node = v as VNode<{ children?: ComponentChildren } & Partial<SectionProps>>;
      if (node.type === Section) {
        const p = node.props as SectionProps;
        out.push({ id: p.id, title: p.title, kicker: p.kicker ?? SECTION_KICKERS[p.id] });
      } else if (node.type === Fragment) walk(node.props.children);
    }
  };
  walk(children);
  return out;
}

export function Section({ id, title, kicker, n, children }: SectionProps) {
  const all = useContext(SectionsContext);
  const pos = all ? all.findIndex((s) => s.id === id) + 1 : 0;
  const num = pos || n;
  const headId = `${id}-title`;
  return (
    <section class={`section${num === 1 ? ' section--first' : ''}`} id={id} data-section={id} aria-labelledby={headId}>
      <header class="section__head">
        <p class="kicker">
          {num ? <span class="kicker__num">{num}</span> : null}
          {kicker ?? SECTION_KICKERS[id]}
        </p>
        <h2 id={headId}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export interface StepProps {
  /** Shown as the step number; default: position among the section's steps. */
  n?: number;
  /** A short h3. */
  title?: Rich;
  /** A sentence or two + one focused interactive (usually a small Figure). */
  children?: ComponentChildren;
}

/** One "Build the idea" step: `div.build-step[data-step]` with an optional numbered h3. */
export function Step({ n, title, children }: StepProps) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [auto, setAuto] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (n !== undefined || !el) return;
    const scope = el.closest('[data-section]') ?? el.parentElement;
    const k = scope ? [...scope.querySelectorAll('.build-step')].indexOf(el) : -1;
    setAuto(k >= 0 ? k + 1 : null);
  }, [el, n]);
  const num = n ?? auto;
  return (
    <div ref={setEl} class="build-step" data-step={num ?? ''}>
      {title && (
        <h3 class="build-step__title">
          {num ? <span class="build-step__n">{num}</span> : null}
          <RichText inline text={title} />
        </h3>
      )}
      {children}
    </div>
  );
}
