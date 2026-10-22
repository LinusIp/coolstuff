# Flipline

- **Pitch:** a one-thumb runner where the only move is flipping gravity, racing through an endless synthwave sunset.
- **Feeling:** flow. Ten seconds in you're tapping on the beat without thinking; two minutes in your thumb is sweating.
- **Core:** you run automatically along a neon corridor. Tap and you fall to the other side. Gaps and spikes make one side deadly, so you flip at the right moment.
- **Look:** 80s synthwave: a striped sun, a scrolling perspective grid, chrome-gradient italic type (Chakra Petch), and a new palette every 500 m.
- **Done means:** title → play → wipeout → retry loop; touch and keyboard; live-synthesized music and effects; particles, shake, slow-mo; saved high score; installable PWA that plays offline; and a track generator proven fair by tests.

## Why it looks and works this way

The whole game is one verb. One-button games live or die on two things: whether the input feels instant and whether every death feels like your fault. Most of the engineering went into those two.

**Instant input.** The simulation runs at a fixed 120 Hz step, decoupled from the display. A flip feels the same on a 60 Hz phone and a 144 Hz monitor. A flip isn't a slow float either. It's a kick (300 u/s toward the other side) plus strong gravity (3600 u/s²), so the crossing takes about 0.32 s and lands with a satisfying squash. Two forgiveness mechanics hide the rough edges:

- **Coyote time (80 ms):** you can still flip just after running off an edge.
- **Input buffering (120 ms):** a tap that arrives slightly before you land is remembered and fires on touchdown.

**Fair deaths.** Hitboxes are smaller than the drawings: spikes kill 8 units below their tips and 5 units in from their edges. You only die when it *looks* like you should have.

**Readable at speed.** Gaps get little neon end caps so they register in peripheral vision. Spikes are a different colour from the track in every palette. A translucent band behind the corridor keeps it legible over the busy sun and grid. On phones the camera fits the corridor to the *width* (at least 700 world units visible), not the height, so you always see more than half a second of track ahead, even at top speed.

**Juice, in moderation.** Landing squash and stretch, flip spin, an afterimage trail, additive particle bursts, a screen shake and white flash on death, and a quarter-speed slow-mo for the first half second of a crash so you can see what got you. All of it switches off under `prefers-reduced-motion`.

## The hardest problem: a procedural track that's always fair

Random levels are easy. Random levels that never contain an impossible section are not. The corridor is a sequence of blocks, each saying what the floor and the ceiling are doing (solid, gap or spikes). The generator thinks in terms of **flip windows**: the range of x positions where tapping survives.

When the track forces you from the floor to the ceiling at position X:

- Flip too late and you're still on the floor when it turns deadly, so the window closes at `X − margin`.
- Flip too early and you reach the ceiling while it's still deadly. A flip covers `d = speed × FLIP_TIME` horizontally, so the window opens at about `X − d + margin`.
- The margins account for the player's half-width and for the time it takes to clear a spike row's hitbox.

The generator also tracks the *latest* landing a player could have made (someone who flipped at the very end of the previous window). If that player would still be in the air when the next section starts, it inserts open corridor first. Every forced switch also gets a minimum stretch of open corridor before it, shrinking with difficulty.

Difficulty then comes only from things that are fair: speed (340 → 640 u/s, easing out), shorter breathers, more zigzags in a row, and the minimum overlap shrinking from 0.6 to 0.2 flips.

**It's tested, not hoped for.** `src/game.test.ts` runs the real simulation with an autopilot across 8 seeds for 6000 m (well past maximum difficulty). The autopilot flips at the *earliest possible* instant of every window, then at the *latest*, then in the middle. All three must survive. The first version of the generator failed this test: windows ignored the player's width, so edge-of-window flips clipped spike corners. A human would have called those deaths "cheap" without knowing why. The same autopilot plays the attract mode behind the title screen.

## Sound: a synthwave band in ~400 lines of Web Audio

Nothing is downloaded. `src/audio.ts` is a tiny sequencer: a look-ahead scheduler (a 25 ms timer queueing notes 120 ms ahead on the audio clock, the classic "tale of two clocks" pattern) plays a 112 BPM loop over Am–F–C–G:

- detuned-saw pads with a slow filter swell
- a square-wave arpeggio through a dotted-eighth feedback delay
- a saw bass with a resonant filter envelope, doubled an octave up so it survives phone speakers
- a synthesized drum kit: a sine kick with a pitch drop, a band-passed noise snare, high-passed noise hats

Layers fade in as the run heats up. The title screen has only pads and arpeggio, a run adds bass and drums, and later zones add a vibrato saw lead. Each zone transposes the key. Orb pickups climb a pentatonic scale as your combo grows, so a long combo plays a melody. On death the whole music bus slides through a low-pass filter, which is the "underwater" muffle. Everything goes through a compressor so it never clips.

## Techniques worth stealing

- **Fixed-timestep simulation with an accumulator**, rendering decoupled. Deterministic, testable, frame-rate independent.
- **Cheap neon glow:** stroke each path twice, wide and faint with `globalCompositeOperation = 'lighter'`, then thin and bright on top. It's far cheaper than `shadowBlur`. Soft halos are radial gradients drawn additively.
- **Cached art with cut-outs:** the striped sun is drawn once to an offscreen canvas, with the stripes erased via `destination-out`, and redrawn only when the palette changes.
- **Palette crossfades:** every zone palette is plain RGB triples, mixed with a smoothstep over 1.4 s.
- **Quality governor:** `src/shared/fps.ts` watches frame time and steps down the canvas resolution and glow passes if the device can't hold 55+ fps.
- **Offline on first visit:** the service worker caches the app shell. The page then sends it the list of every asset it has already loaded (`performance.getEntriesByType('resource')`), so the game works offline without a second visit.
- **Seeded RNG (mulberry32)** makes tracks reproducible, which is what makes the fairness tests possible.

## Controls

- Tap anywhere, or Space / ↑ / ↓ / W / S: flip
- P or Esc: pause (also pauses automatically when you leave the tab)
- M: mute
- `?autoplay` in the URL lets the autopilot play real runs, for demos and testing.

## Credits

- Font: [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) by Cadson Demak (SIL Open Font License), self-hosted via Fontsource.
- All music, sound, art and code are original and generated at runtime. No samples, no images except the app icon, which is a hand-written SVG.
- Inspirations: the gravity flip of *VVVVVV* and the one-button purity of *Canabalt*. No assets or designs were copied.
