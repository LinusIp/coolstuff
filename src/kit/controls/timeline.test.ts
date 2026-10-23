import { describe, expect, it } from 'vitest';
import { clampIndex, frameCounter, frameInterval, nearestToLine, playStart, playTick, stepIndex } from './timeline';

describe('stepIndex', () => {
  it('clamps at the ends without wrap', () => {
    expect(stepIndex(0, -1, 4)).toBe(0);
    expect(stepIndex(3, 1, 4)).toBe(3);
    expect(stepIndex(1, 1, 4)).toBe(2);
  });
  it('wraps around with wrap', () => {
    expect(stepIndex(3, 1, 4, true)).toBe(0);
    expect(stepIndex(0, -1, 4, true)).toBe(3);
  });
  it('handles empty and out-of-range inputs', () => {
    expect(stepIndex(0, 1, 0)).toBe(0);
    expect(stepIndex(9, 1, 4)).toBe(3);
    expect(stepIndex(-5, -1, 4)).toBe(0);
    expect(clampIndex(Number.NaN, 4)).toBe(0);
    expect(clampIndex(2.6, 4)).toBe(3);
  });
});

describe('frameInterval', () => {
  it('turns fps into milliseconds', () => {
    expect(frameInterval(2, false)).toBe(500);
    expect(frameInterval(10, false)).toBe(100);
  });
  it('never exceeds 2 fps under reduced motion', () => {
    expect(frameInterval(10, true)).toBe(500);
    expect(frameInterval(1, true)).toBe(1000);
  });
  it('falls back to 2 fps for nonsense and caps at 60', () => {
    expect(frameInterval(0, false)).toBe(500);
    expect(frameInterval(Number.NaN, false)).toBe(500);
    expect(frameInterval(1000, false)).toBeCloseTo(1000 / 60);
  });
});

describe('playTick / playStart', () => {
  it('advances and stops on the last frame', () => {
    expect(playTick(0, 3, false)).toEqual({ frame: 1, stop: false });
    expect(playTick(1, 3, false)).toEqual({ frame: 2, stop: true });
    expect(playTick(2, 3, false)).toEqual({ frame: 2, stop: true });
  });
  it('loops back to 0 with loop', () => {
    expect(playTick(1, 3, true)).toEqual({ frame: 2, stop: false });
    expect(playTick(2, 3, true)).toEqual({ frame: 0, stop: false });
  });
  it('a one-frame timeline never plays', () => {
    expect(playTick(0, 1, true)).toEqual({ frame: 0, stop: true });
  });
  it('play from the end restarts at 0', () => {
    expect(playStart(4, 5)).toBe(0);
    expect(playStart(2, 5)).toBe(2);
  });
  it('counter is 1-based', () => {
    expect(frameCounter(0, 12)).toBe('1 / 12');
    expect(frameCounter(11, 12)).toBe('12 / 12');
    expect(frameCounter(0, 0)).toBe('0 / 0');
  });
});

describe('nearestToLine (Scrolly)', () => {
  const boxes = [
    { top: -400, bottom: -100 },
    { top: 0, bottom: 300 },
    { top: 360, bottom: 700 },
  ];
  it('picks the box the line passes through', () => {
    expect(nearestToLine(boxes, 150)).toBe(1);
    expect(nearestToLine(boxes, 500)).toBe(2);
  });
  it('else the nearest edge', () => {
    expect(nearestToLine(boxes, 320)).toBe(1);
    expect(nearestToLine(boxes, 350)).toBe(2);
    expect(nearestToLine(boxes, 2000)).toBe(2);
    expect(nearestToLine(boxes, -1000)).toBe(0);
  });
  it('an empty list gives 0', () => {
    expect(nearestToLine([], 10)).toBe(0);
  });
});
