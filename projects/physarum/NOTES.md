# Physarum

- **Pitch:** Up to a million slime-mould agents on your GPU sniff, turn and braid living transport networks, in rival colours, with no interaction needed.
- **Feeling:** Looking down a microscope at something alive: it builds membranes, veins and highways, and nobody planned any of it.
- **Core:** Jeff Jones' 2010 agent model (sense three points ahead, rotate, move, deposit; the trail map diffuses and decays), run entirely in WebGL2 fragment shaders, with 1–3 species that follow their own pheromone and avoid the others'.
- **Look:** Near-black petri-dish background, saturated bioluminescent species colours with white-hot cores and a soft mip-map bloom. Fraunces italic for the specimen label, IBM Plex Mono for readouts, Space Grotesk for the explainer.
- **Done means:** Striking within 3 s of load, ≥ 55 fps (the population scales itself), seven distinct curated presets, drag to feed or repel, lil-gui for every parameter, an in-page "how it works" with the maths and references, readable on a 390 px phone, and zero console noise.

## Why it looks and works this way

The opening preset, **Bloom**, seeds an outward-facing disc of three species. In its first couple of seconds the disc tears into a shock front of radial filaments, then settles into something that looks like a cell: a violet membrane around a gold nucleus with a crimson network outside. That gives you a "whoa" before you've touched anything. Every other preset was picked from a parameter sweep because it looks clearly different from the rest:

| Preset | Seed | What makes it different |
|---|---|---|
| Bloom | disc | 3 species, `variety` 0.5, so each species senses at a different scale and they sort into concentric layers |
| Veins | ring | Jones' classic SA = RA = 45°, a single species coarsening into polygonal cells |
| Coral | scatter | wide 80° sensors with a 6 px reach and strong rivalry, giving a tight three-colour labyrinth |
| Currents | spiral | narrow sensors that reach 30 px with gentle turns, giving braided rivers |
| Mitosis | scatter | turn speed twice the sensor angle, so agents orbit and blobs pinch off |
| Neurons | spiral | 40 px sensing with sharp turns pulls trails into star-shaped hubs |
| Silk | scatter | agents barely turn and move fast, spinning long filaments |

If nobody touches it for about 40 s, it morphs into the next preset **without reseeding**: the parameters ease over 5 s and the existing network reorganises itself in place, which is the most "alive" thing it does. With `prefers-reduced-motion` the auto-cycle is off and the clock runs at 40 %.

All distances (sensor distance, step) are in **CSS pixels**, not trail texels, so a pattern keeps the same on-screen size when the quality governor changes the trail resolution or the device has a different DPR.

## The hardest problem

**Getting veins instead of worms.** The first GPU version collapsed every species into a few fat, glowing worms. Two things caused it:

1. *Jones' model relies on exclusion.* In the paper an agent only moves and deposits if the target cell is empty. A GPU can't do that cheaply, so without it nothing limits how tightly agents can bundle. My first fix was a saturating sensor response `c/(c+K)`. It changed nothing, and that taught me something: the steering rule only compares F, FL and FR, so any monotonic transform of the trail leaves every decision the same. The real fix was in the parameters. Moderate density (about 0.5 agents per trail texel), little diffusion (0.2–0.5 instead of a full 3×3 mean each step) and decay around 0.85 keep the veins thin. I kept the saturation because it still matters where two terms are mixed, namely rival repulsion and the pointer's food channel, which must not swamp a vein.
2. *Exposure.* With a million additive deposits, a "normal" exposure turns every vein into a white neon tube. Deposits are normalised by agent density (`0.5 / (agents / texels)`) so brightness and dynamics don't change when the governor changes the population. The tone map is per-species `1 − exp(−k·c)` with a cubic white-hot term, followed by ACES and gamma.

**The thumbnail on a software GPU.** CI renders with SwiftShader at about 0.1–0.3 s per step. `?thumb` hides the chrome, uses the smallest population and fast-forwards about 110 steps with a doubled step length before the first frame. It's the same simulation on a coarser clock.

## The maths

Each agent has a position **x** and heading φ. Every step:

- Sense: `F = T(x + d·û(φ))`, `FL = T(x + d·û(φ+θ))`, `FR = T(x + d·û(φ−θ))`, where *T* is the agent's own channel minus `repulsion ×` the other species' channels, plus food.
- Rotate: if F is the largest, go straight. If F is the smallest, turn ±RA at random. Otherwise turn RA toward the larger side, with ±25 % jitter and a little heading noise so highways don't freeze.
- Move: `x ← fract(x + s·û(φ))`. The world is a torus.
- Deposit: +1 (scaled) into the species' channel.
- Trail: `T ← λ · ((1 − k)·T + k·box₃ₓ₃(T))`, with λ = decay and k = diffusion.

Positive feedback (trails attract agents, agents reinforce trails) plus forgetting (decay) prunes random motion into minimal transport networks. The SA/RA ratio picks the regime: RA ≈ SA gives networks, RA ≫ SA gives blobs, RA ≪ SA gives long filaments.

## Techniques worth stealing

- **Agents as texels.** State lives in a 1024-wide RGBA32F texture (x, y, heading, species tag). One fullscreen fragment pass updates everyone, and ping-pong framebuffers avoid read/write hazards. The species is `floor(tag × count)`, so changing the species count live remaps agents evenly with no reseed.
- **Scatter by vertex pulling.** Deposit is `drawArrays(POINTS, 0, N)` with no vertex buffers. The vertex shader `texelFetch`es its agent by `gl_VertexID` and the point lands with additive blending into an RGBA16F trail map (16-bit float blending only needs `EXT_color_buffer_float`).
- **Free bloom from mipmaps.** `generateMipmap` on the trail map gives a blur pyramid. Sampling levels 2 and 4 with a 4-tap cubic B-spline filter (`cubicLod`) removes the blocky look of plain bilinear mip magnification.
- **Immutable storage + sampler objects.** `texStorage2D` with all levels allocated means the texture is always mip-complete (no "texture not renderable" warnings). Separate sampler objects let the same texture be read with LINEAR+REPEAT (sensing across the torus seam) and with trilinear (bloom).
- **Growing a population without pops.** When the QualityGovernor raises the agent count, a pass copies the active rows and fills the new rows with clones of random active agents, so new agents join the existing network instead of appearing at stale seed positions.
- **Fixed 60 Hz sim clock**, at most 3 steps per frame, so 120 Hz displays don't run the mould at double speed.
- **No read-backs ever.** Nothing calls `readPixels`, and every texture unit is unbound after each pass so no framebuffer can form a feedback loop.

## Interaction

Drag to lay food (alpha channel of the trail map, sensed by every species, decays slower than pheromone). Agents within reach also steer toward the pointer with a slight swirl. Right-drag, shift-drag or the "repellent" brush lays negative food instead. A quick tap drops one rich blob. Keys: `N`/`←`/`→` presets, `R` randomize, `S` reseed, `G` parameters, `Space` pause, `H` hide UI, `?` about. URL params: `?preset=coral`, `?seed=spiral`, `?set=sensorAngle:30,decay:0.9` (shareable experiments), `?quality=0..6` to pin the population.

## Known limitations

- Devices without `EXT_color_buffer_float` get a friendly explanation instead of a half-float fallback. Half floats don't have enough mantissa to store sub-pixel agent positions.
- No exclusion rule (see above), so very high densities still thicken veins.

## Credits

- Jeff Jones (2010), "Characteristics of pattern formation and evolution in approximations of *Physarum* transport networks", *Artificial Life* 16(2). The agent model.
- Tero et al. (2010), "Rules for biologically inspired adaptive network design", *Science* 327. The Tokyo rail experiment mentioned in the explainer.
- Visual inspiration from Sage Jenson's multi-species Physarum artworks. All code, presets and palettes here are original.
- Fonts: Fraunces, Space Grotesk, IBM Plex Mono (SIL OFL, self-hosted via Fontsource). UI: lil-gui (MIT).
