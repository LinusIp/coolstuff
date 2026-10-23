/**
 * The generated lesson index (src/content/lessons.json, written by
 * scripts/build-index.ts): which lessons are shipped, their summaries.
 */
import lessonsIndex from '@content/lessons.json';
import type { IndexedLike } from './where-next';

export const LESSON_INDEX = lessonsIndex as unknown as readonly IndexedLike[];

const SHIPPED = new Set(LESSON_INDEX.filter((l) => l.status === 'shipped').map((l) => l.id));

/** True when the lesson is shipped (has a page worth linking to). */
export const isShipped = (id: string): boolean => SHIPPED.has(id);
