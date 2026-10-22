/**
 * GLSL for the four passes of one simulation step plus the display.
 *
 * Coordinate conventions:
 *  - Agent positions live in uv space [0,1)² of the trail map; the world is a torus.
 *  - Distances in uniforms (sensor distance, step) are in CSS pixels and get
 *    converted with `uPx` (= 1 / css size), so the pattern's on-screen scale
 *    doesn't change when the quality governor changes the trail resolution.
 *  - Trail channels: r, g, b = pheromone of species 0, 1, 2; a = "food" painted by the pointer.
 */

/** Fullscreen triangle generated from gl_VertexID; no vertex buffers needed. */
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** PCG-style integer hash: fast, decorrelated, and identical on every GPU. */
const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rand(inout uint s) { s = pcg(s); return float(s) * (1.0 / 4294967296.0); }
`;

/** Writes a fresh agent population in the requested seed shape. */
export const SEED_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform int uShape;          // 0 ring, 1 disc, 2 scatter, 3 spiral
uniform uint uSeed;
uniform vec2 uCss;           // css size of the view, so circles come out round
out vec4 o;
const float TAU = 6.28318530718;
${HASH}
void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  uint s = pcg(uint(id.x) + pcg(uint(id.y) + pcg(uSeed)));
  float r1 = rand(s), r2 = rand(s), r3 = rand(s), r4 = rand(s);
  float unit = min(uCss.x, uCss.y);
  vec2 off;        // offset from centre in css px
  float heading;
  float tag;       // species tag in [0,1): species = floor(tag * count)
  if (uShape == 0) {
    // Ring of agents all facing inward: they collide in the middle and bloom outward.
    float th = r1 * TAU;
    float g = sqrt(-2.0 * log(max(r2, 1e-6))) * cos(TAU * r3); // gaussian
    float rad = unit * 0.34 + g * unit * 0.012;
    off = vec2(cos(th), sin(th)) * rad;
    heading = th + 3.14159265 + (r4 - 0.5) * 0.5;
    tag = fract(th / TAU + 0.083);
  } else if (uShape == 1) {
    // Filled disc facing outward: an expanding shock front that tears into veins.
    float th = r1 * TAU;
    float rad = unit * 0.2 * sqrt(r2);
    off = vec2(cos(th), sin(th)) * rad;
    heading = th + (r4 - 0.5) * 0.3;
    tag = fract(r2 * 0.999 + r3 * 0.001);
  } else if (uShape == 2) {
    off = (vec2(r1, r2) - 0.5) * uCss;
    heading = r3 * TAU;
    tag = r4;
  } else {
    // Three logarithmic spiral arms, agents travelling along the arm.
    float arm = floor(r4 * 3.0);
    float t = r1;
    float rad = unit * (0.04 + 0.4 * t);
    float th = arm * TAU / 3.0 + log(1.0 + 6.0 * t) * 2.1 + (r2 - 0.5) * 0.35;
    off = vec2(cos(th), sin(th)) * rad;
    heading = th + 1.5708 + (r3 - 0.5) * 0.6;
    tag = fract(r4);
  }
  vec2 uv = fract(0.5 + off / uCss);
  o = vec4(uv, heading, tag);
}`;

/**
 * Copies the active agents and, for rows that are being switched on by the
 * quality governor, clones a random already-active agent so new agents join
 * the existing network instead of popping in at their stale seed positions.
 */
export const GROW_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uAgents;
uniform int uOldRows;
uniform uint uSeed;
out vec4 o;
${HASH}
void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  if (id.y < uOldRows) { o = texelFetch(uAgents, id, 0); return; }
  uint s = pcg(uint(id.x) * 9781u + pcg(uint(id.y) + uSeed));
  ivec2 src = ivec2(int(rand(s) * 1024.0) & 1023, int(rand(s) * float(uOldRows)));
  vec4 a = texelFetch(uAgents, src, 0);
  a.z = rand(s) * 6.28318530718;
  a.w = rand(s);
  o = a;
}`;

/** The Jones (2010) agent: sense three points ahead, rotate, move. */
export const AGENT_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uAgents;
uniform highp sampler2D uTrail;
uniform vec2 uPx;             // 1 / css size: css px -> uv
uniform float uSA;            // sensor angle (rad)
uniform float uSD;            // sensor distance (css px)
uniform float uRA;            // rotation per step (rad)
uniform float uStep;          // step length (css px)
uniform float uRepulsion;     // weight of other species' trails (negative = repel)
uniform float uCount;         // species count 1..3
uniform vec3 uScale;          // per-species multiplier on sensor distance / step
uniform float uSat;           // half-saturation concentration of the sensors
uniform uint uFrame;
uniform vec4 uPointer;        // xy uv, z pull strength (+attract, -repel), w radius (css px)
out vec4 o;
${HASH}

vec4 weights;

// Agents perceive concentration through a saturating response c / (c + K).
// Without it (and without Jones' one-agent-per-cell exclusion rule, which a
// GPU can't do cheaply) every vein keeps sucking in its neighbours until the
// network collapses into a few fat worms. Saturation keeps veins thin.
float sense(vec2 p, float a, float d) {
  vec2 q = p + vec2(cos(a), sin(a)) * d * uPx;
  vec4 t = textureLod(uTrail, q, 0.0);
  t.rgb = t.rgb / (t.rgb + uSat);
  t.a = t.a / (abs(t.a) + uSat * 2.0);
  return dot(t, weights);
}

void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 ag = texelFetch(uAgents, id, 0);
  vec2 p = ag.xy;
  float h = ag.z;
  uint s = pcg(uint(id.x) + pcg(uint(id.y) * 1031u + uFrame * 7919u));

  int sp = int(min(floor(ag.w * uCount), uCount - 1.0));
  // Own trail attracts (+1), the others are weighted by -repulsion; food (alpha) attracts everyone.
  vec3 own = vec3(sp == 0, sp == 1, sp == 2);
  weights = vec4(mix(vec3(-uRepulsion), vec3(1.0), own), 2.0);
  float k = sp == 0 ? uScale.x : (sp == 1 ? uScale.y : uScale.z);
  float sd = uSD * k;

  float F = sense(p, h, sd);
  float FL = sense(p, h + uSA, sd);
  float FR = sense(p, h - uSA, sd);

  float r = rand(s);
  if (F > FL && F > FR) {
    // keep going straight
  } else if (F < FL && F < FR) {
    h += (r < 0.5 ? -uRA : uRA);
  } else if (FL > FR) {
    h += uRA * (0.75 + 0.5 * r);
  } else if (FR > FL) {
    h -= uRA * (0.75 + 0.5 * r);
  }
  // A whisper of noise keeps highways from freezing into perfect straight lines.
  h += (rand(s) - 0.5) * 0.06;

  // Pointer: steer toward (or away from) the finger, with a tangential swirl.
  if (uPointer.z != 0.0) {
    vec2 d = (uPointer.xy - p);
    d -= round(d);                         // shortest way round the torus
    vec2 dpx = d / uPx;
    float dist = length(dpx);
    if (dist < uPointer.w && dist > 0.5) {
      float fall = 1.0 - dist / uPointer.w;
      float want = atan(dpx.y, dpx.x) + (uPointer.z > 0.0 ? 0.0 : 3.14159265) + 0.55 * fall;
      float delta = atan(sin(want - h), cos(want - h));
      h += delta * min(abs(uPointer.z), 1.0) * fall * 0.35;
    }
  }

  p += vec2(cos(h), sin(h)) * uStep * k * uPx;
  p = fract(p);
  o = vec4(p, mod(h, 6.28318530718), ag.w);
}`;

/** Each agent becomes one additive point in its species' channel. */
export const DEPOSIT_VS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uAgents;
uniform float uCount;
uniform float uDeposit;
out vec4 vAmount;
void main() {
  ivec2 id = ivec2(gl_VertexID & 1023, gl_VertexID >> 10);
  vec4 ag = texelFetch(uAgents, id, 0);
  int sp = int(min(floor(ag.w * uCount), uCount - 1.0));
  vAmount = vec4(sp == 0, sp == 1, sp == 2, 0.0) * uDeposit;
  gl_Position = vec4(ag.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

export const DEPOSIT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vAmount;
out vec4 o;
void main() { o = vAmount; }`;

/** 3×3 box blur blended by `uDiffuse`, then exponential decay. Wraps like the agents do. */
export const DIFFUSE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uTrail;
uniform float uDiffuse;
uniform float uDecay;
uniform float uFoodDecay;
out vec4 o;
void main() {
  ivec2 size = textureSize(uTrail, 0);
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 sum = vec4(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      sum += texelFetch(uTrail, (c + ivec2(x, y) + size) % size, 0);
    }
  }
  vec4 self = texelFetch(uTrail, c, 0);
  vec4 v = mix(self, sum / 9.0, uDiffuse);
  v.rgb *= uDecay;
  v.a *= uFoodDecay;
  // Clamp keeps half floats finite even if someone cranks deposit with no decay.
  o = clamp(v, vec4(0.0, 0.0, 0.0, -400.0), vec4(2000.0));
}`;

/** Resamples the trail into a new resolution after a resize / quality change. */
export const COPY_FS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uTrail;
in vec2 vUv;
out vec4 o;
void main() { o = textureLod(uTrail, vUv, 0.0); }`;

/** A soft gaussian dab of food (or repellent) where the pointer is. */
export const SPLAT_VS = /* glsl */ `#version 300 es
uniform vec2 uCenter;   // uv
uniform vec2 uRadius;   // uv
out vec2 vLocal;
void main() {
  int i = gl_VertexID;
  vec2 corner = vec2((i == 1 || i == 2 || i == 4) ? 1.0 : -1.0, (i == 2 || i == 4 || i == 5) ? 1.0 : -1.0);
  vLocal = corner;
  vec2 uv = uCenter + corner * uRadius;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SPLAT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform float uAmount;
in vec2 vLocal;
out vec4 o;
void main() {
  float d2 = dot(vLocal, vLocal);
  o = vec4(0.0, 0.0, 0.0, uAmount * exp(-d2 * 4.0) * step(d2, 1.0));
}`;

/**
 * Colour mapping. Each species saturates with 1 - exp(-k·c), is tinted by its
 * palette colour and gets a white-hot core; a mip-mapped copy of the same
 * texture gives a cheap bloom. Then a filmic curve, gamma, and dither.
 */
export const DISPLAY_FS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D uTrail;
uniform vec3 uC0, uC1, uC2;    // species colours (linear)
uniform vec3 uBg;              // background (linear)
uniform vec3 uFood;            // food tint (linear)
uniform float uExposure;
uniform float uGlow;
uniform vec2 uView;            // canvas px
uniform float uFade;           // 0..1 fade-in at start
in vec2 vUv;
out vec4 o;

vec3 shade(vec4 t) {
  vec3 s = 1.0 - exp(-max(t.rgb, 0.0) * uExposure);
  vec3 col = uC0 * s.r + uC1 * s.g + uC2 * s.b;
  float hot = s.r * s.r * s.r + s.g * s.g * s.g + s.b * s.b * s.b;
  return col + vec3(hot * 0.18);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Cubic B-spline filtering from four bilinear taps, so the upsampled mip
// levels (our bloom) come out round and smooth instead of blocky.
vec4 cubicLod(vec2 uv, int lod) {
  vec2 size = vec2(textureSize(uTrail, lod));
  vec2 px = uv * size - 0.5;
  vec2 f = fract(px);
  vec2 i = floor(px);
  vec2 w0 = (1.0 / 6.0) * (f * (f * (-f + 3.0) - 3.0) + 1.0);
  vec2 w1 = (1.0 / 6.0) * (f * f * (3.0 * f - 6.0) + 4.0);
  vec2 w2 = (1.0 / 6.0) * (f * (f * (-3.0 * f + 3.0) + 3.0) + 1.0);
  vec2 w3 = (1.0 / 6.0) * (f * f * f);
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 p0 = (i - 0.5 + w1 / g0) / size;
  vec2 p1 = (i + 1.5 + w3 / g1) / size;
  float l = float(lod);
  return g0.y * (g0.x * textureLod(uTrail, p0, l) + g1.x * textureLod(uTrail, vec2(p1.x, p0.y), l)) +
         g1.y * (g0.x * textureLod(uTrail, vec2(p0.x, p1.y), l) + g1.x * textureLod(uTrail, p1, l));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 t = textureLod(uTrail, vUv, 0.0);
  vec4 g1 = cubicLod(vUv, 2);
  vec4 g2 = cubicLod(vUv, 4);
  vec2 q = vUv - 0.5;
  q.x *= uView.x / uView.y;
  float vig = 1.0 - smoothstep(0.35, 1.1, length(q));

  vec3 col = uBg * (0.55 + 0.45 * vig);
  col += shade(t);
  col += (shade(g1) * 0.22 + shade(g2 * 1.5) * 0.2) * uGlow;
  float food = t.a;
  col += uFood * (1.0 - exp(-max(food, 0.0) * 0.03)) * 0.5;
  col *= 1.0 - (1.0 - exp(min(food, 0.0) * 0.03)) * 0.6;
  col *= mix(0.75, 1.0, vig);
  col = aces(col * 1.1) * uFade;
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
