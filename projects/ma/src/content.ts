import images from './images.json';
import { site } from './site';

/**
 * Posts are plain markdown files in content/posts/ with a small frontmatter
 * block. Vite inlines them at build time, so adding an essay is: drop in a
 * .md file and rebuild. The file name becomes the URL slug.
 */
export interface Post {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  /** A single character shown as the essay's mark (e.g. 柿). Optional. */
  kanji: string;
  /** Romanised reading and meaning of the mark, e.g. "kaki · persimmon". */
  reading: string;
  cover: string;
  coverAlt: string;
  caption: string;
  body: string;
  words: number;
  minutes: number;
}

const files = import.meta.glob('../content/posts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  const meta: Record<string, string> = {};
  if (!m) return { meta, body: text };
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const value = line.slice(i + 1).trim();
    meta[line.slice(0, i).trim()] = value.replace(/^(["'])(.*)\1$/, '$2');
  }
  return { meta, body: m[2] };
}

function countWords(markdown: string): number {
  const prose = markdown
    .replace(/^\[\^[^\]]+\]:.*$/gm, '') // footnote definitions are read separately
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/^:::.*$/gm, '') // block fences
    .replace(/[#>*_`[\]()]/g, ' ');
  return prose.split(/\s+/).filter((w) => /\w/.test(w)).length;
}

/**
 * Typographer's quotes and ellipses: ' → ’ and "…" → “…”. Markdown is written
 * with plain keyboard quotes; readers should never see them.
 */
export function smarten(text: string): string {
  return text
    .replace(/\.\.\./g, '…')
    .replace(/(^|[\s([{\u2014\u2013-])"/g, '$1\u201c')
    .replace(/"/g, '\u201d')
    // An apostrophe at the start of a run that begins a contraction ('s, 't …) is still an apostrophe.
    .replace(/^'(?=(?:s|t|re|ll|ve|d|m)\b)/, '\u2019')
    .replace(/(^|[\s([{\u2014\u2013-])'/g, '$1\u2018')
    .replace(/'/g, '\u2019');
}

function toPost(path: string, raw: string): Post {
  const { meta, body } = parseFrontmatter(raw);
  const words = countWords(body);
  return {
    slug: path.split('/').pop()!.replace(/\.md$/, ''),
    title: smarten(meta.title ?? 'Untitled'),
    date: meta.date ?? '',
    tags: (meta.tags ?? '')
      .replace(/[[\]]/g, '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    excerpt: smarten(meta.excerpt ?? ''),
    kanji: meta.kanji ?? '',
    reading: meta.reading ?? '',
    cover: meta.cover ?? '',
    coverAlt: smarten(meta.coverAlt ?? ''),
    caption: smarten(meta.caption ?? ''),
    body,
    words,
    minutes: Math.max(1, Math.round(words / site.wordsPerMinute)),
  };
}

/** Newest first. */
export const posts: Post[] = Object.entries(files)
  .map(([path, raw]) => toPost(path, raw))
  .sort((a, b) => b.date.localeCompare(a.date));

/** Every tag with its post count, most used first, then alphabetical. */
export function allTags(): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ── formatting ───────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function asDate(iso: string): Date {
  // Noon avoids the date slipping a day in timezones west of UTC.
  return new Date(`${iso}T12:00:00`);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(site.locale, opts).format(asDate(iso));
}

export interface Season {
  name: string;
  kanji: string;
  year: number;
}

/** Meteorological seasons, labelled the way a Japanese almanac would. Winter belongs to the year it starts in. */
export function seasonOf(iso: string): Season {
  const d = asDate(iso);
  const m = d.getMonth();
  let year = d.getFullYear();
  if (m <= 1) year -= 1;
  if (m >= 2 && m <= 4) return { name: 'Spring', kanji: '春', year };
  if (m >= 5 && m <= 7) return { name: 'Summer', kanji: '夏', year };
  if (m >= 8 && m <= 10) return { name: 'Autumn', kanji: '秋', year };
  return { name: 'Winter', kanji: '冬', year };
}

export function postUrl(p: Post): string {
  return `./post.html?p=${encodeURIComponent(p.slug)}`;
}

export function tagUrl(tag: string): string {
  return `./archive.html?tag=${encodeURIComponent(tag)}`;
}

// ── images ───────────────────────────────────────────────────────────────────

interface ImageInfo {
  width: number;
  height: number;
  widths: number[];
  color: string;
}

const manifest = images as Record<string, ImageInfo>;

export interface ImgOptions {
  /** The `sizes` attribute: how wide the image will be drawn at each breakpoint. */
  sizes: string;
  /** Above-the-fold images load eagerly with high priority; everything else is lazy. */
  eager?: boolean;
  className?: string;
}

/**
 * An <img> with srcset/sizes and intrinsic width/height for a generated image
 * name (see tools/gen-images.py), or a plain <img> for any other URL.
 */
export function img(name: string, alt: string, opts: ImgOptions): string {
  const info = manifest[name];
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const loading = opts.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  if (!info) return `<img${cls} src="${escapeHtml(name)}" alt="${escapeHtml(alt)}" ${loading} decoding="async">`;
  const srcset = info.widths.map((w) => `./img/${name}-${w}.webp ${w}w`).join(', ');
  const fallback = info.widths[Math.min(1, info.widths.length - 1)];
  return (
    `<img${cls} src="./img/${name}-${fallback}.webp" srcset="${srcset}" sizes="${opts.sizes}" ` +
    `width="${info.width}" height="${info.height}" alt="${escapeHtml(alt)}" ${loading} decoding="async" ` +
    `style="background-color:${info.color}">`
  );
}

export function isPortrait(name: string): boolean {
  const info = manifest[name];
  return !!info && info.height > info.width;
}
