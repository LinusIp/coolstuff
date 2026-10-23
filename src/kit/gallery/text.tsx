/**
 * Gallery section for G1 (Formulas & text): one demo per state worth seeing,
 * with the reference data in ./samples.ts. Rendered by kit/_dev/text.html
 * now and by /kit later.
 *
 * Dev flags (URL): `?missing-trap` renders a Trap whose figure key has no
 * renderer (it must render no <figure> and log one console.error).
 */
import { computed, signal, useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { Slider } from '../controls';
import { RichText } from '../core/RichText';
import type { Mat2, Vec2 } from '../math';
import { Figure } from '../shell';
import { Callout, Derivation, Formula, Glossary, Sidenote, Term, TLDR, Trap, registerGlossary } from '../text';
import type { DerivationSpec, FormulaSpec, TrapSpec } from '../types';
import { MatrixGrid, imageOf } from '../visual';
import { DEMO, DEMO_MACROS, DERIVATIONS, FORMULAS, GLOSSARY, TLDR as TLDR_SAMPLE, TRAPS } from './samples';
import type { GalleryGroup } from './types';

const MONO = { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)' };

// ── Formula ───────────────────────────────────────────────────────────────

function PlainFormula() {
  return (
    <>
      <p>
        Hover a symbol, then the words: <RichText inline text="[the matrix $A$]{matrix} sends [the vector $\vec v$]{input} to [its image]{output}, stretched by [the number $\lambda$]{eigenvalue}." />
      </p>
      <Formula id="demo-plain" label="Key formula" tex="\cMatrix\cInput = \cEigenvalue\cInput" />
    </>
  );
}

function ExplainFormula({ narrow }: { narrow?: boolean }) {
  const f = FORMULAS[0];
  return (
    <div style={narrow ? { maxWidth: '360px' } : undefined}>
      <Formula {...f} id={narrow ? `${f.id}-narrow` : f.id} explainDefault />
    </div>
  );
}

/** Six symbols in a fraction: notes pack under the maths, leaders from numerator and denominator never cross. */
const GRAVITY: FormulaSpec = {
  id: 'gravity',
  label: 'Newton’s law of gravitation',
  size: 'key',
  tex: '\\anchor{F}{\\ct{error}{\\vec F}} = -\\anchor{G}{G}\\,\\frac{\\anchor{m1}{m_1}\\,\\anchor{m2}{m_2}}{\\anchor{r}{\\ct{input}{r}}^2}\\,\\anchor{rhat}{\\ct{input}{\\uvec r}}',
  explain: {
    F: { word: 'the force', gloss: 'on body 2, from body 1', concept: 'error' },
    G: { word: 'a constant', gloss: '$6.67 \\times 10^{-11}$ in SI units' },
    m1: { word: 'one mass', gloss: 'in kilograms' },
    m2: { word: 'the other', gloss: 'the force is symmetric in them' },
    r: { word: 'the distance', gloss: 'between the centres, squared', concept: 'input' },
    rhat: { word: 'the direction', gloss: 'a unit vector from body 1 to body 2', concept: 'input' },
  },
  inWords: 'Two masses pull on each other along the line between them, weaker with [the square of the distance]{input}.',
};

/** A figure drives the formula: drag v (or î, ĵ); only the values change, never the KaTeX. */
function LiveFormulaDemo() {
  const A = useMemo(() => signal<Mat2>([2, 1, 1, 2]), []);
  const v = useMemo(() => signal<Vec2>([1, 0.5]), []);
  const Av = useMemo(() => imageOf(A, v), [A, v]);
  const box = useRef<HTMLDivElement>(null);
  // The dev counters, read after each change (README §5.1 acceptance). A signal rendered as text,
  // so updating it doesn't re-render this demo (which would re-render the Formula it holds).
  const counts = useSignal('Formula renders 1 · KaTeX renders 1');
  useEffect(
    () =>
      computed(() => [A.value, v.value]).subscribe(() =>
        requestAnimationFrame(() => {
          const f = box.current?.querySelector('.formula');
          const m = f?.querySelector('.formula__math');
          counts.value = `Formula renders ${f?.getAttribute('data-renders') ?? '–'} · KaTeX renders ${m?.getAttribute('data-tex-renders') ?? '–'}`;
        }),
      ),
    [A, v, counts],
  );
  return (
    <div ref={box}>
      <Figure
        name="live-formula-grid"
        caption="Drag the arrow $\cInput$ or the basis tips: the numbers under $\cMatrix\cInput$ follow."
        description="A grid transformed by the matrix A, with a draggable input vector v and its image Av."
        interactive
        wide
      >
        <MatrixGrid matrix={A} title="The matrix A acting on v" vectors={[{ value: v, concept: 'input', label: 'the input arrow v', tex: '$\\cInput$', image: { concept: 'output', label: 'its image Av', tex: '$A\\vec v$' } }]} />
      </Figure>
      <Formula
        id="live-image"
        label="Live · drag the figure"
        tex="\anchor{Av}{\ct{output}{A\vec v}} = \anchor{A}{\cMatrix}\,\anchor{v}{\cInput}"
        live={{ Av, A: { value: A, shape: [2, 2] }, v }}
        liveDefault
        explain={{
          Av: { word: 'the image', gloss: 'where the arrow lands', concept: 'output' },
          A: { word: 'the matrix', gloss: 'its columns are where $\\ihat$ and $\\jhat$ land', concept: 'matrix' },
          v: { word: 'the arrow', gloss: 'the one you drag', concept: 'input' },
        }}
      />
      <p class="fig-keys" style={MONO} aria-live="off" data-counters>
        {counts}
      </p>
    </div>
  );
}

/** Units under the symbols, the CLAUDE.md example: under F = ma, "2.0 kg × 3.1 m/s²". */
function NewtonDemo() {
  const m = useSignal(2);
  const a = useSignal(3.1);
  const F = useMemo(() => computed(() => m.value * a.value), [m, a]);
  return (
    <div class="card">
      <Formula
        id="newton-2"
        label="Newton’s second law"
        tex="\anchor{F}{\ct{error}{F}} = \anchor{m}{\ct{eigenvalue}{m}}\,\anchor{a}{\ct{input}{a}}"
        live={{ F: { value: F, decimals: 1, unit: 'N' }, m: { value: m, decimals: 1, unit: 'kg' }, a: { value: a, decimals: 1, unit: 'm/s²' } }}
        explain={{
          F: { word: 'net force', gloss: 'the sum of every push and pull', concept: 'error' },
          m: { word: 'mass', gloss: 'how hard it is to speed up', concept: 'eigenvalue' },
          a: { word: 'acceleration', gloss: 'the change in velocity per second', concept: 'input' },
        }}
        inWords="[The net force]{error} is [the mass]{eigenvalue} times [the acceleration]{input}."
      />
      <div class="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <Slider value={m} min={0.5} max={5} step={0.1} label="$m$" concept="eigenvalue" format={(x) => `${x.toFixed(1)} kg`} />
        <Slider value={a} min={-4} max={4} step={0.1} label="$a$" concept="input" format={(x) => `${x.toFixed(1).replace('-', '−')} m/s²`} />
      </div>
    </div>
  );
}

// ── Derivation ────────────────────────────────────────────────────────────

/** λ appears twice in step 4 and once in step 5: the first slides, the extra fades in (4) and out (5). */
const SQUARE: DerivationSpec = {
  id: 'square-eigenvalue',
  label: 'Why A² has eigenvalue λ²',
  steps: [
    { tex: 'A^2\\anchor{v}{\\cInput} = A(A\\anchor{v}{\\cInput})', why: '$A^2$ means: apply $A$, then apply it again.' },
    { rel: '=', tex: 'A^2\\anchor{v}{\\cInput} = A(\\chg{\\anchor{lam}{\\cEigenvalue}}\\anchor{v}{\\cInput})', why: 'Inside the brackets, $A\\vec v = \\lambda\\vec v$.' },
    { rel: '=', tex: 'A^2\\anchor{v}{\\cInput} = \\anchor{lam}{\\cEigenvalue}\\,\\chg{A}\\anchor{v}{\\cInput}', why: '$\\lambda$ is a number, so it slides out through $A$ (linearity).' },
    { rel: '=', tex: 'A^2\\anchor{v}{\\cInput} = \\anchor{lam}{\\cEigenvalue}\\,\\chg{\\anchor{lam}{\\cEigenvalue}}\\anchor{v}{\\cInput}', why: 'Use $A\\vec v = \\lambda\\vec v$ once more.' },
    { rel: '=', tex: 'A^2\\anchor{v}{\\cInput} = \\chg{\\anchor{lam}{\\cEigenvalue}^2}\\anchor{v}{\\cInput}', why: '$\\lambda\\cdot\\lambda = \\lambda^2$, and $\\vec v \\ne \\zerovec$: an eigenvector of $A^2$.' },
  ],
};

// ── Glossary ──────────────────────────────────────────────────────────────

const OTHER_TERMS = [{ term: 'determinant', definition: 'The factor by which a matrix scales areas: $\\det A = ad - bc$ for a $2 \\times 2$.', lesson: 'linalg/determinant' }];

function GlossaryDemo() {
  useEffect(() => {
    registerGlossary(
      GLOSSARY.map((g) => ({ ...g, lesson: 'kit/gallery' })),
      { macros: DEMO_MACROS },
    );
    registerGlossary(OTHER_TERMS, { macros: DEMO_MACROS });
  }, []);
  return (
    <>
      <RichText text="Hover, focus or tap a dotted term: every [[eigenvector|eigenvectors]] has an [[eigenvalue]], and the [[determinant]] (defined in another lesson) finds them. A term nobody defines, like [[spectral radius]], stays plain text." />
      <p>
        In JSX: <Term id="eigenvalue">the eigenvalues</Term> of a triangular matrix sit on its diagonal.
      </p>
      <Glossary entries={[...GLOSSARY.map((g) => ({ ...g, lesson: 'kit/gallery' })), ...OTHER_TERMS]} register={false} />
    </>
  );
}

// ── Traps ─────────────────────────────────────────────────────────────────

const arrowHead = (x: number, y: number, ang: number, s = 7) => {
  const a1 = ang + Math.PI * 0.85;
  const a2 = ang - Math.PI * 0.85;
  return `M${x + s * Math.cos(a1)} ${y + s * Math.sin(a1)}L${x} ${y}L${x + s * Math.cos(a2)} ${y + s * Math.sin(a2)}`;
};

function RotationFig() {
  const R = 58;
  const arrows = [0, 1, 2].map((k) => (k * Math.PI) / 3 + 0.25);
  return (
    <svg viewBox="-80 -80 160 160" role="img" aria-label="Three arrows and their images under a quarter turn">
      <title>A quarter-turn rotation turns every arrow</title>
      <path d="M-74 0H74M0 -74V74" stroke="var(--axis)" stroke-width="1" />
      {arrows.map((t, k) => {
        const [x, y] = [R * Math.cos(t), -R * Math.sin(t)];
        const [u, w] = [R * Math.cos(t + Math.PI / 2), -R * Math.sin(t + Math.PI / 2)];
        return (
          <g key={k}>
            <path class="ct ct-input" d={`M0 0L${x} ${y}${arrowHead(x, y, Math.atan2(y, x))}`} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path class="ct ct-output" d={`M0 0L${u} ${w}`} fill="none" {...DEMO.stroke('output', 2)} />
            <path class="ct ct-output" d={arrowHead(u, w, Math.atan2(w, u))} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

function ZeroFig() {
  return (
    <svg viewBox="-80 -70 160 140" role="img" aria-label="The origin, which every stretch factor leaves in place">
      <title>The zero vector fits every stretch factor</title>
      <path d="M-74 0H74M0 -64V64" stroke="var(--axis)" stroke-width="1" />
      <circle cx="0" cy="0" r="5" class="ct ct-input" fill="currentColor" />
      <text x="-8" y="22" text-anchor="end" font-size="13" fill="var(--ink-2)" font-family="var(--font-sans)" stroke="var(--plate)" stroke-width="3" paint-order="stroke">
        0: any λ
      </text>
      <path class="ct ct-input" d={`M0 0L36 -24${arrowHead(36, -24, Math.atan2(-24, 36))}`} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path class="ct ct-output" d="M0 0L66 -44" fill="none" {...DEMO.stroke('output', 2)} />
      <text x="76" y="40" text-anchor="end" font-size="13" fill="var(--ink-2)" font-family="var(--font-sans)" stroke="var(--plate)" stroke-width="3" paint-order="stroke">
        v: only λ = 3
      </text>
    </svg>
  );
}

const TRAP_FIGURES = { rotation: () => <RotationFig />, 'zero-vector': () => <ZeroFig /> };

function TrapsDemo() {
  const missing = typeof location !== 'undefined' && new URLSearchParams(location.search).has('missing-trap');
  const broken: TrapSpec = { ...TRAPS[0], id: 'trap-missing', figure: 'no-such-figure' };
  return (
    <>
      {TRAPS.map((t, i) => (
        <Trap key={t.id} spec={t} n={i + 1} figures={TRAP_FIGURES} />
      ))}
      {missing && <Trap spec={broken} n={3} figures={TRAP_FIGURES} />}
    </>
  );
}

// ── Callouts and sidenotes ────────────────────────────────────────────────

function CalloutsDemo() {
  return (
    <>
      <p>
        An eigenvector is a nonzero vector
        <Sidenote text="Why nonzero? $A\zerovec = \lambda\zerovec$ for every number $\lambda$, so allowing $\zerovec$ would make every number an eigenvalue." /> that the matrix only
        stretches. On a wide screen the note sits in the margin; below 1000px its number opens it under the line
        <Sidenote>A second note, numbered in page order.</Sidenote>.
      </p>
      <Callout kind="note" text="Eigenvalues can be complex even when the matrix is real." />
      <Callout kind="key" text="An eigenvector keeps its line: $A\vec v = \lambda\vec v$." />
      <Callout kind="simplify" text="We’re treating the matrix as fixed; in the next lesson it changes with time." />
    </>
  );
}

export const gallery: GalleryGroup = {
  id: 'text',
  title: 'Formulas & text',
  owner: 'G1',
  blurb: 'Formula (colour-linked terms, live values, explain this), Derivation, Glossary, TLDR, Trap, Callout.',
  demos: [
    {
      id: 'formula-plain',
      title: 'Formula · colour-linked terms',
      component: 'Formula',
      notes: 'No notes, no live values: just the maths with concept inks. Hovering a symbol, a prose term or a figure mark lights the concept everywhere.',
      render: () => <PlainFormula />,
    },
    {
      id: 'formula-explain',
      title: 'Formula · explain this',
      component: 'Formula',
      notes: 'The definition from samples.ts with *Explain this* on: notes under their symbols, curved leaders that never cross, a bracket above. $\\vec v$ is tagged twice: its note hangs from the first; both light on hover. Focus a note with Tab.',
      render: () => <ExplainFormula />,
    },
    {
      id: 'formula-stacked',
      title: 'Formula · the phone key',
      component: 'Formula',
      notes: 'The same formula in a 360px block: below 560px the notes become a dotted-rule key and a stub in each term’s line style sits under its symbol.',
      render: () => <ExplainFormula narrow />,
    },
    {
      id: 'formula-crowded',
      title: 'Formula · six symbols in a fraction',
      component: 'Formula',
      notes: 'Six notes packed into one row; leaders from the numerator and the denominator share a bus line so none cross.',
      render: () => <Formula {...GRAVITY} explainDefault />,
    },
    {
      id: 'formula-live',
      title: 'Formula · live values from a figure',
      component: 'Formula · MatrixGrid',
      notes: 'Values hang under their symbols; *Live values* shows the exploded view (a 2×2 matrix and two vectors, which fits 390px). Dragging changes only the `.lv` text: the counters below stay put while you drag (the formula re-renders only for its own switches and its wide/stacked layout).',
      wide: true,
      render: () => <LiveFormulaDemo />,
    },
    {
      id: 'formula-units',
      title: 'Formula · live values with units',
      component: 'Formula · Slider',
      notes: 'Under $F = ma$: the mass and acceleration in their units, the force recomputed. Values are announced politely at most once a second.',
      render: () => <NewtonDemo />,
    },
    {
      id: 'derivation-steps',
      title: 'Derivation · step through',
      component: 'Derivation',
      notes: 'One step at first; ‹ › reveal the next (← → work too). Symbols tagged with the same anchor slide down from the step above; `\\chg` gets the highlighter.',
      render: () => <Derivation {...DERIVATIONS[0]} />,
    },
    {
      id: 'derivation-pairing',
      title: 'Derivation · repeated and extra anchors',
      component: 'Derivation',
      notes: 'Step 4 has two $\\lambda$s where step 3 had one: the first slides, the second fades in. Step 5 has one again: the first slides, the extra drops away.',
      render: () => <Derivation {...SQUARE} />,
    },
    {
      id: 'glossary',
      title: 'Glossary · terms with popovers',
      component: 'Glossary · Term · installGlossary',
      notes: 'RichText’s `[[term]]` and `<Term>` become focusable terms; Esc or a tap elsewhere closes. Below, the lesson’s terms as a list.',
      render: () => <GlossaryDemo />,
    },
    {
      id: 'tldr',
      title: 'TLDR · the revision card',
      component: 'TLDR',
      notes: '*Print card* prints only this card (try print preview).',
      wide: true,
      render: () => <TLDR spec={TLDR_SAMPLE} />,
    },
    {
      id: 'traps',
      title: 'Trap · myth, truth, counterexample',
      component: 'Trap',
      notes: 'Each trap renders its counterexample from `figures[spec.figure]` in `figure[data-figure="trap-…"]`; side by side on wide screens, stacked on phones.',
      render: () => <TrapsDemo />,
    },
    {
      id: 'callouts',
      title: 'Callout · Sidenote',
      component: 'Callout · Sidenote',
      notes: 'Three callout kinds; margin notes that fold inline below 1000px.',
      render: () => <CalloutsDemo />,
    },
  ],
};
