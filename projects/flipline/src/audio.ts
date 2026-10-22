/**
 * All sound is synthesized live with the Web Audio API: a synthwave loop with
 * layers that fade in as the run heats up, plus every sound effect. Nothing is
 * downloaded, and the whole thing stays under a compressor so phone speakers
 * never clip.
 */

const BPM = 112;
const STEP = 60 / BPM / 4; // one 16th note
// A minor: Am – F – C – G, one bar each. Roots as MIDI notes.
const PROGRESSION = [
  { root: 45, triad: [0, 3, 7] },
  { root: 41, triad: [0, 4, 7] },
  { root: 48, triad: [0, 4, 7] },
  { root: 43, triad: [0, 4, 7] },
];
const BASS_PATTERN = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 7, 12];
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3];
const LEAD = [12, null, 7, null, 10, null, 7, 5, 12, null, 14, 12, 10, null, 7, null];
/** Pentatonic steps for orb pickups, so combos climb a melody instead of a siren. */
const PICKUP_SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfx!: GainNode;
  private delay!: DelayNode;
  private noise!: AudioBuffer;
  private layers = { pad: 1, arp: 0.7, drums: 0, bass: 0, lead: 0 };
  private target = { ...this.layers };
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  transpose = 0;
  muted = false;

  /** Must run inside a user gesture (autoplay rules). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) this.build();
    if (this.ctx!.state === 'suspended') void this.ctx!.resume();
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  private build(): void {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    comp.connect(this.master).connect(ctx.destination);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.musicFilter).connect(comp);

    // Dotted-eighth echo: the signature synthwave shimmer on the arpeggio.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2800;
    this.delay.connect(tone).connect(fb).connect(this.delay);
    tone.connect(wet).connect(this.music);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(comp);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** 0 = menu, 1 = running, 2+ = later zones (adds the lead line). */
  setIntensity(level: number): void {
    this.target = {
      pad: 1,
      arp: level === 0 ? 0.6 : 0.8,
      drums: level >= 1 ? 1 : 0,
      bass: level >= 1 ? 1 : 0,
      lead: level >= 2 ? 0.8 : 0,
    };
  }

  /** Muffle the music (game over, pause) or open it back up. */
  muffle(on: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(on ? 380 : 18000, t, on ? 0.12 : 0.3);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
      this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    }
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  // ── Sequencer ──────────────────────────────────────────────────────────────

  private schedule(): void {
    const ctx = this.ctx!;
    if (ctx.state !== 'running') return;
    // Ease layer volumes toward their targets once per tick.
    for (const k of Object.keys(this.layers) as (keyof typeof this.layers)[]) {
      this.layers[k] += (this.target[k] - this.layers[k]) * 0.08;
    }
    // If the tab stalled, skip ahead rather than firing a burst of late notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number): void {
    const bar = PROGRESSION[Math.floor(step / 16)];
    const s = step % 16;
    const root = bar.root + this.transpose;
    const L = this.layers;

    if (s === 0 && L.pad > 0.02) this.pad(root, bar.triad, t, STEP * 16, L.pad);
    if (L.arp > 0.02) {
      const tones = [...bar.triad, 12];
      this.pluck(mtof(root + 24 + tones[ARP_PATTERN[s]]), t, 0.06 * L.arp);
    }
    if (L.bass > 0.02 && s % 2 === 0) this.bass(mtof(root - 12 + BASS_PATTERN[s]), t, 0.22 * L.bass);
    if (L.drums > 0.02) {
      if (s % 4 === 0) this.kick(t, 0.9 * L.drums);
      if (s === 4 || s === 12) this.snare(t, 0.35 * L.drums);
      if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.07 : 0.04, L.drums);
    }
    const lead = LEAD[s];
    if (L.lead > 0.02 && lead !== null && Math.floor(step / 16) % 2 === 1) {
      this.leadNote(mtof(root + 24 + lead), t, STEP * 1.8, 0.07 * L.lead);
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private pad(root: number, triad: number[], t: number, dur: number, level: number): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(700, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.028 * level, t + 0.5);
    g.gain.setValueAtTime(0.028 * level, t + dur - 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
    f.connect(g).connect(this.music);
    for (const n of triad) {
      for (const det of [-9, 9]) this.osc('sawtooth', mtof(root + 12 + n), t, dur + 0.2, f, det);
    }
  }

  private pluck(freq: number, t: number, level: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.15);
    this.env(g, t, level, 0.004, 0.18);
    f.connect(g);
    g.connect(this.music);
    g.connect(this.delay);
    this.osc('square', freq, t, 0.2, f);
  }

  private bass(freq: number, t: number, level: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(220, t + STEP * 1.6);
    this.env(g, t, level, 0.005, STEP * 1.8);
    f.connect(g).connect(this.music);
    this.osc('sawtooth', freq, t, STEP * 2, f);
    // A square an octave up so the bass line survives tiny phone speakers.
    this.osc('square', freq * 2, t, STEP * 2, f, 4);
  }

  private kick(t: number, level: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    this.env(g, t, level, 0.002, 0.32);
    g.connect(this.music);
    const o = this.osc('sine', 150, t, 0.35, g);
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  }

  private noiseHit(t: number, level: number, dur: number, type: BiquadFilterType, freq: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, level, 0.002, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private snare(t: number, level: number): void {
    this.noiseHit(t, level, 0.18, 'bandpass', 1800, this.music);
    const g = this.ctx!.createGain();
    this.env(g, t, level * 0.5, 0.002, 0.08);
    g.connect(this.music);
    this.osc('triangle', 190, t, 0.1, g);
  }

  private hat(t: number, level: number, mix: number): void {
    this.noiseHit(t, level * mix, 0.04, 'highpass', 8000, this.music);
  }

  private leadNote(freq: number, t: number, dur: number, level: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.02);
    g.gain.setValueAtTime(level, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    f.connect(g);
    g.connect(this.music);
    g.connect(this.delay);
    const vib = ctx.createOscillator();
    const vibAmt = ctx.createGain();
    vib.frequency.value = 5.5;
    vibAmt.gain.value = 9;
    vib.connect(vibAmt);
    for (const det of [-6, 6]) {
      const o = this.osc('sawtooth', freq, t, dur, f, det);
      vibAmt.connect(o.detune);
    }
    vib.start(t);
    vib.stop(t + dur + 0.05);
  }

  // ── Sound effects ──────────────────────────────────────────────────────────

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  flip(up: boolean): void {
    if (!this.ctx) return;
    const t = this.now;
    const g = this.ctx.createGain();
    this.env(g, t, 0.16, 0.004, 0.14);
    g.connect(this.sfx);
    const o = this.osc('triangle', up ? 320 : 640, t, 0.16, g);
    o.frequency.exponentialRampToValueAtTime(up ? 760 : 260, t + 0.13);
    this.noiseHit(t, 0.05, 0.1, 'bandpass', up ? 3000 : 1500, this.sfx);
  }

  land(): void {
    if (!this.ctx) return;
    this.noiseHit(this.now, 0.07, 0.05, 'lowpass', 900, this.sfx);
  }

  orb(combo: number, arc: boolean): void {
    if (!this.ctx) return;
    const t = this.now;
    const n = 69 + this.transpose + PICKUP_SCALE[Math.min(combo, PICKUP_SCALE.length - 1)];
    const g = this.ctx.createGain();
    this.env(g, t, arc ? 0.2 : 0.13, 0.003, 0.25);
    g.connect(this.sfx);
    g.connect(this.delay);
    this.osc('sine', mtof(n), t, 0.3, g);
    this.osc('triangle', mtof(n + 12), t, 0.3, g);
  }

  close(): void {
    if (!this.ctx) return;
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      const g = this.ctx.createGain();
      this.env(g, t + i * 0.05, 0.07, 0.003, 0.2);
      g.connect(this.sfx);
      this.osc('sine', mtof(84 + this.transpose + [0, 4, 7][i]), t + i * 0.05, 0.25, g);
    }
  }

  death(): void {
    if (!this.ctx) return;
    const t = this.now;
    this.noiseHit(t, 0.5, 0.7, 'lowpass', 1800, this.sfx);
    const g = this.ctx.createGain();
    this.env(g, t, 0.35, 0.005, 0.6);
    g.connect(this.sfx);
    const o = this.osc('sawtooth', 220, t, 0.7, g);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
  }

  zone(): void {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7, 12, 16].forEach((n, i) => {
      const g = this.ctx!.createGain();
      this.env(g, t + i * 0.07, 0.09, 0.005, 0.35);
      g.connect(this.sfx);
      g.connect(this.delay);
      this.osc('square', mtof(72 + this.transpose + n), t + i * 0.07, 0.4, g);
    });
  }

  click(): void {
    if (!this.ctx) return;
    const t = this.now;
    const g = this.ctx.createGain();
    this.env(g, t, 0.08, 0.002, 0.05);
    g.connect(this.sfx);
    this.osc('square', 1200, t, 0.06, g);
  }
}
