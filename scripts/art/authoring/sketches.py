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

def mroz(out, route_json=None):
    """Mrož Vousáč, the walrus captain who keeps U Mrože: plump and sitting upright, facing the
    viewer, waving with one front flipper; a captain's cap with a gold badge, a huge bushy
    moustache, exactly two short blunt tusks, small kind eyes, a small shop apron with a pocket."""
    img, d = canvas()
    skin, belly, muzzle = (196, 134, 104), (222, 170, 138), (236, 206, 176)
    stache, tusk = (250, 244, 232), (246, 240, 220)
    cap, band, visor, gold = (242, 242, 248), (40, 62, 120), (34, 36, 52), (242, 192, 64)
    apron, pocket = (72, 170, 180), (112, 198, 206)
    paddle(d, (560, 1150), (400, 1232), 120, skin, bend=-0.08)                    # hind flippers
    paddle(d, (768, 1150), (928, 1232), 120, skin, bend=0.08)
    paddle(d, (900, 760), (1010, 990), 130, skin, bend=-0.10)                      # resting front flipper
    d.ellipse([664 - 330 - 12, 520 - 12, 664 + 330 + 12, 1210 + 12], fill=PLUM)    # body
    d.ellipse([664 - 330, 520, 664 + 330, 1210], fill=skin)
    d.ellipse([664 - 230, 640, 664 + 230, 1170], fill=belly)
    paddle(d, (440, 760), (300, 520), 130, skin, bend=0.12)                        # waving front flipper
    d.rounded_rectangle([520 - 10, 806 - 10, 808 + 10, 1090 + 10], radius=70, fill=PLUM)   # apron
    d.rounded_rectangle([520, 806, 808, 1090], radius=60, fill=apron)
    d.rectangle([430, 798, 898, 828], fill=apron)                                  # apron ties at the waist
    d.rounded_rectangle([606, 920, 722, 1006], radius=18, fill=pocket, outline=PLUM, width=8)
    d.ellipse([664 - 240 - 12, 300 - 12, 664 + 240 + 12, 690 + 12], fill=PLUM)     # head
    d.ellipse([664 - 240, 300, 664 + 240, 690], fill=skin)
    for cx in (604, 724):                                                          # whisker pad
        d.ellipse([cx - 92, 520, cx + 92, 650], fill=muzzle)
    for x, y in ((560, 590), (590, 620), (630, 600), (700, 600), (738, 620), (768, 590)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(150, 104, 86))
    for cx in (620, 708):                                                          # two short blunt tusks
        d.polygon([(cx - 22, 620), (cx + 22, 620), (cx + 13, 770), (cx - 13, 770)], fill=PLUM)
        d.polygon([(cx - 16, 622), (cx + 16, 622), (cx + 8, 762), (cx - 8, 762)], fill=tusk)
        d.ellipse([cx - 14, 748, cx + 14, 776], fill=PLUM)
        d.ellipse([cx - 9, 746, cx + 9, 768], fill=tusk)
    d.arc([632, 610, 696, 652], 20, 160, fill=PLUM, width=9)                       # a small smile
    puffs = [(522, 548, 46), (566, 528, 54), (620, 520, 58), (664, 526, 56), (708, 520, 58),
             (762, 528, 54), (806, 548, 46), (590, 566, 48), (738, 566, 48)]
    for x, y, r in puffs:                                                          # the huge moustache
        d.ellipse([x - r - 9, y - r - 9, x + r + 9, y + r + 9], fill=PLUM)
    for x, y, r in puffs:
        d.ellipse([x - r, y - r, x + r, y + r], fill=stache)
    for x in (644, 684):                                                           # nostrils on top
        d.ellipse([x - 9, 470, x + 9, 484], fill=(110, 70, 60))
    eye(d, 594, 430, 24)
    eye(d, 734, 430, 24)
    for x, s in ((566, -1), (762, 1)):                                             # smile crinkles
        d.arc([x + s * 6 - 18, 410, x + s * 6 + 18, 446], 300 if s > 0 else 120, 60 if s > 0 else 240, fill=PLUM, width=6)
    cheeks(d, [(530, 488), (798, 488)], r=28)
    d.ellipse([664 - 190 - 10, 168 - 10, 664 + 190 + 10, 330 + 10], fill=PLUM)    # captain's cap
    d.ellipse([664 - 190, 168, 664 + 190, 330], fill=cap)
    d.rounded_rectangle([664 - 168, 276, 664 + 168, 340], radius=20, fill=band, outline=PLUM, width=8)
    d.chord([664 - 176, 300, 664 + 176, 392], 0, 180, fill=visor)
    d.ellipse([640, 278, 688, 326], fill=gold, outline=PLUM, width=5)
    d.line([(664, 288), (664, 318)], fill=band, width=6)                            # an anchor on the badge
    d.line([(652, 296), (676, 296)], fill=band, width=5)
    d.arc([648, 298, 680, 320], 20, 160, fill=band, width=5)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)

def region_nodes(n=7):
    """The shell's levelSpots(n) (src/app/game/map.ts) in scene pixels."""
    nodes = []
    for i in range(n):
        share = i / (n - 1)
        zig = -1 if i % 2 == 0 else 1
        nodes.append(((110 + share * 780) * W / 1000, (760 - share * 520 + zig * 70) * H / 1000))
    return nodes


def fish_body(d, x0, x1, cy, hmax, top, belly, outline=12, shape=0.5):
    """A fish body from the snout at x0 to the tail base at x1: half-height profile peaking near
    the front, a darker back over a lighter belly, outlined in plum. Returns the profile."""
    xs = np.linspace(x0, x1, 80)
    t = (xs - x0) / (x1 - x0)
    h = hmax * np.clip(t, 0, 1) ** shape * (1.18 - t) / (0.38 ** shape * 0.80)
    h = np.maximum(h, 0.25 * hmax)
    h[0] = 0.0
    top_pts = [(x, cy - hh) for x, hh in zip(xs, h)]
    bot_pts = [(x, cy + hh) for x, hh in zip(xs, h)][::-1]
    d.polygon([(x0 - outline, cy)] + [(x, y - outline) for x, y in top_pts] + [(x1 + outline, cy)]
              + [(x, y + outline) for x, y in bot_pts], fill=PLUM)
    d.polygon(top_pts + bot_pts, fill=belly)
    d.polygon(top_pts + [(x, cy + hh * 0.15) for x, hh in zip(xs, h)][::-1], fill=top)
    return xs, h


def barakuda(out, route_json=None):
    """Barakuda Bystřinka: a slim, sleek barracuda dashing left, the quickest fish of the reef:
    a long silver-blue body with five dark slanted bars, a pointed snout with a cheeky smile and no
    teeth, two small dorsal fins, a forked tail and three speed lines behind her."""
    img, d = canvas()
    cy = 660
    d.polygon([(1030, cy), (1215, 480), (1170, cy), (1215, 840)], fill=PLUM)            # forked tail
    d.polygon([(1048, cy), (1195, 505), (1152, cy), (1195, 815)], fill=(110, 150, 196))
    for xa, xb, hgt in ((690, 790, 90), (900, 960, 60)):                               # dorsal fins
        d.polygon([(xa - 12, cy - 70), (xa + 30, cy - 70 - hgt - 14), (xb + 12, cy - 60)], fill=PLUM)
        d.polygon([(xa, cy - 74), (xa + 32, cy - 70 - hgt), (xb, cy - 64)], fill=(110, 150, 196))
    xs, h = fish_body(d, 200, 1060, cy, 125, (128, 162, 204), (232, 238, 246), shape=0.45)
    for k in range(5):                                                                  # five bars
        x = 520 + k * 105
        hh = float(np.interp(x, xs, h))
        d.polygon([(x, cy - hh + 10), (x + 34, cy - hh + 10), (x + 4, cy + 10), (x - 30, cy + 10)], fill=(66, 88, 132))
    paddle(d, (470, cy + 40), (590, cy + 120), 70, (110, 150, 196), bend=0.1)          # pectoral fin
    eye(d, 330, cy - 40, 46, iris=(70, 110, 170))
    d.arc([222, cy - 6, 300, cy + 40], 10, 150, fill=PLUM, width=10)                   # cheeky smile
    cheeks(d, [(360, cy + 30)], r=24)
    for y in (cy - 90, cy, cy + 90):                                                   # speed lines
        d.line([(1240, y), (1310, y)], fill=PLUM, width=14)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def lachtan(out, route_json=None):
    """Lachtan Lyžař: a cheerful sea lion skiing down a wave, facing right: a smooth brown body
    leaning forward, small ear flaps (a sea lion, not a seal), whisker dots, two front flippers each
    holding one ski pole, two hind flippers on exactly two red skis with curled tips, a curling
    teal wave with white foam under the skis."""
    img, d = canvas()
    fur, light, muzzle = (150, 108, 78), (204, 162, 122), (222, 190, 152)
    wave = [(220, 1240), (260, 1150), (420, 1110), (700, 1120), (960, 1100), (1090, 1050), (1130, 1120),
            (1080, 1240)]
    d.polygon(wave, fill=(60, 170, 190))
    for x in range(300, 1100, 70):                                                      # foam crest
        d.ellipse([x - 34, 1092 - 18, x + 34, 1092 + 22], fill=(250, 252, 252))
    for y, x0 in ((1020, 330), (1068, 290)):                                            # two skis
        d.rounded_rectangle([x0, y - 20, x0 + 680, y + 20], radius=20, fill=PLUM)
        d.rounded_rectangle([x0 + 7, y - 12, x0 + 673, y + 12], radius=12, fill=(220, 72, 60))
        d.pieslice([x0 + 610, y - 90, x0 + 730, y + 20], 270, 90, fill=PLUM)
        d.pieslice([x0 + 624, y - 74, x0 + 714, y + 8], 270, 90, fill=(220, 72, 60))
    paddle(d, (560, 980), (470, 1040), 110, fur, bend=-0.1)                              # hind flippers
    paddle(d, (690, 990), (780, 1048), 110, fur, bend=0.1)
    stamp_path(d, [(620, 990), (650, 780), (720, 560)], 330, 250, fur, outline=PLUM)    # body
    thick_path(d, [(640, 960), (668, 760), (725, 600)], 190, 140, light)                 # lighter belly
    d.ellipse([740 - 160 - 12, 420 - 150 - 12, 740 + 160 + 12, 420 + 150 + 12], fill=PLUM)  # head
    d.ellipse([740 - 160, 420 - 150, 740 + 160, 420 + 150], fill=fur)
    d.ellipse([820, 430, 940, 530], fill=muzzle)
    d.ellipse([918, 440, 958, 474], fill=(50, 30, 40))                                   # nose
    for x, y in ((860, 492), (890, 504), (920, 496)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(120, 80, 60))
    d.ellipse([622, 352, 668, 392], fill=PLUM)                                           # ear flap
    d.ellipse([628, 358, 662, 386], fill=(120, 84, 60))
    eye(d, 780, 380, 40, iris=(90, 60, 40))
    d.arc([830, 470, 900, 530], 20, 150, fill=PLUM, width=9)
    cheeks(d, [(700, 470)], r=26)
    for (sx, sy), (tx, ty) in (((760, 640), (900, 740)), ((620, 660), (480, 760))):    # front flippers
        paddle(d, (sx, sy), (tx, ty), 110, fur, bend=0.05)
    d.line([(905, 700), (1000, 1110)], fill=PLUM, width=22)                             # ski poles
    d.line([(470, 720), (380, 1110)], fill=PLUM, width=22)
    for x, y in ((995, 1080), (386, 1080)):
        d.ellipse([x - 34, y - 12, x + 34, y + 12], fill=PLUM)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def zralok_inked(out, route_json=None):
    """Žralok Žrout, inked: a chubby, round cartoon shark facing left, grumpy and sulky, soaked in
    magic ink: grey-blue back, white belly, one big dorsal fin, a crescent tail with a bigger top
    lobe, three gill slits, a heavy frowning brow, a wide mouth with small rounded blunt teeth,
    glossy black and violet ink blots and drips over his back and fin."""
    img, d = canvas()
    cy = 680
    d.polygon([(1040, cy), (1230, 380), (1150, cy), (1200, 860)], fill=PLUM)             # tail
    d.polygon([(1062, cy), (1208, 410), (1132, cy), (1180, 830)], fill=(118, 138, 170))
    d.polygon([(520, cy - 210), (760, 300), (700, 340), (840, cy - 170)], fill=PLUM)     # dorsal fin, swept back
    d.polygon([(546, cy - 204), (748, 318), (700, 356), (818, cy - 176)], fill=(118, 138, 170))
    xs, h = fish_body(d, 190, 1070, cy, 250, (118, 138, 170), (238, 240, 244), shape=0.35)
    paddle(d, (560, cy + 120), (700, cy + 290), 120, (118, 138, 170), bend=0.1)          # pectoral fin
    for k in range(3):                                                                    # gill slits
        x = 560 + k * 40
        d.arc([x - 40, cy - 90, x + 40, cy + 70], 300, 60, fill=PLUM, width=10)
    d.chord([230, cy + 40, 520, cy + 200], 180, 360, fill=PLUM)                           # a sulky, downturned mouth
    d.chord([244, cy + 52, 506, cy + 188], 180, 360, fill=(120, 40, 60))
    for k in range(5):                                                                    # small blunt teeth along the top
        x = 300 + k * 38
        d.rounded_rectangle([x, cy + 116 - (8 if k in (1, 2, 3) else 0), x + 24, cy + 140], radius=9, fill=(250, 250, 244))
    eye(d, 400, cy - 70, 46)
    d.line([(330, cy - 150), (470, cy - 110)], fill=PLUM, width=26)                     # frowning brow
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((650, 470, 70, 50, ink), (820, 560, 90, 60, violet), (700, 400, 34, 40, violet),
                            (940, 610, 60, 40, ink), (520, 560, 40, 30, violet)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y0, y1 in ((650, 500, 640), (820, 600, 720), (940, 640, 740)):               # drips
        thick_path(d, [(x, y0), (x + 6, (y0 + y1) / 2), (x, y1)], 30, 18, ink)
        d.ellipse([x - 18, y1 - 6, x + 18, y1 + 26], fill=ink)
    for x, y in ((610, 440), (850, 540)):                                                 # glossy highlights
        d.ellipse([x - 14, y - 8, x + 14, y + 8], fill=(120, 110, 170))
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def reef(out, route_json=None):
    """Korálový útes laid out on the shell's levelSpots(7): the same diagonal band of open water
    and sand as the lagoon; a tall wall of corals fills the top-left corner and the bottom-right
    foreground; Žralok Žrout's lair, a big coral arch with a dark opening, sits below the monster
    node at the top right."""
    rng = random.Random(42)
    nodes = region_nodes()
    img = vertical_gradient((120, 214, 236), (30, 120, 176))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(500, 100), (820, 90), (1100, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 255, 230, 40))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(240, 218, 168))
    mx, my = nodes[-1]                                                                    # the coral arch lair
    blob(d, mx + 150, my + 240, 200, 160, (236, 120, 110), rng, n=18, jitter=0.10)
    blob(d, mx + 110, my + 230, 75, 68, (30, 26, 52), rng, n=14, jitter=0.06)
    for i in range(6):
        a = math.pi * (0.1 + 0.8 * i / 5)
        blob(d, mx + 150 + 185 * math.cos(a), my + 240 - 150 * math.sin(a), 40, 36, (255, 168, 90), rng)
    for x, y, r, c in ((90, 140, 150, (240, 120, 150)), (260, 90, 110, (255, 160, 80)), (110, 360, 120, (170, 120, 220)),
                       (300, 280, 90, (250, 210, 90)), (50, 500, 80, (240, 120, 150))):    # top-left coral wall
        blob(d, x, y, r, r * 0.9, c, rng, n=16, jitter=0.15)
    for x in (380, 440):
        d.line([(x, 420), (x + rng.randint(-20, 20), 180)], fill=(70, 170, 110), width=18)
    for i in range(11):                                                                   # bottom-right foreground
        x = 1050 + i * 58 + rng.randint(-15, 15)
        hgt = rng.randint(120, 250)
        col = [(240, 110, 140), (255, 150, 70), (160, 110, 220), (250, 200, 80)][i % 4]
        d.ellipse([x - 30, H - 40 - hgt, x + 30, H - 10], fill=col)
        d.ellipse([x - 54, H - 76 - hgt, x + 6, H - 16 - hgt], fill=col)
    blob(d, 960, 860, 90, 60, (210, 120, 200), rng)                                       # a brain coral
    for x, y in [(80, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (250, 236, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def banded_path(d, pts, w0, w1, colors, period, outline=PLUM, step=5.0, chunk=24, tail_frac=1.0):
    """stamp_path with bands: the fill alternates through colours every `period` pixels along the
    line, laid chunk by chunk so a self-crossing line keeps its bands and outline on top."""
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg)
    walked = 0.0
    stamps = []
    for (x0, y0), (x1, y1), length in zip(pts, pts[1:], seg):
        n = max(1, int(length / step))
        for i in range(n):
            f = i / n
            s = walked + length * f
            stamps.append((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (w0 + (w1 - w0) * s / total) / 2, s))
        walked += length
    stamps.append((pts[-1][0], pts[-1][1], w1 / 2, total))
    back = int(max(w0, w1) / 2 / step) + 6
    for start in range(0, len(stamps), chunk):
        for x, y, r, _ in stamps[start:start + chunk]:
            d.ellipse([x - r - 13, y - r - 13, x + r + 13, y + r + 13], fill=outline)
        for x, y, r, s in stamps[max(0, start - back):start + chunk]:
            d.ellipse([x - r, y - r, x + r, y + r], fill=colors[int(s // period) % len(colors)])


def soap_bubble(d, cx, cy, r):
    d.ellipse([cx - r - 7, cy - r - 7, cx + r + 7, cy + r + 7], fill=(150, 120, 190))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(226, 240, 250))
    d.arc([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], 200, 290, fill=(255, 170, 210), width=10)
    d.arc([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], 20, 110, fill=(140, 220, 210), width=10)
    d.ellipse([cx - r * 0.55, cy - r * 0.6, cx - r * 0.2, cy - r * 0.25], fill=(255, 255, 255))


def konik(out, route_json=None):
    """Koník Mýdlínek: a cheerful seahorse, upright and facing right, blowing soap bubbles from the
    end of his long tube snout: a sunny yellow-orange body with ridged belly rings, a small crown
    of exactly three knobs on his head, a little fan fin on his back, his tail curled into a
    spiral, and exactly three soap bubbles rising from his snout, small, medium and big."""
    img, d = canvas()
    body, belly = (246, 178, 70), (252, 216, 132)
    stamp_path(d, [(470, 470), (560, 640), (560, 820), (480, 950), (420, 1060), (470, 1150), (560, 1150),
                   (580, 1080), (520, 1050)], 250, 60, body, outline=PLUM)              # body and curled tail

    d.ellipse([560, 560, 660, 820], fill=belly)
    for k in range(5):
        y = 600 + k * 48
        d.line([(570, y), (650, y)], fill=(222, 160, 70), width=7)
    d.pieslice([300, 560, 520, 800], 120, 250, fill=PLUM)                                # back fin
    d.pieslice([314, 574, 506, 786], 120, 250, fill=(255, 150, 120))
    for a in range(130, 250, 24):
        r = math.radians(a)
        d.line([(410, 680), (410 + 92 * math.cos(r), 680 + 112 * math.sin(r))], fill=(220, 110, 90), width=6)
    d.rounded_rectangle([560 - 12, 330 - 12, 880 + 12, 400 + 12], radius=46, fill=PLUM)   # tube snout
    d.rounded_rectangle([560, 330, 880, 400], radius=36, fill=body)
    d.ellipse([850, 318, 920, 412], fill=PLUM)
    d.ellipse([866, 334, 906, 396], fill=(120, 50, 70))                                  # round, blowing mouth
    d.ellipse([470 - 150 - 12, 380 - 140 - 12, 470 + 150 + 12, 380 + 140 + 12], fill=PLUM)  # head
    d.ellipse([470 - 150, 380 - 140, 470 + 150, 380 + 140], fill=body)
    stamp_path(d, [(470, 460), (520, 560)], 200, 210, body)                              # neck under the head
    for x, y in ((390, 238), (460, 214), (530, 232)):                                    # crown of three knobs
        d.ellipse([x - 32, y - 40, x + 32, y + 30], fill=PLUM)
        d.ellipse([x - 22, y - 30, x + 22, y + 20], fill=(255, 196, 90))
    eye(d, 520, 360, 50, iris=(60, 130, 120))
    cheeks(d, [(560, 450)], r=26)
    for x, y, r in ((965, 350, 34), (1050, 278, 50), (1140, 190, 64)):                   # three soap bubbles
        soap_bubble(d, x, y, r)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def pyskoun(out, route_json=None):
    """Pyskoun Pyšný: a real wrasse swimming left, proud and pleased with himself: a long oval
    body in sea green with wavy orange stripes on the head, one long continuous dorsal fin along
    the whole back, a small rounded tail, a long pelvic fin, and very big, thick, glossy pink lips
    puckered forward; his eyes half closed and chin raised in proud self-satisfaction."""
    img, d = canvas()
    cy = 690
    green, belly, fin = (70, 176, 130), (196, 232, 190), (90, 150, 210)
    d.pieslice([1010, cy - 170, 1250, cy + 170], 280, 80, fill=PLUM)                      # rounded tail
    d.pieslice([1026, cy - 152, 1232, cy + 152], 280, 80, fill=fin)
    d.rectangle([1000, cy - 70, 1110, cy + 70], fill=PLUM)
    d.polygon([(440, cy - 175), (520, cy - 270), (1000, cy - 250), (1080, cy - 130), (1020, cy - 90)], fill=PLUM)
    d.polygon([(456, cy - 170), (530, cy - 256), (990, cy - 238), (1060, cy - 132), (1010, cy - 100)], fill=fin)
    for x in range(560, 1000, 70):                                                       # fin rays
        d.line([(x, cy - 160), (x + 10, cy - 240)], fill=(60, 110, 170), width=6)
    xs, h = fish_body(d, 250, 1070, cy, 220, green, belly, shape=0.55)
    for k in range(3):                                                                    # wavy head stripes
        y0 = cy - 120 + k * 70
        pts = [(330 + i * 30, y0 + 16 * math.sin(i * 1.1)) for i in range(9)]
        d.line(pts, fill=(250, 140, 70), width=18, joint="curve")
    paddle(d, (560, cy + 150), (700, cy + 320), 80, fin, bend=0.15)                      # pelvic fin
    paddle(d, (640, cy + 40), (760, cy + 120), 90, fin, bend=0.1)                        # pectoral fin
    d.ellipse([140, cy - 30, 300, cy + 70], fill=PLUM)                                   # big puckered lips
    d.ellipse([152, cy - 18, 288, cy + 24], fill=(242, 110, 150))
    d.ellipse([152, cy + 22, 288, cy + 60], fill=(232, 90, 136))
    d.ellipse([180, cy - 8, 222, cy + 8], fill=(255, 200, 220))
    eye(d, 420, cy - 70, 46, iris=(200, 120, 40))
    d.chord([370, cy - 120, 470, cy - 20], 180, 360, fill=green)                          # proud half-closed lid
    d.line([(372, cy - 70), (468, cy - 70)], fill=PLUM, width=9)
    d.arc([360, cy - 150, 480, cy - 80], 200, 340, fill=PLUM, width=11)                  # raised brow
    cheeks(d, [(360, cy + 40)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def had_inked(out, route_json=None):
    """Mořský had Zamotal, inked: a real sea snake (banded body, small head with nostrils on top,
    a flat paddle-shaped tail) tied up in his own clumsy knot, grumpy and muddled, soaked in magic
    ink: pale grey-blue with dark ink-black bands, glossy violet ink blots and drips, a frowning
    brow, a sulky pout, no fangs and no forked tongue."""
    img, d = canvas()
    pale, band = (170, 184, 204), (40, 34, 58)
    path = [(420, 520), (560, 590), (760, 560), (900, 430), (860, 280), (690, 250), (590, 380), (640, 600),
            (790, 790), (960, 830), (1060, 720), (990, 600), (860, 640), (820, 820), (900, 980), (1040, 1060)]
    banded_path(d, path, 150, 110, [pale, band], 70)
    tx, ty = path[-1]                                                                    # flat paddle tail
    d.polygon([(tx - 40, ty - 50), (tx + 170, ty - 40), (tx + 200, ty + 30), (tx + 30, ty + 70)], fill=PLUM)
    d.polygon([(tx - 26, ty - 36), (tx + 160, ty - 28), (tx + 184, ty + 24), (tx + 30, ty + 56)], fill=pale)
    d.line([(tx + 50, ty - 30), (tx + 60, ty + 52)], fill=band, width=26)
    d.line([(tx + 120, ty - 30), (tx + 130, ty + 40)], fill=band, width=26)
    hx, hy = 330, 500                                                                    # small rounded head
    d.ellipse([hx - 140 - 12, hy - 100 - 12, hx + 120 + 12, hy + 100 + 12], fill=PLUM)
    d.ellipse([hx - 140, hy - 100, hx + 120, hy + 100], fill=pale)
    for x in (hx - 100, hx - 70):                                                        # nostrils on top
        d.ellipse([x - 9, hy - 78, x + 9, hy - 64], fill=PLUM)
    eye(d, hx - 10, hy - 20, 40)
    d.line([(hx - 70, hy - 76), (hx + 40, hy - 54)], fill=PLUM, width=20)                # frowning brow
    d.arc([hx - 120, hy + 30, hx - 30, hy + 80], 200, 340, fill=PLUM, width=11)          # sulky pout
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((760, 540, 60, 40, violet), (880, 360, 50, 36, ink), (700, 770, 60, 40, violet),
                            (1020, 760, 46, 34, ink), (520, 590, 44, 30, violet)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y0, y1 in ((760, 570, 680), (1020, 790, 880)):                                # drips
        thick_path(d, [(x, y0), (x + 6, (y0 + y1) / 2), (x, y1)], 28, 16, ink)
        d.ellipse([x - 16, y1 - 6, x + 16, y1 + 24], fill=ink)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def kelp(out, route_json=None):
    """Chaluhový les laid out on the shell's levelSpots(7): the lagoon's diagonal band of open
    water and sand, tall golden-green kelp fronds rising at the left edge and in the bottom-right
    foreground, and Had Zamotal's lair, a dark tangled thicket of kelp with a shadowy hollow, below
    the monster node at the top right."""
    rng = random.Random(43)
    nodes = region_nodes()
    img = vertical_gradient((132, 214, 206), (28, 112, 140))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 255, 220, 40))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(228, 206, 150))
    kelp_cols = [(150, 160, 60), (110, 140, 50), (190, 160, 70)]

    def frond(x, top, sway, col, w=26):
        pts = [(x + sway * math.sin(t / 6.0 * math.pi) , H - t * (H - top) / 6) for t in range(7)]
        d.line(pts, fill=col, width=w, joint="curve")
        for k, (px, py) in enumerate(pts[1:-1]):
            s = 1 if k % 2 else -1
            d.ellipse([px + s * 10 - 40, py - 18, px + s * 10 + 40, py + 18], fill=col)

    for i, x in enumerate((24, 64)):                                                      # kelp at the far-left edge
        frond(x, rng.randint(20, 120), rng.randint(8, 14), kelp_cols[i % 3])
    for i, x in enumerate((170, 250, 330, 410)):                                          # a canopy hanging from the surface
        top = 380 - i * 50
        pts = [(x + 18 * math.sin(k * 1.3), k * top / 5) for k in range(6)]
        d.line(pts, fill=kelp_cols[(i + 1) % 3], width=22, joint="curve")
        for k, (px, py) in enumerate(pts[1:]):
            s = 1 if k % 2 else -1
            d.ellipse([px + s * 10 - 38, py - 16, px + s * 10 + 38, py + 16], fill=kelp_cols[(i + 1) % 3])
        d.ellipse([pts[-1][0] - 16, pts[-1][1] - 16, pts[-1][0] + 16, pts[-1][1] + 16], fill=(210, 180, 80))
    for i in range(9):                                                                    # bottom-right foreground
        x = 1080 + i * 66 + rng.randint(-12, 12)
        frond(x, H - rng.randint(220, 340), rng.randint(14, 30), kelp_cols[i % 3], w=22)
    mx, my = nodes[-1]                                                                    # the tangled lair
    blob(d, mx + 120, my + 250, 200, 150, (70, 96, 40), rng, n=18, jitter=0.12)
    blob(d, mx + 70, my + 240, 80, 66, (24, 30, 40), rng, n=14, jitter=0.06)
    for k in range(7):
        a = math.pi * (0.05 + 0.9 * k / 6)
        x, y = mx + 120 + 190 * math.cos(a), my + 250 - 140 * math.sin(a)
        d.arc([x - 60, y - 40, x + 60, y + 40], 0, 300, fill=(130, 140, 50), width=16)
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (250, 236, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def jezik(out, route_json=None):
    """Ježík Syčík: a real porcupinefish puffed up into a round ball, facing left and hissing
    'sss': a sandy-yellow body with brown spots and a white belly, exactly fourteen short spines
    around the outline, big round eyes, a small puckered mouth blowing three wavy hiss puffs, two
    small side fins and a little fan tail."""
    img, d = canvas()
    cx, cy, r = 690, 690, 320
    body, belly, spot = (240, 206, 120), (250, 244, 226), (170, 120, 70)
    for k in range(14):                                                                   # fourteen spines
        a = 2 * math.pi * k / 14 + 0.11
        tip = (cx + (r + 95) * math.cos(a), cy + (r + 95) * math.sin(a))
        b1 = (cx + (r - 10) * math.cos(a - 0.12), cy + (r - 10) * math.sin(a - 0.12))
        b2 = (cx + (r - 10) * math.cos(a + 0.12), cy + (r - 10) * math.sin(a + 0.12))
        d.polygon([b1, tip, b2], fill=PLUM)
        tip2 = (cx + (r + 78) * math.cos(a), cy + (r + 78) * math.sin(a))
        c1 = (cx + (r - 6) * math.cos(a - 0.08), cy + (r - 6) * math.sin(a - 0.08))
        c2 = (cx + (r - 6) * math.cos(a + 0.08), cy + (r - 6) * math.sin(a + 0.08))
        d.polygon([c1, tip2, c2], fill=(250, 236, 200))
    d.pieslice([cx + r - 60, cy - 120, cx + r + 170, cy + 120], 300, 60, fill=PLUM)     # fan tail
    d.pieslice([cx + r - 44, cy - 104, cx + r + 154, cy + 104], 300, 60, fill=(230, 170, 90))
    d.ellipse([cx - r - 13, cy - r - 13, cx + r + 13, cy + r + 13], fill=PLUM)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body)
    d.chord([cx - r, cy - r, cx + r, cy + r], 20, 160, fill=belly)
    for x, y in ((760, 470), (860, 560), (900, 700), (640, 450), (780, 640), (560, 560)):  # brown spots
        d.ellipse([x - 26, y - 22, x + 26, y + 22], fill=spot)
    paddle(d, (700, 800), (820, 900), 90, (230, 170, 90), bend=0.1)                      # side fin
    eye(d, 520, 580, 70, iris=(60, 140, 120))
    eye(d, 680, 560, 64, iris=(60, 140, 120))
    d.ellipse([380 - 12, 720 - 40, 380 + 40, 720 + 40], fill=PLUM)                         # puckered mouth
    d.ellipse([380, 720 - 26, 380 + 28, 720 + 26], fill=(150, 60, 80))
    cheeks(d, [(520, 700)], r=30)
    for k, y in enumerate((640, 720, 800)):                                               # three hiss puffs
        pts = [(330 - i * 26, y + 18 * math.sin(i * 1.6)) for i in range(7)]
        d.line(pts, fill=(250, 252, 255), width=16, joint="curve")
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def vydra(out, route_json=None):
    """Vydra Výskalka: a cheerful river otter cheering with joy ('výskat'), standing upright on
    her hind feet and facing the viewer: a sleek brown body with a cream face, chest and muzzle,
    two small round ears, whisker dots, a wide open happy mouth, both front paws raised high above
    her head, two webbed hind feet and one long, thick tapering tail curling at her side."""
    img, d = canvas()
    fur, cream = (150, 100, 66), (240, 220, 186)
    stamp_path(d, [(760, 1100), (960, 1110), (1100, 1010), (1150, 840)], 170, 60, fur, outline=PLUM)   # tail
    for x in (540, 790):                                                                  # hind feet
        d.ellipse([x - 90 - 12, 1110 - 40 - 12, x + 90 + 12, 1110 + 40 + 12], fill=PLUM)
        d.ellipse([x - 90, 1110 - 40, x + 90, 1110 + 40], fill=(120, 80, 54))
    d.ellipse([664 - 190 - 13, 790 - 340 - 13, 664 + 190 + 13, 790 + 340 + 13], fill=PLUM)   # long, slim body
    d.ellipse([664 - 190, 790 - 340, 664 + 190, 790 + 340], fill=fur)
    d.ellipse([664 - 120, 600, 664 + 120, 1060], fill=cream)                               # chest
    for side in (-1, 1):                                                                  # paws raised high
        stamp_path(d, [(664 + side * 140, 600), (664 + side * 260, 420), (664 + side * 300, 250)], 100, 84, fur, outline=PLUM)
        d.ellipse([664 + side * 300 - 58, 250 - 58, 664 + side * 300 + 58, 250 + 58], fill=PLUM)
        d.ellipse([664 + side * 300 - 46, 250 - 46, 664 + side * 300 + 46, 250 + 46], fill=(120, 80, 54))
    hx, hy = 664, 430                                                                     # a flat, wide otter head
    for side in (-1, 1):                                                                  # small low ears
        d.ellipse([hx + side * 196 - 28, hy - 70 - 26, hx + side * 196 + 28, hy - 70 + 26], fill=PLUM)
        d.ellipse([hx + side * 196 - 18, hy - 70 - 16, hx + side * 196 + 18, hy - 70 + 16], fill=(120, 80, 54))
    d.ellipse([hx - 220 - 13, hy - 130 - 13, hx + 220 + 13, hy + 120 + 13], fill=PLUM)
    d.ellipse([hx - 220, hy - 130, hx + 220, hy + 120], fill=fur)
    d.ellipse([hx - 170, hy - 10, hx + 170, hy + 118], fill=cream)                         # pale lower face
    for side in (-1, 1):                                                                  # puffy whisker pads
        d.ellipse([hx + side * 62 - 66, hy + 4, hx + side * 62 + 66, hy + 84], fill=(248, 232, 204))
    d.ellipse([hx - 44, hy - 18, hx + 44, hy + 26], fill=(50, 30, 40))                    # broad nose
    open_mouth(d, hx, hy + 92, 46, 28)
    eye(d, hx - 96, hy - 62, 36, iris=(90, 60, 40))
    eye(d, hx + 96, hy - 62, 36, iris=(90, 60, 40))
    for side in (-1, 1):
        for k in range(3):
            x, y = hx + side * (50 + k * 30), hy + 40 + k * 6
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(120, 80, 60))
        for k in range(3):                                                                # whiskers
            d.line([(hx + side * 120, hy + 40 + k * 14), (hx + side * 230, hy + 20 + k * 26)], fill=PLUM, width=5)
    cheeks(d, [(hx - 150, hy + 10), (hx + 150, hy + 10)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def jazyk(out, route_json=None):
    """Jazyk Jazýček: a real sole (a flatfish called 'jazyk' in Czech), seen from above and tilted
    a little, swimming left: a flat, tongue-shaped oval body in sandy beige with soft brown spots,
    a soft frilly fin running all the way round its edge, both eyes together on the upper side
    near the rounded head end, a small curved smile and a small rounded tail."""
    img, d = canvas()
    body, fin, spot = (226, 196, 150), (206, 160, 120), (176, 132, 96)
    cx, cy = 650, 690
    def outline(x0, x1, hmax, pad):
        xs = np.linspace(0, 1, 90)
        prof = hmax * np.sin(np.pi * np.clip(xs, 0.0, 1.0)) ** 0.55 * (1.15 - 0.55 * xs) + pad
        top = [(x0 - pad + (x1 - x0 + 2 * pad) * x, cy - p) for x, p in zip(xs, prof)]
        return top + [(x, 2 * cy - y) for x, y in top[::-1]]

    d.polygon([(1040, cy), (1190, cy - 120), (1210, cy), (1190, cy + 120)], fill=PLUM)     # small tail
    d.polygon([(1060, cy), (1178, cy - 98), (1196, cy), (1178, cy + 98)], fill=fin)
    d.polygon(outline(180, 1060, 250, 60), fill=PLUM)                                       # soft fin all round
    d.polygon(outline(180, 1060, 250, 48), fill=fin)
    inner, outer = outline(180, 1060, 250, 4), outline(180, 1060, 250, 44)
    for k in range(4, len(inner) - 4, 4):                                                 # fin rays
        d.line([inner[k], outer[k]], fill=(180, 132, 96), width=6)
    d.polygon(outline(180, 1060, 250, 12), fill=PLUM)                                       # tongue-shaped body
    d.polygon(outline(180, 1060, 250, 0), fill=body)
    d.line([(330, cy + 10), (1020, cy + 10)], fill=(200, 168, 126), width=8)              # lateral line
    for x, y in ((540, 610), (700, 650), (860, 620), (800, 760), (600, 770), (960, 700)):  # spots
        d.ellipse([x - 28, y - 20, x + 28, y + 20], fill=spot)
    eye(d, 330, 600, 50, iris=(70, 120, 150))                                             # both eyes up top
    eye(d, 440, 560, 46, iris=(70, 120, 150))
    d.arc([230, 680, 330, 760], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(400, 690)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def das_inked(out, route_json=None):
    """Ďas Lucerník, inked: a round, grumpy cartoon anglerfish facing left, soaked in magic ink: a
    big round body as one with his head, a wide frowning mouth with a single row of small, blunt,
    rounded teeth, a long fishing-rod lure growing from his forehead that ends in one glowing
    little lantern, small round eyes under a cross brow, small fins, a fan tail, glossy black and
    violet ink blots and drips over his back."""
    img, d = canvas()
    skin = (120, 108, 150)
    cx, cy, r = 700, 760, 300
    d.pieslice([cx + r - 80, cy - 140, cx + r + 170, cy + 140], 300, 60, fill=PLUM)       # tail
    d.pieslice([cx + r - 64, cy - 124, cx + r + 154, cy + 124], 300, 60, fill=(100, 90, 130))
    d.ellipse([cx - r - 13, cy - r - 13, cx + r + 13, cy + r + 13], fill=PLUM)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=skin)
    d.chord([cx - r, cy - r, cx + r, cy + r], 30, 150, fill=(170, 160, 196))
    stamp_path(d, [(560, 490), (470, 300), (330, 230), (250, 290)], 30, 22, (100, 90, 130), outline=PLUM)  # lure rod
    d.ellipse([250 - 70, 330 - 70, 250 + 70, 330 + 70], fill=(255, 236, 150))             # lantern glow
    d.ellipse([250 - 52, 330 - 52, 250 + 52, 330 + 52], fill=PLUM)
    d.ellipse([250 - 40, 330 - 40, 250 + 40, 330 + 40], fill=(255, 214, 90))
    d.chord([400, 760, 800, 1000], 180, 360, fill=PLUM)                                   # frowning mouth
    d.chord([414, 774, 786, 986], 180, 360, fill=(110, 40, 60))
    for k in range(6):
        x = 450 + k * 52
        d.rounded_rectangle([x, 860, x + 30, 896], radius=10, fill=(250, 250, 244))
    eye(d, 560, 640, 40)
    d.line([(500, 580), (620, 610)], fill=PLUM, width=22)
    paddle(d, (780, 880), (900, 990), 90, (100, 90, 130), bend=0.1)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((760, 530, 70, 50, ink), (900, 640, 60, 44, violet), (640, 500, 40, 30, violet),
                            (880, 820, 40, 30, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def wreck(out, route_json=None):
    """Pirátský vrak laid out on the shell's levelSpots(7): the lagoon's diagonal band of open
    water and sand; a broken mast with a tattered sail and barrels at the left; scattered planks and
    an anchor in the bottom-right foreground; the sunken pirate ship's tilted hull with a dark,
    glowing hatch (Ďas Lucerník's lair) below the monster node at the top right."""
    rng = random.Random(44)
    nodes = region_nodes()
    img = vertical_gradient((110, 196, 220), (22, 92, 140))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 255, 220, 36))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(222, 200, 156))
    wood, dark = (140, 96, 62), (96, 64, 44)
    d.polygon([(0, 300), (430, 380), (440, 440), (0, 400)], fill=dark)                    # a broken deck piece, top left
    d.polygon([(40, 0), (80, 0), (96, 330), (56, 330)], fill=wood)                         # broken mast on it
    d.polygon([(80, 60), (330, 110), (300, 240), (320, 320), (100, 300)], fill=(232, 222, 196))  # tattered sail
    d.line([(40, 80), (330, 100)], fill=dark, width=14)
    for x, y in ((200, 330), (330, 350)):                                                 # barrels on the deck
        d.rounded_rectangle([x - 50, y - 64, x + 50, y + 40], radius=26, fill=wood)
        for yy in (y - 40, y + 10):
            d.line([(x - 50, yy), (x + 50, yy)], fill=(80, 80, 90), width=10)
    mx, my = nodes[-1]                                                                    # the hull, the lair
    hull = [(mx - 120, my + 120), (W + 40, my + 40), (W + 40, my + 460), (mx + 40, my + 420)]
    d.polygon(hull, fill=wood)
    for k in range(5):
        y0 = my + 150 + k * 60
        d.line([(mx - 100 + k * 30, y0), (W, y0 - 70 + k * 6)], fill=dark, width=8)
    blob(d, mx + 90, my + 260, 70, 60, (28, 24, 44), rng, n=14, jitter=0.06)
    d.ellipse([mx + 60, my + 230, mx + 120, my + 290], fill=(255, 214, 110))               # the lantern glow inside
    for x, y in ((mx - 20, my + 210), (mx + 240, my + 220)):
        d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(40, 34, 50))                      # portholes
    for i in range(6):                                                                    # foreground planks
        x = 1080 + i * 90 + rng.randint(-20, 20)
        y = H - 60 - rng.randint(0, 50)
        d.polygon([(x - 70, y), (x + 70, y - 30), (x + 76, y - 6), (x - 64, y + 24)], fill=[wood, dark][i % 2])
    d.line([(980, H - 220), (980, H - 60)], fill=(110, 120, 130), width=22)                 # anchor
    d.arc([900, H - 160, 1060, H - 30], 0, 180, fill=(110, 120, 130), width=22)
    d.line([(930, H - 200), (1030, H - 200)], fill=(110, 120, 130), width=18)
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (250, 236, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def hvezdice(out, route_json=None):
    """Hvězdice Rodinka: a cheerful starfish facing the viewer, exactly five plump rounded arms
    joined at one heart: a big pink heart in the middle of her body, coral-orange with small cream
    bumps along each arm, a happy face above the heart, rosy cheeks, the arm tips curling a little."""
    img, d = canvas()
    cx, cy = 664, 700
    body, bump = (246, 140, 96), (255, 226, 190)
    for k in range(5):                                                                    # five arms
        a = -math.pi / 2 + 2 * math.pi * k / 5
        tip = (cx + 470 * math.cos(a), cy + 470 * math.sin(a))
        stamp_path(d, [(cx, cy), tip], 300, 110, body, outline=PLUM)
    stamp_path(d, [(cx, cy), (cx + 1, cy)], 330, 330, body)
    for k in range(5):
        a = -math.pi / 2 + 2 * math.pi * k / 5
        for t in (0.42, 0.6, 0.78):
            x, y = cx + 470 * t * math.cos(a), cy + 470 * t * math.sin(a)
            d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=bump)
    hx, hy = cx, cy + 70                                                                  # one heart
    d.polygon([(hx - 110, hy - 40), (hx, hy + 100), (hx + 110, hy - 40)], fill=PLUM)
    d.ellipse([hx - 122, hy - 112, hx + 8, hy + 8], fill=PLUM)
    d.ellipse([hx - 8, hy - 112, hx + 122, hy + 8], fill=PLUM)
    d.polygon([(hx - 96, hy - 38), (hx, hy + 84), (hx + 96, hy - 38)], fill=(240, 90, 130))
    d.ellipse([hx - 108, hy - 100, hx - 4, hy - 4], fill=(240, 90, 130))
    d.ellipse([hx + 4, hy - 100, hx + 108, hy - 4], fill=(240, 90, 130))
    d.ellipse([hx - 76, hy - 82, hx - 46, hy - 56], fill=(255, 200, 220))
    eye(d, cx - 70, cy - 150, 42, iris=(70, 110, 150))
    eye(d, cx + 70, cy - 150, 42, iris=(70, 110, 150))
    d.arc([cx - 50, cy - 130, cx + 50, cy - 70], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(cx - 140, cy - 100), (cx + 140, cy - 100)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def zeva_inked(out, route_json=None):
    """Zéva Lakomá, inked: a real giant clam (Tridacna) as a greedy, grumpy character facing the
    viewer: two heavy, ribbed shell halves with exactly five big wavy zigzag folds along the open
    edge, the soft mantle between them with two round eyes and a greedy, sulky grin, a heap of
    shiny pearls hoarded in the front of the shell, glossy black and violet ink blots and drips
    over the shell."""
    img, d = canvas()
    shell, rib, mantle = (150, 150, 176), (110, 108, 140), (96, 124, 176)
    cx, cy = 664, 820
    low = [(cx - 480 + k * 96, cy + (-40 if k % 2 else 30)) for k in range(11)]          # five zigzag folds
    up = [(x, y - 200) for x, y in low]
    lower = low + [(cx + 520, cy + 40), (cx + 420, cy + 300), (cx, cy + 350), (cx - 420, cy + 300), (cx - 520, cy + 40)]
    upper = up + [(cx + 520, cy - 220), (cx + 420, cy - 440), (cx, cy - 500), (cx - 420, cy - 440), (cx - 520, cy - 220)]
    gap = low[::-1] + up
    d.polygon([(x, y + (14 if i < 11 else -14)) for i, (x, y) in enumerate(gap)], fill=PLUM)  # the soft mantle
    d.polygon(gap, fill=mantle)
    for x in range(cx - 400, cx + 401, 100):
        d.ellipse([x - 16, cy - 120, x + 16, cy - 90], fill=(140, 170, 220))
    eye(d, cx - 140, cy - 110, 42)
    eye(d, cx + 140, cy - 110, 42)
    d.line([(cx - 200, cy - 176), (cx - 90, cy - 146)], fill=PLUM, width=20)            # greedy, cross brows
    d.line([(cx + 200, cy - 176), (cx + 90, cy - 146)], fill=PLUM, width=20)
    d.arc([cx - 70, cy - 90, cx + 70, cy - 30], 20, 160, fill=PLUM, width=12)            # sly grin
    for poly in (lower, upper):
        d.polygon(poly, fill=PLUM)
        sx = sum(p[0] for p in poly) / len(poly); sy = sum(p[1] for p in poly) / len(poly)
        d.polygon([(x + (sx - x) * 0.03, y + (sy - y) * 0.05) for x, y in poly], fill=shell)
    for k in range(5):                                                                    # ribs
        x = cx - 384 + k * 192
        d.line([(x, cy + 60), (cx + (x - cx) * 0.4, cy + 320)], fill=rib, width=14)
        d.line([(x, cy - 260), (cx + (x - cx) * 0.4, cy - 470)], fill=rib, width=14)
    heap = [(cx + 190, cy + 40), (cx + 270, cy + 40), (cx + 350, cy + 40), (cx + 230, cy - 26), (cx + 310, cy - 26), (cx + 270, cy - 92)]
    for x, y in heap:                                                                     # a heap of hoarded pearls
        d.ellipse([x - 42, y - 42, x + 42, y + 42], fill=PLUM)
        d.ellipse([x - 33, y - 33, x + 33, y + 33], fill=(250, 246, 236))
        d.ellipse([x - 18, y - 22, x - 4, y - 8], fill=(255, 255, 255))
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((cx - 300, cy - 400, 70, 46, ink), (cx + 260, cy - 380, 60, 40, violet),
                            (cx + 360, cy + 220, 60, 40, ink), (cx - 330, cy + 240, 50, 34, violet)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def bay(out, route_json=None):
    """Perlová zátoka laid out on the shell's levelSpots(7): the lagoon's diagonal band of open
    water and sand; a rocky outcrop with oysters and soft anemones at the top left; open pearl
    shells and pebbles in the bottom-right foreground; Zéva Lakomá's lair, a huge closed giant clam
    with wavy lips half buried in the sand, below the monster node at the top right."""
    rng = random.Random(45)
    nodes = region_nodes()
    img = vertical_gradient((150, 222, 236), (36, 126, 176))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 255, 230, 40))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(242, 224, 186))
    for x, y, r, c in ((100, 160, 170, (150, 140, 150)), (300, 80, 120, (170, 160, 170)), (90, 430, 150, (140, 130, 146))):
        blob(d, x, y, r, r * 0.85, c, rng, n=16, jitter=0.12)                             # rocky outcrop
    for x, y, c in ((260, 240, (250, 160, 200)), (330, 330, (190, 150, 240)), (60, 300, (255, 190, 120))):
        for k in range(7):                                                                # anemones
            a = math.pi * (1.1 + 0.8 * k / 6)
            d.line([(x, y), (x + 60 * math.cos(a), y + 60 * math.sin(a))], fill=c, width=16)
        d.ellipse([x - 26, y - 10, x + 26, y + 30], fill=c)
    for x, y in ((200, 520), (300, 470)):                                                 # oysters
        blob(d, x, y, 50, 30, (200, 196, 190), rng)
    mx, my = nodes[-1]                                                                    # the giant clam lair
    cx, cy = mx + 140, my + 290
    pts = [(cx - 230 + k * 46, cy + (-30 if k % 2 else 20)) for k in range(11)]
    d.polygon([(cx - 260, cy)] + pts + [(cx + 260, cy), (cx + 200, cy - 170), (cx, cy - 210), (cx - 200, cy - 170)], fill=(170, 160, 196))
    d.polygon([(cx - 260, cy)] + pts + [(cx + 260, cy), (cx + 220, cy + 120), (cx - 220, cy + 120)], fill=(150, 140, 180))
    d.line(pts, fill=(40, 30, 60), width=14)
    for i in range(6):                                                                    # pearl shells foreground
        x = 1080 + i * 95 + rng.randint(-20, 20)
        y = H - 70 - rng.randint(0, 40)
        d.pieslice([x - 60, y - 60, x + 60, y + 30], 180, 360, fill=(250, 200, 200))
        d.ellipse([x - 14, y - 36, x + 14, y - 8], fill=(255, 252, 240))
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (250, 236, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def kalmar(out, route_json=None):
    """Kalmar Desetiruký: a cheerful squid facing the viewer, mantle pointing up: a long, rounded
    torpedo mantle with two triangular fins at the top, two big friendly eyes, and exactly ten arms
    fanning out below, eight shorter arms and two longer tentacles with wider tips, each arm clearly
    separate, rosy pink-purple with lighter suckers."""
    img, d = canvas()
    body, light = (220, 120, 170), (250, 200, 220)
    cx = 664
    for k in range(10):                                                                   # ten arms
        long = k in (0, 9)
        t = (k - 4.5) / 4.5
        base = (cx + t * 190, 790)
        end = (cx + t * (500 if long else 470), 1160 if long else 1080 - abs(t) * 120)
        mid = (cx + t * (320 if long else 300), 980 if long else 950 - abs(t) * 40)
        stamp_path(d, [base, mid, end], 48, 24, body, outline=PLUM)
        if long:
            d.ellipse([end[0] - 48, end[1] - 34, end[0] + 48, end[1] + 34], fill=PLUM)
            d.ellipse([end[0] - 36, end[1] - 22, end[0] + 36, end[1] + 22], fill=body)
    for k in range(10):
        t = (k - 4.5) / 4.5
        for f in (0.45, 0.7):
            x, y = cx + t * (190 + 130 * f * 1.6), 800 + 140 * f
            d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=light)
    d.polygon([(cx - 140, 230), (cx - 330, 160), (cx - 160, 110)], fill=PLUM)              # two fins
    d.polygon([(cx + 140, 230), (cx + 330, 160), (cx + 160, 110)], fill=PLUM)
    d.polygon([(cx - 145, 215), (cx - 300, 160), (cx - 160, 125)], fill=body)
    d.polygon([(cx + 145, 215), (cx + 300, 160), (cx + 160, 125)], fill=body)
    mantle = [(cx - 230, 800), (cx - 210, 400), (cx - 120, 160), (cx, 70), (cx + 120, 160), (cx + 210, 400), (cx + 230, 800)]
    d.polygon(mantle, fill=PLUM)
    d.polygon([(x * 0.96 + cx * 0.04, y * 1.0 + (12 if y < 200 else 0)) for x, y in mantle], fill=body)
    d.ellipse([cx - 230, 700, cx + 230, 860], fill=body)
    eye(d, cx - 95, 620, 66, iris=(80, 60, 140))
    eye(d, cx + 95, 620, 66, iris=(80, 60, 140))
    d.arc([cx - 50, 690, cx + 50, 760], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(cx - 170, 710), (cx + 170, 710)], r=24)
    for x, y in ((cx - 60, 300), (cx + 50, 380), (cx - 20, 470)):                         # mantle spots
        d.ellipse([x - 20, y - 16, x + 20, y + 16], fill=light)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def uhor_inked(out, route_json=None):
    """Lávový úhoř Žhavák, inked: a real eel (not a moray): a long smooth body in an S-curve, a
    pointed head with a small mouth and a jutting lower jaw, two small round pectoral fins just
    behind the head, one low fin running along the back that merges into the pointed tail; he is
    a lava eel, dark charcoal with glowing orange cracks and spots, soaked in magic ink, a frowning
    brow and a cross pout, puffs of steam rising from his back."""
    img, d = canvas()
    char, lava = (70, 62, 74), (255, 140, 50)
    path = [(320, 470), (520, 470), (760, 560), (860, 760), (760, 940), (560, 1000), (520, 1110), (700, 1170),
            (1000, 1120)]
    stamp_path(d, path[4:], 220, 90, (110, 96, 104), outline=PLUM)                     # fin rim round the rear half and tail
    stamp_path(d, path, 170, 40, char, outline=PLUM)
    for x, y in ((560, 470), (790, 640), (820, 820), (640, 980), (760, 1150), (900, 1130)):  # glowing cracks
        d.line([(x - 30, y - 10), (x, y + 6), (x + 26, y - 14)], fill=lava, width=12)
    for x, y in ((680, 520), (840, 720), (700, 960)):
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=(255, 190, 80))
    hx, hy = 300, 470                                                                     # pointed head
    d.polygon([(hx + 80, hy - 100), (hx - 170, hy - 20), (hx - 150, hy + 40), (hx + 80, hy + 100)], fill=PLUM)
    d.polygon([(hx + 70, hy - 86), (hx - 152, hy - 18), (hx - 134, hy + 30), (hx + 70, hy + 86)], fill=char)
    d.line([(hx - 140, hy + 18), (hx - 40, hy + 30)], fill=PLUM, width=10)                # small mouth, jaw juts
    paddle(d, (hx + 120, hy + 70), (hx + 200, hy + 160), 70, (110, 96, 104), bend=0.1)    # pectoral fin
    eye(d, hx - 30, hy - 30, 34, iris=(255, 170, 70))
    d.line([(hx - 80, hy - 80), (hx + 20, hy - 60)], fill=PLUM, width=18)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((700, 540, 50, 34, ink), (850, 880, 50, 34, violet), (600, 1010, 40, 28, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y, r in ((780, 420, 40), (840, 340, 52), (920, 250, 64)):                       # steam puffs
        d.ellipse([x - r, y - r, x + r, y + r], fill=(236, 236, 240))
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def vents(out, route_json=None):
    """Sopečné prameny laid out on the shell's levelSpots(7): the lagoon's diagonal band of open
    water and dark volcanic sand; tall rounded rock chimneys puffing soft bubbly steam at the left;
    warm glowing pebbles and small vents in the bottom-right foreground; Žhavák's lair, a big black
    rock chimney with a glowing orange crack, below the monster node at the top right."""
    rng = random.Random(46)
    nodes = region_nodes()
    img = vertical_gradient((96, 170, 196), (24, 70, 110))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 230, 190, 34))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(150, 130, 120))
    blob(d, 160, 420, 300, 130, (70, 62, 70), rng, n=18, jitter=0.08)                     # top-left volcanic ridge
    blob(d, 40, 300, 160, 200, (70, 62, 70), rng, n=16, jitter=0.08)
    for x, top, w in ((80, 40, 90), (230, 160, 80), (370, 290, 64)):                     # chimneys on the ridge
        d.polygon([(x - w, 440), (x - w * 0.5, top), (x + w * 0.5, top), (x + w, 440)], fill=(84, 74, 82))
        d.ellipse([x - w * 0.5, top - 16, x + w * 0.5, top + 16], fill=(255, 140, 60))
    for x, top in ((230, 160), (370, 290)):
        for k in range(3):
            r = 24 + k * 10
            d.ellipse([x + k * 14 - r, top - 50 - k * 56 - r, x + k * 14 + r, top - 50 - k * 56 + r], fill=(220, 226, 232))
    mx, my = nodes[-1]                                                                    # the black chimney lair
    d.polygon([(mx - 40, H * 0.62), (mx + 30, my + 110), (mx + 200, my + 110), (W + 20, my + 300), (W + 20, H * 0.62)], fill=(50, 44, 54))
    d.line([(mx + 90, my + 170), (mx + 70, my + 260), (mx + 110, my + 330), (mx + 90, my + 420)], fill=(255, 130, 50), width=22)
    for i in range(8):                                                                    # glowing pebbles foreground
        x = 1060 + i * 75 + rng.randint(-15, 15)
        y = H - 60 - rng.randint(0, 40)
        blob(d, x, y, 40, 26, (90, 80, 86), rng)
        d.ellipse([x - 10, y - 8, x + 10, y + 8], fill=(255, 160, 70))
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (220, 200, 190), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def tulen(out, route_json=None):
    """Tuleň Pádík: a round, cheerful harbour seal (no ear flaps, a true seal) sliding belly-first
    down a staircase of exactly seven icy steps from the top right to the bottom left, front
    flippers stretched forward, hind flippers together behind, a dappled grey coat with a pale
    belly, big dark eyes, whisker dots, a happy open smile; the seven steps are pale blue ice."""
    img, d = canvas()
    ice, ice_edge = (200, 230, 246), (150, 196, 226)
    for k in range(7):                                                                    # seven icy steps
        x0 = 140 + k * 150
        y0 = 1180 - (6 - k) * 0 - k * 0
        top = 1180 - (k + 1) * 100
        d.rectangle([x0 - 10, top - 10, x0 + 150 + 10, 1200 + 10], fill=PLUM)
    for k in range(7):
        x0 = 140 + k * 150
        top = 1180 - (k + 1) * 100
        d.rectangle([x0, top, x0 + 150, 1200], fill=ice)
        d.rectangle([x0, top, x0 + 150, top + 18], fill=(250, 254, 255))
        d.line([(x0, top), (x0, 1200)], fill=ice_edge, width=6)
    coat, belly, spot = (150, 158, 170), (226, 230, 236), (110, 118, 132)
    stamp_path(d, [(1000, 330), (820, 470), (600, 610)], 240, 300, coat, outline=PLUM)    # body sliding down-left
    d.ellipse([480 - 190 - 13, 640 - 150 - 13, 480 + 190 + 13, 640 + 150 + 13], fill=PLUM)   # head
    d.ellipse([480 - 190, 640 - 150, 480 + 190, 640 + 150], fill=coat)
    for x, y in ((760, 470), (880, 400), (700, 560), (960, 330)):
        d.ellipse([x - 18, y - 14, x + 18, y + 14], fill=spot)
    paddle(d, (560, 760), (380, 860), 90, coat, bend=-0.1)                                # front flippers forward
    paddle(d, (660, 740), (540, 880), 90, coat, bend=-0.1)
    for side in (-1, 1):                                                                  # hind flippers together
        paddle(d, (1080, 290), (1180 + side * 10, 200 + side * 60), 90, coat, bend=0.1 * side)
    d.ellipse([330, 640, 470, 740], fill=belly)                                           # muzzle
    d.ellipse([340, 630, 400, 670], fill=(50, 30, 40))
    for x, y in ((380, 690), (410, 702), (440, 694)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(90, 90, 100))
    eye(d, 450, 570, 44, iris=(40, 30, 40))
    eye(d, 560, 590, 40, iris=(40, 30, 40))
    d.arc([350, 690, 450, 760], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(560, 680)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def delfin(out, route_json=None):
    """Delfín Skokánek: a playful bottlenose dolphin leaping in a high arc to the right over a
    small curling wave, always on the move: a sleek blue-grey body with a pale belly, a short
    beak with a big smile, one curved dorsal fin, two flippers, a tail fluke with two lobes, a
    blowhole on top, three water droplets flying off the wave."""
    img, d = canvas()
    body, belly = (110, 160, 210), (226, 238, 248)
    wave = [(180, 1220), (260, 1110), (420, 1060), (620, 1080), (820, 1050), (980, 980), (1060, 1040), (1100, 1220)]
    d.polygon(wave, fill=(60, 160, 210))
    for x in range(280, 1060, 70):
        d.ellipse([x - 32, 1040 - 18, x + 32, 1040 + 22], fill=(250, 252, 255))
    path = catmull_rom([(340, 900), (470, 610), (720, 450), (1000, 560)], samples=10)
    stamp_path(d, path, 120, 210, body, outline=PLUM)
    belly_pts = catmull_rom([(420, 840), (520, 640), (740, 540), (960, 610)], samples=10)
    stamp_path(d, belly_pts, 50, 80, belly)
    d.polygon([(560, 470), (620, 300), (720, 460)], fill=PLUM)                             # dorsal fin
    d.polygon([(576, 466), (624, 326), (702, 458)], fill=body)
    paddle(d, (340, 920), (220, 1020), 110, body, bend=0.15)                                # tail fluke, two lobes
    paddle(d, (340, 920), (460, 1030), 110, body, bend=-0.15)
    d.rounded_rectangle([1010 - 12, 560 - 40 - 12, 1180 + 12, 560 + 40 + 12], radius=50, fill=PLUM)   # beak
    d.rounded_rectangle([1010, 560 - 40, 1180, 560 + 40], radius=40, fill=body)
    d.arc([1000, 540, 1170, 620], 10, 120, fill=PLUM, width=10)
    paddle(d, (860, 640), (900, 780), 80, body, bend=0.1)                                 # flipper
    eye(d, 960, 520, 34, iris=(40, 60, 90))
    d.ellipse([860, 440, 890, 460], fill=PLUM)                                            # blowhole
    cheeks(d, [(1010, 600)], r=22)
    for x, y in ((1120, 920), (1180, 860), (1100, 830)):                                  # three droplets
        d.ellipse([x - 22, y - 30, x + 22, y + 24], fill=PLUM)
        d.ellipse([x - 14, y - 20, x + 14, y + 16], fill=(170, 220, 250))
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def ledana_inked(out, route_json=None):
    """Mořská saň Ledana, inked: a big, frosty sea dragon (the third-grade finale), funny-spooky
    and never frightening: a plump plesiosaur-like body with four paddle flippers, a long curving
    neck, a rounded head with two short rounded horns and a sulky frown, a row of seven rounded
    icicle spines along her back, a short tail; pale icy blue soaked in glossy black and violet
    magic ink, frost sparkles."""
    img, d = canvas()
    iceb, dark = (176, 210, 236), (120, 150, 190)
    for x, y, tx, ty in ((540, 960, 390, 1110), (820, 980, 930, 1130), (500, 860, 330, 900), (900, 880, 1060, 920)):
        paddle(d, (x, y), (tx, ty), 120, dark, bend=0.1)                                  # four flippers
    d.ellipse([664 - 330 - 13, 860 - 190 - 13, 664 + 330 + 13, 860 + 190 + 13], fill=PLUM)   # plump body
    d.ellipse([664 - 330, 860 - 190, 664 + 330, 860 + 190], fill=iceb)
    stamp_path(d, [(980, 860), (1120, 900), (1220, 860)], 140, 40, iceb, outline=PLUM)     # short tail
    stamp_path(d, [(420, 780), (330, 560), (380, 380)], 170, 140, iceb, outline=PLUM)      # long neck
    for k in range(7):                                                                    # seven icicle spines
        x = 470 + k * 80
        y = 700 - math.sin(math.pi * (k + 0.5) / 7) * 50
        d.polygon([(x - 34, y + 30), (x, y - 70), (x + 34, y + 30)], fill=PLUM)
        d.polygon([(x - 22, y + 24), (x, y - 52), (x + 22, y + 24)], fill=(230, 246, 255))
    for x in (300, 380):                                                                  # two short horns swept back
        d.polygon([(x - 30, 230), (x + 70, 120), (x + 30, 240)], fill=PLUM)
        d.polygon([(x - 18, 228), (x + 56, 138), (x + 22, 232)], fill=(230, 246, 255))
    d.ellipse([300 - 150 - 13, 300 - 100 - 13, 300 + 150 + 13, 300 + 100 + 13], fill=PLUM)  # head
    d.ellipse([300 - 150, 300 - 100, 300 + 150, 300 + 100], fill=iceb)
    d.rounded_rectangle([100 - 13, 300 - 70 - 13, 260 + 13, 300 + 80 + 13], radius=70, fill=PLUM)  # dragon snout
    d.rounded_rectangle([100, 300 - 70, 260, 300 + 80], radius=60, fill=iceb)
    stamp_path(d, [(260, 300), (300, 300)], 150, 150, iceb)
    for x in (130, 170):                                                                  # nostrils
        d.ellipse([x - 10, 262, x + 10, 278], fill=PLUM)
    for k in range(3):                                                                    # a little frill at the jaw
        x = 400 + k * 30
        d.polygon([(x - 18, 360), (x + 10, 420), (x + 22, 350)], fill=(230, 246, 255))
    eye(d, 270, 250, 38)
    eye(d, 370, 260, 36)
    d.line([(220, 196), (300, 216)], fill=PLUM, width=18)
    d.line([(410, 200), (340, 220)], fill=PLUM, width=18)
    d.arc([110, 330, 250, 380], 200, 340, fill=PLUM, width=12)                           # sulky frown
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((700, 820, 80, 54, ink), (880, 900, 60, 40, violet), (520, 900, 50, 34, violet),
                            (360, 520, 40, 30, ink), (760, 980, 44, 30, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y in ((1000, 600), (1100, 700), (160, 600)):                                   # frost sparkles
        d.polygon([(x, y - 30), (x + 8, y - 8), (x + 30, y), (x + 8, y + 8), (x, y + 30), (x - 8, y + 8), (x - 30, y), (x - 8, y - 8)], fill=(240, 250, 255))
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def ice(out, route_json=None):
    """Ledové moře laid out on the shell's levelSpots(7): the lagoon's diagonal band of open, cold,
    clear water and snowy-pale sand; floating ice floes and a snowy ice shelf at the top left;
    rounded snowy rocks and ice crystals in the bottom-right foreground; Ledana's lair, a big ice
    cave with a dark blue mouth, below the monster node at the top right."""
    rng = random.Random(47)
    nodes = region_nodes()
    img = vertical_gradient((170, 222, 240), (40, 100, 150))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(255, 255, 255, 40))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(226, 236, 244))
    d.polygon([(0, 0), (520, 0), (470, 90), (360, 150), (200, 170), (0, 220)], fill=(236, 246, 252))   # ice shelf
    d.polygon([(0, 220), (200, 170), (360, 150), (470, 90), (480, 160), (340, 250), (0, 320)], fill=(170, 210, 236))
    for x, y, r in ((120, 420, 110), (330, 360, 80)):                                      # floating floes
        blob(d, x, y, r, r * 0.45, (220, 238, 250), rng, n=12, jitter=0.12)
    mx, my = nodes[-1]                                                                    # the ice cave
    blob(d, mx + 110, my + 250, 240, 170, (200, 228, 246), rng, n=18, jitter=0.08)
    blob(d, mx + 70, my + 270, 90, 80, (30, 50, 90), rng, n=14, jitter=0.06)
    for i in range(7):                                                                    # snowy rocks foreground
        x = 1060 + i * 85 + rng.randint(-15, 15)
        y = H - 60 - rng.randint(0, 40)
        blob(d, x, y, 50, 34, (150, 170, 190), rng)
        blob(d, x, y - 24, 40, 14, (250, 252, 255), rng)
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (200, 220, 240), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def lachtan2(out, route_json=None):
    """Lachtan Lyžař v2: v1's wave was painted as scenery running off the canvas, so the skis
    now rest on a small, compact, rounded cushion of foamy water that ends well inside the canvas."""
    img, d = canvas()
    fur, light, muzzle = (150, 108, 78), (204, 162, 122), (222, 190, 152)
    d.ellipse([300, 1040, 1060, 1190], fill=PLUM)                                         # a compact foam cushion
    d.ellipse([312, 1052, 1048, 1178], fill=(70, 176, 196))
    for x in range(360, 1020, 60):
        d.ellipse([x - 30, 1048 - 16, x + 30, 1048 + 20], fill=(250, 252, 252))
    for y, x0 in ((1020, 330), (1068, 290)):                                              # two skis
        d.rounded_rectangle([x0, y - 20, x0 + 680, y + 20], radius=20, fill=PLUM)
        d.rounded_rectangle([x0 + 7, y - 12, x0 + 673, y + 12], radius=12, fill=(220, 72, 60))
        d.pieslice([x0 + 610, y - 90, x0 + 730, y + 20], 270, 90, fill=PLUM)
        d.pieslice([x0 + 624, y - 74, x0 + 714, y + 8], 270, 90, fill=(220, 72, 60))
    paddle(d, (560, 980), (470, 1040), 110, fur, bend=-0.1)                              # hind flippers
    paddle(d, (690, 990), (780, 1048), 110, fur, bend=0.1)
    stamp_path(d, [(620, 990), (650, 780), (720, 560)], 330, 250, fur, outline=PLUM)    # body
    thick_path(d, [(640, 960), (668, 760), (725, 600)], 190, 140, light)
    d.ellipse([740 - 160 - 12, 420 - 150 - 12, 740 + 160 + 12, 420 + 150 + 12], fill=PLUM)  # head
    d.ellipse([740 - 160, 420 - 150, 740 + 160, 420 + 150], fill=fur)
    d.ellipse([820, 430, 940, 530], fill=muzzle)
    d.ellipse([918, 440, 958, 474], fill=(50, 30, 40))
    for x, y in ((860, 492), (890, 504), (920, 496)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(120, 80, 60))
    d.ellipse([622, 352, 668, 392], fill=PLUM)                                           # ear flap
    d.ellipse([628, 358, 662, 386], fill=(120, 84, 60))
    eye(d, 780, 380, 40, iris=(90, 60, 40))
    d.arc([830, 470, 900, 530], 20, 150, fill=PLUM, width=9)
    cheeks(d, [(700, 470)], r=26)
    for (sx, sy), (tx, ty) in (((760, 640), (900, 740)), ((620, 660), (480, 760))):    # front flippers
        paddle(d, (sx, sy), (tx, ty), 110, fur, bend=0.05)
    d.line([(905, 700), (1000, 1010)], fill=PLUM, width=22)                             # ski poles
    d.line([(470, 720), (380, 1010)], fill=PLUM, width=22)
    for x, y in ((995, 990), (386, 990)):
        d.ellipse([x - 34, y - 12, x + 34, y + 12], fill=PLUM)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def barakuda_baby(out, route_json=None):
    """Barakuda Bystřinka as a hatchling, dashing left like her master: a short, chubby, rounded
    body with a big head and a big eye, the master's silver-blue back and pearly belly, exactly five
    dark slanted bars, two small dorsal fins, a small forked tail and three short speed lines."""
    img, d = canvas()
    cy = 680
    back, belly, bar = (110, 162, 212), (240, 238, 230), (44, 64, 104)
    d.polygon([(960, cy), (1100, 540), (1060, cy), (1100, 820)], fill=PLUM)              # small forked tail
    d.polygon([(976, cy), (1086, 564), (1046, cy), (1086, 796)], fill=back)
    for xa, xb, hgt in ((560, 660, 90), (780, 850, 70)):                               # two dorsal fins
        d.polygon([(xa - 12, cy - 190), (xa + 30, cy - 190 - hgt - 14), (xb + 12, cy - 170)], fill=PLUM)
        d.polygon([(xa, cy - 194), (xa + 32, cy - 190 - hgt), (xb, cy - 174)], fill=back)
    xs, h = fish_body(d, 260, 990, cy, 200, back, belly, shape=0.35)
    for k in range(5):                                                                  # five bars
        x = 520 + k * 80
        hh = float(np.interp(x, xs, h))
        d.polygon([(x, cy - hh + 12), (x + 30, cy - hh + 12), (x + 6, cy + 14), (x - 24, cy + 14)], fill=bar)
    paddle(d, (520, cy + 70), (620, cy + 160), 70, back, bend=0.1)
    eye(d, 400, cy - 50, 72, iris=(60, 110, 180))                                       # a big hatchling eye
    d.arc([300, cy + 20, 380, cy + 70], 10, 150, fill=PLUM, width=10)
    cheeks(d, [(440, cy + 60)], r=28)
    for y in (cy - 80, cy, cy + 80):                                                   # three speed lines
        d.line([(1130, y), (1190, y)], fill=PLUM, width=14)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def lachtan_baby(out, route_json=None):
    """Lachtan Lyžař as a hatchling (a sea-lion pup), facing right like his master: a round, chubby
    pup with a big head, a small ear flap, a whiskered muzzle and a big eye, the master's warm brown
    fur and cream belly, standing on exactly two short red skis with curled tips, one small ski pole
    in each front flipper, on a small compact cushion of teal water with white foam."""
    img, d = canvas()
    fur, light, muzzle = (176, 114, 66), (242, 206, 150), (246, 226, 190)
    d.ellipse([360, 1060, 980, 1180], fill=PLUM)                                          # compact foam cushion
    d.ellipse([372, 1072, 968, 1168], fill=(60, 176, 168))
    for x in range(410, 940, 56):
        d.ellipse([x - 28, 1066 - 14, x + 28, 1066 + 18], fill=(250, 252, 252))
    for y, x0 in ((1030, 410), (1066, 380)):                                             # two short skis
        d.rounded_rectangle([x0, y - 18, x0 + 500, y + 18], radius=18, fill=PLUM)
        d.rounded_rectangle([x0 + 7, y - 11, x0 + 493, y + 11], radius=11, fill=(214, 70, 52))
        d.pieslice([x0 + 440, y - 80, x0 + 540, y + 18], 270, 90, fill=PLUM)
        d.pieslice([x0 + 452, y - 66, x0 + 528, y + 6], 270, 90, fill=(214, 70, 52))
    d.ellipse([664 - 230 - 12, 820 - 210 - 12, 664 + 230 + 12, 820 + 210 + 12], fill=PLUM)   # round chubby body
    d.ellipse([664 - 230, 820 - 210, 664 + 230, 820 + 210], fill=fur)
    d.ellipse([664 - 140, 720, 664 + 150, 1010], fill=light)
    d.ellipse([680 - 210 - 12, 470 - 190 - 12, 680 + 210 + 12, 470 + 190 + 12], fill=PLUM)  # big head
    d.ellipse([680 - 210, 470 - 190, 680 + 210, 470 + 190], fill=fur)
    d.ellipse([770, 480, 920, 600], fill=muzzle)
    d.ellipse([890, 490, 940, 530], fill=(50, 30, 40))
    for x, y in ((820, 552), (852, 566), (884, 556)):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(120, 80, 60))
    d.ellipse([520, 400, 574, 446], fill=PLUM)                                           # small ear flap
    d.ellipse([528, 408, 566, 440], fill=(130, 84, 50))
    eye(d, 720, 420, 62, iris=(90, 60, 40))
    d.arc([790, 540, 870, 600], 20, 150, fill=PLUM, width=9)
    cheeks(d, [(640, 540)], r=30)
    for (sx, sy), (tx, ty) in (((820, 760), (920, 840)), ((520, 760), (420, 840))):    # front flippers
        paddle(d, (sx, sy), (tx, ty), 100, fur, bend=0.05)
    d.line([(915, 820), (970, 1020)], fill=PLUM, width=20)                              # two small poles
    d.line([(425, 820), (380, 1020)], fill=PLUM, width=20)
    for x, y in ((965, 1000), (384, 1000)):
        d.ellipse([x - 30, y - 10, x + 30, y + 10], fill=PLUM)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def konik_baby(out, route_json=None):
    """Koník Mýdlínek as a hatchling, facing right like his master: a small chubby seahorse with a
    big round head, a short tube snout blowing exactly three small soap bubbles, a crown of exactly
    three knobs, a little back fin and a curled tail, in the master's sunny yellow-orange."""
    img, d = canvas()
    body, belly = (248, 182, 66), (252, 222, 150)
    stamp_path(d, [(560, 640), (600, 800), (560, 940), (500, 1020), (540, 1100), (620, 1090), (610, 1030)], 280, 70, body, outline=PLUM)
    d.ellipse([600, 700, 690, 920], fill=belly)
    d.pieslice([380, 700, 560, 880], 120, 250, fill=PLUM)
    d.pieslice([394, 714, 546, 866], 120, 250, fill=(255, 150, 120))
    d.ellipse([560 - 200 - 12, 480 - 190 - 12, 560 + 200 + 12, 480 + 190 + 12], fill=PLUM)   # big round head
    d.ellipse([560 - 200, 480 - 190, 560 + 200, 480 + 190], fill=body)
    for x, y in ((470, 296), (560, 272), (650, 296)):
        d.ellipse([x - 34, y - 42, x + 34, y + 30], fill=PLUM)
        d.ellipse([x - 24, y - 32, x + 24, y + 20], fill=(255, 200, 90))
    d.rounded_rectangle([700 - 12, 470 - 12, 840 + 12, 540 + 12], radius=46, fill=PLUM)    # short snout
    d.rounded_rectangle([700, 470, 840, 540], radius=36, fill=body)
    d.ellipse([816, 460, 876, 552], fill=PLUM)
    d.ellipse([830, 474, 862, 538], fill=(120, 50, 70))
    eye(d, 600, 450, 70, iris=(60, 130, 120))
    cheeks(d, [(640, 570)], r=30)
    for x, y, r in ((920, 470, 30), (990, 400, 40), (1070, 320, 50)):
        soap_bubble(d, x, y, r)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def pyskoun_baby(out, route_json=None):
    """Pyskoun Pyšný as a hatchling, swimming left like his master: a short round fish, big
    glossy pink lips, exactly three wavy orange stripes on his head, a long dorsal fin, a small
    rounded tail and proud half-closed eyes, in the master's sea green with blue fins."""
    img, d = canvas()
    cy = 690
    green, belly, fin = (70, 186, 140), (200, 236, 196), (90, 150, 210)
    d.pieslice([840, cy - 150, 1080, cy + 150], 280, 80, fill=PLUM)
    d.pieslice([856, cy - 134, 1064, cy + 134], 280, 80, fill=fin)
    d.rectangle([900, cy - 70, 990, cy + 70], fill=PLUM)
    d.rectangle([900, cy - 56, 985, cy + 56], fill=fin)
    d.polygon([(470, cy - 210), (540, cy - 290), (880, cy - 260), (930, cy - 150), (880, cy - 120)], fill=PLUM)
    d.polygon([(486, cy - 205), (550, cy - 276), (870, cy - 248), (912, cy - 152), (870, cy - 130)], fill=fin)
    xs, h = fish_body(d, 300, 960, cy, 250, green, belly, shape=0.45)
    for k in range(3):
        y0 = cy - 140 + k * 70
        pts = [(380 + i * 30, y0 + 16 * math.sin(i * 1.1)) for i in range(8)]
        d.line(pts, fill=(250, 140, 70), width=18, joint="curve")
    paddle(d, (620, cy + 60), (720, cy + 150), 80, fin, bend=0.1)
    d.ellipse([180, cy - 50, 350, cy + 80], fill=PLUM)
    d.ellipse([194, cy - 36, 336, cy + 16], fill=(242, 110, 150))
    d.ellipse([194, cy + 14, 336, cy + 66], fill=(232, 90, 136))
    eye(d, 480, cy - 90, 66, iris=(200, 120, 40))
    d.chord([414, cy - 156, 546, cy - 24], 180, 360, fill=green)
    d.line([(416, cy - 90), (544, cy - 90)], fill=PLUM, width=9)
    cheeks(d, [(430, cy + 50)], r=30)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def jezik_baby(out, route_json=None):
    """Ježík Syčík as a hatchling, facing left like his master: a small puffed-up porcupinefish
    ball with a big head share, exactly fourteen short pale spines, brown spots, a creamy belly, two
    big eyes, a little puckered mouth blowing three small white hiss puffs and a small fan tail."""
    img, d = canvas()
    cx, cy, r = 700, 700, 270
    body, belly, spot = (240, 206, 120), (250, 244, 226), (170, 120, 70)
    for k in range(14):
        a = 2 * math.pi * k / 14 + 0.11
        b1 = (cx + (r - 8) * math.cos(a - 0.13), cy + (r - 8) * math.sin(a - 0.13))
        b2 = (cx + (r - 8) * math.cos(a + 0.13), cy + (r - 8) * math.sin(a + 0.13))
        d.polygon([b1, (cx + (r + 70) * math.cos(a), cy + (r + 70) * math.sin(a)), b2], fill=PLUM)
        c1 = (cx + (r - 4) * math.cos(a - 0.09), cy + (r - 4) * math.sin(a - 0.09))
        c2 = (cx + (r - 4) * math.cos(a + 0.09), cy + (r - 4) * math.sin(a + 0.09))
        d.polygon([c1, (cx + (r + 56) * math.cos(a), cy + (r + 56) * math.sin(a)), c2], fill=(250, 236, 200))
    d.polygon([(cx + r - 30, cy), (cx + r + 110, cy - 100), (cx + r + 110, cy + 100)], fill=PLUM)
    d.polygon([(cx + r - 16, cy), (cx + r + 96, cy - 80), (cx + r + 96, cy + 80)], fill=(230, 170, 90))
    d.ellipse([cx - r - 13, cy - r - 13, cx + r + 13, cy + r + 13], fill=PLUM)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body)
    d.chord([cx - r, cy - r, cx + r, cy + r], 25, 155, fill=belly)
    for x, y in ((800, 520), (880, 640), (760, 610), (900, 760)):
        d.ellipse([x - 22, y - 18, x + 22, y + 18], fill=spot)
    eye(d, 560, 630, 80, iris=(60, 140, 120))
    eye(d, 720, 610, 72, iris=(60, 140, 120))
    d.ellipse([440 - 12, 760 - 34, 440 + 34, 760 + 34], fill=PLUM)
    d.ellipse([440, 760 - 22, 440 + 22, 760 + 22], fill=(150, 60, 80))
    cheeks(d, [(580, 760)], r=30)
    for y in (700, 760, 820):
        d.line([(410 - i * 22, y + 14 * math.sin(i * 1.6)) for i in range(6)], fill=(250, 252, 255), width=14, joint="curve")
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def vydra_baby(out, route_json=None):
    """Vydra Výskalka as a hatchling (an otter pup) facing the viewer like her master: a chubby pup
    with a big flat round head, small low ears, a cream face with puffy whisker pads and whiskers, a
    broad nose, a wide happy open mouth, both short front paws raised high, two hind feet and a
    short thick tail at her side."""
    img, d = canvas()
    fur, cream = (150, 100, 66), (240, 220, 186)
    stamp_path(d, [(780, 1080), (930, 1090), (1020, 1000)], 130, 60, fur, outline=PLUM)
    for x in (560, 770):
        d.ellipse([x - 80 - 12, 1110 - 36 - 12, x + 80 + 12, 1110 + 36 + 12], fill=PLUM)
        d.ellipse([x - 80, 1110 - 36, x + 80, 1110 + 36], fill=(120, 80, 54))
    d.ellipse([664 - 220 - 13, 900 - 220 - 13, 664 + 220 + 13, 900 + 220 + 13], fill=PLUM)
    d.ellipse([664 - 220, 900 - 220, 664 + 220, 900 + 220], fill=fur)
    d.ellipse([664 - 140, 780, 664 + 140, 1080], fill=cream)
    for side in (-1, 1):
        stamp_path(d, [(664 + side * 170, 760), (664 + side * 270, 580), (664 + side * 290, 440)], 100, 86, fur, outline=PLUM)
        d.ellipse([664 + side * 290 - 56, 440 - 56, 664 + side * 290 + 56, 440 + 56], fill=PLUM)
        d.ellipse([664 + side * 290 - 44, 440 - 44, 664 + side * 290 + 44, 440 + 44], fill=(120, 80, 54))
    hx, hy = 664, 560
    for side in (-1, 1):
        d.ellipse([hx + side * 200 - 28, hy - 60 - 26, hx + side * 200 + 28, hy - 60 + 26], fill=PLUM)
        d.ellipse([hx + side * 200 - 18, hy - 60 - 16, hx + side * 200 + 18, hy - 60 + 16], fill=(120, 80, 54))
    d.ellipse([hx - 230 - 13, hy - 170 - 13, hx + 230 + 13, hy + 150 + 13], fill=PLUM)
    d.ellipse([hx - 230, hy - 170, hx + 230, hy + 150], fill=fur)
    d.ellipse([hx - 180, hy - 30, hx + 180, hy + 148], fill=cream)
    for side in (-1, 1):
        d.ellipse([hx + side * 66 - 70, hy - 10, hx + side * 66 + 70, hy + 76], fill=(248, 232, 204))
    d.ellipse([hx - 46, hy - 30, hx + 46, hy + 16], fill=(50, 30, 40))
    open_mouth(d, hx, hy + 92, 44, 28)
    eye(d, hx - 100, hy - 80, 50, iris=(90, 60, 40))
    eye(d, hx + 100, hy - 80, 50, iris=(90, 60, 40))
    for side in (-1, 1):
        for k in range(3):
            d.line([(hx + side * 130, hy + 30 + k * 14), (hx + side * 230, hy + 10 + k * 26)], fill=PLUM, width=5)
    cheeks(d, [(hx - 160, hy + 10), (hx + 160, hy + 10)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def jazyk_baby(out, route_json=None):
    """Jazyk Jazýček as a hatchling, seen from above and gliding left like his master: a small,
    plump, tongue-shaped sole, rounded at the head and tapering to a small tail, a soft frilled fin
    all round, both big eyes together on the upper side near the head, a few soft spots and a smile."""
    img, d = canvas()
    body, fin, spot = (226, 196, 150), (206, 160, 120), (176, 132, 96)
    cy = 690

    def outline(x0, x1, hmax, pad):
        xs = np.linspace(0, 1, 90)
        prof = hmax * np.sin(np.pi * np.clip(xs, 0.0, 1.0)) ** 0.5 * (1.2 - 0.6 * xs) + pad
        top = [(x0 - pad + (x1 - x0 + 2 * pad) * x, cy - p) for x, p in zip(xs, prof)]
        return top + [(x, 2 * cy - y) for x, y in top[::-1]]

    d.polygon([(960, cy), (1080, cy - 100), (1100, cy), (1080, cy + 100)], fill=PLUM)
    d.polygon([(978, cy), (1068, cy - 80), (1086, cy), (1068, cy + 80)], fill=fin)
    d.polygon(outline(280, 980, 240, 56), fill=PLUM)
    d.polygon(outline(280, 980, 240, 44), fill=fin)
    inner, outer = outline(280, 980, 240, 4), outline(280, 980, 240, 40)
    for k in range(4, len(inner) - 4, 5):
        d.line([inner[k], outer[k]], fill=(180, 132, 96), width=6)
    d.polygon(outline(280, 980, 240, 12), fill=PLUM)
    d.polygon(outline(280, 980, 240, 0), fill=body)
    d.line([(470, cy + 10), (940, cy + 10)], fill=(200, 168, 126), width=8)
    for x, y in ((640, 620), (780, 640), (720, 760), (860, 700)):
        d.ellipse([x - 24, y - 18, x + 24, y + 18], fill=spot)
    eye(d, 420, 610, 66, iris=(70, 120, 150))
    eye(d, 540, 580, 60, iris=(70, 120, 150))
    d.arc([340, 690, 440, 760], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(510, 700)], r=28)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def hvezdice_baby(out, route_json=None):
    """Hvězdice Rodinka as a hatchling facing the viewer: a small chubby starfish with exactly five
    short, plump, rounded arms, one pink heart in the middle, two cream bumps on each arm, and a big
    happy face above the heart, in the master's coral orange."""
    img, d = canvas()
    cx, cy = 664, 700
    body, bump = (246, 140, 96), (255, 226, 190)
    for k in range(5):
        a = -math.pi / 2 + 2 * math.pi * k / 5
        stamp_path(d, [(cx, cy), (cx + 340 * math.cos(a), cy + 340 * math.sin(a))], 300, 150, body, outline=PLUM)
    stamp_path(d, [(cx, cy), (cx + 1, cy)], 380, 380, body)
    for k in range(5):
        a = -math.pi / 2 + 2 * math.pi * k / 5
        for t in (0.6, 0.82):
            x, y = cx + 340 * t * math.cos(a), cy + 340 * t * math.sin(a)
            d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=bump)
    hx, hy = cx, cy + 80
    d.polygon([(hx - 90, hy - 30), (hx, hy + 84), (hx + 90, hy - 30)], fill=PLUM)
    d.ellipse([hx - 100, hy - 92, hx + 6, hy + 8], fill=PLUM)
    d.ellipse([hx - 6, hy - 92, hx + 100, hy + 8], fill=PLUM)
    d.polygon([(hx - 78, hy - 28), (hx, hy + 70), (hx + 78, hy - 28)], fill=(240, 90, 130))
    d.ellipse([hx - 88, hy - 80, hx - 4, hy - 4], fill=(240, 90, 130))
    d.ellipse([hx + 4, hy - 80, hx + 88, hy - 4], fill=(240, 90, 130))
    eye(d, cx - 75, cy - 110, 54, iris=(70, 110, 150))
    eye(d, cx + 75, cy - 110, 54, iris=(70, 110, 150))
    d.arc([cx - 46, cy - 70, cx + 46, cy - 20], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(cx - 150, cy - 50), (cx + 150, cy - 50)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def kalmar_baby(out, route_json=None):
    """Kalmar Desetiruký as a hatchling facing the viewer: a short, chubby mantle with two little
    fins, big eyes, and exactly ten short arms below it, eight short arms and two slightly longer
    tentacles with round tips at the outside, each clearly separate, in the master's rosy pink."""
    img, d = canvas()
    body, light = (220, 120, 170), (250, 200, 220)
    cx = 664
    for k in range(10):
        long = k in (0, 9)
        t = (k - 4.5) / 4.5
        base = (cx + t * 190, 820)
        end = (cx + t * (470 if long else 400), 1150 if long else 1060 - abs(t) * 100)
        mid = (cx + t * (310 if long else 290), 990 if long else 960 - abs(t) * 40)
        stamp_path(d, [base, mid, end], 56, 32, body, outline=PLUM)
        if long:
            d.ellipse([end[0] - 44, end[1] - 30, end[0] + 44, end[1] + 30], fill=PLUM)
            d.ellipse([end[0] - 32, end[1] - 18, end[0] + 32, end[1] + 18], fill=body)
    d.polygon([(cx - 150, 360), (cx - 300, 300), (cx - 170, 250)], fill=PLUM)
    d.polygon([(cx + 150, 360), (cx + 300, 300), (cx + 170, 250)], fill=PLUM)
    d.polygon([(cx - 154, 346), (cx - 272, 300), (cx - 172, 264)], fill=body)
    d.polygon([(cx + 154, 346), (cx + 272, 300), (cx + 172, 264)], fill=body)
    mantle = [(cx - 250, 860), (cx - 240, 500), (cx - 150, 280), (cx, 200), (cx + 150, 280), (cx + 240, 500), (cx + 250, 860)]
    d.polygon(mantle, fill=PLUM)
    d.polygon([(x * 0.96 + cx * 0.04, y + (12 if y < 300 else 0)) for x, y in mantle], fill=body)
    d.ellipse([cx - 250, 760, cx + 250, 900], fill=body)
    eye(d, cx - 100, 640, 82, iris=(80, 60, 140))
    eye(d, cx + 100, 640, 82, iris=(80, 60, 140))
    d.arc([cx - 46, 720, cx + 46, 780], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(cx - 190, 740), (cx + 190, 740)], r=26)
    for x, y in ((cx - 50, 380), (cx + 50, 450)):
        d.ellipse([x - 20, y - 16, x + 20, y + 16], fill=light)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def tulen_baby(out, route_json=None):
    """Tuleň Pádík as a hatchling (a seal pup): a round, chubby, dappled grey pup with a big head and
    big dark eyes, no ear flaps, sliding belly-first down a small staircase of exactly seven icy
    steps from the top right to the bottom left, front flippers forward."""
    img, d = canvas()
    ice, edge = (200, 230, 246), (150, 196, 226)
    for k in range(7):
        x0, top = 220 + k * 130, 1160 - (k + 1) * 80
        d.rectangle([x0 - 10, top - 10, x0 + 130 + 10, 1180 + 10], fill=PLUM)
    for k in range(7):
        x0, top = 220 + k * 130, 1160 - (k + 1) * 80
        d.rectangle([x0, top, x0 + 130, 1180], fill=ice)
        d.rectangle([x0, top, x0 + 130, top + 16], fill=(250, 254, 255))
        d.line([(x0, top), (x0, 1180)], fill=edge, width=6)
    coat, belly, spot = (150, 158, 170), (226, 230, 236), (110, 118, 132)
    stamp_path(d, [(980, 470), (830, 560), (680, 650)], 260, 320, coat, outline=PLUM)
    for side in (-1, 1):
        paddle(d, (1040, 440), (1120 + side * 10, 360 + side * 50), 80, coat, bend=0.1 * side)
    d.ellipse([560 - 220 - 13, 640 - 190 - 13, 560 + 220 + 13, 640 + 190 + 13], fill=PLUM)
    d.ellipse([560 - 220, 640 - 190, 560 + 220, 640 + 190], fill=coat)
    for x, y in ((820, 520), (900, 470), (760, 600)):
        d.ellipse([x - 18, y - 14, x + 18, y + 14], fill=spot)
    paddle(d, (520, 800), (380, 880), 90, coat, bend=-0.1)
    paddle(d, (640, 790), (540, 900), 90, coat, bend=-0.1)
    d.ellipse([400, 650, 560, 760], fill=belly)
    d.ellipse([410, 640, 470, 680], fill=(50, 30, 40))
    for x, y in ((450, 700), (480, 712), (510, 704)):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(90, 90, 100))
    eye(d, 520, 560, 60, iris=(40, 30, 40))
    eye(d, 660, 580, 56, iris=(40, 30, 40))
    d.arc([420, 710, 520, 770], 20, 160, fill=PLUM, width=10)
    cheeks(d, [(660, 690)], r=28)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def delfin_baby(out, route_json=None):
    """Delfín Skokánek as a hatchling (a dolphin calf) leaping in a small arc to the right over a
    little curling wave: short and chubby, a big head share, a short beak with a big smile, one
    curved dorsal fin, one flipper, a two-lobed fluke and three water droplets."""
    img, d = canvas()
    body, belly = (110, 160, 210), (226, 238, 248)
    wave = [(300, 1200), (360, 1110), (500, 1070), (680, 1090), (840, 1060), (960, 1000), (1030, 1060), (1060, 1200)]
    d.polygon(wave, fill=(60, 160, 210))
    for x in range(380, 1030, 64):
        d.ellipse([x - 30, 1055 - 16, x + 30, 1055 + 20], fill=(250, 252, 255))
    path = catmull_rom([(420, 880), (520, 650), (720, 530), (920, 620)], samples=10)
    stamp_path(d, path, 150, 250, body, outline=PLUM)
    stamp_path(d, catmull_rom([(480, 830), (570, 680), (740, 620), (900, 670)], samples=10), 60, 100, belly)
    d.polygon([(640, 540), (690, 400), (760, 530)], fill=PLUM)
    d.polygon([(654, 536), (692, 426), (744, 528)], fill=body)
    paddle(d, (420, 900), (310, 990), 110, body, bend=0.15)
    paddle(d, (420, 900), (530, 1000), 110, body, bend=-0.15)
    d.rounded_rectangle([930 - 12, 620 - 36 - 12, 1060 + 12, 620 + 36 + 12], radius=46, fill=PLUM)
    d.rounded_rectangle([930, 620 - 36, 1060, 620 + 36], radius=36, fill=body)
    d.arc([920, 600, 1050, 670], 10, 120, fill=PLUM, width=10)
    paddle(d, (820, 700), (850, 820), 70, body, bend=0.1)
    eye(d, 860, 580, 46, iris=(40, 60, 90))
    cheeks(d, [(900, 650)], r=24)
    for x, y in ((1090, 900), (1140, 840), (1070, 810)):
        d.ellipse([x - 20, y - 28, x + 20, y + 22], fill=PLUM)
        d.ellipse([x - 12, y - 18, x + 12, y + 14], fill=(170, 220, 250))
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def korinek(out, route_json=None):
    """Rak poustevník Kořínek: a cheerful hermit crab facing left, his soft body tucked into a big
    spiral sea-snail shell with exactly three turns of the spiral (the shell is the prefixes and
    suffixes, the crab inside is the root); two eyes on short stalks, one big and one small claw,
    exactly three walking legs showing in front, lilac-orange shell with cream bands."""
    img, d = canvas()
    shell, band, crab = (170, 130, 210), (248, 228, 196), (240, 130, 80)
    cx, cy = 780, 640
    d.ellipse([cx - 360 - 13, cy - 330 - 13, cx + 360 + 13, cy + 330 + 13], fill=PLUM)
    d.ellipse([cx - 360, cy - 330, cx + 360, cy + 330], fill=shell)
    for k, (r, w) in enumerate(((280, 26), (190, 24), (100, 22))):                      # three spiral turns
        d.arc([cx + 40 - r, cy - 20 - r, cx + 40 + r, cy - 20 + r], 120, 420, fill=band, width=w)
        d.arc([cx + 40 - r - 10, cy - 20 - r - 10, cx + 40 + r + 10, cy - 20 + r + 10], 120, 420, fill=PLUM, width=6)
    d.ellipse([cx + 10, cy - 50, cx + 70, cy + 10], fill=band)
    d.chord([cx - 420, cy + 60, cx - 40, cy + 380], 180, 360, fill=PLUM)              # the shell's opening
    d.chord([cx - 404, cy + 76, cx - 56, cy + 364], 180, 360, fill=(80, 50, 90))
    bx, by = cx - 230, cy + 190                                                          # the crab peeking out
    d.ellipse([bx - 140 - 12, by - 110 - 12, bx + 140 + 12, by + 110 + 12], fill=PLUM)
    d.ellipse([bx - 140, by - 110, bx + 140, by + 110], fill=crab)
    for k in range(3):                                                                   # three legs in front
        x = bx - 60 + k * 70
        stamp_path(d, [(x, by + 80), (x - 40, by + 200), (x - 70, by + 260)], 40, 30, crab, outline=PLUM)
    for ex in (bx - 90, bx - 10):                                                        # eye stalks
        stamp_path(d, [(ex, by - 80), (ex - 10, by - 200)], 30, 26, crab, outline=PLUM)
        eye(d, ex - 10, by - 225, 36, iris=(60, 40, 40))
    paddle(d, (bx - 150, by + 20), (bx - 330, by - 20), 150, crab, bend=0.1)            # big claw
    d.polygon([(bx - 350, by - 60), (bx - 300, by - 10), (bx - 360, by + 10)], fill=PLUM)
    paddle(d, (bx - 130, by + 70), (bx - 250, by + 120), 90, crab, bend=-0.1)            # small claw
    d.arc([bx - 70, by + 10, bx + 10, by + 60], 20, 160, fill=PLUM, width=9)
    cheeks(d, [(bx + 40, by + 20)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def humr_inked(out, route_json=None):
    """Humr Nůžkař, inked: a real lobster facing left, grumpy, soaked in magic ink: a long jointed
    body with a segmented tail ending in a fan, two long antennae, two big crusher claws held up and
    open like scissors, exactly four walking legs on the visible side, deep blue-black lobster
    colour with glossy black and violet ink blots, a frowning brow over round eyes."""
    img, d = canvas()
    body, light = (60, 80, 130), (100, 120, 170)
    cy = 760
    for k in range(5):                                                                   # tail segments
        x = 740 + k * 72
        d.ellipse([x - 70 - 12, cy - 90 + k * 6 - 12, x + 70 + 12, cy + 90 - k * 6 + 12], fill=PLUM)
        d.ellipse([x - 70, cy - 90 + k * 6, x + 70, cy + 90 - k * 6], fill=body)
    fx = 740 + 5 * 72
    d.polygon([(fx - 40, cy), (fx + 110, cy - 130), (fx + 140, cy), (fx + 110, cy + 130)], fill=PLUM)
    d.polygon([(fx - 26, cy), (fx + 100, cy - 108), (fx + 124, cy), (fx + 100, cy + 108)], fill=light)
    d.ellipse([360 - 13, cy - 160 - 13, 800 + 13, cy + 160 + 13], fill=PLUM)            # carapace
    d.ellipse([360, cy - 160, 800, cy + 160], fill=body)
    for k in range(4):                                                                   # four walking legs
        x = 480 + k * 80
        stamp_path(d, [(x, cy + 130), (x - 30, cy + 260), (x - 60, cy + 320)], 32, 22, body, outline=PLUM)
    for tx, ty, ang in ((250, 380, -2.3), (470, 330, -1.9)):                              # two big open pincers
        stamp_path(d, [(470, cy - 80), ((470 + tx) / 2 + 30, (cy - 80 + ty) / 2 + 40), (tx, ty)], 74, 64, body, outline=PLUM)
        for da, ln in ((-0.32, 190), (0.32, 160)):                                         # upper and lower jaw
            ex, ey = tx + ln * math.cos(ang + da), ty + ln * math.sin(ang + da)
            stamp_path(d, [(tx, ty), (ex, ey)], 120, 56, body, outline=PLUM)
    for ax in ((380, cy - 130), (400, cy - 120)):                                         # two antennae
        d.line([ax, (220, cy - 360), (180, cy - 520)], fill=PLUM, width=10, joint="curve")
    eye(d, 430, cy - 90, 40)
    d.line([(380, cy - 150), (480, cy - 120)], fill=PLUM, width=20)
    d.arc([370, cy - 10, 450, cy + 40], 200, 340, fill=PLUM, width=10)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((600, cy - 80, 70, 46, ink), (850, cy - 40, 50, 36, violet), (700, cy + 60, 44, 30, violet),
                            (1000, cy - 20, 40, 28, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def moon(out, route_json=None):
    """Měsíční jeskyně laid out on the shell's levelSpots(7): a deep, moonlit cave seen from inside the
    water, indigo and violet, with a pale moon glow from a hole in the cave roof, glowing blue and
    pink crystals and soft bioluminescent spots at the left and in the bottom-right foreground, and
    Humr Nůžkař's lair, a craggy rock overhang with a dark opening, below the monster node."""
    rng = random.Random(48)
    nodes = region_nodes()
    img = vertical_gradient((64, 70, 140), (18, 20, 56))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([620, -260, 1100, 220], fill=(230, 230, 255, 120))
    gd.polygon([(700, 0), (1020, 0), (1180, H * 0.75), (600, H * 0.75)], fill=(200, 210, 255, 40))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(40))).convert("RGB")
    d = ImageDraw.Draw(img)
    d.polygon([(0, 0), (620, 0), (560, 60), (300, 110), (0, 160)], fill=(40, 34, 70))       # cave roof
    d.polygon([(1100, 0), (W, 0), (W, 120), (1300, 80)], fill=(40, 34, 70))
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(70, 66, 110))
    blob(d, 60, 440, 120, 240, (46, 40, 80), rng, n=16, jitter=0.1)                      # left rock wall
    for x, y, c in ((60, 330, (120, 200, 255)), (130, 450, (240, 150, 230)), (50, 580, (120, 200, 255))):
        d.polygon([(x - 30, y + 60), (x, y - 60), (x + 30, y + 60)], fill=c)             # crystals
    mx, my = nodes[-1]
    blob(d, mx + 140, my + 260, 220, 170, (40, 34, 66), rng, n=18, jitter=0.12)          # the lair
    d.polygon([(mx + 90, my + 170), (mx + 130, my + 160), (mx + 120, my + 380), (mx + 96, my + 380)], fill=(10, 10, 24))   # a narrow crevice
    for i in range(7):                                                                   # glowing foreground
        x = 1080 + i * 80 + rng.randint(-15, 15)
        y = H - 70 - rng.randint(0, 40)
        blob(d, x, y, 44, 30, (54, 50, 90), rng)
        d.ellipse([x - 10, y - 30, x + 10, y - 10], fill=[(120, 200, 255), (240, 150, 230)][i % 2])
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (150, 150, 200), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def prisavka(out, route_json=None):
    """Štítovec Přísavka: a real remora (shark sucker) swimming left, slim and long, with the flat
    oval suction disc on top of its head striped with exactly eight ridges, a long dorsal fin and a
    matching anal fin toward the tail, a forked tail, a jutting lower jaw with a friendly smile, and
    a dark stripe along the side; grey-teal back, pale belly."""
    img, d = canvas()
    cy = 680
    back, belly, stripe = (90, 140, 150), (226, 236, 232), (50, 80, 90)
    d.polygon([(1080, cy), (1230, 540), (1180, cy), (1230, 820)], fill=PLUM)
    d.polygon([(1098, cy), (1212, 564), (1162, cy), (1212, 796)], fill=back)
    d.polygon([(760, cy - 70), (840, cy - 150), (1060, cy - 70)], fill=PLUM)              # long dorsal fin
    d.polygon([(776, cy - 74), (842, cy - 134), (1040, cy - 74)], fill=back)
    d.polygon([(760, cy + 70), (840, cy + 150), (1060, cy + 70)], fill=PLUM)              # anal fin
    d.polygon([(776, cy + 74), (842, cy + 134), (1040, cy + 74)], fill=back)
    xs, h = fish_body(d, 180, 1110, cy, 120, back, belly, shape=0.4)
    d.line([(300, cy + 10), (1080, cy + 10)], fill=stripe, width=26)
    d.ellipse([280 - 13, cy - 190 - 13, 600 + 13, cy - 80 + 13], fill=PLUM)              # suction disc on top
    d.ellipse([280, cy - 190, 600, cy - 80], fill=(150, 196, 200))
    for k in range(8):                                                                    # eight ridges
        x = 310 + k * 37
        d.line([(x, cy - 176), (x + 4, cy - 94)], fill=PLUM, width=8)
    d.polygon([(170, cy + 30), (330, cy + 10), (320, cy + 60)], fill=PLUM)                # jutting lower jaw
    d.polygon([(190, cy + 32), (318, cy + 18), (310, cy + 52)], fill=belly)
    paddle(d, (480, cy + 40), (580, cy + 130), 70, back, bend=0.1)
    eye(d, 360, cy - 30, 40, iris=(60, 110, 120))
    d.arc([220, cy, 300, cy + 40], 10, 150, fill=PLUM, width=9)
    cheeks(d, [(400, cy + 40)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def prisavka2(out, route_json=None):
    """Štítovec Přísavka v2: as prisavka, but rounder and softer: a plumper torpedo body, the suction
    disc set down into the top of the head, and a side stripe that tapers and follows the body's
    curve instead of a ruler-straight bar."""
    img, d = canvas()
    cy = 680
    back, belly, stripe = (96, 146, 156), (226, 236, 232), (58, 88, 98)
    d.polygon([(1060, cy), (1210, 530), (1160, cy), (1210, 830)], fill=PLUM)
    d.polygon([(1078, cy), (1192, 556), (1142, cy), (1192, 804)], fill=back)
    d.polygon([(740, cy - 90), (830, cy - 180), (1050, cy - 70)], fill=PLUM)              # long dorsal fin
    d.polygon([(758, cy - 94), (832, cy - 162), (1030, cy - 74)], fill=back)
    d.polygon([(740, cy + 90), (830, cy + 180), (1050, cy + 70)], fill=PLUM)              # anal fin
    d.polygon([(758, cy + 94), (832, cy + 162), (1030, cy + 74)], fill=back)
    xs, h = fish_body(d, 180, 1100, cy, 150, back, belly, shape=0.55)
    pts = catmull_rom([(330, cy + 4), (560, cy + 22), (820, cy + 20), (1060, cy + 2)], samples=12)
    for k, (x, y) in enumerate(pts):                                                      # tapering curved stripe
        w = 22 - 12 * k / (len(pts) - 1)
        d.ellipse([x - w, y - w * 0.7, x + w, y + w * 0.7], fill=stripe)
    d.ellipse([300 - 12, cy - 168 - 12, 590 + 12, cy - 78 + 12], fill=PLUM)               # disc set into the head
    d.ellipse([300, cy - 168, 590, cy - 78], fill=(150, 196, 200))
    for k in range(8):                                                                    # eight ridges
        x = 330 + k * 33
        d.line([(x, cy - 154), (x + 4, cy - 92)], fill=PLUM, width=8)
    d.polygon([(170, cy + 34), (320, cy + 14), (312, cy + 64)], fill=PLUM)                # jutting lower jaw
    d.polygon([(190, cy + 36), (308, cy + 22), (302, cy + 56)], fill=belly)
    paddle(d, (480, cy + 50), (580, cy + 140), 70, back, bend=0.1)
    eye(d, 360, cy - 24, 44, iris=(60, 110, 120))
    d.arc([220, cy + 4, 300, cy + 44], 10, 150, fill=PLUM, width=9)
    cheeks(d, [(410, cy + 46)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def lepka_inked(out, route_json=None):
    """Medúza Lepka, inked: a big round jellyfish who glues words together, grumpy and sticky: a wide
    dome bell with a wavy rim, a frowning face, exactly six thick, gooey, droopy tentacles that drip
    sticky blobs, two of them stuck together at the tips; pale sea-green with glossy black and violet
    ink blots and drips."""
    img, d = canvas()
    bell, goo = (150, 210, 190), (120, 190, 170)
    cx = 664
    for k in range(6):                                                                     # six gooey tentacles
        x0 = cx - 260 + k * 104
        pts = catmull_rom([(x0, 640), (x0 + 36, 800), (x0 - 20, 940), (x0 + 10, 1060)], samples=10)
        stamp_path(d, pts, 90, 66, goo, outline=PLUM)
        d.ellipse([x0 + 10 - 30, 1080, x0 + 10 + 30, 1150], fill=PLUM)                      # a sticky drip below
        d.ellipse([x0 + 10 - 18, 1092, x0 + 10 + 18, 1138], fill=goo)
    stamp_path(d, [(cx - 156, 1050), (cx - 52, 1050)], 60, 60, goo, outline=PLUM)          # two tips glued together
    rim = [(cx - 380 + k * 38, 660 + (24 if k % 2 else 0)) for k in range(21)]
    dome = [(cx - 380, 660), (cx - 360, 480), (cx - 250, 330), (cx, 270), (cx + 250, 330), (cx + 360, 480), (cx + 380, 660)] + rim[::-1]
    d.polygon(dome, fill=PLUM)
    d.polygon([(x * 0.97 + cx * 0.03, y + (10 if y < 640 else -10)) for x, y in dome], fill=bell)
    eye(d, cx - 100, 500, 44)
    eye(d, cx + 100, 500, 44)
    d.line([(cx - 170, 430), (cx - 60, 460)], fill=PLUM, width=20)
    d.line([(cx + 170, 430), (cx + 60, 460)], fill=PLUM, width=20)
    d.arc([cx - 60, 560, cx + 60, 620], 200, 340, fill=PLUM, width=12)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((cx - 220, 420, 60, 40, ink), (cx + 220, 400, 50, 36, violet), (cx + 40, 330, 40, 28, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y0, y1 in ((cx - 220, 450, 560), (cx + 220, 430, 540)):
        thick_path(d, [(x, y0), (x + 6, (y0 + y1) / 2), (x, y1)], 26, 16, ink)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def city(out, route_json=None, door="slit"):
    """Potopené město laid out on the shell's levelSpots(7): the ruins of an old sunken town seen from
    inside the deep-teal water: broken stone columns and an arch with sea plants at the left, tumbled
    stone blocks and a fallen statue head in the bottom-right foreground, and Medúza Lepka's lair, a
    domed ruined temple with a dark doorway, below the monster node."""
    rng = random.Random(49)
    nodes = region_nodes()
    img = vertical_gradient((70, 150, 160), (14, 56, 74))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x0, w in [(520, 100), (840, 90), (1120, 110)]:
        rd.polygon([(x0, 0), (x0 + w, 0), (x0 + w * 2.2, H * 0.7), (x0 + w * 1.2, H * 0.7)], fill=(220, 255, 240, 30))
    img = Image.alpha_composite(img.convert("RGBA"), rays.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(150, 160, 150))
    stone = (170, 176, 170)
    for x, top in ((40, 60), (150, 180)):                                                    # broken columns
        d.rectangle([x - 34, top, x + 34, 520], fill=stone)
        d.rectangle([x - 46, top - 20, x + 46, top + 10], fill=(190, 196, 190))
    d.arc([30, 120, 300, 420], 180, 360, fill=stone, width=40)                               # an arch
    for x in (90, 220, 300):
        d.line([(x, 520), (x + 10, 400)], fill=(60, 150, 110), width=14)
    mx, my = nodes[-1]                                                                       # domed temple lair
    d.rectangle([mx - 20, my + 150, W + 20, my + 420], fill=stone)
    d.pieslice([mx - 20, my + 20, mx + 360, my + 300], 180, 360, fill=(190, 196, 190))
    if door == "sealed":                                                                     # doorway sealed by a round stone slab
        d.rectangle([mx + 70, my + 230, mx + 210, my + 420], fill=(110, 118, 116))
        d.ellipse([mx + 60, my + 220, mx + 220, my + 420], fill=(200, 204, 196))
        for k in range(3):                                                                   # wisps of ink seeping out at its edge
            d.line([(mx + 64 - k * 6, my + 300 + k * 40), (mx + 20 - k * 20, my + 270 + k * 40)], fill=(40, 30, 70), width=10)
    else:
        d.rectangle([mx + 128, my + 250, mx + 152, my + 420], fill=(20, 30, 40))              # a narrow slit of a door
    for i in range(6):                                                                       # tumbled blocks foreground
        x = 1090 + i * 95 + rng.randint(-15, 15)
        y = H - 70 - rng.randint(0, 40)
        d.rectangle([x - 44, y - 32, x + 44, y + 32], fill=[stone, (150, 156, 150)][i % 2])
    d.ellipse([930, H - 230, 1060, H - 90], fill=(180, 184, 176))                            # fallen statue head
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (210, 214, 204), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def klipka(out, route_json=None):
    """Klipka Vzorná: a real butterflyfish swimming left: a tall, flat, round disc-shaped body with a
    small pointed snout, a dark band through the eye, one false eyespot near the tail, and the body
    covered in a neat pattern of exactly fourteen diamond-shaped scales in rows (the fourteen noun
    patterns), a rounded dorsal fin, a small fan tail; sunny yellow with white and blue patterns."""
    img, d = canvas()
    cx, cy = 680, 660
    body, white, band = (250, 210, 70), (252, 248, 236), (40, 50, 80)
    d.polygon([(cx + 250, cy), (cx + 420, cy - 130), (cx + 440, cy + 130)], fill=PLUM)    # fan tail
    d.polygon([(cx + 270, cy), (cx + 406, cy - 106), (cx + 422, cy + 106)], fill=body)
    d.chord([cx - 240, cy - 400, cx + 260, cy + 60], 200, 340, fill=PLUM)                  # rounded dorsal fin
    d.chord([cx - 224, cy - 384, cx + 244, cy + 44], 200, 340, fill=(250, 180, 60))
    d.ellipse([cx - 320 - 13, cy - 310 - 13, cx + 290 + 13, cy + 310 + 13], fill=PLUM)
    d.ellipse([cx - 320, cy - 310, cx + 290, cy + 310], fill=body)
    k = 0
    for row, (y, xs) in enumerate(((cy - 170, (-120, 0, 120)), (cy - 60, (-180, -60, 60, 180)), (cy + 50, (-180, -60, 60, 180)), (cy + 160, (-120, 0, 120)))):
        for x in xs:                                                                       # fourteen diamond scales
            x0 = cx + x + 30
            d.polygon([(x0, y - 44), (x0 + 40, y), (x0, y + 44), (x0 - 40, y)], fill=PLUM)
            d.polygon([(x0, y - 34), (x0 + 30, y), (x0, y + 34), (x0 - 30, y)], fill=[white, (120, 180, 230)][k % 2])
            k += 1
    d.ellipse([cx + 200 - 40, cy - 40, cx + 200 + 40, cy + 40], fill=band)                  # false eyespot
    d.ellipse([cx + 200 - 22, cy - 22, cx + 200 + 22, cy + 22], fill=white)
    d.polygon([(cx - 290, cy - 160), (cx - 230, cy - 160), (cx - 230, cy + 160), (cx - 290, cy + 120)], fill=band)  # eye band
    d.polygon([(cx - 330, cy - 30), (cx - 430, cy), (cx - 330, cy + 30)], fill=PLUM)        # small pointed snout
    d.polygon([(cx - 330, cy - 20), (cx - 410, cy), (cx - 330, cy + 20)], fill=body)
    eye(d, cx - 260, cy - 60, 40, iris=(70, 110, 170))
    d.arc([cx - 380, cy - 10, cx - 320, cy + 30], 10, 150, fill=PLUM, width=8)
    cheeks(d, [(cx - 200, cy + 40)], r=24)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def klipka_baby(out, route_json=None):
    """Klipka Vzorná as a hatchling swimming left: a tiny, very round butterflyfish with a big eye,
    the dark band through the eye, one false eyespot near the tail, exactly six diamond-shaped
    scales in two rows, a small rounded dorsal fin, a small fan tail and a little fish mouth."""
    img, d = canvas()
    cx, cy = 680, 680
    body, white, band = (250, 210, 70), (252, 248, 236), (40, 50, 80)
    d.polygon([(cx + 190, cy), (cx + 320, cy - 100), (cx + 336, cy + 100)], fill=PLUM)
    d.polygon([(cx + 208, cy), (cx + 306, cy - 80), (cx + 318, cy + 80)], fill=body)
    d.chord([cx - 180, cy - 320, cx + 200, cy + 40], 200, 340, fill=PLUM)
    d.chord([cx - 166, cy - 306, cx + 186, cy + 26], 200, 340, fill=(250, 180, 60))
    d.ellipse([cx - 240 - 13, cy - 240 - 13, cx + 230 + 13, cy + 240 + 13], fill=PLUM)
    d.ellipse([cx - 240, cy - 240, cx + 230, cy + 240], fill=body)
    k = 0
    for y in (cy - 60, cy + 70):                                                           # six diamond scales
        for x in (-30, 60, 150):
            x0 = cx + x - 20
            d.polygon([(x0, y - 44), (x0 + 40, y), (x0, y + 44), (x0 - 40, y)], fill=PLUM)
            d.polygon([(x0, y - 34), (x0 + 30, y), (x0, y + 34), (x0 - 30, y)], fill=[white, (120, 180, 230)][k % 2])
            k += 1
    d.ellipse([cx + 200 - 30, cy - 30, cx + 200 + 30, cy + 30], fill=band)                  # false eyespot
    d.ellipse([cx + 200 - 16, cy - 16, cx + 200 + 16, cy + 16], fill=white)
    d.polygon([(cx - 190, cy - 170), (cx - 130, cy - 170), (cx - 130, cy + 150), (cx - 190, cy + 120)], fill=band)  # eye band
    d.ellipse([cx - 252, cy + 22, cx - 228, cy + 46], fill=PLUM)                            # little mouth
    eye(d, cx - 160, cy - 50, 62, iris=(70, 110, 170))
    d.arc([cx - 250, cy + 40, cx - 190, cy + 80], 10, 150, fill=PLUM, width=8)
    cheeks(d, [(cx - 70, cy + 160)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def napodobnice_inked(out, route_json=None):
    """Chobotnice Napodobnice, inked: a mimic octopus who copies patterns wrongly, grumpy and sly,
    soaked in magic ink: a round head with a big brow and two eyes on top, exactly eight long arms
    spread around her, every arm banded in brown and cream stripes (she copies other animals'
    patterns), a sulky smirk, glossy black and violet ink blots on her head."""
    img, d = canvas()
    cx, cy = 664, 560
    brown, cream = (150, 100, 70), (240, 220, 180)
    for k in range(8):                                                                     # eight banded arms
        a = math.pi * (0.05 + 0.9 * k / 7)
        end = (cx + 520 * math.cos(a), cy + 200 + 420 * math.sin(a))
        mid = (cx + 300 * math.cos(a) + 40 * math.sin(k), cy + 200 + 300 * math.sin(a))
        banded_path(d, catmull_rom([(cx + 120 * math.cos(a), cy + 200), mid, end], samples=12), 90, 34, [brown, cream], 55)
    d.ellipse([cx - 260 - 13, cy - 280 - 13, cx + 260 + 13, cy + 260 + 13], fill=PLUM)      # round head
    d.ellipse([cx - 260, cy - 280, cx + 260, cy + 260], fill=brown)
    for k in range(4):                                                                     # head stripes
        y = cy - 200 + k * 80
        d.arc([cx - 230, y - 40, cx + 230, y + 40], 200, 340, fill=cream, width=26)
    eye(d, cx - 100, cy + 40, 50)
    eye(d, cx + 100, cy + 40, 50)
    d.line([(cx - 170, cy - 30), (cx - 40, cy)], fill=PLUM, width=20)
    d.line([(cx + 170, cy - 30), (cx + 40, cy)], fill=PLUM, width=20)
    d.arc([cx - 40, cy + 110, cx + 90, cy + 170], 20, 150, fill=PLUM, width=11)          # sly smirk
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((cx - 140, cy - 160, 60, 40, ink), (cx + 150, cy - 180, 50, 34, violet), (cx, cy - 240, 36, 26, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def trench(out, route_json=None):
    """Temný příkop laid out on the shell's levelSpots(7): a deep, dark ocean trench, midnight blue,
    lit by glowing bioluminescent plants and jelly lights: tall dark rock cliffs with glowing tube
    worms at the left, glowing sea pens and stones in the bottom-right foreground, and Chobotnice
    Napodobnice's lair, a dark rocky crevice glowing faintly purple, below the monster node."""
    rng = random.Random(50)
    nodes = region_nodes()
    img = vertical_gradient((30, 40, 90), (6, 8, 28))
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(40, 46, 80))
    d.polygon([(0, 0), (160, 0), (220, 300), (160, 560), (0, 620)], fill=(20, 22, 50))      # left cliff
    for x, y in ((150, 260), (170, 360), (130, 460)):                                       # glowing tube worms
        d.line([(x, y), (x + 50, y - 60)], fill=(240, 120, 200), width=14)
        d.ellipse([x + 36, y - 82, x + 70, y - 48], fill=(255, 200, 240))
    for x, y in ((420, 150), (700, 90), (1200, 200), (900, 300)):                           # floating jelly lights
        d.ellipse([x - 24, y - 18, x + 24, y + 18], fill=(120, 220, 255))
    mx, my = nodes[-1]
    d.polygon([(mx - 40, my + 120), (mx + 120, my + 80), (W + 20, my + 40), (W + 20, my + 460), (mx + 40, my + 420)], fill=(22, 22, 48))
    d.line([(mx + 96, my + 150), (mx + 80, my + 210), (mx + 106, my + 270), (mx + 84, my + 330), (mx + 100, my + 390)], fill=(150, 90, 210), width=10)   # a thin glowing crack, no opening
    for i in range(7):                                                                      # glowing sea pens
        x = 1080 + i * 80 + rng.randint(-15, 15)
        y = H - 70 - rng.randint(0, 40)
        d.line([(x, y), (x + 6, y - 90)], fill=(120, 220, 255), width=10)
        d.ellipse([x - 12, y - 110, x + 22, y - 76], fill=[(120, 220, 255), (240, 150, 230)][i % 2])
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (90, 96, 140), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def vir_inked(out, route_json=None):
    """Vír Časoplet, inked: a grumpy whirlpool creature that mixes up the tenses: a swirling funnel of
    water seen from the side, wide at the top and narrowing to a curly tip, with exactly three
    spiral bands, a cross face in the top of the funnel, two little wave-arms, and three small clock
    faces swept along in the swirl (yesterday, today, tomorrow); grey-blue water with foamy white
    edges, glossy black and violet ink blots in the swirl."""
    img, d = canvas()
    water, foam = (90, 130, 180), (240, 248, 252)
    cx = 664
    funnel = [(cx - 420, 330), (cx + 420, 330), (cx + 260, 620), (cx + 120, 900), (cx + 40, 1100), (cx - 30, 1150), (cx - 60, 1100), (cx - 120, 900), (cx - 260, 620)]
    d.polygon(funnel, fill=PLUM)
    d.polygon([(x * 0.97 + cx * 0.03, y + (10 if y < 400 else -6)) for x, y in funnel], fill=water)
    for k, (y, w) in enumerate(((470, 340), (700, 220), (930, 110))):                        # three spiral bands
        d.arc([cx - w, y - 70, cx + w, y + 70], 200, 520, fill=foam, width=22)
    d.ellipse([cx - 440, 280, cx + 440, 400], fill=PLUM)                                    # foamy rim
    d.ellipse([cx - 426, 290, cx + 426, 390], fill=foam)
    for side in (-1, 1):                                                                    # two little wave-arms
        stamp_path(d, [(cx + side * 360, 380), (cx + side * 440, 300), (cx + side * 470, 210)], 80, 50, water, outline=PLUM)
        d.ellipse([cx + side * 470 - 46, 172, cx + side * 470 + 46, 248], fill=foam)
    eye(d, cx - 110, 500, 46)
    eye(d, cx + 110, 500, 46)
    d.line([(cx - 180, 430), (cx - 60, 460)], fill=PLUM, width=20)
    d.line([(cx + 180, 430), (cx + 60, 460)], fill=PLUM, width=20)
    d.arc([cx - 60, 570, cx + 60, 630], 200, 340, fill=PLUM, width=12)
    for x, y in ((cx + 300, 760), (cx - 280, 820), (cx + 180, 1000)):                        # three clock faces
        d.ellipse([x - 52, y - 52, x + 52, y + 52], fill=PLUM)
        d.ellipse([x - 42, y - 42, x + 42, y + 42], fill=(252, 240, 200))
        d.line([(x, y), (x, y - 28)], fill=PLUM, width=8)
        d.line([(x, y), (x + 22, y + 6)], fill=PLUM, width=8)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((cx - 200, 640, 60, 40, ink), (cx + 160, 860, 46, 32, violet), (cx - 60, 980, 36, 26, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def storm(out, route_json=None):
    """Bouřlivé moře laid out on the shell's levelSpots(7): a stormy sea seen from just under the
    tossing surface: a dark grey-blue sky band and big rolling waves at the top, a little lighthouse
    on a rock at the top left, swaying sea grass and rocks in the bottom-right foreground, and Vír
    Časoplet's lair, a swirling whirlpool funnel of water, below the monster node."""
    rng = random.Random(51)
    nodes = region_nodes()
    img = vertical_gradient((90, 110, 140), (20, 40, 70))
    d = ImageDraw.Draw(img)
    for k in range(6):                                                                       # rolling waves at the top
        x = k * 300 - 60
        d.pieslice([x, 40, x + 360, 200], 180, 360, fill=(70, 100, 140))
        d.arc([x, 40, x + 360, 200], 200, 330, fill=(220, 236, 244), width=12)
    d.polygon([(0, 140), (260, 120), (300, 210), (0, 240)], fill=(60, 60, 70))                # lighthouse rock
    d.rectangle([110, 20, 160, 130], fill=(240, 236, 228))
    d.rectangle([110, 50, 160, 70], fill=(220, 80, 70))
    d.polygon([(100, 20), (170, 20), (135, -10)], fill=(220, 80, 70))
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(110, 116, 120))
    mx, my = nodes[-1]                                                                       # whirlpool funnel lair
    cx = mx + 150
    d.polygon([(cx - 170, my + 120), (cx + 170, my + 120), (cx + 40, my + 420), (cx - 40, my + 420)], fill=(60, 90, 130))
    for k in range(3):
        y = my + 160 + k * 80
        w = 150 - k * 40
        d.arc([cx - w, y - 30, cx + w, y + 30], 200, 520, fill=(200, 226, 240), width=10)
    for i in range(8):                                                                       # swaying sea grass
        x = 1080 + i * 72 + rng.randint(-12, 12)
        d.line([(x, H - 40), (x + 30, H - 200 - rng.randint(0, 60))], fill=(60, 120, 100), width=14)
        blob(d, x + 10, H - 50, 34, 24, (80, 86, 96), rng)
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (170, 176, 180), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def klauni(out, route_json=None):
    """Klauni Dvojčata: twin clownfish who always swim together, side by side and facing left, one a
    little in front of the other, both bright orange with exactly three white bands outlined in black
    each (head, middle, tail), rounded fins with black edges, happy smiles; the front twin smiles
    with open eyes, the back twin winks."""
    img, d = canvas()
    orange, white, black = (248, 130, 40), (252, 252, 248), (40, 30, 40)

    def fish(ox, oy, s, wink):
        cy = oy
        d.pieslice([ox + 360 * s, cy - 110 * s, ox + 520 * s, cy + 110 * s], 300, 60, fill=PLUM)
        d.pieslice([ox + 372 * s, cy - 98 * s, ox + 508 * s, cy + 98 * s], 300, 60, fill=orange)
        d.chord([ox + 60 * s, cy - 230 * s, ox + 360 * s, cy - 60 * s], 200, 340, fill=PLUM)
        d.chord([ox + 72 * s, cy - 218 * s, ox + 348 * s, cy - 72 * s], 200, 340, fill=orange)
        d.ellipse([ox - 13, cy - 160 * s - 13, ox + 420 * s + 13, cy + 160 * s + 13], fill=PLUM)
        d.ellipse([ox, cy - 160 * s, ox + 420 * s, cy + 160 * s], fill=orange)
        for bx, bw in ((110, 46), (220, 52), (340, 40)):                                    # three white bands
            x0 = ox + bx * s
            hh = 160 * s * math.sqrt(max(0.0, 1 - ((bx - 210) / 215) ** 2))
            d.rounded_rectangle([x0 - bw * s / 2 - 10, cy - hh, x0 + bw * s / 2 + 10, cy + hh], radius=18, fill=black)
            d.rounded_rectangle([x0 - bw * s / 2, cy - hh + 8, x0 + bw * s / 2, cy + hh - 8], radius=14, fill=white)
        paddle(d, (ox + 160 * s, cy + 60 * s), (ox + 230 * s, cy + 150 * s), 70 * s, orange, bend=0.1)
        if wink:
            d.arc([ox + 40 * s, cy - 70 * s, ox + 100 * s, cy - 20 * s], 200, 340, fill=PLUM, width=10)
        else:
            eye(d, ox + 70 * s, cy - 40 * s, 34 * s, iris=(40, 30, 40))
        d.arc([ox + 10 * s, cy + 10 * s, ox + 80 * s, cy + 60 * s], 20, 150, fill=PLUM, width=9)
        cheeks(d, [(ox + 120 * s, cy + 40 * s)], r=int(22 * s))

    fish(420, 480, 1.2, True)
    fish(180, 860, 1.2, False)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def klauni_baby(out, route_json=None):
    """Klauni Dvojčata as hatchlings: two tiny, very round baby clownfish swimming side by side to the
    left, one a little behind and above the other, each with exactly three white bands outlined in
    black, small rounded fins, big eyes; the front twin smiles, the back twin winks."""
    img, d = canvas()
    orange, white, black = (248, 130, 40), (252, 252, 248), (40, 30, 40)

    def fish(ox, oy, s, wink):
        cy = oy
        w, hgt = 300 * s, 140 * s
        d.polygon([(ox + w - 30 * s, cy), (ox + w + 90 * s, cy - 80 * s), (ox + w + 70 * s, cy), (ox + w + 90 * s, cy + 80 * s)], fill=PLUM)
        d.polygon([(ox + w - 20 * s, cy), (ox + w + 80 * s, cy - 64 * s), (ox + w + 60 * s, cy), (ox + w + 80 * s, cy + 64 * s)], fill=orange)
        d.chord([ox + 40 * s, cy - 200 * s, ox + 260 * s, cy - 60 * s], 200, 340, fill=PLUM)
        d.chord([ox + 52 * s, cy - 188 * s, ox + 248 * s, cy - 72 * s], 200, 340, fill=orange)
        d.ellipse([ox - 13, cy - hgt - 13, ox + w + 13, cy + hgt + 13], fill=PLUM)
        d.ellipse([ox, cy - hgt, ox + w, cy + hgt], fill=orange)
        for bx, bw in ((100, 20), (170, 24), (245, 16)):                                    # three white bands
            x0 = ox + bx * s
            hh = hgt * math.sqrt(max(0.0, 1 - ((bx - 150) / 155) ** 2))
            d.rounded_rectangle([x0 - bw * s / 2 - 9, cy - hh, x0 + bw * s / 2 + 9, cy + hh], radius=14, fill=black)
            d.rounded_rectangle([x0 - bw * s / 2, cy - hh + 7, x0 + bw * s / 2, cy + hh - 7], radius=11, fill=white)
        paddle(d, (ox + 130 * s, cy + 50 * s), (ox + 180 * s, cy + 120 * s), 50 * s, orange, bend=0.1)
        if wink:
            d.arc([ox + 22 * s, cy - 56 * s, ox + 66 * s, cy - 20 * s], 200, 340, fill=PLUM, width=10)
        else:
            eye(d, ox + 46 * s, cy - 30 * s, 30 * s, iris=(40, 30, 40))
        d.arc([ox + 8 * s, cy + 14 * s, ox + 60 * s, cy + 52 * s], 20, 150, fill=PLUM, width=9)
        cheeks(d, [(ox + 50 * s, cy + 40 * s)], r=int(14 * s))

    fish(520, 560, 1.25, True)
    fish(320, 860, 1.25, False)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def krakatice_inked(out, route_json=None, rounded=False):
    """Krakatice Inkoustová, inked: the grand finale, a huge giant squid soaked in magic ink, more
    lonely and sulky than wicked: a long rounded mantle pointing up with two big fins, two big round
    sad-grumpy eyes, and exactly ten long arms curling out in a wide fan below (eight arms and two
    longer tentacles with paddle tips), each arm dark-violet with ink drips; deep purple-indigo body,
    glossy black ink blots and drips everywhere, a few pale suckers."""
    img, d = canvas()
    body, light = (90, 60, 140), (180, 150, 220)
    cx = 664
    for k in range(10):                                                                     # ten arms in a wide fan
        long = k in (0, 9)
        t = (k - 4.5) / 4.5
        a = math.pi * (0.5 + 0.42 * t)
        L1 = 500 if long else 430
        end = (cx + L1 * math.cos(a) * 1.05, 640 + L1 * math.sin(a) * 1.0)
        mid = (cx + L1 * 0.55 * math.cos(a) * 1.05 + 60 * (1 if k % 2 else -1) * (1 - abs(t)), 640 + L1 * 0.55 * math.sin(a))
        stamp_path(d, catmull_rom([(cx + t * 150, 650), mid, end], samples=12), 70, 26, body, outline=PLUM)
        if long:
            d.ellipse([end[0] - 46, end[1] - 30, end[0] + 46, end[1] + 30], fill=PLUM)
            d.ellipse([end[0] - 34, end[1] - 18, end[0] + 34, end[1] + 18], fill=body)
    for k in range(10):
        t = (k - 4.5) / 4.5
        a = math.pi * (0.5 + 0.42 * t)
        x, y = cx + 280 * math.cos(a) * 1.05, 640 + 280 * math.sin(a)
        d.ellipse([x - 10, y - 10, x + 10, y + 10], fill=light)
    if rounded:                                                                             # fins joined to a rounded mantle tip
        fin = [(cx - 330, 250), (cx, 40), (cx + 330, 250), (cx, 360)]
        d.polygon(fin, fill=PLUM)
        d.polygon([(cx - 300, 248), (cx, 62), (cx + 300, 248), (cx, 340)], fill=body)
        d.ellipse([cx - 240 - 13, 110 - 13, cx + 240 + 13, 600 + 13], fill=PLUM)
        d.rectangle([cx - 240 - 13, 360, cx + 240 + 13, 690], fill=PLUM)
        d.ellipse([cx - 240, 110, cx + 240, 600], fill=body)
        d.rectangle([cx - 240, 360, cx + 240, 690], fill=body)
        d.ellipse([cx - 240, 600, cx + 240, 740], fill=body)
    else:
        d.polygon([(cx - 170, 200), (cx - 330, 120), (cx - 190, 90)], fill=PLUM)             # two big fins
        d.polygon([(cx + 170, 200), (cx + 330, 120), (cx + 190, 90)], fill=PLUM)
        d.polygon([(cx - 176, 186), (cx - 300, 122), (cx - 192, 104)], fill=body)
        d.polygon([(cx + 176, 186), (cx + 300, 122), (cx + 192, 104)], fill=body)
        mantle = [(cx - 240, 700), (cx - 230, 380), (cx - 140, 160), (cx, 60), (cx + 140, 160), (cx + 230, 380), (cx + 240, 700)]
        d.polygon(mantle, fill=PLUM)
        d.polygon([(x * 0.96 + cx * 0.04, y + (12 if y < 200 else 0)) for x, y in mantle], fill=body)
        d.ellipse([cx - 240, 600, cx + 240, 740], fill=body)

    eye(d, cx - 100, 500, 72, iris=(120, 90, 180))
    eye(d, cx + 100, 500, 72, iris=(120, 90, 180))
    d.line([(cx - 190, 400), (cx - 60, 430)], fill=PLUM, width=20)                        # sad-cross brows
    d.line([(cx + 190, 400), (cx + 60, 430)], fill=PLUM, width=20)
    d.arc([cx - 60, 610, cx + 60, 670], 200, 340, fill=PLUM, width=12)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((cx - 120, 260, 60, 44, ink), (cx + 120, 300, 54, 40, ink), (cx, 180, 40, 30, violet), (cx - 150, 640, 40, 28, ink)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for x, y0, y1 in ((cx - 120, 300, 400), (cx + 120, 340, 430)):
        thick_path(d, [(x, y0), (x + 6, (y0 + y1) / 2), (x, y1)], 26, 16, ink)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def abyss(out, route_json=None):
    """Krakatičí propast laid out on the shell's levelSpots(7): the deepest abyss, a vast dark
    violet chasm with drifting clouds of ink and glowing pearls: tall dark rock spires with glowing
    pearls at the left, glowing anemones in the bottom-right foreground, and the Krakatice's lair, a
    huge dark cave mouth in a cliff with wisps of ink drifting out, below the monster node."""
    rng = random.Random(52)
    nodes = region_nodes()
    img = vertical_gradient((60, 40, 100), (10, 6, 30))
    d = ImageDraw.Draw(img)
    floor = [(0, H)] + [(x, int(H * 0.82 - 0.12 * H * x / W + 10 * math.sin(x / 110.0))) for x in range(0, W + 1, 40)] + [(W, H)]
    d.polygon(floor, fill=(50, 40, 80))
    for x, top, w in ((60, 60, 70), (200, 220, 50)):                                         # rock spires
        d.polygon([(x - w, 600), (x - w * 0.3, top), (x + w * 0.3, top), (x + w, 600)], fill=(30, 22, 56))
        d.ellipse([x - 18, top + 60, x + 18, top + 96], fill=(255, 240, 250))
    for x, y, r in ((500, 120, 90), (900, 70, 110), (1250, 200, 80)):                         # drifting ink clouds
        blob(d, x, y, r, r * 0.5, (36, 26, 60), rng, n=16, jitter=0.2)
    mx, my = nodes[-1]
    d.polygon([(mx - 60, my + 100), (mx + 140, my + 60), (W + 20, my + 10), (W + 20, my + 500), (mx + 20, my + 460)], fill=(26, 18, 48))
    d.line([(mx + 156, my + 150), (mx + 140, my + 220), (mx + 166, my + 290), (mx + 144, my + 360), (mx + 158, my + 420)], fill=(6, 4, 14), width=10)   # a thin crack, no opening
    for k in range(3):
        blob(d, mx + 40 - k * 50, my + 200 + k * 50, 50, 26, (40, 26, 70), rng, n=12, jitter=0.2)
    for i in range(7):                                                                       # glowing anemones
        x = 1080 + i * 80 + rng.randint(-15, 15)
        y = H - 70 - rng.randint(0, 40)
        for kk in range(5):
            aa = math.pi * (1.1 + 0.8 * kk / 4)
            d.line([(x, y), (x + 34 * math.cos(aa), y + 34 * math.sin(aa))], fill=[(240, 150, 230), (120, 220, 255)][i % 2], width=8)
    for x, y in [(90, 870), (330, 895), (560, 880)]:
        blob(d, x, y, 22, 14, (120, 110, 160), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "levelSpotsPx": [[round(x, 1), round(y, 1)] for x, y in nodes]}, f, indent=1)


def map4(out, route_json=None):
    """Grade-4 deep sea map on the shell's REGION_SPOTS (src/app/game/map.ts, thousandths): the deep,
    darkening from indigo at the top to near-black violet at the bottom, each region a calm open
    patch of water with a soft glowing rim and its features around it, linked by a faint glowing
    trail in region order down into the abyss."""
    rng = random.Random(411)
    spots = [("moon-caves", 150, 200), ("sunken-city", 420, 300), ("dark-trench", 280, 620),
             ("storm-sea", 640, 480), ("kraken-abyss", 830, 800)]
    P = {k: (x * W / 1000, y * H / 1000) for k, x, y in spots}
    img = vertical_gradient((60, 80, 150), (14, 10, 40))
    d = ImageDraw.Draw(img)
    for _ in range(22):
        blob(d, rng.randint(0, W), rng.randint(0, H), rng.randint(60, 160), rng.randint(30, 80),
             (50, 60, 120) if rng.random() < 0.5 else (30, 30, 80), rng, jitter=0.3)
    route = catmull_rom([P[k] for k, _, _ in spots], samples=28)
    d.line(route, fill=(80, 120, 190), width=40, joint="curve")
    d.line(route, fill=(150, 200, 240), width=24, joint="curve")
    rx, ry = 108, 74
    for k, (cx, cy) in P.items():
        d.ellipse([cx - rx - 26, cy - ry - 22, cx + rx + 26, cy + ry + 22], fill=(120, 170, 230))
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(70, 110, 180))
    cx, cy = P["moon-caves"]                                                                 # moon cave: a crescent rock and crystals
    blob(d, cx - 170, cy - 40, 70, 110, (40, 34, 70), rng)
    for ax in (-170, -140):
        d.polygon([(cx + ax - 14, cy + 90), (cx + ax, cy + 30), (cx + ax + 14, cy + 90)], fill=(150, 210, 255))
    cx, cy = P["sunken-city"]                                                                 # sunken city: columns
    for ax in (150, 190, 230):
        d.rectangle([cx + ax - 12, cy - 100, cx + ax + 12, cy + 40], fill=(170, 176, 170))
    cx, cy = P["dark-trench"]                                                                 # trench: dark cliffs with glows
    blob(d, cx - 180, cy, 60, 120, (14, 14, 36), rng)
    d.ellipse([cx - 190, cy - 30, cx - 170, cy - 10], fill=(240, 150, 230))
    cx, cy = P["storm-sea"]                                                                   # storm: wave crests
    for ax in (-160, 160):
        d.arc([cx + ax - 60, cy - 130, cx + ax + 60, cy - 50], 180, 360, fill=(230, 240, 250), width=12)
    cx, cy = P["kraken-abyss"]                                                                # abyss: ink clouds and a pearl
    for ax, ay in ((-170, -40), (-150, 60), (160, -60)):
        blob(d, cx + ax, cy + ay, 60, 36, (30, 20, 50), rng)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(out)
    if route_json:
        with open(route_json, "w", encoding="utf-8") as f:
            json.dump({"size": [W, H], "spotsThousandths": {k: [x, y] for k, x, y in spots},
                       "clearingPx": [rx, ry], "route": [[round(x, 1), round(y, 1)] for x, y in route]}, f, indent=1)


def humr_inked2(out, route_json=None):
    """Humr Nůžkař v2: v1's raised claws became paddles. A side-view lobster facing left: the body
    low and long, two big crusher claws reaching FORWARD (left) along the ground, each a fat C-shaped
    pincer with an open gap between its two jaws, four short legs angled back under the body, a
    segmented tail with a fan, two long antennae sweeping back over the body."""
    img, d = canvas()
    body, light = (60, 80, 130), (100, 120, 170)
    cy = 720
    for k in range(5):
        x = 780 + k * 70
        d.ellipse([x - 60 - 12, cy - 80 + k * 6 - 12, x + 60 + 12, cy + 80 - k * 6 + 12], fill=PLUM)
        d.ellipse([x - 60, cy - 80 + k * 6, x + 60, cy + 80 - k * 6], fill=body)
    fx = 780 + 5 * 70
    d.polygon([(fx - 30, cy), (fx + 90, cy - 110), (fx + 120, cy), (fx + 90, cy + 110)], fill=PLUM)
    d.polygon([(fx - 16, cy), (fx + 80, cy - 90), (fx + 104, cy), (fx + 80, cy + 90)], fill=light)
    for k in range(4):                                                                       # four short legs angled back
        x = 560 + k * 70
        stamp_path(d, [(x, cy + 100), (x + 40, cy + 190), (x + 80, cy + 230)], 30, 22, body, outline=PLUM)
    d.ellipse([440 - 13, cy - 150 - 13, 840 + 13, cy + 140 + 13], fill=PLUM)
    d.ellipse([440, cy - 150, 840, cy + 140], fill=body)
    for oy, scale in ((-40, 1.0), (110, 0.9)):                                              # two forward claws
        y = cy + oy
        stamp_path(d, [(520, y), (400, y + 10), (330, y)], 80 * scale, 70 * scale, body, outline=PLUM)
        px, py = 230, y
        d.ellipse([px - 110 * scale - 12, py - 90 * scale - 12, px + 110 * scale + 12, py + 90 * scale + 12], fill=PLUM)
        d.ellipse([px - 110 * scale, py - 90 * scale, px + 110 * scale, py + 90 * scale], fill=body)
        d.polygon([(px - 120 * scale, py - 14 * scale), (px + 10, py - 4), (px - 120 * scale, py + 14 * scale)], fill=(225, 225, 225))   # the open gap
    for ax in ((520, cy - 120), (540, cy - 110)):                                            # antennae sweeping back
        d.line([ax, (700, cy - 400), (1000, cy - 470)], fill=PLUM, width=10, joint="curve")
    eye(d, 540, cy - 90, 40)
    d.line([(490, cy - 150), (590, cy - 120)], fill=PLUM, width=20)
    d.arc([470, cy - 10, 550, cy + 40], 200, 340, fill=PLUM, width=10)
    ink, violet = (28, 20, 38), (70, 42, 110)
    for x, y, rx, ry, c in ((680, cy - 80, 70, 46, ink), (860, cy - 30, 50, 36, violet), (720, cy + 60, 44, 30, violet)):
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def korinek_baby(out, route_json=None):
    """Rak poustevník Kořínek as a hatchling facing left: a tiny hermit crab with a big head share
    tucked into a small round spiral shell with exactly three cream bands, two big eyes on short
    stalks, two small claws (one a bit bigger), three short legs in front."""
    img, d = canvas()
    shell, band, crab = (170, 130, 210), (248, 228, 196), (240, 130, 80)
    cx, cy = 780, 620
    d.ellipse([cx - 280 - 13, cy - 260 - 13, cx + 280 + 13, cy + 260 + 13], fill=PLUM)
    d.ellipse([cx - 280, cy - 260, cx + 280, cy + 260], fill=shell)
    for r, w in ((210, 24), (140, 22), (72, 20)):
        d.arc([cx + 30 - r, cy - 20 - r, cx + 30 + r, cy - 20 + r], 120, 420, fill=band, width=w)
    bx, by = cx - 230, cy + 160
    d.ellipse([bx - 170 - 12, by - 140 - 12, bx + 170 + 12, by + 140 + 12], fill=PLUM)
    d.ellipse([bx - 170, by - 140, bx + 170, by + 140], fill=crab)
    for k in range(3):
        x = bx - 70 + k * 80
        stamp_path(d, [(x, by + 110), (x - 30, by + 200), (x - 50, by + 240)], 44, 34, crab, outline=PLUM)
    for ex in (bx - 100, bx + 10):
        stamp_path(d, [(ex, by - 110), (ex - 6, by - 200)], 34, 30, crab, outline=PLUM)
        eye(d, ex - 6, by - 236, 52, iris=(60, 40, 40))
    paddle(d, (bx - 160, by + 20), (bx - 300, by - 10), 120, crab, bend=0.1)
    paddle(d, (bx - 150, by + 80), (bx - 250, by + 120), 80, crab, bend=-0.1)
    d.arc([bx - 70, by + 10, bx + 10, by + 60], 20, 160, fill=PLUM, width=9)
    cheeks(d, [(bx + 60, by + 30)], r=26)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


def prisavka_baby(out, route_json=None):
    """Štítovec Přísavka as a hatchling swimming left: a tiny, round, chubby remora with a big head
    share, a small oval suction disc on top of the head with exactly five ridges, one short dorsal
    fin and one matching fin underneath, a small forked tail, a soft side stripe, a little smile."""
    img, d = canvas()
    cx, cy = 664, 680
    back, belly, stripe = (112, 152, 156), (242, 236, 214), (78, 112, 118)
    d.polygon([(960, cy), (1080, 560), (1050, cy), (1080, 800)], fill=PLUM)
    d.polygon([(976, cy), (1064, 586), (1034, cy), (1064, 774)], fill=back)
    d.polygon([(720, cy - 140), (800, cy - 250), (930, cy - 90)], fill=PLUM)
    d.polygon([(736, cy - 142), (802, cy - 232), (912, cy - 94)], fill=back)
    d.polygon([(720, cy + 140), (800, cy + 250), (930, cy + 90)], fill=PLUM)
    d.polygon([(736, cy + 142), (802, cy + 232), (912, cy + 94)], fill=back)
    d.ellipse([340 - 13, cy - 170 - 13, 990 + 13, cy + 170 + 13], fill=PLUM)
    d.ellipse([340, cy - 170, 990, cy + 170], fill=back)
    d.chord([340, cy - 170, 990, cy + 170], 0, 180, fill=belly)
    pts = catmull_rom([(500, cy + 4), (700, cy + 18), (940, cy + 4)], samples=10)
    for k, (x, y) in enumerate(pts):
        w = 16 - 8 * k / (len(pts) - 1)
        d.ellipse([x - w, y - w * 0.7, x + w, y + w * 0.7], fill=stripe)
    d.ellipse([420 - 12, cy - 196 - 12, 660 + 12, cy - 116 + 12], fill=PLUM)              # small suction disc
    d.ellipse([420, cy - 196, 660, cy - 116], fill=(160, 170, 176))
    for k in range(5):                                                                    # five ridges
        x = 460 + k * 40
        d.line([(x, cy - 184), (x + 3, cy - 128)], fill=PLUM, width=8)
    paddle(d, (600, cy + 70), (680, cy + 150), 60, back, bend=0.1)
    eye(d, 480, cy - 40, 62, iris=(60, 110, 120))
    d.arc([360, cy + 20, 440, cy + 70], 10, 150, fill=PLUM, width=9)
    cheeks(d, [(540, cy + 50)], r=28)
    img.filter(ImageFilter.GaussianBlur(0.8)).save(out)


if __name__ == "__main__":
    name, out = sys.argv[1], sys.argv[2]
    rj = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--route-json" else None
    {"map-grade3": map3, "map-grade3b": map3b, "lagoon2": lagoon2, "grotto": grotto, "moray": moray,
     "moray2": moray2, "krab": krab, "meduzka": meduzka, "meduzka2": meduzka2, "zelva": zelva,
     "zelva2": zelva2, "osmicka": osmicka, "title": title, "plain-grey": plain_grey,
     "krab-baby": krab_baby, "meduzka-baby": meduzka_baby, "zelva-baby": zelva_baby,
     "avatars": avatars, "zelva-baby2": zelva_baby2, "smouha": inkoustik_smouha, "cmara": inkoustik_cmara,
     "klikyhak": inkoustik_klikyhak, "klikyhak2": inkoustik_klikyhak2, "mroz": mroz, "barakuda": barakuda, "lachtan": lachtan,
     "zralok-inked": zralok_inked, "reef": reef, "konik": konik, "pyskoun": pyskoun,
     "had-inked": had_inked, "kelp": kelp,
     "jezik": jezik, "vydra": vydra, "jazyk": jazyk, "das-inked": das_inked, "wreck": wreck,
     "hvezdice": hvezdice, "zeva-inked": zeva_inked, "bay": bay,
     "kalmar": kalmar, "uhor-inked": uhor_inked, "vents": vents,
     "tulen": tulen, "delfin": delfin, "ledana-inked": ledana_inked, "ice": ice, "lachtan2": lachtan2, "barakuda-baby": barakuda_baby, "lachtan-baby": lachtan_baby, "konik-baby": konik_baby, "pyskoun-baby": pyskoun_baby, "jezik-baby": jezik_baby,
     "vydra-baby": vydra_baby, "jazyk-baby": jazyk_baby, "hvezdice-baby": hvezdice_baby, "kalmar-baby": kalmar_baby, "tulen-baby": tulen_baby,
     "delfin-baby": delfin_baby, "korinek": korinek,
     "humr-inked": humr_inked, "moon": moon,
     "prisavka": prisavka, "prisavka2": prisavka2, "prisavka-baby": prisavka_baby, "klipka-baby": klipka_baby, "klauni-baby": klauni_baby, "lepka-inked": lepka_inked, "city": city, "city3": lambda out, route_json=None: city(out, route_json, door="sealed"),
     "klipka": klipka, "napodobnice-inked": napodobnice_inked, "trench": trench,
     "vir-inked": vir_inked, "storm": storm,
     "klauni": klauni, "krakatice-inked": krakatice_inked, "krakatice-inked2": lambda out, route_json=None: krakatice_inked(out, route_json, rounded=True), "abyss": abyss, "map-grade4": map4, "humr-inked2": humr_inked2, "korinek-baby": korinek_baby}[name](out, rj)
    print(out)
