# Performance: the Slunná laguna slice

What a child's tablet has to download, how soon the first screen is ready and answers a tap on a
slow connection and a slow processor, how fast an answer gets its feedback, how long the page is
ever too busy to respond, and how much memory the music takes once decoded.
`test/e2e/perf.spec.ts` and `test/e2e/audio.spec.ts` check every budget on each run and write the
measurements to the QA summary ("Performance"), so a budget is revisited with numbers in hand.

## Budgets

| What                                                    | Budget       | Now          | Notes                                                                                   |
| ------------------------------------------------------- | ------------ | ------------ | --------------------------------------------------------------------------------------- |
| `app.js` as built / gzipped                             | 650 / 210 KB | 514 / 168 KB | the whole game: rules, SDK, screens, inline SVG art                                     |
| `app.css` as built / gzipped                            | 100 / 20 KB  | 71 / 13 KB   |                                                                                         |
| Offline pack without its audio                          | 6 MB         | 4.08 MB      | 64 files, with S5's slice paintings (#38); more paintings are coming                    |
| Whole offline pack (`resource-graph.json`)              | 8.5 MB       | 5.94 MB      | 68 files; the audio is 1.86 MB of it                                                    |
| First visit: downloaded before the title (uncompressed) | 2.4 MB       | 2.10 MB      | 510 KB as GitHub Pages sends it (budget 600 KB), with the title's painting; 520 KB live |
| First visit, fast 4G, processor ×4: title ready         | 5 s          | 2.85 s       | first paint 0.36 s (budget 1.5 s); live site: 1.45 s                                    |
| First visit, slow 4G, processor ×4: title ready         | 16 s         | 12.09 s      | first paint 1.13 s (budget 3 s); the test server sends text uncompressed; live: 4.33 s  |
| Feedback after an answer, processor ×4 (median of 7)    | 500 ms       | 101 ms       | slowest of the seven 122 ms                                                             |
| Longest task while a round is played, processor ×4      | 400 ms       | 101 ms       | 8 long tasks (over 50 ms) in seven answers                                              |
| Decoded audio                                           | 48 MiB       | 23.3 MiB     | after the grotto, the battle and the sting; 31.5 MiB if all four sounds are decoded     |

"Now" is main `f073cff` (content 1.2.5, after #38's art and #42) with this branch's specs,
measured in Edge on the development machine with the browser alone (one worker), 2026-11-01; the
throttling is the Chrome DevTools Protocol's (Lighthouse's mobile profiles: fast 4G 40 ms and
9 Mbit/s, slow 4G 150 ms and 1.6 Mbit/s, each with a processor four times slower). Timings are
held to their budgets only when the browser has the machine nearly to itself (at most two workers,
as on CI); sizes always. Sizes are in decimal units (1 KB = 1 000 bytes). The title's best of
three cold visits is held to the budget. The first visit's gzipped bytes are at 85 % of their
budget: the next painting fetched at boot needs the budget revisited.

## What the first screen costs

A first visit downloads eleven files before the title is ready:

| File                                   | As built | As Pages sends it |
| -------------------------------------- | -------: | ----------------: |
| `content/pearl-sea.content.json`       | 1 242 KB |            112 KB |
| `app.js`                               |   514 KB |            168 KB |
| `assets/art/scenes/title.webp`         |   119 KB |            119 KB |
| `app.css`                              |    71 KB |             13 KB |
| `content/catalogs/cs.content.json`     |    54 KB |             15 KB |
| Reading font, regular and bold (WOFF2) |    78 KB |             78 KB |
| `assets/art/catalog.json`              |     8 KB |              1 KB |
| `content/catalogs/en.content.json`     |     5 KB |              2 KB |
| `assets/audio/manifest.json`           |     2 KB |              1 KB |
| `index.html`                           |     1 KB |              1 KB |
| **Total**                              | 2 097 KB |            510 KB |

The content pack of all twelve regions is most of it (1.24 MB, 112 KB gzipped). The title's
painting is fetched at boot beside it (since #42, PS-QA-20), so the title appears with its
painting. Nothing else loads until the child does something: the other paintings when their
screen first shows them, each music loop when it first plays (the grotto's 626 KB at the first
tap), and the offline pack only when a grown-up installs it (5.94 MB, in the background, with
progress shown).

## The deployed site

Measured from outside at https://rumukh.github.io/pearl-sea/ (`f073cff`), cold, in Edge with the
same throttling; GitHub Pages sends text gzipped:

| Connection, processor ×4 | Title ready (3 visits) | First paint | Title painting arrived | Hrát to the next screen | Downloaded |
| ------------------------ | ---------------------- | ----------- | ---------------------- | ----------------------- | ---------- |
| Fast 4G                  | 3.22 s, 1.45 s, 1.48 s | 0.26-1.48 s | 0.78-2.27 s            | 387-566 ms              | 520 KB     |
| Slow 4G                  | 4.40 s, 4.25 s, 4.33 s | 0.56-0.59 s | 3.15-3.16 s            | 506-553 ms              | 520 KB     |

The title's painting arrives before the title in every visit, so the title is never shown without
it. Before #42 (main `a729482`, no painting yet) the title was ready on slow 4G in 3.6 s; fetching
the painting at boot costs about 0.7 s there. Hrát takes longer to the next screen than before
(about 230 ms then): the router waits up to 320 ms for that screen's pictures, now the painted
avatars. The first fast visit includes a cold DNS and TLS handshake. "Hrát to the next screen" is
timed from Playwright's tap, so it includes the tap's own checks; the first tap also unlocks the
sound. `live.spec.ts` checks the deployed site's boot, compression, music and offline play on
request.

## Feedback after an answer

Praise or kind help must follow an answer at once, also on a slow tablet. Timed in the page from
the answer's tap to the feedback, over seven answers of a Krmení round with the processor four
times slower: median 101 ms, slowest 122 ms (budget 500 ms). The page was never busy for more than
101 ms at a time while the round was played.

## Long tasks

The longest task of a first visit is the boot, 413 ms with the processor four times slower (parsing
the script and the content pack, then drawing the title); while a round is played, 101 ms. Nothing
in play comes near the 400 ms budget.

## Audio memory

The music is Ogg Vorbis, mono at 48 kHz: 1.86 MB on the wire, decoded on first play to 32-bit
samples in memory, 4 bytes a sample (S5's manifest: 33.0 MB, 31.5 MiB, for all four sounds, of a
48 MiB budget).

| After                                  | Decoded  | Buffers | Edge | Firefox | WebKit (CI) |
| -------------------------------------- | -------- | ------- | ---- | ------- | ----------- |
| The grotto and a lesson                | 19.3 MiB | 2       | Yes  | Yes     | Yes         |
| The grotto, Muréna's battle, the sting | 23.3 MiB | 3       | Yes  | Yes     | Yes         |
| All four sounds (from the manifest)    | 31.5 MiB | 4       |      |         |             |

The same in every engine; WebKit's figures are from CI on Ubuntu, as Playwright's WebKit on Windows
has no Web Audio. Safari on an iPad plays Ogg Vorbis from iPadOS 18.4.

## Not measured

- **The real tablet.** The processor ×4 profile stands in for a family tablet; the playtest will
  show whether the iPad or the laptop feels slow anywhere.
- **Firefox and WebKit timings**: the throttling is Chromium's. Their sizes are the same files.
- **JavaScript heap and long sessions**: memory over a whole session beyond the decoded audio, and
  battery use, are not measured.
- **Paintings**: since #38 the offline pack without audio is 4.08 MB of its 6 MB; the slice's
  remaining paintings (baby forms, Kořínek, Měsíční jeskyně, the freed Muréna, Mrož Vousáč, the
  Inkoustíci, the other monsters) have 1.9 MB left, which the size test holds them to as they land.
