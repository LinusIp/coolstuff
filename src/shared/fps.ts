/**
 * Rolling frame-time meter. Projects call `tick()` once per frame and read
 * `fps` to decide whether to scale quality up or down.
 */
export class FpsMeter {
  private samples: number[] = [];
  private last = 0;

  constructor(private readonly windowSize = 60) {}

  tick(now = performance.now()): number {
    if (this.last > 0) {
      // Clamp huge gaps (tab switch, breakpoint) so they don't poison the average.
      this.samples.push(Math.min(now - this.last, 250));
      if (this.samples.length > this.windowSize) this.samples.shift();
    }
    this.last = now;
    return this.fps;
  }

  /** Forget history, e.g. after the tab becomes visible again. */
  reset(): void {
    this.samples = [];
    this.last = 0;
  }

  get ready(): boolean {
    return this.samples.length >= this.windowSize;
  }

  get fps(): number {
    if (this.samples.length === 0) return 60;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return 1000 / avg;
  }
}

/**
 * Adjusts a quality level in [min, max] from the measured frame rate, with
 * hysteresis so it doesn't oscillate. Returns the new level when it changes.
 */
export class QualityGovernor {
  private meter = new FpsMeter(45);
  private cooldown = 0;

  constructor(
    public level: number,
    private readonly min: number,
    private readonly max: number,
    private readonly low = 52,
    private readonly high = 59,
  ) {}

  tick(now = performance.now()): number | null {
    this.meter.tick(now);
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    if (!this.meter.ready) return null;
    const fps = this.meter.fps;
    let next = this.level;
    if (fps < this.low && this.level > this.min) next = this.level - 1;
    else if (fps > this.high && this.level < this.max) next = this.level + 1;
    if (next === this.level) return null;
    // Upgrades wait longer than downgrades: dropping frames hurts more than looking slightly soft.
    this.cooldown = next > this.level ? 240 : 90;
    this.level = next;
    this.meter.reset();
    return next;
  }

  reset(): void {
    this.meter.reset();
  }
}
