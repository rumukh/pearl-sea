"""Cut the eight diver avatars out of an avatar sheet (CPU only).

The sheet (sketches.py avatars) has round porthole frames in two rows of four on a plain grey
backdrop. For each cell the frame's silhouette is found as the saturated or dark pixels (the
backdrop and any soft light glow on it are neither), holes filled, the largest part kept; a disc is
fitted to it (same area, centroid) and checked (IoU >= 0.97, so the frame really is round). The
avatar is that disc, anti-aliased at 4x, cropped square, at the sheet's own resolution (never
upscaled).

Usage: python avatar_cut.py <sheet.png> <out_dir>   writes diver-1.png ... diver-8.png and cut.json
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

COLS, ROWS = 4, 2


def disc_alpha(size, cx, cy, r, ss=4):
    yy, xx = np.mgrid[0:size * ss, 0:size * ss]
    inside = (((xx + 0.5) / ss - cx) ** 2 + ((yy + 0.5) / ss - cy) ** 2) <= r * r
    return inside.reshape(size, ss, size, ss).mean(axis=(1, 3))


def main():
    sheet_path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    rgb = np.asarray(Image.open(sheet_path).convert("RGB")).astype(np.float32)
    H, W = rgb.shape[:2]
    cw, ch = W // COLS, H // ROWS
    border = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3)])
    grey = np.median(border, axis=0)
    report = []
    for i in range(COLS * ROWS):
        c, r = i % COLS, i // COLS
        cell = rgb[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
        # The brass frame is saturated; the backdrop and any soft light glow on it are not.
        chroma = cell.max(axis=2) - cell.min(axis=2)
        darker = cell.mean(axis=2) < grey.mean() - 45
        diff = (chroma > 30) | darker
        diff = ndimage.binary_opening(diff, iterations=2)
        diff = ndimage.binary_fill_holes(diff)
        lab, n = ndimage.label(diff)
        sizes = ndimage.sum(diff, lab, range(1, n + 1))
        part = lab == (int(np.argmax(sizes)) + 1)
        cy, cx = ndimage.center_of_mass(part)
        radius = math.sqrt(part.sum() / math.pi)
        yy, xx = np.mgrid[0:part.shape[0], 0:part.shape[1]]
        fitted = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius * radius
        iou = float((fitted & part).sum() / (fitted | part).sum())
        if iou < 0.97:
            raise SystemExit(f"diver-{i + 1}: the frame is not round enough (IoU {iou:.3f})")
        r_cut = radius - 1.5
        side = int(math.ceil(2 * r_cut)) + 4
        x0, y0 = int(round(cx - side / 2)), int(round(cy - side / 2))
        crop = np.zeros((side, side, 3), np.float32)
        sx0, sy0 = max(x0, 0), max(y0, 0)
        sx1, sy1 = min(x0 + side, cell.shape[1]), min(y0 + side, cell.shape[0])
        crop[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = cell[sy0:sy1, sx0:sx1]
        alpha = disc_alpha(side, cx - x0, cy - y0, r_cut)
        rgba = np.dstack([crop, alpha * 255]).clip(0, 255).astype(np.uint8)
        path = os.path.join(out, f"diver-{i + 1}.png")
        Image.fromarray(rgba).save(path)
        report.append({"avatar": f"diver-{i + 1}", "cell": [c, r], "centre": [round(c * cw + cx, 2), round(r * ch + cy, 2)],
                       "radius": round(radius, 2), "cutRadius": round(r_cut, 2), "iouWithDisc": round(iou, 4),
                       "size": [side, side], "file": path})
        print(f"diver-{i + 1}: r {radius:.1f}, IoU {iou:.3f}, {side}x{side}")
    with open(os.path.join(out, "cut.json"), "w", encoding="utf-8") as f:
        json.dump({"sheet": sheet_path, "backdrop": [round(float(v), 1) for v in grey], "avatars": report}, f, indent=1)


if __name__ == "__main__":
    main()
