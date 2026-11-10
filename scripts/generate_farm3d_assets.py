#!/usr/bin/env python3
"""Génération procédurale des assets PBR du FARM 3D — hors ligne, seeds fixés, licence 100 % maison.
Usage :
    python3 -m venv /tmp/artenv && /tmp/artenv/bin/pip install pillow numpy
    /tmp/artenv/bin/python scripts/generate_farm3d_assets.py
Sorties dans assets/farm3d/ (commitées dans le repo). Rejouable à l'identique."""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'farm3d')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261110)

def save(img, name, quality=84):
    path = os.path.join(OUT, name)
    img.save(path, 'JPEG', quality=quality, optimize=True, progressive=False)
    print(f'  {name:24s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path)//1024} Ko')

def value_noise(size, cell, seed):
    r = np.random.default_rng(seed)
    grid = r.random((size // cell + 2, size // cell + 2)).astype(np.float32)
    img = Image.fromarray((grid * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255.0

def fbm(size, octaves, base_cell, seed):
    total = np.zeros((size, size), np.float32)
    amp, cell, norm = 1.0, base_cell, 0.0
    for i in range(octaves):
        total += amp * value_noise(size, cell, seed + i * 733)
        norm += amp
        amp *= 0.5
        cell = max(1, cell // 2)
    return total / norm

def height_to_normal(h, strength=2.0):
    gy, gx = np.gradient(h.astype(np.float32))
    nx, ny = -gx * strength, gy * strength
    nz = np.ones_like(h, dtype=np.float32)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / norm, ny / norm, nz / norm], axis=-1)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB')

def mix(a, b, t):
    a = np.asarray(a, np.float32); b = np.asarray(b, np.float32)
    if a.ndim == 1:
        a = a[None, None, :]
    if b.ndim == 1:
        b = b[None, None, :]
    if t.ndim == a.ndim - 1 or t.ndim == b.ndim - 1:
        t = np.expand_dims(t, -1)
    return a * (1 - t) + b * t

def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')

# ───────────────────────────── ciel équirectangulaire coucher de soleil ─────────────────────────────
def generate_sky():
    W, H = 2048, 1024
    stops = [(0.000, (26, 42, 64)), (0.120, (42, 63, 89)), (0.240, (62, 87, 111)),
             (0.360, (97, 116, 130)), (0.455, (146, 140, 124)), (0.505, (198, 176, 122)),
             (0.530, (240, 205, 142)), (0.560, (228, 190, 128)), (0.625, (178, 146, 96)),
             (0.740, (120, 97, 66)), (0.870, (74, 61, 44)), (1.000, (45, 38, 29))]
    ys = np.arange(H, dtype=np.float32) / H
    grad = np.zeros((H, 3), np.float32)
    for i in range(len(stops) - 1):
        y0, c0 = stops[i]; y1, c1 = stops[i + 1]
        m = (ys >= y0) & (ys <= y1 if i == len(stops) - 2 else ys < y1)
        t = ((ys[m] - y0) / max(1e-6, y1 - y0))[:, None]
        grad[m] = np.array(c0, np.float32) * (1 - t) + np.array(c1, np.float32) * t
    img = np.repeat(grad[:, None, :], W, axis=1)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    sun_u = (math.atan2(-10.5, -13.5) / (2 * math.pi) + 0.5) % 1.0
    sx, sy = sun_u * W, 0.415 * H

    # bande chaude d'horizon, plus marquée côté soleil
    horizon = np.exp(-((yy - 0.51 * H) / 30.0) ** 2)
    azimuth = np.exp(-((xx - sx) / 640.0) ** 2) * 0.75 + 0.25
    img += horizon[..., None] * azimuth[..., None] * np.array([66, 42, 12], np.float32) * 0.9

    # nuages stratifiés près de l'horizon (éclairés côté soleil) — AVANT le soleil
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cloud_rng = np.random.default_rng(777)
    for i in range(15):
        cx = cloud_rng.uniform(0.06, 0.94) * W
        cy = cloud_rng.uniform(0.30, 0.53) * H
        scale = cloud_rng.uniform(0.55, 1.5) * (1.35 if abs(cx - sx) < 420 else 1.0)
        lit = max(0.0, 1.0 - abs(cx - sx) / 900.0)
        top = np.array([58 + 28 * lit, 62 + 34 * lit, 82 + 30 * lit], np.float32)
        bottom = np.array([246, 214, 158], np.float32) * (0.45 + 0.55 * lit) + np.array([90, 88, 96], np.float32) * (0.55 - 0.55 * lit)
        for _ in range(42):
            px = cx + cloud_rng.normal(0, 95 * scale)
            py = cy + cloud_rng.normal(0, 13 * scale)
            w = abs(cloud_rng.normal(64, 38)) * scale + 14
            h = w * cloud_rng.uniform(0.28, 0.46)
            tone = cloud_rng.uniform(0.25, 0.8)
            col = tuple(int(v) for v in (top * (1 - tone) + bottom * tone))
            draw.ellipse([px - w, py - h, px + w, py + h], fill=col + (int(cloud_rng.uniform(80, 140)),))
    for i in range(5):
        cx = cloud_rng.uniform(0.08, 0.92) * W
        cy = cloud_rng.uniform(0.10, 0.26) * H
        scale = cloud_rng.uniform(0.7, 1.3)
        for _ in range(26):
            px = cx + cloud_rng.normal(0, 130 * scale)
            py = cy + cloud_rng.normal(0, 7 * scale)
            w = abs(cloud_rng.normal(58, 30)) * scale + 12
            col = (226, 218, 205, int(cloud_rng.uniform(40, 80)))
            draw.ellipse([px - w, py - w * 0.22, px + w, py + w * 0.22], fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(10))
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    base.alpha_composite(layer)
    img = np.asarray(base.convert('RGB'), dtype=np.float32)

    # halo large + disque solaire PAR-DESSUS les nuages (heure dorée)
    def glow(cx, cy, radius):
        dx, dy = xx - cx, (yy - cy) * 1.12
        return np.exp(-(dx * dx + dy * dy) / (radius * radius))

    img += glow(sx, sy, 330)[..., None] * np.array([96.0, 88.0, 64.0], np.float32)
    img += glow(sx, sy, 150)[..., None] * np.array([150.0, 143.0, 121.0], np.float32)
    core = ((xx - sx) / 46.0) ** 2 + ((yy - sy) / 38.0) ** 2 <= 1.0
    img[core] = np.array([255, 252, 236], np.float32)
    save(to_img(img), 'sky.jpg', quality=86)

# ───────────────────────────── herbe olive ─────────────────────────────
def generate_grass():
    S = 1024
    h1 = fbm(S, 5, 128, 11)
    detail = fbm(S, 5, 18, 12)
    dry = fbm(S, 3, 220, 13)
    arr = mix((66, 82, 40), (102, 122, 66), h1)
    dry_mask = np.clip((dry - 0.60) / 0.22, 0, 1)
    arr = arr * (1 - dry_mask[..., None] * 0.55) + np.array([122, 106, 58], np.float32) * (dry_mask[..., None] * 0.55)
    arr *= (0.80 + 0.42 * detail[..., None])
    img = to_img(arr)
    draw = ImageDraw.Draw(img, 'RGBA')
    r = np.random.default_rng(21)
    for _ in range(6200):
        x = r.uniform(0, S); y = r.uniform(0, S)
        ln = r.uniform(3.0, 8.0); tilt = r.normal(0, 0.45)
        light = r.uniform(0.62, 1.35)
        g = np.array([118, 138, 66], np.float32) * light
        col = tuple(int(v) for v in g) + (int(r.uniform(90, 170)),)
        draw.line([(x, y), (x + tilt * ln, y - ln)], fill=col, width=1 if r.random() < 0.8 else 2)
    img = img.filter(ImageFilter.GaussianBlur(0.35))
    save(img, 'grass-albedo.jpg', 84)
    save(height_to_normal(h1 * 0.55 + detail * 0.45, 2.6), 'grass-normal.jpg', 88)

# ───────────────────────────── terre labourée ─────────────────────────────
def generate_soil():
    S = 1024
    warp = fbm(S, 4, 96, 31)
    y = np.arange(S, dtype=np.float32)[:, None].repeat(S, axis=1)
    band = 0.5 + 0.5 * np.sin(y / 26.0 + warp * 9.0)
    mottled = fbm(S, 5, 48, 32)
    h = band * 0.45 + mottled * 0.55
    arr = mix((74, 50, 34), (126, 88, 58), band[..., None] if band.ndim == 3 else band)
    arr = mix(arr, np.array([88, 60, 40], np.float32)[None, None, :], (mottled - 0.4).clip(0, 1) * 0.6)
    arr *= (0.82 + 0.36 * fbm(S, 4, 12, 33)[..., None])
    img = to_img(arr)
    draw = ImageDraw.Draw(img, 'RGBA')
    r = np.random.default_rng(41)
    for _ in range(1400):  # mottes et cailloux
        x = r.uniform(0, S); yy = r.uniform(0, S); rad = r.uniform(1.2, 5.2)
        light = r.uniform(0.6, 1.5)
        col = tuple(int(v) for v in np.array([150, 120, 82], np.float32) * light) + (int(r.uniform(120, 200)),)
        draw.ellipse([x - rad, yy - rad * 0.7, x + rad, yy + rad * 0.7], fill=col)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    save(img, 'soil-albedo.jpg', 84)
    save(height_to_normal(h, 3.0), 'soil-normal.jpg', 88)

# ───────────────────────────── bois patiné (barn) ─────────────────────────────
def generate_wood():
    S = 512
    plank = 64
    r = np.random.default_rng(51)
    tones = r.uniform(0.72, 1.18, S // plank + 1)
    xs = np.arange(S)
    plank_idx = (xs // plank).clip(0, len(tones) - 1)
    tone_img = tones[plank_idx][None, :]
    grain = fbm(S, 5, 22, 52)
    streaks = 0.5 + 0.5 * np.sin(xs[None, :] * 0.9 + fbm(S, 3, 64, 53) * 14.0)
    h = grain * 0.6 + streaks * 0.4
    arr = np.array((134, 96, 59), np.float32)[None, None, :] * tone_img[..., None] * (0.78 + 0.44 * h[..., None])
    img = to_img(arr)
    draw = ImageDraw.Draw(img)
    for x in range(plank, S, plank):  # interstices
        draw.rectangle([x - 1, 0, x + 1, S], fill=(46, 32, 22))
    for _ in range(5):  # nœuds
        cx, cy = r.uniform(30, S - 30), r.uniform(30, S - 30)
        for k in range(6, 0, -1):
            rad = k * 2.6
            v = int(70 + k * 12)
            draw.ellipse([cx - rad, cy - rad * 0.75, cx + rad, cy + rad * 0.75], outline=(v, int(v * 0.7), int(v * 0.45)), width=2)
    save(img, 'wood-albedo.jpg', 84)
    save(height_to_normal(h, 2.2), 'wood-normal.jpg', 88)

# ───────────────────────────── toiture ardoise ─────────────────────────────
def generate_roof():
    S = 512
    tiles_x, row_h = 4, 64
    arr = np.zeros((S, S, 3), np.float32)
    r = np.random.default_rng(61)
    palette = [(44, 52, 59), (56, 65, 74), (35, 42, 48), (58, 67, 77), (40, 48, 55)]
    for row in range(0, S, row_h):
        offset = (row // row_h % 2) * (S // tiles_x // 2)
        for col in range(-1, tiles_x + 1):
            x0 = col * (S / tiles_x) + offset
            tone = np.array(palette[int(r.integers(0, len(palette)))], np.float32)
            tone *= r.uniform(0.85, 1.15)
            arr[row:row + row_h, :] = tone[None, None, :]
            arr[row:row + 4, :] *= 0.55  # joint bas sombre
            arr[row + row_h - 2:row + row_h, :] *= 1.35  # arête haute claire
            gap = int(4 * r.uniform(0.7, 1.3))
            xa, xb = int(max(0, x0)), int(min(S, x0 + S / tiles_x))
            if xb > xa:
                arr[row:row + row_h, xa:min(xa + gap, xb)] *= 0.45
    speckle = fbm(S, 4, 6, 63)
    arr *= (0.82 + 0.36 * speckle[..., None])
    img = to_img(arr)
    save(img, 'roof-albedo.jpg', 82)
    tile_h = np.zeros((S, S), np.float32)
    for row in range(0, S, row_h):
        tile_h[row:row + 4, :] = -1.4
        tile_h[row + row_h - 2:row + row_h, :] = 0.9
    save(height_to_normal(tile_h + fbm(S, 3, 9, 64) * 0.4, 2.4), 'roof-normal.jpg', 88)

# ───────────────────────────── tôle ondulée (silo) ─────────────────────────────
def generate_metal():
    S = 512
    x = np.arange(S, dtype=np.float32)[None, :].repeat(S, axis=0)
    corr = 0.5 + 0.5 * np.sin(x / 7.2)
    fine = fbm(S, 4, 10, 71)
    h = corr * 0.8 + fine * 0.2
    arr = mix((88, 96, 95), (172, 180, 179), corr[..., None] if corr.ndim == 3 else corr)
    arr *= (0.86 + 0.28 * fine[..., None])
    img = to_img(arr)
    draw = ImageDraw.Draw(img, 'RGBA')
    r = np.random.default_rng(72)
    for _ in range(46):  # rayures
        x0 = r.uniform(0, S); y0 = r.uniform(0, S); ln = r.uniform(20, 190)
        ang = r.uniform(-0.5, 0.5)
        col = (232, 236, 235, int(r.uniform(40, 110)))
        draw.line([(x0, y0), (x0 + math.sin(ang) * ln, y0 - math.cos(ang) * ln)], fill=col, width=1)
    for _ in range(7):  # coulures de rouille
        x0 = r.uniform(0, S); ln = r.uniform(60, 240)
        rust = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        rd = ImageDraw.Draw(rust)
        rd.rectangle([x0, 0, x0 + r.uniform(4, 11), ln], fill=(122, 70, 38, 78))
        rust = rust.filter(ImageFilter.GaussianBlur(3.2))
        img = Image.alpha_composite(img.convert('RGBA'), rust).convert('RGB')
    save(img, 'metal-albedo.jpg', 82)
    save(height_to_normal(h, 4.2), 'metal-normal.jpg', 88)

# ───────────────────────────── gravier (chemin) ─────────────────────────────
def generate_path():
    S = 512
    base = mix((176, 152, 104), (200, 176, 126), fbm(S, 4, 64, 81))
    img = to_img(base * (0.85 + 0.3 * fbm(S, 4, 12, 82)[..., None]))
    draw = ImageDraw.Draw(img)
    r = np.random.default_rng(83)
    for _ in range(950):
        x = r.uniform(-10, S + 10); y = r.uniform(-10, S + 10); rad = r.uniform(2.4, 11.5)
        t = r.uniform(0.55, 1.25)
        col = tuple(int(v) for v in np.array([196, 172, 120], np.float32) * t)
        edge = tuple(int(v * 0.62) for v in col)
        pts = []
        for k in range(8):
            ang = k / 8 * 2 * math.pi
            rr = rad * r.uniform(0.72, 1.15)
            pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr * 0.82))
        draw.polygon(pts, fill=col)
        draw.polygon(pts, outline=edge)
    img = img.filter(ImageFilter.GaussianBlur(0.35))
    save(img, 'path-albedo.jpg', 82)
    stones = fbm(S, 5, 26, 84)
    save(height_to_normal(stones, 2.6), 'path-normal.jpg', 88)

# ───────────────────────────── eau : normale de rides ─────────────────────────────
def generate_water_normal():
    S = 512
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    h = (np.sin(x / 23.0 + fbm(S, 3, 48, 91) * 5.0) * 0.5
         + np.sin((x + y) / 15.0 + fbm(S, 3, 32, 92) * 6.0) * 0.35
         + np.sin(y / 31.0 + fbm(S, 2, 96, 93) * 4.0) * 0.3
         + fbm(S, 4, 14, 94) * 0.7)
    save(height_to_normal(h, 1.9), 'water-normal.jpg', 90)

if __name__ == '__main__':
    print('Génération des assets FARM 3D (seed 20261110)…')
    generate_sky(); generate_grass(); generate_soil(); generate_wood()
    generate_roof(); generate_metal(); generate_path(); generate_water_normal()
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.jpg'))
    print(f'Total : {total // 1024} Ko dans assets/farm3d/')
