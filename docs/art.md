# Perlové moře art

The painted art of the game: sea friends, monsters, Inkoustíci, characters, scenes and maps. All of
it is made on the authoring PC with **local models only** ([assets.md](assets.md) §1): Qwen Image
Edit Plus 2511 in WanGP for painting and rembg's U2Net for cut-outs. No cloud service is used for
any step. S5 makes and ships the art; the shell (S4) draws it by art ID.

## 1. What ships

| Path                              | Contents                                                                   |
| --------------------------------- | -------------------------------------------------------------------------- |
| `assets/art/catalog.json`         | the published list of art IDs (generated, §4)                              |
| `assets/art/characters/*.webp`    | Profesorka Osmička, Mrož Vousáč and the submarine Bublinka, cut out        |
| `assets/art/friends/*.webp`       | the sea friends, baby and grown up, cut out                                |
| `assets/art/monsters/*.webp`      | the monsters, inked and freed, cut out                                     |
| `assets/art/provenance.json`      | how every file was made and approved (never shipped, §6)                   |
| `assets/art/prompts/*.prompt.txt` | every prompt and negative prompt of each file's lineage (never shipped)    |
| `scripts/art/catalog.mjs`         | the catalog generator and check (`npm run verify` step `art`)              |
| `scripts/art/authoring/*.py`      | the authoring tools: sketches, cut-out, anchors, shipping, provenance (§3) |

Inkoustíci, scenes, maps and avatars join the same folders as they are approved
(`inkoustik/`, `scenes/`, `maps/`, `avatars/`). Art IDs follow the contract (`ART` in
`src/rules/contract/media.ts`); an ID missing from the catalog is drawn as a labelled dev
placeholder by the shell.

**Budgets** (checked by `scripts/art/catalog.mjs`): at most 512 KiB per file and 28 MiB for all
painted art, inside the site's 64 MiB ([assets.md](assets.md) §3). A cut-out character is about
75-105 KiB and a full scene about 120 KiB.

## 2. Style (the user's choice, gate 1)

Of three treatments painted from the same prompt and seed (a white sticker border, a clean plum
outline, soft watercolour without an outline), the user chose **the clean outline**:

- storybook gouache and watercolour with soft brush texture and gentle shading, light from the top
  left, rounded friendly shapes and bright, harmonious colours;
- a clean, confident, medium-weight outline in **deep plum-brown, never black**, around each
  character and its main shapes; no sticker border and no white edge;
- turquoise, coral and sunny colours in the shallows (3rd grade), deepening to indigo with
  bioluminescent accents in the deep (4th grade);
- monsters are grumpy, inky and funny-spooky for eight-year-olds, never gory or frightening; their
  freed forms are bright and smiling, painted from the approved inked master;
- no text, letters, numbers, logos or watermarks in any picture; every word is real text.

Each sea friend's design carries its spelling mnemonic as a **countable feature** (Krab Tvrďák's
seven rim spikes, Medúzka Měkulka's nine tentacles, Želva Obojka's eight shell plates, Profesorka
Osmička's eight arms). The review counts them on every take.

## 3. How a painting is made

All steps run offline on the authoring PC (NVIDIA RTX 4070 Ti SUPER, Windows), one GPU job at a
time; a painting takes 12-16 minutes.

1. **Brief.** A prompt names the character, its real-animal anatomy (a moray's blunt head, no
   neck, no scales, no side fins; a crab's eyes on stalks), the counted features, the mood, the
   style lines of §2 and, for cut-outs, a plain light-grey backdrop with nothing else.
2. **Sketch.** Anything counted or anatomically specific starts from a flat colour-blocking sketch
   drawn by `scripts/art/authoring/sketches.py <name> <out.png>` (Pillow, deterministic). Scenes
   and maps start from a composition sketch that leaves open water where the shell draws its
   markers and nodes (§5). A free composition starts from the blank grey canvas (`plain-grey`).
3. **Painting.** Qwen Image Edit Plus 2511 (20B, Quanto BF16/INT8) in WanGP, headless: 50 steps,
   true CFG 4.0, the FlowMatch Euler sampler, 1328 × 1328 for characters and 1664 × 928 for
   scenes, two or more seeds per brief. A sketch is repainted in place (Scene mode: the
   composition and the counts are kept); the grey canvas is used in Subjects mode with the backdrop
   kept. Steps and quality are never lowered for candidates or final art.
4. **Review.** Every take is checked at full size: counts, anatomy, extra eyes or limbs, human
   features, text, unrequested objects, open water at the layout spots. A small defect on a good
   take is fixed by an **in-place edit** (the take is the reference, the prompt names the single
   change); anything else is repainted with a new seed. Rejected takes are never cropped or padded
   into acceptance.
5. **User gate.** The candidates go to the user on a review board; only the user's explicit choice
   approves a painting. Derived forms (a baby from its grown-up, a freed monster from its inked
   master, a second expression) are painted with the approved master as the reference and gated
   again.
6. **Cut-out** (`cutout.py`, characters only): U2Net predicts a soft mask; a smooth model of the
   grey backdrop gives every pixel a colour distance to it; the outer backdrop is flood-filled from
   the border together with the soft shadows U2Net rejects; enclosed gaps (between tentacles, inside
   a claw) are opened only when they are plain backdrop ringed by the outline; specks are dropped,
   and a narrow edge band gets a matted alpha with colour decontamination, so no grey fringe
   remains.
7. **Shipping** (`ship_art.py`): a cut-out is trimmed to its alpha box plus a 2 % margin, scaled
   with premultiplied alpha so its longer side is at most 1024 px, and encoded as lossy WebP
   (quality 90, method 6) with exact alpha; scenes and maps are scaled to 1664 × 928 and encoded at
   quality 88. Each file is decoded again and compared with what was encoded (PSNR). Pillow writes
   no EXIF, XMP or ICC chunk, and the catalog check rejects them.
8. **Provenance and catalog**: `art_ship.py` runs steps 6-7 for the approved images and writes
   `assets/art/provenance.json` and the prompt files; `node scripts/art/catalog.mjs` writes the
   catalog.

### Lessons from the slice

- Text prompts do not count: the first crabs had 10-12 spikes and the first jellyfish 8 or 10
  tentacles. Anatomy sketches fixed every count.
- A moray from text alone became a snake, a cobra or a crocodile; a sketch with a thick neckless
  body, a blunt head and a continuous back fin, plus negatives (`snake, cobra, hood, crocodile`),
  gave a moray.
- "Baby" paints a human baby in a costume. Young friends are "hatchlings", with no human face,
  nose, hair or eyebrows (also in the negative prompt).
- Negative prompts do not remove belly plates or extra dot eyes; an in-place edit does.
- The model adds unrequested submarines and fish to empty scenes; the review checks for them.
- The word "sticker" paints a white sticker border (clean to cut out, but not the chosen style).

## 4. The catalog and the anchors

`assets/art/catalog.json` (format `pearl-sea-art-catalog/1`, the contract's `artCatalogSchema`) is
generated from `assets/art/provenance.json` and the committed files:

```sh
node scripts/art/catalog.mjs          # write the catalog
node scripts/art/catalog.mjs --check  # verify step "art": fail when stale or a rule is broken
```

Each entry is `{ id, kind, file, width, height, anchors? }`, sorted by ID. The width and height
are read from the WebP header, so they always describe the committed bytes. The check fails when an
ID is listed twice, a file is missing or differs from its recorded SHA-256, a file carries
metadata, a cut-out (friend, monster, Inkoustík, character, avatar) has no alpha, a painted friend
lacks an anchor, a budget is exceeded or the catalog breaks the contract's schema.

**Anchors** say where SVG cosmetics sit on a painted friend: `head` (a hat or a headband sits on
it), `eyes` (the bridge of glasses or goggles) and `neck` (the knot of a scarf, the centre of a
necklace). Each has `x` and `y` in thousandths of the picture box from the top left, `scale` in
percent and `rotate` in degrees, all integers. By the contract's cosmetic anchor scale
(`COSMETIC_VIEWBOX`, `COSMETIC_BASE_WIDTH` and `cosmeticPlacement` in media.ts), a cosmetic is drawn
in a 100 × 100 viewBox with its attachment point at the centre (50, 50); the shell centres it on
the anchor, draws it `scale` % of its natural width, which is 25 % of the painting's width (250
thousandths), and rotates it by `rotate` degrees about that point. Anchors are set on the approved
master in its own pixels and mapped into the trimmed, scaled file by `ship_art.py`, so they follow
the shipped box exactly. The crowned stage's golden crown, `cosmetic/shell-crown`, is such an SVG
too, the centre of its base at the viewBox centre, on the `head` anchor.

## 5. Scenes and maps: open water for the shell

The shell draws its own markers over the painted pictures (S4, `src/app/game/map.ts`, positions in
thousandths of the picture):

- **Sea maps** (`map/shallows`, `map/deep`): each region's marker, an opaque card about 110 × 75 px
  with the region's monster, at `REGION_SPOTS`. The map shows no painted route; the paintings keep
  calm, open water at every spot of their grade's regions.
- **Region scenes** (`scene/<region>`): the level nodes at `levelSpots(n)` with a dashed route
  between them, the monster's node last; the scene keeps open water along that path.

The composition sketches put open water at these spots, and every take is checked with the spots
drawn over it. Scenes are 1664 × 928 (about 16:9), like the shell's scene board.

## 6. Provenance and approval

`assets/art/provenance.json` (format `pearl-sea-art-provenance/1`, never shipped) records for every
file:

- the art ID, the file, its size and SHA-256, and its anchors;
- the **lineage**: the approved painting, then each generated reference it was painted from, down
  to the sketch or the blank canvas, each with the tool (WanGP and its commit), the model and its
  checkpoint files with their SHA-256, the quantization and sampler, the exact prompt and negative
  prompt, the seed, the steps, the true CFG, the resolution, the reference mode, the references
  with their role and SHA-256, the date and the machine;
- the sketch script (`scripts/art/authoring/sketches.py`) and its SHA-256 when a sketch was used;
  the committed script reproduces every referenced sketch byte for byte;
- every processing step: the cut-out with its tool digest and statistics, the trim box, the scale
  factor and filter, the encoder settings, the PSNR and the chunks;
- the user's approval: the gate, the time, the exact question and answer, and the chosen
  candidate. The style decision (gate 1) is recorded once at the top.

GPU generation is not bit-identical across machines, so the committed bytes with their digests are
the asset. The full-resolution renders, their logs and records, the sketches, the review boards
and the decision records stay in the authoring folder outside the repository; the portable names
in the provenance (`<asset folder>/<file>`) refer to that folder.

## 7. Licences

Checked on 2026-10-31 (the details are in the provenance file):

| Component                                 | Licence                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Qwen-Image-Edit-2511 (Qwen)               | Apache-2.0                                                               |
| Qwen2.5-VL-7B-Instruct (its text encoder) | Apache-2.0                                                               |
| DeepBeepMeep/Qwen_image INT8 checkpoints  | a quantized repack of the Apache-2.0 Qwen weights, no separate licence   |
| WanGP (`bb68ded`)                         | WanGP Community License 2.0: outputs may be used; not redistributed here |
| rembg 2.0.65                              | MIT                                                                      |
| U-2-Net weights (`u2net.onnx`)            | Apache-2.0                                                               |

The WanGP licence asks for credit only when an output is sold or licensed; the game is neither, and
this page credits WanGP anyway.

## 8. Reproducing the processing

The painting step needs WanGP and the Qwen checkpoints; everything after it is CPU-only Python
(3.11 with Pillow 11.3, NumPy 2.1, OpenCV, SciPy, onnxruntime and rembg 2.0.65):

```sh
python scripts/art/authoring/sketches.py krab ref-krab.png    # a sketch, byte-identical
U2NET_ONNX=/path/to/u2net.onnx python scripts/art/authoring/cutout.py master.png --out cutouts
PEARL_SEA_ART_ROOT=/path/to/authoring python scripts/art/authoring/art_ship.py . spec.json
node scripts/art/catalog.mjs
```

`cutout.py` finds `u2net.onnx` through `U2NET_ONNX`, else in rembg's model folder (`U2NET_HOME` or
`~/.u2net`), and checks its MD5. These tools are not part of the build or the gate.
