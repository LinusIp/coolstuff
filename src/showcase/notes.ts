import './style.css';
import './notes.css';
import { marked } from 'marked';
import data from './projects.json';
import { CATEGORY_SINGULAR, type Project } from './types';

// Each project's NOTES.md is bundled as its own lazy chunk.
const notes = import.meta.glob('../../projects/*/NOTES.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const head = document.querySelector<HTMLElement>('#head')!;
const article = document.querySelector<HTMLElement>('#notes')!;
const slug = new URLSearchParams(location.search).get('p') ?? '';
const project = (data as Project[]).find((p) => p.slug === slug && p.status === 'shipped');
const load = notes[`../../projects/${slug}/NOTES.md`];

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

if (!project || !load) {
  document.title = 'Not found · coolstuff';
  head.innerHTML = '<p class="kicker mono">404</p><h1>No notes here.</h1>';
  article.innerHTML = '<p>That project doesn’t exist (yet). <a href="./">Back to everything</a>.</p>';
} else {
  document.title = `${project.title} — notes · coolstuff`;
  head.innerHTML = `
    <p class="kicker mono">${CATEGORY_SINGULAR[project.category]} · ${project.date}</p>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="tagline">${escapeHtml(project.tagline)}</p>
    <div class="actions">
      <a class="open" href="./projects/${project.slug}/">Open ${escapeHtml(project.title)} →</a>
      <span class="tech mono">${project.tech.map(escapeHtml).join(' · ')}</span>
    </div>`;
  load()
    .then((md) => {
      article.innerHTML = marked.parse(md, { async: false });
      // Relative links inside NOTES.md point at the project folder.
      article.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        const href = a.getAttribute('href')!;
        if (!/^(https?:|#|\/)/.test(href)) a.href = `./projects/${project.slug}/${href.replace(/^\.\//, '')}`;
        if (/^https?:/.test(href)) a.rel = 'noopener';
      });
    })
    .catch(() => {
      article.innerHTML = '<p>Couldn’t load these notes. Try refreshing.</p>';
    });
}
