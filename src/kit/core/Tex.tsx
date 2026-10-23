/**
 * The two smallest maths components. Everything bigger (colour-linked terms
 * with explain-this and live values) is `Formula`; animated algebra is
 * `Derivation`.
 *
 *   <Tex tex="\cMatrix\cInput = \cEigenvalue\cInput" />           inline
 *   <Tex tex="\det(A - \lambda I) = 0" display />                 display, scrolls in its own box
 *   <MathChain tex="\det(B - \lambda I) = (4-\lambda)(3-\lambda) - 2 = \lambda^2 - 7\lambda + 10" />
 */
import { useMemo } from 'preact/hooks';
import { mathChainHtml, texToHtml } from '../notation';
import { useMacros } from './context';

export interface TexProps {
  tex: string;
  /** Display style in a `.math-display` box (scrolls horizontally on phones, never the page). */
  display?: boolean;
  /** Extra classes, e.g. 'math-key' or 'math-hero' for big formulas. */
  class?: string;
  macros?: Readonly<Record<string, string>>;
  id?: string;
}

export function Tex({ tex, display = false, class: cls, macros, id }: TexProps) {
  const m = useMacros(macros);
  const html = useMemo(() => texToHtml(tex, display, { macros: m }), [tex, display, m]);
  if (display) return <div id={id} class={`math-display${cls ? ` ${cls}` : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
  return <span id={id} class={`math-inline${cls ? ` ${cls}` : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export interface MathChainProps {
  /** One relation chain: lhs = a = b \implies c (NOTATION.md §8). */
  tex: string;
  class?: string;
  macros?: Readonly<Record<string, string>>;
}

/** A multi-line step that breaks at relations on a phone and aligns under the first one. */
export function MathChain({ tex, class: cls = 'step__math', macros }: MathChainProps) {
  const m = useMacros(macros);
  const html = useMemo(() => mathChainHtml(tex, { macros: m }), [tex, m]);
  return <div class={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}
