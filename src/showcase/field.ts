import { clampedDpr, prefersReducedMotion } from '../shared/capabilities';

/**
 * The hero's dot field: a grid of points that breathes on its own and parts
 * around the pointer. Each dot is a damped spring pulled back to its rest
 * position, so motion settles naturally instead of snapping.
 */
export function mountField(canvas: HTMLCanvasElement, accent: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const SPACING = 26;
  const REACH = 150;
  let w = 0;
  let h = 0;
  let cols = 0;
  let rows = 0;
  // Offsets and velocities per dot, packed for cache-friendly loops.
  let ox = new Float32Array(0);
  let oy = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  const pointer = { x: -9999, y: -9999, active: false };
  let visible = true;
  let raf = 0;
  const reduced = prefersReducedMotion();

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = clampedDpr();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / SPACING) + 1;
    rows = Math.ceil(h / SPACING) + 1;
    const n = cols * rows;
    ox = new Float32Array(n);
    oy = new Float32Array(n);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    if (reduced) draw(0);
  }

  function draw(t: number): void {
    ctx!.clearRect(0, 0, w, h);
    const time = t * 0.00035;
    const px = pointer.x;
    const py = pointer.y;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const bx = c * SPACING + ((r & 1) * SPACING) / 2;
        const by = r * SPACING;
        let push = 0;
        if (!reduced) {
          const dx = bx + ox[i] - px;
          const dy = by + oy[i] - py;
          const d2 = dx * dx + dy * dy;
          if (pointer.active && d2 < REACH * REACH) {
            const d = Math.sqrt(d2) || 1;
            push = 1 - d / REACH;
            const f = push * push * 2.2;
            vx[i] += (dx / d) * f;
            vy[i] += (dy / d) * f;
          }
          // Spring back to rest, with damping.
          vx[i] += -ox[i] * 0.06;
          vy[i] += -oy[i] * 0.06;
          vx[i] *= 0.86;
          vy[i] *= 0.86;
          ox[i] += vx[i];
          oy[i] += vy[i];
        }
        // A slow travelling wave keeps the field alive with zero interaction.
        const wave = Math.sin(bx * 0.012 + time * 3) * Math.cos(by * 0.016 - time * 2);
        const glow = Math.max(push * 1.4, Math.max(0, wave) ** 6 * 0.9);
        const disp = Math.hypot(ox[i], oy[i]);
        const size = 1 + glow * 1.6 + Math.min(disp * 0.05, 1.2);
        ctx!.globalAlpha = 0.18 + glow * 0.75;
        ctx!.fillStyle = glow > 0.25 ? accent : '#f2f1ec';
        ctx!.fillRect(bx + ox[i] - size / 2, by + oy[i] - size / 2, size, size);
      }
    }
    ctx!.globalAlpha = 1;
  }

  function loop(t: number): void {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function setRunning(): void {
    cancelAnimationFrame(raf);
    if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(loop);
  }

  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = pointer.y > -REACH && pointer.y < rect.height + REACH;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('pointerleave', () => (pointer.active = false));
  addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') pointer.active = false;
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    setRunning();
  }).observe(canvas);
  document.addEventListener('visibilitychange', setRunning);
  new ResizeObserver(resize).observe(canvas);
  resize();
  setRunning();
}
