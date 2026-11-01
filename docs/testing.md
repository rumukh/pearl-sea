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
7. **test**: Vitest (unit, trace, migration and tooling; simulation checks later). The run is
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
| `test/sim/`       | Vitest     | the learner-simulation bots' model and checks (§4; S2, planned)                            |
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
  font and `cs.ui.json` in the graph and no provenance shipped; reproducible revisions; forbidden
  modules refused; drifted bytes (even at the same length), extra files and bad bases rejected; no
  overwrite without `--clean`.
- `test/tooling/content-bump.test.ts`: in a throwaway git repository, the deployed pack is archived
  byte for byte and only the top-level revision changes; a second run changes nothing; malformed
  revisions, revisions that are not newer, a changed archive and a branch behind the deployed pack
  are refused.
- `test/tooling/lockfile-registry.test.ts`: every registry URL is canonical (with an anti-vacuity
  count), the SDK comes only from the vendored tarballs, `.npmrc` still names the proxy, every job
  that installs packages sets `NPM_CONFIG_REGISTRY` at job level, and CI's verify job runs exactly
  `npm run verify`.
- `test/tooling/validate-content.test.ts`: the repository's content passes; planted catalog,
  locale, English-key, scope and variant-convention mistakes and each Czech typography rule are
  rejected with a named message; characters the font cannot draw are named by code point; on the
  fixture pack, pack diagnostics, missing strings, an overlong story line, a wrongly named archive,
  curriculum gaps, a level mapping that disagrees with curriculum.md and missing art are reported,
  strictly with `--strict-coverage` and `--strict-art`.
- `test/unit/contract/*.test.ts` (the contract, on the fixture pack
  `test/fixtures/contract/mini-pack.json`): canonical IDs and art IDs; the Czech alphabet, Czech
  alphabetical order (ch after h, č after c, pila before píla), the consonant classes, the 14
  patterns by gender and the case questions; lexicon IDs, gapped text, forms (ambiguous forms keep
  only what they show; composed past, future and conditional; the reflexive pronoun after the
  auxiliary) and each linguistic check against a planted mistake; every problem kind through its
  schema, incoherent problems refused, one expected answer per step, case-sensitive typed answers,
  item IDs built and parsed; each generator's item universe and the parameter cross-checks; the
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
  (`REVISIONS`, as Dragon Valley's `content.test.ts`); every archived revision stays unchanged,
  valid and with its catalog keys; the authoring rules of [content.md](content.md) §3 hold (listed
  words and sentences serve their skills, sentence gaps keep to the skill's rules, every skill is
  practised in a level or the placement check, ambiguous points are taught in sentences, every
  problem item feeds a friend unless its skill is in the basket on purpose, friends' sets hatch in
  their lessons).
- `test/tooling/lexicon-check.test.ts`: the word bank passes the lexicon checker, each planted
  linguistic fault is reported, and the exit codes are right ([lexicon.md](lexicon.md) §1).
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

### The rules' tests (S2)

On the rules' lagoon fixture (`test/fixtures/rules/lagoon-pack.ts`: Slunná laguna and the first
cave lesson with real Czech words, forms and sentences) and the contract's mini pack, until S3's
pack lands; the traces' oracle (`test/traces/support.ts`) answers from the lexicon's raw letters and
`{correct|alt}` sentences and plays boards from the typed view, never from the code under test.

- `test/unit/learning/`: response buckets, Leitner boxes, the effort path and mastery; every
  servable item of every problem skill gives schema-valid problems whose expected answer is the
  oracle's, with unique options that include it once and only real alternatives besides, and keys
  for every letter; ambiguous points asked in sentences; selection without repeats.
- `test/unit/minigames/`: the three custom adapters (validation, moves, never punishing,
  completion) and the five board makers, typed views and credits.
- `test/unit/progression/`: battles (no wash or refill on a miss, the kindness cap frees the
  monster, splashes, joke cadence and cycling, arms, spaced review, the view after a reload);
  ambushes (never change a problem, only after Murena, eligible activities and problems, at most one
  a round, the bonus coin); the placement ladder (passing, three misses, a failed step, leaving,
  floored percentages, unaskable steps, never a first lesson or a monster); Svačinka (size, first
  tastes, the review guarantee); steps (one turn a gap, Lov chyb's credit, re-asks, hints, input).
- `test/unit/rules/adapter.test.ts`: every rejection code changes nothing; U Mrože, outfits, the
  grotto, quests, the chest and settings.
- `test/unit/contract/events.test.ts`: event names, and docs/contract.md §13 lists exactly them.
- `test/traces/`: golden traces with named checks and automated mutation checks: a 3rd grader's
  first session with each lagoon egg (the egg hatches in lesson 1, re-ask timing, stars, the first
  hat); a 4th grader's first sessions (the placement check, Kořínek hatching in the first session,
  the chosen lagoon egg in a later Svačinka, before the other lagoon eggs); the lagoon end to end
  with Murena's battle and the first Inkoustíci.
- `test/migration/next-revision.test.ts`: a mid-round save restored in a new process goes on with
  the same commits; the next content revision activates only at a safe boundary and keeps all
  progress; old saves keep their revision; a revision is never reused.

### Planned evidence

- **Generators and distractors on the real pack** (S2): the exhaustive generator tests above run
  over S3's lexicon too; the `classify`, `odd-one-out` and `relation` generators join them.
- **Lexicon** (S3): each linguistic check of the content gate rejects a planted mistake.
- **Command traces** (S2): Ledana's and the Krakatice's finales, on the real pack.
- **Learner simulation** (S2): §4.
- **Saves and migration** (S2, S3): a failed checkpoint retried without a double reward; a shipped
  save restored with its archived pack and moved to the current pack at the hub; every revision's
  content hash pinned.
- **Shell logic** (S4): profiles, preferences and recovery; Czech plural forms (1 mince, 3 mince,
  5 mincí) and praise by form of address, checked against hand-written Czech; read-aloud chooses
  only local Czech voices.
- **Browser** (S6): §5.

## 4. Learner-simulation bots (S2, planned)

Deterministic synthetic learners play the real rules for simulated weeks and give measurable proxies
for "fun" and "learning", as Dragon Valley's do. Each bot is a seeded model of answering: per-item
strength rising with practice and fading with days without it, the chance of a right answer rising
with it, and response times by how well the item comes to mind. A driver plays the real adapter
through `createRuntimeHost` one day after another, following the daily adventure, and records what
a grown-up would see. Dragon Valley's four bots are the starting point:

| Bot        | Model                                                  |
| ---------- | ------------------------------------------------------ |
| perfect    | always right and quick, plays every day                |
| average    | learns an item in a few exposures, forgets slowly      |
| struggling | needs many exposures, forgets quickly, slow and clumsy |
| slow       | learns like the average child but is never quick       |

Each check is named by what it measures, and its target is agreed with the coordinator before it is
pinned. The kinds of checks carry over from Dragon Valley: success per session inside the 70-85 %
band ([plan.md](plan.md) §4); sea friends growing by real mastery; no dead ends (every level can be
completed and every monster freed); no known item waiting long past its review day; reward pacing
(coins every session, the treasure chest when the daily goal is met).

A simulated day costs many commits, so long runs live outside the gate: a script (Dragon Valley's
`scripts/simulate.mjs`) runs the bots for weeks in parallel processes, writes a report under `out/`
and fails when a check fails. The gate runs only the bots' model tests, the checks against synthetic
reports and a short first session. The measured results, the model's assumptions and the balance
decisions are written down with the bots.

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
  and Firefox where Playwright's own builds are installed.
- **On CI** each engine is its own job (`npx playwright test --project=<engine>`, two workers,
  `test.only` forbidden). The engines' system packages come from Ubuntu's mirror, which is at times
  very slow, so their `.deb` files are cached per engine, runner image and Playwright version. A
  job has 30 minutes and its test step 15, the guard against a hang. Each job uploads
  `playwright-report-<engine>` (the HTML report and `test-results/results.json`) and, when
  something failed, `playwright-traces-<engine>`.
- **One run per port.** The web server (`scripts/serve.mjs --build`) builds into
  `out/e2e-site-<port>` and serves on port 4331 unless `PS_E2E_PORT` says otherwise; output goes to
  `test-results/` on the default port and to `out/e2e-results-<port>` on any other, so two local
  runs never clear each other's files. Every run starts its own server and never reuses one already
  listening: a busy port stops the run at once. Dragon Valley's suite uses 4321.
- **WebKit on Windows is not CI's WebKit.** Dragon Valley's suite found that it draws a page at
  rest only a few times a second, and that once a Tab pass has left the page the document loses
  focus, so `toBeFocused` reports the focused element as inactive. Judge WebKit by CI, or by WebKit
  on Linux or macOS.

### Guards

Today the boot test in `smoke.spec.ts` watches the page through `support/observe.ts`: uncaught page
errors, console errors, failed or 4xx/5xx requests and requests to another origin must all stay
empty. S6 ports Dragon Valley's automatic guard (planned): every spec imports `test` and `expect`
from `support/fixtures.ts`, whose `guard` fixture watches the whole browser context and fails the
test on any console message of any level, uncaught error, failed or 4xx/5xx request, request to
another origin, outbound link or URL in the page, `window.open`, beacon, socket or peer connection,
CSP violation or navigation away. A request the browser cancels is only noted. A test that provokes
a finding on purpose says so with `guard.allow(kind, pattern, reason)`, and `harness.spec.ts`
plants each kind of fault to prove that the guard and every other check see it.

### How the tests drive the game

- **Through the screen only.** Tests act as a child or a grown-up would; test IDs are handles, never
  private state. Today the page's hidden `boot-status` element turns `data-state="ready"` only after
  the catalog has loaded, the font has loaded or its short wait has run out, and the first screen
  is painted, so tests wait for it instead of guessing. Answers will come from an oracle in the test
  support that never calls the game's own answer code (S6, planned).
- **Faults from outside** (S6, planned): stored records damaged as a failing disk would damage them,
  IndexedDB faults installed before the game starts, and a stand-in speech engine whose voices the
  test chooses (only local Czech voices may be used or listed).
- **Named waits only.** Every wait is for a named condition. There are no fixed sleeps except where
  a duration is the subject.
- **Time budgets.** A test has 120 s and an `expect` 10 s (`playwright.config.ts`). Long flows
  declare more (`test.slow()`, `test.setTimeout`); a budget is at least twice the test's slowest
  time on CI, and S6's QA report will list every test that used more than half of its budget, so a
  budget is raised before a slower runner turns it into a failure (planned).
- **Accessibility and layout.** Today axe-core must find no WCAG 2.1 A or AA violation on the title
  screen. S6 extends the audit to every screen and state at phone, tablet and desktop sizes, with
  Dragon Valley's layout checks (no sideways scrolling, every control inside the viewport and at
  least 48 × 48 px, no word broken in the middle), focus rings checked by their pixels, screenshots
  for review and a watch for blank screens between screens (planned).

### Adding a browser test

Drive the game through the screen, wait for named conditions, give every assertion a label that
reads as a bug report, and plant the fault once to watch it go red. Until the guard fixture lands,
use `observe()` and assert its lists are empty, as `smoke.spec.ts` does.

## 6. Flake policy

A flaky test is a defect, in the game or in the test, and is treated as one.

- **No retries.** `playwright.config.ts` sets `retries: 0` locally and on CI, and Vitest does not
  retry. A test that passes only on a second try has found something.
- **Nothing skipped.** CI forbids `test.only`; the gate's audit fails on a skipped or todo Vitest
  test and on a test file that never ran, and S6's QA report will audit browser runs the same way
  (planned).
- **Determinism first.** Vitest tests follow the determinism lint (§2) and use no clocks or unseeded
  randomness. Browser tests wait only for named conditions; their timeouts are generous because
  WebKit on a shared runner is slow, not because anything waits.
- **Investigate, then record.** A failure that shows only under some timings or on one engine is
  reproduced from its trace (kept on failure) and fixed. A defect that cannot be fixed at once is
  registered (S6, planned, after Dragon Valley's `support/known-issues.ts`): the test states the
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
