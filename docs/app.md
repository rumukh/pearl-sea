# The browser application

The shell in `src/app/**` (S4): boot, screens, persistence, input, audio, read-aloud, offline
installation, printables and the grown-ups' area, on the packed Aegis SDK's **public exports** only
(`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`, `@aegis/browser/*`). The game rules run behind
`RuntimeAdapter<S, A, V, C>`; the shell never decides an outcome. Dragon Valley's shell is the
reference implementation; the modules that are not about arithmetic are ported here, renamed and
kept under test.

**Status: Phase A** (the shell infrastructure). Everything below runs and is tested; the game
screens join it in Phase B (§16). The shell takes its vocabularies from the domain contract
(`src/rules/contract`, `docs/contract.md`): diver avatars, forms of address, grades, the catalog
convention, the audio manifest path, schema and sound IDs, and the storage names.

## 1. Layout

| Path                    | What it holds                                                                     |
| ----------------------- | --------------------------------------------------------------------------------- |
| `main.ts`, `index.html` | Boot (§2) and the static splash; the CSP is filled in by `scripts/build.mjs`      |
| `shell/app.ts`          | The persistent chrome, shared services, presentation, the error boundary          |
| `router/`               | Screen stack and router (§3)                                                      |
| `screens/`              | Title, recovery and error, the grown-ups' area, print preview, shared pieces      |
| `persistence/`          | Family, preferences, game sessions, save status, recovery, backups, day (§4)      |
| `controller/`           | The command controller and the move queue (§5)                                    |
| `content/site.ts`       | Same-origin static files below the deployment base                                |
| `design/`, `styles/`    | The interface palette and tokens, the reading font, CSS (§7)                      |
| `ui/`                   | DOM kit: buttons, tiles, number pad, dialogs, toasts, tabs, meters, icons, motion |
| `audio/`                | Game audio over `createNarration`, S5's manifest, event-to-sound mapping (§9)     |
| `speech/`               | Read-aloud with local Czech voices, spoken aliases (§10)                          |
| `grownups/`             | The gate (§6), offline installation (§11), the About build id                     |
| `print/`                | Flashcards and diplomas laid out by the narrative toolkit, drawn as sheets (§13)  |
| `i18n/`                 | Typed Czech and English messages with plurals and address (§12), typography       |
| `sw.ts`                 | The offline worker, built by `scripts/build.mjs`                                  |

## 2. Boot and readiness

`main.ts` applies the design tokens and the default presentation (Czech, 100 % text), reads the
deployment base and offline revision from `<meta name="ps-base">` and
`<meta name="ps-offline-revision">`, starts loading the reading font (waiting at most 2.5 s),
reads S5's audio manifest (a missing or broken one means a silent game, never a failed boot), and
opens the family record. The first screen is the title, or the recovery screen when the family
record cannot be read.

The hidden `boot-status` element is the readiness signal for tests and tools: `data-state`
(`loading`, `ready`, `failed`), `data-screen` (the current screen: `title`, `grownups`, `print`,
`recovery`, `error`), `data-font` (`loaded`, `timeout`, `failed`, `unsupported`) and `data-base`.
`ready` only after the first screen is mounted and painted. Nothing is put on `window`; nothing is
written to the console. Uncaught errors and rejections land on the error screen. When even the
shell cannot start, a built-in Czech line and a retry button remain.

## 3. Router and screens

An explicit in-memory stack (`router/stack.ts`): `push`, `replace`, `reset`, `back`, `refresh` and
`backTo(key)`. Browser history is never used for play; every screen with somewhere to go back to
has a visible Back button. Back **rebuilds** the previous screen from its entry. A navigation
overtaken by a newer one is discarded before it mounts, so double taps cannot interleave screens.

Mounting goes through the SDK's `replaceProjection` (stops speech and one-shot audio, clears
announcements, moves focus to the screen's heading or chosen target) after `assertChildSafeView`
checks the tree (no outbound links, no embeds). Before the swap the router waits up to 320 ms for
the new screen's pictures to decode while the old screen stays in view. A screen declares its
title, page field (`sea`, `desk` for the grown-ups, `abyss` for recovery and errors), region
accent, music state and **language**: the page's `lang` follows the screen, Czech for children and
the grown-ups' choice in their area, so dialogs, toasts and screen readers follow it too.

## 4. Persistence

One IndexedDB database, `pearl-sea` (`SAVE_DATABASE`), through `IndexedDbSaveStorage` and the SDK's
`SaveService` (validated envelopes, ordered compare-and-swap writes, a kept previous copy). Every
name comes from `src/rules/contract/persistence.ts`, so nothing can touch Dragon Valley's storage
on the shared origin (`test/unit/persistence/origin-isolation.test.ts`).

| Record                    | `gameId`                | `profileId`        | Holds                                          |
| ------------------------- | ----------------------- | ------------------ | ---------------------------------------------- |
| Family                    | `pearl-sea-family`      | `family`           | The children and the grown-ups' language       |
| Game save (one per child) | `pearl-sea`             | `profile-1` … `-4` | The runtime snapshot (strict checkpoints)      |
| Preferences (per child)   | `pearl-sea-preferences` | `profile-1` … `-4` | Presentation and shell preferences             |
| Day (per child)           | `pearl-sea-day`         | `profile-1` … `-4` | How today began, for the diary card at goodbye |

- **Family** (`family.ts`): up to four children ("divers") in the fixed slots `profile-1` …
  `profile-4`; a new child takes the first free slot. Each has a name (NFC, single-spaced, 1-16
  characters, Czech letters welcome, unique ignoring case), a picture from the contract's
  `DIVER_AVATARS` (`diver-1` … `diver-8`; S5 paints them as `avatar/<diver-n>`), an **address**
  from `FORMS_OF_ADDRESS` (`boy`, `girl` or `neutral`: kluk, holka or neither, for grammatical
  praise, §12) and, until the game save has it, the **grade** from `GRADES` (3 or 4) chosen in the
  editor. The record also holds `grownUpsLanguage` (`cs` or `en`). Removing a child erases that
  slot's game, preferences and day records **before** the list drops them. None of this enters
  game state or a hash.
- **Preferences** (`preferences.ts`): `presentation` (the SDK's `PresentationPreferences`: locale
  `cs`, text 100/125/150/200 %, less motion, volumes for narration/music/effects, all 1.0 by
  default), `readAloud`, `autoRead`, `voice` (a local voice URI or null) and `timeLimit` (null or
  5-120 minutes). Validated strictly on load and on every edit.
- **Live stores** (`stores.ts`): the family record and each child's preferences. A write either
  becomes the new state or fails without changing it (then the store re-reads storage). Opens and
  changes take turns in the order they were asked for, and each change is worked out from the
  last saved state when its turn comes: two quick changes (two switches tapped before the first
  is on disk, two children added, English then Czech) both stay, in order, and a failed change
  does not stop the next one.
- **Game sessions** (`game-session.ts`, generic over the adapter): `createSaveCheckpoint` and
  `createRuntimeHost` with the seed `profileSeed(id)`. A stored envelope is validated by the codec,
  restored into a throwaway probe host with the content revision it pinned, and only then into the
  real host with `durableRevision`. Old saves keep their pack until `activateLatestContent()` moves
  them at a safe boundary; a pack that cannot be fetched leaves the save untouched for recovery
  (`content-unavailable`). One commit listener per session keeps the latest view and fans each
  commit or restore out to the shell; a failing listener cannot silence the others.
- **Save status** (`save-status.ts`, `screens/common.ts`): from acknowledged facts only. "Uloženo"
  when the durable revision equals the committed one; "Ukládám…" while a checkpoint is pending;
  "Neuloženo" + **Zkusit znovu** after a failed write, which calls `retryCheckpoint()` then
  `continuePending()` (the action is never dispatched again); "Hra je otevřená jinde" + reopen for
  a storage conflict; "Tady se nedá ukládat" when storage is unavailable.
- **Recovery** (`recovery.ts`, `screens/recovery.ts`): nothing turns an unreadable record into a
  new one by itself. The screen offers what the stored history allows: save the original bytes to a
  file, restore the previous copy (validated like a fresh load), load a backup, or a confirmed reset
  of exactly that record. Unreadable storage offers only "try again". It speaks the grown-ups'
  language; when the family record itself is unreadable that language is unknown, so the screen
  starts in Czech and offers the switch.
- **Backups** (`backup.ts`, `profile-data.ts`): one child per file (`pearl-sea-backup` v1, at most
  4 MiB, named `pearl-sea-<name>-<day>.json`): who it was made for, and the game and preferences
  envelopes exactly as stored, both re-validated before export. Loading one into a child rebinds
  the envelopes to that child's profile and validates them like a normal load (a save that cannot
  be opened is replaced through its recovery). The game save is reached through `GameRecords`,
  made from the game definition; until the shell has one (Phase B) backups carry preferences only
  and a backup with a game is refused.
- **Day** (`day.ts`): when a child's day starts, the shell notes which items already shine and how
  far each sea friend has grown; the diary card is the difference from the view. It holds nothing
  the game save does not, so an unreadable record is replaced without asking anyone, and a failed
  write leaves the diary to this page.
- **Storage persistence** (`storage.ts`): the grown-ups' area shows usage (in their language:
  "3,4 MB" or "3.4 MB") and asks for `navigator.storage.persist()`, only there.

## 5. Command controller

`controller/commands.ts` is the only way screens dispatch. `capture()` binds a dispatcher to the
committed revision and a view generation; any newer view makes older dispatchers refuse with
`StaleCommandError`. `captureSend()` resolves when the action is saved, or once it is committed if
the save takes longer than 250 ms, so feedback never waits on a slow device; a save that fails
within that time rejects with `accepted: true` (no praise for what is not stored). Commands sent
while another is still saving wait for it. `taken()` treats an accepted action that only moves on
as done. Refusals play `ui.blocked` and show a gentle toast ("Hra je pozastavená.", "To nevyšlo.
Zkus to prosím znovu."). `controller/moves.ts` keeps board moves in order: a quick second tap waits
for the first instead of being dropped.

## 6. The grown-ups' gate

Press and hold the lock for two seconds (pointer, touch, or holding Space or Enter: the water level
rises; letting go early empties it), then answer a two-digit × two-digit multiplication on the
number pad. Factors are never multiples of ten, never repeated digits, never equal, and never the
previous question. A wrong answer asks a new question: no lockout, no penalty. The gate speaks the
grown-ups' language (its dialog carries `lang`).

## 7. Design system

An undersea storybook: chunky, glossy controls a child presses with confidence, on open water that
darkens toward the deep, with S5's painted art. The child always knows what to tap and that the
game is saved.

- **Tokens** (`design/palette.ts`, `design/tokens.ts`): ink is deep navy, paper is pearl and sand,
  the brand is sea teal with sun and coral, and each of the twelve regions has an accent, a deep, a
  soft and a label colour, darkening toward the abyss. They are published as `--ps-*` custom
  properties; a screen's region switches `--ps-accent*`. Sizes derive from the SDK's
  `CHILD_SAFE_PRESET` (`--ps-target` 48 px, `--ps-reading` 24 px). Every text pairing the
  stylesheets use is listed with its WCAG minimum and measured by `test/unit/app/tokens.test.ts`,
  which also holds the CSS to tokens.
- **Components**: buttons, choice tiles, the number pad, cards, segmented choices and tabs,
  switches, dialogs, toasts, an `aria-live` announcer, meters, stars, the coin counter with fly-in,
  confetti and screen transitions. Motion uses transform and opacity only and stops with
  `prefers-reduced-motion` or the child's own setting: durations collapse to 1 ms, and the
  entrances of screens, dialogs and toasts do not run at all, since even a 1 ms fade draws its
  faint first frame (`styles/base.css`). A control's face lifts on hover and sinks when pressed
  while its hit area stays at rest. Words stay whole at 200 % text; rows wrap.
- **Feedback never relies on colour alone**: a right choice is green with a check badge, a miss
  warm orange with a "?" badge (never red), stars are filled or outlined, pressed choices have a
  ring as well as a colour.
- **Font**: Pearl Reading, the renamed subset of Andika (SIL OFL 1.1) with every Czech letter in
  both cases (`assets/fonts/pearl-reading/`, `scripts/fonts/subset-andika.mjs`), loaded by
  `design/fonts.ts`.
- **Icons** (`ui/icons.ts`): drawn here on one 24-unit grid in `currentColor`; the gold coin,
  stars and badges colour their parts through tokens.

## 8. Input

- **Choice tiles** (`ui/tiles.ts`): one tab stop with the arrows between tiles, Enter or Space to
  choose; with `typeSelect` a typed letter picks the tile with that label, accents kept ("y" is not
  "ý"), letter case aside, and digits type ahead ("1", "12"). A missed choice is blocked, not
  hidden, and keeps its "?" badge.
- **Number pad** (`ui/keypad.ts`): for the gate; physical keys do the same; keys never take focus,
  so Enter always submits. Its words come from the caller (the grown-ups' language).
- Keyboard handling is a stack of handlers (`ui/keyboard.ts`) that ignores text fields and leaves
  Enter and Space on a focused button to the browser, so one press is one action.
- The big letter pad (i í y ý, d t, ú ů …) and the Czech on-screen keyboard come with the problem
  views (Phase B).

## 9. Audio

One `createNarration` instance (`audio/game-audio.ts`) with an `AudioContext` at 22 050 Hz where the
browser allows it, unlocked by the first tap or key. Music and effects volumes come from the child's
preferences; music is lowered to 35 % while read-aloud speaks. Nothing plays while paused or hidden;
`clear()` drops pending sounds at a restore or a change of child. Every failure is contained.

S5's manifest is the contract's `AUDIO_MANIFEST_PATH` (`assets/audio/manifest.json`), schema
`AUDIO_MANIFEST_SCHEMA` (**`pearl-sea-audio-manifest/1`**, Dragon Valley's format under this game's
name; `audio/manifest.ts` documents its fields): sounds on the `effects` or `music` bus with their
durations, an event map (`select`: `streak`, `amount`, `sequence`, `cycle`, `random`, or the first
sound), music states with a crossfade, and per-sound throttles. Sound IDs follow the contract's
`AUDIO_ID_PATTERN`: effects are `sfx/<name>` and music loops `music/<loop>` (`music/grotto`,
`music/map`, `music/practice`, `music/battle`, `music/victory`, `music/finale`); a manifest that
names a sound otherwise is refused as a whole. The event map is keyed by the contract's `EVENTS`
(`answer.correct`, `coins.earned`, …) and the shell cues `ui.tap`, `ui.keypad`, `ui.navigate`,
`ui.blocked`. Until S5's pack lands the repository ships an **empty placeholder** in that schema,
so the game is silent without a missing file; S5's generator overwrites it. With no sounds, no
`AudioContext` is ever created. Screens name music states (`title`, …).

## 10. Read-aloud

`speech/read-aloud.ts` uses the Web Speech API with **local Czech voices only**
(`localService === true`, a `cs` language: Zuzana on iPad, Jakub on Windows with Czech speech):
every utterance names its voice, so the browser can never fall back to a network voice. The
device default comes first, then `cs-CZ`. The grown-ups choose the voice and try it; read-aloud
and auto-read are per child. Speech is cancelled on every screen change, on pause and when the page
is hidden, and reads at a calm 0.9. With no local Czech voice the read-aloud button
(`screens/speaker.ts`) is not shown and the grown-ups' area explains why and how to add one.

Words the voices say wrongly get **aliases** (`speech/aliases.ts`): `speech.alias.<word>` keys in
the UI catalog, applied just before speaking, whole words only, with Czech plural forms after a
number (`speech.alias.Kč.one` / `.few` / `.other`: "1 koruna", "3 koruny", "25 korun"). The screen
keeps the original.

## 11. Offline installation

In the grown-ups' area (`grownups/offline.ts`): the build's `resource-graph.json` is fetched through
`createInstallationRequest`, installed with `OfflinePackStore` (namespace `pearl-sea`, so caches are
`aegis:pearl-sea:…`) into a staged cache published only when every digest matches, and the worker
is registered with `registerOfflineWorker('sw.js', base)`, scoped to `/pearl-sea/`. Progress is
shown ("Stahuji soubory: 12 z 64…"); "installed" appears only after both succeed. Checking for an
update installs a newer revision next to the running one; it takes over the next time the game is
opened. There is no forced reload.

## 12. Messages

All text lives in `content/catalogs/cs.ui.json` (every string) and `en.ui.json` (the grown-ups'
area only: keys `grownups.*`), bundled at build time so each key is a compile-time type, and read
through the SDK's `createMessages`, which refuses missing keys and placeholder values. The content
gate (`scripts/validate-content.mjs`) checks the catalog convention, English for every grown-ups'
key, Czech typography (quotation marks, the ellipsis, the dash) and the reading font's coverage.

The catalog format carries Czech grammar. It is the contract's convention (docs/contract.md §7.4,
`src/rules/contract/catalogs.ts`: `catalogProblems`, `splitCatalogKey`, `czechPlural`,
`englishPlural`), shared with S3's content strings:

- **Plurals**: a message about a count has `<key>.one` (1), `<key>.few` (2-4) and `<key>.other`
  (0, 5 and more) with `{count}`: "1 mince", "3 mince", "5 mincí". `t.plural(key, count)` picks
  the form with `czechPlural` (English: `englishPlural`, `.one` and `.other`). Counts are whole
  numbers.
- **Address**: the bare key is a neutral phrasing and is required; `<key>.boy` and `<key>.girl`
  are optional and come in pairs with the same placeholders ("Dokázal jsi to!", "Dokázala jsi
  to!"). The translator picks the form for the child playing now (`app.setAddress`, a
  `FormOfAddress`) and the neutral phrasing for a child who chose neither, or when nobody is
  playing. Plural and address combine as `<key>.<plural>.<address>`.
- **Typography**: every Czech string the translator returns binds a one-letter preposition or
  conjunction to the next word with a no-break space (`i18n/typography.ts`), so "s ponorkou" never
  breaks after "s".
- **Grown-ups**: `app.grownUps()` speaks the family's chosen language (Czech by default, English
  on request), falling back to Czech for any key English lacks.

Child-facing sentences keep to the narrative toolkit's child profile (at most ten words); a unit
test runs `catalogProblems` on both catalogs and checks sentence length, placeholders, `{count}` in
every plural form, the English translation of the whole grown-ups' area, and that every key is
used.

## 13. Printables

`print/documents.ts` builds flashcards (ten to an A4 sheet at 20 pt, printed on both sides and
flipped on the long edge, backs mirrored) and diplomas (one per page) with the narrative toolkit's
`layoutPrint`, which refuses text that cannot fit rather than clip it. `print/sheets.ts` draws the
layout in the app (the reading font, Czech typography, `lang="cs"`, pictures on diplomas), and the
print preview (`screens/print.ts`) prints it with `window.print()` and print CSS (only the pages)
or saves `renderPrintHtml`'s script-free file, with the printing advice in the grown-ups' language.
What to print (the hardest words, freed monsters) comes with the game's views in Phase B.

## 14. The grown-ups' area

Behind the gate, in Czech or English (`screens/grownups.ts`), on the calm sandy desk:

- **Nastavení / Settings**: the language of the area; reading aloud (available voices, or why there
  are none and how to add one); each child's settings: read-aloud, auto-read, voice with a test
  line, music and effects volumes, text size, less motion, a time limit for one sitting.
- **Zálohy / Backups**: per child, save a backup, load one (after a confirmation), erase progress;
  browser storage with usage and a request to keep the data.
- **Bez internetu / Offline**: install for offline play, check for a new version.
- **O hře / About**: the build id, privacy (nothing is sent anywhere), the font's licence and the
  licences file.

Each saved change rebuilds the panel from storage through one preferences store per child (kept
while the area lives). Only the newest rebuild is shown, and the keyboard stays on the control
that had it (`replaceKeepingFocus` in `ui/dom.ts`, matched by `data-testid`).

## 15. Testing

- **Unit** (`test/unit/app/`, Vitest): messages (Czech plurals, address, typography, grown-ups'
  English) and the catalogs; tokens and measured contrast; the router stack; family, preferences,
  records (quick changes taken in turn on a slow disk) and recovery; game sessions and the command
  controller on a tiny counting game (`fixtures.ts`: checkpoints, retry without repeating the
  action, stale views, pause, restore, content activation, backups); profile data (backup, load,
  erase); backups; save status; the day record; storage sizes; the gate; moves; the number pad's
  state; the sound map, game audio and the audio manifest; voices and read-aloud; aliases; print
  layouts; the About build id.
- **DOM** (`test/unit/app/dom/`, happy-dom): the router, the announcer, choice tiles (letters and
  digits), the number pad, the whole gate dialog, tabs, meters, stars and the coin counter, toasts,
  icons, a rebuilt panel keeping focus, print sheets, the save status pill and the read-aloud
  button.
- **Browser** (`test/e2e/grownups.spec.ts`, Playwright): the gate (cancel, a wrong answer, the
  right one), the area in English kept over a reload while the game stays Czech, a child's
  settings (changed from the keyboard, which stays on the switch) kept and carried by a backup
  download, offline installation into this game's caches and scope, and the recovery screen for
  an unreadable family record; axe WCAG 2.1 A and AA on every screen. The spec runs with less
  motion; the gate, a new screen and a toast must appear at full strength at once (read before
  the first frame), and axe waits until nothing is fading (no `data-entering`, no running
  animation), since it would measure half-faded colours. It waits up to 20 s for readiness: boot
  opens the family record, and Firefox's first IndexedDB open in a new browser context takes
  about 1 to 5 s. `smoke.spec.ts` and `isolation.spec.ts` stay green. Locally the default project
  is the installed Edge; set `PS_E2E_PORT` to a free port when another checkout serves 4331.

## 16. Phase B

The game screens from the contract's views, the slice (Slunná laguna) first: title with profiles,
the profile editor (grade, kluk/holka/neither, diver picture), story beats, the grotto, the sea
map, level intro and results, the language problem views (letter pad, Czech keyboard), the
minigame boards, the monster battle, the Inkoustíci ambush, snack time, placement, the Great Shell,
U Mrože, the sticker album, the treasure chest, the diary card and goodbye; then the active child's
game session in the shell (preferences, day, visibility pause, event inbox, time limit), the
game definition and content loading, `GameRecords` for backups, and the Progress and Print tabs.

## 17. SDK notes

Gaps found while building the shell (to be filed upstream by the coordinator, never patched here),
the same as Dragon Valley's:

- `CHILD_SAFE_CSS` is not injected; the shell implements the same thresholds in its own CSS.
- A failed `playEffect` sets the whole narration state to `failed`; the shell ignores effect
  failures.
- No preloading of effects; the first play of each sound waits for its download and decode.
- `RuntimeHost.getView()` clones the whole view on every call; the shell keeps one commit listener
  per child and reads the view it was handed.
- No helper to rebind a save envelope to another profile ID (backups do it by hand).
