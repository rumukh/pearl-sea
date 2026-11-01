# Accessibility report: the Slunná laguna slice

Perlové moře's slice (main after #27-#34, content 1.2.5) as the QA suite checks it in Chromium
(Edge), Firefox and WebKit, against WCAG 2.2 levels A and AA and the plan's own promises (plan §0
and §5: touch-first with full keyboard support, targets of at least 48 px, text to 200 %, reduced
motion, read-aloud with local Czech voices only, colour never the only signal).

**In short:**

- No WCAG 2.2 A or AA violation (axe-core) on any of the 71 screens and states of the slice, in any
  engine, at the tablet (1280 × 800) and phone (390 × 844) sizes, nor in the 200 % text walk.
- The game can be played by keyboard alone and by touch alone, and read-aloud uses only a local
  Czech voice.
- Open accessibility defects (all S4, [defects.md](defects.md)): the grotto and the rounds need
  scrolling on a landscape tablet (PS-QA-04, PS-QA-05), Ulita slov's cut points are under 48 px
  (PS-QA-01), dragging fails with less motion (PS-QA-09), and at 200 % text on a phone the rounds
  scroll sideways (PS-QA-08).
- axe's best-practice advice: the hatch and the freed-monster moments have no level-one heading.
- Some things only a person can check: screen readers on the real tablet, Windows high contrast,
  colour vision (below).

## How it is checked

| Check                 | What it proves                                                                                                                                                                                                                                       | Where                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| axe-core              | WCAG 2.0, 2.1 and 2.2 A/AA rules on every stop of the seven walks (71 screens and states, the 200 % walk too) at the tablet and phone sizes, in three engines; any WCAG violation fails the run, best-practice findings are listed in the QA summary | `screens.spec.ts`, `support/a11y.ts`   |
| Layout                | No sideways scrolling, nothing cut off or outside the screen, every control at least 48 × 48 px, no word broken in the middle: every stop at tablet 1280 × 800 and 1024 × 768, desktop 1440 × 900 and phone 390 × 844, and at 200 % text             | `support/layout.ts`, `screens.spec.ts` |
| Tablet fit            | The child's play screens (the grotto, stories, rounds, boards, results) are whole on a landscape tablet without scrolling, at 1280 × 800 and 1024 × 768                                                                                              | `screens.spec.ts` (`play` stops)       |
| Keyboard              | A new diver's first lesson by keyboard alone: Tab both ways to every control, a visible focus ring on each, the arrows inside the avatar, address and grade groups, the pearls and the letter tiles, typed letters, Enter and Space                  | `input.spec.ts`                        |
| Touch                 | The same lesson by tapping alone on a touch tablet; fish dragged into their nets with a finger                                                                                                                                                       | `input.spec.ts`                        |
| Read-aloud            | Only a local Czech voice (never a remote default), at 0.9; a gap read as a pause; auto-read; pausing silences; no local voice hides the speakers and the grown-ups' area explains how to add one                                                     | `read-aloud.spec.ts`                   |
| Motion                | With less motion nothing keeps moving on any stop, and the gate, a new screen and a toast appear at full strength at once                                                                                                                            | `screens.spec.ts`, `grownups.spec.ts`  |
| The checks themselves | Each check is shown a planted fault and must report it (a nameless button, a small control, sideways scrolling, a cut-off control, a broken word)                                                                                                    | `harness.spec.ts`                      |

## WCAG 2.2 A and AA

| Criterion                        | Level | Result                                                                                                                                                                              |
| -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content           | A     | Pass (axe): friends, monsters and avatars are named; decorative art is hidden                                                                                                       |
| 1.3.1 Info and Relationships     | A     | Pass (axe): the avatar, address and grade pickers are named radio groups, the tiles and word picks named groups                                                                     |
| 1.3.4 Orientation                | AA    | Pass: landscape tablet and desktop, portrait phone                                                                                                                                  |
| 1.4.1 Use of Color               | A     | Pass: a miss is "Skoro!" with a "?" badge, a right answer a check, pearls in place a check mark                                                                                     |
| 1.4.3 Contrast (Minimum)         | AA    | Pass (axe, every stop, three engines; text sits on paper over the paintings)                                                                                                        |
| 1.4.4 Resize Text                | AA    | Pass at 200 % text on tablets and the desktop; on a phone the rounds scroll sideways (PS-QA-08, minor)                                                                              |
| 1.4.10 Reflow                    | AA    | Pass at 390 px, except at 200 % text (PS-QA-08)                                                                                                                                     |
| 1.4.11 Non-text Contrast         | AA    | Not measured: rings are proven present by computed style, not their contrast. Manual check                                                                                          |
| 1.4.12 Text Spacing              | AA    | Not tested. Manual check                                                                                                                                                            |
| 1.4.13 Content on Hover or Focus | AA    | Nothing appears on hover or focus alone                                                                                                                                             |
| 2.1.1 Keyboard                   | A     | Pass: the editor, story, eggs, grotto, necklace (arrows move a pearl), nets (Enter on a fish, then a net), Krmení (typed letters or arrows), results and the gate (held with Space) |
| 2.1.2 No Keyboard Trap           | A     | Pass: Tab leaves every screen both ways; dialogs keep focus while open                                                                                                              |
| 2.1.4 Character Key Shortcuts    | A     | Typed letters choose tiles only while a round is on screen and focus is not in a text field                                                                                         |
| 2.2.1 Timing Adjustable          | A     | No time limit on answers; the grown-ups' optional session limit ends a round gently; the gate's two-second hold is a child lock                                                     |
| 2.2.2 Pause, Stop, Hide          | A     | Pass: with less motion (the device's or the child's) nothing keeps moving on any stop                                                                                               |
| 2.4.2 Page Titled                | A     | Pass (axe)                                                                                                                                                                          |
| 2.4.3 Focus Order                | A     | Pass: the keyboard journey reaches every control in a sensible order; a new screen focuses its heading or Dnešní výprava                                                            |
| 2.4.6 Headings and Labels        | AA    | Pass; best practice: the hatch and freed moments have no level-one heading (axe advice)                                                                                             |
| 2.4.7 Focus Visible              | AA    | Pass: every control the keyboard reaches shows a ring (computed style); on the title the ring cuts through the tagline (PS-QA-07, minor)                                            |
| 2.4.11 Focus Not Obscured        | AA    | Pass where checked: each focused control is on screen                                                                                                                               |
| 2.5.1 Pointer Gestures           | A     | Pass: everything is a single tap; dragging a fish is optional (tap a fish, then a net)                                                                                              |
| 2.5.2 Pointer Cancellation       | A     | Pass: letting go of the gate's lock early opens nothing                                                                                                                             |
| 2.5.7 Dragging Movements         | AA    | Pass: every drag has a tap alternative. Dragging itself fails with less motion (PS-QA-09)                                                                                           |
| 2.5.8 Target Size (Minimum)      | AA    | Pass at 24 px (axe); the game's own 48 px bar fails only for Ulita slov's cut points (PS-QA-01)                                                                                     |
| 3.1.1 Language of Page           | A     | Pass: `lang="cs"`; the grown-ups' area `lang="en"` in English                                                                                                                       |
| 3.1.2 Language of Parts          | AA    | Pass: Czech words on cards, pearls and fish carry `lang="cs"`                                                                                                                       |
| 3.3.1 Error Identification       | A     | Pass: the editor says in words what is missing; a miss shows the right answer in the gap and the strategy                                                                           |
| 3.3.2 Labels or Instructions     | A     | Pass (axe); Pexeso has no task line saying what makes a pair (PS-QA-06)                                                                                                             |
| 3.3.8 Accessible Authentication  | AA    | Not applicable: the gate (hold, then a multiplication) is a child lock, not a sign-in                                                                                               |
| 4.1.2 Name, Role, Value          | A     | Pass (axe): meters report their value, tiles and pearls their pressed state, switches their state                                                                                   |
| 4.1.3 Status Messages            | AA    | Feedback, board messages and toasts are live regions; what a screen reader says was not listened to (below)                                                                         |

## Beyond WCAG: the plan's promises

| Promise                                           | Result                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Touch-first, targets of at least 48 px            | Pass at every size and at 200 % text, except Ulita slov's cut points (PS-QA-01)                                            |
| A tablet screen without page scrolling            | Fails: the grotto (PS-QA-04) and the rounds and results (PS-QA-05) at 1280 × 800 and 1024 × 768                            |
| Text scales to 200 % with reflow                  | Pass on tablets and the desktop; phone rounds scroll sideways (PS-QA-08)                                                   |
| Full keyboard support                             | Pass                                                                                                                       |
| Reduced motion, from the device or the child      | Nothing keeps moving; dragging breaks (PS-QA-09)                                                                           |
| Read-aloud with local Czech voices only           | Pass; hidden with no local voice, and the grown-ups' area says how to add Zuzana (iPad) or the Czech speech pack (Windows) |
| The game works fully without sound and read-aloud | Pass: every journey passes in Playwright's WebKit on Windows, which has no sound at all, and with no local Czech voice     |

## Needs a person before release

- **Screen readers on the real devices**: VoiceOver with Safari on the iPad, NVDA with Edge on
  Windows. Play the first lesson, a miss, a board, Muréna's battle and the grown-ups' gate
  (VoiceOver's double-tap and hold), and use read-aloud with a screen reader running.
- **Windows high contrast**: focus rings, the letter pad, the pearls and nets, the ink meter.
- **Colour vision**: the pearls' bronze, silver and gold and the feedback colours, with a
  colour-blindness simulator.
- **Text spacing** (1.4.12) and the **contrast of rings and control edges** (1.4.11).
- **The playtest with the child**: the reading load, the story's words, whether a miss's help is
  understood ([../playtest-sunny-lagoon.md](../playtest-sunny-lagoon.md)).
