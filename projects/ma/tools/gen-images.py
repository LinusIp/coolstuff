#!/usr/bin/env python3
"""
Procedural sumi-e (ink-wash) illustrations for the Ma journal.

Every picture in the theme is painted here from noise and arithmetic, so the
project ships no third-party imagery. Each image is rendered once at 1600px
wide on a warm "kozo paper" ground, then downsampled to 480 / 960 / 1600 WebP
files in ../public/img/, and a manifest (src/images.json) records the sizes so
the TypeScript can write correct srcset / width / height attributes.

    python3 projects/ma/tools/gen-images.py          # all images
    python3 projects/ma/tools/gen-images.py enso     # just one

Deterministic: every painting has a fixed seed, so re-running produces the
same bytes and the repo diff stays quiet.

Compositing model: watercolour and ink are transparent, so every layer is
applied with a *multiply* blend: out = under * (1 - a * (1 - colour)). That
is what makes overlapping washes darken naturally instead of covering.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'public', 'img')
MANIFEST = os.path.join(HERE, '..', 'src', 'images.json')
WIDTHS = (480, 960, 1600)

PAPER = np.array([241, 235, 223], dtype=np.float32)
INK = np.array([27, 27, 33], dtype=np.float32)
SHU = np.array([196, 62, 40], dtype=np.float32)  # vermilion seal red

Arr = np.ndarray


# ── noise ────────────────────────────────────────────────────────────────────

def vnoise(rng: np.random.Generator, h: int, w: int, cell: float) -> Arr:
    """Smooth value noise in [0, 1]: a coarse random grid upsampled bicubically."""
    cell = max(1.0, cell)
    gh, gw = int(h / cell) + 3, int(w / cell) + 3
    grid = rng.random((gh, gw)).astype(np.float32)
    big = Image.fromarray(grid, 'F').resize((int(gw * cell), int(gh * cell)), Image.BICUBIC)
    return np.clip(np.asarray(big)[:h, :w], 0, 1)


def fbm(rng: np.random.Generator, h: int, w: int, cell: float, octaves: int = 5, gain: float = 0.5) -> Arr:
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for _ in range(octaves):
        total += amp * vnoise(rng, h, w, cell)
        norm += amp
        amp *= gain
        cell /= 2
    return total / norm


def fbm1d(rng: np.random.Generator, n: int, cell: float, octaves: int = 6, gain: float = 0.5) -> Arr:
    return fbm(rng, 2, n, cell, octaves, gain)[0]


def smoothstep(e0: float, e1: float, x: Arr) -> Arr:
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _box(a: Arr, r: int, axis: int) -> Arr:
    """Running-mean box blur along one axis via a cumulative sum (edge-padded)."""
    pad = [(0, 0), (0, 0)]
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(a: Arr, r: float) -> Arr:
    """Gaussian blur approximated by three box passes (PIL can't blur float images)."""
    if r <= 0:
        return a.astype(np.float32)
    # Box width for 3 passes that matches a gaussian of std-dev r.
    box = max(1, int(round(math.sqrt(12 * r * r / 3 + 1) - 1) // 2))
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box(_box(out, box, 0), box, 1)
    return out


# ── canvas helpers ───────────────────────────────────────────────────────────

def paper(rng: np.random.Generator, h: int, w: int, tint: Arr = PAPER) -> Arr:
    """Warm handmade paper: large soft mottling plus a few faint fibres."""
    img = np.empty((h, w, 3), np.float32)
    img[:] = tint
    mottle = (fbm(rng, h, w, 260, 4) - 0.5) * 9
    img += mottle[..., None]
    # Fibres: short faint curved strokes, slightly lighter than the sheet.
    fib = Image.new('F', (w, h), 0)
    d = ImageDraw.Draw(fib)
    for _ in range(int(w * h / 9000)):
        x, y = rng.random() * w, rng.random() * h
        ang = rng.random() * math.pi
        ln = 8 + rng.random() * 30
        pts = [(x + math.cos(ang + k * 0.06) * ln * k / 6, y + math.sin(ang + k * 0.06) * ln * k / 6) for k in range(7)]
        d.line(pts, fill=float(rng.random() * 0.8 + 0.2), width=1)
    fib_a = blur(np.asarray(fib), 0.6)
    img += fib_a[..., None] * 5
    # Vignette: the sheet darkens a touch towards its edges, like a print under glass.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = ((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2) * 2
    img -= (v * 10)[..., None]
    return img


def multiply(img: Arr, alpha: Arr, colour: Arr) -> None:
    """Transparent pigment layer: multiply blend, in place."""
    a = np.clip(alpha, 0, 1)[..., None]
    img *= 1 - a * (1 - colour / 255.0)


def mask_from_draw(h: int, w: int, fn, supersample: int = 2) -> Arr:
    """Rasterise PIL drawing calls into a smooth [0,1] mask (supersampled for antialiasing)."""
    m = Image.new('L', (w * supersample, h * supersample), 0)
    fn(ImageDraw.Draw(m), supersample)
    return np.asarray(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255


def wet_edge(mask: Arr, rim: float = 4, strength: float = 0.5) -> Arr:
    """Watercolour pools at the boundary of a wash as it dries: darken the rim."""
    inner = blur(mask, rim)
    edge = np.clip(mask - inner, 0, 1) * 2
    return np.clip(mask * (1 - strength * 0.4) + edge * strength, 0, 1)


SEAL_RECTS = [
    # 間 drawn as carved strokes on a 100-unit square: 門 (gate) around 日 (sun).
    (18, 16, 24, 86), (18, 16, 44, 21), (18, 30, 44, 34), (18, 43, 44, 47), (40, 16, 44, 47),
    (56, 16, 82, 21), (56, 30, 82, 34), (56, 43, 82, 47), (56, 16, 60, 47), (76, 16, 82, 82),
    (68, 80, 82, 86),
    (38, 55, 42, 80), (58, 55, 62, 80), (38, 55, 62, 59), (38, 66, 62, 69), (38, 76, 62, 80),
]


def seal(img: Arr, rng: np.random.Generator, x: int, y: int, size: int) -> None:
    """A small vermilion hanko impression (間) with the uneven ink of a real stamp."""
    h, w = img.shape[:2]

    def draw(d: ImageDraw.ImageDraw, s: int) -> None:
        u = size * s / 100
        d.rounded_rectangle([x * s, y * s, x * s + size * s, y * s + size * s], radius=int(9 * u), fill=255)
        for (x0, y0, x1, y1) in SEAL_RECTS:
            d.rectangle([x * s + x0 * u, y * s + y0 * u, x * s + x1 * u, y * s + y1 * u], fill=0)

    m = mask_from_draw(h, w, draw, 3)
    speckle = vnoise(rng, h, w, 2.2)
    m *= np.clip(0.55 + speckle * 0.7, 0, 1)
    multiply(img, m * 0.9, SHU)


# ── paintings ────────────────────────────────────────────────────────────────

def mountains(rng: np.random.Generator, w: int, h: int) -> Arr:
    """Layered ridges receding into mist, with a vermilion sun in the empty sky."""
    img = paper(rng, h, w)
    yy = np.mgrid[0:h, 0:w][0].astype(np.float32)

    # Sun first, so the mountains are painted over it.
    cx, cy, r = w * 0.71, h * 0.25, h * 0.068
    xx = np.mgrid[0:h, 0:w][1].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    sun = smoothstep(r + 1.5, r - 1.5, d) * (0.82 + vnoise(rng, h, w, 6) * 0.18)
    multiply(img, sun, SHU)

    layers = [
        # base y, amplitude, ink strength, fade length, ridge cell, edge darkness
        (0.44, 0.17, 0.16, 0.20, 520, 0.10),
        (0.52, 0.15, 0.27, 0.16, 420, 0.18),
        (0.62, 0.14, 0.42, 0.14, 360, 0.28),
        (0.74, 0.12, 0.66, 0.12, 300, 0.40),
    ]
    for i, (base, amp, strength, fade, cell, edge_k) in enumerate(layers):
        ridge_n = fbm1d(rng, w, cell, 7, 0.52)
        # Sharpen peaks a little: mountains in ink painting rise steeply.
        ridge_n = (ridge_n - ridge_n.min()) / (np.ptp(ridge_n) + 1e-6)
        ridge = h * (base + amp * (0.5 - ridge_n ** 1.4))
        dist = yy - ridge[None, :]
        body = smoothstep(-1.2, 1.2, dist) * np.exp(-np.clip(dist, 0, None) / (h * fade))
        edge = smoothstep(-1.2, 1.2, dist) * np.exp(-np.clip(dist, 0, None) / (6 + i * 3))
        # Vertical texture strokes (cun): noise stretched tall and narrow.
        tex = fbm(rng, h, w, 28, 3)
        tall = np.asarray(Image.fromarray(vnoise(rng, h // 6 + 1, w, 5), 'F').resize((w, h), Image.BICUBIC))
        texture = 0.72 + 0.35 * (tex - 0.5) + 0.32 * (tall - 0.5)
        dens = (body * strength + edge * edge_k) * texture
        # Mist bands drifting across each layer's foot.
        mist = smoothstep(0.35, 0.75, fbm(rng, h, w, 340, 3)) * 0.65
        dens *= 1 - mist * smoothstep(h * 0.02, h * 0.12, dist)
        multiply(img, dens, INK)

    # Fade the bottom into blank paper: the painting dissolves rather than ends.
    floor = smoothstep(h * 0.80, h * 0.99, yy)
    img = img * (1 - floor[..., None]) + paper(rng, h, w) * floor[..., None]
    return img


def enso(rng: np.random.Generator, w: int, h: int) -> Arr:
    """A single-breath brush circle: wet at the start, breaking into dry-brush at the end."""
    img = paper(rng, h, w)
    cx, cy, R = w * 0.47, h * 0.5, h * 0.32
    bristles = 150
    offs = rng.uniform(-1, 1, bristles)
    load = rng.uniform(0.75, 1.25, bristles)  # how much ink each bristle carries
    dens = np.zeros((h, w), np.float32)
    a0 = math.radians(205)
    sweep = math.radians(338)
    steps = 5200
    for s in range(steps):
        t = s / steps
        ang = a0 + sweep * t
        # Width: pressed hard at the start, lifting off at the end.
        width = h * 0.075 * (0.55 + 0.6 * smoothstep(0, 0.06, np.float32(t)) - 0.5 * t ** 1.6)
        wobble = 1 + 0.025 * math.sin(t * 9.0) + 0.012 * math.sin(t * 23.0)
        rr = R * wobble + offs * width / 2
        px = (cx + np.cos(ang) * rr).astype(int)
        py = (cy + np.sin(ang) * rr).astype(int)
        ink_left = load - t * (0.55 + 0.9 * (np.abs(offs) ** 1.5))
        val = np.clip(ink_left, 0, 1) ** 0.6
        ok = (px >= 0) & (px < w) & (py >= 0) & (py < h) & (val > 0.02)
        np.add.at(dens, (py[ok], px[ok]), val[ok] * 0.22)
    dens = blur(np.clip(dens, 0, 1.6), 1.4)
    # A darker pool where the brush first touched the paper.
    xx, yy = np.mgrid[0:h, 0:w][1], np.mgrid[0:h, 0:w][0]
    sx, sy = cx + math.cos(a0) * R, cy + math.sin(a0) * R
    pool = np.exp(-(((xx - sx) ** 2 + (yy - sy) ** 2) / (2 * (h * 0.05) ** 2)))
    dens = np.clip(dens * (1 + 0.5 * pool), 0, 1) * (0.86 + 0.14 * vnoise(rng, h, w, 3))
    # A pale bleed halo where wet ink crept into the fibres.
    halo = blur(dens, 7) * 0.14
    multiply(img, np.clip(dens * 0.93 + halo, 0, 1), INK)
    seal(img, rng, int(w * 0.81), int(h * 0.72), int(h * 0.075))
    return img


def persimmon_shape(d: ImageDraw.ImageDraw, s: int, cx: float, cy: float, rx: float, ry: float) -> None:
    # Persimmons are squat and faintly square: a superellipse outline.
    pts = []
    for k in range(240):
        a = k / 240 * 2 * math.pi
        c, si = math.cos(a), math.sin(a)
        n = 2.5
        x = rx * math.copysign(abs(c) ** (2 / n), c)
        y = ry * math.copysign(abs(si) ** (2 / n), si)
        pts.append(((cx + x) * s, (cy + y) * s))
    d.polygon(pts, fill=255)


def paint_persimmon(img: Arr, rng: np.random.Generator, cx: float, cy: float, rx: float, ry: float,
                    colour=(232, 116, 38), shade=(176, 58, 30), dried: bool = False) -> None:
    h, w = img.shape[:2]
    m = mask_from_draw(h, w, lambda d, s: persimmon_shape(d, s, cx, cy, rx, ry))
    xx, yy = np.mgrid[0:h, 0:w][1].astype(np.float32), np.mgrid[0:h, 0:w][0].astype(np.float32)
    nx, ny = (xx - cx) / rx, (yy - cy) / ry
    # First wash: flat colour, lighter where the light catches the upper left.
    light = np.clip(1 - np.sqrt((nx + 0.38) ** 2 + (ny + 0.42) ** 2) * 0.9, 0, 1)
    gran = vnoise(rng, h, w, 4) * 0.5 + fbm(rng, h, w, 40, 3) * 0.5
    a1 = wet_edge(m, 3 + rx * 0.02, 0.55) * (0.9 - 0.55 * light ** 1.5) * (0.82 + 0.3 * gran)
    multiply(img, a1, np.array(colour, np.float32))
    # Second glaze: deeper red pooling towards the lower right.
    shade_a = np.clip((nx * 0.6 + ny * 0.8 + 0.2), 0, 1) ** 1.3 * m * (0.55 if not dried else 0.85)
    multiply(img, shade_a * (0.8 + 0.4 * gran), np.array(shade, np.float32))
    if dried:
        # Drying draws the skin into fine wrinkles: streaky dark noise.
        wr = np.asarray(Image.fromarray(vnoise(rng, h // 8 + 1, w, 3), 'F').resize((w, h), Image.BICUBIC))
        wrinkles = np.clip((wr - 0.5) * 2.2, 0, 1) * m * 0.3
        multiply(img, wrinkles, np.array([90, 40, 20], np.float32))


def calyx(img: Arr, rng: np.random.Generator, cx: float, cy: float, size: float, stem: float = 1.0) -> None:
    h, w = img.shape[:2]
    leaf_col = np.array([58, 64, 40], np.float32)

    def draw(d: ImageDraw.ImageDraw, s: int) -> None:
        for k in range(4):
            a = math.radians(45 + 90 * k + rng.uniform(-12, 12))
            L = size * rng.uniform(0.9, 1.15)
            # Each sepal: a pointed leaf polygon.
            tip = (cx + math.cos(a) * L, cy + math.sin(a) * L * 0.55)
            n = (-math.sin(a), math.cos(a))
            wd = size * 0.32
            mid = (cx + math.cos(a) * L * 0.45, cy + math.sin(a) * L * 0.45 * 0.55)
            poly = [(cx, cy), (mid[0] + n[0] * wd, mid[1] + n[1] * wd * 0.55), tip,
                    (mid[0] - n[0] * wd, mid[1] - n[1] * wd * 0.55)]
            d.polygon([(px * s, py * s) for px, py in poly], fill=255)
        if stem:
            d.line([(cx * s, cy * s), ((cx + size * 0.08) * s, (cy - size * 0.55 * stem) * s)],
                   fill=255, width=int(size * 0.14 * s))

    m = mask_from_draw(h, w, draw)
    multiply(img, wet_edge(m, 2, 0.6) * (0.75 + 0.3 * vnoise(rng, h, w, 3)), leaf_col)


def persimmon(rng: np.random.Generator, w: int, h: int) -> Arr:
    """One persimmon, alone on the sheet, set low and to the right."""
    img = paper(rng, h, w)
    cx, cy, rx, ry = w * 0.6, h * 0.6, h * 0.2, h * 0.17
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Soft cast shadow on the paper.
    sh = np.exp(-(((xx - cx - rx * 0.25) / (rx * 1.2)) ** 2 + ((yy - cy - ry * 0.92) / (ry * 0.28)) ** 2))
    multiply(img, sh * 0.28, np.array([120, 110, 105], np.float32))
    paint_persimmon(img, rng, cx, cy, rx, ry)
    calyx(img, rng, cx - rx * 0.03, cy - ry * 0.9, rx * 0.42)
    seal(img, rng, int(w * 0.08), int(h * 0.12), int(h * 0.06))
    return img


def hanging(rng: np.random.Generator, w: int, h: int) -> Arr:
    """Hoshigaki: peeled persimmons drying on strings under the eaves."""
    img = paper(rng, h, w)
    # Eave beam across the top in a dark wash.
    # A thin bamboo pole across the top, in a single grey stroke.
    pole = mask_from_draw(h, w, lambda d, s: d.line([(w * 0.06 * s, h * 0.05 * s), (w * 0.94 * s, h * 0.044 * s)],
                                                    fill=255, width=int(h * 0.012 * s)))
    multiply(img, wet_edge(pole, 2, 0.6) * (0.6 + 0.3 * vnoise(rng, h, w, 4)), np.array([92, 84, 66], np.float32))
    strings = [0.2, 0.47, 0.76]
    counts = [4, 6, 5]
    for si, sx in enumerate(strings):
        x0 = w * sx
        count = counts[si]
        string = Image.new('F', (w, h), 0)
        sd = ImageDraw.Draw(string)
        sway = rng.uniform(-8, 8)
        sd.line([(x0, h * 0.05), (x0 + sway, h * (0.2 + count * 0.135))], fill=0.6, width=2)
        multiply(img, blur(np.asarray(string), 0.7), np.array([110, 90, 70], np.float32))
        for k in range(count):
            t = (k + 0.7) / 6.2
            cy = h * (0.1 + t * 0.8) + [0.02, 0.0, 0.07][si] * h
            cx = x0 + sway * t + rng.uniform(-4, 4)
            rx = w * rng.uniform(0.044, 0.054)
            ry = rx * rng.uniform(1.05, 1.22)
            paint_persimmon(img, rng, cx, cy, rx, ry, colour=(214, 104, 40), shade=(150, 60, 34), dried=True)
            calyx(img, rng, cx, cy - ry * 0.95, rx * 0.5, stem=0)
    return img


def rain(rng: np.random.Generator, w: int, h: int) -> Arr:
    """Rain on paper: slanted grey streaks and a few drops that bloomed into the fibres."""
    img = paper(rng, h, w, np.array([236, 234, 228], np.float32))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sky = (1 - yy / h) ** 2 * 0.16 * (0.7 + 0.6 * fbm(rng, h, w, 300, 4))
    multiply(img, sky, np.array([70, 78, 92], np.float32))
    streaks = Image.new('F', (w, h), 0)
    d = ImageDraw.Draw(streaks)
    slant = math.tan(math.radians(9))
    for _ in range(900):
        x, y = rng.random() * (w + 200) - 100, rng.random() * h * 1.1 - 60
        ln = rng.uniform(30, 260)
        d.line([(x, y), (x + ln * slant, y + ln)], fill=float(rng.uniform(0.05, 0.32)), width=int(rng.choice([1, 1, 2])))
    multiply(img, blur(np.asarray(streaks), 0.8) * 0.75, np.array([60, 66, 80], np.float32))
    # Drops: wet blooms with a darker tide-mark rim, some trailing a drip downward.
    drops = np.zeros((h, w), np.float32)
    for _ in range(46):
        x, y = rng.random() * w, rng.random() * h * 0.92
        r = rng.uniform(4, 22) * (1.6 if rng.random() < 0.15 else 1)
        dist = np.sqrt((xx - x) ** 2 + ((yy - y) * 1.08) ** 2)
        disc = smoothstep(r + 1.5, r - 1.5, dist)
        rim = np.exp(-((dist - r * 0.92) ** 2) / (2 * (r * 0.09 + 0.8) ** 2))
        drops = np.maximum(drops, disc * 0.18 + rim * 0.42)
        if rng.random() < 0.35:
            tail = rng.uniform(40, 180)
            trail = smoothstep(r * 0.35, r * 0.1, np.abs(xx - x)) * ((yy > y) & (yy < y + tail)) * (1 - (yy - y) / tail)
            drops = np.maximum(drops, trail * 0.22)
    multiply(img, drops * (0.75 + 0.4 * vnoise(rng, h, w, 3)), np.array([48, 56, 72], np.float32))
    seal(img, rng, int(w * 0.86), int(h * 0.82), int(h * 0.06))
    return img


def gravel(rng: np.random.Generator, w: int, h: int) -> Arr:
    """A dry garden from above: raked lines that ring two stones, then run straight."""
    img = paper(rng, h, w, np.array([238, 234, 226], np.float32))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    stones = [(w * 0.34, h * 0.46, h * 0.13), (w * 0.69, h * 0.62, h * 0.075)]
    spacing = h * 0.026
    ring_zone = h * 0.15
    field = yy.copy()
    nearest = np.full((h, w), 1e9, np.float32)
    for (sx, sy, sr) in stones:
        ang = np.arctan2(yy - sy, xx - sx)
        # An irregular stone outline: radius wobbles with angle.
        wob = 1 + 0.08 * np.sin(ang * 3 + sx) + 0.05 * np.sin(ang * 5 + sy)
        ds = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2) - sr * wob
        nearest = np.minimum(nearest, ds)
        field = np.where((ds < ring_zone) & (ds <= nearest), ds, field)
    # Raked grooves: thin dark crests of a cosine over the distance field.
    wav = np.cos(field / spacing * 2 * math.pi + 0.0)
    grain = vnoise(rng, h, w, 2.0)
    grooves = smoothstep(0.55, 0.98, wav) * (0.16 + 0.1 * grain)
    shine = smoothstep(-0.2, -0.9, wav) * 0.05
    grooves *= nearest > 2
    multiply(img, grooves, np.array([80, 78, 72], np.float32))
    img += (shine * 40)[..., None]
    # Fine gravel speckle (kept faint so the WebP stays small).
    speck = np.clip((vnoise(rng, h, w, 1.6) - 0.62) * 2.2, 0, 1) * 0.12
    multiply(img, speck * (nearest > 0), np.array([90, 88, 80], np.float32))
    # Stones: dark ink with a lighter top face and a little moss at the foot.
    for (sx, sy, sr) in stones:
        ang = np.arctan2(yy - sy, xx - sx)
        wob = 1 + 0.08 * np.sin(ang * 3 + sx) + 0.05 * np.sin(ang * 5 + sy)
        ds = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2) - sr * wob
        body = smoothstep(1.5, -1.5, ds)
        top = np.clip(1 - np.sqrt(((xx - sx + sr * 0.25) / sr) ** 2 + ((yy - sy + sr * 0.3) / sr) ** 2), 0, 1)
        tex = fbm(rng, h, w, 18, 4)
        stone = body * (0.78 - 0.45 * top + 0.25 * (tex - 0.5))
        moss_ring = np.exp(-((ds + sr * 0.04) ** 2) / (2 * (sr * 0.06) ** 2)) * smoothstep(0.45, 0.7, fbm(rng, h, w, 30, 3))
        shadow = np.exp(-np.clip(ds, 0, None) / (sr * 0.12)) * (ds > 0) * np.clip((yy - sy) / sr + 0.4, 0, 1) * 0.3
        multiply(img, shadow, np.array([110, 104, 96], np.float32))
        multiply(img, moss_ring * 0.55, np.array([110, 124, 72], np.float32))
        multiply(img, stone, INK)
    return img


def moon(rng: np.random.Generator, w: int, h: int) -> Arr:
    """Moon left as bare paper inside an ink-wash night, broken on the water below."""
    img = paper(rng, h, w)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    mx, my, mr = w * 0.36, h * 0.27, h * 0.085
    horizon = h * 0.6
    clouds = fbm(rng, h, w, 280, 5)
    sky = (0.62 - 0.32 * (yy / horizon)) * (0.75 + 0.5 * clouds)
    dm = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2)
    sky *= smoothstep(mr - 1, mr + 1.5, dm)  # the moon itself is untouched paper
    sky *= 1 - 0.55 * np.exp(-((dm - mr) / (mr * 1.1)) ** 2)  # glow
    sky *= yy < horizon
    multiply(img, sky * smoothstep(horizon + 2, horizon - 30, yy), np.array([34, 38, 52], np.float32))
    # Far hills on the horizon.
    ridge = horizon - h * (0.02 + 0.05 * fbm1d(rng, w, 380, 6))
    hills = smoothstep(-1, 1, yy - ridge[None, :]) * (yy < horizon + 2) * 0.6
    multiply(img, hills, INK)
    # Water: darker band with horizontal ripple streaks and a broken moon path.
    below = smoothstep(horizon - 1, horizon + 2, yy)
    ripple = vnoise(rng, h, w, 1) * 0
    ripple_rows = np.asarray(Image.fromarray(vnoise(rng, h, w // 30 + 4, 3), 'F').resize((w, h), Image.BICUBIC))
    water = below * (0.35 + 0.25 * ripple_rows + 0.15 * fbm(rng, h, w, 200, 3)) + ripple
    path = np.exp(-((xx - mx) / (mr * (0.8 + (yy - horizon) / h * 2.2))) ** 2) * below
    glints = smoothstep(0.55, 0.8, ripple_rows) * path
    water *= 1 - np.clip(glints * 1.1 + path * 0.25, 0, 0.95)
    multiply(img, water * (1 - smoothstep(h * 0.9, h, yy) * 0.5), np.array([30, 34, 48], np.float32))
    seal(img, rng, int(w * 0.88), int(h * 0.08), int(h * 0.055))
    return img


def knife(rng: np.random.Generator, w: int, h: int) -> Arr:
    """A square-tipped vegetable knife resting across a pale wooden board."""
    img = paper(rng, h, w)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Board: a rounded rectangle with wavy grain, set at a slight angle.
    bx0, by0, bx1, by1 = w * 0.12, h * 0.18, w * 0.9, h * 0.86

    def board(d: ImageDraw.ImageDraw, s: int) -> None:
        d.rounded_rectangle([bx0 * s, by0 * s, bx1 * s, by1 * s], radius=int(h * 0.03 * s), fill=255)

    bm = mask_from_draw(h, w, board)
    warp = fbm(rng, h, w, 260, 5)
    # Grain runs along the board: noise stretched long in x, then folded into rings.
    streak = np.asarray(Image.fromarray(vnoise(rng, h, w // 40 + 4, 1.5), 'F').resize((w, h), Image.BICUBIC))
    rings = np.abs(np.sin((yy + warp * 160 + streak * 40) / 11.0))
    grain = smoothstep(0.82, 1.0, rings) * (0.6 + 0.4 * streak)
    fine = vnoise(rng, h, w, 2)
    wood = bm * (0.26 + 0.14 * grain + 0.06 * streak + 0.04 * fine)
    multiply(img, wood, np.array([214, 168, 110], np.float32))
    shadow_b = blur(bm, 14)
    multiply(img, np.clip(np.roll(np.roll(shadow_b, 12, 0), 10, 1) - bm, 0, 1) * 0.35, np.array([120, 110, 100], np.float32))

    # Knife geometry in a rotated frame.
    ang = math.radians(-14)
    ca, sa = math.cos(ang), math.sin(ang)
    ox, oy = w * 0.5, h * 0.52

    def tr(px: float, py: float) -> tuple[float, float]:
        return ox + px * ca - py * sa, oy + px * sa + py * ca

    L, Bh = w * 0.36, h * 0.17  # blade length, height
    blade = [tr(-L * 0.5, -Bh * 0.5), tr(L * 0.5, -Bh * 0.5), tr(L * 0.52, Bh * 0.45), tr(-L * 0.5, Bh * 0.5)]
    bevel = [tr(-L * 0.5, Bh * 0.3), tr(L * 0.515, Bh * 0.28), tr(L * 0.52, Bh * 0.45), tr(-L * 0.5, Bh * 0.5)]
    ferrule = [tr(-L * 0.5 - w * 0.035, -Bh * 0.2), tr(-L * 0.5, -Bh * 0.2), tr(-L * 0.5, Bh * 0.02), tr(-L * 0.5 - w * 0.035, Bh * 0.02)]
    handle = [tr(-L * 0.5 - w * 0.2, -Bh * 0.19), tr(-L * 0.5 - w * 0.035, -Bh * 0.2), tr(-L * 0.5 - w * 0.035, Bh * 0.02),
              tr(-L * 0.5 - w * 0.2, Bh * 0.0)]

    def poly(points):
        return lambda d, s: d.polygon([(px * s, py * s) for px, py in points], fill=255)

    whole = mask_from_draw(h, w, lambda d, s: [poly(p)(d, s) for p in (blade, ferrule, handle)])
    shadow = np.roll(np.roll(blur(whole, 9), 16, 0), 8, 1)
    multiply(img, np.clip(shadow - whole, 0, 1) * 0.5, np.array([90, 80, 70], np.float32))
    bm_k = mask_from_draw(h, w, poly(blade))
    bv = mask_from_draw(h, w, poly(bevel))
    # Kasumi haze: soft cloudy steel on the blade face, brighter mirror on the bevel.
    haze = fbm(rng, h, w, 60, 4)
    steel = bm_k * (0.62 + 0.18 * (haze - 0.5)) * (1 - bv * 0.55)
    multiply(img, steel, np.array([92, 96, 104], np.float32))
    multiply(img, bv * 0.12, np.array([150, 160, 175], np.float32))
    # Edge line: the sharpened apex catches the light.
    edge_line = mask_from_draw(h, w, lambda d, s: d.line([(px * s, py * s) for px, py in bevel[2:4]], fill=255, width=2 * s))
    img += (edge_line * 30)[..., None]
    hm = mask_from_draw(h, w, poly(handle))
    hgrain = np.sin((xx * ca + yy * sa) / 3.0 + warp * 30) * 0.5 + 0.5
    multiply(img, hm * (0.55 + 0.1 * hgrain), np.array([176, 128, 80], np.float32))
    fm = mask_from_draw(h, w, poly(ferrule))
    multiply(img, fm * 0.9, np.array([40, 34, 32], np.float32))
    seal(img, rng, int(w * 0.07), int(h * 0.86), int(h * 0.055))
    return img


PAINTINGS = {
    # name: (function, width, height, seed)
    'mountains': (mountains, 1600, 1067, 7),
    'enso': (enso, 1600, 1067, 11),
    'persimmon': (persimmon, 1600, 1067, 23),
    'hanging-persimmons': (hanging, 1600, 2000, 5),
    'rain': (rain, 1600, 1067, 31),
    'gravel': (gravel, 1600, 1067, 3),
    'moon': (moon, 1600, 1067, 17),
    'knife': (knife, 1600, 1067, 41),
}


def render(name: str) -> dict:
    fn, w, h, seed = PAINTINGS[name]
    rng = np.random.default_rng(seed)
    arr = np.clip(fn(rng, w, h), 0, 255).astype(np.uint8)
    master = Image.fromarray(arr, 'RGB')
    sizes = []
    for tw in WIDTHS:
        th = round(h * tw / w)
        im = master if tw == w else master.resize((tw, th), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'{name}-{tw}.webp')
        im.save(path, 'WEBP', quality=72 if tw == 1600 else 76, method=6)
        sizes.append(os.path.getsize(path))
    # Average colour doubles as the placeholder behind the image while it loads.
    avg = arr.reshape(-1, 3).mean(0).astype(int)
    print(f'  {name:20s} {w}x{h}  ' + '  '.join(f'{tw}:{s / 1024:.0f}KB' for tw, s in zip(WIDTHS, sizes)))
    return {'width': w, 'height': h, 'widths': list(WIDTHS), 'color': '#%02x%02x%02x' % tuple(avg)}


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    names = sys.argv[1:] or list(PAINTINGS)
    manifest = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            manifest = json.load(f)
    for name in names:
        manifest[name] = render(name)
    manifest = {k: manifest[k] for k in sorted(manifest)}
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f'  total {total / 1024:.0f} KB in public/img/')


if __name__ == '__main__':
    main()
