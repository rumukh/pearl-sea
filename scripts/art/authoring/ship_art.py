"""Turn approved masters into shipped game art (CPU only, offline).

Characters: the cut-out (cutout.py) is trimmed to its alpha box plus a small margin, scaled with
premultiplied alpha (no grey fringe) so its longer side is at most --max-side, and encoded as lossy
WebP with lossless-quality alpha. Scenes and maps: RGB, scaled to --max-side, lossy WebP.
Pillow writes no EXIF, XMP or ICC chunk; the result is decoded again and compared with the image
that was encoded (PSNR), and its chunks are listed.

Anchors (friends): points given in source-image pixels are mapped into the shipped image box as
thousandths, so SVG cosmetics land where they were placed on the master.

Usage: python ship_art.py <spec.json>   (writes the files and <spec>.result.json)
spec: {"repo": "...", "items": [{"id", "kind": "character"|"scene", "source", "cutout"?, "file",
       "maxSide", "quality", "anchors"?: {"head": {"x", "y", "scale", "rotate"}, ...}}]}
"""

import hashlib
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    with open(path, "rb") as f:
        return sha256_bytes(f.read())


def chunks(data):
    out, at = [], 12
    while at + 8 <= len(data):
        kind = data[at:at + 4].decode("latin-1")
        size = int.from_bytes(data[at + 4:at + 8], "little")
        out.append(kind)
        at += 8 + size + (size & 1)
    return out


def psnr(a, b):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    mse = np.mean((a - b) ** 2)
    return None if mse == 0 else 10 * math.log10(255.0 ** 2 / mse)


def fmt_db(v):
    return "identical" if v is None else f"{v:.1f} dB"


def visible(img):
    """What a viewer sees: RGBA composited over mid grey (hidden colours under alpha 0 drop out)."""
    base = Image.new("RGBA", img.size, (128, 128, 128, 255))
    return Image.alpha_composite(base, img.convert("RGBA")).convert("RGB")


def encode(img, quality, alpha):
    buf = io.BytesIO()
    params = {"format": "WEBP", "quality": quality, "method": 6}
    if alpha:
        params["alpha_quality"] = 100
        params["exact"] = False
    img.save(buf, **params)
    return buf.getvalue()


def ship_character(item):
    cut = Image.open(item["cutout"]).convert("RGBA")
    box = cut.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    side = max(box[2] - box[0], box[3] - box[1])
    pad = max(8, round(side * 0.02))
    left, top = max(box[0] - pad, 0), max(box[1] - pad, 0)
    right, bottom = min(box[2] + pad, cut.width), min(box[3] + pad, cut.height)
    trimmed = cut.crop((left, top, right, bottom))
    scale = min(1.0, item["maxSide"] / max(trimmed.size))
    size = (max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale)))
    final = trimmed.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA") if scale < 1 else trimmed
    data = encode(final, item["quality"], alpha=True)
    anchors = {}
    for name, a in (item.get("anchors") or {}).items():
        x = (a["x"] - left) * scale / final.width * 1000
        y = (a["y"] - top) * scale / final.height * 1000
        anchors[name] = {"x": int(round(min(max(x, 0), 1000))), "y": int(round(min(max(y, 0), 1000))),
                         "scale": int(a["scale"]), "rotate": int(a["rotate"])}
    steps = [
        {"step": "cut-out", "tool": "cutout.py: rembg 2.0.65 U2Net (u2net.onnx) on CPU + backdrop key and edge matting",
         "cutoutSha256": sha256_file(item["cutout"])},
        {"step": "trim", "box": [left, top, right, bottom], "marginPx": pad},
        {"step": "scale", "factor": round(scale, 6), "filter": "Lanczos on premultiplied alpha", "size": list(final.size)},
    ]
    return final, data, anchors, steps


def ship_scene(item):
    src = Image.open(item["source"]).convert("RGB")
    scale = min(1.0, item["maxSide"] / max(src.size))
    size = (max(1, round(src.width * scale)), max(1, round(src.height * scale)))
    final = src.resize(size, Image.Resampling.LANCZOS) if scale < 1 else src
    data = encode(final, item["quality"], alpha=False)
    steps = [{"step": "scale", "factor": round(scale, 6), "filter": "Lanczos", "size": list(final.size)}]
    return final, data, {}, steps


def main():
    spec_path = sys.argv[1]
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)
    results = []
    for item in spec["items"]:
        final, data, anchors, steps = (ship_character if item["kind"] == "character" else ship_scene)(item)
        decoded = Image.open(io.BytesIO(data))
        decoded.load()
        if item["kind"] == "character":
            quality_db = psnr(visible(decoded), visible(final))
            alpha_db = psnr(decoded.convert("RGBA").getchannel("A"), final.getchannel("A"))
        else:
            quality_db = psnr(decoded.convert("RGB"), final.convert("RGB"))
            alpha_db = None
        found = chunks(data)
        bad = [c for c in found if c in ("EXIF", "XMP ", "ICCP")]
        if bad:
            raise SystemExit(f"{item['id']}: metadata chunks {bad}")
        out = os.path.join(spec["repo"], "assets", "art", *item["file"].split("/"))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(data)
        steps.append({"step": "encode", "codec": f"WebP lossy (libwebp via Pillow), quality {item['quality']}, method 6"
                      + (", alpha quality 100" if item["kind"] == "character" else ""),
                      "psnrDb": None if quality_db is None else round(quality_db, 2),
                      "alphaPsnrDb": None if alpha_db is None else round(alpha_db, 2),
                      "alphaExact": alpha_db is None and item["kind"] == "character",
                      "chunks": found, "metadata": "none"})
        results.append({"id": item["id"], "file": item["file"], "width": final.width, "height": final.height,
                        "bytes": len(data), "sha256": sha256_bytes(data), "sourceSha256": sha256_file(item["source"]),
                        "anchors": anchors or None, "processing": steps})
        print(f"{item['id']}: {final.width}x{final.height}, {len(data) // 1024} KiB, PSNR {fmt_db(quality_db)}"
              + ("" if item["kind"] != "character" else f", alpha {fmt_db(alpha_db)}"))
    with open(spec_path.replace(".json", ".result.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    main()
