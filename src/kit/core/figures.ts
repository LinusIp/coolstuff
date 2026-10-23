/**
 * The figures.tsx convention: a lesson's small visuals for worked examples,
 * problems, custom drag targets, traps and quiz questions live in
 * `lessons/<subject>/<slug>/figures.tsx`, keyed by the `figure` strings in
 * problems.ts. The module has NO side effects (no mountLesson, no top-level
 * signals shared with the page), so both the lesson page and the subject
 * practice / exam pages can import it:
 *
 *   // figures.tsx
 *   export const FIGURES = defineFigures({
 *     examples: { 'secant': (p, set) => <SecantFig h={p.h} onH={(h) => set({ h })} /> },
 *     problems: { 'gd-step': (inst) => <GdStepFig params={inst.params} /> },
 *     customs:  { 'drag-v': (state, inst) => <EigenDrag state={state} /> },
 *     traps:    { 'rotation': () => <RotationFig /> },
 *     quiz:     { 'q-graph': () => <SmallGraph /> },
 *   });
 *
 *   // lesson.tsx
 *   <WorkedExampleSet examples={EXAMPLES} figures={FIGURES.examples} />
 *   <ProblemSet problems={PROBLEMS} figures={FIGURES.problems} customs={FIGURES.customs} />
 *
 * Type-only Preact imports: this file adds nothing at runtime but an identity function.
 */
import type { ComponentChildren } from 'preact';
import type { Signal } from '@preact/signals';
import type { ParamValues, PracticeItem, ProblemInstance } from '../types';

/** A worked example's figure: reads the live params and may write them (drag x₀ in the figure). */
export type ExampleFigure = (params: ParamValues, setParams: (patch: Partial<ParamValues>) => void) => ComponentChildren;
/** A problem's figure (also shown in its solution): gets the drawn instance, `params` included for generated ones. */
export type ProblemFigure = (instance: ProblemInstance) => ComponentChildren;
/** The visual for a drag mode 'custom' problem: holds the answer state in `state` (start: `target.initial`). */
export type ProblemCustom = (state: Signal<unknown>, instance: ProblemInstance) => ComponentChildren;
/** A fixed figure (trap counterexamples, quiz questions). */
export type StaticFigure = () => ComponentChildren;

export interface LessonFigures {
  /** By WorkedExampleSpec.figure. */
  examples?: Readonly<Record<string, ExampleFigure>>;
  /** By ProblemBody.figure. */
  problems?: Readonly<Record<string, ProblemFigure>>;
  /** By ProblemBody.figure, for drag targets with mode 'custom'. */
  customs?: Readonly<Record<string, ProblemCustom>>;
  /** By TrapSpec.figure. */
  traps?: Readonly<Record<string, StaticFigure>>;
  /** By QuizQuestion.figure. */
  quiz?: Readonly<Record<string, StaticFigure>>;
}

/** Identity helper so a lesson's FIGURES object is checked against LessonFigures. */
export const defineFigures = (figures: LessonFigures): LessonFigures => figures;

/**
 * One problem on a page that mixes lessons (subject practice, exam set), with
 * its lesson's figures so problem figures and custom drags still render.
 * `ProblemSet items` and `ExamSet items` take these (README §8.6).
 */
export interface PracticeEntry extends PracticeItem {
  /** The owning lesson's `FIGURES` (from its figures.tsx), if it has one. */
  figures?: LessonFigures;
}
