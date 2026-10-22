/** Everything a viewer can tune, plus the curated looks. */

export type SeedShape = 'ring' | 'disc' | 'scatter' | 'spiral';
export const SEED_SHAPES: SeedShape[] = ['ring', 'disc', 'scatter', 'spiral'];

export interface SimParams {
  species: number; // 1..3
  sensorAngle: number; // degrees
  sensorDistance: number; // css px
  turnSpeed: number; // degrees per step
  stepSize: number; // css px per step
  deposit: number;
  decay: number; // fraction kept per step
  diffusion: number; // 0 = none, 1 = full 3×3 mean
  repulsion: number; // how strongly species avoid each other's trails
  variety: number; // spreads sensor distance / step across species
  exposure: number;
  glow: number;
  palette: string;
}

export interface Preset {
  id: string;
  name: string;
  seed: SeedShape;
  params: SimParams;
}

export interface Palette {
  name: string;
  /** Species colours as sRGB hex. */
  species: [string, string, string];
  background: string;
  food: string;
  /** UI accent (CSS). */
  accent: string;
}

export const PALETTES: Record<string, Palette> = {
  ember: {
    name: 'Ember',
    species: ['#ffb547', '#ff3f6c', '#7a5cff'],
    background: '#0b0608',
    food: '#fff1d6',
    accent: '#ffb547',
  },
  physarum: {
    name: 'Physarum',
    species: ['#ffd23f', '#ff8f3f', '#b6ff6a'],
    background: '#0a0805',
    food: '#fffbe8',
    accent: '#ffd23f',
  },
  reef: {
    name: 'Reef',
    species: ['#ff7a8a', '#2ee6c5', '#ffd36b'],
    background: '#05090b',
    food: '#fff4ec',
    accent: '#ff7a8a',
  },
  nebula: {
    name: 'Nebula',
    species: ['#ff6fcf', '#5b7cff', '#e8e4ff'],
    background: '#05040c',
    food: '#f4f0ff',
    accent: '#ff6fcf',
  },
  abyss: {
    name: 'Abyss',
    species: ['#39d9ff', '#b8ff5c', '#ff4fd8'],
    background: '#03080c',
    food: '#e8fbff',
    accent: '#39d9ff',
  },
  synapse: {
    name: 'Synapse',
    species: ['#7cf7ff', '#ff5ea8', '#ffe9a3'],
    background: '#04070b',
    food: '#ffffff',
    accent: '#7cf7ff',
  },
  moon: {
    name: 'Moonlight',
    species: ['#cfe3ff', '#7fa8ff', '#ffd9a8'],
    background: '#04060a',
    food: '#ffffff',
    accent: '#cfe3ff',
  },
};

const base = {
  stepSize: 1,
  deposit: 1,
  variety: 0,
  repulsion: 1,
  exposure: 0.04,
  glow: 0.5,
};

export const PRESETS: Preset[] = [
  {
    // An outward-facing disc: a shock front blooms, then a membrane-bound "cell" settles out.
    id: 'bloom',
    name: 'Bloom',
    seed: 'disc',
    params: { ...base, species: 3, sensorAngle: 45, sensorDistance: 12, turnSpeed: 45, decay: 0.85, diffusion: 0.2, variety: 0.5, palette: 'ember' },
  },
  {
    // Jones' classic parameters: a single species coarsening into a polygonal transport network.
    id: 'veins',
    name: 'Veins',
    seed: 'ring',
    params: { ...base, species: 1, sensorAngle: 45, sensorDistance: 12, turnSpeed: 45, decay: 0.85, diffusion: 0.2, palette: 'physarum' },
  },
  {
    // Wide sensors, short reach, strong rivalry: a tight three-colour labyrinth.
    id: 'coral',
    name: 'Coral',
    seed: 'scatter',
    params: { ...base, species: 3, sensorAngle: 80, sensorDistance: 6, turnSpeed: 40, decay: 0.8, diffusion: 0.3, repulsion: 2, palette: 'reef' },
  },
  {
    // Narrow sensors that see far, gentle turns: broad rivers that meander and braid.
    id: 'currents',
    name: 'Currents',
    seed: 'spiral',
    params: { ...base, species: 2, sensorAngle: 30, sensorDistance: 30, turnSpeed: 20, decay: 0.92, diffusion: 0.3, palette: 'nebula' },
  },
  {
    // Turning twice as hard as the sensor angle makes agents orbit: blobs that pinch and divide.
    id: 'mitosis',
    name: 'Mitosis',
    seed: 'scatter',
    params: { ...base, species: 3, sensorAngle: 45, sensorDistance: 10, turnSpeed: 90, decay: 0.85, diffusion: 0.5, palette: 'abyss' },
  },
  {
    // Long-range sensing with sharp turns pulls trails into star-shaped hubs.
    id: 'neurons',
    name: 'Neurons',
    seed: 'spiral',
    params: { ...base, species: 2, sensorAngle: 20, sensorDistance: 40, turnSpeed: 60, stepSize: 1.5, decay: 0.9, diffusion: 0.3, palette: 'synapse' },
  },
  {
    // Barely turning, fast-moving agents spin long silky filaments.
    id: 'silk',
    name: 'Silk',
    seed: 'scatter',
    params: { ...base, species: 1, sensorAngle: 15, sensorDistance: 30, turnSpeed: 8, stepSize: 2, decay: 0.93, diffusion: 0.3, glow: 0.7, palette: 'moon' },
  },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/**
 * Random parameters that stay inside the region where networks actually form:
 * turn speed tracks the sensor angle (RA ≈ SA gives networks, RA ≫ SA blobs,
 * RA ≪ SA long filaments) and decay stays high enough that trails persist.
 */
export function randomParams(): SimParams {
  const sensorAngle = rand(12, 80);
  return {
    species: pick([1, 2, 3, 3]),
    sensorAngle,
    sensorDistance: rand(6, 36),
    turnSpeed: Math.min(90, sensorAngle * rand(0.5, 2)),
    stepSize: rand(0.8, 2),
    deposit: 1,
    decay: rand(0.8, 0.94),
    diffusion: rand(0.1, 0.5),
    repulsion: rand(0.5, 2),
    variety: rand(0, 0.6),
    exposure: 0.04,
    glow: rand(0.4, 0.8),
    palette: pick(Object.keys(PALETTES)),
  };
}

/** Numeric keys that blend smoothly when presets morph into each other. */
export const BLENDABLE: (keyof SimParams)[] = [
  'sensorAngle',
  'sensorDistance',
  'turnSpeed',
  'stepSize',
  'deposit',
  'decay',
  'diffusion',
  'repulsion',
  'variety',
  'exposure',
  'glow',
];
