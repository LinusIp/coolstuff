import { describe, expect, it } from 'vitest';
import { Game, type GameEvents } from './game';
import { FLIP_TIME, GRAVITY, FLIP_KICK, REST_Y, flipY } from './world';

const quiet: GameEvents = { flip() {}, land() {}, orb() {}, close() {}, death() {}, zone() {} };

function run(seed: number, bias: number, meters: number): Game {
  const g = new Game(seed, quiet, true, true);
  g.pilotBias = bias;
  for (let i = 0; i < 120 * 60 * 40 && g.alive && g.meters < meters; i++) g.step(1 / 120);
  return g;
}

describe('flip physics', () => {
  it('FLIP_TIME is exactly the time to cross the corridor', () => {
    expect(flipY(1, FLIP_TIME)).toBeCloseTo(-REST_Y, 6);
    expect(flipY(-1, FLIP_TIME)).toBeCloseTo(REST_Y, 6);
    expect(GRAVITY).toBeGreaterThan(0);
    expect(FLIP_KICK).toBeGreaterThan(0);
  });
});

describe('track fairness', () => {
  // If the generator ever produced an impossible section, a pilot that flips
  // inside the advertised window would die. Test the middle and both edges.
  for (const bias of [0, 0.5, 1]) {
    it(`a pilot flipping at ${Math.round(bias * 100)}% of each window survives 6000 m`, () => {
      for (const seed of [1, 7, 42, 1234, 99999, 31337, 2026, 8]) {
        const g = run(seed, bias, 6000);
        expect(g.alive, `seed ${seed} died at ${Math.floor(g.meters)} m`).toBe(true);
      }
    });
  }

  it('is deterministic for a given seed', () => {
    const a = run(5, 0.55, 800);
    const b = run(5, 0.55, 800);
    expect(a.score).toBe(b.score);
    expect(a.orbs).toBe(b.orbs);
  });
});
