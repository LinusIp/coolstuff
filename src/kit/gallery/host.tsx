/**
 * Renders gallery groups as a book-like page with the real kit styles: the
 * /kit page renders all of them, kit/_dev/<group>.html one. Independent of
 * the shell components (G4) so every group can preview from day one.
 */
import '../styles/index.css';
import './gallery.css';
import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { initTheme, toggleTheme } from '../theme';
import { KitProvider } from '../core/context';
import { installLinking } from '../core/link';
import { RichText } from '../core/RichText';
import { IconBook, IconMoon, IconSun } from '../core/icons';
import { DEMO } from './samples';
import type { GalleryGroup } from './types';

function GalleryPage({ groups, title }: { groups: GalleryGroup[]; title: string }) {
  useEffect(() => installLinking(), []);
  return (
    <KitProvider concepts={DEMO} lessonId="kit/gallery">
      <a class="skip-link" href="#main">
        Skip to the content
      </a>
      <header class="masthead">
        <div class="masthead__inner">
          <a class="wordmark" href="../../">
            <IconBook />
            coolstuff
          </a>
          <nav class="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <a href="../">Kit</a>
              </li>
              <li aria-current="page">{title}</li>
            </ol>
          </nav>
          <div class="masthead__end">
            <button class="icon-btn theme-toggle" type="button" aria-label="Switch light or dark" onClick={() => toggleTheme()}>
              <IconMoon />
              <IconSun />
            </button>
          </div>
        </div>
      </header>
      <div class="page">
        {/* .page is a two-column grid at ≥ 1240px: the rail must come first (layout.css). */}
        <nav class="rail" aria-label="On this page">
          <p class="label rail__title">On this page</p>
          <ol>
            {groups.flatMap((g) =>
              (g.demos.length ? g.demos : [{ id: g.id, title: g.title }]).map((d) => (
                <li key={d.id}>
                  <a href={`#${d.id}`}>{d.title}</a>
                </li>
              )),
            )}
          </ol>
        </nav>
        <main class="lesson" id="main">
          <header class="lesson-head">
            <p class="kicker">
              <span class="kicker__num">0</span>Kit
            </p>
            <h1 class="lesson-title">
              <span class="lesson-title__main">{title}</span>
              <span class="lesson-title__sub">every component, in every state</span>
            </h1>
          </header>
          {groups.map((g, gi) => (
            <section class={`section${gi === 0 ? ' section--first' : ''}`} id={g.id} aria-labelledby={`${g.id}-h`} key={g.id}>
              <header class="section__head">
                <p class="kicker">
                  <span class="kicker__num">{gi + 1}</span>
                  {g.owner === 'architect' ? 'Foundations' : g.owner}
                </p>
                <h2 id={`${g.id}-h`}>{g.title}</h2>
              </header>
              <RichText text={g.blurb} />
              {g.demos.length === 0 && <p class="gallery-empty">No demos yet: {g.owner} adds them to src/kit/gallery/{g.id}.tsx.</p>}
              {g.demos.map((d) => (
                <div class={`gallery-demo${d.wide ? ' is-wide' : ''}`} id={d.id} key={d.id}>
                  <div class="gallery-demo__head">
                    <h3>{d.title}</h3>
                    <span class="gallery-demo__component">{d.component}</span>
                  </div>
                  {d.notes && <RichText class="gallery-demo__notes" text={d.notes} />}
                  {d.render()}
                </div>
              ))}
            </section>
          ))}
          <footer class="colophon">
            <p>coolstuff kit · reference specs in src/kit/gallery/samples.ts · API in src/kit/README.md.</p>
          </footer>
        </main>
      </div>
    </KitProvider>
  );
}

/** Mount gallery groups into `#app` (or `el`). */
export function mountGallery(groups: GalleryGroup[], opts: { title?: string; el?: HTMLElement | null } = {}): void {
  initTheme();
  DEMO.mount();
  const el = opts.el ?? document.getElementById('app');
  if (!el) throw new Error('mountGallery: no #app element');
  render(<GalleryPage groups={groups} title={opts.title ?? (groups.length === 1 ? groups[0].title : 'Component gallery')} />, el);
}
