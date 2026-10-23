/**
 * The frame every lesson uses (README §4.1): skip link → masthead →
 * `.page` (contents rail first, then `main.lesson`) → lesson head → the
 * Sections → colophon. It provides the kit context (the lesson's concepts,
 * page-wide), installs hover-linking and the glossary once, records
 * progress (visit, sections reached), and drives the rail's `aria-current`
 * and the masthead progress from one IntersectionObserver.
 *
 *   mountLesson(
 *     <LessonPage id="linalg/eigenvectors" meta={meta as LessonMeta} concepts={C} glossary={GLOSSARY} subtitle="the directions a matrix doesn’t turn">
 *       <Section id="tldr" title="Eigenvectors in three lines">…</Section>
 *       …
 *     </LessonPage>,
 *   );
 */
import { LESSON_BY_ID, SUBJECT_BY_ID } from '@content/curriculum';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { KitProvider } from '../core/context';
import { installLinking } from '../core/link';
import { getProgress } from '../core/progress';
import type { ConceptSet } from '../theme';
import type { GlossaryTerm, LessonMeta, LessonSectionId } from '../types';
import { isShipped } from './catalog';
import { LESSON_TO_ROOT, lessonHref, subjectHref } from './links';
import { scanSections, SectionsContext } from './Section';
import { SectionTrackContext, useSectionTrack } from './sections';
import { SiteHeader } from './SiteHeader';

export interface LessonPageProps {
  /** 'linalg/eigenvectors' (must match curriculum.ts). */
  id: string;
  /** The lesson's meta.json (`meta as LessonMeta`). */
  meta: LessonMeta;
  /** C from problems.ts. */
  concepts: ConceptSet;
  /** GLOSSARY from problems.ts (default: meta.glossary), registered for the glossary popovers. */
  glossary?: readonly GlossaryTerm[];
  /** "the directions a matrix doesn’t turn" */
  subtitle?: string;
  /** <Section>s in §4 order. */
  children: ComponentChildren;
}

interface GlossaryModule {
  installGlossary?: (root?: Element) => () => void;
  registerGlossary?: (entries: readonly { term: string; definition: string; lesson?: string }[]) => void;
}

/**
 * G1's glossary (text/Glossary.tsx), imported by file, never through the
 * text barrel (PLAN §3). Resolved at build time: until the file exists this
 * is empty and RichText's `dfn.gloss` terms stay plain.
 */
const GLOSSARY_MODULE: GlossaryModule | undefined = Object.values(import.meta.glob<GlossaryModule>('../text/Glossary.tsx', { eager: true }))[0];

const LEVEL_WORD: Record<string, string> = { intro: 'Intro', core: 'Core', advanced: 'Advanced' };

export function LessonPage({ id, meta, concepts, glossary, subtitle, children }: LessonPageProps) {
  const scanned = scanSections(children);
  const sectionsKey = scanned.map((s) => `${s.id}:${s.title}:${s.kicker}`).join('|');
  // The same array while the sections are the same, so Sections don't re-render on every scroll update.
  const sections = useMemo(() => scanned, [sectionsKey]);
  const [main, setMain] = useState<HTMLElement | null>(null);
  const thumb = typeof location !== 'undefined' && new URLSearchParams(location.search).has('thumb');
  const subject = SUBJECT_BY_ID.get(meta.subject);
  const curriculum = LESSON_BY_ID.get(id);

  // Concepts page-wide (one lesson per page), before the first paint.
  useLayoutEffect(() => concepts.mount(), [concepts]);
  useEffect(() => installLinking(), []);
  useEffect(() => {
    const terms = glossary ?? meta.glossary ?? [];
    GLOSSARY_MODULE?.registerGlossary?.(terms.map((t) => ({ ...t, lesson: id })));
    return GLOSSARY_MODULE?.installGlossary?.();
  }, [glossary, meta, id]);
  useEffect(() => {
    if (!document.title.trim()) document.title = `${meta.title} — coolstuff`;
    getProgress().visit(id);
  }, [id, meta.title]);

  const track = useSectionTrack(main, (sec) => getProgress().section(id, sec as LessonSectionId), !!main);

  return (
    <KitProvider lessonId={id} concepts={concepts} scoped={false}>
      <SectionTrackContext.Provider value={track}>
        <a class="skip-link" href="#main">
          Skip to the lesson
        </a>
        {!thumb && (
          <SiteHeader
            progress
            home={LESSON_TO_ROOT}
            crumbs={[{ label: subject?.title ?? meta.subject, href: subjectHref(meta.subject) }, { label: meta.title }]}
          />
        )}
        <div class="page">
          {/* .page is a two-column grid at ≥ 1240px: the rail must come first. */}
          <nav class="rail" aria-label="On this page">
            <p class="label rail__title">On this page</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} class={track.current !== s.id && track.seen.includes(s.id) ? 'is-done' : undefined} aria-current={track.current === s.id ? 'true' : undefined}>
                    {s.kicker}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <main class="lesson" id="main" ref={setMain} tabIndex={-1}>
            <header class="lesson-head">
              <p class="kicker">
                <span class="kicker__num">{meta.order}</span>
                {subject?.title ?? meta.subject}
                {meta.unit ? <span class="lesson-head__unit">· {meta.unit}</span> : null}
              </p>
              <h1 class="lesson-title">
                <span class="lesson-title__main">{meta.title}</span>
                {subtitle && <span class="lesson-title__sub">{subtitle}</span>}
              </h1>
              <ul class="lesson-meta">
                <li>{meta.minutes} min</li>
                <li>
                  <span class="pill">{LEVEL_WORD[meta.level] ?? meta.level}</span>
                </li>
                {meta.status !== 'shipped' && (
                  <li>
                    <span class="pill pill--wip">Work in progress</span>
                  </li>
                )}
                {meta.prerequisites.length > 0 && (
                  <li class="lesson-meta__prereqs">
                    Builds on
                    {meta.prerequisites.map((p, k) => (
                      <span key={p}>
                        {k > 0 ? ', ' : ''}
                        {isShipped(p) ? <a href={lessonHref(p)}>{LESSON_BY_ID.get(p)?.title ?? p}</a> : <span class="lesson-meta__soon">{LESSON_BY_ID.get(p)?.title ?? p}</span>}
                      </span>
                    ))}
                  </li>
                )}
              </ul>
            </header>
            <SectionsContext.Provider value={sections}>{children}</SectionsContext.Provider>
            <footer class="colophon">
              <p>
                <a href={LESSON_TO_ROOT}>coolstuff</a> · a free, interactive textbook. This page works offline; your progress stays in this browser.
              </p>
              {curriculum && (
                <p>
                  {subject?.title} · lesson {curriculum.order} · {curriculum.unit}
                </p>
              )}
            </footer>
          </main>
        </div>
      </SectionTrackContext.Provider>
    </KitProvider>
  );
}
