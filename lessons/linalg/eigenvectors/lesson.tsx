/**
 * Eigenvectors and eigenvalues (linalg/eigenvectors): the lesson page.
 *
 * wip skeleton from `npm run new`: every §4 section is present, and each part
 * not written yet is a <Wip> card (`data-wip`) naming the kit component that
 * replaces it (src/kit/README.md §10). Write math.ts and problems.ts first,
 * as tested code; then replace the cards one by one, and delete `Wip` with
 * the last of them.
 */
import '@kit/styles/index.css';
import { CodeCell, LessonPage, RichText, Section, Step, WhereNext, mountLesson, type LessonMeta } from '@kit';
import type { ComponentChildren } from 'preact';
import meta from './meta.json';
import { GuessDirections } from './hook';
import { EigenHunt } from './play';
import * as content from './problems';
// import { FIGURES } from './figures';   // for WorkedExampleSet, Trap, ProblemSet and Quiz

const ID = 'linalg/eigenvectors';
const { C, GLOSSARY, PREDICTS, REFERENCES, SNIPPETS } = content;

/** A clearly marked placeholder for a part of the lesson that isn't written yet. */
function Wip({ use, children }: { use: string; children: ComponentChildren }) {
  return (
    <aside class="callout callout--simplify" data-wip>
      <p class="label callout__label">Work in progress</p>
      <p>{children}</p>
      <p class="fig-keys">
        Build it with <code>{use}</code>.
      </p>
    </aside>
  );
}

mountLesson(
  <LessonPage id={ID} meta={meta as LessonMeta} concepts={C} glossary={GLOSSARY} subtitle="the directions a matrix doesn’t turn">
    <Section id="tldr" title="In three lines">
      <Wip use="<TLDR spec={TLDR} />">Three bullets and the key formula, printable as a revision sheet.</Wip>
    </Section>

    <Section id="hook" title="Which arrows survive?">
      <RichText
        text={'A matrix moves every arrow in the plane: it stretches some, squashes others, and swings almost all of them round to point somewhere new. *Almost* all. A few special directions come out exactly on the line they started on, and those directions turn out to explain what the matrix does: its long-run behaviour, its powers, its stability. Before we name them, find them by eye.'}
      />
      <GuessDirections spec={PREDICTS[0]} />
    </Section>

    <Section id="play" title="Hunt for the arrows that survive">
      <EigenHunt />
    </Section>

    <Section id="build" title="Build the idea">
      <Step title="Step one">
        <Wip use="a sentence or two + one focused <Figure>">Start concrete.</Wip>
      </Step>
      <Step title="Step two">
        <Wip use="a sentence or two + one focused <Figure>">One idea per step, each with something to touch.</Wip>
      </Step>
      <Step title="Step three">
        <Wip use="a sentence or two + one focused <Figure>">End general. 3–6 steps in all (or one <code>Scrolly</code>).</Wip>
      </Step>
    </Section>

    <Section id="formalize" title="Make it precise">
      <Wip use="<Formula {...FORMULAS[0]} live={…} /> + <Derivation {...DERIVATIONS[0]} />">
        The definition or theorem, every symbol colour-linked to the visual, with an explain-this note per symbol.
      </Wip>
    </Section>

    <Section id="examples" title="See one done">
      <Wip use="<WorkedExampleSet examples={EXAMPLES} figures={FIGURES.examples} />">Three worked examples: direct, combined with an earlier lesson, and exam level.</Wip>
    </Section>

    {/* Required for dsa, sysdesign, systems, ml, dl, diffusion and llm; maths and physics may use a "simulate it" cell or drop the section. */}
    <Section id="code" title="Code it">
      <Wip use="<CodeCell code={SNIPPETS.x} inputs={…} outputs={…} />">A short, runnable snippet whose output updates the section's visual. The cell below runs the stub snippet.</Wip>
      <CodeCell code={SNIPPETS.main} />
    </Section>

    <Section id="traps" title="Where students slip">
      <Wip use="<Trap spec={t} n={i + 1} figures={FIGURES.traps} />">Two to four common traps, each with a visual counterexample.</Wip>
    </Section>

    <Section id="practice" title="Your turn">
      <Wip use="<ProblemSet problems={PROBLEMS} figures={FIGURES.problems} customs={FIGURES.customs} />">
        At least eight problems (3 ★, 3 ★★, 2 ★★★) with three hints each and full solutions.
      </Wip>
    </Section>

    <Section id="quickcheck" title="Thirty seconds">
      <Wip use="<Quiz questions={QUIZ} figures={FIGURES.quiz} />">Four to six fast concept checks, with an explanation for every wrong answer.</Wip>
    </Section>

    <Section id="next" title="Where this goes">
      <WhereNext lessonId={ID} references={REFERENCES} />
      {REFERENCES.length < 2 && <Wip use="REFERENCES in problems.ts">At least two real references: textbook sections, papers or lecture notes.</Wip>}
    </Section>
  </LessonPage>,
);
