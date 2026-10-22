/**
 * The procedural track. The corridor is a sequence of blocks; each block says
 * what the floor and the ceiling are doing over a stretch of x. Every flip the
 * player must make has a timing window that stays at least half a flip wide
 * even for someone who made the previous flip as late as possible, so the
 * track is always fair: difficulty comes from speed, shorter breathers and
 * tighter rhythms, never from impossible gaps.
 */
import { Rng } from './rng';

/** 1 = floor (gravity points down), -1 = ceiling (gravity points up). */
export type Side = 1 | -1;
export type Surface = 'solid' | 'gap' | 'spikes';

export interface Block {
  x0: number;
  x1: number;
  floor: Surface;
  ceil: Surface;
  /** Closest the player came to this block's spikes, for near-miss bonuses. */
  clearance: number;
  scored: boolean;
}

export interface Orb {
  x: number;
  y: number;
  taken: boolean;
  missed: boolean;
  /** Orbs on a flip arc are worth more: you only get them by flipping on the beat. */
  arc: boolean;
}

/** Where a perfect player would flip. The attract-mode autopilot follows these. */
export interface FlipPlan {
  x: number;
  /** The fair window: flipping anywhere in [lo, hi] survives. */
  lo: number;
  hi: number;
  to: Side;
}

// Corridor geometry, in world units. The screen scales these to fit.
export const HALF_H = 150;
export const PLAYER = 26;
export const REST_Y = HALF_H - PLAYER / 2;
export const SPIKE_H = 22;
export const GRAVITY = 3600;
export const FLIP_KICK = 300;
export const METER = 50;

/** Time to cross the corridor after a flip: solve REST_Y*2 = v0·t + ½·g·t². */
export const FLIP_TIME = (-FLIP_KICK + Math.sqrt(FLIP_KICK ** 2 + 2 * GRAVITY * REST_Y * 2)) / GRAVITY;

export function speedAt(x: number): number {
  const m = x / METER;
  return 340 + 300 * (1 - Math.exp(-m / 900));
}

export function difficultyAt(x: number): number {
  return 1 - Math.exp(-x / METER / 1100);
}

/** y of the player's centre along a flip that starts on `from` at time t. */
export function flipY(from: Side, t: number): number {
  const dir = -from;
  return from * REST_Y + dir * (FLIP_KICK * t + 0.5 * GRAVITY * t * t);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class World {
  blocks: Block[] = [];
  orbs: Orb[] = [];
  plan: FlipPlan[] = [];
  private end = 0;
  private side: Side = 1;
  /** Latest x where a player who flipped as late as allowed would land. */
  private latestLanding = 0;
  private rng: Rng;

  constructor(seed: number) {
    this.rng = new Rng(seed);
    this.push(900, 'solid', 'solid');
    this.latestLanding = 0;
  }

  /** Generate track until at least `x`, and drop what's far behind `behind`. */
  update(x: number, behind: number): void {
    while (this.end < x) this.chunk();
    while (this.blocks.length > 2 && this.blocks[1].x1 < behind) this.blocks.shift();
    this.orbs = this.orbs.filter((o) => o.x > behind - 100);
    this.plan = this.plan.filter((p) => p.x > behind - 400);
  }

  blockAt(x: number): Block | undefined {
    // Blocks are few (a screen or two of track), so a linear scan is plenty.
    for (const b of this.blocks) if (x >= b.x0 && x < b.x1) return b;
    return undefined;
  }

  surfaceAt(side: Side, x: number): Surface {
    const b = this.blockAt(x);
    if (!b) return 'solid';
    return side === 1 ? b.floor : b.ceil;
  }

  /** Is there solid ground for a player of half-width `hw` centred at x? */
  supported(side: Side, x: number, hw: number): boolean {
    return this.surfaceAt(side, x - hw) === 'solid' || this.surfaceAt(side, x + hw) === 'solid';
  }

  private push(len: number, floor: Surface, ceil: Surface): void {
    const x0 = this.end;
    this.end += len;
    const last = this.blocks[this.blocks.length - 1];
    // Merge identical neighbours so rendering draws long clean lines.
    if (last && last.floor === floor && last.ceil === ceil && last.x1 === x0) {
      last.x1 = this.end;
      return;
    }
    this.blocks.push({ x0, x1: this.end, floor, ceil, clearance: Infinity, scored: false });
  }

  private hazard(): Surface {
    return this.rng.chance(0.5) ? 'gap' : 'spikes';
  }

  /** A stretch where only side `s` is safe. */
  private require(s: Side, len: number): void {
    const h = this.hazard();
    if (s === 1) this.push(len, 'solid', h);
    else this.push(len, h, 'solid');
  }

  /**
   * Plan a flip to `to` whose window closes at `hi` (where the old side
   * becomes unsafe) and opens no earlier than `lo`.
   */
  private planFlip(to: Side, lo: number, hi: number, withArc: boolean): void {
    lo = Math.max(lo, this.latestLanding + 8);
    const x = lo + (hi - lo) * 0.55;
    this.plan.push({ x, lo, hi, to });
    if (withArc) {
      const v = speedAt(x);
      for (const f of [0.3, 0.55, 0.8]) {
        const t = FLIP_TIME * f;
        this.orbs.push({ x: x + v * t, y: flipY(-to as Side, t), taken: false, missed: false, arc: true });
      }
    }
    this.latestLanding = hi + speedAt(hi) * FLIP_TIME + PLAYER / 2;
    this.side = to;
  }

  private surfaceOrbs(s: Side, from: number, to: number): void {
    const count = Math.min(5, Math.floor((to - from) / 70));
    for (let i = 0; i < count; i++) {
      this.orbs.push({ x: from + 20 + i * 48, y: s * (REST_Y - 4), taken: false, missed: false, arc: false });
    }
  }

  private chunk(): void {
    const D = difficultyAt(this.end);
    const v = speedAt(this.end);
    const d = v * FLIP_TIME;
    const r = this.rng;
    // Window edges are pulled in by the player's half-width plus the time it
    // takes to clear (or settle past) a spike row, so both edges are survivable.
    const mLo = PLAYER / 2 + 10 + v * 0.03;
    const mHi = PLAYER / 2 + 4 + v * 0.04;
    // Every forced switch gets at least this much open corridor before it.
    const overlap = () => d * lerp(0.6, 0.2, D);
    // Required stretches are longer than one flip, so even a player who flips
    // at the last possible moment lands with time to spare.
    const reqLen = () => d * r.range(lerp(1.7, 1.15, D), lerp(3.6, 2.0, D));
    const breather = () => d * r.range(lerp(1.6, 0.25, D), lerp(4.5, 1.4, D));

    // If a player who flipped as late as allowed would still be in the air, give
    // them open corridor first: every window stays comfortably wide.
    const overhang = this.latestLanding + d * 0.5 - this.end;
    if (overhang > 0) this.push(overhang, 'solid', 'solid');

    const roll = r.next();
    if (roll < 0.12 + (1 - D) * 0.18) {
      // Rest: open corridor, a free orb arc across it.
      const len = d * r.range(3, 5);
      const x0 = this.end;
      this.push(len, 'solid', 'solid');
      if (r.chance(0.6)) this.planFlip(-this.side as Side, x0 + d * 0.5, x0 + len - d * 1.15, true);
    } else if (roll < 0.7) {
      // Switch: open corridor, then the other side becomes mandatory.
      const to = -this.side as Side;
      const b = Math.max(overlap(), r.chance(lerp(0.9, 0.4, D)) ? breather() : 0);
      const x0 = this.end;
      this.push(b, 'solid', 'solid');
      const X = this.end;
      const len = reqLen();
      this.require(to, len);
      this.planFlip(to, x0 - d + mLo, X - mHi, b > d * 0.9 && r.chance(0.7));
      if (len > d * 1.6) this.surfaceOrbs(to, X + d + 10, X + len - 10);
    } else if (roll < 0.86) {
      // Zigzag: a quick rhythm of forced flips with only a sliver of open corridor.
      const n = r.int(2, D > 0.5 ? 5 : 3);
      for (let i = 0; i < n; i++) {
        const to = -this.side as Side;
        const x0 = this.end;
        this.push(overlap(), 'solid', 'solid');
        const X = this.end;
        this.require(to, d * r.range(lerp(1.8, 1.5, D), lerp(2.6, 1.9, D)));
        this.planFlip(to, x0 - d + mLo, X - mHi, false);
      }
    } else {
      // Stay: the side you're on stays safe while the other turns hostile.
      const len = reqLen() * 1.2;
      const X = this.end;
      this.require(this.side, len);
      this.surfaceOrbs(this.side, Math.max(X, this.latestLanding) + 10, X + len - 10);
    }
  }
}
