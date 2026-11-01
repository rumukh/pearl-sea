"""Colour-blocking composition sketches for Perlové moře backgrounds (Pillow only).

Each sketch is a Qwen Scene-mode reference: flat shapes that fix the composition, the
open UI areas and, for the map, the route that the SVG level nodes will follow.
Usage: python sketches.py <name> <out.png> [--route-json out.json]
"""

import json
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1664, 928


def vertical_gradient(top, bottom):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def blob(d, cx, cy, rx, ry, color, rng, n=14, jitter=0.18):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + rng.uniform(-jitter, jitter)
        pts.append((cx + rx * r * math.cos(a), cy + ry * r * math.sin(a)))
    d.polygon(pts, fill=color)


def catmull_rom(points, samples=24):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


# Grade-3 map: three rows, bottom left -> right, middle right -> left, top left -> right.
MAP3_REGIONS = [
    ("sunny-lagoon", (250, 760)),
    ("coral-reef", (830, 790)),
    ("kelp-forest", (1400, 720)),
    ("pirate-wreck", (1130, 470)),
    ("pearl-bay", (520, 450)),
    ("volcanic-vents", (260, 190)),
    ("ice-sea", (1340, 175)),
]
MAP3_ROUTE = [(110, 840), (250, 760), (520, 820), (830, 790), (1130, 800), (1400, 720), (1520, 560),
              (1130, 470), (820, 500), (520, 450), (250, 390), (260, 190), (560, 120), (900, 180),
              (1340, 175), (1560, 110)]


def map3(out, route_json=None):
    rng = random.Random(31)
    img = vertical_gradient((96, 196, 214), (120, 214, 222))
    d = ImageDraw.Draw(img)
    # shallow sand banks under each region
    sand = (236, 218, 170)
    for _, (cx, cy) in MAP3_REGIONS:
        blob(d, cx, cy, 230, 130, sand, rng, jitter=0.22)
    # region identities
    blob(d, 250, 770, 170, 95, (122, 222, 226), rng)                                  # lagoon water pool
    for x, y, c in [(140, 690, (255, 122, 168)), (360, 700, (255, 157, 77)), (330, 840, (255, 122, 168))]:
        blob(d, x, y, 40, 30, c, rng)
    for i in range(9):                                                               # coral reef
        blob(d, 690 + i * 32 + rng.randint(-10, 10), 720 + rng.randint(-50, 90), 38, 30,
             [(255, 122, 168), (255, 157, 77), (167, 123, 224), (255, 205, 90)][i % 4], rng)
    for i in range(10):                                                              # kelp forest
        x = 1280 + i * 26 + rng.randint(-8, 8)
        d.line([(x, 840), (x + rng.randint(-30, 30), 600)], fill=(40, 130, 80), width=20)
    d.polygon([(1040, 500), (1230, 430), (1260, 470), (1070, 545)], fill=(130, 84, 52))  # wreck hull
    d.line([(1150, 470), (1120, 330)], fill=(110, 70, 45), width=12)                   # mast
    for i in range(6):                                                               # pearl bay shells
        blob(d, 430 + i * 38, 430 + rng.randint(-40, 40), 30, 22, (250, 236, 240), rng)
    blob(d, 260, 190, 200, 110, (88, 70, 80), rng)                                   # volcanic rocks
    for x, y in [(200, 160), (300, 210), (250, 120)]:
        blob(d, x, y, 22, 22, (255, 120, 50), rng)
    for x, y in [(1260, 150), (1380, 200), (1450, 130), (1320, 90)]:                 # ice floes
        blob(d, x, y, 80, 46, (245, 252, 255), rng)
    # the route: a pale sandy path with a darker edge, kept clear of decoration
    path = catmull_rom(MAP3_ROUTE)
    d.line(path, fill=(170, 140, 100), width=46, joint="curve")
    d.line(path, fill=(250, 238, 205), width=34, joint="curve")
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "route": [[round(x, 1), round(y, 1)] for x, y in path],
                       "regions": {k: list(v) for k, v in MAP3_REGIONS}}, f, indent=1)


def grotto(out, route_json=None):
    rng = random.Random(53)
    img = vertical_gradient((40, 70, 110), (30, 52, 86))
    d = ImageDraw.Draw(img)
    # bright opening to the sea at the back centre (arch)
    d.ellipse([560, 70, 1104, 760], fill=(110, 205, 225))
    d.rectangle([560, 415, 1104, 760], fill=(110, 205, 225))
    for x0 in (700, 820, 940):
        d.polygon([(x0, 70), (x0 + 50, 70), (x0 + 140, 640), (x0 + 60, 640)], fill=(170, 230, 236))
    # cave walls framing the scene
    d.polygon([(0, 0), (W, 0), (W, 120), (1260, 90), (1100, 160), (830, 60), (560, 160), (380, 90), (0, 140)], fill=(58, 60, 104))
    d.polygon([(0, 0), (330, 0), (430, 260), (380, 560), (300, 760), (0, 760)], fill=(66, 70, 118))
    d.polygon([(W, 0), (1330, 0), (1230, 280), (1290, 560), (1370, 760), (W, 760)], fill=(66, 70, 118))
    # ledges for friends on both sides
    for x0, y0, w in [(40, 520, 300), (110, 300, 230), (1320, 520, 300), (1330, 300, 230)]:
        d.rounded_rectangle([x0, y0, x0 + w, y0 + 34], radius=16, fill=(96, 100, 150))
    # sandy floor with an open centre
    floor = [(0, H)] + [(x, int(700 + 26 * math.sin(x / 140.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(232, 210, 160))
    # warm pearl lanterns and a few cosy props at the edges
    for x, y in [(210, 230), (1450, 230), (460, 470), (1200, 470)]:
        d.ellipse([x - 18, y - 18, x + 18, y + 18], fill=(255, 236, 170))
    blob(d, 150, 760, 90, 40, (255, 140, 170), rng)        # anemone garden left
    blob(d, 1500, 770, 100, 40, (190, 140, 230), rng)       # anemone garden right
    d.rounded_rectangle([1350, 640, 1470, 720], radius=12, fill=(150, 96, 52))   # treasure chest
    img = img.filter(ImageFilter.GaussianBlur(1.5))
    img.save(out)


def moray(out, route_json=None):
    """Murena Mumla: a moray in profile leaning out of a rock hole, facing left (toward the player)."""
    S = 1328
    img = Image.new("RGB", (S, S), (200, 200, 200))
    d = ImageDraw.Draw(img)
    rng = random.Random(72)
    green, spot, fin, ink, plum = (150, 210, 70), (250, 225, 70), (255, 125, 80), (25, 18, 40), (70, 30, 60)
    # natural rounded boulder with a dark hole on its left face and a crack on the right for the tail
    blob(d, 820, 1050, 430, 250, (150, 135, 140), rng, n=22, jitter=0.07)
    blob(d, 470, 1230, 80, 45, (135, 122, 128), rng, n=10, jitter=0.15)
    blob(d, 1180, 1240, 70, 40, (135, 122, 128), rng, n=10, jitter=0.15)
    blob(d, 640, 960, 150, 175, (35, 25, 50), rng, n=16, jitter=0.06)
    # tail tip out of the right crack: flat paddle with a fin edge
    d.polygon([(1085, 862), (1105, 780), (1145, 700), (1205, 640), (1262, 615), (1275, 650), (1245, 715),
               (1195, 790), (1150, 865)], fill=green)
    d.line([(1105, 780), (1145, 700), (1205, 640), (1262, 615), (1275, 650)], fill=fin, width=20)
    d.ellipse([1180, 720, 1206, 746], fill=spot)
    blob(d, 1115, 870, 48, 32, (35, 25, 50), rng, n=10, jitter=0.1)
    # body: a thick ribbon rising out of the hole, curving up and left
    spine = catmull_rom([(670, 1010), (620, 880), (585, 740), (600, 610), (560, 500), (500, 440)], samples=30)
    for i, (x, y) in enumerate(spine):
        r = 92 - 10 * i / len(spine)
        d.ellipse([x - r, y - r, x + r, y + r], fill=green)
    # continuous fin crest along the back (outer side of the curve)
    for i, (x, y) in enumerate(spine[:-6]):
        r = 92 - 10 * i / len(spine)
        fx, fy = x + r * 0.95, y - r * 0.25
        d.ellipse([fx - 30, fy - 30, fx + 30, fy + 30], fill=fin)
    for i, (x, y) in enumerate(spine):
        r = 84 - 10 * i / len(spine)
        d.ellipse([x - r, y - r, x + r, y + r], fill=green)
    # head in profile, facing left: bulging forehead, short blunt snout, long mouth line
    head = [(600, 380), (540, 300), (450, 285), (360, 310), (290, 350), (250, 400), (262, 425),
            (430, 470), (268, 470), (285, 520), (360, 560), (470, 575), (560, 560), (620, 480)]
    d.polygon(head, fill=green)
    d.polygon([(262, 425), (440, 468), (272, 468)], fill=(170, 50, 80))            # open mouth
    for x in (300, 345, 390):                                                    # blunt teeth
        d.rounded_rectangle([x, 428 + (x - 300) // 9, x + 22, 450 + (x - 300) // 9], radius=6, fill=(255, 255, 245))
    d.rounded_rectangle([310, 452, 330, 466], radius=5, fill=(255, 255, 245))
    for x, y in [(258, 368), (282, 352)]:                                        # tube nostrils
        d.rounded_rectangle([x - 9, y - 26, x + 9, y + 4], radius=8, fill=(130, 190, 60))
    d.ellipse([370, 330, 450, 410], fill=(255, 215, 40))                         # eye
    d.ellipse([388, 352, 422, 386], fill=(20, 15, 25))
    d.line([(470, 318), (360, 350)], fill=plum, width=22)                       # low, frowning brow
    for x, y, r in [(520, 360, 16), (480, 520, 14), (560, 700, 18), (610, 820, 16), (540, 610, 14), (1220, 800, 12),
                    (530, 760, 13), (515, 680, 12), (560, 900, 13), (590, 560, 12), (455, 485, 11)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=spot)
    # magic ink: blots and drips over the head and body
    for x, y, rx, ry in [(520, 330, 60, 34), (600, 640, 70, 90), (640, 860, 60, 70), (470, 545, 46, 26)]:
        blob(d, x, y, rx, ry, ink, rng, n=12, jitter=0.25)
    for x, y0, y1 in [(505, 360, 420), (585, 700, 790), (640, 900, 980), (460, 560, 610)]:
        d.line([(x, y0), (x, y1)], fill=ink, width=16)
        d.ellipse([x - 13, y1 - 13, x + 13, y1 + 13], fill=ink)
    for x, y, r in [(200, 300, 16), (170, 250, 10), (215, 215, 8)]:             # ink bubbles
        d.ellipse([x - r, y - r, x + r, y + r], fill=ink)
    img = img.filter(ImageFilter.GaussianBlur(1.0))
    img.save(out)


GREY = (200, 200, 200)
PLUM = (80, 34, 60)


def canvas():
    img = Image.new("RGB", (1328, 1328), GREY)
    return img, ImageDraw.Draw(img)


def plain_grey(out, route_json=None):
    """The blank canvas of Subjects-mode renders: it sets the square framing and the plain backdrop."""
    canvas()[0].save(out)


def eye(d, cx, cy, r, iris=None):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255))
    if iris:
        d.ellipse([cx - r * 0.7, cy - r * 0.6, cx + r * 0.7, cy + r * 0.8], fill=iris)
    d.ellipse([cx - r * 0.45, cy - r * 0.3, cx + r * 0.45, cy + r * 0.6], fill=(25, 18, 30))
    d.ellipse([cx - r * 0.35, cy - r * 0.35, cx - r * 0.05, cy - r * 0.05], fill=(255, 255, 255))


def smile(d, cx, cy, w, h):
    d.arc([cx - w, cy - h, cx + w, cy + h], 20, 160, fill=PLUM, width=10)


def cheeks(d, pts, r=26):
    for x, y in pts:
        d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=(250, 150, 160))


def thick_path(d, pts, w0, w1, color, samples=20):
    path = catmull_rom(pts, samples)
    for i, (x, y) in enumerate(path):
        r = (w0 + (w1 - w0) * i / max(len(path) - 1, 1)) / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    return path


def krab(out, route_json=None):
    """Krab Tvrdak: exactly seven rim spikes, eyes on stalks, two claws, three legs per side."""
    img, d = canvas()
    red, cream, spike, leg = (226, 62, 48), (247, 230, 192), (252, 248, 236), (236, 104, 58)
    cx, cy, rx, ry = 664, 720, 340, 250
    for side in (-1, 1):                                    # three stubby walking legs per side
        for k in range(3):
            x0 = cx + side * (190 + 55 * k)
            thick_path(d, [(x0, cy + 120), (x0 + side * (90 + 30 * k), cy + 250), (x0 + side * (120 + 40 * k), 1120)], 52, 40, leg)
    for side in (-1, 1):                                    # arms raised in a proud flex
        thick_path(d, [(cx + side * 300, cy - 20), (cx + side * 420, cy - 120), (cx + side * 450, 470)], 60, 54, leg)
        ccx, ccy = cx + side * 455, 400
        d.ellipse([ccx - 105, ccy - 95, ccx + 105, ccy + 95], fill=red)
        d.polygon([(ccx, ccy), (ccx + side * 20, ccy - 110), (ccx + side * 110, ccy - 40)], fill=GREY)   # pincer gap
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=red)                 # shell
    d.ellipse([cx - 270, cy + 40, cx + 270, cy + 240], fill=cream)           # cream underside
    for k in range(7):                                      # exactly seven spikes on the upper rim
        a = math.radians(155 - k * (130 / 6))
        bx, by = cx + rx * math.cos(a), cy - ry * math.sin(a)
        nx, ny = math.cos(a) * ry, -math.sin(a) * rx
        n = math.hypot(nx, ny)
        nx, ny = nx / n, ny / n
        tx, ty = -ny, nx
        d.polygon([(bx - tx * 34, by - ty * 34), (bx + nx * 82, by + ny * 82), (bx + tx * 34, by + ty * 34)], fill=spike)
    for ex in (600, 728):                                   # eye stalks and eyes above the rim
        d.line([(ex + (10 if ex < 664 else -10), 560), (ex, 330)], fill=red, width=34)
        eye(d, ex, 300, 56)
    smile(d, cx, 640, 70, 40)
    cheeks(d, [(548, 640), (780, 640)])
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def meduzka(out, route_json=None):
    """Meduzka Mekulka: a soft bell with a face and exactly nine separated ribbon tentacles."""
    img, d = canvas()
    cols = [(246, 150, 192), (192, 160, 238), (250, 188, 150)]
    for k in range(9):
        x0 = 404 + k * 65
        pts = [(x0 + 18 * math.sin(k * 0.9 + t * 0.03), 560 + t * 5.6) for t in range(0, 101, 10)]
        for i, (x, y) in enumerate(pts):
            pass
        thick_path(d, pts, 40, 30, cols[k % 3], samples=8)
        tx, ty = pts[-1]
        d.ellipse([tx - 22, ty - 22, tx + 22, ty + 22], fill=cols[k % 3])
    bell = [(664 + 310 * math.cos(a), 560 - 300 * math.sin(a)) for a in np.linspace(0, math.pi, 50)]
    scallop = [(354 + 620 * t, 575 + 18 * math.sin(t * math.pi * 10)) for t in np.linspace(0, 1, 60)]
    d.polygon(bell + scallop, fill=(240, 178, 222))
    d.ellipse([470, 330, 640, 430], fill=(250, 214, 238))                    # soft highlight
    eye(d, 584, 470, 50)
    eye(d, 744, 470, 50)
    smile(d, 664, 520, 50, 32)
    cheeks(d, [(520, 525), (808, 525)])
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def zelva(out, route_json=None):
    """Zelva Obojka: swimming right, shell of exactly eight plates (two rows of four), paddle flippers."""
    img, d = canvas()
    skin, cream = (118, 204, 150), (246, 232, 168)
    plates = [(222, 152, 70), (240, 186, 92)]
    thick_path(d, [(360, 700), (250, 760), (200, 800)], 90, 50, skin)        # rear flippers
    thick_path(d, [(470, 790), (420, 900), (400, 960)], 90, 50, skin)
    thick_path(d, [(820, 760), (930, 880), (1010, 960)], 120, 60, skin)      # lower front flipper
    d.ellipse([430, 690, 930, 850], fill=cream)                              # belly plate
    cx, cy, rx, ry = 640, 600, 330, 230
    d.ellipse([cx - rx - 16, cy - ry - 16, cx + rx + 16, cy + ry + 16], fill=(170, 100, 50))   # rim
    shell = Image.new("L", img.size, 0)
    ImageDraw.Draw(shell).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    cells = Image.new("RGB", img.size, GREY)
    cd = ImageDraw.Draw(cells)
    xs = [cx - rx, cx - 165, cx, cx + 165, cx + rx]
    for row in range(2):
        y0, y1 = (cy - ry, cy) if row == 0 else (cy, cy + ry)
        for col in range(4):
            cd.rectangle([xs[col], y0, xs[col + 1], y1], fill=plates[(row + col) % 2])
    for x in xs[1:-1]:
        cd.line([(x, cy - ry), (x, cy + ry)], fill=PLUM, width=12)
    cd.line([(cx - rx, cy), (cx + rx, cy)], fill=PLUM, width=12)
    img.paste(cells, (0, 0), shell)
    thick_path(d, [(900, 560), (980, 520), (1040, 500)], 120, 110, skin)      # neck
    d.ellipse([960, 340, 1220, 590], fill=skin)                              # head
    eye(d, 1060, 440, 40, iris=(120, 70, 40))
    eye(d, 1160, 446, 36, iris=(120, 70, 40))
    smile(d, 1120, 505, 45, 28)
    cheeks(d, [(1020, 500), (1196, 505)], r=22)
    thick_path(d, [(880, 470), (930, 330), (990, 220)], 110, 70, skin)        # raised waving flipper
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def osmicka(out, route_json=None):
    """Profesorka Osmicka: a big round head with glasses and exactly eight curling arms, one raised."""
    img, d = canvas()
    body, sucker = (168, 126, 218), (226, 206, 246)
    arms = [
        [(570, 760), (430, 850), (300, 900), (240, 850), (270, 800)],
        [(600, 800), (510, 940), (440, 1060), (380, 1050), (390, 1000)],
        [(635, 820), (610, 980), (590, 1120), (530, 1140), (520, 1090)],
        [(665, 830), (690, 990), (710, 1140), (770, 1160), (790, 1110)],
        [(700, 820), (790, 960), (860, 1080), (920, 1070), (910, 1020)],
        [(735, 800), (860, 900), (980, 960), (1040, 920), (1010, 870)],
        [(760, 760), (900, 790), (1040, 780), (1080, 730), (1040, 700)],
        [(740, 690), (880, 600), (960, 470), (970, 380), (920, 380)],
    ]
    for pts in arms:
        path = thick_path(d, pts, 78, 34, body)
        for i in range(4, len(path) - 6, 9):
            x, y = path[i]
            d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=sucker)
    d.ellipse([414, 230, 914, 820], fill=body)                               # head and mantle
    for ex in (590, 738):
        eye(d, ex, 560, 50)
        d.ellipse([ex - 70, 490, ex + 70, 630], outline=(222, 178, 60), width=14)   # round golden glasses
    d.line([(660, 556), (668, 556)], fill=(222, 178, 60), width=12)
    smile(d, 664, 670, 60, 34)
    cheeks(d, [(540, 670), (790, 670)])
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def meduzka2(out, route_json=None):
    """Meduzka Mekulka v2: nine soft, wavy tentacles that fan out and curl at the tips."""
    img, d = canvas()
    cols = [(246, 150, 192), (192, 160, 238), (250, 188, 150)]
    for k in range(9):
        u = (k - 4) / 4.0                                   # -1 .. 1 across the bell
        x0 = 664 + u * 250
        length = 470 - 90 * abs(u)
        spread = u * 170
        pts = []
        for t in np.linspace(0, 1, 12):
            x = x0 + spread * t ** 1.4 + 34 * math.sin(t * 5.0 + k * 0.8) * (0.4 + t)
            y = 575 + length * t
            pts.append((x, y))
        thick_path(d, pts, 44, 30, cols[k % 3], samples=10)
        tx, ty = pts[-1]
        side = -1 if u < 0 else 1
        curl = [(tx + side * 30 * math.cos(a) - side * 30, ty + 30 * math.sin(a)) for a in np.linspace(0, math.pi * 1.4, 8)]
        thick_path(d, [(tx, ty)] + curl, 30, 22, cols[k % 3], samples=6)
    bell = [(664 + 310 * math.cos(a), 560 - 300 * math.sin(a)) for a in np.linspace(0, math.pi, 50)]
    scallop = [(354 + 620 * t, 575 + 18 * math.sin(t * math.pi * 10)) for t in np.linspace(0, 1, 60)]
    d.polygon(bell + scallop, fill=(240, 178, 222))
    d.ellipse([470, 330, 640, 430], fill=(250, 214, 238))
    eye(d, 584, 470, 50)
    eye(d, 744, 470, 50)
    smile(d, 664, 520, 50, 32)
    cheeks(d, [(520, 525), (808, 525)])
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def zelva2(out, route_json=None):
    """Zelva Obojka v2: swimming right, a domed shell tiled by exactly eight plates whose borders
    curve with the dome (four columns, two rows), smooth paddle flippers, no wave."""
    img, d = canvas()
    skin, cream, rim = (118, 204, 150), (246, 232, 168), (178, 108, 52)
    plates = [np.array((226, 156, 72)), np.array((242, 190, 96))]
    thick_path(d, [(360, 720), (250, 790), (190, 830)], 96, 52, skin)        # rear flippers
    thick_path(d, [(480, 800), (440, 910), (420, 970)], 96, 52, skin)
    thick_path(d, [(860, 770), (980, 860), (1090, 900)], 130, 62, skin)      # front flipper, forward and down
    d.ellipse([430, 700, 950, 860], fill=cream)                              # belly plate
    cx, cy, rx, ry = 640, 600, 330, 235
    d.ellipse([cx - rx - 20, cy - ry - 20, cx + rx + 20, cy + ry + 20], fill=rim)
    arr = np.asarray(img).copy()
    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
    ny = (yy - cy) / ry
    inside = ((xx - cx) / rx) ** 2 + ny ** 2 <= 1.0
    half = np.sqrt(np.clip(1 - ny ** 2, 1e-6, 1))
    nx = (xx - cx) / (rx * half)                                             # meridian coordinate, -1..1
    col = np.clip(((nx + 1) / 2 * 4).astype(int), 0, 3)
    row = (ny + 0.12 * (1 - nx ** 2) > 0.0).astype(int)                      # a latitude that bulges with the dome
    cell = col + 4 * row
    for k in range(8):
        arr[inside & (cell == k)] = plates[(k + k // 4) % 2]
    edge = np.zeros_like(inside)
    edge[1:, :] |= cell[1:, :] != cell[:-1, :]
    edge[:, 1:] |= cell[:, 1:] != cell[:, :-1]
    edge = ndimage_dilate(edge & inside, 5)
    arr[edge & inside] = PLUM
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=PLUM, width=10)
    thick_path(d, [(920, 560), (1000, 530), (1060, 505)], 140, 128, skin)     # short thick neck
    d.ellipse([990, 330, 1260, 600], fill=skin)                              # head
    eye(d, 1090, 440, 42, iris=(120, 70, 40))
    eye(d, 1190, 448, 38, iris=(120, 70, 40))
    smile(d, 1150, 512, 48, 30)
    cheeks(d, [(1050, 505), (1228, 510)], r=22)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def avatars(out, route_json=None):
    """Eight diver avatars on one 16:9 sheet: round brass porthole frames in two rows of four, each
    with a child's head and shoulders, a diving mask pushed up on the forehead and a wetsuit collar,
    big simple features so the portraits read at 64 px."""
    img = Image.new("RGB", (W, H), GREY)
    d = ImageDraw.Draw(img)
    kids = [  # skin, hair, hair style, wetsuit, mask
        ((250, 214, 188), (226, 110, 40), "puffs", (40, 180, 190), (250, 205, 60)),
        ((118, 74, 50), (30, 24, 24), "short-curly", (245, 140, 60), (60, 130, 220)),
        ((214, 164, 120), (28, 24, 30), "ponytail", (150, 100, 210), (245, 120, 170)),
        ((252, 220, 196), (240, 200, 90), "messy", (90, 190, 110), (245, 150, 50)),
        ((96, 62, 46), (24, 20, 22), "bun", (240, 96, 90), (50, 200, 200)),
        ((226, 178, 136), (110, 70, 40), "wavy", (250, 210, 70), (230, 72, 72)),
        ((240, 196, 162), (120, 76, 44), "bob", (245, 150, 190), (90, 200, 120)),
        ((160, 104, 70), (46, 30, 24), "braids", (70, 140, 230), (150, 110, 220)),
    ]
    for i, (skin, hair, style, suit, mask) in enumerate(kids):
        cx, cy = 208 + 416 * (i % 4), 232 + 464 * (i // 4)
        d.ellipse([cx - 198, cy - 198, cx + 198, cy + 198], fill=(196, 152, 74))           # brass ring
        for k in range(8):
            a = math.radians(22.5 + k * 45)
            rx, ry = cx + 186 * math.cos(a), cy + 186 * math.sin(a)
            d.ellipse([rx - 8, ry - 8, rx + 8, ry + 8], fill=(150, 110, 50))              # rivets
        disc = Image.new("L", (W, H), 0)
        ImageDraw.Draw(disc).ellipse([cx - 172, cy - 172, cx + 172, cy + 172], fill=255)
        portrait = Image.new("RGB", (W, H), (150, 214, 226))
        p = ImageDraw.Draw(portrait)
        p.ellipse([cx - 150, cy + 70, cx + 150, cy + 300], fill=suit)                      # shoulders
        p.rectangle([cx - 34, cy + 40, cx + 34, cy + 100], fill=skin)                     # neck
        p.ellipse([cx - 64, cy + 82, cx + 64, cy + 122], fill=tuple(int(c * 0.8) for c in suit))  # collar
        if style == "braids":
            for s in (-1, 1):
                p.rectangle([cx + s * 84 - 18, cy - 10, cx + s * 84 + 18, cy + 130], fill=hair)
        if style == "ponytail":
            p.ellipse([cx + 60, cy - 60, cx + 140, cy + 60], fill=hair)
        p.ellipse([cx - 92, cy - 120, cx + 92, cy + 70], fill=hair)                       # hair mass
        if style == "puffs":
            for s in (-1, 1):
                p.ellipse([cx + s * 96 - 46, cy - 150, cx + s * 96 + 46, cy - 58], fill=hair)
        if style == "bun":
            p.ellipse([cx - 44, cy - 178, cx + 44, cy - 98], fill=hair)
        if style == "messy":
            for k in range(5):
                x = cx - 80 + k * 40
                p.polygon([(x - 20, cy - 96), (x + 4, cy - 140), (x + 20, cy - 96)], fill=hair)
        p.ellipse([cx - 76, cy - 72, cx + 76, cy + 84], fill=skin)                         # face
        p.rounded_rectangle([cx - 92, cy - 108, cx + 92, cy - 64], radius=20, fill=mask)  # mask strap and frame
        for s in (-1, 1):
            p.ellipse([cx + s * 40 - 32, cy - 112, cx + s * 40 + 32, cy - 60], fill=(185, 232, 246))
        eye(p, cx - 30, cy + 2, 17)
        eye(p, cx + 30, cy + 2, 17)
        p.chord([cx - 34, cy + 16, cx + 34, cy + 62], 10, 170, fill=(150, 40, 60))           # open smile
        cheeks(p, [(cx - 52, cy + 34), (cx + 52, cy + 34)], r=16)
        img.paste(portrait, (0, 0), disc)
    img.filter(ImageFilter.GaussianBlur(1.0)).save(out)


def paddle(d, root, tip, width, color, bend=0.0, spots=None):
    """A rounded, leaf-shaped flipper from root to tip, widest a third of the way out; bend curves
    it sideways (a fraction of its length, positive to the left of the root-to-tip direction)."""
    (x0, y0), (x1, y1) = root, tip
    length = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    nx, ny = -uy, ux
    left, right = [], []
    for t in 1.0 - (1.0 - np.linspace(0.0, 1.0, 64)) ** 1.6:                  # dense near the round tip
        if t <= 0.4:
            half = width / 2 * (0.55 + 0.45 * math.sin(math.pi / 2 * t / 0.4))
        else:
            half = width / 2 * math.sqrt(max(0.0, 1 - ((t - 0.4) / 0.6) ** 2))
        off = bend * length * math.sin(math.pi * t)
        cx, cy = x0 + ux * length * t + nx * off, y0 + uy * length * t + ny * off
        left.append((cx + nx * half, cy + ny * half))
        right.append((cx - nx * half, cy - ny * half))
    d.polygon(left + right[::-1], fill=color)
    for s, o in spots or ():
        off = bend * length * math.sin(math.pi * s)
        px = x0 + ux * length * s + nx * (off + o * width / 2)
        py = y0 + uy * length * s + ny * (off + o * width / 2)
        d.ellipse([px - 13, py - 10, px + 13, py + 10], fill=(170, 226, 160))


def zelva_baby2(out, route_json=None):
    """Zelva Obojka as a hatchling, facing left like her master: a big round head, a small domed
    shell of exactly eight plates (an upper row of four and a lower row of four), a lighter rim
    band, a cream belly and short, rounded, leaf-shaped paddle flippers (never arms or legs)."""
    img, d = canvas()
    skin, spot, cream, rim = (118, 204, 150), (170, 226, 160), (246, 232, 168), (238, 176, 92)
    fin = (92, 180, 124)
    plates = [np.array((226, 150, 66)), np.array((242, 186, 92))]
    paddle(d, (1060, 715), (1215, 790), 96, fin, bend=0.10, spots=[(0.55, 0.0)])             # rear flipper
    paddle(d, (720, 755), (860, 880), 104, fin, bend=0.12, spots=[(0.55, 0.0)])              # far front flipper, swept back
    d.ellipse([570, 650, 1080, 775], fill=cream)                             # belly
    cx, cy, rx, ry = 830, 690, 290, 260                                      # dome on the rim line cy
    arr = np.asarray(img).copy()
    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
    u = (xx - cx) / rx
    inside = (u ** 2 + ((yy - cy) / ry) ** 2 <= 1.0) & (yy <= cy)
    xs = []
    for k in (-1, 0, 1):                                                     # column borders, fanned
        x_rim, x_top = cx + k * 150, cx + k * 70
        xs.append(x_rim + (x_top - x_rim) * (cy - yy) / ry)
    col = (xx >= xs[0]).astype(int) + (xx >= xs[1]).astype(int) + (xx >= xs[2]).astype(int)
    boundary = cy - 0.56 * ry * np.sqrt(np.clip(1 - u ** 2, 0, 1))
    row = (yy >= boundary).astype(int)
    cell = col + 4 * row
    for k in range(8):
        arr[inside & (cell == k)] = plates[(k + k // 4) % 2]
    edge = np.zeros_like(inside)
    edge[1:, :] |= cell[1:, :] != cell[:-1, :]
    edge[:, 1:] |= cell[:, 1:] != cell[:, :-1]
    edge = ndimage_dilate(edge & inside, 5)
    arr[edge & inside] = PLUM
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    dome = [(cx + rx * math.cos(a), cy - ry * math.sin(a)) for a in np.linspace(0, math.pi, 90)]
    d.line(dome, fill=PLUM, width=12)
    d.rectangle([cx - rx, cy - 30, cx + rx, cy + 6], fill=rim)               # lighter rim band
    d.line([(cx - rx, cy - 30), (cx + rx, cy - 30)], fill=PLUM, width=10)
    paddle(d, (630, 720), (330, 835), 140, fin, bend=0.10, spots=[(0.45, 0.1), (0.62, -0.25), (0.78, 0.15)])  # near front flipper
    thick_path(d, [(600, 610), (560, 592), (520, 580)], 140, 130, skin)     # short thick neck
    d.ellipse([200, 350, 540, 680], fill=skin)                              # big round head
    for sx, sy in ((285, 405), (335, 385), (395, 392), (440, 420), (255, 455), (495, 470)):
        d.ellipse([sx - 14, sy - 11, sx + 14, sy + 11], fill=spot)
    eye(d, 315, 508, 56, iris=(120, 70, 40))
    eye(d, 437, 513, 52, iris=(120, 70, 40))
    smile(d, 377, 603, 46, 28)
    cheeks(d, [(262, 594), (497, 600)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)

def ndimage_dilate(mask, r):
    from scipy import ndimage
    return ndimage.binary_dilation(mask, iterations=r)


def krab_baby(out, route_json=None):
    """Krab Tvrdak as a hatchling: a rounder shell, exactly seven small rim spikes, short eye
    stalks with big eyes, small raised claws and three stubby legs per side."""
    img, d = canvas()
    red, cream, spike, leg = (226, 62, 48), (247, 230, 192), (252, 248, 236), (236, 104, 58)
    cx, cy, rx, ry = 664, 760, 290, 240
    for side in (-1, 1):
        for k in range(3):
            x0 = cx + side * (170 + 48 * k)
            thick_path(d, [(x0, cy + 120), (x0 + side * (60 + 22 * k), cy + 210), (x0 + side * (80 + 30 * k), cy + 265)], 54, 44, leg)
    for side in (-1, 1):
        thick_path(d, [(cx + side * 250, cy - 40), (cx + side * 330, cy - 130), (cx + side * 370, 575)], 58, 54, leg)
        ccx, ccy = cx + side * 385, 500
        d.ellipse([ccx - 82, ccy - 74, ccx + 82, ccy + 74], fill=red)
        d.polygon([(ccx, ccy), (ccx + side * 14, ccy - 88), (ccx + side * 88, ccy - 34)], fill=GREY)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=red)
    d.ellipse([cx - 228, cy + 52, cx + 228, cy + 226], fill=cream)
    for k in range(7):
        a = math.radians(162 - k * (144 / 6))
        bx, by = cx + rx * math.cos(a), cy - ry * math.sin(a)
        nx, ny = math.cos(a) * ry, -math.sin(a) * rx
        n = math.hypot(nx, ny)
        nx, ny = nx / n, ny / n
        tx, ty = -ny, nx
        d.polygon([(bx - tx * 32, by - ty * 32), (bx + nx * 76, by + ny * 76), (bx + tx * 32, by + ty * 32)], fill=spike)
    for ex in (600, 728):
        d.line([(ex + (10 if ex < 664 else -10), 540), (ex, 380)], fill=red, width=36)
        eye(d, ex, 350, 64)
    smile(d, cx, 690, 62, 36)
    cheeks(d, [(560, 700), (768, 700)], r=30)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def meduzka_baby(out, route_json=None):
    """Meduzka Mekulka as a hatchling: a big round bell, big eyes and exactly nine short, chubby,
    clearly separated tentacles, each with one curl at the tip."""
    img, d = canvas()
    cols = [(246, 150, 192), (192, 160, 238), (250, 188, 150)]
    for k in range(9):
        u = (k - 4) / 4.0
        x0 = 664 + u * 262
        length = 290 - 50 * abs(u)
        spread = u * 230
        pts = []
        for t in np.linspace(0, 1, 10):
            x = x0 + spread * t ** 1.3 + 14 * math.sin(t * 4.2 + k * 0.9) * (0.3 + t)
            pts.append((x, 625 + length * t))
        thick_path(d, pts, 46, 34, cols[k % 3], samples=10)
        tx, ty = pts[-1]
        side = -1 if u < 0 else 1
        curl = [(tx + side * 28 * math.cos(a) - side * 28, ty + 28 * math.sin(a)) for a in np.linspace(0, math.pi * 1.4, 8)]
        thick_path(d, [(tx, ty)] + curl, 34, 26, cols[k % 3], samples=6)
    bell = [(664 + 300 * math.cos(a), 610 - 280 * math.sin(a)) for a in np.linspace(0, math.pi, 50)]
    scallop = [(364 + 600 * t, 625 + 16 * math.sin(t * math.pi * 10)) for t in np.linspace(0, 1, 60)]
    d.polygon(bell + scallop, fill=(240, 178, 222))
    d.ellipse([460, 380, 620, 470], fill=(250, 214, 238))
    eye(d, 582, 520, 64)
    eye(d, 746, 520, 64)
    smile(d, 664, 588, 46, 30)
    cheeks(d, [(496, 590), (832, 590)], r=30)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def zelva_baby(out, route_json=None):
    """Zelva Obojka as a hatchling, facing left like her master: a big round head, a small domed
    shell tiled by exactly eight plates (four columns, two rows) and short paddle flippers."""
    img, d = canvas()
    skin, cream, rim = (118, 204, 150), (246, 232, 168), (178, 108, 52)
    plates = [np.array((226, 156, 72)), np.array((242, 190, 96))]
    thick_path(d, [(1010, 730), (1110, 770), (1170, 790)], 96, 56, skin)      # rear flippers
    thick_path(d, [(940, 790), (990, 880), (1010, 930)], 96, 56, skin)
    thick_path(d, [(690, 790), (650, 880), (635, 925)], 100, 58, skin)        # lower front flipper
    d.ellipse([590, 700, 1040, 850], fill=cream)                              # belly plate
    cx, cy, rx, ry = 820, 630, 270, 205
    d.ellipse([cx - rx - 18, cy - ry - 18, cx + rx + 18, cy + ry + 18], fill=rim)
    arr = np.asarray(img).copy()
    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
    ny = (yy - cy) / ry
    inside = ((xx - cx) / rx) ** 2 + ny ** 2 <= 1.0
    half = np.sqrt(np.clip(1 - ny ** 2, 1e-6, 1))
    nx = (xx - cx) / (rx * half)
    col = np.clip(((nx + 1) / 2 * 4).astype(int), 0, 3)
    row = (ny + 0.12 * (1 - nx ** 2) > 0.0).astype(int)
    cell = col + 4 * row
    for k in range(8):
        arr[inside & (cell == k)] = plates[(k + k // 4) % 2]
    edge = np.zeros_like(inside)
    edge[1:, :] |= cell[1:, :] != cell[:-1, :]
    edge[:, 1:] |= cell[:, 1:] != cell[:, :-1]
    edge = ndimage_dilate(edge & inside, 5)
    arr[edge & inside] = PLUM
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=PLUM, width=10)
    thick_path(d, [(600, 710), (460, 740), (330, 725)], 120, 64, skin)       # front flipper, forward
    thick_path(d, [(600, 600), (560, 585), (520, 570)], 150, 140, skin)     # short thick neck
    d.ellipse([215, 340, 555, 660], fill=skin)                              # big round head
    eye(d, 326, 482, 58, iris=(120, 70, 40))
    eye(d, 446, 488, 54, iris=(120, 70, 40))
    smile(d, 386, 578, 46, 28)
    cheeks(d, [(274, 566), (502, 572)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def title(out, route_json=None):
    """Title background: open water for the title at the top, the Great Shell glowing with pearls at
    the bottom centre, coral frames, open water left and right for character cut-outs, a far ink cloud."""
    rng = random.Random(77)
    img = vertical_gradient((150, 228, 240), (40, 140, 180))
    d = ImageDraw.Draw(img)
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(380, 110), (700, 90), (1000, 130), (1260, 90)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.1, H * 0.7)], fill=(255, 255, 230, 46))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(16))).convert("RGB")
    d = ImageDraw.Draw(img)
    sand = [(0, H)] + [(x, int(H * 0.84 + 14 * math.sin(x / 120.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(sand, fill=(236, 214, 160))
    blob(d, 832, 850, 260, 70, (226, 200, 146), rng, n=16, jitter=0.08)          # sandy mound
    # the Great Shell: an open scallop, lower half and fanned upper lid, pearls inside
    d.pieslice([592, 640, 1072, 900], 0, 180, fill=(250, 226, 236))
    d.pieslice([612, 470, 1052, 830], 180, 360, fill=(246, 212, 228))
    for k in range(9):
        a = math.radians(190 + k * 20)
        d.line([(832, 650), (832 + 210 * math.cos(a), 650 + 170 * math.sin(a))], fill=(232, 186, 206), width=8)
    for x, y, r, c in [(760, 730, 34, (255, 255, 250)), (830, 715, 40, (255, 236, 244)), (905, 732, 32, (255, 230, 170)),
                       (720, 760, 24, (255, 248, 236)), (950, 765, 24, (255, 255, 250)), (868, 768, 28, (255, 214, 226))]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([560, 520, 1104, 900], fill=(255, 250, 220, 70))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(40))).convert("RGB")
    d = ImageDraw.Draw(img)
    for cx, col in [(110, (255, 122, 168)), (250, (255, 157, 77)), (1440, (167, 123, 224)), (1570, (255, 122, 168))]:
        for i in range(4):
            x = cx + rng.randint(-90, 90)
            h = rng.randint(120, 260)
            d.ellipse([x - 26, H * 0.86 - h, x + 26, H * 0.86], fill=col)
            d.ellipse([x - 46, H * 0.86 - h - 28, x + 6, H * 0.86 - h + 24], fill=col)
    for x in [60, 330, 1330, 1620]:
        d.line([(x, H), (x + 30, H * 0.4), (x - 10, H * 0.12)], fill=(64, 160, 96), width=22)
    blob(d, 1480, 820, 120, 50, (70, 56, 96), rng, n=14, jitter=0.25)               # far ink cloud, small
    img.filter(ImageFilter.GaussianBlur(1.2)).save(out)


def moray2(out, route_json=None):
    """Murena Mumla v5: a real moray build. The body is as thick as the head (no neck), the head is
    long and blunt with a small high eye, tube nostrils and a long gaping mouth; one fin crest runs
    from behind the head along the back; the flat tail tip pokes out of a crack on the right."""
    S = 1328
    img = Image.new("RGB", (S, S), (200, 200, 200))
    d = ImageDraw.Draw(img)
    rng = random.Random(75)
    green, spot, fin, ink, plum = (150, 210, 70), (250, 225, 70), (255, 125, 80), (25, 18, 40), (70, 30, 60)
    blob(d, 820, 1060, 440, 240, (150, 135, 140), rng, n=22, jitter=0.06)          # boulder
    blob(d, 470, 1235, 80, 42, (135, 122, 128), rng, n=10, jitter=0.15)
    blob(d, 1190, 1240, 70, 40, (135, 122, 128), rng, n=10, jitter=0.15)
    blob(d, 640, 990, 175, 160, (35, 25, 50), rng, n=16, jitter=0.05)              # hole
    d.polygon([(1080, 880), (1110, 790), (1160, 700), (1225, 640), (1275, 625), (1282, 665), (1250, 730),
               (1200, 810), (1150, 885)], fill=green)                              # tail tip
    d.line([(1110, 790), (1160, 700), (1225, 640), (1275, 625), (1282, 665)], fill=fin, width=22)
    blob(d, 1112, 885, 52, 32, (35, 25, 50), rng, n=10, jitter=0.1)
    spine = [(640, 1060), (640, 900), (610, 760), (540, 640), (450, 560), (380, 520)]
    path = catmull_rom(spine, samples=30)
    for i, (x, y) in enumerate(path):                                             # fin crest on the back
        if i < 12:
            continue
        t = i / len(path)
        nx, ny = 0.75, -0.65
        r = 130 + 10 * t
        fx, fy = x + nx * r, y + ny * r * 0.8
        d.ellipse([fx - 26, fy - 26, fx + 26, fy + 26], fill=fin)
    for x, y in path:                                                             # thick body, no neck
        d.ellipse([x - 128, y - 128, x + 128, y + 128], fill=green)
    d.ellipse([430, 1080, 850, 1190], fill=(150, 135, 140))                       # near lip of the hole
    head = [(470, 400), (400, 350), (300, 340), (210, 365), (160, 410), (150, 455), (165, 480),
            (390, 505), (175, 520), (200, 580), (300, 640), (420, 660), (520, 640), (560, 560), (540, 470)]
    d.polygon(head, fill=green)                                                   # long blunt head
    d.polygon([(165, 480), (400, 505), (180, 520)], fill=(170, 50, 80))            # long gaping mouth
    d.polygon([(175, 520), (395, 507), (300, 600), (210, 585)], fill=(140, 40, 70))
    for x in (205, 250, 295, 340):                                                # small blunt teeth
        d.rounded_rectangle([x, 484 + (x - 205) // 12, x + 20, 504 + (x - 205) // 12], radius=6, fill=(255, 255, 245))
        d.rounded_rectangle([x + 8, 520, x + 26, 538], radius=6, fill=(255, 255, 245))
    for x, y in [(168, 405), (192, 388)]:                                          # tube nostrils
        d.rounded_rectangle([x - 9, y - 30, x + 9, y + 2], radius=8, fill=(130, 190, 60))
    d.ellipse([268, 375, 328, 435], fill=(255, 215, 40))                          # small high eye
    d.ellipse([284, 392, 312, 420], fill=(20, 15, 25))
    d.line([(350, 362), (260, 380)], fill=plum, width=20)                         # low frowning brow
    d.ellipse([430, 560, 452, 582], fill=(40, 70, 30))                            # gill hole
    for x, y, r in [(480, 420, 15), (380, 600, 13), (520, 560, 14), (600, 720, 16), (560, 650, 13),
                    (650, 850, 15), (600, 820, 13), (690, 930, 14), (470, 470, 12), (1210, 730, 12)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=spot)
    for x, y, rx, ry in [(420, 380, 60, 30), (590, 690, 75, 85), (660, 930, 60, 60)]:   # magic ink
        blob(d, x, y, rx, ry, ink, rng, n=12, jitter=0.25)
    for x, y0, y1 in [(405, 405, 470), (585, 760, 840), (655, 980, 1040)]:
        d.line([(x, y0), (x, y1)], fill=ink, width=16)
        d.ellipse([x - 13, y1 - 13, x + 13, y1 + 13], fill=ink)
    for x, y, r in [(120, 330, 16), (95, 280, 10), (130, 240, 8)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=ink)
    img.filter(ImageFilter.GaussianBlur(1.0)).save(out)


def map3b(out, route_json=None):
    """Grade-3 sea map laid out on the shell's REGION_SPOTS (src/app/game/map.ts, thousandths):
    each place is painted as a ring of features around a calm, open patch of water where the
    region marker card sits; a pale sandy trail links the patches in region order."""
    rng = random.Random(311)
    spots = [("sunny-lagoon", 150, 790), ("coral-reef", 360, 660), ("kelp-forest", 200, 430),
             ("pirate-wreck", 460, 330), ("pearl-bay", 650, 560), ("volcanic-vents", 800, 360),
             ("ice-sea", 860, 140)]
    P = {k: (x * W / 1000, y * H / 1000) for k, x, y in spots}
    img = vertical_gradient((112, 206, 222), (70, 176, 204))
    d = ImageDraw.Draw(img)
    for _ in range(26):                                                      # deeper and shallower water
        blob(d, rng.randint(0, W), rng.randint(0, H), rng.randint(60, 160), rng.randint(30, 80),
             (96, 190, 214) if rng.random() < 0.5 else (126, 216, 228), rng, jitter=0.3)
    route = catmull_rom([P[k] for k, _, _ in spots], samples=28)
    d.line(route, fill=(206, 186, 140), width=40, joint="curve")
    d.line(route, fill=(246, 234, 200), width=28, joint="curve")
    rx, ry = 108, 74                                                         # the marker card's clearing
    for k, (cx, cy) in P.items():
        d.ellipse([cx - rx - 26, cy - ry - 22, cx + rx + 26, cy + ry + 22], fill=(236, 220, 172))  # sandy rim
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(134, 222, 228))                    # calm water
    # sunny lagoon: pink and orange corals on the outer side (left and below)
    cx, cy = P["sunny-lagoon"]
    for ax, ay, c in [(-150, -30, (255, 122, 168)), (-140, 60, (255, 157, 77)), (-60, 105, (255, 122, 168)),
                      (60, 108, (255, 205, 90)), (-170, -95, (167, 123, 224))]:
        blob(d, cx + ax, cy + ay, 34, 28, c, rng)
    # coral reef: a dense ring of colourful corals below and to the right
    cx, cy = P["coral-reef"]
    for i in range(11):
        a = math.radians(-40 + i * 22)
        blob(d, cx + math.cos(a) * 150, cy + math.sin(a) * 105, 30, 26,
             [(255, 122, 168), (255, 157, 77), (167, 123, 224), (255, 205, 90)][i % 4], rng)
    # kelp forest: tall kelp to the left of its clearing and a few stalks to the right
    cx, cy = P["kelp-forest"]
    for i in range(6):
        x = cx - 250 + i * 22 + rng.randint(-6, 6)
        d.line([(x, cy + 80), (x + rng.randint(-20, 20), cy - 160)], fill=(40, 130, 80), width=16)
    for i in range(3):
        x = cx + 150 + i * 22
        d.line([(x, cy + 50), (x + rng.randint(-15, 15), cy - 100)], fill=(52, 146, 90), width=14)
    # pirate wreck: the ship lies on the sand to the upper left of its clearing
    cx, cy = P["pirate-wreck"]
    d.polygon([(cx - 250, cy - 40), (cx - 110, cy - 120), (cx - 80, cy - 90), (cx - 220, cy - 5)], fill=(130, 84, 52))
    d.line([(cx - 170, cy - 75), (cx - 200, cy - 200)], fill=(110, 70, 45), width=10)
    blob(d, cx - 160, cy - 30, 120, 40, (236, 220, 172), rng)
    # pearl bay: giant open shells with pearls to the right and below
    cx, cy = P["pearl-bay"]
    for ax, ay in [(170, 10), (140, 100), (40, 125)]:
        blob(d, cx + ax, cy + ay, 46, 32, (250, 232, 240), rng)
        d.ellipse([cx + ax - 10, cy + ay - 8, cx + ax + 10, cy + ay + 12], fill=(255, 255, 250))
    # volcanic vents: dark rocks with glowing vents to the right and below
    cx, cy = P["volcanic-vents"]
    for ax, ay in [(160, 40), (120, 120), (40, 140)]:
        blob(d, cx + ax, cy + ay, 60, 44, (88, 70, 80), rng)
        d.ellipse([cx + ax - 12, cy + ay - 40, cx + ax + 12, cy + ay - 18], fill=(255, 120, 50))
    # ice sea: ice floes around, mostly above and to the right
    cx, cy = P["ice-sea"]
    for ax, ay in [(-170, -40), (-140, 60), (150, 70), (40, -110), (-60, -105)]:
        blob(d, cx + ax, cy + ay, 64, 34, (245, 252, 255), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "spotsThousandths": {k: [x, y] for k, x, y in spots},
                       "clearingPx": [rx, ry], "route": [[round(x, 1), round(y, 1)] for x, y in route]}, f, indent=1)


def lagoon2(out, route_json=None):
    """Slunna laguna scene laid out on the shell's levelSpots(7): a clear diagonal band of water
    and sand from the bottom left up to Murena's lair at the top right; corals and kelp fill the
    top-left and bottom-right corners, away from the level nodes."""
    rng = random.Random(41)
    n = 7
    nodes = []
    for i in range(n):
        share = i / (n - 1)
        zig = -1 if i % 2 == 0 else 1
        nodes.append(((110 + share * 780) * W / 1000, (760 - share * 520 + zig * 70) * H / 1000))
    img = vertical_gradient((150, 226, 240), (40, 140, 186))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(420, 110), (720, 90), (1000, 120)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.4, H * 0.75), (x0 + w * 1.2, H * 0.75)], fill=(255, 255, 230, 44))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    # sandy floor rising gently from the bottom left toward the right
    floor = [(0, H)] + [(x, int(H * 0.80 - 0.10 * H * x / W + 12 * math.sin(x / 130.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(238, 214, 160))
    # Murena's lair: a rounded reef rock at the right edge with a dark hole, below the monster node
    mx, my = nodes[-1]
    blob(d, mx + 60, my + 250, 230, 170, (150, 135, 140), rng, n=18, jitter=0.08)
    blob(d, mx - 10, my + 205, 70, 62, (35, 25, 50), rng, n=14, jitter=0.08)
    # top-left: a rock ledge with kelp and a sea fan, away from the nodes
    blob(d, 120, 300, 200, 130, (120, 112, 140), rng, n=16, jitter=0.12)
    for x in [40, 90, 150, 210, 270]:
        d.line([(x, 420), (x + rng.randint(-30, 30), 120), (x + rng.randint(-20, 20), 10)], fill=(64, 160, 96), width=20)
    blob(d, 330, 330, 60, 80, (167, 123, 224), rng)
    # bottom-right: a lush coral garden in the foreground
    for i in range(9):
        x = 1150 + i * 60 + rng.randint(-20, 20)
        h = rng.randint(110, 230)
        col = [(255, 122, 168), (255, 157, 77), (167, 123, 224)][i % 3]
        d.ellipse([x - 28, H - 40 - h, x + 28, H - 20], fill=col)
        d.ellipse([x - 50, H - 70 - h, x + 8, H - 10 - h], fill=col)
    blob(d, 1400, 880, 140, 50, (255, 205, 90), rng)
    # bottom-left corner: only a few shells and pebbles on the sand
    for x, y in [(60, 880), (300, 900), (520, 870)]:
        blob(d, x, y, 22, 14, (250, 236, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


INK, INK_MID, INK_HI, INK_HI2 = (44, 34, 96), (78, 64, 140), (96, 130, 230), (150, 110, 220)
INK_CHEEK, MOUTH, TONGUE = (150, 80, 150), (60, 20, 50), (232, 120, 150)


def stamp_path(d, pts, w0, w1, color, outline=None, step=5.0, chunk=24):
    """A thick line along straight segments with round joins (sharp-but-rounded bends), tapering
    from w0 to w1. With an outline colour it is laid in chunks, each outlined and then filled (the
    fill reaching back over the previous chunk's joint), so where the line crosses itself the later
    part passes over the earlier one with its outline, and the joints show no seam."""
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg)
    walked = 0.0
    stamps = []
    for (x0, y0), (x1, y1), length in zip(pts, pts[1:], seg):
        n = max(1, int(length / step))
        for i in range(n):
            f = i / n
            stamps.append((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (w0 + (w1 - w0) * (walked + length * f) / total) / 2))
        walked += length
    stamps.append((pts[-1][0], pts[-1][1], w1 / 2))
    if not outline:
        for x, y, r in stamps:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)
        return
    back = int(max(w0, w1) / 2 / step) + 6
    for start in range(0, len(stamps), chunk):
        part = stamps[start:start + chunk]
        for x, y, r in part:
            d.ellipse([x - r - 13, y - r - 13, x + r + 13, y + r + 13], fill=outline)
        for x, y, r in stamps[max(0, start - back):start + chunk]:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)

def open_mouth(d, cx, cy, w, h):
    d.ellipse([cx - w - 8, cy - h - 8, cx + w + 8, cy + h + 8], fill=PLUM)
    d.ellipse([cx - w, cy - h, cx + w, cy + h], fill=MOUTH)
    d.ellipse([cx - w * 0.6, cy + h * 0.15, cx + w * 0.6, cy + h * 0.95], fill=TONGUE)


def inkoustik_smouha(out, route_json=None):
    """Šmouha: a soft, sleepy, cloud-like smudge of ink, clearly wider than tall, with a wavy
    scalloped outline, lighter rubbed streaks, heavy half-closed eyes and a big lazy yawn."""
    img, d = canvas()
    puffs = [(360, 730, 150), (480, 620, 190), (660, 570, 215), (850, 615, 190), (980, 720, 150),
             (560, 800, 170), (780, 800, 170)]
    for x, y, r in puffs:
        d.ellipse([x - r - 13, y - r - 13, x + r + 13, y + r + 13], fill=PLUM)
    d.rounded_rectangle([340 - 13, 700 - 13, 1000 + 13, 900 + 13], radius=100, fill=PLUM)
    for x, y, r in puffs:
        d.ellipse([x - r, y - r, x + r, y + r], fill=INK_MID)
    d.rounded_rectangle([340, 700, 1000, 900], radius=90, fill=INK_MID)
    for x0, y0, x1 in ((380, 860, 620), (700, 870, 940), (420, 760, 520), (860, 760, 950)):
        d.line([(x0, y0), (x1, y0 - 10)], fill=(120, 110, 170), width=26)
    d.ellipse([500, 470, 600, 520], fill=INK_HI2)
    for ex in (565, 765):
        ey, r = 650, 62
        d.ellipse([ex - r - 8, ey - r - 8, ex + r + 8, ey + r + 8], fill=PLUM)
        d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(255, 255, 255))
        d.ellipse([ex - 30, ey - 2, ex + 30, ey + 50], fill=(25, 18, 30))
        d.pieslice([ex - r - 2, ey - r - 2, ex + r + 2, ey + r + 2], 180, 360, fill=INK_MID)
        d.rectangle([ex - r - 2, ey - 4, ex + r + 2, ey + 6], fill=INK_MID)
        d.line([(ex - r - 6, ey + 4), (ex + r + 6, ey + 4)], fill=PLUM, width=12)
    open_mouth(d, 665, 800, 74, 62)
    cheeks(d, [(470, 760), (860, 760)], r=34)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def inkoustik_cmara(out, route_json=None):
    """Čmára: a quick zigzag scribble of ink, a thick line with exactly four sharp-but-rounded
    bends, her round head at the top end with an excited face, speed marks and ink flecks."""
    img, d = canvas()
    pts = [(610, 360), (870, 580), (500, 750), (850, 910), (520, 1070), (760, 1190)]
    stamp_path(d, pts, 190, 80, INK, outline=PLUM)
    d.ellipse([610 - 175 - 13, 330 - 165 - 13, 610 + 175 + 13, 330 + 165 + 13], fill=PLUM)
    d.ellipse([610 - 175, 330 - 165, 610 + 175, 330 + 165], fill=INK)
    for (x0, y0), (x1, y1) in zip(pts[1:], pts[2:]):
        d.line([(x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25 - 40), (x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6 - 40)], fill=INK_HI, width=16)
    d.ellipse([500, 210, 580, 250], fill=INK_HI2)
    eye(d, 545, 320, 62)
    eye(d, 685, 320, 58)
    open_mouth(d, 615, 425, 42, 34)
    cheeks(d, [(480, 410), (760, 410)], r=26)
    for (x0, y0), (x1, y1) in (((250, 520), (380, 505)), ((230, 700), (360, 690)), ((270, 880), (390, 872))):
        d.line([(x0, y0), (x1, y1)], fill=PLUM, width=16)
    for x, y, r in ((420, 610, 18), (390, 820, 14), (430, 990, 20), (1000, 700, 16), (980, 1000, 12)):
        d.ellipse([x - r - 6, y - r - 6, x + r + 6, y + r + 6], fill=PLUM)
        d.ellipse([x - r, y - r, x + r, y + r], fill=INK)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def inkoustik_klikyhak(out, route_json=None):
    """Klikyhák: a round head at the top and a thick ink line below it curling into exactly three
    bouncy loops like a spring, ending in a little tapered tail; laughing, eyes squeezed shut."""
    img, d = canvas()
    R, v, cx = 150, 30, 665
    ts = [i * 0.05 for i in range(int(6.6 * math.pi / 0.05))]
    pts = [(cx + R * math.sin(t), 640 + v * t - R * math.cos(t)) for t in ts]
    stamp_path(d, pts, 104, 52, INK, outline=PLUM, step=4.0)
    for t in (0.6, 0.6 + 2 * math.pi, 0.6 + 4 * math.pi):
        x, y = cx + R * math.sin(t), 640 + v * t - R * math.cos(t)
        d.ellipse([x - 26, y - 34, x + 6, y - 14], fill=INK_HI)
    d.ellipse([cx - 165 - 13, 330 - 160 - 13, cx + 165 + 13, 330 + 160 + 13], fill=PLUM)
    d.ellipse([cx - 165, 330 - 160, cx + 165, 330 + 160], fill=INK)
    d.ellipse([560, 200, 640, 240], fill=INK_HI2)
    for ex in (600, 730):
        d.arc([ex - 44, 290, ex + 44, 360], 200, 340, fill=PLUM, width=16)
    d.chord([600, 360, 730, 470], 0, 180, fill=PLUM)
    d.chord([610, 366, 720, 460], 0, 180, fill=MOUTH)
    d.ellipse([635, 410, 695, 456], fill=TONGUE)
    cheeks(d, [(545, 390), (785, 390)], r=28)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)

def inkoustik_klikyhak2(out, route_json=None):
    """Klikyhák v2: v1's spring ran off the bottom edge; this one is tighter and higher, so the
    whole character, three loops and the tapered tail, sits inside the frame with a margin."""
    img, d = canvas()
    R, v, cx, y0 = 135, 26, 665, 600
    ts = [i * 0.05 for i in range(int(6.6 * math.pi / 0.05))]
    pts = [(cx + R * math.sin(t), y0 + v * t - R * math.cos(t)) for t in ts]
    stamp_path(d, pts, 100, 50, INK, outline=PLUM, step=4.0)
    for t in (0.6, 0.6 + 2 * math.pi, 0.6 + 4 * math.pi):
        x, y = cx + R * math.sin(t), y0 + v * t - R * math.cos(t)
        d.ellipse([x - 26, y - 34, x + 6, y - 14], fill=INK_HI)
    d.ellipse([cx - 160 - 13, 320 - 155 - 13, cx + 160 + 13, 320 + 155 + 13], fill=PLUM)
    d.ellipse([cx - 160, 320 - 155, cx + 160, 320 + 155], fill=INK)
    d.ellipse([560, 195, 640, 235], fill=INK_HI2)
    for ex in (600, 730):
        d.arc([ex - 44, 280, ex + 44, 350], 200, 340, fill=PLUM, width=16)
    d.chord([600, 350, 730, 460], 0, 180, fill=PLUM)
    d.chord([610, 356, 720, 450], 0, 180, fill=MOUTH)
    d.ellipse([635, 400, 695, 446], fill=TONGUE)
    cheeks(d, [(545, 380), (785, 380)], r=28)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)

if __name__ == "__main__":
    name, out = sys.argv[1], sys.argv[2]
    rj = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--route-json" else None
    {"map-grade3": map3, "map-grade3b": map3b, "lagoon2": lagoon2, "grotto": grotto, "moray": moray,
     "moray2": moray2, "krab": krab, "meduzka": meduzka, "meduzka2": meduzka2, "zelva": zelva,
     "zelva2": zelva2, "osmicka": osmicka, "title": title, "plain-grey": plain_grey,
     "krab-baby": krab_baby, "meduzka-baby": meduzka_baby, "zelva-baby": zelva_baby,
     "avatars": avatars, "zelva-baby2": zelva_baby2, "smouha": inkoustik_smouha, "cmara": inkoustik_cmara,
     "klikyhak": inkoustik_klikyhak, "klikyhak2": inkoustik_klikyhak2}[name](out, rj)
    print(out)
