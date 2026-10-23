/**
 * Gallery section for the kit foundations (kit architect): RichText, Tex,
 * MathChain, LineSwatch, icons, the link bus, and the answer checkers.
 * Rendered by kit/_dev/core.html now and by /kit later.
 */
import { useSignal } from '@preact/signals';
import { checkNumeric, checkSymbolic } from '../core/answers';
import { IconCheck, IconCross, IconNext, IconPause, IconPlay, IconPrev, IconPrint, IconRefresh, IconWarn } from '../core/icons';
import { LineSwatch } from '../core/LineSwatch';
import { link } from '../core/link';
import { RichText } from '../core/RichText';
import { MathChain, Tex } from '../core/Tex';
import type { NumericAnswer, SymbolicAnswer } from '../types';
import { DEMO } from './samples';
import type { GalleryGroup } from './types';

const PROSE = [
  'Drag [the input arrow]{input} and watch [its image]{output}: [the matrix]{matrix} $\\cMatrix$ turns almost every arrow. The ones it only stretches are its **eigenvectors**, and the stretch factor is the [[eigenvalue]] $\\cEigenvalue$.',
  '$$\\cMatrix\\cInput = \\cEigenvalue\\cInput$$',
  '- `code` stays literal: `a*b*c`\n- a real minus: the vector (1, -2)\n- *emphasis* and a \\$5 bill',
].join('\n\n');

function LinkDemo() {
  const s = link.value;
  return (
    <div class="card">
      <p>
        <RichText inline text="Hover or tap [the input]{input}, [the output]{output} or [$\lambda$]{eigenvalue}, a symbol in the formula, or an arrow:" />
      </p>
      <Tex display class="math-key" tex="\anchor{A}{\cMatrix}\anchor{v}{\cInput} = \anchor{lam}{\cEigenvalue}\anchor{v}{\cInput}" />
      <svg viewBox="0 0 240 120" width="240" height="120" role="img" aria-label="An input arrow and its image, three times longer on the same line" style={{ display: 'block', margin: '0 auto' }}>
        <rect width="240" height="120" fill="var(--plate)" />
        <path d="M20 100H220M40 110V10" class="fig-axis" />
        <path d="M40 100L200 20" class="ct ct-output fig-line" stroke-width="2.5" stroke-dasharray="8 5" fill="none" />
        <path d="M40 100L93.3 73.3" class="ct ct-input fig-line" stroke-width="2.5" fill="none" />
        <text x="206" y="22" class="fig-label ct ct-output" data-term="lam">
          ×3
        </text>
        <text x="72" y="96" class="fig-label ct ct-input" style={{ fontWeight: 700 }}>
          v
        </text>
      </svg>
      <p class="readout" aria-live="polite">
        lit: concept = {s.concept ?? '—'} · term = {s.term ?? '—'}
        {s.sticky ? ' · pinned by a tap' : ''}
      </p>
    </div>
  );
}

const NUMERIC: NumericAnswer = { kind: 'numeric', value: 9.81, precision: { sig: 3 }, unit: 'm/s^2' };
const SYMBOLIC: SymbolicAnswer = { kind: 'symbolic', expr: '2x cos(x^2)', vars: ['x'], label: "f'(x) =" };

function CheckerDemo({ kind }: { kind: 'numeric' | 'symbolic' }) {
  const text = useSignal(kind === 'numeric' ? '981 cm/s²' : '2x cos x^2');
  const v = kind === 'numeric' ? checkNumeric(text.value, NUMERIC, [{ answer: 98.1, why: 'x' }]) : checkSymbolic(text.value, SYMBOLIC, [{ answer: 'cos(x^2)', why: 'x' }]);
  const id = `chk-${kind}`;
  return (
    <div class="card">
      <p class="lead">
        {kind === 'numeric' ? (
          <RichText inline text="Expected $9.81\ \mathrm{m/s^2}$ to 3 significant figures (try `9.8`, `9.81`, `981 cm/s^2`, `9.81 m/s`, `98.1 m/s^2`)." />
        ) : (
          <RichText inline text="Expected $f'(x) = 2x\cos(x^2)$ (try `cos(x^2)*2x`, `2x cos x^2`, `cos(x^2)`, `1/2x`)." />
        )}
      </p>
      <div class="answer-row">
        <label class="answer-row__label" for={id}>
          {kind === 'numeric' ? <Tex tex="g =" /> : <Tex tex="f'(x) =" />}
        </label>
        <input
          id={id}
          class={`field${v.correct ? ' is-correct' : v.reason === 'empty' ? '' : ' is-wrong'}`}
          value={text.value}
          spellcheck={false}
          autocomplete="off"
          onInput={(e) => (text.value = (e.target as HTMLInputElement).value)}
        />
      </div>
      {v.understood && (
        <p class="answer-row__help">
          We read: <Tex tex={v.understood} />
        </p>
      )}
      <p class={`feedback ${v.correct ? 'feedback--correct' : 'feedback--wrong'}`} aria-live="polite">
        {v.correct ? <IconCheck /> : <IconCross />} {v.message}
        {v.commonWrong !== undefined ? ' (matches common wrong answer 1)' : ''} <span class="pill">{v.reason}</span>
      </p>
    </div>
  );
}

export const gallery: GalleryGroup = {
  id: 'core',
  title: 'Foundations',
  owner: 'architect',
  blurb: 'The shared pieces every group builds on: RichText, Tex and MathChain, line swatches, icons, the link bus, and the answer checkers that Problem uses.',
  demos: [
    {
      id: 'richtext',
      title: 'RichText',
      component: 'RichText',
      notes: 'Inline and display maths with the lesson’s concept shorthands, **bold**, *italic*, `code`, concept terms, a glossary term and a list.',
      render: () => <RichText text={PROSE} />,
    },
    {
      id: 'link-bus',
      title: 'Hover-linking across prose, formula and figure',
      component: 'link bus (installLinking, highlight)',
      notes: 'One signal lights a concept everywhere (`.ct-*` via `<html data-hl>`) and a single symbol by term (`data-term` / `\\anchor`). Taps pin the highlight on touch.',
      render: () => <LinkDemo />,
    },
    {
      id: 'tex',
      title: 'Tex and relation chains',
      component: 'Tex · MathChain',
      notes: 'A relation chain breaks at relations on a phone and lines up under the first one.',
      render: () => (
        <div class="card">
          <p>
            Inline <Tex tex="\det(\cMatrix - \cEigenvalue I) = 0" /> sits in a sentence.
          </p>
          <MathChain tex="\det(B - \lambda I) = (4-\lambda)(3-\lambda) - 2\cdot 1 = \lambda^2 - 7\lambda + 10" />
          <MathChain tex="(\lambda-5)(\lambda-2) = 0 \implies \lambda_1 = 5,\ \lambda_2 = 2" />
        </div>
      ),
    },
    {
      id: 'swatches',
      title: 'Line swatches and icons',
      component: 'LineSwatch · icons',
      render: () => (
        <div class="card">
          <ul class="legend" aria-label="Key">
            {DEMO.legend().map((r) => (
              <li key={r.name}>
                <LineSwatch concept={r.name} /> <Tex tex={`\\colorTerm{${r.name}}{${r.symbol ?? r.name}}`} /> {r.label}
              </li>
            ))}
            <li>
              <LineSwatch concept="error" /> error (global)
            </li>
            <li>
              <LineSwatch concept="prob" /> probability (global)
            </li>
          </ul>
          <p class="btn-row" aria-label="Icons">
            <span class="badge badge--correct">
              <IconCheck /> right
            </span>
            <span class="badge badge--wrong">
              <IconCross /> not yet
            </span>
            <span class="chip">
              <IconWarn /> warn
            </span>
            {[IconRefresh, IconPrint, IconPrev, IconNext, IconPlay, IconPause].map((I, k) => (
              <span class="icon-btn" key={k} aria-hidden="true">
                <I />
              </span>
            ))}
          </p>
        </div>
      ),
    },
    {
      id: 'check-numeric',
      title: 'Answer checking · numbers and units',
      component: 'checkNumeric',
      notes: 'Constant expressions, stated precision, unit conversion, wrong dimensions and common wrong answers, with a TeX preview of what was understood.',
      render: () => <CheckerDemo kind="numeric" />,
    },
    {
      id: 'check-symbolic',
      title: 'Answer checking · expressions',
      component: 'checkSymbolic',
      notes: 'Equivalence by evaluation at random points; implicit multiplication; the preview shows how `1/2x` was read.',
      render: () => <CheckerDemo kind="symbolic" />,
    },
  ],
};
