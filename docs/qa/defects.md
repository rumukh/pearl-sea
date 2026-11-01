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

Found on main `e68d967` (content 1.2.3), 2026-11-01, locally and on the live site; rechecked on
main `a729482` (content 1.2.5, after #27-#34) the same day.

## Open

| ID       | Severity | Owner  | Defect                                                                                         | Pinned by                                                         |
| -------- | -------- | ------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PS-QA-04 | major    | S4     | The grotto does not fit a landscape tablet: its places are below the fold                      | `screens.spec.ts`, every grotto stop at 1280 × 800 and 1024 × 768 |
| PS-QA-05 | major    | S4     | Rounds and battles need scrolling on a landscape tablet (Dál after a miss below the fold)      | `screens.spec.ts`, every play stop at both tablet sizes           |
| PS-QA-06 | major    | S4     | Pexeso never says what makes a pair                                                            | `screens.spec.ts` › the lagoon (stop 27)                          |
| PS-QA-09 | major    | S4     | With less motion, a fish dragged onto a net often swims back to the pool                       | `input.spec.ts` › fish dragged with a finger (less motion)        |
| PS-QA-01 | major    | S4     | Ulita slov's cut points are 19-43 px wide, under the 48 px target                              | `screens.spec.ts` › a 4th grader (stops 57, 58)                   |
| PS-QA-07 | minor    | S4     | On the title, Hrát's focus ring cuts through the tagline                                       | `screens.spec.ts` › the first dive (stop 01)                      |
| PS-QA-08 | minor    | S4     | At 200 % text on a phone, rounds scroll sideways and U Mrože's greeting does not wrap          | `screens.spec.ts` › 200 % text                                    |
| PS-QA-12 | minor    | S4, S3 | Inkoustová věta says "Doplň chybějící písmena." for a sentence with one gap                    | (copy; S3's wording is with S4)                                   |
| PS-QA-13 | minor    | S4     | The grown-ups' settings show "Závod s delfíny", switched on, for a race that has no way in yet | (screens 61, 68)                                                  |
| PS-QA-14 | minor    | S4     | When the hint was shown, the miss feedback repeats the same strategy line under it             | (screen 16 at 1024 × 768)                                         |

S4 takes them in this order: PS-QA-04, 05 and 06 first, then 09, 01 and the minor ones.

### PS-QA-04: the grotto does not fit a landscape tablet (major, S4)

- **Repro**: the grotto at 1280 × 800: the places row (Mapa, U Mrože, Kamarádi, Galerie, Album,
  Velká lastura) starts at about y = 825, below the fold: the grotto is 824-899 px tall
  ([34](screens/34-grotto-quests.webp) is 899). At 1024 × 768 the hub falls to one column (its
  container is narrower than 42em, 1,008 px) and is 1,436-1,577 px tall: the places are two
  screens down (`out/qa-screens/<project>/tablet-small/22-grotto-new-day.png`). Safari on an iPad
  shows about 70 px less than the screen.
- **Why it matters**: a child who does not scroll never finds the map, the shop, the friends, the
  gallery, the album or the Great Shell. Dragon Valley's playtest found the same and fixed it.

### PS-QA-05: rounds and battles scroll on a landscape tablet (major, S4)

- **Repro** (page heights on main `a729482`): at 1024 × 768 Krmení 825 px, with the hint shown
  903, after a miss 1,104 (Dál below the fold; it takes focus, so the page scrolls to it), a pause
  825, Svačinka 921, Muréna's battle 786 and with ink blots 801, an Inkoustík's ambush 1,045 (the
  letter pad's second row below the fold). At 1280 × 800: a miss 827, an ambush 836.
- **Corrected**: the first report also named results, Pexeso, the placement check and Slovní
  rodinka (800 px at 1024 × 768, 844 px at 1280 × 800). Those were the walk's own error: every
  engine applies a resize to the page's `100dvh` styles a moment late, and the walk measured the
  page before they followed, at the height of the window before. The walks now wait for them
  (`resize()` in `test/e2e/support/screens.ts`), and two runs measure every stop alike.
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

- **PS-QA-12 (S4, S3)**: `round.prompt.sentence` ("Doplň chybějící písmena.") is used for every
  sentence, also with one gap ([29](screens/29-ink-sentence.webp), [45](screens/45-battle.webp),
  [53](screens/53-placement.webp)). S3's wording for word and sentence gaps, "Doplň, co chybí.",
  is with S4 (one gap per step; "písmeno" would hint at a one-letter answer where it is "je" or
  "ně").
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
  (taps, chimes, bubbles, splashes) are not in it yet, so the game has music but no effects.

## Observations for design review (not defects)

- "Úkoly" names both a round's progress ("Úkoly 0 / 10") and the daily quests ("Úkoly na dnes").
  S3 has given S4 "Otázky" for the round's meter and "Části" for the placement's eight steps.
- The placement check's results no longer show a score (#27) but only "Hotovo!"; S3 has given S4 a
  kind line, "Díky! Osmička teď ví, kde začneš.", and renamed the sticker "Ukaž, co umíš!".
- A perfect child's first session runs all six lagoon lessons and Muréna's battle without a break:
  Dnešní výprava always offers the next lesson, and pacing never holds on the first day (about
  290 coins, all three friends hatched). S2: by design (design §4.2): the adventure offers the next
  level while the day's success is at least 70 %, after the daily goal the friends only get sleepy
  ("an expression, never a lock"), and the grown-ups' time limit ends a round gently.
- The treasure chest after the daily goal gave a perfect child 1 coin ("V truhle byla 1 mince!").
  1-3 is the balance since content 1.2.2 (design §8.1, balance-report §8); whether one coin feels
  like a let-down is for the playtest (the chest could grant a cosmetic instead, a chance set to
  zero today).
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

| ID       | Severity | Owner | Defect                                                                          | Fixed by                                                          |
| -------- | -------- | ----- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PS-QA-02 | blocker  | S4    | The game was silent: no music and no victory sting ever played                  | #33, verified in `audio.spec.ts` in Edge, Firefox and CI's WebKit |
| PS-QA-03 | major    | S2    | Results said "Správně: 9 / 5" after Inkoustová věta and "10 / 5" after Lov chyb | #27, units documented by #31                                      |
| PS-QA-10 | minor    | S3    | Freeing Muréna said the same news twice in a row                                | #32                                                               |
| PS-QA-11 | minor    | S2    | design.md said 1-3 coins from the chest in §8.1 and 2-6 in §8.4                 | #31 (1-3 is meant)                                                |

- **PS-QA-02**: the SDK's `requireId` (`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`) refused the slash
  in the contract's sound IDs (`music/grotto`), and `ensure()` in `src/app/audio/game-audio.ts`
  caught the refusal and went quiet, so every cue and mood was dropped and no `AudioContext` was
  ever made. #33 maps the IDs at the SDK boundary (`music:grotto`), reports the shell's sound state
  in boot-status's `data-audio`, and a refused pack now writes `console.error` and shows a note in
  the grown-ups' sound settings. `audio.spec.ts` now proves the first tap unlocks audio, the
  grotto, practice and battle loops, the battle loop stopped before the 9.3 s victory sting,
  silence while it plays and the grotto's loop after it, and decoded audio mono and within its
  budget (19.3 MiB after the grotto and a lesson, of 48 MiB).
- **PS-QA-03**: the round view counts finished problems in `progress.answered` and right steps
  (each gap, find and fix) in `correct`; the results card now shows only the right answers ("9
  správných odpovědí"), and contract §12 pins both units so no screen pairs them again. The walk's
  check stays as a regression check.
- **PS-QA-10**: line 1 of all eleven freed beats now shows the monster's change ("Muréna Mumla se
  probudila a radostně zamávala ploutví.") and its thanks follow; no beat repeats the results, the
  gallery line or the monster's sticker.
