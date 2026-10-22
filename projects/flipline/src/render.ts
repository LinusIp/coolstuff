import type { Game, Particle } from './game';
import { css, type Palette, type RGB } from './palettes';

const mixWhite = (c: RGB, t: number): RGB => [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
import { HALF_H, PLAYER, SPIKE_H } from './world';

/** Logical view size the corridor is fitted into; the rest is scenery. */
const VIEW_H = 620;
const VIEW_W_MIN = 700;

export interface View {
  scale: number;
  w: number;
  h: number;
  cy: number;
}

/**
 * Draws the game with Canvas 2D. Glow is faked by stroking each neon shape
 * twice (wide + faint, then thin + bright) with additive blending, which is
 * far cheaper than shadowBlur and looks the same at a glance.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private sun: HTMLCanvasElement = document.createElement('canvas');
  private sunKey = '';
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  view: View = { scale: 1, w: 0, h: 0, cy: 0 };
  dpr = 1;
  glow = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: Math.random(), y: Math.random() ** 1.6, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 });
    }
  }

  resize(dpr: number): void {
    this.dpr = dpr;
    const w = innerWidth;
    const h = innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // Fit the corridor's height, but keep enough track visible ahead on narrow phones.
    const scale = Math.min(h / VIEW_H, w / VIEW_W_MIN);
    this.view = { scale, w, h, cy: h * (w < h ? 0.52 : 0.5) };
    this.sunKey = '';
  }

  draw(game: Game, pal: Palette, t: number, shakeOn: boolean): void {
    const { ctx, dpr } = this;
    const { w, h, scale, cy } = this.view;
    const viewW = w / scale;
    const camX = game.x - viewW * 0.22;
    const lean = -game.y * 0.06;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    let sx = 0;
    let sy = 0;
    if (shakeOn && game.shake > 0) {
      const s = game.shake ** 2 * 14;
      sx = (Math.random() - 0.5) * s;
      sy = (Math.random() - 0.5) * s;
    }

    this.background(pal, camX, t, cy + (HALF_H * 0.3 + lean) * scale);

    // World space: origin at the corridor centre line.
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (sx - camX * scale), dpr * (cy + sy + lean * scale));
    const x0 = camX - 40;
    const x1 = camX + viewW + 40;

    // A faint band behind the track keeps it readable over the busy scenery.
    ctx.fillStyle = css(pal.skyTop, 0.42);
    ctx.fillRect(x0, -HALF_H, x1 - x0, HALF_H * 2);

    this.track(game, pal, x0, x1);
    this.orbs(game, pal, x0, x1, t);
    this.player(game, pal);
    this.particles(game.particles, pal);
    this.texts(game, pal);
    if (game.cue) this.cue(game, pal, t);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (game.flash > 0 && shakeOn) {
      ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private background(pal: Palette, camX: number, t: number, horizon: number): void {
    const { ctx } = this;
    const { w, h, scale } = this.view;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, css(pal.skyTop));
    sky.addColorStop(1, css(pal.skyLow));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 1);

    for (const s of this.stars) {
      const x = (((s.x * w - camX * scale * 0.02) % w) + w) % w;
      const tw = 0.45 + 0.55 * Math.sin(t * 1.7 + s.p);
      ctx.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.55})`;
      ctx.fillRect(x, s.y * horizon * 0.85, s.r, s.r);
    }

    // Sun: cached (gradient + cut-out stripes), redrawn only when colours change.
    const r = Math.min(w * 0.3, h * 0.26, 260);
    const key = `${r | 0}|${pal.sunTop.map((c) => c | 0)}|${pal.sunLow.map((c) => c | 0)}`;
    if (key !== this.sunKey) this.paintSun(r, pal);
    ctx.drawImage(this.sun, w * 0.64 - r, horizon - r * 1.28, r * 2, r * 2);

    this.mountains(pal, camX * scale * 0.04, horizon, h * 0.09, 0.0045, 3, 0.75);
    this.mountains(pal, camX * scale * 0.1, horizon, h * 0.05, 0.009, 7, 1);

    // Ground + perspective grid that scrolls with the run.
    ctx.fillStyle = css(pal.skyTop);
    ctx.fillRect(0, horizon, w, h - horizon);
    const grad = ctx.createLinearGradient(0, horizon, 0, h);
    grad.addColorStop(0, css(pal.grid, 0));
    grad.addColorStop(0.25, css(pal.grid, 0.35));
    grad.addColorStop(1, css(pal.grid, 0.9));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    const depth = h - horizon;
    const scroll = (camX * 0.004) % 1;
    for (let i = 0; i < 16; i++) {
      const z = i + 1 - scroll;
      const y = horizon + depth * (1.4 / (z + 0.4)) - depth * 0.05;
      if (y < horizon || y > h) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    const vp = w * 0.5;
    const spread = w * 0.11;
    const shift = ((camX * scale * 0.35) % spread) / spread;
    for (let i = -14; i <= 14; i++) {
      const bx = vp + (i - shift) * spread * 1.6;
      ctx.moveTo(vp + (bx - vp) * 0.05, horizon);
      ctx.lineTo(vp + (bx - vp) * 2.2, h + depth);
    }
    ctx.stroke();

    // Horizon glow line.
    ctx.fillStyle = css(pal.sunLow, 0.55);
    ctx.fillRect(0, horizon - 1, w, 2);
  }

  private paintSun(r: number, pal: Palette): void {
    const c = this.sun;
    c.width = c.height = Math.ceil(r * 2 * this.dpr);
    const g = c.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, r * 2);
    grad.addColorStop(0.1, css(pal.sunTop));
    grad.addColorStop(0.75, css(pal.sunLow));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
    // Classic retro stripes, getting thicker toward the bottom.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const y = r * (0.5 + i * 0.16);
      g.fillRect(0, y, r * 2, 1 + i * 1.7);
    }
    this.sunKey = `${r | 0}|${pal.sunTop.map((v) => v | 0)}|${pal.sunLow.map((v) => v | 0)}`;
  }

  private mountains(pal: Palette, offset: number, base: number, height: number, freq: number, seed: number, alpha: number): void {
    const { ctx } = this;
    const { w } = this.view;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= w + 8; x += 8) {
      const u = x + offset;
      const n =
        Math.sin(u * freq + seed) * 0.5 +
        Math.sin(u * freq * 2.3 + seed * 1.7) * 0.3 +
        Math.abs(Math.sin(u * freq * 5.1 + seed * 0.3)) * 0.25;
      ctx.lineTo(x, base - height * (0.55 + n * 0.6));
    }
    ctx.lineTo(w, base);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(pal.mountain);
    ctx.fill();
    ctx.strokeStyle = css(pal.grid, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Stroke a path twice for a cheap neon glow. */
  private neon(path: Path2D, color: string, glowColor: string, width: number): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (this.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = width * 4.5;
      ctx.stroke(path);
      ctx.lineWidth = width * 2.2;
      ctx.stroke(path);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }

  private track(game: Game, pal: Palette, x0: number, x1: number): void {
    const { ctx } = this;
    const solid = new Path2D();
    const spikes = new Path2D();
    const caps = new Path2D();
    for (const b of game.world.blocks) {
      if (b.x1 < x0) continue;
      if (b.x0 > x1) break;
      for (const side of [1, -1] as const) {
        const kind = side === 1 ? b.floor : b.ceil;
        const y = side * HALF_H;
        const a = Math.max(b.x0, x0);
        const z = Math.min(b.x1, x1);
        if (kind === 'solid') {
          solid.moveTo(a, y);
          solid.lineTo(z, y);
        } else if (kind === 'spikes') {
          solid.moveTo(a, y);
          solid.lineTo(z, y);
          const n = Math.max(1, Math.round((b.x1 - b.x0) / 22));
          const sw = (b.x1 - b.x0) / n;
          for (let i = 0; i < n; i++) {
            const sx = b.x0 + i * sw;
            if (sx + sw < x0 || sx > x1) continue;
            spikes.moveTo(sx + 2, y);
            spikes.lineTo(sx + sw / 2, y - side * SPIKE_H);
            spikes.lineTo(sx + sw - 2, y);
          }
        } else {
          // Little end caps make gaps read instantly at speed.
          caps.moveTo(b.x0, y);
          caps.lineTo(b.x0, y + side * 14);
          caps.moveTo(b.x1, y);
          caps.lineTo(b.x1, y + side * 14);
        }
      }
    }
    this.neon(solid, css(mixWhite(pal.line, 0.55)), css(pal.line, 0.22), 3);
    this.neon(caps, css(pal.line), css(pal.line, 0.22), 3);
    ctx.fillStyle = css(pal.spike, 0.25);
    ctx.fill(spikes);
    this.neon(spikes, css(pal.spike), css(pal.spike, 0.18), 2.5);
  }

  private orbs(game: Game, pal: Palette, x0: number, x1: number, t: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (const o of game.world.orbs) {
      if (o.taken || o.x < x0 || o.x > x1) continue;
      const pulse = 1 + Math.sin(t * 6 + o.x * 0.05) * 0.12;
      const r = (o.arc ? 9 : 7) * pulse;
      if (this.glow) this.halo(o.x, o.y, r * 3.2, pal.orb, o.missed ? 0.15 : 0.55);
      ctx.fillStyle = css(pal.orb, o.missed ? 0.25 : 0.95);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(t * 2 + o.x);
      if (o.arc) ctx.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Soft additive radial glow; reads as light, unlike a flat translucent disc. */
  private halo(x: number, y: number, r: number, c: Palette['orb'], alpha: number): void {
    const { ctx } = this;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(c, alpha));
    g.addColorStop(0.35, css(c, alpha * 0.35));
    g.addColorStop(1, css(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prev;
  }

  private player(game: Game, pal: Palette): void {
    const { ctx } = this;
    const s = PLAYER;
    ctx.globalCompositeOperation = 'lighter';
    game.trail.forEach((p, i) => {
      const a = (i / game.trail.length) * 0.22;
      ctx.fillStyle = css(pal.player, a);
      const k = s * (0.5 + (i / game.trail.length) * 0.4);
      ctx.fillRect(p.x - k / 2, p.y - k / 2, k, k);
    });
    if (!game.alive) {
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (this.glow) this.halo(game.x, game.y, s * 2.4, pal.player, 0.6);
    // Squash on landing: wide and flat, then spring back.
    const sq = game.squash ** 2;
    const sxk = 1 + sq * 0.35;
    const syk = 1 - sq * 0.3;
    ctx.save();
    ctx.translate(game.x, game.y + game.gravity * (s / 2) * (1 - syk));
    ctx.rotate(game.rot);
    ctx.scale(sxk, syk);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = css(pal.player);
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10);
    ctx.fillStyle = css(pal.player);
    ctx.fillRect(-s / 2 + 9, -s / 2 + 9, s - 18, s - 18);
    ctx.restore();
  }

  private particles(list: Particle[], pal: Palette): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of list) {
      const k = 1 - p.life / p.max;
      const c = p.color === 'white' ? ([255, 255, 255] as const) : pal[p.color];
      ctx.fillStyle = css([c[0], c[1], c[2]], k);
      const s = p.size * (0.4 + k * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** First-run coaching: a pulsing TAP right where the flip should happen. */
  private cue(game: Game, pal: Palette, t: number): void {
    const { ctx } = this;
    const k = 1 + Math.sin(t * 14) * 0.08;
    ctx.save();
    ctx.translate(game.x, game.y - game.gravity * 46);
    ctx.scale(k, k);
    ctx.font = 'italic 700 22px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(pal.orb);
    ctx.fillText('TAP!', 0, 0);
    ctx.restore();
  }

  private texts(game: Game, pal: Palette): void {
    const { ctx } = this;
    ctx.font = '600 15px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of game.texts) {
      const c = t.color === 'white' ? ([255, 255, 255] as [number, number, number]) : pal[t.color];
      ctx.fillStyle = css(c, Math.min(1, t.life * 2.5));
      ctx.fillText(t.text, t.x, t.y);
    }
  }
}
