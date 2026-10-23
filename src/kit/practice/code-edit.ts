/**
 * The few text edits a code answer's editor makes (Tab indents at the caret,
 * Shift+Tab outdents the line, Enter keeps the indentation and adds a level
 * after an opening bracket). Pure and tested. The same rules as CodeCell's
 * editor (controls/editor.ts, G4), kept here because that module isn't in
 * the controls barrel (PLAN §6 request).
 */
export const INDENT = '  ';

export interface TextEdit {
  text: string;
  /** Caret position after the edit. */
  caret: number;
}

const lineStart = (text: string, pos: number): number => text.lastIndexOf('\n', pos - 1) + 1;

/** Shift+Tab: remove up to one indent level from the start of the caret's line. */
export function outdentLine(text: string, caret: number): TextEdit {
  const from = lineStart(text, caret);
  const line = text.slice(from);
  const n = line.startsWith(INDENT) ? INDENT.length : line.startsWith(' ') || line.startsWith('\t') ? 1 : 0;
  return { text: text.slice(0, from) + text.slice(from + n), caret: Math.max(from, caret - n) };
}

/** What Enter inserts at `pos`: a newline plus the line's indentation, one level deeper after `{`, `[` or `(`. */
export function newlineIndent(text: string, pos: number): string {
  const line = text.slice(lineStart(text, pos), pos);
  const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
  return '\n' + lead + (/[{[(]\s*$/.test(line) ? INDENT : '');
}

export const lineCount = (text: string): number => text.split('\n').length;
