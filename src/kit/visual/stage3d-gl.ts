/**
 * A tiny WebGL renderer for Stage3D's surfaces (no three.js). Canvas-2D
 * path fills cost ~0.1 ms per quad on software-rendered browsers (a 60×60
 * surface took ~370 ms a frame in headless Chromium), while one indexed
 * triangle draw with a depth buffer costs a few ms even there and < 1 ms on
 * a GPU. Geometry is uploaded once per mesh; a frame only sets the camera
 * uniforms, which reproduce `projectOrbit` exactly so the canvas overlays
 * line up. Browser-only (called from effects); returns null without WebGL.
 */
import type { Projector } from './scene3d';

export interface GLMesh {
  /** Normalized-space positions, xyz. */
  pos: Float32Array;
  /** Unit normals, xyz (two-sided Lambert). */
  nrm: Float32Array;
  /** Colours, rgba 0…1. */
  col: Float32Array;
  idx: Uint16Array | Uint32Array;
  /** Line segments drawn with the depth test (wireframe, contours): xyz pairs + rgba per vertex. */
  lines?: { pos: Float32Array; col: Float32Array };
}

export interface GLRenderer {
  draw(meshes: readonly GLMesh[], P: Projector, dpr: number): void;
  dispose(): void;
}

const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aCol;
uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uBack; uniform vec3 uLight;
uniform float uDist; uniform float uKx; uniform float uKy; uniform float uZs; uniform float uLit;
varying vec4 vCol;
void main() {
  float x = dot(aPos, uRight);
  float y = dot(aPos, uUp);
  float d = dot(aPos, uBack);
  float w = uDist > 0.0 ? max((uDist - d) / uDist, 0.05) : 1.0;
  gl_Position = vec4(x * uKx, y * uKy, -d * uZs * w, w);
  float s = uLit > 0.5 ? 0.5 + 0.5 * abs(dot(normalize(aNrm), uLight)) : 1.0;
  vCol = vec4(aCol.rgb * s, aCol.a);
}`;

const FS = `
precision mediump float;
varying vec4 vCol;
void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

interface Uploaded {
  pos: WebGLBuffer;
  nrm: WebGLBuffer;
  col: WebGLBuffer;
  idx: WebGLBuffer;
  count: number;
  type: number;
  lpos?: WebGLBuffer;
  lcol?: WebGLBuffer;
  lcount: number;
  dummyNrm?: WebGLBuffer;
}

export function createGLRenderer(canvas: HTMLCanvasElement): GLRenderer | null {
  const opts: WebGLContextAttributes = { antialias: false, alpha: true, premultipliedAlpha: true, depth: true, preserveDrawingBuffer: false };
  const gl = (canvas.getContext('webgl2', opts) ?? canvas.getContext('webgl', opts)) as WebGLRenderingContext | null;
  if (!gl) return null;
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const uint = isGL2 || !!gl.getExtension('OES_element_index_uint');
  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    nrm: gl.getAttribLocation(prog, 'aNrm'),
    col: gl.getAttribLocation(prog, 'aCol'),
    right: gl.getUniformLocation(prog, 'uRight'),
    up: gl.getUniformLocation(prog, 'uUp'),
    back: gl.getUniformLocation(prog, 'uBack'),
    light: gl.getUniformLocation(prog, 'uLight'),
    dist: gl.getUniformLocation(prog, 'uDist'),
    kx: gl.getUniformLocation(prog, 'uKx'),
    ky: gl.getUniformLocation(prog, 'uKy'),
    zs: gl.getUniformLocation(prog, 'uZs'),
    lit: gl.getUniformLocation(prog, 'uLit'),
  };
  const cache = new WeakMap<GLMesh, Uploaded>();
  const all = new Set<Uploaded>();
  const buf = (data: ArrayBufferView, target: number = gl.ARRAY_BUFFER): WebGLBuffer => {
    const b = gl.createBuffer()!;
    gl.bindBuffer(target, b);
    gl.bufferData(target, data as unknown as ArrayBuffer, gl.STATIC_DRAW);
    return b;
  };
  const upload = (m: GLMesh): Uploaded | null => {
    let u = cache.get(m);
    if (u) return u;
    if (m.idx instanceof Uint32Array && !uint) return null;
    u = {
      pos: buf(m.pos),
      nrm: buf(m.nrm),
      col: buf(m.col),
      idx: buf(m.idx, gl.ELEMENT_ARRAY_BUFFER),
      count: m.idx.length,
      type: m.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      lcount: 0,
    };
    if (m.lines && m.lines.pos.length) {
      u.lpos = buf(m.lines.pos);
      u.lcol = buf(m.lines.col);
      u.lcount = m.lines.pos.length / 3;
      u.dummyNrm = buf(new Float32Array(m.lines.pos.length));
    }
    cache.set(m, u);
    all.add(u);
    return u;
  };
  const attr = (l: number, b: WebGLBuffer, size: number) => {
    if (l < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  };
  return {
    draw(meshes, P, dpr) {
      const W = Math.max(1, Math.round(P.W * dpr));
      const H = Math.max(1, Math.round(P.H * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied
      const { right, up, back } = P.basis;
      gl.uniform3f(loc.right, right[0], right[1], right[2]);
      gl.uniform3f(loc.up, up[0], up[1], up[2]);
      gl.uniform3f(loc.back, back[0], back[1], back[2]);
      gl.uniform3f(loc.light, P.light[0], P.light[1], P.light[2]);
      gl.uniform1f(loc.dist, Number.isFinite(P.dist) ? P.dist : 0);
      gl.uniform1f(loc.kx, P.k / (P.W / 2));
      gl.uniform1f(loc.ky, P.k / (P.H / 2));
      gl.uniform1f(loc.zs, 1 / (1.6 * P.norm.radius));
      for (const m of meshes) {
        const u = upload(m);
        if (!u) continue;
        // Faces sit a hair behind their own wire/contour lines.
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        gl.uniform1f(loc.lit, 1);
        attr(loc.pos, u.pos, 3);
        attr(loc.nrm, u.nrm, 3);
        attr(loc.col, u.col, 4);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, u.idx);
        gl.drawElements(gl.TRIANGLES, u.count, u.type, 0);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        if (u.lpos && u.lcol && u.dummyNrm) {
          gl.uniform1f(loc.lit, 0);
          attr(loc.pos, u.lpos, 3);
          attr(loc.nrm, u.dummyNrm, 3);
          attr(loc.col, u.lcol, 4);
          gl.drawArrays(gl.LINES, 0, u.lcount);
        }
      }
    },
    dispose() {
      for (const u of all) for (const b of [u.pos, u.nrm, u.col, u.idx, u.lpos, u.lcol, u.dummyNrm]) if (b) gl.deleteBuffer(b);
      all.clear();
      gl.deleteProgram(prog);
    },
  };
}
