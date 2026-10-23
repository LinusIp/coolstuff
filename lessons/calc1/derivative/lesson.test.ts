/**
 * The derivative as slope and as rate: the lesson's tests (CLAUDE.md §10). While the content is a wip
 * stub (no problems yet), the audits, the answer checks and the snippet
 * check are skipped; from the first problem on they all run, and the answer
 * check fails until it is written.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSON_BY_ID } from '@content/curriculum';
import { derivative, integrate, linspace } from '@kit/math';
import { auditFigureKeys, auditLesson, runSnippet } from '@kit/pure';
import { FIGURES } from './figures';
import {
  GAUGE_MAX,
  H_MAX,
  TRIP_END,
  H_MIN,
  MATCH_TOLERANCE,
  clampMoment,
  closeWithin,
  dialPoint,
  gaugeAngle,
  secant,
  secantGap,
  settledDecimals,
  tangentLine,
  tripAcceleration,
  tripPosition,
  tripSpeed,
} from './math';
import * as content from './problems';

/** The skeleton `npm run new` made: no problems written yet. */
const STUB = content.PROBLEMS.length === 0;

/** meta.json, read as text so this file also loads inside scripts/lesson-template, where it still has {{placeholders}}. */
function readMeta(): { status?: string } | null {
  try {
    return JSON.parse(readFileSync(new URL('./meta.json', import.meta.url), 'utf8')) as { status?: string };
  } catch {
    return null;
  }
}

describe('calc1/derivative', () => {
  it('stays "wip" while it is a skeleton', () => {
    const meta = readMeta();
    if (STUB && meta) expect(meta.status).toBe('wip');
  });

  it.skipIf(STUB)('passes the kit audits', () => {
    expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]); // §4/§5/§10/§11 in one call
    expect(auditFigureKeys(content, FIGURES)).toEqual([]); // every figure key has a renderer
  });

  it.skipIf(STUB)('every stated answer is right (computed independently)', () => {
    expect.fail('wip: write the independent answer checks');
  });

  it.skipIf(STUB)('the Code it snippet runs and does what the lesson says', () => {
    const r = runSnippet(content.SNIPPETS.main, { inputs: {} });
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
  });
});

describe('math.ts: the car in stop-and-go traffic', () => {
  const ts = linspace(0, TRIP_END, 241);

  it('the speedometer reading is the exact derivative of the position (central differences agree)', () => {
    for (const t of ts) expect(tripSpeed(t)).toBeCloseTo(derivative(tripPosition, t), 6);
    for (const t of ts) expect(tripAcceleration(t)).toBeCloseTo(derivative(tripSpeed, t), 6);
  });

  it('integrating the speed gives back the distance covered (the other direction)', () => {
    expect(integrate(tripSpeed, 0, 6, 400)).toBeCloseTo(tripPosition(6) - tripPosition(0), 6);
  });

  it('tells the story the caption tells: rest, 8 m/s, standstill at 6 s, 8 m/s, rest', () => {
    expect(tripPosition(0)).toBe(0);
    expect(tripSpeed(0)).toBeCloseTo(0, 12);
    expect(tripSpeed(3)).toBeCloseTo(8, 12);
    expect(tripSpeed(6)).toBeCloseTo(0, 12);
    expect(tripSpeed(9)).toBeCloseTo(8, 12);
    expect(tripPosition(6)).toBeCloseTo(24, 12);
    expect(tripPosition(12)).toBeCloseTo(48, 12);
    // round speedometer readings at whole seconds
    expect([1, 2, 4, 5].map((t) => tripSpeed(t))).toEqual([2, 6, 6, 2].map((v) => expect.closeTo(v, 12)));
  });

  it('never reverses (so speed = velocity) and never exceeds the dial', () => {
    for (const t of ts) {
      expect(tripSpeed(t)).toBeGreaterThanOrEqual(-1e-12);
      expect(tripSpeed(t)).toBeLessThanOrEqual(GAUGE_MAX);
    }
    for (let i = 1; i < ts.length; i++) expect(tripPosition(ts[i])).toBeGreaterThanOrEqual(tripPosition(ts[i - 1]));
  });

  it('averages 4 m/s over the first six seconds although the speedometer swings from 0 to 8', () => {
    expect(secant(tripPosition, 0, 6).slope).toBeCloseTo(4, 12);
  });
});

describe('math.ts: secants become tangents', () => {
  it('a secant carries its run, rise and slope', () => {
    const s = secant((x) => x * x, 1, 0.5);
    expect(s.p).toEqual([1, 1]);
    expect(s.q).toEqual([1.5, 2.25]);
    expect(s.run).toBe(0.5);
    expect(s.rise).toBeCloseTo(1.25, 12);
    expect(s.slope).toBeCloseTo(2.5, 12); // (x+h)² − x² over h = 2x + h
  });

  it('the slope of x² at 1 is what (2 + h) settles on: 3, 2.1, 2.01, 2.001 → 2', () => {
    for (const h of [1, 0.1, 0.01, 0.001]) expect(secant((x) => x * x, 1, h).slope).toBeCloseTo(2 + h, 9);
  });

  it('is undefined at h = 0: you cannot divide by the zero run', () => {
    expect(secant(tripPosition, 2, 0).slope).toBeNaN();
  });

  it('closes in on the speedometer as h → 0, about f″(t)·h/2 away (first order)', () => {
    for (const t of [0.5, 1, 4, 5, 7.5, 10]) {
      const k = tripAcceleration(t) / 2;
      for (const h of [0.01, 0.001]) {
        const gap = secantGap(tripPosition, tripSpeed, t, h);
        expect(Math.abs(gap - k * h)).toBeLessThan(2 * h * h); // the next Taylor term is s‴·h²/6, |s‴| ≤ 4.4
      }
      expect(Math.abs(secantGap(tripPosition, tripSpeed, t, 0.001))).toBeLessThan(0.0025);
    }
  });

  it('closes in from both sides (negative h too)', () => {
    for (const h of [-0.1, -0.01, -0.001]) expect(Math.abs(secantGap(tripPosition, tripSpeed, 4, h))).toBeLessThan(2 * Math.abs(h));
  });

  it('the tangent line touches the curve at a and has slope m', () => {
    const L = tangentLine(tripPosition, 4, tripSpeed(4));
    expect(L(4)).toBeCloseTo(tripPosition(4), 12);
    expect(L(5) - L(4)).toBeCloseTo(6, 12);
  });
});

describe('math.ts: display helpers', () => {
  it('shows more decimals as h shrinks, between 2 and 4', () => {
    expect([2, 1, 0.5, 0.1, 0.05, 0.01, 0.005, 0.001].map(settledDecimals)).toEqual([2, 2, 2, 2, 3, 3, 4, 4]);
    expect(settledDecimals(0)).toBe(4);
    expect(settledDecimals(-0.01)).toBe(3);
  });

  it('a match means within 0.01 m/s, and the smallest h reaches it at every moment of the trip', () => {
    expect(closeWithin(6.0018, 6)).toBe(true);
    expect(closeWithin(6.012, 6)).toBe(false);
    for (const t of linspace(0, TRIP_END - H_MIN, 601)) expect(Math.abs(secantGap(tripPosition, tripSpeed, t, H_MIN))).toBeLessThan(MATCH_TOLERANCE / 2);
  });

  it('keeps t + h on the trip', () => {
    expect(clampMoment(11.5, H_MAX)).toBe(TRIP_END - H_MAX);
    expect(clampMoment(-1, 0.5)).toBe(0);
    expect(clampMoment(4, 2)).toBe(4);
  });

  it('maps speeds to a half dial: 0 points left, full scale points right, out of range pins', () => {
    expect(gaugeAngle(0)).toBeCloseTo(Math.PI, 12);
    expect(gaugeAngle(GAUGE_MAX / 2)).toBeCloseTo(Math.PI / 2, 12);
    expect(gaugeAngle(GAUGE_MAX)).toBeCloseTo(0, 12);
    expect(gaugeAngle(-3)).toBeCloseTo(Math.PI, 12);
    expect(gaugeAngle(99)).toBeCloseTo(0, 12);
    const [x, y] = dialPoint(100, 100, 50, Math.PI / 2);
    expect(x).toBeCloseTo(100, 12);
    expect(y).toBeCloseTo(50, 12); // straight up on screen
  });
});
