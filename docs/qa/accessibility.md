# Accessibility report: the Slunná laguna slice

Perlové moře's slice (main `441bcab`, after #36, content 1.2.5) as the QA suite checks it in
Chromium (Edge), Firefox and WebKit, against WCAG 2.2 levels A and AA and the plan's own promises
(plan §0 and §5: touch-first with full keyboard support, targets of at least 48 px, text to 200 %,
reduced motion, read-aloud with local Czech voices only, colour never the only signal).

**In short:**

- No WCAG 2.2 A or AA violation (axe-core) on any of the 71 screens and states of the slice, in any
  engine, at the tablet (1280 × 800) and phone (390 × 844) sizes, nor in the 200 % text walk; and
  no best-practice advice either.
- The game can be played by keyboard alone and by touch alone, and read-aloud uses only a local
  Czech voice.
- Every child's screen is whole on a landscape tablet, every control is at least 48 px, text
  reflows at 200 % on a phone, and dragging works with less motion: #36 fixed PS-QA-01 and 04-09.
  One open accessibility defect is left ([defects.md](defects.md)): the grotto with three quest
  rewards and the chest waiting is 20 px too tall at 1024 × 768 (PS-QA-19, minor, S4).
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
| 1.4.4 Resize Text                | AA    | Pass at 200 % text on tablets, the desktop and a phone (PS-QA-08, fixed by #36)                                                                                                     |
| 1.4.10 Reflow                    | AA    | Pass at 390 px, also at 200 % text                                                                                                                                                  |
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
| 2.4.6 Headings and Labels        | AA    | Pass; the hatch, freed and grade moments carry the page's level-one heading                                                                                                         |
| 2.4.7 Focus Visible              | AA    | Pass: every control the keyboard reaches shows a ring (computed style); the title's ring clears the tagline                                                                         |
| 2.4.11 Focus Not Obscured        | AA    | Pass where checked: each focused control is on screen                                                                                                                               |
| 2.5.1 Pointer Gestures           | A     | Pass: everything is a single tap; dragging a fish is optional (tap a fish, then a net)                                                                                              |
| 2.5.2 Pointer Cancellation       | A     | Pass: letting go of the gate's lock early opens nothing                                                                                                                             |
| 2.5.7 Dragging Movements         | AA    | Pass: every drag has a tap alternative, and dragging works with less motion too (PS-QA-09, fixed by #36)                                                                            |
| 2.5.8 Target Size (Minimum)      | AA    | Pass at 24 px (axe), and every control meets the game's own 48 px bar (Ulita slov's cuts since #36)                                                                                 |
| 3.1.1 Language of Page           | A     | Pass: `lang="cs"`; the grown-ups' area `lang="en"` in English                                                                                                                       |
| 3.1.2 Language of Parts          | AA    | Pass: Czech words on cards, pearls and fish carry `lang="cs"`                                                                                                                       |
| 3.3.1 Error Identification       | A     | Pass: the editor says in words what is missing; a miss shows the right answer in the gap and the strategy                                                                           |
| 3.3.2 Labels or Instructions     | A     | Pass (axe); every board says its task, Pexeso what makes a pair (since #36)                                                                                                         |
| 3.3.8 Accessible Authentication  | AA    | Not applicable: the gate (hold, then a multiplication) is a child lock, not a sign-in                                                                                               |
| 4.1.2 Name, Role, Value          | A     | Pass (axe): meters report their value, tiles and pearls their pressed state, switches their state                                                                                   |
| 4.1.3 Status Messages            | AA    | Feedback, board messages and toasts are live regions; what a screen reader says was not listened to (below)                                                                         |

## Beyond WCAG: the plan's promises

| Promise                                           | Result                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Touch-first, targets of at least 48 px            | Pass at every size and at 200 % text                                                                                       |
| A tablet screen without page scrolling            | Pass at 1280 × 800 and 1024 × 768, except the grotto with three rewards and the chest waiting at 1024 × 768 (PS-QA-19)     |
| Text scales to 200 % with reflow                  | Pass on tablets, the desktop and a phone                                                                                   |
| Full keyboard support                             | Pass                                                                                                                       |
| Reduced motion, from the device or the child      | Pass: nothing keeps moving, and fish can be dragged                                                                        |
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
