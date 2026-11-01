# Assets: art, audio and fonts, and their provenance

This is the umbrella policy for every non-code file the game ships. The art and music are S5's work
on the local GPU queue, and their integration in the app is S4's; the owners document their
pipelines as they land. The domain IDs that key assets are in [contract.md](contract.md), and who
owns which path is in its §2.

## 1. Local models only (binding)

Every image and music track is made with **local models on this PC**:

| Asset                                                                             | Made with                                                         |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Painted art: sea friends, monsters, Inkoustíci, scenes, maps, characters, avatars | **Qwen Image Edit Plus 2511 in WanGP** (local, offline)           |
| Cut-outs of painted characters                                                    | **local rembg**, then alpha cleanup; shipped as WebP              |
| Music loops (instrumental)                                                        | **ACE-Step 1.5** (local)                                          |
| Sound effects                                                                     | Dragon Valley's deterministic synthesis code, re-voiced for water |
| UI, icons, eggs and cosmetics                                                     | SVG                                                               |
| Read-aloud                                                                        | the device's own Czech voices only; nothing is recorded           |

**Never Azure, and never any cloud image, speech or music generator or API.** A cloud route must
never be added, not even as an optional fallback. Dragon Valley's asset policy allowed an Azure
route for painted backgrounds; that route is deliberately not carried over.

Qwen Image, rembg and ACE-Step are permissively licensed (Apache-2.0 or MIT, according to
[plan.md](plan.md) §6). Each model's licence is re-verified before the first asset made with it is
committed. TRELLIS 3D is not used: the presentation is DOM and SVG, and painted 2D art fits it and
tablets better.

## 2. Style and approval

- One style for all: storybook gouache and watercolour, rounded friendly shapes, clean outlines on
  characters, a turquoise, coral and sun palette that darkens toward the deep.
- Monsters are grumpy and inky, never gory. Each is painted twice, inked and freed, and the freed
  form is derived from the approved inked master; a baby friend is derived from its approved
  grown-up. Briefs name real-animal features (the first moray test came out as a snake).
- No text or letters in images: every word a child reads is real text in the reading font. No real
  people, no trademarks, no watermarks. Scenes come from composition sketches that leave open water
  for the UI.
- The user's approval gates, run by the coordinator: the art style (from two or three candidates),
  each batch of characters on a review board, then the art in the running game.
- Throughput: about 12 minutes per image at full quality (50 steps), one GPU job at a time. About
  92 painted images take roughly 18-24 GPU hours, vertical slice first (about 14 images).

The first style tests are in `docs/images/style-tests/` with their `provenance.json`; they are
documentation and never shipped.

## 3. Layout and what ships

| Path                          | Contents                                                                                                       | Owner  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| `assets/art/`                 | `catalog.json`, painted WebP art, SVG eggs and cosmetics, provenance                                           | S5     |
| `assets/audio/`               | music loops, synthesized sound effects, recipes, provenance                                                    | S5     |
| `assets/fonts/pearl-reading/` | Pearl Reading (two WOFF2 faces), `OFL.txt`, `provenance.json`                                                  | S1     |
| `scripts/`                    | `audio/` (the audio manifest generator, authoring tools), the art scripts (planned); `fonts/subset-andika.mjs` | S5, S1 |
| `src/app/`                    | painted-art integration, sound playback, read-aloud                                                            | S4     |

Today the font and the slice's music exist ([audio.md](audio.md)); the painted art and the sound
effects arrive with S5's next batches.

`scripts/build.mjs` copies `assets/**` into the site **except authoring metadata**: `README` files,
`*.md`, `*.prompt.txt`, `*provenance*.json`, anything in `recipes/`, `source/`, `sources/` or
`prompts/` folders, and scripts (`.mjs`, `.cjs`, `.ts`). Everything it ships becomes part of the
offline resource graph (exact bytes and SHA-256).

- Allowed file types are listed in `scripts/lib/site.mjs` (`KIND_BY_EXTENSION`): SVG, PNG, WebP,
  JPEG, AVIF and ICO images; WOFF2, WOFF, TTF and OTF fonts; WAV, Ogg, MP3, M4A and Opus audio;
  JSON, web manifests and text. An unknown extension fails the build on purpose.
- Budgets: at most 32 MiB per file and 64 MiB for the whole site (the SDK's offline defaults), 4096
  files, no empty files. About 92 painted images, six music loops and about 30 sounds must fit
  beside the code and fonts, or the build fails: prefer WebP for painted art, SVG for flat art and
  Ogg/Opus for audio, and keep music loops short.
- Licence files that must travel with a file (`OFL.txt` next to the fonts) are shipped. The build
  also writes `licenses.txt` with the game's and the Aegis SDK's MIT notices.

## 4. Interfaces with code

- **Art catalog** `assets/art/catalog.json` (format `pearl-sea-art-catalog/1`; S5, planned): the
  published list of art IDs. Each entry is `{ id, kind, file, width, height, anchors? }`, where
  `kind` is `painted` or `svg` and `file` is relative to `assets/art/`. Painted friends carry the
  anchors `head`, `eyes` and `neck`, each with `x` and `y` in 0..1000 of the image box, `scale` in
  percent (10..400) and `rotate` in degrees (-180..180), where SVG cosmetics are placed. Content
  refers to art only by these IDs, and the content gate cross-checks every reference once the
  catalog is published (reported, or failing with `--strict-art`).
- **Audio manifest** `assets/audio/manifest.json` (format `pearl-sea-audio-manifest/1`, Dragon
  Valley's format renamed): generated by `scripts/audio/manifest.mjs` from
  `assets/audio/recipes/_manifest.json` and the files themselves ([audio.md](audio.md)). It names
  the music loops `music/grotto`, `music/practice` and `music/battle` (with `music/map` and
  `music/finale` to come; a mood without its own loop plays the grotto's), the one-shot
  `sfx/victory-sting` played when a monster is freed, and later the sound effects `sfx/<name>`
  (`sfx/bubble`, `sfx/splash`, `sfx/pearl-chime`, `sfx/ink-splat`, `sfx/monster-grumble`, …).
  Rules know no sound IDs; the shell maps rules events to sounds.

Art IDs are built from the contract's canonical IDs ([contract.md](contract.md)):

| Art ID                                                             | Kind    | What                                                                   |
| ------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------- |
| `friend/<friend>/baby`, `friend/<friend>/grown`                    | painted | the 18 sea friends; `crowned` is the grown art with an SVG shell crown |
| `egg/<friend>`                                                     | SVG     | each friend's egg                                                      |
| `monster/<monster>/inked`, `monster/<monster>/freed`               | painted | the 12 region monsters                                                 |
| `inkoustik/<id>`                                                   | painted | the four Inkoustíci                                                    |
| `scene/<region>`, `scene/grotto`, `scene/title`                    | painted | the 12 region scenes, Bublinka's home grotto, the title                |
| `map/shallows`, `map/deep`                                         | painted | the sea maps of the 3rd and the 4th grade                              |
| `character/osmicka`, `character/mroz-vousac`, `character/bublinka` | painted | Profesorka Osmička, Mrož Vousáč and the submarine Bublinka             |
| `avatar/diver-1` … `avatar/diver-8`                                | painted | the diver avatars                                                      |
| `cosmetic/<item>`                                                  | SVG     | hats, goggles, scarves, shell crowns, grotto decorations               |
| `sticker/<sticker>`                                                | SVG     | the sticker album                                                      |

## 5. Provenance rules

Every shipped asset has recorded provenance that lets anyone audit it, and reproduce it where the
process is deterministic.

1. **Generated by code** (SVG, synthesized sound effects): the generator, its inputs (recipe,
   palette, seed) and the output digest are committed. A test regenerates the output and compares
   bytes, so the committed file is always the generator's output.
2. **Made with a local model** (painted art, cut-outs, music): GPU generation is not guaranteed to
   be bit-identical across machines, drivers or library versions, so the committed bytes, with
   their digests, are the asset. A provenance record next to the files (a `provenance.json`; long
   prompts may sit in `*.prompt.txt` files or a `prompts/` folder), never shipped, gives for each
   asset, as `docs/images/style-tests/provenance.json` does:
   - the tool and the model with its revision or quantization (for example WanGP with "Qwen Image
     Edit Plus (2511) 20B, Quanto BF16/INT8 transformer");
   - the exact prompt, the seed, the steps and the other sampler settings;
   - the reference it started from (a composition sketch, an approved master or a blank canvas);
   - the date and the machine;
   - the SHA-256 of the model's output and of the shipped file;
   - every post-processing step (rembg cut-out, alpha cleanup, scaling, encoding, trimming).
3. **Third-party files** (fonts): only permissive licences compatible with redistribution in a
   public repository and an offline web app (SIL OFL for fonts). Keep the licence text, the source
   URL, the version and the SHA-256.
4. **Nothing else**: no cloud generators, no stock art, no samples from the internet, no recorded
   voices (read-aloud uses the device's local speech), no assets whose licence forbids
   redistribution.

## 6. The reading font

Pearl Reading is a renamed subset of Andika 7.000 by SIL Global (SIL Open Font License 1.1), made
by `scripts/fonts/subset-andika.mjs`, a port of Dragon Valley's.

- **Coverage**: the Czech alphabet in both cases (á č ď é ě í ň ó ř š ť ú ů ý ž), digits, the
  quotation marks „ “ ‚ ‘ and the apostrophe ’, the dashes, the ellipsis, the no-break spaces that
  keep one-letter words off line ends, and the arrows ← → ↑ ↓ ↔ ↕ that show word relations in hints
  (_mlýn → mlynář_). Two faces, Regular (400) and Bold (700), each at most 80 KiB.
- **Letterforms**: Andika's defaults are kept on purpose: a round dot on i, an acute on í, a curved
  tail on y and ý, a barred capital I and the apostrophe-style caron on ď and ť. Telling i, í, y
  and ý apart is what the game teaches.
- **Licence**: subsetting is a modification (OFL FAQ 2.6) and "Andika" and "SIL" are Reserved Font
  Names, so the family is renamed. The copyright and licence records are kept, and `OFL.txt` (line
  endings normalised to LF, text unchanged) ships next to the fonts.
- **Provenance**: `assets/fonts/pearl-reading/provenance.json` records the release and its archive
  digest, the licence file, the modification, the code point ranges, the required characters, the
  tool versions and each face's bytes and SHA-256 with its source file.
- **Rebuild**: download the release
  (`gh release download v7.000 -R silnrsi/font-andika -p Andika-7.000.zip`), extract it and run
  `npm run fonts:subset -- --source <Andika-7.000 folder>`. Every source file is checked against
  its pinned SHA-256; `--check` rebuilds in memory and compares the bytes with the committed files.
- **Checks**: `test/unit/app/fonts.test.ts` (provenance, renaming, coverage, i/í/y/ý distinctness),
  the content gate (every catalog character is in the font) and `test/e2e/smoke.spec.ts` (browsers
  draw Czech text in it). The shell loads it from the same origin and waits for it at most 2.5 s.

## 7. Determinism across machines

Generated assets are committed with digests and checked in CI on Windows and Ubuntu, so generators
must produce **byte-identical output on every OS**:

- avoid `Math.sin`, `Math.cos`, `Math.exp`, `Math.pow` and friends in generators whose output is
  digest-checked: libm results differ across platforms. Use integer DSP, lookup tables or the
  deterministic math in `@aegis/core/math`;
- format numbers explicitly (fixed decimals), never with locale functions;
- sort object keys and file lists by code units; write LF line endings;
- seed any randomness from the recipe (`@aegis/core` `createPrng`).

## 8. Accessibility of assets

- Colour is never the only signal (feedback also changes shape, motion, sound and text).
- Contrast that depends on art is reviewed with the art in the running game.
- Every meaningful image has an accessible name from the catalogs; decorative art is `aria-hidden`,
  like the bubbles and pearls of today's title screen.
- Animations have reduced-motion variants; sounds have visual equivalents.
