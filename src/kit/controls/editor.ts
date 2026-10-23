/**
 * Pure text edits behind CodeCell's editor (tested in editor.test.ts):
 * Tab indents (two spaces at the caret, or every selected line), Shift+Tab
 * outdents, Enter keeps the line's indentation (one level more after an
 * opening bracket). The component applies the result to its textarea.
 */

export const INDENT = '  ';

export interface Edit {
  text: string;
  selStart: number;
  selEnd: number;
}

const lineStart = (text: string, pos: number): number => text.lastIndexOf('\n', pos - 1) + 1;

/** Indent (dir 1) or outdent (dir −1). A caret with no selection indents by inserting two spaces; a selection shifts every line it touches. */
export function indent(text: string, selStart: number, selEnd: number, dir: 1 | -1): Edit {
  const multi = text.slice(selStart, selEnd).includes('\n');
  if (dir === 1 && !multi) {
    return { text: text.slice(0, selStart) + INDENT + text.slice(selEnd), selStart: selStart + INDENT.length, selEnd: selStart + INDENT.length };
  }
  const from = lineStart(text, selStart);
  // A selection ending at the very start of a line doesn't include that line.
  const endPos = selEnd > selStart && text[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
  const nl = text.indexOf('\n', endPos);
  const to = nl < 0 ? text.length : nl;
  const lines = text.slice(from, to).split('\n');
  let startShift = 0;
  let total = 0;
  const out = lines.map((line, k) => {
    if (dir === 1) {
      if (k === 0) startShift = INDENT.length;
      total += INDENT.length;
      return INDENT + line;
    }
    const n = line.startsWith(INDENT) ? INDENT.length : line.startsWith(' ') || line.startsWith('\t') ? 1 : 0;
    if (k === 0) startShift = -Math.min(n, selStart - from);
    total -= n;
    return line.slice(n);
  });
  const next = text.slice(0, from) + out.join('\n') + text.slice(to);
  return { text: next, selStart: Math.max(from, selStart + startShift), selEnd: Math.max(from, selEnd + total) };
}

/** What Enter inserts at `pos`: a newline plus the current line's indentation, one level deeper after `{`, `[` or `(`. */
export function newlineWithIndent(text: string, pos: number): string {
  const from = lineStart(text, pos);
  const line = text.slice(from, pos);
  const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
  const opens = /[{[(]\s*$/.test(line);
  return '\n' + lead + (opens ? INDENT : '');
}

/** Line count, for the gutter and the editor height. */
export const lineCount = (text: string): number => text.split('\n').length;
