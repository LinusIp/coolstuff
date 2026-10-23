/**
 * The derivative as slope and as rate: the small visuals that problems.ts names by `figure` key (worked
 * examples, problems, custom drags, traps, quiz questions). NO side effects
 * (no mountLesson, no page-level signals): lesson.tsx and the subject
 * practice pages both import it, and lesson.test.ts checks every key has a
 * renderer (README §8.6).
 *
 *   examples: { 'secant': (p, set) => <SecantFig h={p.h} onH={(h) => set({ h })} /> },
 *   problems: { 'gd-step': (inst) => <GdStepFig params={inst.params} /> },
 *   customs:  { 'drag-v': (state, inst) => <DragV state={state} /> },
 *   traps:    { 'rotation': () => <RotationFig /> },
 *   quiz:     { 'q-graph': () => <SmallGraph /> },
 */
import { defineFigures } from '@kit';

export const FIGURES = defineFigures({
  // wip: one renderer per `figure` key used in problems.ts.
});
