# Test coverage: the Slunná laguna slice

What the QA pass for the slice's playtest checked, and where the evidence is (plan §8 step 1;
the coordinator's Phase 1 brief). Every item is a browser test that runs on CI in Chromium, Firefox
and WebKit (Ubuntu), and locally in Edge, Firefox and WebKit on Windows; the deployed site is
checked by `live.spec.ts` on request. The rules, the content and the learner simulations have their
own suites (docs/testing.md §2-§4).

Run on main `441bcab` (after #36, content 1.2.5) with this branch's specs, 2026-11-01. "Pass" means the test
passes and asserts the behaviour; open defects are named where a check records one instead of
failing ([defects.md](defects.md)).

## The QA pass

| What                                                                                               | Evidence                                                                                                                                                                           | Edge           | Firefox | WebKit                                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------- | -------------------------------------------------- |
| A new 3rd grader: title, a diver, the prologue, the first egg, the first lesson, a hatch           | `screens.spec.ts` › the first dive (stops 01-20); `game.spec.ts` › a new 3rd grader dives in and hatches the first friend                                                          | Pass           | Pass    | Pass                                               |
| The lagoon's lessons: Perlový náhrdelník, Rybářské sítě, Krmení, Pexeso, Inkoustová věta, Lov chyb | the first dive and the lagoon walk (stops 09-16, 23-33); `game.spec.ts`; S2's traces play every lesson to its end                                                                  | Pass           | Pass    | Pass                                               |
| The daily adventure and snack time (Svačinka)                                                      | the lagoon walk (stops 22-23) and the 200 % walk; `read-aloud.spec.ts` (Svačinka's problem read aloud)                                                                             | Pass           | Pass    | Pass                                               |
| The treasure chest and the day's quests                                                            | the lagoon walk (stops 34-35)                                                                                                                                                      | Pass           | Pass    | Pass                                               |
| U Mrože, the wardrobe, the album, the Great Shell, goodbye                                         | the lagoon walk (stops 36-42)                                                                                                                                                      | Pass           | Pass    | Pass                                               |
| Muréna Mumla: the battle, ink blots, her freeing, the gallery, an Inkoustík ambush                 | `screens.spec.ts` › Muréna Mumla (stops 43-50); `game.spec.ts` › Muréna Mumla is washed clean, joins the gallery and earns a diploma                                               | Pass           | Pass    | Pass                                               |
| Music moods and the victory sting                                                                  | `audio.spec.ts`: the first tap unlocks sound, the grotto, practice and battle loops, the music stopped for the 9.3 s sting and back after it, decoded audio mono and within budget | Pass           | Pass    | Pass on CI (Ubuntu); no sound in WebKit on Windows |
| A 4th grader: placement, then Kořínek's first lesson (Slovní rodinka, Ulita slov)                  | `screens.spec.ts` › a 4th grader (stops 51-58); `game.spec.ts` (the placement, run again by a grown-up, the grade chosen first)                                                    | Pass           | Pass    | Pass                                               |
| The grown-ups' gate                                                                                | stops 59-60; `grownups.spec.ts` › the gate lets a grown-up in only after holding the lock and answering                                                                            | Pass           | Pass    | Pass                                               |
| Progress and printables (flashcards, a diploma)                                                    | stops 62-64; `game.spec.ts` › … earns a diploma                                                                                                                                    | Pass           | Pass    | Pass                                               |
| Settings, per child; the area in English                                                           | stops 61, 68-69; `grownups.spec.ts` (settings kept per child, English kept, the game stays Czech)                                                                                  | Pass           | Pass    | Pass                                               |
| Backup and restore                                                                                 | stop 65; `grownups.spec.ts` › a child's settings are kept for that child, and a backup carries them; `history.spec.ts` (an older save restores)                                    | Pass           | Pass    | Pass                                               |
| Offline install, then an offline reload                                                            | stop 66; `grownups.spec.ts` (own caches and scope); `offline.spec.ts` (server shut down; browser offline mode, not WebKit; a browser that cannot install)                          | Pass           | Pass    | Pass                                               |
| The live site: boot, compressed text, music, offline install and reload                            | `live.spec.ts` (`PS_E2E_LIVE=1`), https://rumukh.github.io/pearl-sea/ at `a729482`                                                                                                 | Pass           | Pass    | Pass (offline reload: Edge, Firefox)               |
| A damaged save                                                                                     | stops 70-71; `grownups.spec.ts` › a family record that cannot be read asks a grown-up                                                                                              | Pass           | Pass    | Pass                                               |
| Tablet landscape 1280 × 800 and 1024 × 768, phone 390 × 844, desktop 1440 × 900                    | every stop of every walk at all four sizes: no sideways scrolling, nothing cut off, controls of 48 px; play screens must fit a landscape tablet                                    | Pass, PS-QA-19 | Same    | Same                                               |
| Touch alone                                                                                        | `input.spec.ts` › a new diver taps through the first lesson (touch emulation); fish dragged with a finger                                                                          | Pass           | Pass    | Pass                                               |
| Keyboard alone                                                                                     | `input.spec.ts` › a new diver plays the first lesson by keyboard alone (Tab both ways, arrows, typed letters, a ring on every control)                                             | Pass           | Pass    | Pass                                               |
| 200 % text                                                                                         | `screens.spec.ts` › 200 % text (the grotto, Svačinka with a miss, results, the map to Inkoustová věta, the shop to goodbye, at all four sizes)                                     | Pass           | Same    | Same                                               |
| Reduced motion                                                                                     | every walk with reduced motion: nothing keeps moving; `grownups.spec.ts` (gate, screens and toasts at full strength); `input.spec.ts` (dragging with less motion)                  | Pass           | Same    | Same                                               |
| axe WCAG A/AA on every screen                                                                      | every stop at the tablet and phone sizes and in the 200 % walk (WCAG 2.0-2.2 A and AA rules); [accessibility.md](accessibility.md)                                                 | Pass           | Pass    | Pass                                               |
| Read-aloud with a local Czech voice; hidden without one                                            | `read-aloud.spec.ts` (a stand-in speech engine with Zuzana, a remote voice and others)                                                                                             | Pass           | Pass    | Pass                                               |
| Zero console messages and zero foreign requests                                                    | the guard on every test (`support/fixtures.ts`), proved by `harness.spec.ts`                                                                                                       | Pass           | Pass    | Pass                                               |
| Performance: first visit, load, first tap, audio memory, long tasks                                | `perf.spec.ts`, `audio.spec.ts`; [performance.md](performance.md)                                                                                                                  | Pass           | Sizes   | Sizes                                              |
| Screens for the user's visual review                                                               | [screens.md](screens.md): all 71 stops at 1280 × 800                                                                                                                               | Edge           | -       | -                                                  |

## How the walks reach a screen

The walks act as a child or a grown-up would: through the screen, with answers from the game's
stored save (restored in Node, `support/game.ts`) and boards solved from what the board shows. A
diver far into the slice is played in Node by S2's trace player and stored as the game stores it
(`support/saves.ts`); the walks fix the date, so each run sees the same day. A stop that depends on
what the game serves (a hint, a Pexeso mismatch, the chest, an ink blot, an ambush, the letter pad)
is listed in the QA summary when it did not come. All 71 came in this run.

## Not covered by a test

- **The real devices**: the family tablet (perhaps an iPad with Safari) and the Windows laptop,
  touch with real fingers, the on-screen keyboard, Safari's address bar on a landscape tablet. The
  playtest is the check ([../playtest-sunny-lagoon.md](../playtest-sunny-lagoon.md)).
- **Real voices**: Zuzana on the iPad and the Windows Czech speech pack; the tests use a stand-in
  speech engine. How the voice sounds is for the playtest.
- **Real sound output**: the tests watch Web Audio, not the speakers. Ogg Vorbis needs iPadOS 18.4
  or later; an older iPad stays silent.
- **Screen readers** (VoiceOver, NVDA), Windows high contrast, colour vision
  ([accessibility.md](accessibility.md)).
- **Long play**: the walks cover one or two days; S2's learner simulations cover 84 days.
- **Planned for Phase 2**: storage faults (a full disk, a refused IndexedDB), a watch for blank
  screens between screens, focus rings checked by their pixels, all twelve regions and both
  finales, and the complete Czech copy review with S3.
