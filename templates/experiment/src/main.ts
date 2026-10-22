import { clampedDpr, prefersReducedMotion } from '../../../src/shared/capabilities';
import { QualityGovernor } from '../../../src/shared/fps';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const ctx = canvas.getContext('2d')!;
const quality = new QualityGovernor(2, 0, 3);
let running = !document.hidden;

function resize(): void {
  const dpr = clampedDpr() * (0.5 + quality.level / 6);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

function frame(t: number): void {
  if (!running) return;
  if (quality.tick(t) !== null) resize();
  const speed = prefersReducedMotion() ? 0.1 : 1;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `hsl(${(t * 0.02 * speed) % 360} 90% 60%)`;
  ctx.beginPath();
  ctx.arc(w / 2 + Math.cos(t * 0.001 * speed) * w * 0.3, h / 2 + Math.sin(t * 0.0013 * speed) * h * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) {
    quality.reset();
    requestAnimationFrame(frame);
  }
});
addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
