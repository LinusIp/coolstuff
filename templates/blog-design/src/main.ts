import { marked } from 'marked';
import { safeStorage } from '../../../src/shared/capabilities';

/** Posts are plain markdown files with a tiny frontmatter block. */
interface Post {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  body: string;
}

const files = import.meta.glob('../content/posts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function parse(path: string, raw: string): Post {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return {
    slug: path.split('/').pop()!.replace(/\.md$/, ''),
    title: meta.title ?? 'Untitled',
    date: meta.date ?? '',
    tags: (meta.tags ?? '').replace(/[[\]]/g, '').split(',').map((t) => t.trim()).filter(Boolean),
    excerpt: meta.excerpt ?? '',
    body: m?.[2] ?? raw,
  };
}

const posts = Object.entries(files).map(([p, raw]) => parse(p, raw)).sort((a, b) => b.date.localeCompare(a.date));
const page = document.body.dataset.page;

const list = document.querySelector('#posts');
if (list) {
  const tag = new URLSearchParams(location.search).get('tag');
  list.innerHTML = posts
    .filter((p) => !tag || p.tags.includes(tag))
    .map((p) => `<li><a href="./post.html?p=${p.slug}">${p.title}</a> <time>${p.date}</time></li>`)
    .join('');
}
if (page === 'post') {
  const post = posts.find((p) => p.slug === new URLSearchParams(location.search).get('p')) ?? posts[0];
  document.title = post.title;
  document.querySelector('h1')!.textContent = post.title;
  document.querySelector('#article')!.innerHTML = marked.parse(post.body, { async: false });
}

const root = document.documentElement;
root.dataset.theme = safeStorage.get('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.querySelector('#theme')!.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  safeStorage.set('theme', root.dataset.theme);
});
