import { Marked, type Tokens, type TokenizerAndRendererExtension } from 'marked';
import { escapeHtml, img, isPortrait, smarten } from './content';

/**
 * Markdown → HTML for essays, with three small additions to plain markdown:
 *
 *   ::: pull                 a pull quote (vertical text in the margin on desktop)
 *   The quote.
 *   :::
 *
 *   ![alt](name "caption")   a generated image name becomes a <figure> with srcset
 *
 *   text[^1]  /  [^1]: note  footnotes, shown as margin notes on wide screens
 */

const pullQuote: TokenizerAndRendererExtension = {
  name: 'pull',
  level: 'block',
  start(src) {
    return /^::: ?pull/m.exec(src)?.index;
  },
  tokenizer(src) {
    const m = /^::: ?pull[^\n]*\n([\s\S]+?)\n:::[^\n]*(?:\n+|$)/.exec(src);
    if (!m) return undefined;
    const text = m[1].trim();
    return { type: 'pull', raw: m[0], text, tokens: this.lexer.inlineTokens(text) };
  },
  renderer(token) {
    return `<aside class="pull" aria-label="Pull quote"><p>${this.parser.parseInline(token.tokens ?? [])}</p></aside>\n`;
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function figure(image: Tokens.Image): string {
  const portrait = isPortrait(image.href);
  const sizes = portrait ? '(min-width: 760px) 26rem, calc(100vw - 2.5rem)' : '(min-width: 1000px) 52rem, calc(100vw - 2.5rem)';
  const caption = image.title ? `<figcaption>${escapeHtml(smarten(image.title))}</figcaption>` : '';
  return `<figure class="figure${portrait ? ' figure--portrait' : ' figure--wide'}">${img(image.href, smarten(image.text), { sizes })}${caption}</figure>\n`;
}

const md = new Marked({ gfm: true });
md.use({
  extensions: [pullQuote],
  // Curly quotes in running text only: code spans and blocks are separate token types and stay untouched.
  walkTokens(token) {
    if (token.type === 'text' && !('tokens' in token && token.tokens?.length)) token.text = smarten(token.text);
  },
  renderer: {
    paragraph(token) {
      // A paragraph that holds only an image is really a figure.
      const parts = token.tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()));
      if (parts.length === 1 && parts[0].type === 'image') return figure(parts[0] as Tokens.Image);
      return false;
    },
    code(token) {
      // Code blocks can scroll sideways on a phone, so they must be reachable by keyboard.
      const lang = token.lang ? ` class="language-${escapeHtml(token.lang)}"` : '';
      return `<pre tabindex="0"><code${lang}>${escapeHtml(token.text)}</code></pre>\n`;
    },
    heading(token) {
      const html = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${slugify(html)}">${html}</h${token.depth}>\n`;
    },
  },
});

export interface Rendered {
  html: string;
  footnotes: number;
}

export function renderMarkdown(source: string): Rendered {
  // Footnotes: pull out single-line definitions, then number references in reading order.
  const defs = new Map<string, string>();
  let text = source.replace(/^\[\^([^\]]+)\]:[ \t]+(.+)$/gm, (_m, id: string, note: string) => {
    defs.set(id, note);
    return '';
  });
  const order: string[] = [];
  text = text.replace(/\[\^([^\]]+)\]/g, (m, id: string) => {
    if (!defs.has(id) || order.includes(id)) return m;
    order.push(id);
    const n = order.length;
    const note = md.parseInline(defs.get(id)!, { async: false });
    // The sidenote copy is for sighted readers on wide screens; assistive tech
    // follows the link to the real footnote list instead.
    return (
      `<sup class="fn-ref" id="fnref-${n}"><a href="#fn-${n}" aria-label="Note ${n}">${n}</a></sup>` +
      `<span class="sidenote" aria-hidden="true"><span class="sidenote-n">${n}</span>${note}</span>`
    );
  });

  let html = md.parse(text, { async: false });
  if (order.length) {
    const items = order
      .map((id, i) => {
        const n = i + 1;
        return `<li id="fn-${n}">${md.parseInline(defs.get(id)!, { async: false })} <a class="fn-back" href="#fnref-${n}" aria-label="Back to reference ${n}">↩</a></li>`;
      })
      .join('');
    html += `<section class="footnotes" aria-labelledby="notes-title"><h2 id="notes-title" class="footnotes-title">Notes</h2><ol>${items}</ol></section>`;
  }
  return { html, footnotes: order.length };
}

/** Markdown without footnote handling, for pages like About whose code samples show footnote syntax. */
export function renderPlain(source: string): string {
  return md.parse(source, { async: false });
}
