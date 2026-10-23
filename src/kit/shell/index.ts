/**
 * G4 — lesson shell (README §4). Owned by G4 (see ../PLAN.md).
 */
export { LessonPage, type LessonPageProps } from './LessonPage';
export { Section, Step, scanSections, type SectionProps, type StepProps, type SectionInfo } from './Section';
export { Figure, Readout, ReadoutPair, Mission, Legend, FigKeys, DefaultKeys, type FigureProps, type ReadoutProps, type ReadoutPairProps, type MissionProps, type MissionGoal, type LegendItem, type Reactive } from './Figure';
export { SiteHeader, type SiteHeaderProps } from './SiteHeader';
export { ReadingProgress } from './ReadingProgress';
export { ThemeToggle } from './ThemeToggle';
export { WhereNext, References, LessonCard, type WhereNextProps } from './WhereNext';
export { whereNext, referenceParts, referenceText, type LessonCardData, type WhereNextData, type ReferenceParts } from './where-next';
export { useSectionTrack, SectionTrackContext, type SectionTrack } from './sections';
export { lessonHref, subjectHref, siteRoot, rootFrom, LESSON_TO_ROOT } from './links';
export { isShipped } from './catalog';
export { mountLesson } from './mount';
