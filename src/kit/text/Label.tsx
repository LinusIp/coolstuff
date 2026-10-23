/** A bar label (`p.label`, serif small caps) that keeps Greek letters as themselves: "Why det(A − λI) = 0". */
import { labelRuns } from './label';

export function BarLabel({ text, class: cls }: { text: string; class?: string }) {
  return (
    <p class={['label', cls].filter(Boolean).join(' ')}>
      {labelRuns(text).map((r, k) =>
        r.math ? (
          <span key={k} class="label__math">
            {r.text}
          </span>
        ) : (
          r.text
        ),
      )}
    </p>
  );
}
