import './style.css';
import { clampedDpr, prefersReducedMotion, safeStorage } from '../../../src/shared/capabilities';
import { QualityGovernor } from '../../../src/shared/fps';
import { registerPWA } from '../../../src/shared/pwa';
import { Audio } from './audio';
import { Game, ZONE_METERS, type GameEvents } from './game';
import { ZONES, mixPalette, type Palette } from './palettes';
import { Renderer } from './render';

type Mode = 'title' | 'play' | 'paused' | 'over';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>('#game');
const ui = {
  hud: $('#hud'),
  dist: $('#dist'),
  score: $('#score'),
  combo: $('#combo'),
  banner: $('#banner'),
  title: $('#title'),
  paused: $('#paused'),
  over: $('#over'),
  bestLine: $('#best-line'),
  sound: $<HTMLButtonElement>('#sound'),
};

const KEYS = { best: 'coolstuff:flipline:best', runs: 'coolstuff:flipline:runs', muted: 'coolstuff:flipline:muted' };
const STEP = 1 / 120;
const TRANSPOSE = [0, 3, -2, 5, 1];
const reducedMotion = prefersReducedMotion();
// ?autoplay lets the attract-mode pilot play real runs: handy for testing and screenshots.
const autoplay = new URLSearchParams(location.search).has('autoplay');

const audio = new Audio();
audio.muted = safeStorage.get(KEYS.muted) === '1';
const renderer = new Renderer(canvas);
const quality = new QualityGovernor(2, 0, 2);

let mode: Mode = 'title';
let best = Number(safeStorage.get(KEYS.best) ?? 0);
let runs = Number(safeStorage.get(KEYS.runs) ?? 0);
let overAt = 0;
let acc = 0;
let last = performance.now();

// Palette crossfade between zones.
let palFrom: Palette = ZONES[0];
let palTo: Palette = ZONES[0];
let palT = 1;
let palette: Palette = ZONES[0];

const events: GameEvents = {
  flip: (up) => mode === 'play' && audio.flip(up),
  land: () => mode === 'play' && audio.land(),
  orb: (combo, arc) => {
    if (mode !== 'play') return;
    audio.orb(combo, arc);
    if (combo >= 2) {
      ui.combo.textContent = `×${Math.min(combo, 10)} combo`;
      ui.combo.classList.remove('pop');
      void ui.combo.offsetWidth; // restart the CSS animation
      ui.combo.classList.add('pop');
    }
  },
  close: () => mode === 'play' && audio.close(),
  death: () => {
    if (mode !== 'play') return;
    audio.death();
    audio.muffle(true);
    if (!reducedMotion) navigator.vibrate?.(60);
  },
  zone: (z) => {
    setZone(z);
    if (mode !== 'play') return;
    audio.zone();
    audio.transpose = TRANSPOSE[z % TRANSPOSE.length];
    audio.setIntensity(z >= 1 ? 2 : 1);
    const p = ZONES[z % ZONES.length];
    ui.banner.innerHTML = `<span class="z">Zone ${z + 1} · ${z * ZONE_METERS} m</span><span class="n">${p.name}</span>`;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
  },
};

function setZone(z: number): void {
  palFrom = palette;
  palTo = ZONES[z % ZONES.length];
  palT = 0;
}

let game = new Game(Date.now(), events, true, reducedMotion);

function newAttract(): void {
  game = new Game(Date.now(), events, true, reducedMotion);
  setZone(0);
}

function show(screen: HTMLElement | null): void {
  for (const s of [ui.title, ui.paused, ui.over]) s.hidden = s !== screen;
  ui.hud.hidden = !(mode === 'play' || mode === 'paused');
  const focusTarget = screen?.querySelector<HTMLButtonElement>('.btn.primary');
  // Only move focus for keyboard users' benefit; avoid popping the keyboard UI on touch.
  if (focusTarget && !matchMedia('(pointer: coarse)').matches) focusTarget.focus({ preventScroll: true });
}

function updateBestLine(): void {
  ui.bestLine.textContent = best > 0 ? `Best ${best.toLocaleString()} · ${runs} ${runs === 1 ? 'run' : 'runs'}` : '';
}

function start(): void {
  audio.unlock();
  audio.click();
  mode = 'play';
  game = new Game((Math.random() * 2 ** 32) >>> 0, events, autoplay, reducedMotion);
  game.hints = runs < 3;
  setZone(0);
  acc = 0;
  ui.combo.textContent = '';
  audio.transpose = 0;
  audio.setIntensity(1);
  audio.muffle(false);
  show(null);
  canvas.focus?.();
}

function showOver(): void {
  mode = 'over';
  overAt = performance.now();
  runs++;
  const score = game.score;
  const isBest = score > best;
  if (isBest) best = score;
  safeStorage.set(KEYS.best, String(best));
  safeStorage.set(KEYS.runs, String(runs));
  $('#final-score').textContent = score.toLocaleString();
  $('#new-best').hidden = !isBest;
  $('#st-dist').textContent = `${Math.floor(game.meters).toLocaleString()} m`;
  $('#st-orbs').textContent = String(game.orbs);
  $('#st-combo').textContent = game.bestCombo > 1 ? `×${game.bestCombo}` : '—';
  $('#st-close').textContent = String(game.closes);
  $('#over-best').textContent = isBest ? 'Nothing behind you but neon.' : `Best ${best.toLocaleString()}`;
  show(ui.over);
}

function toMenu(): void {
  mode = 'title';
  audio.setIntensity(0);
  audio.muffle(false);
  audio.transpose = 0;
  newAttract();
  updateBestLine();
  show(ui.title);
}

function pause(): void {
  if (mode !== 'play' || !game.alive) return;
  mode = 'paused';
  audio.muffle(true);
  show(ui.paused);
}

function resume(): void {
  if (mode !== 'paused') return;
  mode = 'play';
  audio.resume();
  audio.muffle(false);
  last = performance.now();
  show(null);
}

function setMuted(m: boolean): void {
  audio.setMuted(m);
  safeStorage.set(KEYS.muted, m ? '1' : '0');
  ui.sound.setAttribute('aria-pressed', String(!m));
  ui.sound.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
}

/** The single "action" input: tap, click, space. Its meaning depends on the mode. */
function action(): void {
  audio.unlock();
  if (mode === 'play') game.requestFlip();
  else if (mode === 'title') start();
  else if (mode === 'over' && performance.now() - overAt > 600) start();
}

// ── Input ────────────────────────────────────────────────────────────────────

addEventListener(
  'pointerdown',
  (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    e.preventDefault();
    action();
  },
  { passive: false },
);

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const onButton = (e.target as HTMLElement).closest('button, a');
  switch (e.code) {
    case 'Space':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'KeyW':
    case 'KeyS':
      if (onButton && mode !== 'play') return; // let Space activate the focused button
      e.preventDefault();
      action();
      break;
    case 'Enter':
      if (!onButton) action();
      break;
    case 'Escape':
    case 'KeyP':
      if (mode === 'play') pause();
      else if (mode === 'paused') resume();
      break;
    case 'KeyM':
      audio.unlock();
      setMuted(!audio.muted);
      break;
  }
});

$('#play').addEventListener('click', start);
$('#retry').addEventListener('click', start);
$('#resume').addEventListener('click', resume);
$('#pause').addEventListener('click', pause);
$('#quit').addEventListener('click', toMenu);
$('#menu').addEventListener('click', toMenu);
ui.sound.addEventListener('click', () => {
  audio.unlock();
  setMuted(!audio.muted);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else {
    if (mode !== 'paused') audio.resume();
    quality.reset();
    last = performance.now();
  }
});

// ── Loop ─────────────────────────────────────────────────────────────────────

function applyQuality(level: number): void {
  renderer.glow = level > 0;
  renderer.resize(level === 2 ? clampedDpr(2) : level === 1 ? Math.min(clampedDpr(2), 1.5) : 1);
}

let lastScore = -1;
let lastDist = -1;

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (mode !== 'paused') {
    // Brief slow motion right after a crash: the moment of impact reads clearly.
    const slow = !game.alive && game.time - game.deathTime < 0.45 ? 0.3 : 1;
    acc += dt * slow;
    while (acc >= STEP) {
      game.step(STEP);
      acc -= STEP;
    }
  }

  if (palT < 1) {
    palT = Math.min(1, palT + dt / 1.4);
    palette = mixPalette(palFrom, palTo, palT * palT * (3 - 2 * palT));
  }

  renderer.draw(game, palette, now / 1000, !reducedMotion);

  if (mode === 'play') {
    const s = game.score;
    const d = Math.floor(game.meters);
    if (s !== lastScore) ui.score.textContent = (lastScore = s).toLocaleString();
    if (d !== lastDist) ui.dist.textContent = (lastDist = d).toLocaleString();
    if (game.combo < 2 && ui.combo.textContent) ui.combo.textContent = '';
    if (!game.alive && game.time - game.deathTime > 1.1) showOver();
  } else if (mode === 'title' && !game.alive && game.time - game.deathTime > 1.2) {
    newAttract();
  }

  const q = quality.tick(now);
  if (q !== null) applyQuality(q);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => applyQuality(quality.level));
setMuted(audio.muted);
updateBestLine();
applyQuality(quality.level);
show(ui.title);
requestAnimationFrame(frame);
registerPWA();
