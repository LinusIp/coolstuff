export type RGB = [number, number, number];

export interface Palette {
  name: string;
  skyTop: RGB;
  skyLow: RGB;
  sunTop: RGB;
  sunLow: RGB;
  mountain: RGB;
  grid: RGB;
  line: RGB;
  spike: RGB;
  orb: RGB;
  player: RGB;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Every zone (500 m) gets its own sunset. */
export const ZONES: Palette[] = [
  {
    name: 'Neon Dusk',
    skyTop: hex('#07041a'),
    skyLow: hex('#3a0b4d'),
    sunTop: hex('#ffd25e'),
    sunLow: hex('#ff2f8e'),
    mountain: hex('#14072a'),
    grid: hex('#ff2fb4'),
    line: hex('#2ef2ff'),
    spike: hex('#ff3b6b'),
    orb: hex('#fff07a'),
    player: hex('#ff4fd8'),
  },
  {
    name: 'Amber Drive',
    skyTop: hex('#0b0414'),
    skyLow: hex('#5a1630'),
    sunTop: hex('#fff1a8'),
    sunLow: hex('#ff6a1f'),
    mountain: hex('#1d0718'),
    grid: hex('#ff7b2f'),
    line: hex('#ffb84d'),
    spike: hex('#ff3d3d'),
    orb: hex('#9cf6ff'),
    player: hex('#b78bff'),
  },
  {
    name: 'Toxic Grid',
    skyTop: hex('#010a07'),
    skyLow: hex('#073227'),
    sunTop: hex('#f2ff8a'),
    sunLow: hex('#1fd67a'),
    mountain: hex('#02140f'),
    grid: hex('#2bff9a'),
    line: hex('#c8ff2e'),
    spike: hex('#ff4f7a'),
    orb: hex('#ffffff'),
    player: hex('#3df2ff'),
  },
  {
    name: 'Ice Line',
    skyTop: hex('#020615'),
    skyLow: hex('#173069'),
    sunTop: hex('#ffffff'),
    sunLow: hex('#58b8ff'),
    mountain: hex('#06102b'),
    grid: hex('#6fb6ff'),
    line: hex('#e8f6ff'),
    spike: hex('#ff5c8a'),
    orb: hex('#ffe066'),
    player: hex('#7dfcff'),
  },
  {
    name: 'Red Shift',
    skyTop: hex('#0d0203'),
    skyLow: hex('#4d0a12'),
    sunTop: hex('#ffe9a3'),
    sunLow: hex('#ff2a2a'),
    mountain: hex('#1a0306'),
    grid: hex('#ff3030'),
    line: hex('#ffd34d'),
    spike: hex('#ffffff'),
    orb: hex('#5cf2ff'),
    player: hex('#ff8a3d'),
  },
];

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const m = (x: RGB, y: RGB): RGB => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  return {
    name: t < 0.5 ? a.name : b.name,
    skyTop: m(a.skyTop, b.skyTop),
    skyLow: m(a.skyLow, b.skyLow),
    sunTop: m(a.sunTop, b.sunTop),
    sunLow: m(a.sunLow, b.sunLow),
    mountain: m(a.mountain, b.mountain),
    grid: m(a.grid, b.grid),
    line: m(a.line, b.line),
    spike: m(a.spike, b.spike),
    orb: m(a.orb, b.orb),
    player: m(a.player, b.player),
  };
}

export const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
