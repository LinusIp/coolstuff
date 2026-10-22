import {
  AGENT_FS,
  COPY_FS,
  DEPOSIT_FS,
  DEPOSIT_VS,
  DIFFUSE_FS,
  DISPLAY_FS,
  FULLSCREEN_VS,
  GROW_FS,
  SEED_FS,
  SPLAT_FS,
  SPLAT_VS,
} from './shaders';
import { SEED_SHAPES, type SeedShape, type SimParams } from './presets';

/** Agent texture is always 1024 texels wide; the number of active rows sets the population. */
export const AGENT_TEX_WIDTH = 1024;
const TRAIL_LEVELS = 6;
const DEG = Math.PI / 180;

export class SimUnsupportedError extends Error {
  constructor(public readonly reason: 'webgl2' | 'float') {
    super(reason === 'webgl2' ? 'WebGL2 is not available' : 'Float render targets are not available');
  }
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

export interface PointerState {
  /** uv position of the pointer, or null when nothing is pressed. */
  uv: [number, number] | null;
  /** +1 attract, -1 repel. */
  mode: number;
}

export interface Look {
  species: [number, number, number][];
  background: [number, number, number];
  food: [number, number, number];
}

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return [c[0], c[1], c[2]];
}

export function lookFromHex(species: string[], background: string, food: string): Look {
  return {
    species: species.map(hexToLinear),
    background: hexToLinear(background),
    food: hexToLinear(food),
  };
}

/**
 * The whole simulation lives on the GPU: agents in an RGBA32F texture
 * (x, y, heading, species tag), pheromone in a mip-mapped RGBA16F trail map.
 * Nothing is ever read back to the CPU.
 */
export class PhysarumSim {
  readonly gl: WebGL2RenderingContext;
  readonly maxRows: number;
  rows: number;
  trailW = 0;
  trailH = 0;
  cssW = 1;
  cssH = 1;

  private agents: [Target, Target];
  private trail: [Target, Target] | null = null;
  private seedProg: Program;
  private growProg: Program;
  private agentProg: Program;
  private depositProg: Program;
  private diffuseProg: Program;
  private copyProg: Program;
  private splatProg: Program;
  private displayProg: Program;
  private nearest: WebGLSampler;
  private linearRepeat: WebGLSampler;
  private linearClamp: WebGLSampler;
  private mip: WebGLSampler;
  private frame = 0;
  private vao: WebGLVertexArrayObject;

  constructor(canvas: HTMLCanvasElement, maxRows: number, rows: number) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new SimUnsupportedError('webgl2');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new SimUnsupportedError('float');
    this.gl = gl;
    this.maxRows = maxRows;
    this.rows = Math.min(rows, maxRows);

    this.seedProg = this.program(FULLSCREEN_VS, SEED_FS);
    this.growProg = this.program(FULLSCREEN_VS, GROW_FS);
    this.agentProg = this.program(FULLSCREEN_VS, AGENT_FS);
    this.depositProg = this.program(DEPOSIT_VS, DEPOSIT_FS);
    this.diffuseProg = this.program(FULLSCREEN_VS, DIFFUSE_FS);
    this.copyProg = this.program(FULLSCREEN_VS, COPY_FS);
    this.splatProg = this.program(SPLAT_VS, SPLAT_FS);
    this.displayProg = this.program(FULLSCREEN_VS, DISPLAY_FS);

    this.nearest = this.sampler(gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.linearRepeat = this.sampler(gl.LINEAR, gl.LINEAR, gl.REPEAT);
    this.linearClamp = this.sampler(gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE);
    this.mip = this.sampler(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE);

    // All passes generate their vertices from gl_VertexID; an empty VAO is all they need.
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.agents = [this.target(AGENT_TEX_WIDTH, maxRows, gl.RGBA32F, 1), this.target(AGENT_TEX_WIDTH, maxRows, gl.RGBA32F, 1)];
  }

  get agentCount(): number {
    return this.rows * AGENT_TEX_WIDTH;
  }

  // ── setup helpers ────────────────────────────────────────────────────────

  private program(vsSrc: string, fsSrc: string): Program {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return { program, uniforms: new Map() };
  }

  private use(p: Program): (name: string) => WebGLUniformLocation | null {
    this.gl.useProgram(p.program);
    return (name) => {
      if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
      return p.uniforms.get(name)!;
    };
  }

  private sampler(min: number, mag: number, wrap: number): WebGLSampler {
    const gl = this.gl;
    const s = gl.createSampler()!;
    gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, min);
    gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, mag);
    gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, wrap);
    gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, wrap);
    return s;
  }

  private target(w: number, h: number, format: number, levels: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Immutable storage with every level allocated, so the texture is always mip-complete.
    gl.texStorage2D(gl.TEXTURE_2D, levels, format, w, h);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new SimUnsupportedError('float');
    return { tex, fbo };
  }

  private freeTarget(t: Target): void {
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fbo);
  }

  private bind(unit: number, tex: WebGLTexture | null, sampler: WebGLSampler | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindSampler(unit, sampler);
  }

  /** Leave no texture bound so a later framebuffer can never form a feedback loop. */
  private unbindAll(): void {
    this.bind(0, null, null);
    this.bind(1, null, null);
  }

  private draw(fbo: WebGLFramebuffer | null, w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ── public API ───────────────────────────────────────────────────────────

  /**
   * Sets the logical (css) size and the trail-map resolution. Existing trails
   * are resampled into the new map so a resize never wipes the network.
   */
  resize(cssW: number, cssH: number, trailW: number, trailH: number): void {
    const gl = this.gl;
    this.cssW = cssW;
    this.cssH = cssH;
    if (trailW === this.trailW && trailH === this.trailH && this.trail) return;
    const next: [Target, Target] = [
      this.target(trailW, trailH, gl.RGBA16F, TRAIL_LEVELS),
      this.target(trailW, trailH, gl.RGBA16F, TRAIL_LEVELS),
    ];
    if (this.trail) {
      const u = this.use(this.copyProg);
      gl.uniform1i(u('uTrail'), 0);
      this.bind(0, this.trail[0].tex, this.linearClamp);
      this.draw(next[0].fbo, trailW, trailH);
      this.unbindAll();
      this.freeTarget(this.trail[0]);
      this.freeTarget(this.trail[1]);
    }
    this.trail = next;
    this.trailW = trailW;
    this.trailH = trailH;
  }

  /** Lays out every agent (active or not) in a seed shape, and optionally clears the trails. */
  seed(shape: SeedShape, clearTrail: boolean): void {
    const gl = this.gl;
    const u = this.use(this.seedProg);
    gl.uniform1i(u('uShape'), SEED_SHAPES.indexOf(shape));
    gl.uniform1ui(u('uSeed'), (Math.random() * 0xffffffff) >>> 0);
    gl.uniform2f(u('uCss'), this.cssW, this.cssH);
    this.draw(this.agents[0].fbo, AGENT_TEX_WIDTH, this.maxRows);
    if (clearTrail && this.trail) {
      gl.clearColor(0, 0, 0, 0);
      for (const t of this.trail) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  /** Changes the active population; newly woken agents clone existing ones. */
  setRows(rows: number): void {
    rows = Math.max(1, Math.min(this.maxRows, Math.round(rows)));
    if (rows > this.rows) {
      const gl = this.gl;
      const u = this.use(this.growProg);
      gl.uniform1i(u('uAgents'), 0);
      gl.uniform1i(u('uOldRows'), this.rows);
      gl.uniform1ui(u('uSeed'), (Math.random() * 0xffffffff) >>> 0);
      this.bind(0, this.agents[0].tex, this.nearest);
      this.draw(this.agents[1].fbo, AGENT_TEX_WIDTH, rows);
      this.unbindAll();
      this.agents.reverse();
    }
    this.rows = rows;
  }

  /** Drops a dab of food (amount > 0) or repellent (amount < 0) into the trail map. */
  splat(uv: [number, number], radiusPx: number, amount: number): void {
    if (!this.trail) return;
    const gl = this.gl;
    const u = this.use(this.splatProg);
    gl.uniform2f(u('uCenter'), uv[0], uv[1]);
    gl.uniform2f(u('uRadius'), radiusPx / this.cssW, radiusPx / this.cssH);
    gl.uniform1f(u('uAmount'), amount);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trail[0].fbo);
    gl.viewport(0, 0, this.trailW, this.trailH);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  /** One full simulation step: sense/rotate/move, deposit, diffuse + decay. */
  step(p: SimParams, pointer: PointerState, speed: number): void {
    if (!this.trail) return;
    const gl = this.gl;
    this.frame++;
    const v = p.variety;
    const scale: [number, number, number] = [1, 1 + v, 1 - 0.45 * v];

    // 1. Agents sense the trail and move.
    let u = this.use(this.agentProg);
    gl.uniform1i(u('uAgents'), 0);
    gl.uniform1i(u('uTrail'), 1);
    gl.uniform2f(u('uPx'), 1 / this.cssW, 1 / this.cssH);
    gl.uniform1f(u('uSA'), p.sensorAngle * DEG);
    gl.uniform1f(u('uSD'), p.sensorDistance);
    gl.uniform1f(u('uRA'), p.turnSpeed * DEG * Math.min(1, speed * 1.5));
    gl.uniform1f(u('uStep'), p.stepSize * speed);
    gl.uniform1f(u('uRepulsion'), p.repulsion);
    gl.uniform1f(u('uCount'), p.species);
    gl.uniform3f(u('uScale'), scale[0], scale[1], scale[2]);
    gl.uniform1f(u('uSat'), 6);
    gl.uniform1ui(u('uFrame'), this.frame);
    const pull = pointer.uv ? pointer.mode : 0;
    const pu = pointer.uv ?? [0, 0];
    gl.uniform4f(u('uPointer'), pu[0], pu[1], pull, 110);
    this.bind(0, this.agents[0].tex, this.nearest);
    this.bind(1, this.trail[0].tex, this.linearRepeat);
    this.draw(this.agents[1].fbo, AGENT_TEX_WIDTH, this.rows);
    this.unbindAll();
    this.agents.reverse();

    // 2. Every agent drops pheromone as a single additive point.
    // Deposit is normalised by agent density so brightness and the food/trail
    // balance stay put when the quality governor changes the population.
    const density = this.agentCount / (this.trailW * this.trailH);
    const depositScale = Math.min(4, Math.max(0.15, 0.5 / density));
    u = this.use(this.depositProg);
    gl.uniform1i(u('uAgents'), 0);
    gl.uniform1f(u('uCount'), p.species);
    gl.uniform1f(u('uDeposit'), p.deposit * depositScale * speed);
    this.bind(0, this.agents[0].tex, this.nearest);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trail[0].fbo);
    gl.viewport(0, 0, this.trailW, this.trailH);
    gl.drawArrays(gl.POINTS, 0, this.agentCount);
    gl.disable(gl.BLEND);
    this.unbindAll();

    // 3. The trail map blurs and evaporates.
    u = this.use(this.diffuseProg);
    gl.uniform1i(u('uTrail'), 0);
    gl.uniform1f(u('uDiffuse'), p.diffusion);
    gl.uniform1f(u('uDecay'), Math.pow(p.decay, speed));
    gl.uniform1f(u('uFoodDecay'), Math.pow(0.992, speed));
    this.bind(0, this.trail[0].tex, null);
    this.draw(this.trail[1].fbo, this.trailW, this.trailH);
    this.unbindAll();
    this.trail.reverse();
  }

  /** Tone-maps the trail map to the canvas. */
  render(p: SimParams, look: Look, fade: number): void {
    if (!this.trail) return;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    // Mips of the current trail are the bloom: a blurred pyramid for free.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trail[0].tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    const u = this.use(this.displayProg);
    gl.uniform1i(u('uTrail'), 0);
    const [c0, c1, c2] = look.species;
    gl.uniform3f(u('uC0'), c0[0], c0[1], c0[2]);
    gl.uniform3f(u('uC1'), c1[0], c1[1], c1[2]);
    gl.uniform3f(u('uC2'), c2[0], c2[1], c2[2]);
    gl.uniform3f(u('uBg'), look.background[0], look.background[1], look.background[2]);
    gl.uniform3f(u('uFood'), look.food[0], look.food[1], look.food[2]);
    gl.uniform1f(u('uExposure'), p.exposure);
    gl.uniform1f(u('uGlow'), p.glow);
    gl.uniform2f(u('uView'), canvas.width, canvas.height);
    gl.uniform1f(u('uFade'), fade);
    this.bind(0, this.trail[0].tex, this.mip);
    this.draw(null, canvas.width, canvas.height);
    this.unbindAll();
  }
}
