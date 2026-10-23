/**
 * Vite plugin: prerender maths in HTML at build time, so static pages (home,
 * subject pages, lesson index.html fallbacks, noscript content) show typeset
 * maths before any script runs.
 *
 *   <span class="tex">\vec v = 2\ihat + \jhat</span>          inline  → .math-inline
 *   <div class="tex-block">A\vec v = \lambda \vec v</div>     display → .math-display
 *
 * become KaTeX HTML (+ MathML for screen readers) with the same options and
 * NOTATION.md macros as runtime rendering (`texOptions` in notation.ts), so an
 * equation looks identical either way. Write `&lt;` for `<` and `&amp;` for
 * `&` inside the TeX, as in any HTML. A TeX error fails the build with the
 * file name; in dev it renders in red so you can fix it live. Elements that
 * already carry `data-katex` are left alone.
 *
 * Registered in vite.config.ts. Maths that changes at runtime uses <Tex>,
 * <Formula> or <RichText> instead.
 */
import type { Plugin } from 'vite';
import { texToHtml } from './notation';

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s: string): string => s.replace(/&(?:lt|gt|amp|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

/** Elements whose class list contains `tex` or `tex-block` (not `texture`, not `my-tex`). */
const TEX_ELEMENT = /<(span|div)(\s[^>]*?\bclass="((?:[^"]*\s)?(tex|tex-block)(?:\s[^"]*)?)"[^>]*)>([\s\S]*?)<\/\1>/g;

export interface PrerenderOptions {
  /** Throw on a TeX error (build) instead of rendering it in red (dev). */
  throwOnError?: boolean;
  /** For error messages. */
  filename?: string;
  /** Extra macros for every page. */
  macros?: Readonly<Record<string, string>>;
}

/** Pure transform, exported for tests and other tooling. */
export function prerenderTex(html: string, opts: PrerenderOptions = {}): string {
  if (!/\bclass="[^"]*\btex/.test(html)) return html;
  return html.replace(TEX_ELEMENT, (whole, tag: string, attrs: string, classes: string, kind: string, body: string) => {
    if (/\sdata-katex\b/.test(attrs)) return whole;
    const display = kind === 'tex-block';
    let out: string;
    try {
      out = texToHtml(decode(body.trim()), display, { throwOnError: opts.throwOnError ?? false, macros: opts.macros });
    } catch (err) {
      throw new Error(`KaTeX error in ${opts.filename ?? 'HTML'}: ${(err as Error).message}`);
    }
    const extra = display ? 'math-display' : 'math-inline';
    const newAttrs = attrs.replace(`class="${classes}"`, `class="${classes} ${extra}"`);
    return `<${tag}${newAttrs} data-katex>${out}</${tag}>`;
  });
}

export function katexPrerender(options: { macros?: Readonly<Record<string, string>> } = {}): Plugin {
  let isBuild = false;
  return {
    name: 'coolstuff:katex-prerender',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return prerenderTex(html, { throwOnError: isBuild, filename: ctx.filename, macros: options.macros });
      },
    },
  };
}
