/**
 * Which section the reader is in (README §4.1): one IntersectionObserver over
 * the page's `[data-section]` elements. Shared by LessonPage (rail
 * `aria-current`, `progress.section`) and ReadingProgress (the masthead
 * hairline), and usable on any page with sections.
 */
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';

export interface SectionTrack {
  /** Section ids in page order. */
  ids: readonly string[];
  /** The section in the reading band (upper-middle of the viewport), or null above the first. */
  current: string | null;
  /** Sections the reader has reached, in first-seen order. */
  seen: readonly string[];
}

const EMPTY: SectionTrack = { ids: [], current: null, seen: [] };

/** LessonPage provides its tracker so ReadingProgress doesn't observe twice. */
export const SectionTrackContext = createContext<SectionTrack | null>(null);

/**
 * Observe `[data-section]` inside `root` (default: the document). `onSeen`
 * fires once per section, the first time it enters the reading band.
 */
export function useSectionTrack(root?: Element | null, onSeen?: (id: string) => void, enabled = true): SectionTrack {
  const shared = useContext(SectionTrackContext);
  const [track, setTrack] = useState<SectionTrack>(EMPTY);
  const seenCb = useRef(onSeen);
  seenCb.current = onSeen;
  useEffect(() => {
    if (!enabled || shared || typeof IntersectionObserver === 'undefined') return;
    const scope: ParentNode = root ?? document;
    const els = [...scope.querySelectorAll<HTMLElement>('[data-section]')];
    const ids = els.map((e) => e.dataset.section ?? e.id);
    const inBand = new Set<string>();
    const seen: string[] = [];
    const publish = () => {
      // The last section (in page order) that is in the band; when none is, keep the last one passed.
      const current = [...ids].reverse().find((id) => inBand.has(id)) ?? null;
      setTrack((t) => {
        const cur = current ?? (t.current && ids.includes(t.current) ? t.current : null);
        return cur === t.current && seen.length === t.seen.length && t.ids.length === ids.length ? t : { ids, current: cur, seen: [...seen] };
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.section ?? e.target.id;
          if (e.isIntersecting) {
            inBand.add(id);
            if (!seen.includes(id)) {
              seen.push(id);
              seenCb.current?.(id);
            }
          } else inBand.delete(id);
        }
        publish();
      },
      // A band from 30% to 45% of the viewport height: the line a reader is on.
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    for (const e of els) io.observe(e);
    setTrack({ ids, current: null, seen: [] });
    return () => io.disconnect();
  }, [root, enabled, shared]);
  return shared ?? track;
}
