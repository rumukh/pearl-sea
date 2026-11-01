# Defects found by the QA suite

Product defects found in the Slunná laguna slice by the end-to-end suite and the QA pass, each sent
to its owner (plan §8). An open defect is pinned by a test that states the behaviour the game
should have: while the defect reproduces, the test records it (a `known defect` annotation in the
run's `qa-summary.md` and the CI job summary) and goes on; when a fix lands the same assertion
passes and the summary lists the marker under "fixed?". Once the fix is verified on every engine
the defect leaves the registry and its assertion stays as a plain regression check. The registry
is `DEFECTS` (with `KNOWN_LAYOUT` for layout findings) in `test/e2e/support/known-issues.ts`, and
`KNOWN_AXE` in `test/e2e/support/a11y.ts` for axe findings; a full run also lists the registered
defects no test met, so an allowance cannot outlive its defect unnoticed. The scheme is Dragon
Valley's.

Severity: **blocker** stops the playtest or a release; **major** breaks a promised behaviour for
some children or devices; **minor** is a rough edge. Engines: Chromium (Edge), Firefox and WebKit
unless stated. Pictures: `docs/qa/screens/<stop>.webp` (tablet 1280 × 800, see
[screens.md](screens.md)); other sizes are written by every run of `screens.spec.ts` to
`out/qa-screens/<project>/<size>/<stop>.png`.

Found on main `e68d967` (content 1.2.3), 2026-11-01, locally and on the live site.

## Open

| ID       | Severity | Owner  | Defect                                                                                                    | Pinned by                                                         |
| -------- | -------- | ------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PS-QA-02 | blocker  | S4     | The game is silent: no music and no victory sting ever play                                               | `audio.spec.ts`                                                   |
| PS-QA-03 | major    | S2     | Results say "Správně: 9 / 5" after Inkoustová věta and "10 / 5" after Lov chyb                            | `screens.spec.ts` › the lagoon (Lov chyb's results)               |
| PS-QA-04 | major    | S4     | The grotto does not fit a landscape tablet: its places are below the fold                                | `screens.spec.ts`, every grotto stop at 1280 × 800 and 1024 × 768 |
| PS-QA-05 | major    | S4     | Rounds, boards and results need scrolling on a landscape tablet (Dál after a miss below the fold)        | `screens.spec.ts`, every play stop at both tablet sizes           |
| PS-QA-06 | major    | S4     | Pexeso never says what makes a pair                                                                       | `screens.spec.ts` › the lagoon (stop 27)                          |
| PS-QA-09 | major    | S4     | With less motion, a fish dragged onto a net often swims back to the pool                                 | `input.spec.ts` › fish dragged with a finger (less motion)        |
| PS-QA-01 | major    | S4     | Ulita slov's cut points are 19-43 px wide, under the 48 px target                                        | `screens.spec.ts` › a 4th grader (stops 57, 58)                   |
| PS-QA-07 | minor    | S4     | On the title, Hrát's focus ring cuts through the tagline                                                  | `screens.spec.ts` › the first dive (stop 01)                      |
| PS-QA-08 | minor    | S4     | At 200 % text on a phone, rounds scroll sideways and U Mrože's greeting does not wrap                    | `screens.spec.ts` › 200 % text                                    |
| PS-QA-10 | minor    | S3     | Freeing Muréna says the same news twice in a row                                                          | (copy; Phase 2 copy review)                                       |
| PS-QA-11 | minor    | S2, S1 | The treasure chest pays 1 coin; design.md says 1-3 in §8.1 and 2-6 in §8.4                                | (balance; observed in the QA pass)                                |
| PS-QA-12 | minor    | S4, S3 | Inkoustová věta says "Doplň chybějící písmena." for a sentence with one gap                               | (copy)                                                            |
| PS-QA-13 | minor    | S4     | The grown-ups' settings show "Závod s delfíny", switched on, for a race that has no way in yet            | (screens 61, 68)                                                  |
| PS-QA-14 | minor    | S4     | When the hint was shown, the miss feedback repeats the same strategy line under it                        | (screen 16 at 1024 × 768)                                         |

### PS-QA-02: the game is silent (blocker, S4)

- **Repro**: open the game (local build or https://rumukh.github.io/pearl-sea/), tap Hrát, open
  a diver, reach the grotto, play a round or Muréna's battle. No music, no victory sting, in every
  engine. Watching Web Audio from outside (`test/e2e/support/audio.ts`) shows that no
  `AudioContext` is ever made and no `.ogg` is requested.
- **Cause**: `src/app/audio/game-audio.ts` `ensure()` registers the pack with the SDK
  (`narration.registerPack`); the SDK's `requireId`
  (`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`) refuses the slash in the contract's sound IDs
  (`music/grotto`) and throws `invalid-data`; `ensure()` catches it and goes `unavailable`, so
  every cue and every mood is silently dropped. The manifest itself parses. The unit tests use a
  narration stand-in, so they never met the SDK's check.
- **Suggested fix**: map the contract's IDs to SDK-safe ones where the shell registers and plays
  them (or agree a contract change with S1 and S5), and unit-test registering the real manifest
  with the real `createNarration`.
- **Then** `audio.spec.ts` checks the rest: the first tap unlocks audio, the grotto, practice and
  battle loops, the battle loop stopped before the 9.3 s victory sting, silence during it and the
  grotto loop after, and decoded audio mono and within the manifest's 48 MiB budget.

### PS-QA-03: "Správně: 9 / 5" (major, S2)

- **Repro**: Slunná laguna 3 (Inkoustová věta) or 6 (Lov chyb), played to the results: "Správně:
  9 / 5", "Správně: 10 / 5". Picture: [31](screens/31-results-score.webp) shows a round whose
  sentences had one gap each, where it happens to agree.
- **Cause**: `src/rules/view.ts` gives `progress.answered` in finished problems
  (`round.asked - (current ? 1 : 0)`) and `progress.correct` from `round.correct`, which
  `progression/problems.ts` counts per right answer step (each gap, each find and fix).
- **Suggested fix**: one unit for both (problems answered all right of problems, or steps).

### PS-QA-04: the grotto does not fit a landscape tablet (major, S4)

- **Repro**: the grotto at 1280 × 800: the places row (Mapa, U Mrože, Kamarádi, Galerie, Album,
  Velká lastura) starts at about y = 825, below the fold ([34](screens/34-grotto-quests.webp) is
  899 px tall). At 1024 × 768 the hub falls to one column (its container is narrower than 42em,
  1,008 px) and is 1,425-1,566 px tall: the places are two screens down
  (`out/qa-screens/<project>/tablet-small/22-grotto-new-day.png`). Safari on an iPad shows about
  70 px less than the screen.
- **Why it matters**: a child who does not scroll never finds the map, the shop, the friends, the
  gallery, the album or the Great Shell. Dragon Valley's playtest found the same and fixed it.

### PS-QA-05: rounds, boards and results scroll on a landscape tablet (major, S4)

- **Repro** (page heights): at 1024 × 768 Krmení 807 px, with the hint shown 885, after a miss
  1,086 (Dál about 250 px below the fold; it takes focus, so the page scrolls to it), Svačinka with
  an Inkoustík 1,027 (the letter pad's second row below the fold), the placement check 785, Pexeso
  with a mismatch 800, results 800. At 1280 × 800: a miss 809, a hint 844, an ambush 818, Slovní
  rodinka with words picked 844, the placement's results 844.
- **Suggested fix**: a round that fits 1024 × 768 (smaller friend and problem card when space is
  short, the feedback beside the pad rather than under it).

### PS-QA-06: Pexeso never says what makes a pair (major, S4)

- **Repro**: Slunná laguna 5, Pexeso: twelve face-down cards and no task line
  ([27](screens/27-pexeso.webp)); Perlový náhrdelník and Rybářské sítě each say what to do. The
  pair kind is in the view (`board.pair`: a word and its plural, its family, a synonym …).

### PS-QA-09: with less motion, dragged fish swim back (major, S4)

- **Repro**: with the device's reduced motion, or the child's Méně pohybu, drag fish onto their
  nets in Rybářské sítě: 4 of 12 return to the pool (Edge, mouse and finger alike); at normal
  motion 12 of 12 land. Tapping (a fish, then a net) always works.
- **Cause**: the reduced-motion rule in `src/app/styles/base.css` sets `transition-duration: 1ms
  !important` on every element while `transition-property` is `all`, so in `boards.ts` (the drop
  in `startDrag`) removing the fish's transform and hiding it both transition, and
  `document.elementFromPoint` at the drop point still returns the dragged fish (measured: visible,
  `translate(97.9px, 91.3px)`), not the net.
- **Suggested fix**: `pointer-events: none` on the fish while it is dragged (or
  `elementsFromPoint` skipping it), and `transition-property: none` in the reduced-motion rule.

### PS-QA-01: Ulita slov's cut points are too narrow (major, S4)

- **Repro**: a 4th grader's first lesson (Měsíční jeskyně 1), Ulita slov: the cut buttons
  between letters are 26 × 72 px at 1280 × 800 and 19 × 53 px on a phone
  ([58](screens/58-word-shell-cut.webp)); tapping between two letters is fiddly for a child.

### PS-QA-07: the title's focus ring cuts through the tagline (minor, S4)

- **Repro**: open the game at 1280 × 800: Hrát has focus on load and its ring (outline 0.16em,
  offset 0.18em) crosses the tagline's last line, "inkoust z mořských příšer."
  ([01](screens/01-title.webp)).

### PS-QA-08: 200 % text on a phone (minor, S4)

- **Repro**: a child at Velikost písma 200 % on a 390 × 844 phone: in Krmení, after a miss and in
  Inkoustová věta the round's tool row (Přečíst nahlas, Nápověda) does not wrap, Nápověda sticks
  out to 468 px and the page scrolls sideways; U Mrože's greeting line runs to 453 px
  (`out/qa-screens/<project>/text-200/phone/`). Tablets and the desktop reflow at 200 %.

### Minor findings without a test

- **PS-QA-10 (S3)**: freeing Muréna, the story beat "Inkoust je pryč! Muréna se usmívá." is
  followed at once by the big moment "Inkoust je smytý! Muréna Mumla se usmívá."
- **PS-QA-11 (S2, S1)**: the treasure chest after the 30-answer daily goal said "V truhle byla 1
  mince!" (a perfect child's first day); design.md §8.1 says 1-3 coins and §8.4 says 2-6.
- **PS-QA-12 (S4, S3)**: `round.prompt.sentence` ("Doplň chybějící písmena.") is used for every
  sentence, also with one gap ([29](screens/29-ink-sentence.webp), [45](screens/45-battle.webp),
  [53](screens/53-placement.webp)).
- **PS-QA-13 (S4)**: "Závod s delfíny" is switched on in a child's game settings, though the race
  has no way in yet ([61](screens/61-settings.webp)).
- **PS-QA-14 (S4)**: after Nápověda, a miss shows the strategy line twice (the hint and again in
  "Skoro! Správně je: …").

## Not in the slice yet (not defects)

- **Art placeholders**, each drawn as a labelled "DEV <id>" shape. Painted so far: Bublinka,
  Profesorka Osmička, the three lagoon friends grown up and the inked Muréna Mumla. Still
  placeholders: the eight diver avatars; the eggs and baby forms (lagoon and Kořínek); the scenes
  (the grotto, Slunná laguna, Měsíční jeskyně) and the shallows' map; the freed Muréna; Mrož
  Vousáč; the Inkoustíci; the stickers and the cosmetics (SVG); the other monsters in the
  gallery. S5 is painting the slice's now.
- **Sound effects**: S5's pack has the three music loops and the victory sting only; the effects
  (taps, chimes, bubbles, splashes) are not in it yet, so even with PS-QA-02 fixed the game has
  music but no effects.

## Observations for design review (not defects)

- "Úkoly" names both a round's progress ("Úkoly 0 / 10") and the daily quests ("Úkoly na dnes").
- The placement check's results show "Správně: 0 / 3" to a child who missed everything.
- A perfect child's first session runs all six lagoon lessons and Muréna's battle without a break:
  Dnešní výprava always offers the next lesson, and pacing never holds on the first day (about
  290 coins, all three friends hatched).
- The grown-ups' Pokrok tab is 8,600 px tall for a child who has played only the lagoon: every goal
  of both grades is listed.
- The Great Shell lists counts of pearls by topic; it reads more like a report than a treasure.
- Music and the sting are Ogg Vorbis, which Safari plays from iPadOS 18.4; an older iPad stays
  silent (the game works without sound).
- In Chromium's touch emulation, after a fish is dragged with a finger the next tap is sometimes
  lost (the browser sends pointerdown and pointerup but no click); a second tap works. To check on
  the real tablet.
- The first visit downloads the whole content pack of all twelve regions (1.23 MB, most of the
  first visit's 1.94 MB; GitHub Pages sends it compressed, 384 KB in all).

## Fixed

None yet.
