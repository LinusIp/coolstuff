import { clampedDpr, safeStorage } from '../../../src/shared/capabilities';
import { registerPWA } from '../../../src/shared/pwa';

type State = 'title' | 'play' | 'over';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
const HS_KEY = 'coolstuff:{{slug}}:best';

let state: State = 'title';
let score = 0;
let best = Number(safeStorage.get(HS_KEY) ?? 0);
let last = performance.now();

function resize(): void {
  const dpr = clampedDpr();
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function show(html: string): void {
  ui.innerHTML = html;
}

function start(): void {
  state = 'play';
  score = 0;
  show('');
}

function gameOver(): void {
  state = 'over';
  best = Math.max(best, Math.floor(score));
  safeStorage.set(HS_KEY, String(best));
  show(`<div><h1>Game over</h1><p>${Math.floor(score)} · best ${best}</p><button>Retry</button></div>`);
}

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  if (state === 'play') {
    score += dt * 10;
    if (score > 100) gameOver(); // replace with the real lose condition
  }
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(innerWidth / 2 - 20, innerHeight / 2 - 20, 40, 40);
  requestAnimationFrame(frame);
}

ui.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).tagName === 'BUTTON') start();
});
addEventListener('resize', resize);
resize();
show('<div><h1>{{title}}</h1><button>Play</button></div>');
requestAnimationFrame(frame);
registerPWA();
