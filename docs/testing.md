# Testing and verification

Everything authoritative is headless and deterministic, so almost all evidence is produced without
pixels. This document is the verification strategy and the discipline every test follows, the same
as Dragon Valley's. It adopts the Aegis engine's test rules (AGENTS.md §6): **a test's job is to
name the broken thing; a golden is a pinned literal, never self-referential; every test is
mutation-checked.**

The foundations' tests exist (§3). The rules (S2), the content (S3), the shell (S4) and QA (S6) add
theirs as they land; where this document describes a check that does not exist yet, it says
"planned" and names the owner.

## 1. The gate

`npm run verify` is the one gate, locally and on CI (Ubuntu and Windows). `scripts/verify.mjs`
starts every tool directly with Node (no shell, so each exit code is observed), runs every step even
after one fails, and records each step in `.verify-report.json` (never committed):

1. **build**: the static site in `dist-site/`, with its digest-checked offline resource graph;
2. **typecheck**: `src/rules` (ES2022 only), `src/app` (DOM), the worker (WebWorker), and the
   tests, configs and `@ts-check` scripts;
3. **lint**: ESLint with no warnings allowed: determinism rules, dependency boundaries, the
   golden-hash ban;
4. **format**: Prettier (LF everywhere);
5. **content**: `scripts/validate-content.mjs --strict-coverage`: catalogs and their variant
   convention, Czech typography, reading-font coverage and English for every grown-ups' string; the
   curriculum's coverage (every objective of curriculum.md needs a lesson and a monster level); the
   pack under the domain contract (with the lexicon's linguistic checks), its strings, its history,
   its coverage and its agreement with curriculum.md; art references once S5 publishes the art
   catalog ([architecture.md](architecture.md) §3);
6. **lexicon**: `scripts/lexicon/check.mjs`: the word bank's linguistic checks
   ([lexicon.md](lexicon.md) §1);
7. **test**: Vitest (unit, trace, migration, simulation and tooling). The run is
   audited: every `*.test.ts` file under `test/` outside `test/e2e/` must have run, nothing may be
   skipped or left as todo, every test must pass and at least one must;
8. **lockfile**: every registry URL in `package-lock.json` is `https://registry.npmjs.org/`.

`node scripts/verify.mjs --only <prefix>` runs the steps whose ID starts with the prefix
(`npm run typecheck` runs the four typecheck steps) and writes no record. CI audits the record again
in a separate step outside npm (`node scripts/verify.mjs --audit .verify-report.json`, run even when
the gate failed), so a lost exit code cannot turn a failed gate green. The e2e jobs run the browser
suite (§5) on Chromium, Firefox and WebKit, one job per engine.

## 2. Rules for every test

1. **Name the capability.** Assertion labels read as bug reports ("i, í, y and ý have different
   outlines", "the worker is not a member of the graph it serves"). Prefer event assertions where
   the capability emits a rules event.
2. **Independent provenance.** An equality is an oracle only if its two sides do not share an
   ancestor. Expected values are written by hand from the design, the curriculum or Czech grammar,
   or computed by an independent oracle. Never compare a run with itself. The SDK pin is copied by
   hand from the packer's output and compared with the tarballs _and_ with `artifacts.json`;
   Dragon Valley's storage names are literals in the isolation test, not read from its checkout. A
   Czech problem's expected answer is written by hand or taken from the reviewed lexicon entry,
   never computed by the code under test.
3. **Goldens are literals.** `GOLDEN_HASH` and `GOLDEN_TRAJECTORY` (a digest of every commit hash)
   are captured once from a green run and pinned with a comment on their provenance (S2's traces). ESLint rejects `toBe(run.hash)`, `toBe(host.hash())` and `expectedHash: host.hash()`.
4. **Mutation-check.** Break the capability, watch the named assertion go red, put it back. The PR
   that adds a test lists its mutations. S2's golden traces also carry automated mutation checks
   (every answer graded as wrong, answers that cost no turns, a missing capability, another seed),
   as Dragon Valley's do.
5. **Determinism in tests too.** Tests under `test/**` except `test/e2e/**` follow the rules'
   determinism lint: no `Date`, `performance`, `Intl` or global `crypto`, no `Math.random` or
   transcendental `Math`, no locale functions.

### When a golden moves

A golden changes only for a deliberate change to rules, content or the SDK. Before re-pinning, check
that every named check still passes (they describe behaviour; the golden only detects change),
understand why the hash moved, then pin the new literals and write the reason and the old and new
values in the commit message. Content changes move the golden because the pack's hash is part of
every snapshot: `npm run content:bump -- <revision>` gives the change its own revision and archives
the deployed pack in `content/history/`; then pin the new revision's content hash in `REVISIONS`
(`test/unit/content/pack.test.ts`) and re-pin the traces. An SDK update
can move goldens too ([sdk-update.md](sdk-update.md)).

## 3. What each test folder is for

| Folder            | Runner     | What belongs there                                                                         |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `test/unit/`      | Vitest     | modules in isolation: the contract, rules modules, the shell's logic (happy-dom installed) |
| `test/traces/`    | Vitest     | command traces through the real runtime with literal goldens (S2)                          |
| `test/sim/`       | Vitest     | the learner-simulation bots' model and checks, short runs on the game's pack (§4; S2)      |
| `test/migration/` | Vitest     | saves restored mid-round and across content revisions (S2; S3's history later)             |
| `test/tooling/`   | Vitest     | the build, the scripts, the SDK pin and the lockfile                                       |
| `test/e2e/`       | Playwright | the built site in real browsers (§5); `support/` holds its helpers                         |

### The foundations' tests

- `test/unit/persistence/origin-isolation.test.ts`: no storage name can equal, extend or be extended
  by one of Dragon Valley's, every string constant of the persistence contract is covered, the real
  SDK offline store shares one CacheStorage with Dragon Valley's pack without touching a byte of it,
  and `src/` uses no direct storage API ([architecture.md](architecture.md) §5).
- `test/unit/app/fonts.test.ts`: Pearl Reading matches its provenance (Andika 7.000, SIL OFL 1.1,
  digests, at most 80 KiB per face), is renamed but keeps the copyright and licence records, ships
  `OFL.txt` unchanged, covers the Czech alphabet in both cases and the required punctuation, spaces
  and arrows, and keeps i, í, y and ý (and I, Í, Y, Ý) apart: four glyphs with different outlines,
  the same acute on í and ý as on á, é, ó and ú, descenders on y and ý only, a barred capital I.
- `test/unit/app/text.test.ts`: one-letter prepositions and conjunctions are bound to the next word
  with a no-break space; catalogs are flat maps of non-empty strings, and a missing key throws
  instead of reaching the screen.
- `test/tooling/build.test.ts`: a verified resource graph for `/pearl-sea/`; the SDK bundled only
  from the installed tarballs and the worker from the public offline export, pinned to the revision
  and to this game's namespace and message, never Dragon Valley's; a Czech page with the reading
  font and `cs.ui.json` in the graph and no provenance shipped; the pack, its catalogs and the
  history archives shipped (archives as `data`) and none of the content sources; `licenses.txt`
  with the game's and the SDK's notices, the font's licence and the art and music credits;
  reproducible
  revisions; forbidden modules refused; drifted bytes (even at the same length), extra files and
  bad bases rejected; no overwrite without `--clean`.
- `test/tooling/content-bump.test.ts`: in a throwaway git repository, the deployed pack is archived
  byte for byte (decompressed) in a gzip archive without an OS byte, and only the top-level revision
  changes; a second run changes nothing; an archive compressed differently but holding the same
  bytes is kept; malformed revisions, revisions that are not newer, a changed or unreadable archive
  and a branch behind the deployed pack are refused.
- `test/tooling/history-archive.test.ts`: the archive format of `scripts/lib/history.mjs` agrees
  with the contract's `contentHistoryPath`; a pack survives the round trip byte for byte under the
  fixed gzip header; plain JSON, a file name, a modification time, zlib's Linux and Windows OS
  bytes, a second member and trailing bytes are refused.
- `test/tooling/lockfile-registry.test.ts`: every registry URL is canonical (with an anti-vacuity
  count), the SDK comes only from the vendored tarballs, `.npmrc` still names the proxy, every job
  that installs packages sets `NPM_CONFIG_REGISTRY` at job level, and CI's verify job runs exactly
  `npm run verify`.
- `test/tooling/validate-content.test.ts`: the repository's content passes; planted catalog,
  locale, English-key, scope and variant-convention mistakes and each Czech typography rule are
  rejected with a named message; characters the font cannot draw are named by code point; on the
  fixture pack, pack diagnostics, missing strings, an overlong story line, a wrongly named archive,
  a file in `content/history/` that is not an archive, an archive with zlib's OS byte,
  curriculum gaps, a level mapping that disagrees with curriculum.md and missing art (the pack's
  and the shell's) are reported, strictly with `--strict-coverage` and `--strict-art`; a cosmetic
  that is not a 100 × 100 SVG fails the art catalog.
- `test/unit/contract/*.test.ts` (the contract, on the fixture pack
  `test/fixtures/contract/mini-pack.json`): canonical IDs and art IDs; the character and shell art,
  the cosmetic anchor scale (placement computed by hand) and the art catalog's cosmetic rule; the
  music loops, their fallback and the victory sting; the Czech alphabet, Czech
  alphabetical order (ch after h, č after c, pila before píla), the consonant classes, the 14
  patterns by gender and the case questions; lexicon IDs, gapped text, forms (ambiguous forms keep
  only what they show; composed past, future and conditional; the reflexive pronoun after the
  auxiliary) and each linguistic check against a planted mistake; every problem kind through its
  schema, incoherent problems refused, one expected answer per step, case-sensitive typed answers,
  item IDs built and parsed; each generator's item universe (a form that several cells show is one
  item, named by its first cell; `canonicalItem` maps a retired form item to it) and the parameter
  cross-checks; the
  fixture pack valid and each class of authoring mistake reported with a named diagnostic; art and
  catalog keys collected, grammar terms included; the Czech plural categories and the catalog
  convention; days, the initial state (without the form of address or the language) and actions.
- `test/unit/contract/curriculum-doc.test.ts`: curriculum.md parses with the gate's parser into
  well-formed objectives, each with a lesson and a monster level; it uses every strand and region of
  the contract, names an RVP outcome of each objective's grade and covers all 17 outcomes, teaches
  each objective in its grade's sea, gives Krakatice one arm per strand, agrees with design.md on
  every level (one monster level per region, lessons numbered 1..n) and, once the pack exists, with
  the pack on every level's objectives.
- `test/unit/content/pack.test.ts`: the content pack validates, is the build of its sources
  (`content/pack-src/pack.json`, the region files and the word bank) and is pinned by content hash
  (`REVISIONS`, as Dragon Valley's `content.test.ts`); `content/history/` holds only gzip archives,
  and every archived revision, decompressed, stays unchanged, valid and with its catalog keys; the
  authoring rules of [content.md](content.md) §3 hold (listed
  words and sentences serve their skills, sentence gaps keep to the skill's rules, every skill is
  practised in a level or the placement check, ambiguous points are taught in sentences, every
  problem item feeds a friend unless its skill is in the basket on purpose, friends' sets hatch in
  their lessons).
- `test/tooling/lexicon-check.test.ts`: the word bank passes the lexicon checker, each planted
  linguistic fault is reported, and the exit codes are right ([lexicon.md](lexicon.md) §1).
- `test/tooling/sample-problems.test.ts`: the problem sampler writes Slunná laguna the same way
  twice, samples every problem skill without a failure, and asks _led_ only in a sentence
  ([content.md](content.md) §2).
- `test/tooling/vendor-sdk.test.ts`: exactly one vendored version, recorded as a clean build of the
  pinned commit; each tarball matches both `artifacts.json` and the literal pin; `package.json`,
  `package-lock.json` and `node_modules` name exactly this set.
- `test/e2e/smoke.spec.ts`: the site boots at `/pearl-sea/` into the Czech title screen with no page
  error, console error, failed request or request to another origin; Czech text is drawn in Pearl
  Reading; the CSP is same-origin; one-letter words never end a line; axe finds no WCAG 2.1 A or AA
  violation on the title screen.
- `test/e2e/isolation.spec.ts`: Dragon Valley's save and offline caches, seeded under their real
  names, survive this game's boots unchanged; every database, cache and worker scope belongs to one
  of the two games, and localStorage stays empty.
- `test/e2e/history.spec.ts`: a save made on the newest archived revision (played in Node by S2's
  trace player on the decompressed archive) opens in the browser: the shell fetches
  `content/history/<revision>.json.gz` as a gzip file without a Content-Encoding, decompresses it
  with `DecompressionStream`, restores the save and, at the grotto, moves it to the newest pack
  with the chosen friend and the completed lesson kept.

### The rules' tests (S2)

On the rules' lagoon fixture (`test/fixtures/rules/lagoon-pack.ts`: Slunná laguna and the first
cave lesson with real Czech words, forms and sentences) and the contract's mini pack, until S3's
pack lands; the traces' oracle (`test/traces/support.ts`) answers from the lexicon's raw letters and
`{correct|alt}` sentences and plays boards from the typed view, never from the code under test.

- `test/unit/learning/`: response buckets, Leitner boxes, the effort path and mastery; every
  servable item of every problem skill gives schema-valid problems whose expected answer is the
  oracle's, with unique options that include it once and only real alternatives besides, and keys
  for every letter, over the fixtures and the game's pack; the choice generators (`classify`,
  `odd-one-out`, `relation`) over the three packs and test skills of every dimension, basis and
  relation, with the targets, school-order options, sets, audience and tempting options of design
  §5.7 and §6.6; ambiguous points asked in sentences; selection without repeats.
- `test/unit/minigames/`: the three custom adapters (validation, moves, never punishing,
  completion) and the five board makers (each board of its own skill's words), typed views and
  credits; every minigame activity of the game's pack makes boards.
- `test/unit/progression/`: battles (no wash or refill on a miss, the kindness cap frees the
  monster, splashes, joke cadence and cycling, arms, spaced review, the view after a reload);
  ambushes (never change a problem, only after Muréna, eligible activities and problems, at most one
  a round, the bonus coin); the placement ladder (passing, three misses, a failed step, leaving,
  floored percentages, unaskable steps, never a first lesson or a monster); Svačinka (size, first
  tastes, the review guarantee); steps (one turn a gap, Lov chyb's credit, re-asks, hints, input);
  the boards' review (starving items first, then the chosen egg, then due or never met; a board on
  a day without a level while items wait; boards while a board-only item starves, before
  Svačinka's starving round, at most six a day); pacing (new levels held while recent success is
  below the band or more than 40 items are due, never on the first or every third day of practice,
  never a level under way) and Svačinka's likeliest successes first below the success target.
- `test/unit/rules/adapter.test.ts`: every rejection code changes nothing; U Mrože, outfits, the
  grotto, quests, the chest and settings.
- `test/unit/contract/events.test.ts`: event names, and docs/contract.md §13 lists exactly them.
- `test/traces/`: golden traces with named checks and automated mutation checks: a 3rd grader's
  first session with each lagoon egg (the egg hatches in lesson 1, re-ask timing, stars, the first
  hat); a 4th grader's first sessions (the placement check, Kořínek hatching in the first session,
  the chosen lagoon egg in a later session after Svačinka's first tastes, before the other lagoon
  eggs); the lagoon end to end with Muréna's battle and the first Inkoustíci; the two finales on the
  finale fixture (`test/fixtures/rules/finale-pack.ts`): Ledana's six icicles completing the 3rd
  grade and opening the deep, the Krakatice's ten arms (arm _k_ asking only skill _k_) completing the
  finale once, and the kindness cap freeing her for a child who misses every answer.
- `test/migration/next-revision.test.ts`: a mid-round save restored in a new process goes on with
  the same commits; the next content revision activates only at a safe boundary and keeps all
  progress; old saves keep their revision; a revision is never reused.
- `test/migration/merged-forms.test.ts`: the shipped pack serves every form once (the seven
  duplicate forms of 1.2.4 retired, each mapped to its kept item). A save on the newest archived
  pack holding records under retired IDs restores. After the next revision activates:
  - no retired ID is left, and each kept item holds the merged record;
  - every other record and all other progress are untouched;
  - every answer is still counted, and each form keeps its best pearl;
  - no friend share, skill or objective mastered count drops, and merging again changes nothing.

  The same holds when the save moves to the pack the site serves.

### Planned evidence

- **Lexicon** (S3): each linguistic check of the content gate rejects a planted mistake.
- **Command traces** (S2): Ledana's and the Krakatice's finales on the real pack, once S3's deep
  regions land (today on the finale fixture, above).
- **Learner simulation** (S2): §4; the long runs' results are in balance-report.md, and the targets
  it proposes are pinned once the coordinator agrees them.
- **Saves and migration** (S2, S3): a failed checkpoint retried without a double reward; a shipped
  save restored with its archived pack and moved to the current pack at the hub; every revision's
  content hash pinned.
- **Shell logic** (S4): profiles, preferences and recovery; Czech plural forms (1 mince, 3 mince,
  5 mincí) and praise by form of address, checked against hand-written Czech; read-aloud chooses
  only local Czech voices.
- **Browser** (S6): §5; IndexedDB faults, a watch for blank screens between screens and focus rings
  checked by their pixels in Phase 2.

## 4. Learner-simulation bots (S2)

Deterministic synthetic learners play the real rules for simulated weeks and give measurable proxies
for "fun" and "learning", as Dragon Valley's do. Each bot is a seeded model of answering
(`test/sim/learners.ts`): per-item strength from Czech priors (the 2nd grade's spelling, the
consonants and the alphabet known; the 3rd grade's listed words and grammar new; the 4th grade's
barely known) rising with practice and fading with days without it, the chance of a right answer a
guess among what is offered plus the rest scaled by recall, and response times by how well the item
comes to mind, with typing and reading a sentence. The driver (`test/sim/driver.ts`) plays the real
adapter through the runtime host one day after another, following the daily adventure (story, the
first egg, the placement check, Svačinka, levels, board replays, the chest, free play), plays
boards with the trace harness, buys at U Mrože, and records what a grown-up would see:

| Bot        | Model                                                  |
| ---------- | ------------------------------------------------------ |
| perfect    | always right and quick, plays every day                |
| average    | learns an item in a few exposures, forgets slowly      |
| struggling | needs many exposures, forgets quickly, slow and clumsy |
| slow       | learns like the average child but is never quick       |

Each check (`test/sim/report.ts`, `CHECKS`) is named by what it measures, and its target
(`TARGETS`) was agreed with the coordinator before it was pinned: success per session of the
average child in the band, the struggling child's floor, coins every session, weekly progress, the
chest when the daily goal is met, the first hatch and the hatch pace of eggs received in play, no
dead end (a new level in every week with play while levels remain, every finished region's monster
freed), no known item waiting more than a week past its review day, coins per session, the first
cosmetic in the first week, fluency (the slow child brings to gold no item only problems ask), the
3rd grade's pace (Ledana freed within 16 weeks by the average child and 8 by the perfect one, or on
pace in a shorter run), and the time to `grown` (check a, within 6 weeks of the monster).
`test/sim/growth.ts` follows other growth rules alongside the shipped ones in the same run (growth
never feeds back into play).

A simulated day costs a few hundred commits, so long runs live outside the gate:
`node scripts/simulate.mjs --days 84 [--pack <file>] [--growth test/sim/growth-study.json]
[--balance <partial.json>] [--answers] [--check]` runs the four bots in parallel processes, writes
`out/simulation/report.md` and the day-by-day reports (with `--answers`, every answer with its
input, box, days overdue and the bot's recall), and fails with `--check` when a check fails.
The gate runs the bots' model tests (`learners.test.ts`), the checks against synthetic reports
(`checks.test.ts`) and short runs on the game's pack (`harness.test.ts`). The measured results, the
model's assumptions and the balance decisions are in [balance-report.md](balance-report.md).

## 5. Browser end-to-end (Playwright)

`test/e2e/` runs the built site at the Pages base `/pearl-sea/` in real browsers, with the browser
locale `cs-CZ`. The suite is S6's: specs are extended, never loosened.

```
npm run test:e2e                                   # everything, system Edge
npm run test:e2e -- smoke.spec.ts --headed         # one spec, watching
$env:PS_BROWSER_CHANNEL = 'chrome'; npm run test:e2e
$env:PS_E2E_ALL_ENGINES = '1'; npm run test:e2e -- --project=webkit
$env:PS_E2E_PORT = '4401'; npm run test:e2e       # a second run beside another one
```

- **Locally** Playwright never downloads browsers: it drives the installed Microsoft Edge (channel
  `msedge`) or Chrome (`PS_BROWSER_CHANNEL=chrome`). `PS_E2E_ALL_ENGINES=1` runs Chromium, WebKit
  and Firefox where Playwright's own builds are installed. Run one engine at a time with two
  workers (`--project=firefox --workers=2`), as CI does: with Firefox and WebKit walking the screens
  at once on one Windows machine, Firefox's IndexedDB sometimes stalls a boot past its 20 s wait.
- **On CI** each engine is its own job (`npx playwright test --project=<engine>`, two workers,
  `test.only` forbidden, `PS_E2E_AUDIT=1`). The engines' system packages come from Ubuntu's mirror,
  which is at times very slow, so their `.deb` files are cached per engine, runner image and
  Playwright version. Each job uploads `playwright-report-<engine>` (the HTML report,
  `test-results/results.json` and the QA summary), `qa-screens-<engine>` (the walks' pictures and
  contact sheets) and, when something failed, `playwright-traces-<engine>`; the QA reporter writes
  the job summary.
- **Bounded on CI, so a hang cannot run on and a green run cannot end red** (PS-QA-21: PR #22's
  Chromium job reported "15 passed" and its runner then never exited). Playwright's
  `globalTimeout` is 30 minutes, twice WebKit's slowest run (15 minutes), so a run stuck in its
  tests or their teardown fails with Playwright's own message. Once a run has reported, the QA
  reporter, which reports first on CI, exits with the run's own status if the runner is still
  alive two minutes later (`support/bounded-exit.ts`; `PS_E2E_EXIT_GRACE_MS` changes the grace).
  The test step has 35 minutes and the job 50, the last guards.
- **One run per port.** The web server (`scripts/serve.mjs --build`) builds into
  `out/e2e-site-<port>` and serves on port 4331 unless `PS_E2E_PORT` says otherwise; output goes to
  `test-results/` on the default port and to `out/e2e-results-<port>` on any other, so two local
  runs never clear each other's files. Every run starts its own server and never reuses one already
  listening: a busy port stops the run at once. Dragon Valley's suite uses 4321.
- **WebKit on Windows is not CI's WebKit.** Dragon Valley's suite found that it draws a page at
  rest only a few times a second, and that once a Tab pass has left the page the document loses
  focus, so `toBeFocused` reports the focused element as inactive. It has no Web Audio at all.
  Judge WebKit by CI, or by WebKit on Linux or macOS.
- **The QA summary.** `support/qa-reporter.ts` writes `qa-summary.md` beside each run's results
  (and the CI job summary): totals, the known defects that still reproduce and the markers that no
  longer do, the registered defects no test met, the tests that used more than half their time
  budget, the performance measurements, pages too tall to photograph, checks narrowed for an engine,
  the walk stops the game did not offer that run (a hint, a mismatch, the chest …), and axe's
  best-practice advice by rule and screen. With `PS_E2E_AUDIT=1` it fails a run in which a spec
  file never ran in a project or a test was skipped without a reason.

### The QA specs (S6)

| Spec                 | What it holds                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screens.spec.ts`    | Every slice screen in seven walks (`support/tour.ts`): photographed at tablet 1280 × 800 and 1024 × 768, desktop 1440 × 900 and phone 390 × 844; axe WCAG 2.2 A/AA at the large tablet and the phone; layout checks at every size; play screens that fit a landscape tablet; nothing looping with less motion; a walk at 200 % text |
| `input.spec.ts`      | A new diver's first lesson by keyboard alone (Tab both ways, arrows, typed letters, every control with a focus ring) and by touch alone; fish dragged into their nets with a finger, at normal motion and with less motion                                                                                                          |
| `read-aloud.spec.ts` | Only local Czech voices (Zuzana), never the remote default, at 0.9; a gap read as a pause, never spelled; auto-read; pausing silences; no local Czech voice hides the speakers and the grown-ups' area says why; a late voice list is offered at once                                                                               |
| `offline.spec.ts`    | Installed, then the test's own server shut down: the game opens from the worker and saves; the browser's offline mode (not WebKit); a browser that cannot install says so                                                                                                                                                           |
| `audio.spec.ts`      | Watched from outside (`support/audio.ts`): the first tap unlocks audio; the grotto, practice and battle loops; the music stopped for the victory sting and back after it; decoded audio mono and within the manifest's budget                                                                                                       |
| `perf.spec.ts`       | Script, style and offline pack sizes; a first visit on fast and slow 4G with a 4× slower processor (Chromium); feedback after a tap and the longest task while playing ([qa/performance.md](qa/performance.md))                                                                                                                     |
| `harness.spec.ts`    | Each guard kind, the axe audit, the layout checks and the audio probe shown a planted fault                                                                                                                                                                                                                                         |
| `live.spec.ts`       | The deployed site, on request only (`PS_E2E_LIVE=1`, it needs the internet): boots clean with its text compressed; installed for offline play, it opens and plays without the network                                                                                                                                               |

`PS_QA_DOCS=1 npm run test:e2e -- screens.spec.ts` also rewrites [qa/screens.md](qa/screens.md)
with the tablet pictures, small, for review without running anything. The QA reports are in
[qa/](qa/): [screens](qa/screens.md), [accessibility](qa/accessibility.md),
[performance](qa/performance.md), [defects](qa/defects.md) and [coverage](qa/coverage.md).

### Guards

Every spec imports `test` and `expect` from `support/fixtures.ts`, whose automatic `guard` fixture
(Dragon Valley's `support/guard.ts`, under this game's names) watches the whole browser context and
fails the test on any console message of any level, uncaught error or rejection, the game's own
error screen (the shell catches what nothing else did and shows it, so the browser never reports
it), failed or 4xx/5xx request, request to another origin, outbound link or URL in the page,
`window.open`, beacon, socket or peer connection, CSP violation or navigation away. A request the
browser cancels is only noted. A test that provokes a finding on purpose says so with
`guard.allow(kind, pattern, reason)`; engine noise that is not the game's doing is listed once in
`support/known-issues.ts` (`KNOWN_ISSUES`: Firefox's bounce-tracking warning about the test
server). `harness.spec.ts` plants each kind of fault to prove that the guard and every other check
see it. `support/observe.ts` remains for the specs that also list what they saw.

### How the tests drive the game

- **Through the screen only.** Tests act as a child or a grown-up would; test IDs are handles, never
  private state. The page's hidden `boot-status` element turns `data-state="ready"` only after the
  catalog has loaded, the font has loaded or its short wait has run out, and the first screen is
  painted, so tests wait for it instead of guessing. Answers come from the game's stored save,
  restored in Node (`support/game.ts`), and boards are solved from the board view and the lexicon
  with S2's trace helpers; Pexeso is played like a child with a perfect memory and no answer key.
- **Seeded children.** A child far into the slice is played in Node by S2's trace `Player` and
  stored as the shell's checkpoint stores it (`support/saves.ts`); the walks fix the page's date
  (`WALK_DAY`) so the game serves the same day's mix each run.
- **Faults from outside**: stored records damaged as a failing disk would damage them, a stand-in
  speech engine whose voices the test chooses (`support/speech.ts`), and a Web Audio probe
  (`support/audio.ts`). IndexedDB faults installed before the game starts are planned (S6, with the
  save and recovery walks of Phase 2).
- **Named waits only.** Every wait is for a named condition. There are no fixed sleeps except where
  a duration is the subject.
- **Time budgets.** A test has 120 s and an `expect` 10 s (`playwright.config.ts`). Long flows
  declare more (`test.slow()`, `test.setTimeout`); a budget is at least twice the test's slowest
  time on CI, and the QA summary lists every test that used more than half of its budget, so a
  budget is raised before a slower runner turns it into a failure.
- **Accessibility and layout.** axe-core (WCAG 2.2 A and AA rules fail a test, best-practice rules
  are advice) on every screen and state of the walks at the tablet and phone sizes; Dragon Valley's
  layout checks (`support/layout.ts`: no sideways scrolling, every control inside the viewport and
  at least 48 × 48 px, nothing cut off, no word broken in the middle) at all four sizes; focus rings
  on every control the keyboard journey reaches. Every engine applies a resize to the page's `dvh`
  styles a moment late (up to 0.4 s), so a page measured at once is as tall as the window before:
  the walks resize with `resize()` (`support/screens.ts`), which waits for a `100dvh` canary to
  follow. A watch for blank screens between screens and focus rings checked by their pixels are
  planned (S6, Phase 2).

### Adding a browser test

Import `test` and `expect` from `support/fixtures.ts`, drive the game through the screen, wait for
named conditions, give every assertion a label that reads as a bug report, and plant the fault once
to watch it go red. A new screen joins a walk in `support/tour.ts`, so it is photographed and
checked at every size.

## 6. Flake policy

A flaky test is a defect, in the game or in the test, and is treated as one.

- **No retries.** `playwright.config.ts` sets `retries: 0` locally and on CI, and Vitest does not
  retry. A test that passes only on a second try has found something.
- **Nothing skipped.** CI forbids `test.only`; the gate's audit fails on a skipped or todo Vitest
  test and on a test file that never ran, and the QA reporter (`PS_E2E_AUDIT=1` on CI) fails a
  browser run in which a spec never ran in a project or a test was skipped without saying why.
- **Determinism first.** Vitest tests follow the determinism lint (§2) and use no clocks or unseeded
  randomness. Browser tests wait only for named conditions; their timeouts are generous because
  WebKit on a shared runner is slow, not because anything waits.
- **Investigate, then record.** A failure that shows only under some timings or on one engine is
  reproduced from its trace (kept on failure) and fixed. A defect that cannot be fixed at once is
  registered in `support/known-issues.ts` (`DEFECTS`, with `KNOWN_LAYOUT` and `a11y.ts`'s
  `KNOWN_AXE`; [qa/defects.md](qa/defects.md) has each one's repro and owner): the test states the
  behaviour the game should have and wraps that one assertion in `unlessKnown(...)`; a defect seen
  on one engine is listed for that engine and stays a failure everywhere else; a passing run of an
  intermittent defect is noted ("not seen this time"), never taken for a fix. Nothing unlisted is
  tolerated.
- **Engine limitations are annotated, not hidden.** Where an engine cannot do what a check needs,
  the test narrows the check for that engine and says so in an annotation. `isolation.spec.ts` does
  this for Playwright's WebKit, whose ephemeral contexts keep cache names but drop their entries on
  navigation: a control cache shows whether entries survive, and only names are compared where they
  do not.

## 7. Human checkpoints

The user approves the art style, each batch of characters on a review board and the art in the
running game; auditions the music and sounds; spot-checks words, families and categories; and
**playtests the vertical slice with the child**, after which the team iterates. S6 reviews the Czech
copy. These are review gates the coordinator tracks, not claims of automated tests.
