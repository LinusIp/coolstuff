import { describe, expect, it } from 'vitest';
import {
  checkAnswer,
  checkChoice,
  checkDrag,
  checkNumeric,
  checkProof,
  checkSymbolic,
  describePrecision,
  dragStateOf,
  formatAtPrecision,
  parseComplex,
  stripIntegrationConstant,
  toleranceFor,
  writtenPrecision,
} from './answers';
import { UnitError, angleCompat, convert, dimensionName, parseUnit, prettyUnit, sameDimension, splitQuantity, unitToTex } from './units';
import { texToHtml } from '../notation';
import type { NumericAnswer, SymbolicAnswer } from '../types';

describe('units', () => {
  const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

  it('parses SI, prefixes, powers and compounds', () => {
    expect(parseUnit('m').dims).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    close(parseUnit('km').scale, 1000);
    close(parseUnit('kg').scale, 1);
    close(parseUnit('g').scale, 1e-3);
    close(parseUnit('ms').scale, 1e-3); // millisecond, not metre-second
    close(parseUnit('µs').scale, 1e-6);
    close(parseUnit('us').scale, 1e-6);
    close(parseUnit('ns').scale, 1e-9);
    close(parseUnit('MΩ').scale, 1e6);
    close(parseUnit('kohm').scale, 1e3);
    expect(parseUnit('m/s^2').dims).toEqual([1, 0, -2, 0, 0, 0, 0, 0]);
    expect(parseUnit('m s^-2').dims).toEqual([1, 0, -2, 0, 0, 0, 0, 0]);
    expect(parseUnit('m·s⁻²').dims).toEqual([1, 0, -2, 0, 0, 0, 0, 0]);
    expect(parseUnit('m/s²').dims).toEqual([1, 0, -2, 0, 0, 0, 0, 0]);
    expect(sameDimension(parseUnit('N'), parseUnit('kg*m/s^2'))).toBe(true);
    expect(sameDimension(parseUnit('N m'), parseUnit('J'))).toBe(true);
    expect(sameDimension(parseUnit('Nm'), parseUnit('J'))).toBe(true);
    expect(sameDimension(parseUnit('N.m'), parseUnit('J'))).toBe(true);
    expect(sameDimension(parseUnit('J/(kg K)'), parseUnit('m^2/(s^2 K)'))).toBe(true);
    expect(sameDimension(parseUnit('J/kg/K'), parseUnit('J/(kg*K)'))).toBe(true);
    expect(sameDimension(parseUnit('V/m'), parseUnit('N/C'))).toBe(true);
    expect(sameDimension(parseUnit('ohm'), parseUnit('V/A'))).toBe(true);
    expect(sameDimension(parseUnit('T'), parseUnit('N/(A m)'))).toBe(true);
    expect(sameDimension(parseUnit('1/s'), parseUnit('Hz'))).toBe(true);
    expect(sameDimension(parseUnit('m2'), parseUnit('m^2'))).toBe(true);
    close(parseUnit('kWh').scale, 3.6e6);
    close(parseUnit('eV').scale, 1.602176634e-19);
    close(parseUnit('GB/s').scale, 8e9);
    close(parseUnit('KiB').scale, 8 * 1024);
  });

  it('converts', () => {
    close(convert(36, parseUnit('km/h'), parseUnit('m/s')), 10);
    close(convert(1, parseUnit('atm'), parseUnit('kPa')), 101.325);
    close(convert(180, parseUnit('deg'), parseUnit('rad')), Math.PI);
    close(convert(25, parseUnit('°C'), parseUnit('K')), 298.15);
    close(convert(300, parseUnit('K'), parseUnit('degC')), 26.85);
    expect(() => convert(1, parseUnit('m'), parseUnit('s'))).toThrow(UnitError);
  });

  it('names dimensions and rejects nonsense', () => {
    expect(dimensionName(parseUnit('km/h'))).toBe('speed');
    expect(dimensionName(parseUnit('N'))).toBe('force');
    expect(dimensionName(parseUnit('kg m^2'))).toBe('moment of inertia');
    expect(() => parseUnit('furlongs')).toThrow(UnitError);
    expect(() => parseUnit('m^x')).toThrow(UnitError);
    expect(() => parseUnit('(m/s')).toThrow(UnitError);
  });

  it('splits a quantity into number and unit', () => {
    expect(splitQuantity('9.8 m/s^2')).toEqual({ value: '9.8', unit: 'm/s^2' });
    expect(splitQuantity('9.8m/s^2')).toEqual({ value: '9.8', unit: 'm/s^2' });
    expect(splitQuantity('3 × 10^8 m/s')).toEqual({ value: '3 × 10^8', unit: 'm/s' });
    expect(splitQuantity('2pi rad')).toEqual({ value: '2pi', unit: 'rad' });
    expect(splitQuantity('sqrt(2) m')).toEqual({ value: 'sqrt(2)', unit: 'm' });
    expect(splitQuantity('5 eV')).toEqual({ value: '5', unit: 'eV' });
    expect(splitQuantity('1.6e-19 C')).toEqual({ value: '1.6e-19', unit: 'C' });
    expect(splitQuantity('1.2 MΩ')).toEqual({ value: '1.2', unit: 'MΩ' });
    expect(splitQuantity('30°')).toEqual({ value: '30', unit: '°' });
    expect(splitQuantity('25%')).toEqual({ value: '25', unit: '%' });
    expect(splitQuantity('v = 4.2 m/s')).toEqual({ value: '4.2', unit: 'm/s' });
    expect(splitQuantity('log10(100)')).toEqual({ value: 'log10(100)', unit: '' });
  });

  it('pretty units for messages', () => {
    expect(prettyUnit('kg*m/s^2')).toBe('kg·m/s²');
    expect(prettyUnit('m s^-1')).toBe('m s⁻¹');
    expect(prettyUnit('kohm')).toBe('kΩ');
    expect(prettyUnit('ohm')).toBe('Ω');
    expect(prettyUnit('us')).toBe('µs');
  });

  it('previews units as valid KaTeX', () => {
    for (const u of ['m/s^2', 'kg·m/s²', 'J/(kg K)', 'MΩ', 'µs', '°C', '°', '%', 'N m']) {
      expect(texToHtml(unitToTex(u)), u).not.toMatch(/katex-error/);
    }
  });
});

describe('numeric answers', () => {
  const two: NumericAnswer = { kind: 'numeric', value: 7, precision: { decimals: 2 } };
  const pi2: NumericAnswer = { kind: 'numeric', value: Math.PI, precision: { decimals: 2 } };

  it('derives tolerance from the stated precision', () => {
    expect(toleranceFor({ decimals: 2 }, 3)).toBeCloseTo(0.005, 12);
    expect(toleranceFor({ sig: 3 }, 9.81)).toBeCloseTo(0.005, 12);
    expect(toleranceFor({ sig: 3 }, 1234)).toBeCloseTo(5, 9);
    expect(toleranceFor({ sig: 2 }, 0.0123)).toBeCloseTo(0.0005, 12);
    expect(describePrecision({ decimals: 2 })).toBe('to 2 decimal places');
    expect(describePrecision({ sig: 1 })).toBe('to 1 significant figure');
    expect(formatAtPrecision(7, { decimals: 2 })).toBe('7.00');
    expect(formatAtPrecision(-0.012345, { sig: 3 })).toBe('−0.0123');
  });

  it('accepts the value, more digits, and constant expressions', () => {
    expect(checkNumeric('7', two).correct).toBe(true);
    expect(checkNumeric('7.000', two).correct).toBe(true);
    expect(checkNumeric('6.996', two).correct).toBe(true);
    expect(checkNumeric('14/2', two).correct).toBe(true);
    expect(checkNumeric('3.14', pi2).correct).toBe(true);
    expect(checkNumeric('pi', pi2).correct).toBe(true);
    expect(checkNumeric('λ = 7', two).correct).toBe(true);
    const v = checkNumeric('7', two);
    expect(v.message).toBe('Right: 7.00.');
    expect(v.understood).toBe('7');
  });

  it('explains wrong, empty, unparseable and too-rough answers', () => {
    expect(checkNumeric('', two).reason).toBe('empty');
    expect(checkNumeric('6', two)).toMatchObject({ correct: false, reason: 'wrong', message: 'Not 6.' });
    expect(checkNumeric('-6', two).message).toBe('Not −6.');
    expect(checkNumeric('seven', two).reason).toBe('unparseable');
    expect(checkNumeric('3 +', two).reason).toBe('unparseable');
    expect(checkNumeric('3.1', pi2)).toMatchObject({ reason: 'precision', message: 'Close. Give it to 2 decimal places.' });
    expect(checkNumeric('3.2', pi2).reason).toBe('wrong');
  });

  it('exact answers accept exact forms only', () => {
    const third: NumericAnswer = { kind: 'numeric', value: 1 / 3, precision: 'exact' };
    expect(checkNumeric('1/3', third).correct).toBe(true);
    expect(checkNumeric('2/6', third).correct).toBe(true);
    expect(checkNumeric('0.333', third).correct).toBe(false);
    const root: NumericAnswer = { kind: 'numeric', value: Math.SQRT1_2, precision: 'exact' };
    expect(checkNumeric('sqrt(2)/2', root).correct).toBe(true);
    expect(checkNumeric('1/sqrt(2)', root).correct).toBe(true);
  });

  it('matches the common wrong answer', () => {
    const v = checkNumeric('6', two, [{ answer: 6, why: 'a diagonal entry' }]);
    expect(v.commonWrong).toBe(0);
    expect(checkNumeric('5', two, [{ answer: 6, why: 'x' }]).commonWrong).toBeUndefined();
  });

  it('lists: vectors in order, roots in any order', () => {
    const vec: NumericAnswer = { kind: 'numeric', value: [1, -2], precision: 'exact' };
    expect(checkNumeric('(1, -2)', vec).correct).toBe(true);
    expect(checkNumeric('1, −2', vec).correct).toBe(true);
    expect(checkNumeric('(-2, 1)', vec).correct).toBe(false);
    expect(checkNumeric('1', vec)).toMatchObject({ reason: 'count', message: 'Give 2 values, separated by commas.' });
    const roots: NumericAnswer = { kind: 'numeric', value: [5, 2], ordered: false, precision: 'exact' };
    expect(checkNumeric('2, 5', roots).correct).toBe(true);
    expect(checkNumeric('x = 5; 2', roots).correct).toBe(true);
    const cw = checkNumeric('3, 4', roots, [{ answer: [4, 3], why: 'sum and product swapped' }]);
    expect(cw.commonWrong).toBe(0); // ordered:false compares as sets: {3, 4} matches [4, 3]
  });

  it('units: required, converted, wrong dimension, strict', () => {
    const g: NumericAnswer = { kind: 'numeric', value: 9.81, precision: { sig: 3 }, unit: 'm/s^2' };
    expect(checkNumeric('9.81 m/s^2', g).correct).toBe(true);
    expect(checkNumeric('9.81 m/s²', g).correct).toBe(true);
    expect(checkNumeric('981 cm/s^2', g).correct).toBe(true);
    expect(checkNumeric('9.81', g)).toMatchObject({ reason: 'unit-missing', message: 'The number is right; now add the unit (m/s²).' });
    expect(checkNumeric('9.81 m/s', g)).toMatchObject({ reason: 'unit-dimension', message: '"m/s" measures speed, but the answer is an acceleration.' });
    expect(checkNumeric('9.81 kg', g).reason).toBe('unit-dimension');
    expect(checkNumeric('9.81 furlongs', g).reason).toBe('unparseable');
    const strict: NumericAnswer = { kind: 'numeric', value: 10, precision: { sig: 2 }, unit: 'm/s', strictUnit: true };
    expect(checkNumeric('36 km/h', strict)).toMatchObject({ reason: 'unit-exact', message: 'Right value; give it in m/s.' });
    expect(checkNumeric('10 m/s', strict).correct).toBe(true);
    const given: NumericAnswer = { kind: 'numeric', value: 2.5, precision: { decimals: 1 }, unit: 's', askUnit: false };
    expect(checkNumeric('2.5', given).correct).toBe(true);
    expect(checkNumeric('2500 ms', given).correct).toBe(true);
  });

  it('percent for unit-less answers', () => {
    const p: NumericAnswer = { kind: 'numeric', value: 0.25, precision: { decimals: 2 } };
    expect(checkNumeric('25%', p).correct).toBe(true);
    expect(checkNumeric('0.25', p).correct).toBe(true);
  });
});

describe('symbolic answers', () => {
  const d: SymbolicAnswer = { kind: 'symbolic', expr: '2x cos(x^2)', vars: ['x'], label: "f'(x) =" };

  it('accepts equivalent forms and strips a label', () => {
    expect(checkSymbolic('2x cos(x^2)', d).correct).toBe(true);
    expect(checkSymbolic('cos(x^2)*2x', d).correct).toBe(true);
    expect(checkSymbolic("f'(x) = 2 x cos x^2", d).correct).toBe(true);
    expect(checkSymbolic('2x cos(x^2)', d).understood).toBe('2\\,x\\,\\cos\\left({x}^{2}\\right)');
  });

  it('rejects, explains, and matches common mistakes', () => {
    const v = checkSymbolic('cos(x^2)', d, [{ answer: 'cos(x^2)', why: 'forgot the chain rule' }]);
    expect(v).toMatchObject({ correct: false, reason: 'wrong', commonWrong: 0 });
    expect(v.message).toMatch(/differ at x = /);
    expect(checkSymbolic('2y', d).reason).toBe('unparseable');
    expect(checkSymbolic('', d).reason).toBe('empty');
  });

  it('disallowed forms and antiderivatives', () => {
    const simp: SymbolicAnswer = { kind: 'symbolic', expr: 'x', vars: ['x'], domain: { lo: 0.1, hi: 3 }, disallow: ['sqrt'] };
    expect(checkSymbolic('sqrt(x^2)', simp).reason).toBe('form');
    expect(checkSymbolic('x', simp).correct).toBe(true);
    const anti: SymbolicAnswer = { kind: 'symbolic', expr: 'x^3/3', vars: ['x'], upToConstant: true };
    expect(checkSymbolic('x^3/3 + 5', anti)).toMatchObject({ correct: true, message: 'Right (any constant works).' });
  });
});

describe('choice, drag, proof and dispatch', () => {
  it('single and multi choice', () => {
    const one = { kind: 'choice' as const, options: ['a', 'b', 'c'], correct: 1 };
    expect(checkChoice(1, one).correct).toBe(true);
    expect(checkChoice(2, one, [{ answer: 2, why: 'x' }])).toMatchObject({ correct: false, commonWrong: 0 });
    expect(checkChoice([], one).reason).toBe('empty');
    const many = { kind: 'choice' as const, options: ['a', 'b', 'c'], correct: [0, 2] };
    expect(checkChoice([2, 0], many).correct).toBe(true);
    expect(checkChoice([0], many).message).toMatch(/more options/);
  });

  it('drag targets', () => {
    const pt = { mode: 'point' as const, view: { x: [-5, 5] as const, y: [-5, 5] as const }, start: [0, 0] as [number, number], answer: [2, 1] as [number, number], tolerance: 0.2, label: 'p' };
    expect(checkDrag([2.1, 1.05], pt).correct).toBe(true);
    expect(checkDrag([3, 1], pt).correct).toBe(false);
    const multi = { ...pt, answer: [[1, 1], [-1, -1]] as [number, number][] };
    expect(checkDrag([-1, -0.9], multi).correct).toBe(true);
    const order = { mode: 'order' as const, items: ['a', 'b', 'c'], correct: [2, 0, 1] };
    expect(checkDrag([2, 0, 1], order).correct).toBe(true);
    expect(checkDrag([0, 1, 2], order, [{ answer: '[0, 1, 2]', why: 'input order' }]).commonWrong).toBe(0);
    const match = { mode: 'match' as const, items: ['a', 'b'], slots: ['x', 'y'], correct: [1, 0] };
    expect(checkDrag([1, -1], match).reason).toBe('incomplete');
    expect(checkDrag([0, 1], match).message).toBe('0 of 2 in the right place.');
    expect(checkDrag([1, 0], match).correct).toBe(true);
    const slider = { mode: 'slider' as const, label: 'h', min: 0, max: 1, step: 0.01, start: 1, answer: 0.1, tolerance: 0.02 };
    expect(checkDrag(0.11, slider).correct).toBe(true);
    const custom = { mode: 'custom' as const, initial: 0, check: (s: unknown) => s === 42 };
    expect(checkDrag(42, custom).correct).toBe(true);
  });

  it('proof self-check and dispatch', () => {
    const proof = { kind: 'proof' as const, modelAnswer: 'm', checklist: ['base case', 'inductive step'] };
    expect(checkProof([true, false], proof).reason).toBe('incomplete');
    expect(checkProof([true, true], proof).correct).toBe(true);
    expect(checkAnswer({ kind: 'numeric', value: 2, precision: 'exact' }, { kind: 'numeric', text: '4/2' }).correct).toBe(true);
    expect(() => checkAnswer({ kind: 'numeric', value: 2, precision: 'exact' }, { kind: 'symbolic', text: 'x' })).toThrow();
  });
});

describe('review fixes: numeric answers', () => {
  it('writtenPrecision counts significant figures correctly', () => {
    expect(writtenPrecision('3.14')).toEqual({ decimals: 2, sig: 3 });
    expect(writtenPrecision('12.5')).toEqual({ decimals: 1, sig: 3 });
    expect(writtenPrecision('-0.0120')).toEqual({ decimals: 4, sig: 3 });
    expect(writtenPrecision('−7')).toEqual({ decimals: 0, sig: 1 });
    expect(writtenPrecision('1/3')).toBeNull();
  });

  it('scalar-multiple and direction equivalence (eigenvectors)', () => {
    const ev: NumericAnswer = { kind: 'numeric', value: [1, 1], precision: 'exact', equivalence: 'scalar-multiple' };
    expect(checkNumeric('(2, 2)', ev).correct).toBe(true);
    expect(checkNumeric('(-1, -1)', ev).correct).toBe(true);
    expect(checkNumeric('(1, 1)', ev).message).toBe('Right: any nonzero multiple of (1, 1) works.');
    expect(checkNumeric('(1, 2)', ev).correct).toBe(false);
    expect(checkNumeric('(0, 0)', ev)).toMatchObject({ correct: false, message: expect.stringMatching(/nonzero vector/) });
    const dir: NumericAnswer = { ...ev, equivalence: 'direction' };
    expect(checkNumeric('(3, 3)', dir).correct).toBe(true);
    expect(checkNumeric('(-1, -1)', dir)).toMatchObject({ correct: false, message: expect.stringMatching(/wrong way/) });
    // Precision applies after scaling so the answer's largest entry is 1: (1, 0.33) and (100, 33) both match (3, 1) to 2 dp.
    const third: NumericAnswer = { kind: 'numeric', value: [3, 1], precision: { decimals: 2 }, equivalence: 'scalar-multiple' };
    expect(checkNumeric('1, 0.33', third).correct).toBe(true);
    expect(checkNumeric('100, 33', third).correct).toBe(true);
    expect(checkNumeric('1, 0.3', third).correct).toBe(false);
    expect(checkNumeric('(0, 3)', { ...ev, value: [0, 1] }).correct).toBe(true);
    // Common wrong answers match under the same equivalence, and the zero vector can be one.
    const cw = [{ answer: [1, -1], why: 'λ = 1' }, { answer: [0, 0], why: 'nonzero' }];
    expect(checkNumeric('(-2, 2)', ev, cw).commonWrong).toBe(0);
    expect(checkNumeric('0, 0', ev, cw).commonWrong).toBe(1);
  });

  it('matrix answers (shape) and custom checks', () => {
    const m: NumericAnswer = { kind: 'numeric', value: [2, 1, 1, 2], precision: 'exact', shape: [2, 2] };
    expect(checkNumeric('2, 1, 1, 2', m)).toMatchObject({ correct: true, understood: '\\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}' });
    expect(checkNumeric('2, 1, 1', m)).toMatchObject({ reason: 'count', message: 'Fill in all 4 entries of the 2×2 matrix.' });
    const onLine: NumericAnswer = { kind: 'numeric', value: [1, 2], precision: { decimals: 2 }, check: ([x, y]) => (x === 0 && y === 0 ? 'Not the origin.' : Math.abs(y - 2 * x) < 0.01) };
    expect(checkNumeric('3, 6', onLine)).toMatchObject({ correct: true, message: 'Right.' });
    expect(checkNumeric('0, 0', onLine)).toMatchObject({ correct: false, message: 'Not the origin.' });
    expect(checkNumeric('1, 1', onLine).message).toBe('Not 1, 1.');
  });

  it('complex answers, including a ± pair', () => {
    const pair: NumericAnswer = { kind: 'numeric', value: [1, 2, 1, -2], ordered: false, precision: 'exact', complex: true };
    expect(checkNumeric('1 + 2i, 1 - 2i', pair).correct).toBe(true);
    expect(checkNumeric('1 - 2i, 1 + 2i', pair).correct).toBe(true);
    expect(checkNumeric('1 ± 2i', pair).correct).toBe(true);
    expect(checkNumeric('1 +- 2j', pair).correct).toBe(true);
    expect(checkNumeric('2i + 1, 1 - 2i', pair).correct).toBe(true);
    expect(checkNumeric('1 + 2i', pair).reason).toBe('count');
    expect(checkNumeric('1 + 2i^2, 1', pair).reason).toBe('unparseable');
    const rot: NumericAnswer = { kind: 'numeric', value: [0, 1], precision: 'exact', complex: true };
    expect(checkNumeric('i', rot).correct).toBe(true);
    expect(checkNumeric('-i', rot, [{ answer: '-i', why: 'conjugate' }])).toMatchObject({ correct: false, commonWrong: 0 });
    expect(parseComplex('3 - 4i')).toMatchObject({ re: 3, im: -4 });
  });

  it('units per list item, unitless answers, exact-form common wrongs', () => {
    const lens: NumericAnswer = { kind: 'numeric', value: [3, 4], precision: { sig: 2 }, unit: 'm' };
    expect(checkNumeric('3 m, 400 cm', lens).correct).toBe(true);
    expect(checkNumeric('300 cm, 4 m', lens).correct).toBe(true);
    expect(checkNumeric('3, 4 m', lens).correct).toBe(true); // one unit at the end applies to all
    expect(checkNumeric('3 m, 4', lens).reason).toBe('unit-missing');
    const plain: NumericAnswer = { kind: 'numeric', value: 5, precision: 'exact' };
    expect(checkNumeric('5 m', plain)).toMatchObject({ correct: false, reason: 'unit-dimension', message: 'Right number, but this answer has no unit: leave out "m".' });
    expect(checkNumeric('1.5 rad', { kind: 'numeric', value: 1.5, precision: 'exact' }).correct).toBe(true);
    const third: NumericAnswer = { kind: 'numeric', value: 0.5, precision: 'exact' };
    expect(checkNumeric('1/3', third, [{ answer: '1/3', why: 'x' }]).commonWrong).toBe(0);
  });

  it('angular frequency vs Hz', () => {
    const omega: NumericAnswer = { kind: 'numeric', value: 2 * Math.PI, precision: { sig: 3 }, unit: 'rad/s' };
    expect(checkNumeric('6.28 rad/s', omega).correct).toBe(true);
    expect(checkNumeric('60 rpm', omega).correct).toBe(true);
    expect(checkNumeric('1 rev/s', omega).correct).toBe(true);
    expect(checkNumeric('6.28 s^-1', omega).correct).toBe(true); // rad is dimensionless
    expect(checkNumeric('1 Hz', omega)).toMatchObject({ correct: false, reason: 'unit-dimension', message: expect.stringMatching(/ω = 2πf/) });
    expect(checkNumeric('6.28 Hz', omega).reason).toBe('unit-dimension');
    const one: NumericAnswer = { kind: 'numeric', value: 1, precision: { sig: 3 }, unit: 'rad/s' };
    expect(checkNumeric('1 Hz', one).correct).toBe(false); // the classic mistake isn't marked right
    const f: NumericAnswer = { kind: 'numeric', value: 1, precision: { sig: 3 }, unit: 'Hz' };
    expect(checkNumeric('1 Hz', f).correct).toBe(true);
    expect(checkNumeric('60 rpm', f).correct).toBe(true);
    expect(checkNumeric('1 s^-1', f).correct).toBe(true);
    expect(checkNumeric('6.28 rad/s', f)).toMatchObject({ correct: false, reason: 'unit-dimension', message: expect.stringMatching(/f = ω\/2π/) });
    const rate: NumericAnswer = { kind: 'numeric', value: 0.5, precision: { sig: 2 }, unit: 's^-1' };
    expect(checkNumeric('0.5 Hz', rate).correct).toBe(true);
    expect(checkNumeric('0.5 rad/s', rate).correct).toBe(true);
  });

  it('unit pseudo-dimensions and angleCompat', () => {
    expect(parseUnit('rad/s')).toMatchObject({ angle: 1 });
    expect(parseUnit('kHz')).toMatchObject({ cycle: 1 });
    expect(parseUnit('rpm')).toMatchObject({ angle: 1, rev: true });
    expect(parseUnit('m').angle).toBeUndefined();
    expect(angleCompat(parseUnit('Hz'), parseUnit('rad/s'))).toMatchObject({ ok: false });
    const r = angleCompat(parseUnit('rpm'), parseUnit('Hz'));
    expect(r.ok && r.factor).toBeCloseTo(1 / (2 * Math.PI), 12);
    expect(angleCompat(parseUnit('N m'), parseUnit('J'))).toEqual({ ok: true, factor: 1 });
  });
});

describe('review fixes: symbolic and drag answers', () => {
  it('accepts "+ C" on antiderivatives and explains it elsewhere', () => {
    const anti: SymbolicAnswer = { kind: 'symbolic', expr: '3x^2', vars: ['x'], upToConstant: true };
    expect(checkSymbolic('3x^2 + C', anti)).toMatchObject({ correct: true, understood: '3\\,{x}^{2} + C' });
    expect(checkSymbolic('C + 3x^2', anti).correct).toBe(true);
    expect(checkSymbolic('3x^2 + c', anti).correct).toBe(true);
    expect(checkSymbolic('3x^2 + K', anti).correct).toBe(true);
    expect(checkSymbolic('x^3 + C', anti).correct).toBe(false);
    const withC: SymbolicAnswer = { kind: 'symbolic', expr: 'x + C', vars: ['x', 'C'], upToConstant: true };
    expect(checkSymbolic('x + C', withC).correct).toBe(true); // C is a declared variable here: not stripped
    const plain: SymbolicAnswer = { kind: 'symbolic', expr: '3x^2', vars: ['x'] };
    expect(checkSymbolic('3x^2 + C', plain)).toMatchObject({ reason: 'unparseable', message: expect.stringMatching(/No "\+ C" here/) });
    expect(stripIntegrationConstant('sin x + C', ['x'])).toEqual({ text: 'sin x', stripped: true });
  });

  it('disallow matches tokens, not substrings', () => {
    const noE: SymbolicAnswer = { kind: 'symbolic', expr: '1/cos(x)', vars: ['x'], domain: { lo: -1, hi: 1 }, disallow: ['e'] };
    expect(checkSymbolic('sec x', noE).correct).toBe(true); // "sec" contains an e, but not the constant e
    expect(checkSymbolic('e^(ln(1/cos(x)))', noE).reason).toBe('form');
    const noLn: SymbolicAnswer = { kind: 'symbolic', expr: 'x', vars: ['x', 'n'], domain: { lo: 0.5, hi: 2 }, disallow: ['ln'] };
    expect(checkSymbolic('x + 0*n', noLn).correct).toBe(true); // a variable n isn't "ln"
    expect(checkSymbolic('ln(e^x)', noLn).reason).toBe('form');
    const noAsin: SymbolicAnswer = { kind: 'symbolic', expr: 'x', vars: ['x'], domain: { lo: -0.9, hi: 0.9 }, disallow: ['asin'] };
    expect(checkSymbolic('arcsin(sin(x))', noAsin).reason).toBe('form'); // aliases count
  });

  it('point and slider common wrongs match within the target tolerance', () => {
    const pt = { mode: 'point' as const, view: { x: [-5, 5] as const, y: [-5, 5] as const }, start: [0, 0] as [number, number], answer: [3, 3] as [number, number], tolerance: 0.25, label: 'p' };
    const cw = [{ answer: '[1, 1]', why: 'that is v itself' }];
    expect(checkDrag([1, 1], pt, cw).commonWrong).toBe(0);
    expect(checkDrag([1.1, 0.95], pt, cw).commonWrong).toBe(0);
    expect(checkDrag([2, 1], pt, cw).commonWrong).toBeUndefined();
    const slider = { mode: 'slider' as const, label: 'h', min: 0, max: 1, step: 0.01, start: 1, answer: 0.1, tolerance: 0.02 };
    expect(checkDrag(0.51, slider, [{ answer: 0.5, why: 'half' }]).commonWrong).toBe(0);
    expect(dragStateOf({ answer: '[2, 0, 1]', why: '' })).toEqual([2, 0, 1]);
    expect(dragStateOf({ answer: 'not json', why: '' })).toBeUndefined();
  });
});
