/**
 * A set of practice problems (README §8.3).
 *
 *   <ProblemSet problems={PROBLEMS} figures={FIGURES.problems} customs={FIGURES.customs} />   // a lesson page
 *   <ProblemSet items={entries} mode="list" title="Linear algebra: mixed practice" />           // a subject page
 *
 * Paged (default): a dot strip (solved ✓ / solved with help, hatched /
 * attempted, dashed / to do; the current dot ringed) above one problem at a
 * time. Every `article[data-problem]` stays in the DOM (the others `hidden`);
 * a problem's body mounts the first time it is shown. List: every problem in
 * turn, each body mounting as it scrolls near. With `items`, each problem
 * renders inside its own lesson's scoped KitProvider (its inks, macros and
 * progress key).
 */
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { KitProvider, useKit } from '../core/context';
import { problemKey } from '../core/exam';
import type { LessonFigures, PracticeEntry, ProblemCustom, ProblemFigure } from '../core/figures';
import { useProgress } from '../core/hooks';
import { IconCheck, IconNext, IconPrev } from '../core/icons';
import { statusOfProblem } from '../core/progress';
import type { ConceptSet } from '../theme';
import type { ProblemSpec, ProblemStatus } from '../types';
import { Problem } from './Problem';

export interface ProblemSetProps {
  /** One lesson (the lesson page): keys are problem ids. */
  problems?: readonly ProblemSpec[];
  /** FIGURES.problems, by spec.figure. */
  figures?: LessonFigures['problems'];
  /** FIGURES.customs, by spec.figure, for drag mode 'custom'. */
  customs?: LessonFigures['customs'];
  /** Several lessons (subject practice): { lessonId, spec, concepts, figures? }. */
  items?: readonly PracticeEntry[];
  /** Default 'paged' (one card + dot strip); 'list' for practice pages. */
  mode?: 'paged' | 'list';
  title?: string;
}

interface Entry {
  key: string;
  spec: ProblemSpec;
  /** Set for `items` (mixed pages): the provider scope and the explicit progress key. */
  lessonId?: string;
  concepts?: ConceptSet;
  figure?: ProblemFigure;
  custom?: ProblemCustom;
}

const STATUS_WORDS: Readonly<Record<ProblemStatus, string>> = {
  todo: 'not started',
  attempted: 'attempted',
  solved: 'solved',
  hinted: 'solved with help',
  revealed: 'solution viewed',
};

const needsCustom = (s: ProblemSpec) => s.answer.kind === 'drag' && s.answer.target.mode === 'custom';

export function ProblemSet({ problems, figures, customs, items, mode = 'paged', title }: ProblemSetProps) {
  const kit = useKit();
  const { entries, leftOut } = useMemo(() => {
    const out: Entry[] = [];
    let left = 0;
    if (items) {
      for (const it of items) {
        const fk = it.spec.figure;
        const custom = fk ? it.figures?.customs?.[fk] : undefined;
        if (needsCustom(it.spec) && !custom) {
          left++; // a custom drag without its lesson's visual can't be answered here
          continue;
        }
        out.push({ key: problemKey(it.lessonId, it.spec.id), spec: it.spec, lessonId: it.lessonId, concepts: it.concepts, figure: fk ? it.figures?.problems?.[fk] : undefined, custom });
      }
    } else {
      for (const spec of problems ?? []) {
        const fk = spec.figure;
        out.push({ key: spec.id, spec, figure: fk ? figures?.[fk] : undefined, custom: fk ? customs?.[fk] : undefined });
      }
    }
    return { entries: out, leftOut: left };
  }, [problems, figures, customs, items]);

  useEffect(() => {
    if (problems && items) console.error('ProblemSet: give either `problems` or `items`, not both (using `items`).');
    for (const it of items ?? []) {
      if (needsCustom(it.spec) && !(it.spec.figure && it.figures?.customs?.[it.spec.figure])) {
        console.error(`ProblemSet: "${it.lessonId}:${it.spec.id}" is a custom drag problem without its renderer (FIGURES.customs["${it.spec.figure ?? '?'}"]); left out of this page.`);
      }
    }
    for (const e of entries) {
      const fk = e.spec.figure;
      if (!fk) continue;
      if (needsCustom(e.spec) ? !e.custom : !e.figure) {
        console.error(`ProblemSet: no renderer for figure "${fk}" (problem "${e.key}"); add it to FIGURES.${needsCustom(e.spec) ? 'customs' : 'problems'} in figures.tsx.`);
      }
    }
  }, [entries]);

  const data = useProgress();
  const statusOf = (e: Entry): ProblemStatus => {
    const lid = e.lessonId ?? kit.lessonId;
    return lid ? statusOfProblem(data.lessons[lid]?.problems[e.spec.id]) : 'todo';
  };

  if (mode === 'list') return <ListSet entries={entries} title={title} leftOut={leftOut} statusOf={statusOf} />;
  return <PagedSet entries={entries} title={title} leftOut={leftOut} statusOf={statusOf} />;
}

function wrap(e: Entry, node: JSX.Element): JSX.Element {
  return e.lessonId && e.concepts ? (
    <KitProvider key={e.key} lessonId={e.lessonId} concepts={e.concepts}>
      {node}
    </KitProvider>
  ) : (
    node
  );
}

interface SetProps {
  entries: readonly Entry[];
  title?: string;
  leftOut: number;
  statusOf: (e: Entry) => ProblemStatus;
}

function LeftOutNote({ n }: { n: number }) {
  if (n === 0) return null;
  return <p class="pset__note">{n === 1 ? 'One problem needs its lesson’s own visual, so it is left out here.' : `${n} problems need their lesson’s own visuals, so they are left out here.`}</p>;
}

function PagedSet({ entries, title, leftOut, statusOf }: SetProps) {
  const [current, setCurrent] = useState(() => {
    const k = entries.findIndex((e) => {
      const s = statusOf(e);
      return s !== 'solved' && s !== 'hinted';
    });
    return k >= 0 ? k : 0;
  });
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([current]));
  const root = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const cur = Math.min(current, Math.max(0, entries.length - 1));

  const go = (i: number, focus = false) => {
    if (i < 0 || i >= entries.length) return;
    setCurrent(i);
    setSeen((s) => (s.has(i) ? s : new Set([...s, i])));
    focusPending.current = focus;
  };
  useLayoutEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const set = root.current;
    const art = set?.querySelectorAll<HTMLElement>('article[data-problem]')[cur];
    const prompt = art?.querySelector<HTMLElement>('.problem__prompt');
    if (prompt) {
      prompt.tabIndex = -1;
      prompt.focus({ preventScroll: true });
    }
    const top = set?.getBoundingClientRect().top ?? 0;
    if (top < 0) set?.scrollIntoView({ block: 'start' });
  }, [cur]);

  if (entries.length === 0) {
    return (
      <div class="card problem-set problem-set--empty">
        {title && <p class="label">{title}</p>}
        <p class="pset__note">No problems here yet.</p>
        <LeftOutNote n={leftOut} />
      </div>
    );
  }
  const solvedHere = (i: number) => {
    const s = statusOf(entries[i]);
    return s === 'solved' || s === 'hinted';
  };
  const done = entries.filter((_, i) => solvedHere(i)).length;
  return (
    <div class="card problem-set" ref={root}>
      <div class="pset__top">
        {title && <p class="label pset__title">{title}</p>}
        <ol class="pset" aria-label="Problems in this set">
          {entries.map((e, i) => {
            const s = statusOf(e);
            const cls = s === 'solved' ? ' is-solved' : s === 'hinted' ? ' is-hinted' : s === 'attempted' || s === 'revealed' ? ' is-attempted' : '';
            return (
              <li key={e.key}>
                <button
                  type="button"
                  class={`pset__dot${cls}`}
                  data-hit
                  aria-current={i === cur ? 'step' : undefined}
                  aria-label={`Problem ${i + 1}${e.spec.title ? `, ${e.spec.title}` : ''}: ${STATUS_WORDS[s]}`}
                  onClick={() => go(i)}
                >
                  {s === 'solved' ? <IconCheck /> : i + 1}
                </button>
              </li>
            );
          })}
        </ol>
        <span class="pset__count" aria-live="polite">{`${done} of ${entries.length} solved`}</span>
      </div>
      {entries.map((e, i) =>
        wrap(
          e,
          <Problem
            key={e.key}
            spec={e.spec}
            n={i + 1}
            total={entries.length}
            figure={e.figure}
            custom={e.custom}
            lessonId={e.lessonId}
            hidden={i !== cur}
            dormant={!seen.has(i)}
          />,
        ),
      )}
      <div class="pset__nav">
        <button type="button" class="btn btn--quiet" disabled={cur === 0} onClick={() => go(cur - 1, true)}>
          <IconPrev /> Previous
        </button>
        <button type="button" class={`btn${solvedHere(cur) ? ' btn--primary' : ''}`} disabled={cur === entries.length - 1} onClick={() => go(cur + 1, true)}>
          Next problem <IconNext />
        </button>
      </div>
      <LeftOutNote n={leftOut} />
    </div>
  );
}

/** List mode: every problem in turn; bodies mount as they come near the viewport. */
function ListSet({ entries, title, leftOut, statusOf }: SetProps) {
  const done = entries.filter((e) => {
    const s = statusOf(e);
    return s === 'solved' || s === 'hinted';
  }).length;
  return (
    <div class="problem-list">
      <div class="pset__top problem-list__top">
        {title && <p class="label pset__title">{title}</p>}
        <span class="pset__count" aria-live="polite">{`${done} of ${entries.length} solved`}</span>
      </div>
      {entries.length === 0 && <p class="pset__note">No problems here yet.</p>}
      {entries.map((e, i) => wrap(e, <LazyProblem key={e.key} entry={e} n={i + 1} total={entries.length} />))}
      <LeftOutNote n={leftOut} />
    </div>
  );
}

function LazyProblem({ entry, n, total }: { entry: Entry; n: number; total: number }) {
  const [near, setNear] = useState(false);
  const probe = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = probe.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((x) => x.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={probe} class="problem-list__probe" aria-hidden="true" />
      <Problem spec={entry.spec} n={n} total={total} figure={entry.figure} custom={entry.custom} lessonId={entry.lessonId} dormant={!near} />
    </>
  );
}
