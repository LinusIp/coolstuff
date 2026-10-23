import { describe, expect, it } from 'vitest';
import { printWithClass, type PrintHost } from './dom';
import { inWorker } from './worker';

function fakeHost(blocking: boolean) {
  const classes = new Set<string>();
  const listeners = new Map<string, () => void>();
  let mediaFn: ((e: { matches: boolean }) => void) | null = null;
  const log: string[] = [];
  const host: PrintHost = {
    document: { body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } } },
    print: () => {
      log.push(`print with ${[...classes].join(' ')}`);
      if (blocking) listeners.get('afterprint')?.();
    },
    addEventListener: (t, fn) => listeners.set(t, fn),
    removeEventListener: (t) => listeners.delete(t),
    matchMedia: () => ({ matches: false, addEventListener: (_t, fn) => (mediaFn = fn), removeEventListener: () => (mediaFn = null) }),
  };
  return { host, classes, listeners, log, media: () => mediaFn };
}

describe('printWithClass', () => {
  it('keeps the class until afterprint when print() returns immediately (iOS Safari, Firefox Android)', () => {
    const f = fakeHost(false);
    printWithClass('print-card', f.host);
    expect(f.log).toEqual(['print with print-card']);
    expect(f.classes.has('print-card')).toBe(true); // not removed synchronously
    f.listeners.get('afterprint')!();
    expect(f.classes.has('print-card')).toBe(false);
    expect(f.media()).toBeNull();
  });

  it('also cleans up when the print media query turns off, or on demand', () => {
    const f = fakeHost(false);
    printWithClass('print-card', f.host);
    f.media()!({ matches: false });
    expect(f.classes.has('print-card')).toBe(false);
    const g = fakeHost(false);
    const stop = printWithClass('print-card', g.host);
    stop();
    stop();
    expect(g.classes.has('print-card')).toBe(false);
  });

  it('works when print() blocks (desktop browsers)', () => {
    const f = fakeHost(true);
    printWithClass('print-card', f.host);
    expect(f.classes.has('print-card')).toBe(false);
    expect(printWithClass('x', undefined)).toBeTypeOf('function');
  });

  it('inWorker is false in Node', () => expect(inWorker()).toBe(false));
});
