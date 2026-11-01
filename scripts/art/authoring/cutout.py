"""Cut a painted character out of its plain studio background.

Pipeline (CPU only, offline):
1. rembg's U2Net (u2net.onnx, md5-checked: $U2NET_ONNX, else rembg's own model folder, which is
   $U2NET_HOME or ~/.u2net; WanGP ships the same file in ckpts/rembg) predicts a soft subject mask.
2. A smooth background model is fitted to the plain backdrop and every pixel gets a colour
   distance to it. The outer background is flood-filled from the image border; enclosed
   background-coloured holes are opened only where U2Net also says background.
3. Soft, low-chroma shadows that U2Net rejects are removed; tiny specks are dropped. Opt-in per
   asset: --edge-bleed N also removes light slivers of at most N pixels on the silhouette's edge,
   outside the outline (watercolour bleed); --peel N peels up to N pixel layers of light paint off
   the silhouette's outer edge down to the dark outline (a bleed halo); --min-hole set very high
   keeps every enclosed pocket (a pale painted surface that U2Net calls background, a light stone,
   or eye whites on a white backdrop); --clear X,Y opens the light backdrop pocket at a reviewed
   seed point (between tentacles that touch, where U2Net is sure it is subject); --keep-marks N
   keeps detached painted marks of at least N pixels, clearly unlike the backdrop, that U2Net
   rejects (an Inkoustík's speed marks and ink flecks).
4. A narrow edge band gets a matted alpha (projection between the backdrop colour and the
   nearest interior colour) and decontaminated colours, so no grey fringe remains.

Writes <out>/<stem>.cutout.png (RGBA, full resolution), <stem>.mask-u2net.png,
<stem>.qa.jpg (on checkerboard, navy and white) and <stem>.cutout.json (stats).
"""

import argparse
import hashlib
import json
import os
import sys

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy import ndimage

U2NET_MD5 = "60024c5c889badc19c04ad937298a77b"


def u2net_path():
    home = os.environ.get("U2NET_HOME") or os.path.join(os.path.expanduser("~"), ".u2net")
    path = os.environ.get("U2NET_ONNX") or os.path.join(home, "u2net.onnx")
    with open(path, "rb") as f:
        digest = hashlib.md5(f.read()).hexdigest()
    if digest != U2NET_MD5:
        raise SystemExit(f"{path}: md5 {digest}, expected rembg's u2net.onnx ({U2NET_MD5})")
    return path


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def u2net_mask(img):
    """rembg 2.0.65 U2netSession.predict, run explicitly on the CPU provider."""
    from rembg.sessions.u2net import U2netSession

    session = object.__new__(U2netSession)
    session.model_name = "u2net"
    session.inner_session = ort.InferenceSession(u2net_path(), providers=["CPUExecutionProvider"])
    mask = session.predict(img)[0]
    return np.asarray(mask, dtype=np.float32) / 255.0


def background_model(rgb, hint_bg):
    h, w = rgb.shape[:2]
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                             rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg0 = np.median(border, axis=0)
    cand = hint_bg & (np.abs(rgb - bg0).max(axis=2) < 40)
    f = 8
    small = cv2.resize(rgb, (w // f, h // f), interpolation=cv2.INTER_AREA)
    cs = cv2.resize(cand.astype(np.float32), (w // f, h // f), interpolation=cv2.INTER_AREA)
    num = cv2.GaussianBlur(small * cs[..., None], (0, 0), 10)
    den = cv2.GaussianBlur(cs, (0, 0), 10)[..., None]
    model = np.where(den > 0.02, num / np.maximum(den, 1e-6), bg0)
    return cv2.resize(model.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC), bg0


def cutout(src, out_dir, t_low, t_high, min_hole, band, edge_bleed=0, peel=0, clear=(), keep_marks=0):
    pil = Image.open(src).convert("RGB")
    rgb = np.asarray(pil).astype(np.float32)
    h, w = rgb.shape[:2]
    m = u2net_mask(pil)

    bgm, bg0 = background_model(rgb, m < 0.02)
    d = np.abs(rgb - bgm).max(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2) - bgm.mean(axis=2)

    bgish = d < t_low
    # backdrop-like: grey like the backdrop, from soft shadows (darker) to the backdrop itself
    backdrop_like = (chroma < 16) & (lum > -50) & (lum < 10)
    bgish |= backdrop_like & (m < 0.5)
    # painted drop shadows: cool, desaturated, darker than the backdrop; they are removed only
    # where they connect to the outer background (the plum outline stops the flood)
    shadow_like = (chroma < 40) & (lum > -90) & (lum < 6) & (rgb[..., 2] >= rgb[..., 0] - 10)

    n, labels = cv2.connectedComponents(bgish.astype(np.uint8), connectivity=4)
    edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge_labels = edge_labels[edge_labels > 0]
    outer = np.isin(labels, edge_labels)
    # grow the outer background through backdrop-like and shadow pixels it touches
    grow = backdrop_like | shadow_like
    nb, lb = cv2.connectedComponents((grow | outer).astype(np.uint8), connectivity=4)
    touching = np.unique(lb[outer])
    outer = np.isin(lb, touching[touching > 0]) & (grow | outer)
    holes_opened = 0
    hole = np.zeros_like(outer)
    # enclosed backdrop pockets (between tentacles, inside loops): open unless U2Net is sure
    cand = (backdrop_like | bgish) & ~outer
    n, labels = cv2.connectedComponents(cand.astype(np.uint8), connectivity=4)
    if n > 1:
        areas = np.bincount(labels.ravel(), minlength=n)
        sums = np.bincount(labels.ravel(), weights=m.ravel(), minlength=n)
        lsum = np.bincount(labels.ravel(), weights=lum.ravel(), minlength=n)
        alsum = np.bincount(labels.ravel(), weights=np.abs(lum).ravel(), minlength=n)
        csum = np.bincount(labels.ravel(), weights=chroma.ravel(), minlength=n)
        grey = rgb.mean(axis=2)
        gsum = np.bincount(labels.ravel(), weights=grey.ravel(), minlength=n)
        g2sum = np.bincount(labels.ravel(), weights=(grey * grey).ravel(), minlength=n)
        dark = grey < 120
        for lab in range(1, n):
            if areas[lab] < min_hole:
                continue
            mean_lum = lsum[lab] / areas[lab]
            mean_m = sums[lab] / areas[lab]
            uncertain = mean_m < 0.9 and alsum[lab] / areas[lab] < 25
            # U2Net often fills gaps inside a silhouette; a grey pocket as light as the backdrop
            # (never lighter: that is a highlight) opens anyway
            mean_g = gsum[lab] / areas[lab]
            smooth = g2sum[lab] / areas[lab] - mean_g * mean_g < 15.0 * 15.0
            plain_backdrop = smooth and csum[lab] / areas[lab] < 8 and -30 < mean_lum < 4
            # a real gap is bounded by the character's dark outline (perhaps behind a painted drop
            # shadow); a highlight on glass or metal is bounded by paint, so it stays
            pocket = labels == lab
            ys, xs = np.nonzero(pocket)
            y0, y1 = max(ys.min() - 40, 0), min(ys.max() + 41, pocket.shape[0])
            x0, x1 = max(xs.min() - 40, 0), min(xs.max() + 41, pocket.shape[1])
            sub = pocket[y0:y1, x0:x1]
            spread, _ = ndimage.label(sub | shadow_like[y0:y1, x0:x1])
            ids = np.unique(spread[sub])
            ext = np.isin(spread, ids[ids > 0])
            ring = ndimage.binary_dilation(ext, iterations=3) & ~ext
            outlined = dark[y0:y1, x0:x1][ring].mean() > 0.3 if ring.any() else False
            if (mean_m < 0.3 and mean_lum < 4) or ((uncertain or plain_backdrop) and mean_lum < 4 and outlined):
                hole |= pocket
                holes_opened += 1
    # shadows hugging the opened pockets go with them
    if hole.any():
        nb, lb = cv2.connectedComponents((shadow_like | hole).astype(np.uint8), connectivity=4)
        touching = np.unique(lb[hole])
        hole = np.isin(lb, touching[touching > 0]) & (shadow_like | hole)
    # opt-in (--clear x,y): a light, backdrop-like pocket the rules above kept (U2Net sure it is
    # subject, a warm paper backdrop) is opened from a reviewed seed point
    cleared = []
    for sx, sy in clear:
        light_bd = (rgb.mean(axis=2) > 200) & (chroma < 24)
        if not light_bd[sy, sx]:
            raise SystemExit(f"--clear {sx},{sy} is not on a light backdrop-like pixel")
        lab_c, _ = ndimage.label(light_bd)
        pocket = lab_c == lab_c[sy, sx]
        hole |= pocket
        cleared.append({"seed": [sx, sy], "pixels": int(pocket.sum())})
    bg = outer | hole
    fg = ~bg

    # drop specks that U2Net also rejects; keep detached bits (ink drops, bubbles) it accepts;
    # drop backdrop artefacts that touch the frame edge (e.g. a stray sun) unless U2Net calls them subject
    n2, lab2, stats, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), connectivity=8)
    specks_removed = 0
    edge_artefacts_removed = 0
    marks_kept = 0
    if n2 > 1:
        msum = np.bincount(lab2.ravel(), weights=m.ravel(), minlength=n2)
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        border_ids = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
        for lab in range(1, n2):
            area = stats[lab, cv2.CC_STAT_AREA]
            if lab == biggest:
                continue
            if lab in border_ids and msum[lab] / area < 0.6:
                fg[lab2 == lab] = False
                edge_artefacts_removed += 1
            elif keep_marks and area >= keep_marks and np.median(d[lab2 == lab]) > t_high:
                marks_kept += 1
            elif area < 60 or (area < 4000 and msum[lab] / area < 0.3):
                fg[lab2 == lab] = False
                specks_removed += 1
    # opt-in (--edge-bleed N): light slivers of at most N pixels on the silhouette's edge, outside the
    # dark outline (watercolour bleed, or a sliver of backdrop the key missed), become background
    bleed = np.zeros_like(fg)
    if edge_bleed > 0:
        light = fg & (rgb.min(axis=2) > 195) & (chroma < 40)
        n3, lab3, st3, _ = cv2.connectedComponentsWithStats(light.astype(np.uint8), connectivity=8)
        touching = np.unique(lab3[light & ndimage.binary_dilation(~fg)])
        small = [lab for lab in touching if lab > 0 and st3[lab, cv2.CC_STAT_AREA] <= edge_bleed]
        bleed = np.isin(lab3, small)
        fg &= ~bleed
    # opt-in (--peel N): peel up to N pixel layers of light paint (watercolour bleed past the outline)
    # off the silhouette's outer edge; the dark outline stops it
    peeled_px = 0
    if peel > 0:
        grey_all = rgb.mean(axis=2)
        for _ in range(peel):
            lab_bg, _ = ndimage.label(~fg)
            border = np.unique(np.concatenate([lab_bg[0], lab_bg[-1], lab_bg[:, 0], lab_bg[:, -1]]))
            exterior = np.isin(lab_bg, border[border > 0])
            light_edge = fg & ndimage.binary_dilation(exterior) & (grey_all > 150)
            if not light_edge.any():
                break
            fg &= ~light_edge
            bleed |= light_edge
            peeled_px += int(light_edge.sum())
    # fill pinholes inside the subject
    fg = ndimage.binary_fill_holes(fg) & ~hole | (fg & hole)

    interior = ndimage.binary_erosion(fg, iterations=band)
    near = ndimage.binary_dilation(fg, iterations=band) & ~interior
    _, idx = ndimage.distance_transform_edt(~interior, return_indices=True)
    fcol = rgb[idx[0], idx[1]]
    diff = fcol - bgm
    denom = (diff * diff).sum(axis=2)
    proj = ((rgb - bgm) * diff).sum(axis=2) / np.maximum(denom, 1e-6)
    a_band = np.clip(proj, 0.0, 1.0)
    unreliable = denom < 30.0 ** 2
    a_band = np.where(unreliable, fg.astype(np.float32), a_band)
    alpha = np.where(interior, 1.0, np.where(near, a_band, 0.0)).astype(np.float32)
    alpha[alpha < 0.04] = 0.0
    alpha[alpha > 0.96] = 1.0
    alpha[bleed] = 0.0

    colour = rgb.copy()
    safe = near & (alpha > 0.25)
    dec = (rgb - (1.0 - alpha[..., None]) * bgm) / np.maximum(alpha[..., None], 1e-3)
    colour[safe] = np.clip(dec[safe], 0, 255)
    weak = near & (alpha <= 0.25) & (alpha > 0)
    colour[weak] = fcol[weak]

    rgba = np.dstack([colour, alpha * 255.0]).round().clip(0, 255).astype(np.uint8)
    stem = os.path.splitext(os.path.basename(src))[0]
    os.makedirs(out_dir, exist_ok=True)
    out_png = os.path.join(out_dir, f"{stem}.cutout.png")
    Image.fromarray(rgba, "RGBA").save(out_png, optimize=True)
    Image.fromarray((m * 255).astype(np.uint8), "L").save(os.path.join(out_dir, f"{stem}.mask-u2net.png"))

    # QA sheet: checkerboard, deep navy, white
    tile = 512
    sub = Image.fromarray(rgba, "RGBA")
    sub.thumbnail((tile, tile), Image.Resampling.LANCZOS)
    yy, xx = np.mgrid[0:tile, 0:tile]
    checker = np.where(((yy // 16 + xx // 16) % 2)[..., None] == 0, 205, 245).repeat(3, axis=2).astype(np.uint8)
    sheet = Image.new("RGB", (tile * 3, tile), (0, 0, 0))
    for i, base in enumerate([Image.fromarray(checker), Image.new("RGB", (tile, tile), (16, 32, 72)),
                              Image.new("RGB", (tile, tile), (255, 255, 255))]):
        canvas = base.copy()
        canvas.paste(sub, ((tile - sub.width) // 2, (tile - sub.height) // 2), sub)
        sheet.paste(canvas, (i * tile, 0))
    sheet.save(os.path.join(out_dir, f"{stem}.qa.jpg"), quality=88)

    ys, xs = np.nonzero(alpha > 0)
    hard = alpha >= 0.5
    m5 = m >= 0.5
    iou = float((hard & m5).sum() / max((hard | m5).sum(), 1))
    stats_out = {
        "source": src,
        "sourceSha256": sha256(src),
        "cutout": out_png,
        "cutoutSha256": sha256(out_png),
        "size": [w, h],
        "bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None,
        "coverage": float((alpha > 0.5).mean()),
        "backdropMedianRgb": [round(float(v), 1) for v in bg0],
        "thresholds": {"low": t_low, "high": t_high, "band": band, "minHole": min_hole}
        | ({"edgeBleed": edge_bleed} if edge_bleed > 0 else {}) | ({"peel": peel} if peel > 0 else {})
        | ({"keepMarks": keep_marks} if keep_marks else {}),
        "holesOpened": holes_opened,
        "specksRemoved": specks_removed,
        "edgeArtefactsRemoved": edge_artefacts_removed,
        **({"edgeBleedRemoved": len(small)} if edge_bleed > 0 else {}),
        **({"peeledPixels": peeled_px} if peel > 0 else {}),
        **({"cleared": cleared} if clear else {}),
        **({"marksKept": marks_kept} if keep_marks else {}),
        "iouWithU2net": round(iou, 4),
        "tool": "rembg 2.0.65 U2Net (u2net.onnx, md5 60024c5c889badc19c04ad937298a77b) on onnxruntime CPU + backdrop key and edge matting (cutout.py)",
    }
    with open(os.path.join(out_dir, f"{stem}.cutout.json"), "w", encoding="utf-8") as f:
        json.dump(stats_out, f, indent=2)
    return stats_out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--low", type=float, default=12.0)
    ap.add_argument("--high", type=float, default=30.0)
    ap.add_argument("--min-hole", type=int, default=150)
    ap.add_argument("--band", type=int, default=2)
    ap.add_argument("--edge-bleed", type=int, default=0)
    ap.add_argument("--peel", type=int, default=0)
    ap.add_argument("--clear", action="append", default=[], metavar="X,Y")
    ap.add_argument("--keep-marks", type=int, default=0, metavar="PIXELS")
    args = ap.parse_args()
    seeds = [tuple(int(v) for v in s.split(",")) for s in args.clear]
    for s in args.sources:
        r = cutout(s, args.out, args.low, args.high, args.min_hole, args.band, args.edge_bleed, args.peel,
                   seeds, args.keep_marks)
        print(json.dumps({k: r[k] for k in ("cutout", "bbox", "coverage", "holesOpened", "specksRemoved", "iouWithU2net")}))
    sys.stdout.flush()
