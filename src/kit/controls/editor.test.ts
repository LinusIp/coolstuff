import { describe, expect, it } from 'vitest';
import { indent, lineCount, newlineWithIndent } from './editor';

describe('editor edits', () => {
  it('Tab with a caret inserts two spaces', () => {
    expect(indent('ab', 1, 1, 1)).toEqual({ text: 'a  b', selStart: 3, selEnd: 3 });
  });
  it('Tab with a one-line selection replaces it with an indent (like any editor)', () => {
    expect(indent('abc', 0, 2, 1)).toEqual({ text: '  c', selStart: 2, selEnd: 2 });
  });
  it('Tab over several lines indents each line and keeps them selected', () => {
    const t = 'a\nb\nc';
    const r = indent(t, 0, 3, 1); // "a\nb" selected
    expect(r.text).toBe('  a\n  b\nc');
    expect(r.text.slice(r.selStart, r.selEnd)).toBe('a\n  b');
  });
  it('a selection ending at the start of a line leaves that line alone', () => {
    const r = indent('a\nb\nc', 0, 2, 1); // "a\n"
    expect(r.text).toBe('  a\nb\nc');
  });
  it('Shift+Tab outdents the current line or every selected line', () => {
    expect(indent('    x', 4, 4, -1)).toEqual({ text: '  x', selStart: 2, selEnd: 2 });
    expect(indent(' x', 1, 1, -1).text).toBe('x');
    expect(indent('x', 0, 0, -1).text).toBe('x');
    const r = indent('  a\n    b\nc', 0, 9, -1);
    expect(r.text).toBe('a\n  b\nc');
    expect(r.selStart).toBe(0);
  });
  it('Shift+Tab never moves the caret before the line start', () => {
    const r = indent('ab\n  cd', 4, 4, -1); // caret after one leading space of line 2
    expect(r.text).toBe('ab\ncd');
    expect(r.selStart).toBe(3);
  });
  it('Enter keeps indentation and adds a level after an opening bracket', () => {
    expect(newlineWithIndent('  let x = 1;', 12)).toBe('\n  ');
    expect(newlineWithIndent('for (;;) {', 10)).toBe('\n  ');
    expect(newlineWithIndent('  if (a) {', 10)).toBe('\n    ');
    expect(newlineWithIndent('x', 1)).toBe('\n');
  });
  it('counts lines', () => {
    expect(lineCount('')).toBe(1);
    expect(lineCount('a\nb\n')).toBe(3);
  });
});
