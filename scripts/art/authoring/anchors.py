"""Anchor helper: draws a labelled grid over a cut-out, or previews placeholder cosmetics at
given anchors (hat on head, goggles on eyes, bow on neck) using the agreed scale convention:
at scale 100 a cosmetic is drawn 250 thousandths of the painting's width wide, centred on its
anchor point and rotated by `rotate` degrees.

Usage:
  python anchors.py grid <cutout.png> <out.png>
  python anchors.py preview <cutout.png> <out.png> '<json anchors in source pixels>'
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFont


def label_font(size):
    for name in ("segoeui.ttf", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def grid(src, out):
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, (235, 235, 240, 255))
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    f = label_font(22)
    for x in range(0, im.width, 50):
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 0, 90) if x % 100 else (255, 0, 0, 200), width=1)
        if x % 100 == 0:
            d.text((x + 2, 2), str(x), font=f, fill=(200, 0, 0))
    for y in range(0, im.height, 50):
        d.line([(0, y), (im.width, y)], fill=(0, 0, 255, 90) if y % 100 else (0, 0, 255, 200), width=1)
        if y % 100 == 0:
            d.text((2, y + 2), str(y), font=f, fill=(0, 0, 200))
    bg.convert("RGB").save(out)


def cosmetic(kind, size):
    """A 100x100 placeholder cosmetic with its attachment point at the centre."""
    img = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "head":   # a party hat: brim at the centre line, cone above
        d.polygon([(200, 30), (120, 200), (280, 200)], fill=(80, 140, 255, 230), outline=(20, 20, 60, 255))
        d.rounded_rectangle([60, 190, 340, 225], radius=14, fill=(255, 200, 40, 240), outline=(20, 20, 60, 255))
    elif kind == "eyes":  # goggles: two lenses either side of the centre
        d.ellipse([40, 140, 180, 260], outline=(20, 20, 60, 255), width=14, fill=(160, 220, 255, 120))
        d.ellipse([220, 140, 360, 260], outline=(20, 20, 60, 255), width=14, fill=(160, 220, 255, 120))
        d.line([(180, 200), (220, 200)], fill=(20, 20, 60, 255), width=12)
    else:                 # a bow tie at the centre
        d.polygon([(200, 200), (70, 130), (70, 270)], fill=(255, 80, 120, 240), outline=(20, 20, 60, 255))
        d.polygon([(200, 200), (330, 130), (330, 270)], fill=(255, 80, 120, 240), outline=(20, 20, 60, 255))
        d.ellipse([175, 175, 225, 225], fill=(200, 40, 90, 255))
    return img.resize((size, size), Image.Resampling.LANCZOS)


def preview(src, out, anchors):
    im = Image.open(src).convert("RGBA")
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = max(8, round(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.02))  # ship_art.py's trim box
    width = min(bbox[2] + pad, im.width) - max(bbox[0] - pad, 0)
    bg = Image.new("RGBA", im.size, (235, 240, 245, 255))
    bg.alpha_composite(im)
    for kind, a in anchors.items():
        size = round(width * 0.25 * a["scale"] / 100)
        c = cosmetic(kind, size).rotate(-a["rotate"], resample=Image.Resampling.BICUBIC, expand=False)
        bg.alpha_composite(c, (round(a["x"] - size / 2), round(a["y"] - size / 2)))
    bg.crop((max(bbox[0] - 40, 0), max(bbox[1] - 260, 0), min(bbox[2] + 40, im.width), bbox[3])).convert("RGB").save(out)


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "grid":
        grid(sys.argv[2], sys.argv[3])
    else:
        preview(sys.argv[2], sys.argv[3], json.loads(sys.argv[4]))
    print(sys.argv[3])
