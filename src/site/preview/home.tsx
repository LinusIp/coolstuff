/**
 * Preview home page: what coolstuff is, what is ready, and the full
 * curriculum map (every lesson "coming soon" until it ships). The full site
 * (subject pages, prerequisite graph, practice, search) will replace this.
 */
import '@kit/styles/index.css';
import './home.css';
import { render } from 'preact';
import { SiteHeader } from '@kit';
import { PATHS, SUBJECTS, expandPath } from '@content/curriculum';

const total = SUBJECTS.reduce((n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0), 0);
const core = SUBJECTS.filter((s) => !s.later);

function Home() {
  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader crumbs={[]} home="./" />
      <div class="page">
        <nav class="rail" aria-label="Subjects">
          <p class="rail__title">Subjects</p>
          <ol>
            {SUBJECTS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <main class="lesson" id="main">
          <header class="lesson-head">
            <p class="kicker">A free interactive textbook</p>
            <h1 class="lesson-title">
              <span class="lesson-title__main">coolstuff</span>
              <span class="lesson-title__sub">the core of a STEM and CS degree, one picture at a time</span>
            </h1>
            <ul class="lesson-meta">
              <li>{total} lessons planned</li>
              <li>{core.length} subjects</li>
              <li>first lessons in progress</li>
            </ul>
          </header>

          <section class="section section--first" aria-labelledby="about">
            <h2 id="about">What this is</h2>
            <p class="home-lead">
              Calculus, linear algebra, probability, algorithms, system design, machine learning, deep learning, diffusion models,
              LLMs and physics, taught the way you wish your lectures had been.
            </p>
            <p>
              Every lesson starts with a picture you can drag, scrub and slide until the idea moves in your hands. Only then come the
              formulas, with every symbol colour-linked to the picture. Then you see problems worked step by step, and solve your own
              with hints and full solutions. It is free, has no accounts and no trackers, and keeps your progress on your device.
            </p>
            <p>
              The first lessons (eigenvectors, the derivative and gradient descent) are being written now. Until they land, you can
              explore the component kit every lesson is built from: draggable figures, live plots and the controls that drive them.
            </p>
            <div class="home-actions">
              <a class="btn btn--primary" href="./kit/">
                Explore the component kit
              </a>
              <a class="btn" href="#paths">
                See the learning paths
              </a>
            </div>
          </section>

          <section class="section" aria-labelledby="paths">
            <h2 id="paths">Start here</h2>
            <p>Six routes through the curriculum. Each one pulls in the prerequisites you need, in order.</p>
            <ul class="home-paths">
              {PATHS.map((p) => (
                <li key={p.id}>
                  <h3>{p.title}</h3>
                  <p>{p.blurb}</p>
                  <p class="meta">{expandPath(p.lessons).length} lessons · coming soon</p>
                </li>
              ))}
            </ul>
          </section>

          <section class="section" aria-labelledby="map">
            <h2 id="map">The whole curriculum</h2>
            <p>Every lesson that is planned, in prerequisite order. Lessons become links as they ship.</p>
            {SUBJECTS.map((s) => (
              <div class="home-subject" key={s.id}>
                <h3 id={s.id}>
                  {s.title}
                  {s.later && <span class="home-later"> · later expansion</span>}
                </h3>
                <p class="home-subject__blurb">{s.blurb}</p>
                {s.units.map((u) => (
                  <div class="home-unit" key={u.title}>
                    <h4>{u.title}</h4>
                    <ol class="home-lessons" start={u.lessons[0].order}>
                      {u.lessons.map((l) => (
                        <li key={l.id}>{l.title}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <footer class="home-foot">
            <p>
              Original prose, figures and problems. Fonts are self-hosted, nothing is tracked, and the site works offline after your
              first visit. Source on <a href="https://github.com/LinusIp/coolstuff">GitHub</a>.
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}

render(<Home />, document.getElementById('app')!);
