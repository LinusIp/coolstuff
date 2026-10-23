/**
 * The TL;DR revision card (README §5.4, DESIGN.md §8 and §12).
 *
 *   <Section id="tldr" title="Eigenvectors in three lines"><TLDR spec={TLDR} /></Section>
 *
 * Three points with italic old-style numerals, the key formula with a symbol
 * key beside them (below them under 1000px), and **Print card**, which prints
 * only this card in the print ink set: `printWithClass('print-card')` adds the
 * body class and removes it on `afterprint`, never synchronously (print()
 * returns at once on iOS Safari and Firefox Android).
 */
import { IconPrint } from '../core/icons';
import { RichText } from '../core/RichText';
import { Tex } from '../core/Tex';
import type { TldrSpec } from '../types';
import { printWithClass } from '../util/dom';

export interface TLDRProps {
  spec: TldrSpec;
  /** Card label. Default "In brief · revision card". */
  label?: string;
}

export function TLDR({ spec, label }: TLDRProps) {
  return (
    <div class="card tldr is-wide">
      <div class="tldr__head">
        <p class="label">
          {label ?? (
            <>
              In brief<span class="label__sep">·</span>revision card
            </>
          )}
        </p>
        <button type="button" class="btn btn--sm btn--quiet tldr__print" onClick={() => printWithClass('print-card')}>
          <IconPrint />
          Print card
        </button>
      </div>
      <div class="tldr__body">
        <ol class="tldr__points">
          {spec.points.map((p, i) => (
            <RichText key={i} as="li" inline text={p} />
          ))}
        </ol>
        <div class="tldr__formula">
          <Tex tex={spec.formula} display class="math-key tldr__math" />
          {spec.key && spec.key.length > 0 && (
            <dl class="key">
              {spec.key.map((k, i) => (
                <div key={i}>
                  <dt>
                    <Tex tex={k.tex} />
                  </dt>
                  <RichText as="dd" inline text={k.text} />
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
