/**
 * A small JavaScript tokenizer for CodeCell (pure, tested): syntax is shown
 * by ink weight and italics only (DESIGN.md §8: hue is for concepts), and
 * identifiers a lesson maps to concepts are underlined in the concept's line
 * style. The sandbox also uses it to find `import(…)` outside strings and
 * comments. Good enough for teaching snippets; not a parser (a `/` is a
 * regex only after an operator, a keyword or the start).
 */

export type TokenKind = 'kw' | 'com' | 'str' | 'num' | 'id' | 'regex' | 'punct' | 'ws';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Offset in the source. */
  at: number;
}

export const JS_KEYWORDS: ReadonlySet<string> = new Set(
  'await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield async NaN Infinity'.split(
    ' ',
  ),
);

/** Keywords after which a `/` starts a regex rather than dividing. */
const REGEX_AFTER_KW = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

const isIdStart = (c: string) => /[A-Za-z_$À-￿]/.test(c);
const isIdPart = (c: string) => /[\w$À-￿]/.test(c);

/** Split source into tokens; concatenating every token's text gives back the source exactly. */
export function tokenizeJs(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  const push = (kind: TokenKind, from: number) => out.push({ kind, text: src.slice(from, i), at: from });
  const lastSignificant = (): Token | undefined => {
    for (let k = out.length - 1; k >= 0; k--) if (out[k].kind !== 'ws' && out[k].kind !== 'com') return out[k];
    return undefined;
  };
  while (i < n) {
    const c = src[i];
    const from = i;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      while (i < n && /[ \t\n\r]/.test(src[i])) i++;
      push('ws', from);
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      push('com', from);
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      push('com', from);
    } else if (c === '"' || c === "'" || c === '`') {
      i++;
      let depth = 0; // template ${…} nesting: kept inside the string token (simplification)
      while (i < n) {
        const d = src[i];
        if (d === '\\') {
          i += 2;
          continue;
        }
        if (c === '`' && d === '$' && src[i + 1] === '{') {
          depth++;
          i += 2;
          continue;
        }
        if (c === '`' && d === '}' && depth > 0) {
          depth--;
          i++;
          continue;
        }
        if (d === c && depth === 0) {
          i++;
          break;
        }
        if (d === '\n' && c !== '`') break; // unterminated: stop at the line end
        i++;
      }
      push('str', from);
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      if (c === '0' && /[xXbBoO]/.test(src[i + 1] ?? '')) {
        i += 2;
        while (i < n && /[0-9a-fA-F_]/.test(src[i])) i++;
      } else {
        while (i < n && /[0-9_.]/.test(src[i])) i++;
        if (/[eE]/.test(src[i] ?? '') && /[-+0-9]/.test(src[i + 1] ?? '')) {
          i += 2;
          while (i < n && /[0-9_]/.test(src[i])) i++;
        }
      }
      if (src[i] === 'n') i++;
      push('num', from);
    } else if (isIdStart(c)) {
      while (i < n && isIdPart(src[i])) i++;
      const word = src.slice(from, i);
      const prev = lastSignificant();
      const isProp = prev?.kind === 'punct' && prev.text === '.';
      push(JS_KEYWORDS.has(word) && !isProp ? 'kw' : 'id', from);
    } else if (c === '/') {
      const prev = lastSignificant();
      const regexOk = !prev || (prev.kind === 'punct' && !/[)\]}]$/.test(prev.text)) || (prev.kind === 'kw' && REGEX_AFTER_KW.has(prev.text));
      if (regexOk) {
        i++;
        let inClass = false;
        while (i < n && src[i] !== '\n') {
          const d = src[i];
          if (d === '\\') {
            i += 2;
            continue;
          }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) {
            i++;
            break;
          }
          i++;
        }
        while (i < n && /[a-z]/.test(src[i])) i++;
        push('regex', from);
      } else {
        i++;
        if (src[i] === '=') i++;
        push('punct', from);
      }
    } else {
      // Operators and punctuation: group runs of operator characters, keep brackets single.
      if (/[()[\]{};,.]/.test(c)) i++;
      else while (i < n && /[-+*%=<>!&|^~?:@#]/.test(src[i])) i++;
      if (i === from) i++;
      push('punct', from);
    }
  }
  return out;
}

/**
 * Why `src` can't run in the sandbox, or null: `import(…)` and `import`
 * statements would fetch from the network (the site makes no runtime
 * requests), so they are refused before the code runs.
 */
export function forbiddenSyntax(src: string): string | null {
  const toks = tokenizeJs(src).filter((t) => t.kind !== 'ws' && t.kind !== 'com');
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind === 'kw' && t.text === 'import') {
      const next = toks[k + 1];
      if (next?.text === '.') continue; // import.meta is harmless
      return 'import isn’t available here: the code runs offline in a sandbox, so everything it needs is already defined.';
    }
  }
  return null;
}

/** 1-based line and column of an offset (for error messages). */
export function lineCol(src: string, at: number): { line: number; col: number } {
  const before = src.slice(0, Math.max(0, at));
  const line = before.split('\n').length;
  return { line, col: at - before.lastIndexOf('\n') };
}
