import { initChrome } from './chrome';
import { escapeHtml, formatDate, img, postUrl, posts, tagUrl, type Post } from './content';
import { renderMarkdown } from './markdown';
import { site } from './site';

initChrome();

const article = document.querySelector<HTMLElement>('#article')!;
const slug = new URLSearchParams(location.search).get('p');
// No slug (e.g. someone opens post.html directly): show the newest essay rather than an error.
const index = slug ? posts.findIndex((p) => p.slug === slug) : 0;
const post: Post | undefined = posts[index];

function pagerLink(p: Post | undefined, dir: 'prev' | 'next'): string {
  if (!p) return '';
  const label = dir === 'prev' ? '← Earlier' : 'Later →';
  return `
    <a class="pager-link pager-${dir}" href="${postUrl(p)}" rel="${dir}">
      <span class="pager-kanji" aria-hidden="true">${escapeHtml(p.kanji)}</span>
      <span class="pager-dir">${label}</span>
      <span class="pager-title">${escapeHtml(p.title)}</span>
    </a>`;
}

function render(p: Post): void {
  document.title = `${p.title} · ${site.name}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', p.excerpt);

  const { html } = renderMarkdown(p.body);
  const older = posts[index + 1];
  const newer = posts[index - 1];
  const tags = p.tags.map((t) => `<a class="tag" href="${tagUrl(t)}">${escapeHtml(t)}</a>`).join('');

  article.innerHTML = `
    <header class="article-head wrap">
      ${
        p.kanji
          ? `<p class="article-mark rise" aria-hidden="true"><span class="article-kanji">${escapeHtml(p.kanji)}</span><span class="article-reading">${escapeHtml(p.reading)}</span></p>`
          : ''
      }
      <p class="article-tags rise" style="--i:1">${tags}</p>
      <h1 class="article-title rise" style="--i:2">${escapeHtml(p.title)}</h1>
      <p class="article-dek rise" style="--i:3">${escapeHtml(p.excerpt)}</p>
      <p class="article-byline rise" style="--i:4">
        <span>By <strong>${escapeHtml(site.author)}</strong></span>
        <time datetime="${p.date}">${formatDate(p.date)}</time>
        <span>${p.minutes} min read</span>
      </p>
    </header>
    ${
      p.cover
        ? `<figure class="cover ink-in">${img(p.cover, p.coverAlt, { sizes: '(min-width: 1100px) 66rem, calc(100vw - 2.5rem)', eager: true })}${
            p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''
          }</figure>`
        : ''
    }
    <div class="prose" id="prose">${html}</div>
    <div class="end-mark" aria-hidden="true"><svg class="seal"><use href="#seal" /></svg></div>
    <footer class="article-foot">
      <p class="filed"><span>Filed under</span>${tags}</p>
    </footer>
    <nav class="pager" aria-label="More essays">${pagerLink(older, 'prev')}${pagerLink(newer, 'next')}</nav>`;
  article.removeAttribute('aria-busy');
  trackProgress();
  // Content arrives after load, so honour a #fragment (e.g. a footnote link) once it exists.
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

function renderMissing(): void {
  document.title = `Not found · ${site.name}`;
  article.innerHTML = `
    <div class="not-found">
      <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span>Nothing here</p>
      <h1>This essay has wandered off.</h1>
      <p>There is no essay at <code>${escapeHtml(slug ?? '')}</code>. It may have been renamed, or never written.</p>
      <p><a class="button" href="./archive.html">Browse the archive</a></p>
    </div>`;
  article.removeAttribute('aria-busy');
}

/** Reading progress across the essay body, drawn as a vermilion hairline at the top. */
function trackProgress(): void {
  const bar = document.querySelector<HTMLElement>('.progress-bar');
  const prose = document.querySelector<HTMLElement>('#prose');
  if (!bar || !prose) return;
  let queued = false;
  const update = () => {
    queued = false;
    const rect = prose.getBoundingClientRect();
    const total = rect.height - window.innerHeight * 0.6;
    const read = -rect.top + window.innerHeight * 0.25;
    const p = total > 0 ? Math.min(1, Math.max(0, read / total)) : 1;
    bar.style.setProperty('--progress', p.toFixed(4));
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
}

if (post) render(post);
else renderMissing();
