/**
 * The masthead's reading progress (README §4.4): one ink segment per
 * `[data-section]` (done = reached, now = the section being read), with
 * "3 of 11" beside it on wide screens; on phones it becomes a full-width
 * hairline on the masthead's bottom edge (layout.css). Never a hue.
 */
import { useSectionTrack } from './sections';

export function ReadingProgress() {
  const { ids, current, seen } = useSectionTrack();
  const k = current ? ids.indexOf(current) : -1;
  const n = ids.length;
  if (!n) return null;
  const done = new Set(seen);
  return (
    <div class="progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={n} aria-valuenow={Math.max(0, k + 1)} aria-valuetext={k >= 0 ? `Section ${k + 1} of ${n}` : `${n} sections`}>
      <span class="progress__label" aria-hidden="true">
        {k >= 0 ? `${k + 1} of ${n}` : `${n} sections`}
      </span>
      <span class="progress__track" aria-hidden="true">
        {ids.map((id, i) => (
          <span key={id} class={i === k ? 'is-now' : done.has(id) ? 'is-done' : undefined} />
        ))}
      </span>
    </div>
  );
}
