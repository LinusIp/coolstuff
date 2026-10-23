/**
 * A concept's line style drawn as a short SVG stroke: for legends, the phone
 * explain-this key and exploded live values (DESIGN.md §4 "colour never
 * travels alone").
 *
 *   <LineSwatch concept="output" />           // the lesson's (or global) concept
 *   <LineSwatch hue="rose" line="double" />   // explicit
 */
import { GLOBAL_CONCEPTS, strokeFor, type Hue, type LineStyle, type SemanticRole } from '../theme';
import { useKit } from './context';

export interface LineSwatchProps {
  concept?: string;
  hue?: Hue | 'ink';
  line?: LineStyle;
  /** Width in px. Default 28. */
  width?: number;
}

export function LineSwatch({ concept, hue, line, width = 28 }: LineSwatchProps) {
  const { concepts } = useKit();
  let color = hue === 'ink' ? 'var(--ink)' : hue ? `var(--hue-${hue})` : 'var(--ink)';
  let style: LineStyle = line ?? 'solid';
  if (concept) {
    const global = GLOBAL_CONCEPTS[concept as SemanticRole];
    if (concepts && concepts.names.includes(concept)) {
      color = concepts.color(concept);
      style = line ?? concepts.line(concept);
    } else if (global) {
      color = `var(--hue-${global.hue})`;
      style = line ?? global.line;
    }
  }
  const s = strokeFor(style, 2);
  const w = width;
  return (
    <svg class="line-swatch" width={w} height="12" viewBox={`0 0 ${w} 12`} aria-hidden="true">
      {s.double ? (
        <>
          <path d={`M1 6H${w - 1}`} stroke={color} stroke-width="5" />
          <path d={`M1 6H${w - 1}`} stroke="var(--raised)" stroke-width="1.8" />
        </>
      ) : (
        <path d={`M2 6H${w - 2}`} stroke={color} stroke-width="2" stroke-dasharray={s.dasharray ?? undefined} stroke-linecap={s.linecap} fill="none" />
      )}
    </svg>
  );
}
