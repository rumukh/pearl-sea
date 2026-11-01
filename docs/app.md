# The browser application

The shell in `src/app/**` (S4): boot, screens, persistence, input, audio, read-aloud, offline
installation, printables and the grown-ups' area, on the packed Aegis SDK's **public exports** only
(`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`, `@aegis/browser/*`). The game rules run behind
`RuntimeAdapter<S, A, V, C>`; the shell never decides an outcome. Dragon Valley's shell is the
reference implementation; the modules that are not about arithmetic are ported here, renamed and
kept under test.

**Status: Phase B, the slice.** The rules adapter is wired (`game/rules.ts`, §16), so the title's
Hrát starts the game: Slunná laguna end to end and every activity the content pack uses, played
through in a real browser (§15). The shell takes its
vocabularies from the domain contract (`src/rules/contract`, `docs/contract.md`): diver avatars,
forms of address, grades, the catalog convention, the audio manifest, the art catalog and IDs, the
views and actions, and the storage names.

## 1. Layout

| Path                    | What it holds                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `main.ts`, `index.html` | Boot (§2) and the static splash; the CSP is filled in by `scripts/build.mjs`           |
| `shell/app.ts`          | The chrome, shared services, the active child's game, presentation, the error boundary |
| `router/`               | Screen stack and router (§3)                                                           |
| `screens/`              | Every screen: title, profiles, the game's screens (§16), grown-ups, print, recovery    |
| `game/`                 | The game definition, the rules hook, view readings, map spots, timers, the grade       |
| `content/`              | The content pack, its strings (`text.ts`) and older packs; same-origin static files    |
| `art/`                  | S5's art catalog and pictures by art ID, with labelled dev placeholders (§16)          |
| `persistence/`          | Family, preferences, game sessions, save status, recovery, backups, day (§4)           |
| `controller/`           | The command controller and the move queue (§5)                                         |
| `design/`, `styles/`    | The interface palette and tokens, the reading font, CSS (§7)                           |
| `ui/`                   | DOM kit: buttons, tiles, number pad, Czech keyboard, dialogs, toasts, tabs, meters     |
| `audio/`                | Game audio over `createNarration`, S5's manifest, event-to-sound mapping (§9)          |
| `speech/`               | Read-aloud with local Czech voices, spoken aliases (§10)                               |
| `grownups/`             | The gate (§6), offline installation (§11), progress (§14), the About build id          |
| `print/`                | Flashcards and diplomas laid out by the narrative toolkit, drawn as sheets (§13)       |
| `i18n/`                 | Typed Czech and English messages with plurals and address (§12), typography, dates     |
| `sw.ts`                 | The offline worker, built by `scripts/build.mjs`                                       |

## 2. Boot and readiness

`main.ts` applies the design tokens and the default presentation (Czech, 100 % text), reads the
deployment base and offline revision from `<meta name="ps-base">` and
`<meta name="ps-offline-revision">`, starts loading the reading font (waiting at most 2.5 s),
reads S5's audio manifest and art catalog (a missing or broken one means a silent game or
placeholder art, never a failed boot), and opens the family record. With the rules wired
(`game/rules.ts`) it loads and validates the content pack and its strings (every key the pack uses
must resolve) meanwhile, since on a slow device both take seconds; both finish before the first
screen. The first screen is the title, or the recovery screen
when the family record cannot be read.

The hidden `boot-status` element is the readiness signal for tests and tools: `data-state`
(`loading`, `ready`, `failed`), `data-screen` (the current screen: `title`, `grownups`, `print`,
`recovery`, `error`), `data-font` (`loaded`, `timeout`, `failed`, `unsupported`), `data-base` and
`data-content` (the content pack's revision, once there is one) and `data-audio` (the game
audio's status: `silent`, `locked`, `ready`, `blocked` or `unavailable`, §9). `ready` only after
the first screen is mounted and painted. Nothing is put on `window`, and the console gets a line
only when the browser's sound service refuses the sound pack (§9).
Uncaught errors and rejections land on the error screen. When even the shell cannot start, a
built-in Czech line and a retry button remain.

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
  them at a safe boundary. An old save's pack is fetched on demand from the build's gzip archive
  (`content/history.ts`: `content/history/<revision>.json.gz`, served without a Content-Encoding
  and decompressed with `DecompressionStream`); a pack that cannot be fetched or read, or a browser
  without `DecompressionStream`, leaves the save untouched for recovery
  (`content-unavailable`). One commit listener per session keeps the latest view and fans each
  commit or restore out to the shell; a failing listener cannot silence the others.
- **Save status** (`save-status.ts`, `screens/common.ts`): from acknowledged facts only. "Uloženo"
  when the durable revision equals the committed one; "Ukládám…" while a checkpoint is pending;
  "Neuloženo" + **Zkusit znovu** after a failed write, which calls `retryCheckpoint()` then
  `continuePending()` (the action is never dispatched again); "Hra je otevřená jinde" + reopen for
  a storage conflict (another window saved the same child's game first); "Tady se nedá ukládat"
  when storage is unavailable. Every screen of a child's game shows it, in its top bar or, where
  there is none (a story beat, the eggs, the results, goodbye), in its top corner
  (`cornerSaveStatus`), so an action refused there never leaves the child stuck.
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
  made from the game definition, so a backup carries the child's game as stored; a shell without
  the rules would carry preferences only and refuse a backup with a game.
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
  while its hit area stays at rest. A button whose command takes a moment can say so (`showBusy` in
  `ui/button.ts`): "Ponořit se!" in the profile editor reads "Chvilku…" while the first save and
  the game open, takes no second press and keeps the focus. Words stay whole at 200 % text; rows
  wrap.
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
- **The big letter pad** is choice tiles drawn big with the gap's keys (i í y ý, d t, ú ů …), typed
  letters picking them. **The Czech on-screen keyboard** (`ui/czech-keyboard.ts`) types into a
  field that a physical keyboard (Czech dead keys included) types into too: a row of every letter
  with a diacritic, QWERTZ, Shift for capitals, space, Backspace and OK; keys insert at the caret
  and stay out of the Tab order, the field asks the device not to open its own keyboard, and
  Enter is OK. Pearls and fish on the boards move with the arrow keys or by tapping (§16).

## 9. Audio

One `createNarration` instance (`audio/game-audio.ts`) with an `AudioContext` at 48 kHz (S5's pack is
mono 48 kHz Ogg) where the browser allows it, unlocked by the first tap or key. Music and effects
volumes come from the child's preferences; music is lowered to 35 % while read-aloud speaks. Nothing
plays while paused or hidden; `clear()` drops pending sounds at a restore or a change of child.
Every failure is contained, and all but one are quiet. A pack the SDK refuses when it is
registered is a defect of the build, never of the device, so it is not left silent: it is written
to the console (`console.error`, which the browser tests' console guard catches), the status turns
`unavailable` (`data-audio` on the boot status), and each child's settings in the grown-ups' area
say the game is silent for now.

S5's manifest is the contract's `AUDIO_MANIFEST_PATH` (`assets/audio/manifest.json`), schema
`AUDIO_MANIFEST_SCHEMA` (**`pearl-sea-audio-manifest/1`**, Dragon Valley's format under this game's
name; `audio/manifest.ts` documents its fields): sounds on the `effects` or `music` bus with their
durations, an event map (`select`: `streak`, `amount`, `sequence`, `cycle`, `random`, or the first
sound), music states with a crossfade, and per-sound throttles. Sound IDs follow the contract's
`AUDIO_ID_PATTERN`: effects are `sfx/<name>` and music loops `music/<loop>` (the contract's
`MUSIC_IDS`: `music/grotto`, `music/map`, `music/practice`, `music/battle`, `music/finale`; results
and missing moods play `music/grotto`, and a freed monster gets the one-shot `sfx/victory-sting`); a
manifest that names a sound otherwise is refused as a whole. The SDK takes asset IDs only as
stable identifiers (`/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/`, no `/`), so contract sound IDs cross
into it as `sdkSoundId` gives them, `/` turned into `:` (`music/grotto` is `music:grotto`), at
registration, for music states and for effects alike. `AUDIO_ID_PATTERN` has no `:`, so the
mapping is one-to-one; the manifest, the event map and everything else in the shell keep the
contract's IDs. A unit test registers the committed manifest with the SDK's own `registerPack`.
S5 owns the pack, its manifest generator and
`docs/audio.md`; the shell owns the runtime map, which events it cues and when. S5's slice pack
holds the grotto, practice and battle loops and the victory sting; a manifest with no sounds keeps
the game silent, and then no `AudioContext` is ever created.

What the shell cues, by name in the manifest's event map:

- Every live game event (the contract's `EVENTS`: `answer.correct`, `coins.earned`,
  `level.completed`, …) as it is committed, never replayed history; except the celebrations
  `friend.hatched`, `monster.freed` and `grade.completed`, which the results screen cues when their
  moment is on screen.
- The shell's own cues: `ui.tap`, `ui.keypad`, `ui.navigate`, `ui.blocked`, and in the game
  `fx.bubble` (Bublinka's bubble at the monster), `fx.wipe` (an ink blot wiped away),
  `fx.board-done` (a board solved), `fx.chest` (the treasure chest opened) and `fx.buy` (bought at
  U Mrože).

Screens name a **mood** for their music, and the manifest's `music.states` maps each mood to a loop
(or `null` for silence): `grotto` (title, profiles, story, hub, collections, results, goodbye),
`map` (map, region, level intro), `practice` (problem rounds and boards) and `battle` (monster
battles). A mood the pack does not list plays the `grotto` loop (`musicFor`), so S5's slice loops
(grotto, practice, battle) cover every screen, the results and the finale included.

The victory is no loop but a 9-second one-shot, `sfx/victory-sting`, which the manifest maps to
`monster.freed`. The results screen plays it as a **sting** (`GameAudio.sting`) when the freed
monster's moment shows: the music stops first (the battle loop, or the grotto loop the results
screen just asked for), stays silent until the sting has ended (a pause or a hidden page stretches
that), and then the music the current screen asks for comes back. A level's completion keeps a
short fanfare; only freeing a monster gets the sting.

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
- **Names** (S3's rule): code never declines a name, so a name inserted into a sentence stands
  only at its start or after a colon or dash, and no verb or adjective agrees with it ("Hurá!
  Vajíčko se vylíhlo: {name}!"); the child is never addressed by name, which would need the
  vocative (the grotto shows the child's name as a label beside the picture instead).

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

What to print comes from the child's progress (`print/printables.ts`, offered on the Progress
tab): **flashcards** of the words the child gets wrong most, the word with its spelling point
left blank on the front (`ml_n`) and the whole word on the back, made only from words' spelling
points (`spell:<word>:<at>` items); and **diplomas** for each monster freed (dated the day it was
freed, with its freed painting) and for each whole grade (dated the day of printing). Printed
pages are Czech whatever the grown-ups' language.

## 14. The grown-ups' area

Behind the gate, in Czech or English (`screens/grownups.ts`), on the calm sandy desk:

- **Nastavení / Settings**: the language of the area; reading aloud (available voices, or why there
  are none and how to add one); each child's settings: the game's grade (3 or 4: where the child
  starts and what the game suggests; content that does not serve a grade, or a placement round,
  keeps the old one and says why; the grade picked in the editor goes to the game when this area
  first reads it, so the grade shown is the one the child plays), daily goal (the dolphin race's
  switch waits until the race has a way in on screen, §16.5), and the placement check again
  for a grade that has one (it starts the next time the child plays; a round or a story under way
  keeps it for later); read-aloud, auto-read, voice with a test line, music and effects volumes
  (with a note when sound could not start, §9), text size, less motion, a time limit for one
  sitting.
- **Pokrok / Progress** (`grownups/progress.ts`), per child: days practised, answers, monsters
  freed and the grade; the last 14 days of practice (right answers of all); each goal of the
  child's grade (pearls mastered, silver and gold, of the goal's items, and the success rate), with
  the other grade's goals folded under their heading (a `details`), so the tab stays short;
  where the child goes wrong most, with printable flashcards; diplomas to print.
- **Zálohy / Backups**: per child, save a backup, load one (after a confirmation), erase progress;
  browser storage with usage and a request to keep the data.
- **Bez internetu / Offline**: install for offline play, check for a new version.
- **O hře / About**: the build id, privacy (nothing is sent anywhere), the font's licence and the
  licences file.

Each saved change rebuilds the panel from storage through one preferences store per child (kept
while the area lives). Only the newest rebuild is shown, and the keyboard stays on the control
that had it (`replaceKeepingFocus` in `ui/dom.ts`, matched by `data-testid`). A child's game is
read or changed through `App.withGame`: the open game when it is that child's, else the save opened
for the moment and closed again, so the area never starts a session, counts no play time and keeps
its own presentation; calls take turns, and a child opened for play waits for them.

## 15. Testing

- **Unit** (`test/unit/app/`, Vitest): messages (Czech plurals, address, typography, grown-ups'
  English) and the catalogs (a message for every value of the contract's vocabularies the screens
  name); tokens and measured contrast; the router stack; family, preferences, records (quick
  changes taken in turn on a slow disk) and recovery; game sessions and the command controller on a
  tiny counting game (`fixtures.ts`: checkpoints, retry without repeating the action, stale views,
  pause, restore, content activation, backups); profile data (backup, load, erase); backups; save
  status; the day record; storage sizes; the gate; moves; the number pad's state; the sound map,
  game audio (moods, the grotto fallback, status changes, a refused pack reported to the console)
  and the audio manifest, whose committed pack is registered with the SDK's own `registerPack`
  (every sound ID crosses as a stable identifier; the contract's raw IDs are refused); voices and
  read-aloud;
  aliases; print layouts and printables; the About build id. The game screens' logic runs on
  contract-typed view fixtures (`game-views.ts`): problem views (steps, prompts, ink-blot gaps,
  read-aloud, hints), view readings and the adventure, map spots, timers, art and the art catalog,
  content strings and the diary card; the archived packs (`content-history.test.ts`: every shipped
  gzip archive decompresses through the platform's `DecompressionStream` to exactly the bytes zlib
  reads and loads as its pack, once; truncated, already decompressed, missing or wrong-revision
  archives and a browser without `DecompressionStream` reject, and a retry fetches again).
- **DOM** (`test/unit/app/dom/`, happy-dom): the router, the announcer, choice tiles (letters and
  digits), the number pad, the Czech keyboard, the whole gate dialog, tabs, meters, stars and the
  coin counter, toasts, icons, a busy button, a rebuilt panel keeping focus, print sheets, the save
  status pill and the read-aloud button.
- **Browser, the game** (`test/e2e/game.spec.ts`, Playwright): journeys played the way a child
  plays, every answer given on screen. A new 3rd grader goes from the editor ("Ponořit se!" saying
  "Chvilku…" while the game opens) through the prologue, the first egg and the grotto into the
  first lesson of Slunná laguna (a necklace checked too early, the nets with every fish dragged
  onto its net with less motion, Krmení with Nápověda tapped twice and no complaint, a wrong
  answer that shows the right one and a reload that resumes the same step) up to the friend
  hatching, with Osmička
  cheering beside the results; its first tap unlocks the sound and the grotto loop is fetched
  (`support/sound.ts`: Chromium, whose headless mode has an audio output too, must say `ready`;
  an engine with no audio here, such as Playwright's WebKit on Windows with no `AudioContext`, may
  stay `blocked`, never `unavailable` or `silent`, and the files are checked whenever the sound is
  `ready`). A new 4th grader takes the placement check (its meter counting parts, Osmička cheering
  a right answer, its results thanking the child with no count) and plays Slovní rodinka (quick
  taps all counted) and Ulita slov (every cut a whole 48 px target) in Měsíční jeskyně. A
  3rd grader who has played every lesson of the lagoon washes Muréna Mumla clean (the ink meter,
  her joke, an ink blot wiped), frees her into the gallery to the victory sting (its file is
  fetched) and prints her diploma from the grown-ups' area, whose Pokrok shows the 3rd grade's
  goals and folds the 4th's. The same child replays Slunná laguna 5 to Pexeso, whose task line
  names the pair, and two cards that are no pair wait for "Otočit zpět". A second window on the
  same child shows "Hra je otevřená jinde" on a story beat
  and reopens the saved game. A grown-up runs a placed 4th grader's placement check again, and
  leaving it says kindly what stays; a grade a grown-up chooses before the first dive is the grade
  the child plays. What is right comes from the
  game itself (`support/game.ts`): the save the page stored is read back from IndexedDB and
  restored into a runtime host in Node, and its view says what the problem or board on screen asks;
  screens name what they show only by position (`data-round`, `data-index`, `data-step`,
  `data-board`), never by item. Boards are solved from the board view and the lexicon with S2's
  trace helpers; the seeded child is played by S2's trace `Player` on the real pack and stored as
  the shell's checkpoint stores it (`support/saves.ts`). Every new screen passes axe, and each
  journey ends with no page or console error, no failed request and nothing sent to another
  origin (`support/observe.ts`). A request the page cancelled itself is noted, never failed:
  Chromium reports a sound whose file the page has already read whole as `net::ERR_ABORTED`. Every
  spec imports `test` and `expect` from `support/fixtures.ts`, whose automatic guard (S6's,
  [testing.md](testing.md)) also fails a test on any console message, CSP violation or navigation
  away; a test that provokes one on purpose says so with `guard.allow`.
- **Browser, the fit** (`test/e2e/fit.spec.ts`): S6's PS-QA-04 and PS-QA-05 as regression
  checks, Dragon Valley's way. At each landscape size of §16.3 the page needs no scrolling either
  way at 100 % text, measured at the tallest states each screen reaches: the title, the editor,
  the eggs, the grotto (a first egg, a first friend, a whole lagoon with a monster to free), every
  kind of board (Pexeso with two cards that are no pair, Slovní rodinka with its words picked,
  Ulita slov cut), Krmení with its hint and a miss at once, the battle with an ink blot and a miss,
  a round an Inkoustík ambushes (a child played in Node until one does) with a miss, the placement
  check with a miss and its results, the hatching, the freeing and the results. At 200 % text on a
  phone the grotto, U Mrože and a round with Nápověda and a miss keep to the screen's width.
- **Browser, the art** (`test/e2e/art.spec.ts`): S5's next paintings rehearsed before they exist.
  `support/art.ts` serves a catalog of main's art plus stand-ins in the real formats (the lagoon's
  babies, the freed Muréna, Osmička cheering, the shallows map, the lagoon, the grotto and the
  title: cut-outs trimmed to their own boxes, scenes and maps of 1664 × 928, dark and busy on
  purpose). A seeded child plays through them: each is drawn from the catalog, the backdrops cover
  their screens, region markers and level nodes stay on their spots, the inked and the freed
  Muréna share their ground, Osmička cheers beside the results, and no text sits straight on a
  painting (`textOffPaper`), with axe on every screen.
- **Browser, the shell** (`test/e2e/grownups.spec.ts`): the gate (cancel, a wrong answer, the
  right one), the area in English kept over a reload while the game stays Czech, a child's
  settings (changed from the keyboard, which stays on the switch) kept and carried by a backup
  download, offline installation into this game's caches and scope, the recovery screen for
  an unreadable family record, and a sound pack the SDK refuses (one over its 4096-sound budget,
  which the shell's own checks pass): the boot status says `unavailable`, the grown-ups' area
  says the game is silent, and the console has the line; axe WCAG 2.1 A and AA on every screen.
  The spec runs with less
  motion; the gate, a new screen and a toast must appear at full strength at once (read before
  the first frame), and axe waits until nothing is fading (no `data-entering`, no running
  animation), since it would measure half-faded colours. It waits up to 20 s for readiness: boot
  opens the family record, and Firefox's first IndexedDB open in a new browser context takes
  about 1 to 5 s. `smoke.spec.ts` and `isolation.spec.ts` stay green. Locally the default project
  is the installed Edge; set `PS_E2E_PORT` to a free port when another checkout serves 4331.

## 16. The game (Phase B)

### 16.1 The child's game

Choosing a child on the title (`screens/divers.ts`; the first child goes straight to the profile
editor) opens their game (`App.openDiver`): preferences, the day record, the game session over
the rules adapter (`persistence/game-session.ts`, strict checkpoints) and the command controller,
a play clock for the time limit, the visibility pause, and an **event inbox**: every live commit's
events land there (sounds play at once; hatching and freeing wait for their big moment) and
screens take the ones they show (results their celebrations, a battle its ink blots). Replayed
history never reaches it. One child is open at a time; the form of address and the presentation
are the child's while they play.

`screens/play.ts` shows what the game needs now, from the view alone: on the first visit of a day
it hands the editor's grade to the game (`game/grade.ts`) and starts the session with the local
date; then a story beat, the first egg, a round or a board, results, or the grotto. Every other
screen goes back through it (`App.continueGame`), so a reload, a restore or Back always lands where
the game is. `game/rules.ts` is the one place that names S2's adapter; `game/definition.ts` makes
the game from it, the content pack and the save migrations.

### 16.2 Art and placeholders

Pictures are drawn by art ID (`ART` in media.ts) from S5's catalog (`assets/art/catalog.json`,
`pearl-sea-art-catalog/1`): WebP paintings and static SVGs (eggs, cosmetics, stickers) with their
pixel size, painted friends with anchors where SVG cosmetics sit (`art/picture.ts`: `dressedFriend`
puts what a friend wears on `head`, `eyes` and `neck`, and the golden shell crown on a crowned
friend: S5's `cosmetic/shell-crown` once the catalog has it, else a crown the shell draws). A
cosmetic is drawn by the contract's anchor scale (`cosmeticPlacement`): a 100×100 viewBox with its
attachment point at the centre, at an anchor's `scale` 100 `COSMETIC_BASE_WIDTH` (250/1000) of the
painting's width, centred on the anchor and turned by its `rotate`. A **sticker** is composed from
its content record, as Dragon Valley's composer does (`stickerPicture`): in one 100 × 100 box, a
flat disc in the sticker's `color` (centre 50, 50, radius 40) drawn by the shell, S5's `frame` SVG
over it (its rim covers the disc's edge) and the `icon` SVG on top. An ID the catalog lacks is
drawn as a **visibly labelled dev placeholder**: a simple shape of its kind at the size S5 ships it
(scenes and maps 1664 × 928, docs/art.md §3), marked "DEV <art id>" (`data-placeholder`), so S5's
files drop in without code changes as the catalog grows and nothing moves when they do. A catalog
file outside `assets/art/` is ignored, and an unreadable catalog means placeholders everywhere.

What the shell does so that real paintings drop in:

- **Backdrops** cover their screen (`object-fit: cover`, standing on the bottom edge); a placeholder
  scene is faded, a painting is shown at full strength. The title shows `scene/title` once the
  catalog lists it and its own open water until then: the first screen never shows a placeholder.
- **Text over a painting sits on paper** (at least 85 % opaque), because a painting's colours are
  not the palette's and the deep regions are dark: the grotto's greeting, a round's or a board's
  title and meter, locked regions on the map, every card and label.
- **The map and a region's scene** are boards as tall as their painting is for its width, sized to
  the screen by the painting's own ratio (`--picture-ratio`); markers and level nodes sit in
  thousandths of the painting (`game/map.ts`), so they stay on the open water S5 paints there.
- **A monster's two forms** (`monsterForms`): S5 trims each cut-out to its own box, so the battle
  and the freeing draw both in the inked painting's box, the freed one under the inked one, each
  whole and standing on the box's ground, centred.
- **Osmička cheering** (`character/osmicka/happy`): beside the results of a finished round (her
  portrait after a stop or a rest), and in the placement check, whose questions she asks: she
  cheers a right answer until the next miss.

`test/e2e/art.spec.ts` rehearses S5's next batch before it exists (§15).

### 16.3 The screens

| Screen                                                                                                                                   | Module                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Children and the profile editor (name, picture, kluk/holka/nechci říct, 3. or 4. třída)                                                  | `divers.ts`, `editor.ts`          |
| Story beats with read-aloud, the first egg                                                                                               | `story.ts`, `eggs.ts`             |
| The grotto: the featured friend and its growth, Dnešní výprava, today (goal, week, quests, chest), the places                            | `hub.ts`                          |
| The sea map (shallows, deep), a region's levels, a level's intro                                                                         | `map.ts`, `region.ts`, `level.ts` |
| Problem rounds: Krmení, Inkoustová věta, Lov chyb, Určování, Svačinka, the placement check, the monster battle and the Inkoustíci ambush | `round.ts`, `problem-view.ts`     |
| Boards: Pexeso, Perlový náhrdelník, Rybářské sítě, Ulita slov, Slovní rodinka                                                            | `boards.ts`                       |
| Results with the big moments (hatching, a monster freed, a grade done) and Osmička cheering                                              | `results.ts`                      |
| U Mrože, friends and wardrobe with the grotto's decorations, the friends' gallery, the album, the Great Shell                            | `collections.ts`                  |
| Goodbye with the diary card                                                                                                              | `goodbye.ts`                      |

A problem is shown as the rules structure it, one step at a time: a word or sentence with its gaps
as ink blots (the current one glows, answered ones show their letters, and after a miss the right
letters stand in the gap), answered with choice tiles, the big letter pad or the Czech on-screen
keyboard (`ui/czech-keyboard.ts`: the letters with diacritics, QWERTZ, Shift, space; keys never
take focus, so a physical keyboard works the same), a category, or a word to pick (the sentence of
a Lov chyb, an odd one out, a related word). Read-aloud says a gap as a pause, never the spelling.
A miss is "Skoro!" with the right answer and the strategy that helps; nothing is ever lost.
Nápověda asks the rules once a problem (they take one hint each); a later tap shows it again. A
hint shown before a miss is said once: the miss's feedback carries its line, and the hint's own box
gives way. A hint is a strategy, never the answer: a related word, a test form, a listed-words
rhyme, _ten, ta, nebo to?_ (_ti, ty, nebo ta?_ for a plural subject), a case question, a pattern,
a rule, a method to follow (S3's `grammar.method.*` lines), or a word that is not listed with its
gap blanked (_Slovo b_lý není vyjmenované ani příbuzné s vyjmenovaným._). Punctuation the rules
give beside a sentence's words (`marks`: _Delfíne, skoč!_) follows each word outside the highlight
and the word buttons, and is read aloud with it.
The placement check's meter counts its parts (_Části 2 / 8_), not problems, and its results thank
the child (_Díky! Osmička teď ví, kde začneš._) instead of counting right answers: the check is no
score. Leaving it from the pause ends it for good and keeps what it placed, and the pause dialog
says so kindly: a grown-up can run it again from Pro dospělé (§14).

In a battle Bublinka's bubbles wash the monster: the ink meter fills, the freed form shows through
as the ink fades, the monster's harmless ink blots wait on the screen until the child wipes them
away, and its jokes (`BattleView.jokeKey`) appear in a speech bubble; at the end the inked painting
washes off in the results to the victory sting (§9) and the freed monster tells its last joke. Each
big moment (a hatching, a monster freed, a grade done) has the screen's level-one heading while it
shows. A board sends each move as
`minigameMove` and redraws from the view, in the order the moves were made (`controller/moves.ts`):
a quick tap while the move before it is saving waits for it rather than being lost, and is dropped
only when its board is done or the rules no longer allow it. Pearls and fish move by tapping or with
the keyboard, fish also by dragging: a drop lands on what lies under the pointer besides the fish
itself (`elementsFromPoint`), so the 1 ms transitions of less motion never send a fish back to the
pool (PS-QA-09), and a cancelled gesture ends the drag without leaving a listener behind. Pexeso
says what makes a pair (`board.pairTask.<pair kind>`, one line for each of the contract's
`PAIR_KINDS`), as the other boards say their task. After a check that is not right yet, the pearls
already in their place wear
a check mark (`inPlace`). In Ulita slov the child cuts the word between its letters (never inside
"ch"), names each part with one of the asked roles and marks a zero ending ("nulová koncovka") when
endings are asked; each cut is a whole 48 px target that reaches over the letters' edges, the word's
spacing kept (PS-QA-01). In Slovní rodinka the child picks every word related to the head word. A
check that is not right yet says so and leaves the board as it was.

Layouts are touch-first for a landscape tablet. On a landscape window at least 900 px wide every
child's screen fits at 100 % text without page scrolling, every control in view: at 1024 × 768,
1024 × 698 (an iPad's under Safari's bars), 1180 × 820, 1280 × 800, 1366 × 657 and 1536 × 730
(`test/e2e/fit.spec.ts`; S6's PS-QA-04 and PS-QA-05). The grotto sets the friend beside today's
card, the places down the right and Dnešní výprava with its note along the bottom; the friends'
strip gives way to the "Kamarádi" place beside it, which opens the same screen. A round sets the
companion beside the problem card, with an Inkoustík's ambush standing under it rather than in the
card, and its title shares a line with its meter. The profile editor sets kluk/holka beside the
grade, the pictures in one row and, with room, "Ponořit se!" in the same row. The results card
never runs past the screen: a big day's news scroll inside it (a named region in the Tab order),
the button onward in view. A short landscape window (up to 860 px high) draws words, pictures and
the letter pad a little smaller, never a target, and today's card in the grotto loses only its
visible heading. Each game screen is a size container, so a layout that needs room asks for it in
`em` (`styles/game.css`): at 125 % text and more the landscape layouts give way as the room runs
out, and at 200 % text, as on a phone, the grotto and rounds become one column (they may scroll,
never sideways: a round's tools and U Mrože's line wrap), the painted map becomes a list of region
cards and a region's level nodes wrap in rows. Text on open water or a painting always sits on
paper, targets are at least 48 px, and every state shows a shape or a word as well as a colour.

### 16.4 Music and the painted maps

Screens name a mood (§9): `grotto`, `map`, `practice`, `battle`. Region markers on the painted sea
maps and level nodes on a region's scene sit at spots the shell defines in thousandths of the
picture (`game/map.ts`): S5 paints open water there.

### 16.5 Still to come

The dolphin race (in no level of the pack yet, and with no way in on screen: until it has one, its
switch in a child's settings waits too, `RACE_ON_SCREEN` in `screens/grownups.ts`), the snack
basket's details and the finale join in a later pull request.

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
