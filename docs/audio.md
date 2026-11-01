# Perlové moře audio

The game's music and sound effects, their formats, the manifest the shell reads, the loudness and
memory budgets, and how every file was made. S5 owns the pack (`assets/audio/**`,
`scripts/audio/**`, this file); S4 owns the runtime map from game events to sounds
([app.md](app.md)). The umbrella policy is [assets.md](assets.md): **local models only**, never a
cloud generator.

## 1. What ships

| Sound               | File                                 | Role                                                             | Length                          | Tier                 | Take                |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------- | ------------------------------- | -------------------- | ------------------- |
| `music/grotto`      | `assets/audio/music/grotto.ogg`      | Bublinka's home grotto, and every mood without a loop of its own | 60.64 s loop (24 bars, 95 BPM)  | music (-23 LUFS)     | ACE-Step seed 81001 |
| `music/practice`    | `assets/audio/music/practice.ogg`    | lessons, minigames, Svačinka, placement                          | 44.65 s loop (16 bars, 86 BPM)  | musicCalm (-26 LUFS) | ACE-Step seed 82002 |
| `music/battle`      | `assets/audio/music/battle.ogg`      | monster battles and the race                                     | 57.54 s loop (32 bars, 133 BPM) | music (-23 LUFS)     | ACE-Step seed 83001 |
| `sfx/victory-sting` | `assets/audio/sfx/victory-sting.ogg` | played once when a monster is washed clean (`monster.freed`)     | 9.30 s one-shot                 | music (-23 LUFS)     | ACE-Step seed 84001 |

The user chose every take in the slice music audition (2026-10-31) and approved the mono versions
after an A/B listening (2026-11-01). `music/map` and `music/finale` come with the rest of the
game; until then the map and the finale play the grotto loop. There is no looping victory music:
the approved victory take is a one-shot, so it ships as `sfx/victory-sting` on the effects bus
(coordinator's decision, [plan.md](plan.md) §10).

Sound effects (`sfx/<name>`, about 30: bubble, splash, pearl chime, ink splat and wipe, monster
grumble, coins, egg crack …) are a port of Dragon Valley's deterministic synthesis, re-voiced for
water and rendered at 48 kHz mono. They follow the slice art.

## 2. Format

- **Ogg Vorbis, mono, 48 kHz.** The shell's AudioContext runs at 48 kHz, so nothing is resampled
  on decode and the music keeps its full bandwidth. Decoded audio is held as 32-bit floats at the
  context rate (192 kB per second of mono), so the pack is mono: stereo would double the memory.
- **Loops are a whole number of frames at 22.05, 44.1 and 48 kHz** (a multiple of 320 samples at
  48 kHz), so a loop decoded at any common rate keeps an exact period.
- **No metadata**: the only Vorbis comment is the encoder tag. No titles, dates, prompts or paths.
- Vorbis quality 5 (about 80 kbit/s mono): the four slice files total 1.9 MB.

## 3. The manifest

`assets/audio/manifest.json` (schema `pearl-sea-audio-manifest/1`, Dragon Valley's format renamed)
is **generated**: `node scripts/audio/manifest.mjs` reads `assets/audio/recipes/_manifest.json` and
measures every file from its own Ogg headers. Never edit the manifest by hand.

- `sounds`: `id`, `src`, `bus` (`music` or `effects`), `durationSeconds` (what the shell reads),
  plus `tier`, `loop`, `samples`, `sampleRate`, `channels`, `bytes` and `sha256` for audits.
- `events`: `monster.freed` → `sfx/victory-sting`, played once. The shell keeps the music silent
  for the sting's `durationSeconds`, so that value is measured from the file, never typed.
- `music.states`: the screen moods the shell passes to `setMusic`, each to a loop or `null`:

  | Mood       | Loop             |
  | ---------- | ---------------- |
  | `grotto`   | `music/grotto`   |
  | `practice` | `music/practice` |
  | `battle`   | `music/battle`   |
  | `race`     | `music/battle`   |

  A mood the pack does not list (`map`, `results`, `finale`, …) plays the grotto loop (the shell's
  `musicFor`), so `music/map` and `music/finale` can arrive later without code changes.
  `crossfadeSeconds` is 1.2.

- `revision` is derived from the sound files' digests, so it changes exactly when a sound does.
- `decoded`: the worst case below.

`node scripts/audio/manifest.mjs --check` (the `audio` step of `npm run verify`) fails when the
committed manifest is stale or any rule breaks: contract IDs on the right bus, one mono 48 kHz Vorbis
stream per file with no tags but the encoder's, whole-frame loops, events and states naming known
sounds, and the decoded budget. `test/tooling/audio-pack.test.ts` also checks that the shell's own
reader (`parseAudioManifest`) accepts the manifest and that every sound has provenance.

## 4. Loudness and memory

| Tier        | Target              | Sounds                                            |
| ----------- | ------------------- | ------------------------------------------------- |
| `music`     | -23 LUFS integrated | grotto and battle loops, victory sting            |
| `musicCalm` | -26 LUFS integrated | practice loop: unobtrusive while the child thinks |

Loudness is measured with ITU-R BS.1770 (K-weighting, gating) on the mono file as a single channel,
as Dragon Valley measured its mono files, with a -1 dBTP true-peak ceiling (4× oversampled). Loops
are measured over two periods so the gate sees the seam.

**Decoded-memory budget: 48 MiB** for every sound decoded at once (the SDK's default limit is
64 MiB). The slice uses 31.5 MiB: grotto 11.6 MB, battle 11.0 MB, practice 8.6 MB, sting 1.8 MB.
The map loop, the finale loop and all sound effects must fit in the remaining 16.5 MiB (about
86 seconds of audio): about 30-35 seconds per remaining loop and under 20 seconds of effects.

## 5. How the music was made

All on the authoring PC (NVIDIA RTX 4070 Ti SUPER), offline:

1. **ACE-Step 1.5** (`ace-step/ACE-Step-1.5` at `ca1e85f`) through its local API: the 4B
   `acestep-v15-xl-sft` DiT (int8 weight-only, CPU and DiT offload), 50 ODE steps, guidance 7.0,
   shift 3.0, the `acestep-5Hz-lm-1.7B` planner on vLLM, instrumental, an explicit BPM and key per
   track (grotto 96 BPM F major, practice 84 BPM F major, battle 132 BPM D minor, sting 120 BPM F
   major), 90-second takes (12 for the sting), two seeds per track. The captions are in
   `assets/audio/prompts/`.
2. **Loop cut** (`scripts/audio/authoring/loop.py`): librosa's beat tracker and a robust linear
   fit give the real tempo (ACE-Step lands about 1 % off the requested BPM), the downbeat comes
   from low-frequency onsets, and a bar-aligned loop is chosen in the steady middle where the bar
   before the end sounds like the bar before the start and the bar after the end like the bar after
   the start. The tail is crossfaded (equal power, half a beat) into the audio just before the
   start, so the end flows into the first sample, and the length is rounded to whole frames. The
   measured seam drift is at most 5.3 ms.
3. **Mono** (`scripts/audio/authoring/mono.py`): (L+R)/2 with a phase check per octave band. The
   practice and battle takes had anti-phase high frequencies (they would lose 4.6-8.7 dB in mono),
   so a zero-phase spectral-balance EQ, applied circularly over the loop so the seam stays exact,
   restores every octave band to within 1.3 dB of the stereo balance.
4. **Loudness** to the tier, then **Vorbis** encoding with FFmpeg's libvorbis (bit-exact flags, no
   metadata). The Ogg is decoded again to confirm its exact length.
5. The sting is trimmed from its first note to 0.3 s after its ring-out falls 45 dB below its peak,
   with a short fade, then the same mono, loudness and encoding steps.

`assets/audio/provenance.json` (never shipped) records, for every sound, the tool and the model
revisions with checkpoint digests, the exact caption and settings with the seed, the digest of the
model's output, every processing step with its parameters, the shipped file's digest and the user's
approval. GPU generation is not bit-identical across machines, so the committed bytes with their
digests are the asset.

The authoring scripts are Python (librosa, soundfile, pyloudnorm, SciPy, NumPy) plus FFmpeg; they are
not part of the build or the gate.

## 6. Licences

ACE-Step 1.5's code and models are MIT licensed, and the model card states that generated music may
be used commercially (training data: licensed, royalty-free and synthetic music). Its text encoder,
Qwen3-Embedding-0.6B, is Apache-2.0. Checked on 2026-10-31; the details are in the provenance file.
