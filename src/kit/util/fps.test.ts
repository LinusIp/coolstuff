import { describe, expect, it } from 'vitest';
import { FpsMeter, QualityGovernor } from './fps';
import { debounce } from './dom';
import { clampedDpr, hasWebGL2, isTouchDevice, prefersReducedMotion, safeStorage } from './capabilities';

describe('fps governance', () => {
  it('measures a steady frame rate and clamps long gaps', () => {
    const m = new FpsMeter(10);
    let t = 0;
    for (let i = 0; i < 11; i++) m.tick((t += 20));
    expect(m.ready).toBe(true);
    expect(m.fps).toBeCloseTo(50, 6);
    m.tick((t += 5000)); // tab switch
    expect(m.fps).toBeCloseTo(1000 / ((9 * 20 + 250) / 10), 6); // the 5 s gap counts as 250 ms
    m.reset();
    expect(m.fps).toBe(60);
  });

  it('steps quality down when slow and back up when fast, with hysteresis', () => {
    const g = new QualityGovernor(2, 0, 3);
    let t = 0;
    let level: number | null = null;
    for (let i = 0; i < 60 && level === null; i++) level = g.tick((t += 30)); // ~33 fps
    expect(level).toBe(1);
    // Cooldown: no immediate second change.
    expect(g.tick((t += 30))).toBeNull();
    let up: number | null = null;
    for (let i = 0; i < 600 && up === null; i++) up = g.tick((t += 10)); // 100 fps
    expect(up).toBe(2);
  });
});

describe('Node-safe helpers', () => {
  it('capabilities report "no" without a window', () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(isTouchDevice()).toBe(false);
    expect(hasWebGL2()).toBe(false);
    expect(clampedDpr()).toBe(1);
    expect(safeStorage.get('x')).toBeNull();
    expect(() => safeStorage.set('x', '1')).not.toThrow();
  });

  it('debounce fires once on the trailing edge', async () => {
    let n = 0;
    const d = debounce(() => n++, 10);
    d();
    d();
    d();
    await new Promise((r) => setTimeout(r, 30));
    expect(n).toBe(1);
  });
});
