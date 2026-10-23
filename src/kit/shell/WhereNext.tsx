/**
 * "Where this goes next" (README §4.5): the lessons this one builds on and
 * the ones it unlocks, from curriculum.ts, with shipped lessons as links and
 * unshipped ones as dashed "coming soon" cards (not links); then the
 * references, one `li[data-ref]` each, formatted per DESIGN.md §8 and never
 * fetched.
 *
 *   <WhereNext lessonId="linalg/eigenvectors" references={REFERENCES} />
 */
import { LESSONS, SUBJECT_BY_ID } from '@content/curriculum';
import { useMemo } from 'preact/hooks';
import { RichText } from '../core/RichText';
import type { Reference } from '../types';
import { LESSON_INDEX } from './catalog';
import { referenceParts, whereNext, type LessonCardData } from './where-next';

export interface WhereNextProps {
  lessonId: string;
  references: readonly Reference[];
  /** Lessons to list under "Builds on" beyond the curriculum prerequisites. */
  extraBuildsOn?: readonly string[];
  /** Lessons to list under "Unlocks" beyond the curriculum dependents. */
  extraUnlocks?: readonly string[];
}

export function WhereNext({ lessonId, references, extraBuildsOn, extraUnlocks }: WhereNextProps) {
  const data = useMemo(() => whereNext(lessonId, LESSONS, SUBJECT_BY_ID, LESSON_INDEX, { extraBuildsOn, extraUnlocks }), [lessonId, extraBuildsOn, extraUnlocks]);
  return (
    <>
      <div class="next-grid">
        <CardList title="← Builds on" cards={data.buildsOn} dir="←" empty="Nothing: this is a starting point." />
        <CardList title="Unlocks →" cards={data.unlocks} dir="→" empty="Nothing yet in the curriculum." />
      </div>
      <p class="label refs__head">References</p>
      <References items={references} />
    </>
  );
}

function CardList({ title, cards, dir, empty }: { title: string; cards: readonly LessonCardData[]; dir: string; empty: string }) {
  return (
    <div class="next-col">
      <p class="label">{title}</p>
      {cards.length ? (
        <ul class="lesson-cards">
          {cards.map((c) => (
            <li key={c.id}>
              <LessonCard card={c} dir={dir} />
            </li>
          ))}
        </ul>
      ) : (
        <p class="next-empty">{empty}</p>
      )}
    </div>
  );
}

/** One lesson card: a link when shipped, a dashed "coming soon" card when not. */
export function LessonCard({ card, dir = '→' }: { card: LessonCardData; dir?: string }) {
  const body = (
    <>
      <span class="lesson-card__kicker">
        {card.kicker}
        {!card.shipped && <span class="lesson-card__soon"> · coming soon</span>}
      </span>
      <span class="lesson-card__title">{card.title}</span>
      {card.summary && <span class="lesson-card__desc">{card.summary}</span>}
      <span class="lesson-card__dir" aria-hidden="true">
        {dir}
      </span>
    </>
  );
  return card.shipped && card.href ? (
    <a class="lesson-card" href={card.href}>
      {body}
    </a>
  ) : (
    <div class="lesson-card is-soon">{body}</div>
  );
}

/** `ol.refs`: small-caps authors, italic title, edition, publisher, year, section; URLs as text. */
export function References({ items }: { items: readonly Reference[] }) {
  return (
    <ol class="refs">
      {items.map((r, k) => {
        const p = referenceParts(r);
        return (
          <li key={k} data-ref>
            <span class="refs__author">{p.authors}</span> <cite class="refs__title">{p.title}</cite>
            {p.rest ? `, ${p.rest}` : ''}.{p.url ? <span class="refs__url"> {p.url}</span> : null}
            {p.note ? (
              <>
                {' '}
                <RichText inline text={p.note} class="refs__note" />
              </>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
