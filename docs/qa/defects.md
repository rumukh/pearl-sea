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
main `a729482` (content 1.2.5, after #27-#34) and on main `441bcab` (after #36) the same day. S2's
UI playtest of main `8d6b61d` found PS-QA-15 to PS-QA-18.

## Open

| ID       | Severity | Owner | Defect                                                                                  | Pinned by                                                   |
| -------- | -------- | ----- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| PS-QA-19 | minor    | S4    | With three quest rewards and the chest to open, the grotto is 788 px tall at 1024 × 768 | `screens.spec.ts` › the lagoon (stops 34, 35 at 1024 × 768) |
| PS-QA-20 | minor    | S4    | On a slow connection the title shows briefly without its painting, which then pops in   | (measured; no test)                                         |

### PS-QA-19: the grotto with rewards to claim is 20 px too tall at 1024 × 768 (minor, S4)

- **Repro**: a child who met today's goal and has quest rewards and the chest waiting: the grotto
  at 1024 × 768 shows three "Vyzvednout … mince" buttons and "Otevřít truhlu" in its plan, and the
  page is 788 px tall (Edge; 789 in Firefox), so the bottom of Dnešní výprava sits under the fold
  (`out/qa-screens/<project>/tablet-small/34-grotto-quests.png`; 35 is the chest dialog over the
  same grotto). Every other grotto, and this one at 1280 × 800, fits since #36.
- **Why it matters**: little; everything stays reachable. #36's `fit.spec.ts` does not visit this
  state, so it is the one grotto the fix missed.

### PS-QA-20: the title's painting arrives after the title on a slow connection (minor, S4)

- **Repro** (with #38's art: `scenes/title.webp`, 1664 × 928, 119 KB): a cold first visit in Edge
  on slow 4G (150 ms, 1.6 Mbit/s) with the processor four times slower, local build. The splash
  shows until the title is built; the painting is only requested then (11.4 s), the router's
  320 ms wait for pictures runs out, and the title is shown over plain sea at 11.8 s. The painting
  arrives and appears at 12.2 s, all at once. On fast 4G it arrives with the title. There is
  never a blank screen.
- **Suggested fix**: fetch the title's painting at boot, beside the content pack, so it is there
  when the title is built; and fade a painting in when it decodes after its screen is shown (not
  with less motion), so a late one never pops.

## Awaiting verification

- **S2's rule changes for S3's language QA** (in progress, S2): reflexive _se_ and _si_,
  punctuation marks, and hints that gave the answer away. To verify once they land, in the problem
  sampler's output and the walks.

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

- A perfect child's first session runs all six lagoon lessons and Muréna's battle without a break:
  Dnešní výprava always offers the next lesson, and pacing never holds on the first day (about
  290 coins, all three friends hatched). S2: by design (design §4.2): the adventure offers the next
  level while the day's success is at least 70 %, after the daily goal the friends only get sleepy
  ("an expression, never a lock"), and the grown-ups' time limit ends a round gently.
- The treasure chest after the daily goal gave a perfect child 1 coin ("V truhle byla 1 mince!").
  1-3 is the balance since content 1.2.2 (design §8.1, balance-report §8); whether one coin feels
  like a let-down is for the playtest (the chest could grant a cosmetic instead, a chance set to
  zero today).
- The grown-ups' Pokrok tab is about 6,200 px tall at 1280 × 800 for a child who has played only
  the lagoon (8,600 before #36 folded the other grade's goals).
- The Great Shell lists counts of pearls by topic; it reads more like a report than a treasure.
- Music and the sting are Ogg Vorbis, which Safari plays from iPadOS 18.4; an older iPad stays
  silent (the game works without sound).
- In Chromium's touch emulation, after a fish was dragged with a finger the next tap was
  sometimes lost. #36 ends a drag on `pointercancel` and follows one pointer, which S4 thinks was
  the cause; to recheck on the real tablet.
- The first visit downloads the whole content pack of all twelve regions (1.24 MB, most of the
  first visit's 1.97 MB; GitHub Pages sends it compressed, 390 KB in all).
- Settled by #36: a round's meter says "Otázky" and the placement's "Části" (the quests keep
  "Úkoly na dnes"), and the placement's results say "Díky! Osmička teď ví, kde začneš.".

## Fixed

Verified on main `441bcab` in Edge, Firefox and WebKit (Windows) and on CI, unless stated.

| ID       | Severity | Owner  | Defect                                                                                          | Fixed by                                                          |
| -------- | -------- | ------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PS-QA-02 | blocker  | S4     | The game was silent: no music and no victory sting ever played                                  | #33, verified in `audio.spec.ts` in Edge, Firefox and CI's WebKit |
| PS-QA-15 | blocker  | S4     | A second tap on Nápověda showed an error (S2's playtest)                                        | #27                                                               |
| PS-QA-16 | blocker  | S4     | Quick taps on a board were dropped while the move before them saved (S2's playtest)             | #27                                                               |
| PS-QA-01 | major    | S4     | Ulita slov's cut points were 19-43 px wide, under the 48 px target                              | #36                                                               |
| PS-QA-03 | major    | S2     | Results said "Správně: 9 / 5" after Inkoustová věta and "10 / 5" after Lov chyb                 | #27, units documented by #31                                      |
| PS-QA-04 | major    | S4     | The grotto did not fit a landscape tablet: its places were below the fold                       | #36 (a 20 px remainder is PS-QA-19)                               |
| PS-QA-05 | major    | S4     | Rounds and battles needed scrolling on a landscape tablet (Dál after a miss below the fold)     | #36                                                               |
| PS-QA-06 | major    | S4     | Pexeso never said what makes a pair                                                             | #36                                                               |
| PS-QA-09 | major    | S4     | With less motion, a fish dragged onto a net often swam back to the pool                         | #36                                                               |
| PS-QA-07 | minor    | S4     | On the title, Hrát's focus ring cut through the tagline                                         | #36                                                               |
| PS-QA-08 | minor    | S4     | At 200 % text on a phone, rounds scrolled sideways and U Mrože's greeting did not wrap          | #36                                                               |
| PS-QA-10 | minor    | S3     | Freeing Muréna said the same news twice in a row                                                | #32                                                               |
| PS-QA-11 | minor    | S2     | design.md said 1-3 coins from the chest in §8.1 and 2-6 in §8.4                                 | #31 (1-3 is meant)                                                |
| PS-QA-12 | minor    | S4, S3 | Inkoustová věta said "Doplň chybějící písmena." for a sentence with one gap                     | #36 ("Doplň, co chybí.", S3's wording)                            |
| PS-QA-13 | minor    | S4     | The grown-ups' settings showed "Závod s delfíny", switched on, for a race with no way in yet    | #36 (the switch waits until the race has a way in)                |
| PS-QA-14 | minor    | S4     | After Nápověda, a miss repeated the same strategy line under the hint                           | #36                                                               |
| PS-QA-17 | minor    | S4, S3 | The placement check's pause did not say that leaving ends the check (S2's playtest)             | #27 (S3's wording)                                                |
| PS-QA-18 | minor    | S4     | A second window on the same child stalled on story screens (S2's playtest)                      | #27                                                               |
| PS-QA-21 | major    | S6, S1 | A green browser run could end red: the Playwright runner hung after reporting until the timeout | #41                                                               |

- **PS-QA-21**: PR #22's job `e2e (chromium)` (run 41295288308) printed "15 passed (50.5s)" at
  09:58:27 and wrote its JSON report, and then nothing until the step's 15-minute timeout at
  10:12:49. At cleanup only the Playwright runner was left (with `npm exec` and `sh` above it); the
  web server and browsers had gone. Every reporter had finished its `onEnd`, so the runner hung in
  the window Playwright 1.63 leaves unguarded: its reporters' `onExit` and a flush of stdout and
  stderr come before the CLI arms its own 30-second exit guard. It happened once in 174 e2e jobs.
  #41 bounds it three ways: on CI the QA reporter reports first and, once the run has reported,
  exits with the run's own status if the runner is still alive two minutes later
  (`test/e2e/support/bounded-exit.ts`); Playwright's `globalTimeout` is 30 minutes on CI, twice
  WebKit's slowest run, for a run stuck in its tests; and the step has 35 minutes and the job 50.
  A planted reporter that hangs on exit showed it: without the bound the runner sat after
  "1 passed"; with it, the run exited 0 five seconds after reporting, and a failed run exited
  failed.

- **PS-QA-15 to PS-QA-18** were found by S2's UI playtest of main `8d6b61d` and fixed by S4 in #27
  (commit `ca65b19`), whose tests in `game.spec.ts` fail without the fixes: Nápověda tapped twice
  shows the hint again and nothing complains; quick taps on Slovní rodinka all count, as a tap made
  while the move before it saves now waits for it (`controller/moves.ts`, for every board); a
  second window that cannot save over a newer save says "Hra je otevřená jinde" with the way back
  to the game; the placement's pause says "Když teď odejdeš, kontrola skončí. Co už máš hotové,
  ti zůstane. Spustit ji znovu může dospělý v části Pro dospělé." with "Skončit kontrolu". S6
  rechecked them from other angles in all three engines, under the guard: six quick taps putting
  three fish into their nets in Rybářské sítě, Nápověda tapped three times at once and
  double-clicked in Svačinka, and a second window that taps Dál on its story beat and then goes
  back to the game while the first window plays on.
- **PS-QA-01, 04-09, 12-14** were fixed by S4's #36. The screen walks find no layout problem left
  but PS-QA-19; Ulita slov's cuts are whole 48 px targets (`game.spec.ts` checks them too); the
  title's ring clears the tagline and Pexeso has its task line (their pins are now plain
  regression checks); with less motion, 72 fish dragged in six runs in Edge all landed (about one
  in three swam back before), and none in Firefox and WebKit; the axe advice about the hatch and
  freed moments having no level-one heading is gone. #36's `fit.spec.ts` checks the child's
  screens at 1280 × 800, 1024 × 768, 1024 × 698 and laptop windows.
- **PS-QA-02**: the SDK's `requireId` (`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`) refused the slash
  in the contract's sound IDs (`music/grotto`), and `ensure()` in `src/app/audio/game-audio.ts`
  caught the refusal and went quiet, so every cue and mood was dropped and no `AudioContext` was
  ever made. #33 maps the IDs at the SDK boundary (`music:grotto`), reports the shell's sound state
  in boot-status's `data-audio`, and a refused pack now writes `console.error` and shows a note in
  the grown-ups' sound settings. `audio.spec.ts` now proves the first tap unlocks audio, the
  grotto, practice and battle loops, the battle loop stopped before the 9.3 s victory sting,
  silence while it plays and the grotto's loop after it, and decoded audio mono and within its
  budget (19.3 MiB after the grotto and a lesson, of 48 MiB).
- **PS-QA-05** as first reported also named results, Pexeso, the placement check and Slovní
  rodinka (800 px at 1024 × 768, 844 px at 1280 × 800). Those were the walk's own error: every
  engine applies a resize to the page's `100dvh` styles a moment late, and the walk measured the
  page before they followed, at the height of the window before. The walks now wait for them
  (`resize()` in `test/e2e/support/screens.ts`), and two runs measure every stop alike.
- **PS-QA-03**: the round view counts finished problems in `progress.answered` and right steps
  (each gap, find and fix) in `correct`; the results card now shows only the right answers ("9
  správných odpovědí"), and contract §12 pins both units so no screen pairs them again. The walk's
  check stays as a regression check.
- **PS-QA-10**: line 1 of all eleven freed beats now shows the monster's change ("Muréna Mumla se
  probudila a radostně zamávala ploutví.") and its thanks follow; no beat repeats the results, the
  gallery line or the monster's sticker.
