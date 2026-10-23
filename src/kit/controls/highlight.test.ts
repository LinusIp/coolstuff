import { describe, expect, it } from 'vitest';
import { forbiddenSyntax, lineCol, tokenizeJs } from './highlight';

const kinds = (src: string) => tokenizeJs(src).filter((t) => t.kind !== 'ws').map((t) => `${t.kind}:${t.text}`);

describe('tokenizeJs', () => {
  it('round-trips the source exactly', () => {
    const src = 'let v = [1, 0.5]; // start\nfor (let k = 0; k < 20; k++) { v = normalize(apply(A, v)); emit("v", v); }\n/* done */ const r = /a\\/b/g; `x ${1 + 2} y`;';
    expect(tokenizeJs(src).map((t) => t.text).join('')).toBe(src);
  });
  it('classifies keywords, identifiers, numbers, strings and comments', () => {
    expect(kinds('const x = 1.5e-3; // hi')).toEqual(['kw:const', 'id:x', 'punct:=', 'num:1.5e-3', 'punct:;', 'com:// hi']);
    expect(kinds("emit('loss', 0x1f)")).toEqual(['id:emit', 'punct:(', "str:'loss'", 'punct:,', 'num:0x1f', 'punct:)']);
  });
  it('a property named like a keyword is an identifier', () => {
    expect(kinds('a.default')).toEqual(['id:a', 'punct:.', 'id:default']);
  });
  it('tells a regex from a division', () => {
    expect(kinds('a / b / c').filter((k) => k.startsWith('regex'))).toEqual([]);
    expect(kinds('const r = /ab+c/i;')).toContain('regex:/ab+c/i');
    expect(kinds('return /x/.test(s)')).toContain('regex:/x/');
    expect(kinds('(a) / 2')).toContain('punct:/');
  });
  it('keeps template literals (with ${…}) in one string token', () => {
    expect(kinds('`a ${b + `c`} d`')).toEqual(['str:`a ${b + `c`} d`']);
  });
  it('survives unterminated strings and comments', () => {
    expect(tokenizeJs('"abc\nx').map((t) => t.text).join('')).toBe('"abc\nx');
    expect(kinds('/* open')).toEqual(['com:/* open']);
  });
});

describe('forbiddenSyntax', () => {
  it('refuses import() and import statements', () => {
    expect(forbiddenSyntax('const m = await import("x")')).toMatch(/import isn’t available/);
    expect(forbiddenSyntax('import x from "y"')).toMatch(/import/);
  });
  it('allows the word in strings, comments and properties', () => {
    expect(forbiddenSyntax('// import("x")\nconst s = "import(y)"; obj.import = 1;')).toBeNull();
    expect(forbiddenSyntax('const u = import.meta;')).toBeNull();
  });
});

describe('lineCol', () => {
  it('finds 1-based line and column', () => {
    expect(lineCol('ab\ncd', 4)).toEqual({ line: 2, col: 2 });
    expect(lineCol('ab', 0)).toEqual({ line: 1, col: 1 });
  });
});
