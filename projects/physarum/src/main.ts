import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/space-grotesk/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';

import GUI, { type Controller } from 'lil-gui';
import { clampedDpr, isTouchDevice, prefersReducedMotion } from '../../../src/shared/capabilities';
import { QualityGovernor } from '../../../src/shared/fps';
import { BLENDABLE, PALETTES, PRESETS, SEED_SHAPES, randomParams, type SeedShape, type SimParams } from './presets';
import { AGENT_TEX_WIDTH, PhysarumSim, SimUnsupportedError, lookFromHex, type Look, type PointerState } from './sim';

// ── quality ladder ─────────────────────────────────────────────────────────
// The governor walks this ladder: mostly agent count, and on the bottom rungs
// a coarser trail map too.
const LEVELS: { rows: number; trail: number }[] = [
  { rows: 96, trail: 0.6 },
  { rows: 160, trail: 0.75 },
  { rows: 256, trail: 0.9 },
  { rows: 384, trail: 1 },
  { rows: 512, trail: 1 },
  { rows: 768, trail: 1 },
  { rows: 1024, trail: 1 },
];
/** The trail map never exceeds this many texels, however big the monitor. */
const MAX_TRAIL_TEXELS = 2_400_000;
const AUTO_CYCLE_MS = 42_000;
const MORPH_MS = 5_000;

const query = new URLSearchParams(location.search);
const thumbMode = query.has('thumb');
const touch = isTouchDevice();
const smallScreen = Math.min(innerWidth, innerHeight) < 600;
const reducedMotion = prefersReducedMotion();

// ── DOM ────────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('view');
const statsEl = $('stats');
const hintEl = $('hint');
const presetName = $('preset-name');
const btnPreset = $<HTMLButtonElement>('btn-preset');
const btnShuffle = $<HTMLButtonElement>('btn-shuffle');
const btnSeed = $<HTMLButtonElement>('btn-seed');
const btnPause = $<HTMLButtonElement>('btn-pause');
const btnTune = $<HTMLButtonElement>('btn-tune');
const btnAbout = $<HTMLButtonElement>('btn-about');
const guiWrap = $('gui-wrap');
const about = $<HTMLDialogElement>('about');
const seedIcon = $('seed-icon');
const pauseIcon = $('pause-icon');

if (thumbMode) document.body.classList.add('thumb');

// ── state ──────────────────────────────────────────────────────────────────
const startPreset = Math.max(
  0,
  PRESETS.findIndex((p) => p.id === query.get('preset')),
);
let presetIndex = startPreset;
const params: SimParams = { ...PRESETS[presetIndex].params };
// `?set=sensorAngle:40,decay:0.93` overrides parameters: shareable experiments.
for (const pair of (query.get('set') ?? '').split(',')) {
  const [k, v] = pair.split(':');
  if (k in params && v !== undefined) {
    const key = k as keyof SimParams;
    (params as unknown as Record<string, number | string>)[key] = key === 'palette' ? v : Number(v);
  }
}
const settings = {
  speed: reducedMotion ? 0.4 : 1,
  brush: 'feed' as 'feed' | 'repel',
  autoCycle: !reducedMotion,
  quality: -1 as number, // -1 = automatic
  seed: (SEED_SHAPES as string[]).includes(query.get('seed') ?? '') ? (query.get('seed') as SeedShape) : PRESETS[presetIndex].seed,
};
let nextSeed: SeedShape = SEED_SHAPES[(SEED_SHAPES.indexOf(settings.seed) + 1) % SEED_SHAPES.length];
let paused = false;
let lastInteraction = performance.now();
let morph: { from: SimParams; to: SimParams; start: number } | null = null;

const maxLevel = touch || smallScreen ? 5 : LEVELS.length - 1;
// `?quality=0..6` pins the population (handy for screenshots and slow machines).
const pinned = query.has('quality') ? Math.max(0, Math.min(maxLevel, Number(query.get('quality')) || 0)) : -1;
const startLevel = pinned >= 0 ? pinned : thumbMode ? 0 : touch || smallScreen ? 2 : 4;
const governor = new QualityGovernor(startLevel, 0, maxLevel);
let level = startLevel;
settings.quality = pinned;

let look: Look = lookOf(params.palette);
let lookTarget: Look = look;

function lookOf(id: string): Look {
  const p = PALETTES[id] ?? PALETTES.ember;
  return lookFromHex(p.species, p.background, p.food);
}

function applyAccent(): void {
  const p = PALETTES[params.palette] ?? PALETTES.ember;
  document.documentElement.style.setProperty('--accent', p.accent);
}

// ── simulation setup ───────────────────────────────────────────────────────
let sim: PhysarumSim | null = null;

function trailSize(): [number, number, number, number] {
  const cssW = Math.max(1, innerWidth);
  const cssH = Math.max(1, innerHeight);
  // Phones get a slightly denser trail map than css pixels so veins stay crisp at DPR 3.
  let scale = Math.min(clampedDpr(), touch ? 1.25 : 1) * LEVELS[level].trail;
  const texels = cssW * cssH * scale * scale;
  if (texels > MAX_TRAIL_TEXELS) scale *= Math.sqrt(MAX_TRAIL_TEXELS / texels);
  return [cssW, cssH, Math.max(64, Math.round(cssW * scale)), Math.max(64, Math.round(cssH * scale))];
}

function resize(): void {
  if (!sim) return;
  const dpr = clampedDpr();
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const [cw, ch, tw, th] = trailSize();
  sim.resize(cw, ch, tw, th);
}

function createSim(): boolean {
  try {
    const rows = query.has('rows') ? Math.max(1, Math.min(1024, Number(query.get('rows')) || 64)) : LEVELS[level].rows;
    sim = new PhysarumSim(canvas, Math.max(rows, touch || smallScreen ? LEVELS[maxLevel].rows : 1024), rows);
  } catch (err) {
    sim = null;
    showFallback(err);
    return false;
  }
  resize();
  sim.seed(settings.seed, true);
  return true;
}

function showFallback(err: unknown): void {
  const box = $('fallback');
  const text = $('fallback-text');
  if (err instanceof SimUnsupportedError && err.reason === 'webgl2') {
    text.textContent =
      'Your browser didn’t give us a WebGL2 context, so the million agents have nowhere to live. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration switched on.';
  } else if (err instanceof SimUnsupportedError) {
    $('fallback-title').textContent = 'This GPU can’t hold the trails.';
    text.textContent =
      'The simulation stores every agent in floating-point textures it renders into (EXT_color_buffer_float), and this device doesn’t support that. Most laptops and phones from the last few years do.';
  } else {
    $('fallback-title').textContent = 'The mold didn’t take.';
    text.textContent = 'Something went wrong starting the GPU simulation. Reloading the page usually fixes it.';
    console.error(err);
  }
  box.hidden = false;
  $('dock').hidden = true;
  statsEl.textContent = 'no GPU simulation available';
}

// ── interaction ────────────────────────────────────────────────────────────
const pointer: PointerState = { uv: null, mode: 1 };
let lastSplat: [number, number] | null = null;
let downAt = 0;
let downPos: [number, number] = [0, 0];
let moved = false;

function toUv(e: PointerEvent): [number, number] {
  return [e.clientX / innerWidth, 1 - e.clientY / innerHeight];
}

function touched(): void {
  lastInteraction = performance.now();
  hideHint();
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const repel = e.button === 2 || e.shiftKey || settings.brush === 'repel';
  pointer.mode = repel ? -1 : 1;
  pointer.uv = toUv(e);
  lastSplat = null;
  downAt = performance.now();
  downPos = [e.clientX, e.clientY];
  moved = false;
  touched();
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.uv) return;
  pointer.uv = toUv(e);
  if (Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 8) moved = true;
});
const release = () => {
  // A quick tap drops one rich blob of food instead of a stroke.
  if (pointer.uv && !moved && performance.now() - downAt < 300 && sim) {
    sim.splat(pointer.uv, 48, pointer.mode * 220);
  }
  pointer.uv = null;
  lastSplat = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

/** Lays food along the path the pointer travelled since the last frame. */
function paintStroke(): void {
  if (!sim || !pointer.uv) return;
  const cur = pointer.uv;
  const from = lastSplat ?? cur;
  const dx = (cur[0] - from[0]) * innerWidth;
  const dy = (cur[1] - from[1]) * innerHeight;
  const dist = Math.hypot(dx, dy);
  const radius = 22;
  const n = Math.min(24, Math.max(1, Math.ceil(dist / (radius * 0.4))));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    sim.splat([from[0] + (cur[0] - from[0]) * t, from[1] + (cur[1] - from[1]) * t], radius, (pointer.mode * 34) / Math.sqrt(n));
  }
  lastSplat = cur;
}

// ── presets & params ───────────────────────────────────────────────────────
let gui: GUI | null = null;

function refreshGui(): void {
  gui?.controllersRecursive().forEach((c: Controller) => c.updateDisplay());
}

function setPalette(id: string): void {
  params.palette = id;
  lookTarget = lookOf(id);
  applyAccent();
}

function applyPreset(i: number, reseed: boolean): void {
  presetIndex = (i + PRESETS.length) % PRESETS.length;
  const preset = PRESETS[presetIndex];
  presetName.textContent = preset.name;
  btnPreset.setAttribute('aria-label', `Preset: ${preset.name}. Switch to next preset`);
  if (reseed) {
    morph = null;
    Object.assign(params, preset.params);
    settings.seed = preset.seed;
    nextSeed = SEED_SHAPES[(SEED_SHAPES.indexOf(preset.seed) + 1) % SEED_SHAPES.length];
    updateSeedButton();
    sim?.seed(preset.seed, false);
  } else {
    // Auto-cycling morphs the rules in place so the living network reorganises itself.
    morph = { from: { ...params }, to: { ...preset.params }, start: performance.now() };
    params.species = preset.params.species;
  }
  setPalette(preset.params.palette);
  refreshGui();
}

function randomize(): void {
  morph = null;
  Object.assign(params, randomParams());
  setPalette(params.palette);
  presetName.textContent = 'Wild';
  btnPreset.setAttribute('aria-label', 'Preset: random. Switch to next preset');
  refreshGui();
}

function reseed(shape: SeedShape = nextSeed): void {
  settings.seed = shape;
  nextSeed = SEED_SHAPES[(SEED_SHAPES.indexOf(shape) + 1) % SEED_SHAPES.length];
  updateSeedButton();
  sim?.seed(shape, false);
  refreshGui();
}

const SEED_ICONS: Record<SeedShape, string> = {
  ring: '<circle cx="12" cy="12" r="7.5" stroke-dasharray="2.4 2.6"/>',
  disc: '<circle cx="12" cy="12" r="7.5"/><circle class="fill" cx="12" cy="12" r="4.5"/>',
  scatter:
    '<circle class="dot" cx="6" cy="7" r="1.4"/><circle class="dot" cx="13" cy="5" r="1.4"/><circle class="dot" cx="18" cy="11" r="1.4"/><circle class="dot" cx="8" cy="14" r="1.4"/><circle class="dot" cx="14" cy="17" r="1.4"/><circle class="dot" cx="19" cy="19" r="1.2"/><circle class="dot" cx="5" cy="19" r="1.2"/>',
  spiral: '<path d="M12 12c0-1.4 1.8-1.6 2.6-.6 1.2 1.6-.4 4-2.6 4-3 0-4.4-3.2-3.2-5.8 1.6-3.4 6.4-3.8 8.6-1 2.6 3.4.6 9-4.4 9.6"/>',
};

function updateSeedButton(): void {
  seedIcon.innerHTML = SEED_ICONS[nextSeed];
  btnSeed.setAttribute('aria-label', `Reseed as a ${nextSeed}`);
  btnSeed.title = `Reseed: ${nextSeed} (S)`;
}

function setPaused(p: boolean): void {
  paused = p;
  btnPause.setAttribute('aria-pressed', String(p));
  btnPause.setAttribute('aria-label', p ? 'Resume' : 'Pause');
  btnPause.title = p ? 'Resume (Space)' : 'Pause (Space)';
  pauseIcon.innerHTML = p ? '<path class="fill" d="M8 5.5v13l11-6.5z"/>' : '<path d="M9 6v12M15 6v12"/>';
}

function buildGui(): GUI {
  const g = new GUI({ container: guiWrap, title: 'Parameters' });
  const onEdit = () => {
    morph = null;
    touched();
  };
  const agents = g.addFolder('Agents');
  agents.add(params, 'species', 1, 3, 1).name('species').onChange(onEdit);
  agents.add(params, 'sensorAngle', 2, 90, 0.5).name('sensor angle °').onChange(onEdit);
  agents.add(params, 'sensorDistance', 2, 60, 0.5).name('sensor dist px').onChange(onEdit);
  agents.add(params, 'turnSpeed', 1, 90, 0.5).name('turn speed °').onChange(onEdit);
  agents.add(params, 'stepSize', 0.2, 4, 0.05).name('step size px').onChange(onEdit);
  agents.add(params, 'repulsion', 0, 3, 0.05).name('rival repulsion').onChange(onEdit);
  agents.add(params, 'variety', 0, 1, 0.01).name('species variety').onChange(onEdit);
  const trail = g.addFolder('Trail');
  trail.add(params, 'deposit', 0.1, 5, 0.05).name('deposit').onChange(onEdit);
  trail.add(params, 'decay', 0.7, 0.995, 0.001).name('decay (kept)').onChange(onEdit);
  trail.add(params, 'diffusion', 0, 1, 0.01).name('diffusion').onChange(onEdit);
  const lookF = g.addFolder('Look');
  const paletteOptions = Object.fromEntries(Object.entries(PALETTES).map(([id, p]) => [p.name, id]));
  lookF
    .add(params, 'palette', paletteOptions)
    .name('palette')
    .onChange((v: string) => {
      setPalette(v);
      onEdit();
    });
  lookF.add(params, 'exposure', 0.005, 0.15, 0.001).name('exposure').onChange(onEdit);
  lookF.add(params, 'glow', 0, 2, 0.01).name('glow').onChange(onEdit);
  const simF = g.addFolder('Simulation');
  simF.add(settings, 'speed', 0.1, 2, 0.05).name('speed').onChange(onEdit);
  simF.add(settings, 'brush', { 'feed (attract)': 'feed', 'repellent': 'repel' }).name('brush').onChange(onEdit);
  simF.add(settings, 'autoCycle').name('auto-cycle presets').onChange(onEdit);
  const qualityOptions: Record<string, number> = { automatic: -1 };
  LEVELS.forEach((l, i) => {
    if (i <= maxLevel) qualityOptions[`${Math.round((l.rows * AGENT_TEX_WIDTH) / 1000)}k agents`] = i;
  });
  simF
    .add(settings, 'quality', qualityOptions)
    .name('population')
    .onChange((v: number) => {
      if (v >= 0) setLevel(v);
      else governor.reset();
      onEdit();
    });
  simF
    .add(settings, 'seed', SEED_SHAPES)
    .name('seed shape')
    .onChange((v: SeedShape) => reseed(v));
  simF.add({ reseed: () => reseed(settings.seed) }, 'reseed').name('↻ reseed now');
  return g;
}

function setLevel(next: number): void {
  if (!sim) return;
  level = Math.max(0, Math.min(maxLevel, next));
  governor.level = level;
  sim.setRows(LEVELS[level].rows);
  resize();
}

function toggleGui(force?: boolean): void {
  const show = force ?? guiWrap.hidden;
  if (show && !gui) gui = buildGui();
  guiWrap.hidden = !show;
  btnTune.setAttribute('aria-expanded', String(show));
  btnTune.setAttribute('aria-label', show ? 'Hide parameters' : 'Show parameters');
  touched();
}

function openAbout(): void {
  if (!about.open) about.showModal();
  touched();
}

btnPreset.addEventListener('click', () => {
  applyPreset(presetIndex + (presetName.textContent === 'Wild' ? 0 : 1), true);
  touched();
});
btnShuffle.addEventListener('click', () => {
  randomize();
  touched();
});
btnSeed.addEventListener('click', () => {
  reseed();
  touched();
});
btnPause.addEventListener('click', () => {
  setPaused(!paused);
  touched();
});
btnTune.addEventListener('click', () => toggleGui());
btnAbout.addEventListener('click', openAbout);
$('about-close').addEventListener('click', () => about.close());
about.addEventListener('click', (e) => {
  // Clicks on the backdrop land on the dialog element itself.
  if (e.target === about) about.close();
});

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, select, textarea, .lil-gui') || about.open) return;
  const key = e.key.toLowerCase();
  if (key === ' ' && !(t instanceof HTMLButtonElement)) {
    e.preventDefault();
    setPaused(!paused);
  } else if (key === 'n' || key === 'arrowright') applyPreset(presetIndex + 1, true);
  else if (key === 'arrowleft') applyPreset(presetIndex - 1, true);
  else if (key === 'r') randomize();
  else if (key === 's') reseed();
  else if (key === 'g') toggleGui();
  else if (key === '?' || key === 'i') openAbout();
  else if (key === 'h') document.body.classList.toggle('chrome-hidden');
  else return;
  touched();
});

// ── hint ───────────────────────────────────────────────────────────────────
let hintTimer = 0;
function showHint(): void {
  if (thumbMode) return;
  hintEl.textContent = touch ? 'drag to feed the mould · tap to drop food' : 'drag to feed the mould · right-drag to repel';
  hintEl.classList.add('show');
  hintTimer = window.setTimeout(hideHint, 6500);
}
function hideHint(): void {
  clearTimeout(hintTimer);
  hintEl.classList.remove('show');
}

// ── loop ───────────────────────────────────────────────────────────────────
let running = false;
let lastT = 0;
let acc = 0;
let startT = 0;
let statsT = 0;
let frames = 0;
let fpsShown = 60;

function lerpLook(a: Look, b: Look, t: number): Look {
  const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t) as [number, number, number];
  return {
    species: a.species.map((c, i) => mix(c, b.species[i])),
    background: mix(a.background, b.background),
    food: mix(a.food, b.food),
  };
}

function updateMorph(now: number): void {
  if (!morph) return;
  const t = Math.min(1, (now - morph.start) / MORPH_MS);
  const e = t * t * (3 - 2 * t);
  for (const k of BLENDABLE) {
    (params[k] as number) = (morph.from[k] as number) + ((morph.to[k] as number) - (morph.from[k] as number)) * e;
  }
  if (t >= 1) {
    morph = null;
    refreshGui();
  }
}

function updateStats(now: number): void {
  frames++;
  if (now - statsT < 500) return;
  fpsShown = Math.round((frames * 1000) / (now - statsT));
  frames = 0;
  statsT = now;
  if (!sim) return;
  const n = sim.agentCount.toLocaleString('en-US');
  const sp = params.species;
  statsEl.innerHTML = `<b>${n}</b> agents · ${sp} species · ${paused ? 'paused' : `${fpsShown} fps`}`;
}

function frame(now: number): void {
  if (!running) return;
  requestAnimationFrame(frame);
  if (!sim || sim.gl.isContextLost()) return;
  const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
  lastT = now;

  if (settings.quality < 0 && !paused && !query.has('rows')) {
    const changed = governor.tick(now);
    if (changed !== null && changed !== level) setLevel(changed);
  }

  if (
    settings.autoCycle &&
    !reducedMotion &&
    !paused &&
    !thumbMode &&
    !about.open &&
    guiWrap.hidden &&
    now - lastInteraction > AUTO_CYCLE_MS
  ) {
    lastInteraction = now;
    applyPreset(presetIndex + 1, false);
  }
  updateMorph(now);

  if (!paused) {
    // Fixed 60 Hz simulation clock so 120 Hz screens don't run the mould at double speed.
    acc += dt * 60 * settings.speed;
    let steps = Math.floor(acc);
    acc -= steps;
    if (steps > 3) {
      steps = 3;
      acc = 0;
    }
    if (steps > 0) paintStroke();
    for (let i = 0; i < steps; i++) sim.step(params, pointer, 1);
  }

  look = lerpLook(look, lookTarget, 1 - Math.exp(-dt * 3));
  const fade = Math.min(1, (now - startT) / 700);
  sim.render(params, look, fade);
  updateStats(now);
}

function start(): void {
  if (running || document.hidden) return;
  running = true;
  lastT = 0;
  governor.reset();
  requestAnimationFrame(frame);
}

function stop(): void {
  running = false;
}

document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
addEventListener('resize', resize);

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  statsEl.textContent = 'GPU context lost, restoring…';
});
canvas.addEventListener('webglcontextrestored', () => {
  if (createSim()) refreshGui();
});

// ── boot ───────────────────────────────────────────────────────────────────
applyAccent();
updateSeedButton();
presetName.textContent = PRESETS[presetIndex].name;
btnPreset.setAttribute('aria-label', `Preset: ${PRESETS[presetIndex].name}. Switch to next preset`);
if (createSim() && sim) {
  // Warm start: a short burst of steps so the very first frame already has structure.
  // The thumbnail is shot after a few seconds of *software* rendering, so it fast-forwards with a coarser clock.
  const warm = query.has('warm') ? Math.min(3000, Number(query.get('warm')) || 0) : thumbMode ? 110 : 24;
  const warmSpeed = query.has('warmspeed') ? Number(query.get('warmspeed')) || 1 : thumbMode ? 2 : 1;
  for (let i = 0; i < warm; i++) (sim as PhysarumSim).step(params, pointer, warmSpeed);
  startT = performance.now();
  statsT = startT;
  start();
  window.setTimeout(showHint, 1200);
}
