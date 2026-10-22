import { FLIP_KICK, GRAVITY, HALF_H, METER, PLAYER, REST_Y, SPIKE_H, World, speedAt, type Side } from './world';

export interface GameEvents {
  flip(toCeiling: boolean): void;
  land(): void;
  orb(combo: number, arc: boolean): void;
  close(): void;
  death(): void;
  zone(index: number): void;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: 'player' | 'orb' | 'line' | 'spike' | 'white';
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: 'orb' | 'line' | 'white';
}

const HW = PLAYER / 2;
export const ZONE_METERS = 500;
const COYOTE = 0.08;
const BUFFER = 0.12;

/**
 * The simulation: runs at a fixed 120 Hz step so jumps feel identical on a
 * 60 Hz phone and a 144 Hz monitor. Rendering only reads this state.
 */
export class Game {
  world: World;
  x = 0;
  y = REST_Y;
  vy = 0;
  gravity: Side = 1;
  grounded = true;
  alive = true;
  time = 0;
  deathTime = 0;

  orbs = 0;
  combo = 0;
  bestCombo = 0;
  closes = 0;
  bonus = 0;
  zone = 0;

  // Presentation state the renderer reads.
  rot = 0;
  rotTarget = 0;
  squash = 0;
  shake = 0;
  flash = 0;
  trail: { x: number; y: number }[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];

  private lastGrounded = 0;
  private flippedInAir = false;
  private bufferUntil = -1;
  private trailTick = 0;

  constructor(
    seed: number,
    private readonly events: GameEvents,
    readonly autopilot = false,
    private readonly lowFx = false,
  ) {
    this.world = new World(seed);
    this.world.update(2000, -500);
  }

  get meters(): number {
    return this.x / METER;
  }

  get score(): number {
    return Math.floor(this.meters) + this.bonus;
  }

  get speed(): number {
    return speedAt(this.x);
  }

  requestFlip(): void {
    if (!this.alive) return;
    if (this.canFlip()) this.flip();
    else this.bufferUntil = this.time + BUFFER; // pressed slightly early: flip on landing
  }

  private canFlip(): boolean {
    return this.grounded || (!this.flippedInAir && this.time - this.lastGrounded < COYOTE);
  }

  private flip(): void {
    this.gravity = -this.gravity as Side;
    this.vy = this.gravity * FLIP_KICK;
    this.grounded = false;
    this.flippedInAir = true;
    this.bufferUntil = -1;
    this.rotTarget += Math.PI * (this.gravity === -1 ? 1 : -1);
    this.burst(this.x, this.y - this.gravity * HW, 8, 'line', 160, -this.gravity);
    this.events.flip(this.gravity === -1);
  }

  step(dt: number): void {
    this.time += dt;
    this.updateFx(dt);
    if (!this.alive) return;

    this.x += this.speed * dt;
    this.world.update(this.x + 2400, this.x - 900);

    if (this.autopilot) this.pilot();
    if (this.bufferUntil > this.time && this.canFlip()) this.flip();

    const prevY = this.y;
    this.vy += this.gravity * GRAVITY * dt;
    this.y += this.vy * dt;

    const g = this.gravity;
    if (this.grounded) {
      this.y = g * REST_Y;
      this.vy = 0;
      if (!this.world.supported(g, this.x, HW * 0.55)) {
        // Ran off an edge: start falling toward the void (and allow a coyote flip).
        this.grounded = false;
        this.flippedInAir = false;
        this.lastGrounded = this.time;
      }
    } else if (g * this.y >= REST_Y) {
      const wasInside = g * prevY <= REST_Y + 0.5;
      if (wasInside && this.world.supported(g, this.x, HW * 0.7)) {
        this.land();
      } else if (!wasInside && g * this.y < HALF_H + HW && this.world.supported(g, this.x, HW - 2)) {
        this.die(); // clipped the edge of the next platform while falling
      } else if (g * this.y > HALF_H + 120) {
        this.die(); // fell out of the world
      }
    }

    this.checkSpikes();
    this.checkOrbs();

    const zone = Math.floor(this.meters / ZONE_METERS);
    if (zone !== this.zone) {
      this.zone = zone;
      this.events.zone(zone);
    }
  }

  private land(): void {
    this.y = this.gravity * REST_Y;
    this.vy = 0;
    this.grounded = true;
    this.flippedInAir = false;
    this.squash = 1;
    this.burst(this.x, this.gravity * HALF_H, 6, 'line', 120, -this.gravity);
    this.events.land();
  }

  /** Show a "TAP" cue inside flip windows (first few runs only). */
  hints = false;

  /** The flip window the player is in right now, if the cue should show. */
  get cue(): boolean {
    if (!this.hints || !this.alive || !this.grounded) return false;
    const p = this.world.plan.find((q) => q.hi >= this.x);
    return !!p && p.to !== this.gravity && this.x >= p.lo - 30;
  }

  /** Where in each flip window the autopilot flips: 0 = earliest, 1 = latest. */
  pilotBias = 0.55;

  private pilot(): void {
    const plan = this.world.plan;
    const at = (p: (typeof plan)[number]) => p.lo + (p.hi - p.lo) * this.pilotBias;
    while (plan.length && at(plan[0]) < this.x) {
      const p = plan.shift()!;
      if (p.to !== this.gravity && this.canFlip()) this.flip();
    }
  }

  private checkSpikes(): void {
    const px0 = this.x - HW + 3;
    const px1 = this.x + HW - 3;
    const py0 = this.y - HW + 3;
    const py1 = this.y + HW - 3;
    for (const b of this.world.blocks) {
      if (b.x0 > this.x + 400) break;
      for (const side of [1, -1] as Side[]) {
        if ((side === 1 ? b.floor : b.ceil) !== 'spikes') continue;
        // Hitbox is a little smaller than the drawing so deaths feel fair.
        const tip = side * (HALF_H - SPIKE_H + 8);
        const sy0 = Math.min(tip, side * HALF_H);
        const sy1 = Math.max(tip, side * HALF_H);
        const sx0 = b.x0 + 5;
        const sx1 = b.x1 - 5;
        if (px1 > sx0 && px0 < sx1 && py1 > sy0 && py0 < sy1) {
          this.die();
          return;
        }
        const dx = Math.max(sx0 - px1, px0 - sx1, 0);
        const dy = Math.max(sy0 - py1, py0 - sy1, 0);
        b.clearance = Math.min(b.clearance, Math.hypot(dx, dy));
      }
      if (!b.scored && b.x1 < this.x - HW) {
        b.scored = true;
        if (b.clearance < 16) this.nearMiss();
      }
    }
  }

  private nearMiss(): void {
    this.closes++;
    this.bonus += 25;
    this.texts.push({ x: this.x, y: this.y - this.gravity * 34, text: 'CLOSE +25', life: 0.9, color: 'white' });
    this.events.close();
  }

  private checkOrbs(): void {
    for (const o of this.world.orbs) {
      if (o.taken || o.missed) continue;
      if (Math.abs(o.x - this.x) < HW + 11 && Math.abs(o.y - this.y) < HW + 11) {
        o.taken = true;
        this.orbs++;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const mult = Math.min(this.combo, 10);
        const pts = 5 * mult * (o.arc ? 2 : 1);
        this.bonus += pts;
        this.burst(o.x, o.y, this.lowFx ? 6 : 12, 'orb', 220, 0);
        this.texts.push({ x: o.x, y: o.y - 18, text: `+${pts}`, life: 0.6, color: 'orb' });
        this.events.orb(this.combo, o.arc);
      } else if (o.x < this.x - HW - 12) {
        o.missed = true;
        this.combo = 0;
      }
    }
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.deathTime = this.time;
    this.shake = 1;
    this.flash = 1;
    this.burst(this.x, this.y, this.lowFx ? 24 : 60, 'player', 520, 0);
    this.burst(this.x, this.y, this.lowFx ? 8 : 20, 'white', 300, 0);
    this.events.death();
  }

  private burst(x: number, y: number, n: number, color: Particle['color'], speed: number, bias: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s + (bias === 0 ? 0 : -this.speed * 0.15),
        vy: Math.sin(a) * s + bias * speed * 0.6,
        life: 0,
        max: 0.35 + Math.random() * 0.45,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  private updateFx(dt: number): void {
    // Visual rotation eases toward the flip target (critically damped feel).
    this.rot += (this.rotTarget - this.rot) * Math.min(1, dt * 16);
    this.squash = Math.max(0, this.squash - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 3);

    if (this.alive && ++this.trailTick % 2 === 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 12) this.trail.shift();
    }
    for (const p of this.particles) {
      p.life += dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }
}
