# The domain contract

`src/rules/contract/` is the shared language of Perlové moře: identifiers, the Czech grammar the
game teaches as closed vocabularies, the lexicon, problems and answers, item IDs, skills, the
content pack, per-profile state, actions, views, events and storage names. S2 implements the rules
on it, S3 writes the lexicon and the content in its shapes, S4 renders its views, S5 keys art and
music by its IDs, and S6 asserts on it. Everything is built on public `@aegis/runtime` schemas and
`@aegis/narrative` types, and everything is plain JSON.

The contract is Dragon Valley's with the arithmetic domain replaced by a Czech-language domain: sea
friends for dragons, monsters for bosses, the Inkoustíci added, the Great Shell for the Magic
Window, and the lexicon as the source of every problem. Where a part works as in Dragon Valley,
this document says so and keeps Dragon Valley's rules; S2 ports them. The design it serves is
[design.md](design.md); the curriculum is [curriculum.md](curriculum.md).

## 1. Map

| File             | What it defines                                                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ids.ts`         | The content ID pattern; canonical regions, sea maps, friends (and the three first choices), monsters (and both finales), Inkoustíci and characters; stages, expressions, monster forms, cosmetic slots, art anchors, diver avatars, forms of address, mastery levels |
| `kinds.ts`       | Activity kinds, minigame kinds, grades, input modes, response buckets, classification dimensions, generators, random streams, event phases, jobs, runtime phases, strands                                                                                            |
| `language.ts`    | Closed linguistic vocabularies (§4.3) and `compareCzech`, Czech alphabetical order                                                                                                                                                                                   |
| `schema.ts`      | Schema helpers on the runtime `schema` API (`contentId`, `catalogKey`, `artId`, `gradeSchema`, `oneOf`, `nullable`, `objectWithOptional`, `uniqueArray`, …)                                                                                                          |
| `lexicon.ts`     | The lexicon (§8): words, families, sentences, relations, sources; `lexiconId`, gapped text, `formCells`, `validateLexicon`                                                                                                                                           |
| `problems.ts`    | Hints, problems, answers, `expectedAnswer`, `isCorrectAnswer`, item IDs                                                                                                                                                                                              |
| `skills.ts`      | Word and sentence filters, skills, generator parameter schemas, `DIMENSION_VALUES`, `CONTEXT_DIMENSIONS`, item universes (`skillItems`)                                                                                                                              |
| `minigames.ts`   | Typed minigame boards (`BoardView`), card faces and the moves of every minigame activity                                                                                                                                                                             |
| `media.ts`       | Art ID conventions (`ART`, the character and shell art lists), the art catalog schema with anchor points, the cosmetic anchor scale, the audio manifest, the music loops with their fallback, and the victory sting                                                  |
| `catalogs.ts`    | The catalog key convention: address and plural variants, `czechPlural`, `catalogHasKey`, `catalogProblems`                                                                                                                                                           |
| `content.ts`     | The content pack, `contentRegistration`, cross-reference validation, catalog, grammar, art and curriculum helpers                                                                                                                                                    |
| `state.ts`       | `ProfileState` and its schema, `STATE_VERSION` and migrations, day numbers, the initial state                                                                                                                                                                        |
| `actions.ts`     | `GameAction`, `ACTION_TURNS`, `gameActionSchema`                                                                                                                                                                                                                     |
| `views.ts`       | `GameView` and every screen's view type                                                                                                                                                                                                                              |
| `events.ts`      | `EVENTS` and payload types                                                                                                                                                                                                                                           |
| `persistence.ts` | Every storage name: adapter, database and game IDs, offline names, backup format, profile IDs and seeds                                                                                                                                                              |
| `index.ts`       | The barrel: `import { … } from '../rules/contract'`                                                                                                                                                                                                                  |

The runtime adapter, `src/rules/adapter.ts`, is S2's; §11 states what it must register.

## 2. Ownership and changing the contract

| Area                                                                                                                                                                                                                                                                                                                          | Owner                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `src/rules/contract/**`, `docs/contract.md`, the curriculum and design documents' tables and IDs, `test/unit/contract/**`, `test/fixtures/contract/**`; the toolchain (`package.json`, tsconfigs, ESLint, Prettier, `scripts/*.mjs`, `scripts/lib/**`, `vendor/**`); the reading font (`assets/fonts/**`, `scripts/fonts/**`) | S1 Foundations & contract   |
| The rest of `src/rules/**`: the adapter, the learning engine (Leitner boxes, the mix, re-asks, snack time, first tastes, placement), the generators and distractors, rounds, battles and ambushes, minigame adapters, economy, progression, story, the view; the learner simulation and traces                                | S2 Rules                    |
| `content/pearl-sea.content.json`, `content/history/**`, `content/catalogs/cs.content.json`, the lexicon sources (`content/lexicon-src/**`) and their tools (`scripts/lexicon/**`)                                                                                                                                             | S3 Lexicon & content        |
| `src/app/**` (persistence, family profiles, the grown-ups' gate, router, UI kit, offline install, audio wrapper, read-aloud, screens; the runtime map from events to sounds; rendering the static SVG art); `content/catalogs/cs.ui.json`, `content/catalogs/en.ui.json`                                                      | S4 App                      |
| `assets/art/**` (the paintings, and the static SVG eggs, cosmetics and sticker art, all listed in the art catalog), `assets/audio/**` (the whole audio pack and its manifest), `scripts/art/**`, `scripts/audio/**`, `docs/art.md`, `docs/audio.md` (local models only: [assets.md](assets.md))                               | S5 Art & music              |
| `test/e2e/**`, CI hardening (`.github/**` beyond fixes), release checks                                                                                                                                                                                                                                                       | S6 QA                       |
| Merges, `docs/plan.md`, decisions that change the approved plan                                                                                                                                                                                                                                                               | Coordinator (with the user) |

**Contract changes** (anything under `src/rules/contract/`) go through a pull request reviewed by
the coordinator, whoever makes them, because every session builds on the contract. A contract pull
request states what changed, why, and what each consumer must do. Prefer additive changes: a new
optional field, a new view field, a new event, a new union variant. Renaming or removing something
is a breaking change and needs the coordinator's agreement first.

**Data or code.** Adding regions, levels, skills of existing generators, words, families,
sentences, friends, monsters, Inkoustíci, stickers, cosmetics, quests and story beats is data (a
content revision). A new generator, activity kind, classification dimension, spelling rule,
sticker criterion, quest goal, or any value of a closed vocabulary is code plus a contract change.

## 3. Determinism

As in Dragon Valley:

- The rules are pure functions of state, content, action and the named random streams. Same
  actions, content and seed give the same state hash on every OS and in every browser (CI runs on
  Windows and Ubuntu).
- **Time enters only as data**: the child's local date in `startSession.day` (`YYYY-MM-DD`) and the
  measured response time in `answer.elapsedMs`. The shell computes both; rules never read a clock.
- **Randomness** comes only from the runtime's named streams `problems`, `distractors`, `rewards`,
  `words` and `ambush` (`RANDOM_STREAMS`), forked once by the runtime, so a reward draw or an
  ambush never shifts the next problem.
- Integer arithmetic only: no fractions in content or state (percentages are integers 0-100,
  durations are milliseconds), no `Math.random`, `Date`, `**` or floating-point functions.
- **No locale functions.** Czech alphabetical order is `compareCzech` (§4.3), never
  `localeCompare` or `Intl`; text is NFC. ESLint enforces the rules for `src/rules/**` and every
  non-e2e test.
- Rules never format text: views carry catalog keys, structured problems and the lexicon's Czech
  words.

## 4. Identifiers and vocabularies

### 4.1 Identifiers

- **Content IDs** match `CONTENT_ID_PATTERN` (`/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/`, at most 64
  characters): `sunny-lagoon`, `sunny-lagoon.3`, `sunny-lagoon.monster`, `krab-tvrdak`,
  `obj.letters.hard-soft`, `sk.listed-b`, `s.mlyn-1`.
- **Canonical v1 IDs** (`ids.ts`), in map order. The shallows teach the 3rd grade and the deep
  the 4th:

| #   | Region           | Map        | Grade | Sea friends                                                     | Monster                                      |
| --- | ---------------- | ---------- | ----- | --------------------------------------------------------------- | -------------------------------------------- |
| 1   | `sunny-lagoon`   | `shallows` | 3     | `krab-tvrdak`, `meduzka-mekulka`, `zelva-obojka` (first choice) | `murena-mumla`                               |
| 2   | `coral-reef`     | `shallows` | 3     | `barakuda-bystrinka`, `lachtan-lyzar`                           | `zralok-zrout`                               |
| 3   | `kelp-forest`    | `shallows` | 3     | `konik-mydlinek`, `pyskoun-pysny`                               | `had-zamotal`                                |
| 4   | `pirate-wreck`   | `shallows` | 3     | `jezik-sycik`, `vydra-vyskalka`, `jazyk-jazycek`                | `das-lucernik`                               |
| 5   | `pearl-bay`      | `shallows` | 3     | `hvezdice-rodinka`                                              | `zeva-lakoma`                                |
| 6   | `volcanic-vents` | `shallows` | 3     | `kalmar-desetiruky`                                             | `uhor-zhavak`                                |
| 7   | `ice-sea`        | `shallows` | 3     | `tulen-padik`, `delfin-skokanek`                                | `san-ledana` (the 3rd grade's finale)        |
| 8   | `moon-caves`     | `deep`     | 4     | `rak-korinek`                                                   | `humr-nuzkar`                                |
| 9   | `sunken-city`    | `deep`     | 4     | `stitovec-prisavka`                                             | `meduza-lepka`                               |
| 10  | `dark-trench`    | `deep`     | 4     | `klipka-vzorna`                                                 | `chobotnice-napodobnice`                     |
| 11  | `storm-sea`      | `deep`     | 4     | none (Delfín Skokánek's skills grow into the 4th grade's verbs) | `vir-casoplet`                               |
| 12  | `kraken-abyss`   | `deep`     | 4     | `klauni-dvojcata`                                               | `krakatice-inkoustova` (the finale, 10 arms) |

- **Inkoustíci**: `inkoustik-kanka`, `inkoustik-smouha`, `inkoustik-cmara`, `inkoustik-klikyhak`.
  **Characters** (not raisable): `osmicka` (Profesorka Osmička, the guide), `mroz-vousac` (Mrož
  Vousáč, the shopkeeper of U Mrože), `bublinka` (the submarine).
- **Levels** are `<region>.<n>` (lessons, numbered from 1 in map order) and `<region>.monster`
  (the region's monster level, last). The 77 v1 levels are listed in
  [design.md](design.md) and mapped to objectives in [curriculum.md](curriculum.md) §3.
- **Stable forever.** Once shipped, an ID is never renamed or reused: saves, the art catalog and
  the audio manifest refer to it. Retiring one needs a migration (§7.6). Friend and monster IDs are
  separate namespaces.
- **Catalog keys** (`catalogKey`: `/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/`) name strings in the
  catalogs (§7.4). **Art IDs** (`artId`) name entries of the art catalog (§7.5). **Item IDs** name
  what the Leitner boxes remember (§5.4). **Word IDs** are transliterated lemmas (§8.2).

### 4.2 Game vocabularies

| Vocabulary                      | Values                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Friend stages (`FRIEND_STAGES`) | `egg`, `baby`, `grown`, `crowned` (painted art for `baby` and `grown`; an egg is SVG; crowned is the grown painting plus the SVG shell crown `cosmetic/shell-crown`)         |
| Expressions                     | `idle`, `happy`, `curious`, `eating`, `sleepy`, `proud` (hints for the art, derived from state)                                                                              |
| Monster forms                   | `inked`, `freed` (each monster is painted twice)                                                                                                                             |
| Cosmetic slots                  | `head`, `eyes`, `neck` (worn: `WEARABLE_SLOTS`) and `grotto` (placed in one of `GROTTO_SPOTS` = 6 spots)                                                                     |
| Art anchors                     | `head`, `eyes`, `neck`                                                                                                                                                       |
| Diver avatars                   | `diver-1` … `diver-8` (`DIVER_AVATARS`; art `avatar/diver-n`)                                                                                                                |
| Forms of address                | `boy`, `girl`, `neutral` (`FORMS_OF_ADDRESS`; the family record only, §14)                                                                                                   |
| Mastery (pearls)                | `cloudy`, `bronze`, `silver`, `gold`                                                                                                                                         |
| Grades                          | `3`, `4` (`GRADES`; `DEFAULT_GRADE` = 3)                                                                                                                                     |
| Input modes                     | `auto`, `choice` (buttons), `letters` (the big letter pad: i í y ý, ú ů, d t, …), `typed` (the Czech on-screen keyboard)                                                     |
| Response buckets                | `fast`, `ok`, `slow`, `miss`                                                                                                                                                 |
| Problem activities              | `feeding`, `ink-sentence`, `bug-hunt`, `analysis`, `battle` (in levels); `race`, `snack`, `placement` (hub only)                                                             |
| Minigame activities             | `memory-match`, `pearl-necklace`, `fishing-nets`, `word-shell`, `word-family` (§12.1)                                                                                        |
| Strands                         | `letters-sounds`, `listed-words`, `word-meaning`, `word-structure`, `prefixes`, `parts-of-speech`, `nouns`, `verbs`, `standard-czech`, `sentences`: one per arm of Krakatice |

### 4.3 Linguistic vocabularies (`language.ts`)

The grammar the game teaches, as data the rules, the lexicon, the generators and the shell share.
IDs are ASCII and stable; the Czech school terms live in the catalogs (§7.4).

| Vocabulary                                                | IDs                                                                                                                                                | School term                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ALPHABET`                                                | the 42 letters, `ch` right after `h`                                                                                                               | abeceda                                          |
| `SHORT_VOWELS`, `LONG_VOWELS`                             | `a e i o u y`; `á é í ó ú ů ý`                                                                                                                     | samohlásky krátké, dlouhé                        |
| `CONSONANT_CLASSES`                                       | `hard` (h ch k r d t n), `soft` (ž š č ř c j ď ť ň), `both-way` (b f l m p s v z)                                                                  | souhlásky tvrdé, měkké, obojetné                 |
| `LISTED_LETTERS`                                          | `b l m p s v z`                                                                                                                                    | vyjmenovaná slova po …                           |
| `PAIRED_CONSONANTS`                                       | b/p, d/t, ď/ť, z/s, ž/š, v/f, h/ch, g/k                                                                                                            | párové souhlásky                                 |
| `PARTS_OF_SPEECH`                                         | `noun adj pron num verb adv prep conj part interj` (school order 1-10; the first five inflect)                                                     | slovní druhy                                     |
| `INFLECTION`, `MEANING_CLASSES`                           | `inflected`, `uninflected`; `action`, `thing`, `circumstance`, `property`                                                                          | ohebné, neohebné; děj, věc, okolnost, vlastnost  |
| `GENDERS`, `GENDER_CLASSES`                               | `m f n` (the 3rd grade's rod); `ma mi f n` (with animacy, the 4th grade)                                                                           | rod (mužský životný, neživotný, ženský, střední) |
| `NUMBERS`, `NOUN_NUMBERS`                                 | `sg pl`; `both sg pl` (pluralia tantum: `pl`)                                                                                                      | číslo; pomnožná jména                            |
| `CASES`, `CASE_QUESTIONS`                                 | `1` … `7` with kdo? co?, koho? čeho?, komu? čemu?, koho? co?, oslovujeme/voláme, o kom? o čem?, s kým? s čím?                                      | pády, pádové otázky                              |
| `NOUN_PATTERNS`                                           | `pan hrad muz stroj predseda soudce zena ruze pisen kost mesto more kure staveni` with `PATTERN_GENDER` and `PATTERN_WORD` (pán, hrad, …, stavení) | vzory                                            |
| `PERSONS`, `TENSES`, `MOODS`                              | `1 2 3`; `past present future`; `indicative imperative conditional`                                                                                | osoba; čas; způsob                               |
| `ASPECTS`, `VERB_FORMS`                                   | `impf pf`; `simple compound`                                                                                                                       | vid; tvar jednoduchý, složený                    |
| `REFLEXIVES`, `VERB_FINITENESS`                           | `se si` (the `reflexive` dimension adds `none`); `finite infinitive`                                                                               | zvratná slovesa; určitý tvar, infinitiv          |
| `PAST_KEYS`                                               | `m f n ma mi fpl npl` (the l-participle by gender and number)                                                                                      | příčestí minulé                                  |
| `REGISTERS`, `PROPER_KINDS`                               | `standard colloquial`; `person animal town river mountain country sea character`                                                                   | spisovná, nespisovná; vlastní jména              |
| `SEGMENT_ROLES`                                           | `prefix root suffix ending`                                                                                                                        | předpona, kořen, přípona, koncovka               |
| `WORD_RELATIONS`                                          | `synonym antonym general specific coordinate sound-alike related`                                                                                  | význam slov                                      |
| `SPELLING_RULES`                                          | 25 rules, below                                                                                                                                    | pravopis                                         |
| `SENTENCE_KINDS`, `CLAUSE_STRUCTURES`, `SENTENCE_MEMBERS` | `statement question command wish`; `simple compound`; `subject predicate other`                                                                    | druhy vět; věta, souvětí; podmět, přísudek       |

**Spelling rules** say why a gap is filled as it is. Every spelling point of the lexicon and every
sentence gap names one; hints show the rule's strategy, distractors and item IDs build on it:

| Group     | Rules                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i/y       | `vyjm` (a listed word or a word related to it), `vyjm-prefix` (vy-/vý-), `obojetna-i` (i after a both-way consonant in a word not listed), `tvrda` (y after a hard consonant), `mekka` (i after a soft consonant), `dtn-mekke` (di, ti, ni)                                                                                           |
| ě         | `de-te-ne` (dě, tě, ně), `be-pe-ve-me` (bě, pě, vě, mě inside a word), `bje-vje` (at a prefix seam: objet, vjezd), `mne` (mně inside a word), `mne-zajmeno` (the pronoun mně in the 3rd and 6th case, mě in the 2nd and 4th)                                                                                                          |
| ú/ů       | `u-zacatek` (ú at the start), `u-predpona` (ú after a prefix), `u-uprostred` (ů inside or at the end), `u-prejate` (ú in borrowed words and interjections)                                                                                                                                                                            |
| other     | `delka` (short or long vowel), `parova` (a paired consonant, proved by a test word), `velke-pismeno` (a capital letter), `predpona-predlozka` (prefix together, preposition apart), `predpona-souhlaska` (the consonant at a prefix seam), `shoda` (subject-predicate agreement in the past tense), `vzor` (an ending by the pattern) |
| sentences | `interpunkce` (the end mark by the kind of sentence, a comma between clauses), `spojka` (the conjunction that joins clauses)                                                                                                                                                                                                          |
| register  | `spisovne` (the standard word in a sentence, not its colloquial twin: _Ke snídani mám {mléko\|mlíko}._)                                                                                                                                                                                                                               |

**Czech alphabetical order** (`compareCzech`): letters compare by their primary letter, with `ch`
after `h` and `č ř š ž` after `c r s z`; other diacritics (á ď é ě í ň ó ť ú ů ý) sort with their
base letter and only break ties (`pila` before `píla`); then lower case before upper case.
`czechLetters` splits a word into Czech letters (`ch` is one).

## 5. Problems and answers (`problems.ts`)

Problems are structured, never pre-rendered: the shell renders them in the reading font with ink
blots and the letter pad, and the verbalizer reads them aloud. Every problem is self-contained:
`expectedAnswer` derives the answer of each step from the problem alone.

### 5.1 Problem kinds

| Kind       | What the child does                                                                       | Fields                                                                                                                     | Steps             |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `gaps`     | fills the ink-blot gaps of a word or sentence, one gap per step (Krmení, Inkoustová věta) | `sentence` (ID or null), `parts` (text and gap parts), `gaps[]`                                                            | one per gap (1-3) |
| `classify` | names one dimension of a word, a form, a token or a sentence (Určování)                   | `dimension`, `target {word, text}`, `context {tokens, at, marks?}` or null, `span` or null, `options`, `correct`, `hint`   | 1                 |
| `odd`      | picks the word that does not belong                                                       | `basis` (a dimension, `family` or `listed`), `words[]`, `correct` (index), `hint`                                          | 1                 |
| `relation` | picks the synonym, antonym, general word, … of a word                                     | `relation`, `target`, `options[]`, `correct` (index), `hint`                                                               | 1                 |
| `mistake`  | taps the word the ink spelled wrong, then fixes it (Lov chyb)                             | `sentence`, `tokens` (one misspelled), `marks?`, `wrong` (index), `fix` (a gap), `around` (the token split around the fix) | 2: find, then fix |

A **gap** is `{ correct, options, keys, rule, word, item, hint }`: `correct` is the right text (a
letter group such as `ý`, `mně`, or a whole token such as `odplavala`), `options` are 2-4 choices
in seeded order including `correct`, `keys` the letter pad's keys including `correct` (the rule's
pad, or where it holds no answer the gap's own options in a fixed order), `rule` the
spelling rule, `word` the lexicon word or null, and `item` the item the gap trains. A
classification's `options` keep the dimension's school order (`DIMENSION_VALUES`: the cases 1-7,
the parts of speech 1-10, the patterns by gender), never shuffled, so each value keeps its place on
screen. A classification of a whole sentence (`sentence-kind`, `clauses`) shows the sentence itself
as its `target` (`word: null`, `text` up to 240 characters; for `sentence-kind` without its end
mark, which would give the kind away) and has no `context`; every other `target` and word is a
token of at most 64 characters. **Marks** (`marks`, optional) are the punctuation written right
after each token (`''` for none, at most 4 characters, never a letter, a digit or a space), one
entry per token: _Delfíne, skoč!_ is `tokens: ['Delfíne', 'skoč']`, `marks: [',', '!']`. Without
the comma of address, _Delfíni pojďte_ reads as a subject. A classification's `context` carries
them; Lov chyb's `marks`, when present, means its `tokens` and `around` hold no marks (_dosita_
and `.`, not _dosita._). The shell writes each token, then its mark, outside the highlight.
`problemSchema` checks the fields and that the problem is coherent:
the answer is offered, every gap appears exactly once and in order, indices are in range, and
`marks` has one entry per token.

### 5.2 Answers and steps

An answer to one step is `{ kind: 'text', value }` (letters or a token written into a gap, by
choice, pad or typing), `{ kind: 'option', value }` (a category value of `classify`) or
`{ kind: 'pick', index }` (a word in a list: `odd`, `relation`, the find step of `mistake`).
`problemSteps(problem)` is the number of steps: one per gap, two for a mistake, else one.
`isCorrectAnswer(problem, step, value)` compares typed text after NFC, trimming and collapsing
spaces (`normalizeTyped`). **Case is kept**: capital letters are part of what is taught, so `v`
does not answer `V`. A problem's steps are answered one by one; a wrong step is the problem's miss
(as Dragon Valley's two-step word problems).

### 5.3 Hints

A hint shows the strategy, not just the answer (design.md):

| Hint            | Shows                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `family`        | a related word that proves the spelling (mlýn → mlynář)                                               |
| `test-word`     | a form that makes the sound clear (hrad → hrady)                                                      |
| `listed`        | the school rhyme of the listed words of a letter                                                      |
| `ten-ta-to`     | the gender test (ten pes, ta ryba, to moře); with `plural: true` a plural subject's (ti, ty, ta)      |
| `case-question` | the case question (koho? čeho?)                                                                       |
| `pattern`       | the pattern and its ending (o hradech, o strojích)                                                    |
| `rule`          | the general explanation of a spelling rule                                                            |
| `method`        | how to find the answer (`HINT_METHODS`: case, pattern, tense, mood, verb-form, sound-alike), never it |
| `not-listed`    | the word is not a listed word, so i: the lemma with `span` blanked (b_lý), never spelled out          |

`method` is the content line `grammar.method.<method>`, with no parameters: the case questions in
turn, the pattern from the gender and the 1st and 2nd case, and so on. A classification of the
case, the pattern, the tense, the mood or the verb form hints its method, since the case question
or the pattern would name the answer; a sound-alike relation hints `sound-alike`. An `obojetna-i`
gap after a listed letter hints `not-listed`; `span` is `[start, end)` in code points of the lemma,
the gap's letters.

### 5.4 Item IDs and mastery

Items are the unit of spaced retrieval and mastery: the knowledge practised, independent of how it
is shown. `ITEM_ID_PATTERN` is `<kind>:<content ID parts>` (at most 128 characters);
`parseItemId` takes one apart (or returns `null`) and the builders (`spellItem`, `gapItem`,
`classItem`, `relationItem`, `pairItem`, `alphabetItem`, `segmentItem`, `familyItem`) make them.

| Pattern                                 | Trains                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `spell:<word>:<at>`                     | a spelling point of a word (mlýn: `spell:mlyyn:2`); a sentence gap on that point trains the same item                     |
| `gap:<sentence>:<gap>`                  | a sentence gap that is no word's spelling point (agreement, an ending by the pattern, mě/mně)                             |
| `class:<dimension>:<target>[:<detail>]` | a classification (below)                                                                                                  |
| `rel:<relation>:<word>`                 | a relation of a word (its synonym, antonym, general word, …)                                                              |
| `pair:<pair kind>:<word>`               | a memory-match pair of a word (`family`, `synonym`, `antonym`, `general`, `sound-alike`, `plural`, `pattern`, `standard`) |
| `abc:<word>`                            | a word's place in alphabetical order or in the school rhyme                                                               |
| `seg:<word>`                            | a word's structure (stavba slova)                                                                                         |
| `fam:<word>`                            | a word's family                                                                                                           |

A classification's target and detail depend on what is classified (§6.2): a word on its own is
`class:pos:ryba`; a consonant letter `class:consonant:cx` (the letter's `lexiconId`); a form names
the word and its paradigm cell (`class:person:plavat:past1`, §8.6); a token of a sentence names the
sentence and the token index (`class:case:s.ryby-1:0`); a whole sentence names the sentence
(`class:sentence-kind:s.ryby-1`); a part of a word names the word and the segment index
(`class:segment:vyletext:1`). A sound-alike relation or pair that names a word form (§8.5) has the
target `<word>:<form ID>` (`rel:sound-alike:piit:pil`).

Presentation is not part of the item: the same spelling point is trained by a word with a gap, by
a sentence gap on it and by its mistake hunt; choice, letter pad or typing is a property of the
problem on screen.

An item's record (§9) keeps two notions apart, as in Dragon Valley. Its **Leitner box** (0-5)
schedules: due days, the mix's tiers, `known` (box 2 and up), the review guarantee and the input
mode read the box and nothing else. Its **mastery level** is what the Great Shell shows and what
friends grow by: the better of the box's level (`cloudy` up to box 1, `bronze` at box 2, `silver`
from box 3, `gold` at box `balance.mastery.goldBox` with `goldFast` fast answers among the last
`goldOfLast`) and the effort path's (`bronze` after `bronzeDays` days with a right answer, `silver`
after `silverDays`, the days at least `gapDays` apart; never gold), counted in the optional
`rightDays` and `lastCountedDay` fields.

## 6. Skills and generators (`skills.ts`)

A skill is `{ id, titleKey, strand, generator, params }`. The generator decides the problem family;
its parameters are checked by `SKILL_PARAM_SCHEMAS[generator]` and by cross-field rules.
`skillItems(skill, lexicon)` enumerates the skill's item universe (sorted, unique, bounded by the
lexicon); content validation rejects a skill whose universe is empty. Words are selected by a
**word filter** `{ words?, topics?, tags?, pos?, families?, letters?, grades?, aspects?, registers?,
core?, exclude? }` and sentences by a **sentence filter** `{ sentences?, topics?, grades? }`; every
present field narrows the selection (`aspects` keeps to verbs of those aspects: a 3rd-grade tense
skill takes imperfective verbs only).

**Colloquial words stay in register skills.** `registers` is the one field with a default: absent,
a filter selects standard words only (`DEFAULT_REGISTERS`). A **register skill** (`isRegisterSkill`:
`classify` or `sort` by the `register` dimension, `odd-one-out` on the `register` basis, `pairs` of
the `standard` kind) must name `colloquial` in `words.registers` (`['standard', 'colloquial']`, or
`['colloquial']` for standard pairs), and no other skill may. So a colloquial word (_dobrej, mlíko,
bejt_) is only ever asked its register or paired with its standard twin, never its gender, its
forms or its spelling.

### 6.1 Generators

| Generator        | Parameters                                                                                                                                        | Problems or boards                                           | Items                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| `spell.word`     | `words`, `rules`, `maxGaps` (1-3), `choices` (2-4)                                                                                                | a word with 1-3 letter gaps (`gaps`)                         | `spell:` points of the rules |
| `spell.sentence` | `sentences`, `rules`                                                                                                                              | a sentence with 1-3 gaps, one by one (`gaps`)                | `spell:` or `gap:`           |
| `spell.mistake`  | `sentences`, `rules`                                                                                                                              | a sentence with one mistake: find, then fix (`mistake`)      | `spell:` or `gap:`           |
| `classify`       | `dimension`, `context` (`word`, `form`, `sentence`), `words`, `sentences`, `values` (or null: all), `cells` (form groups, or null); `consonants?` | name a dimension (`classify`)                                | `class:`                     |
| `odd-one-out`    | `basis` (a word dimension, `family`, `listed`), `words`, `size` (3-6)                                                                             | which word does not belong (`odd`)                           | `class:` or `fam:`           |
| `relation`       | `relations`, `words`                                                                                                                              | pick the related word (`relation`)                           | `rel:`                       |
| `alphabet`       | `words`, `order` (`alphabet`, `rhyme`), `size` (3-10)                                                                                             | Perlový náhrdelník: order the pearls                         | `abc:`                       |
| `pairs`          | `pair` (a pair kind), `words`, `pairs` (3-8)                                                                                                      | Pexeso                                                       | `pair:`                      |
| `sort`           | `dimension`, `context` (`word`, `form`), `values` (2-4 nets), `words`, `fish` (4-12), `cells` (form groups, or null); `consonants?`               | Rybářské sítě                                                | `class:`                     |
| `segment`        | `words`, `roles`                                                                                                                                  | Ulita slov: cut and name the parts                           | `seg:`                       |
| `family`         | `words`, `families` (or null), `pick` (2-8), `distractors` (1-6)                                                                                  | Slovní rodinka: pick the family among sound-alike neighbours | `fam:`                       |

The bounds of each skill per level are in [curriculum.md](curriculum.md) (generator bounds). A
sentence gap with a `word` and a `point` trains that word's spelling item, so the word list and
the sentences of a skill feed the same boxes.

### 6.2 Contexts and dimensions

`DIMENSIONS` are what a classification, a net or an odd-one-out set asks: `pos`, `inflection`,
`meaning-class`, `gender` (m, f, n: the 3rd grade), `gender-class` (ma, mi, f, n: with animacy, the
4th grade), `number`, `case`, `pattern`, `person`, `tense`, `mood`, `verb-form`, `finiteness`,
`reflexive` (se, si, none), `consonant`, `register`, `segment`, `sentence-kind`, `clauses`,
`member`. Each has a closed list of values (`DIMENSION_VALUES`: the vocabulary of §4.3, in school
order; cases and persons as the strings `'1'` … `'7'`). `CONTEXT_DIMENSIONS` says what each context
can ask, and skill validation enforces it:

| Context    | Looks at                                                                        | Dimensions                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `word`     | a lexicon word's lemma; a consonant letter; a highlighted part of a word        | `pos`, `inflection`, `meaning-class`, `gender`, `gender-class`, `number`, `pattern`, `register`, `reflexive`, `consonant`, `segment` |
| `form`     | a form derived from the word's paradigm (§8.6: rybou, plaval jsem, budu plavat) | `number`, `case`, `person`, `tense`, `mood`, `verb-form`, `finiteness`                                                               |
| `sentence` | a token of an annotated sentence, or the sentence itself                        | `pos`, `gender`, `gender-class`, `number`, `case`, `person`, `tense`, `mood`, `member`, `sentence-kind`, `clauses`                   |

A form skill can keep to some **form groups** (`cells`, `FORM_GROUPS`: `sg`, `pl`, `inf`, `pres`,
`fut`, `past`, `imp`, `cond`): a 3rd-grade person question takes `pres`, `past` and `fut` only, so
it never shows an imperative or a conditional, which the 4th grade names. Odd-one-out sets differ
in a word dimension (`WORD_VALUE_DIMENSIONS`), their family or being a listed word; fishing nets
sort words by a word dimension or consonant letters by class (`SORT_DIMENSIONS.word`), or forms by
a form dimension (`SORT_DIMENSIONS.form`).

A **consonant skill** (`classify` or `sort` with `dimension: 'consonant'`; items
`class:consonant:<id>`) serves all 24 consonant letters, or only those its optional `consonants`
lists (`CONSONANT_IDS`, the letters' `lexiconId`s in school order: `h`, `ch`, `k`, …, `cx` for č,
…), so a friend's set can hold just its own letters (Krab Tvrďák's seven hard consonants: `h`,
`ch`, `k`, `r`, `d`, `t`, `n`). `values` still lists the classes offered as options or nets, and
every listed letter's class must be among them. A skill of one class's letters shares its activity
with the other classes' skills, so a round never has the same answer every time; a board of all
24 letters credits each letter's item to whichever friend's set holds it.

### 6.3 Activities and generators

| Activity                                          | Generators it serves (`ACTIVITY_GENERATORS`)                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `feeding` (Krmení)                                | `spell.word`, `classify`, `odd-one-out`, `relation`                                    |
| `ink-sentence` (Inkoustová věta)                  | `spell.sentence`                                                                       |
| `bug-hunt` (Lov chyb)                             | `spell.mistake`                                                                        |
| `analysis` (Určování)                             | `classify`, `odd-one-out`                                                              |
| `battle` (Souboj s příšerou)                      | `spell.word`, `spell.sentence`, `spell.mistake`, `classify`, `odd-one-out`, `relation` |
| `memory-match` (Pexeso, narrative `matching`)     | `pairs`                                                                                |
| `pearl-necklace` (Perlový náhrdelník, `ordering`) | `alphabet`                                                                             |
| `fishing-nets` (Rybářské sítě, `ps.sorting-nets`) | `sort`                                                                                 |
| `word-shell` (Ulita slov, `ps.word-builder`)      | `segment`                                                                              |
| `word-family` (Slovní rodinka, `ps.word-family`)  | `family`                                                                               |

`race`, `snack` and `placement` are hub activities: they draw from the skills of levels the child
has met (snack time: due items of a friend's mastery set; placement: `placement.steps`).

## 7. The content pack (`content.ts`)

One versioned JSON file, `content/pearl-sea.content.json` (`CONTENT_FILE`):
`{ "id": "pearl-sea", "revision": "1.0.0", "schemaVersion": 1, "data": ContentData }`, validated by
`contentRegistration` (`parseContentJson(text, contentRegistration, file)`). S3 owns it; the lexicon
is part of it (`data.lexicon`, §8), whatever sources S3 assembles it from.
`test/fixtures/contract/mini-pack.json` is a small valid pack of two regions that the contract
tests use; it is a shape example, not content.

### 7.1 Records

| Collection   | Record fields                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grades`     | `{ grade, start }[]`: the region each grade starts in (grade 3 `sunny-lagoon`, grade 4 `moon-caves`); `gradeStart(data, grade)`                                                                                                     |
| `objectives` | `id`, `strand`, `grade`, `titleKey` (a `grownups.objective.*` key: objectives are named in the grown-ups' area only), `rvp` (RVP ZV outcome codes `ČJL-3-2-0n` / `ČJL-5-2-0n`) (curriculum.md)                                      |
| `regions`    | `id`, `order` (map order), `titleKey`, `unlock: { after: levelId[] }`, `monster`, `map` (`shallows`/`deep`), `grade`                                                                                                                |
| `levels`     | `id`, `region`, `order`, `titleKey`, `kind: lesson/monster`, `unlock`, `activities`, `stars` (null = balance), `rewards: { coins: [1★, 2★, 3★], eggs, cosmetics }`, `monster`, `storyBeat`, `objectives` (exactly curriculum.md §3) |
| `activities` | `kind`, `skills`, `count` (problems or boards, 1-40), `input` (`auto`/`choice`/`letters`/`typed`), `options` (per kind, `ACTIVITY_OPTION_SCHEMAS`: Krmení's `draw`, `mix` or `weakest`)                                             |
| `skills`     | §6                                                                                                                                                                                                                                  |
| `friends`    | `id`, `nameKey`, `mnemonicKey` (the friend's memory hook), `region`, `skills` (the mastery set), `monster` (whose freeing lets it grow up, or null)                                                                                 |
| `monsters`   | `id`, `region`, `nameKey`, `mood` (`grumpy`/`sulky`/`laughing`), `meter` (right answers that wash the ink off), `reviewShare`, `jokes` (catalog keys); optional `arms` (default 1), `finale`, `gradeFinale`                         |
| `inkoustici` | `id`, `nameKey`                                                                                                                                                                                                                     |
| `cosmetics`  | `id`, `slot`, `assetId` (art ID), `nameKey`, `price`, `unlock` (level or null); `{id, slot, assetId}` is the narrative `CosmeticItem`                                                                                               |
| `stickers`   | `id`, `nameKey`, `page` (region), `criteria`, `icon` (art ID), `color` (`#rrggbb`), `frame` (art ID)                                                                                                                                |
| `quests`     | `id`, `titleKey`, `goal`, `target`, `coins`, `weight`, `unlock`                                                                                                                                                                     |
| `placement`  | `steps: { skill, problems, passAccuracy, levels, grades }[]`, `minProblems`, `maxProblems`, `stopAfterMisses`                                                                                                                       |
| `story`      | `beats: { id, trigger, skippable, graph }[]` (each graph a `NarrativeGraph`, validated by `validateNarrative`) and `rewards: { reward, grant }[]`                                                                                   |
| `balance`    | every tunable number (§7.3)                                                                                                                                                                                                         |
| `lexicon`    | §8                                                                                                                                                                                                                                  |

A monster with several **arms** shares its meter evenly between them and serves its battle's skills
one per arm, in order: Krakatice has ten, one per strand. `finale: true` (Krakatice) completes the
game; `gradeFinale: 3` (Ledana) completes the 3rd grade's sea (its certificate).

**Sticker criteria** (`kind`): `level-complete {level, stars}`, `monster-freed {monster}`,
`friend-stage {friend | null, stage}`, `friends-stage {stage, count | null}` (`null`: every friend),
`items-mastered {level, count}`, `skill-mastered {skill, level, share}`, `streak`,
`days-practiced`, `week-days`, `coins-earned`, `cosmetics-owned`, `friends-dressed`, `race-best`,
`quests-claimed`, `inkoustici-splashed`, `placement-done`, `finale`.

**Quest goals**: `correct-answers`, `fast-answers`, `feed-hungry`, `play-minigame`, `finish-level`,
`best-streak`, `splash-inkoustik`. **Beat triggers**: `first-session`, `after-beat {beat}`,
`level-start {level}`, `level-complete {level}`, `monster-freed {monster}`, `finale`, each with an
optional `grades` filter (the first-egg beat differs for a 4th grader). **Grants**:
`egg {friend}`, `coins {amount}`, `cosmetic {item}`. Beat **scenes** are scene or map art IDs
(`scene/<region>`, `scene/grotto`, `map/deep`: `BEAT_SCENE_PATTERN`), beat **assets** are art IDs,
and beat texts are catalog keys.

### 7.2 Validation (`validateContentData`)

Beyond the strict schemas (unknown fields are rejected), a pack is valid only if:

- every ID is unique in its collection and every reference resolves (`duplicate-id`,
  `missing-reference`; diagnostics name the record and the field);
- the lexicon passes its linguistic checks (§8.7, `invalid-lexicon`);
- every lexicon record a skill names exists, and every skill can produce at least one item
  (`empty-skill`);
- activity options belong to their kind; an activity serves only generators its kind can
  (`ACTIVITY_GENERATORS`); minigames take `input: 'auto'`; a monster level ends with its battle and
  only there is a battle; monster levels name their monster and lessons none; star coins never
  decrease with more stars;
- map order is unique per region and per level; the region monster has a monster level;
- grades (records `grade-<n>`): each grade is listed once and starts in a region of that grade;
  region grades never decrease along map order; regions, beat triggers, placement steps and
  objectives name only grades the pack serves; objective titles are `grownups.*` keys;
- a monster's meter shares evenly between its arms, and its battle has a skill per arm; at most one
  monster is the `finale`;
- the unlock graph is acyclic and every level is reachable from a grade's start region
  (`unreachable`);
- growth rules list baby, grown, crowned in order; Leitner intervals never decrease; goal, chest,
  mix, response, input and placement ranges are consistent;
- no cosmetic is made of the crowned stage's golden crown (`assetId` `cosmetic/shell-crown`): it is
  never sold or given as an item;
- beat graphs are valid narrative graphs with distinct IDs and scene-art scenes, and every story
  reward is claimed by a beat.

`scripts/validate-content.mjs` (part of `npm run verify`) adds the cross-file checks: catalogs and
their convention (§7.4), Czech typography and reading-font coverage; every catalog key the pack uses
resolves in Czech (`collectCatalogKeys`, grammar terms included); story lines keep to the child
profile (`CHILD_PROFILE`: at most 10 words a sentence); archived packs in `content/history/` stay
valid, are named by their revision and keep their keys; art IDs (the pack's and `SHELL_ART_IDS`) exist in `assets/art/catalog.json` (reported, or failing with `--strict-art`); and curriculum coverage
(`--strict-coverage`, on in verify): every objective of curriculum.md has a lesson and a monster
level, every objective the pack lists has both in the pack (`curriculumGaps`), and every level of
the pack teaches exactly the objectives curriculum.md §3 maps to it. The pack checks start when S3
ships the pack; the curriculum table is checked from the start.

### 7.3 Balance defaults

Starting values from design.md (Dragon Valley's where the engine is the same); S2 tunes them with
the learner simulation before v1.

| Key                          | Starting value                                                                                    | Meaning                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `leitner.intervals`          | `[0, 1, 2, 4, 8, 16]`                                                                             | days until due, by box 0-5                        |
| `response.choice`            | fast ≤ 2500 ms, ok ≤ 6000 ms                                                                      | buckets for choice input and picks                |
| `response.letters`           | fast ≤ 3500 ms, ok ≤ 8000 ms                                                                      | buckets for the letter pad                        |
| `response.typed`             | fast ≤ 5000 ms, ok ≤ 12 000 ms, +1000 ms per letter beyond the first                              | buckets for typing                                |
| `response.perSentenceWordMs` | 1000 ms per word of a sentence shown, added to both limits                                        | reading time                                      |
| `input`                      | letter pad from box 2, typing from box 4, 4 choices                                               | `auto` input and the number of options            |
| `mix`                        | success 82 %, known 70 %, learning 10-50 %, window 20, no repeat within 2                         | round composition                                 |
| `reask`                      | delay 3 turns, at most 2 per round                                                                | re-asking missed items                            |
| `coins`                      | 1 per right answer, +1 every 5 in a row, monster 15, placement 10, ambush 1                       | coin sources                                      |
| `stars`                      | 2★ at 80 %, 3★ at 95 % with 60 % fast                                                             | level stars                                       |
| `mastery`                    | gold = box 5 and 2 fast of the last 3; effort: bronze on 2 right days, silver on 4, 2+ days apart | pearls (§5.4)                                     |
| `growth`                     | baby 30 % seen; grown 80 % silver + its monster freed; crowned 100 % gold + its monster freed     | friend stages                                     |
| `daily`                      | goal 30 right answers (10-100), 3 quests, 60 days of history                                      | the daily goal                                    |
| `chest`                      | 2-6 coins (cosmetic weight 0, coins weight 1)                                                     | the treasure chest after the goal                 |
| `race`                       | after `sunny-lagoon.monster`, 60 seconds, at most 60 problems                                     | Závod s delfíny                                   |
| `hungry`                     | 1 due item                                                                                        | when a friend is hungry                           |
| `ambush`                     | after `sunny-lagoon.monster`, 10 % per problem from the 3rd, at most 1 per round                  | Inkoustíci (never in battles, races or placement) |
| `battle`                     | ink splashes every 4 answers                                                                      | harmless ink blots to wipe away                   |
| `grades`                     | optional `{ grade, choice?, letters?, typed?, choices? }[]`                                       | per-grade response buckets and options            |

`balance.grades` overrides, for a child of that grade, the response buckets and the number of
options (`gradeBalance(balance, grade)`); a grade without an entry uses the pack's values.

### 7.4 Catalogs

Strings live in flat `{ key: string }` maps with `{placeholder}` parameters (the format
`createMessages` from `@aegis/browser/ui` consumes), one file per locale and scope:

| File                               | Holds                                                                                               | Owner |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `content/catalogs/cs.ui.json`      | the shell's strings, Czech                                                                          | S4    |
| `content/catalogs/cs.content.json` | every string the pack refers to: titles, names, mnemonics, jokes, story lines, grammar terms; Czech | S3    |
| `content/catalogs/en.ui.json`      | the grown-ups' area of the shell in English (`grownups.*` keys only)                                | S4    |
| `content/catalogs/en.content.json` | the pack's grown-ups' strings in English: the objective titles (`grownups.objective.*`)             | S3    |

Children see only Czech. A key lives in one Czech scope only. The grown-ups' area has an English
switch, so English is complete for it: every Czech `grownups.*` key has an English twin in the same
scope, English has no other keys and every English key exists in Czech (the gate checks all three).
Objectives are named only in the grown-ups' area, so their titles are `grownups.objective.*` keys;
regions, levels, skills and words keep their Czech names there too. Every catalog follows one
**variant convention** (agreed with S4 and approved by the coordinator; `catalogProblems` enforces
it and the content gate runs it on every catalog):

- The **bare key** is the required neutral phrasing: `praise.done` "Hotovo, výborně!".
- **Address**: optional `<key>.boy` and `<key>.girl` come as a pair, beside the bare key, with the
  same `{placeholders}` as it: `praise.done.boy` "Dokázal jsi to!", `praise.done.girl` "Dokázala
  jsi to!".
- **Czech plurals**: `<key>.one` (1), `<key>.few` (2-4) and `<key>.other` (0 and 5 or more) come
  as a set of three; a plural key needs no bare key. `czechPlural(n)` picks the category.
- Both combine as `<key>.<plural>.<address>`, with the neutral `<key>.<plural>` required.
- **English** (grown-ups only) uses `<key>.one` and `<key>.other` (`englishPlural`).
- The shell picks the variant: the form of address from the family record (§14), falling back to
  the bare (neutral) key; the plural category from the count. Rules never pick strings.
- `one`, `few`, `other`, `boy` and `girl` are reserved as last key segments.
- A referenced key resolves as a bare key or a plural set (`catalogHasKey`).

**Inserted names** bind every catalog too (from S3's Czech copy review; design §10.3). A
`{placeholder}` that inserts a name (a child's, a friend's, a monster's, a cosmetic's) stands only
at the start of a sentence or after a colon or dash. Nothing in the sentence agrees with it: no
verb, adjective or pronoun depends on its gender or number. The child is never addressed by name:
Czech needs the vocative (_Petře_, _Jano_), which code cannot derive. Inside a sentence a species
label is lowercase (_krab Tvrďák_), the capitals rule the game teaches. Copy review checks this; the
gate does not.

**Grammar terms** come from `cs.content.json` under `grammar.*` keys (`grammarKeys(skill)` lists
those a skill can show, and the gate requires them): a category value `v` of dimension `d` is
`grammar.<d>.<v>` (`grammar.case.7`, `grammar.pos.noun`, `grammar.pattern.hrad`,
`grammar.gender-class.mi`); a case also has its question, `grammar.case-question.<n>`; a spelling rule's
hint is `grammar.rule.<rule>`, and the listed-word rule shows each letter's school rhyme,
`grammar.listed.<letter>`; relations are `grammar.relation.<relation>` and word parts
`grammar.segment.<role>`; a method hint is `grammar.method.<method>`, needed by the
classifications of a dimension with a method and by sound-alike relations (`grammarKeys`).

Czech text follows Czech typography („…“, ‚…‘, …, –, no space before punctuation) and uses only
characters of the reading font (Pearl Reading, the Andika subset); the gate checks both.

### 7.5 Art and audio references

Content and views name art by art ID (`ART` in `media.ts`):

| Art                                   | ID                                                                 | Kind    |
| ------------------------------------- | ------------------------------------------------------------------ | ------- |
| a sea friend, baby or grown up        | `friend/<friend>/baby`, `friend/<friend>/grown`                    | painted |
| a friend's egg                        | `egg/<friend>`                                                     | SVG     |
| a monster, soaked in ink or freed     | `monster/<monster>/inked`, `monster/<monster>/freed`               | painted |
| an Inkoustík                          | `inkoustik/<inkoustik>`                                            | painted |
| a region scene, the grotto, the title | `scene/<region>`, `scene/grotto`, `scene/title`                    | painted |
| the two sea maps                      | `map/shallows`, `map/deep`                                         | painted |
| a character                           | `character/osmicka`, `character/mroz-vousac`, `character/bublinka` | painted |
| Osmička cheering (praise, results)    | `character/osmicka/happy`                                          | painted |
| a diver avatar                        | `avatar/diver-1` … `avatar/diver-8`                                | painted |
| a cosmetic                            | `cosmetic/<item>` (the pack's `assetId`)                           | SVG     |
| the crowned stage's golden crown      | `cosmetic/shell-crown` (`CROWN_ART_ID`)                            | SVG     |
| a sticker icon or frame               | `sticker/<name>` (the pack's `icon` and `frame`)                   | SVG     |

S5 publishes `assets/art/catalog.json` (`ART_CATALOG_PATH`) in the format
`pearl-sea-art-catalog/1`: `{ format, entries: { id, kind: 'painted' | 'svg', file, width, height,
anchors? }[] }` (`artCatalogSchema`; `file` is relative to `assets/art/`; for an SVG, `width` and
`height` are its viewBox size). The eggs, cosmetics, the crown and sticker art are static SVG files
that S5 makes and lists in the catalog beside the paintings; the shell (S4) renders them. Painted
friends publish **anchors** so SVG cosmetics sit on painted creatures: for each of `head`, `eyes`
and `neck`, a point `{ x, y }` in thousandths of the image box from its top left, the cosmetic's
`scale` in percent (10-400) and its `rotate` in degrees (-180-180), integers only. A cosmetic of
slot `head` goes on the `head` anchor of the friend's current painting; a crowned friend is its
grown painting with the golden shell crown `cosmetic/shell-crown` on `head`, placed by the cosmetic
anchor scale like any cosmetic. That crown is never a cosmetic item: the pack's cosmetics may not
use its art (`invalid-content`).

**The cosmetic anchor scale.** A cosmetic SVG has a `0 0 100 100` viewBox (`COSMETIC_VIEWBOX`; the
catalog accepts a `cosmetic/*` entry only as an SVG of that size) with its attachment point at the
centre: a hat's brim centre, the goggles' bridge, a scarf's knot, the centre of the crown's base. The
anchor puts that centre on its point. At `scale` 100 the cosmetic is drawn 250/1000 of the painting's width wide
(`COSMETIC_BASE_WIDTH`), and as tall; at another scale, `scale` percent of that; turned `rotate`
degrees about its centre. `cosmeticPlacement(anchor, width, height)` gives the box on a painting of
that size. Grotto decorations (slot `grotto`) share the viewBox and sit on the grotto's spots
instead of anchors.

`collectArtIds(data)` lists every art ID the pack implies (friends, eggs, monsters in both forms,
Inkoustíci, region scenes, maps, cosmetics, stickers, beat scenes and assets); `checkArtCatalog(data,
ids)` reports the missing ones. The shell shows `SHELL_ART_IDS` directly: the characters
(`CHARACTER_ART_IDS`), the avatars, the title, the grotto and the crown (`CROWN_ART_ID`). The
content gate checks both lists against the published catalog: a warning, or an error with
`--strict-art`.

**Audio** is not in content. S5 owns the audio pack: its generator (`scripts/audio/manifest.mjs`,
[audio.md](audio.md)) writes `assets/audio/manifest.json` (`AUDIO_MANIFEST_PATH`) in Dragon
Valley's format renamed `pearl-sea-audio-manifest/1` (`AUDIO_MANIFEST_SCHEMA`). Sound IDs are
`music/<loop>` and `sfx/<name>` (`AUDIO_ID_PATTERN`). The music loops (ACE-Step
1.5, `MUSIC_IDS`) are `music/grotto`, `music/map`, `music/practice`, `music/battle` and
`music/finale`; the finale's is optional (`OPTIONAL_MUSIC_IDS`). Results play `music/grotto`, and
so does a mood whose loop the pack lacks (`MUSIC_FALLBACK`, `musicLoop`). There is no victory loop:
a freed monster (`monster.freed`) gets the 9-second one-shot `sfx/victory-sting` (`VICTORY_STING`).
The shell (S4) maps events (§13) to sounds. Every art and audio asset is made with local models
only ([assets.md](assets.md)).

### 7.6 Revisions, history and save migration

As in Dragon Valley:

- A save pins the exact pack it was played with: pack ID, revision and content hash (the runtime
  refuses to restore a save against any other pack).
- **Every content change merged to `main` bumps `revision`** (MAJOR.MINOR.PATCH: patch for balance
  or text, minor for new levels or regions) with `npm run content:bump -- <revision>`: `main`
  deploys, so its pack is what saves pin.
- **Every deployed revision is archived** as `content/history/<revision>.json.gz`
  (`contentHistoryPath`) and shipped with the site. The archive is the deployed pack byte for
  byte, gzip-compressed: one gzip member with no file name, comment or extra field, modification
  time 0 and OS byte 255, about a tenth of the pack's size. `npm run content:bump` writes it once
  (`scripts/lib/history.mjs`); since compressed bytes depend on the zlib build, archives are never
  regenerated, and every check compares the decompressed bytes. The site serves an archive as
  `application/gzip` without a Content-Encoding (as GitHub Pages does), and the shell decompresses
  it with `DecompressionStream('gzip')`. A revision string is never reused for different content:
  the gate refuses a current revision archived with other content and anything in
  `content/history/` that is not such an archive, and S3 pins each revision's content hash in a
  test as Dragon Valley does. Every catalog key an archived pack uses stays in the catalogs.
- **The schema only grows compatibly.** Every archived pack must stay valid under the current
  `contentRegistration`, so `CONTENT_SCHEMA_VERSION` stays 1 and changes are limited to new union
  variants and new optional fields (`objectWithOptional`). Anything else needs a coordinator
  decision and a history plan.
- **Content IDs are append-only.** New content adds regions, levels, skills, words, sentences,
  friends, cosmetics and stickers; it never renames or deletes them. A corrected word keeps its ID
  (an ID is the transliterated lemma, so a misspelled lemma is retired with a migration, not
  renamed).
- **Upgrade path**, as the shell does it: create the host with the save's pack (the archived one
  for an old save), stage the current pack, restore the save, then at the hub (no round, no pending
  beat, no pending jobs) activate the current pack. With append-only IDs no transformation is
  needed; a revision that retires an ID migrates the state there.
- **State compatibility.** New state fields are optional with a default that old saves get by
  omission. A change an old snapshot cannot continue under bumps `STATE_VERSION` (now 1) and adds a
  step to `STATE_MIGRATIONS`; `migrateProfileState` and `migrateSnapshot` (which rewrites the
  runtime snapshot's state resource, `RUNTIME_STATE_RESOURCE`) run the steps in order, and the shell
  registers one save migration per step.

## 8. The lexicon (`lexicon.ts`)

The curated, annotated Czech words every problem is made from (S3 owns the data; `data.lexicon`):
`{ sources, words, families, sentences, relations }`. All text is NFC.

### 8.1 Words

| Field                    | Meaning                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | the transliterated lemma, plus `.<sense>` for a homograph (§8.2)                                                                                                                                                                  |
| `lemma`                  | the basic form, NFC; proper names capitalised; a reflexive verb with its pronoun (`bát se`)                                                                                                                                       |
| `pos`                    | one of the ten parts of speech                                                                                                                                                                                                    |
| `grade`                  | `3` or `4`                                                                                                                                                                                                                        |
| `topics`, `tags`         | content-ID-like labels (`vyjmenovana-b`, `sea`) that skills filter by                                                                                                                                                             |
| `src`                    | source IDs (`lexicon.sources`: the IJP, PČP 1993, SSJČ, MorfFlex, …)                                                                                                                                                              |
| `noun?`                  | `{ gender, animate? (masculine only), numbers, pattern (or null when irregular: dítě, člověk, oko), paradigm?: { sg?, pl? }, proper? }`; each number has 7 cells, case 1 first; only a colloquial word may leave out the paradigm |
| `verb?`                  | `{ aspect, reflexive (se, si or null), paradigm?: { inf, pres[6], imp[3], past{m f n ma mi fpl npl}, fut?[6] } }`; only a colloquial word may leave out the paradigm                                                              |
| `register?`, `standard?` | `standard` or `colloquial`; a colloquial word names its standard twin, appears only in register skills (§6) and may have no paradigm (_mlejn, bejt_: its forms cannot be verified to the lexicon's standard)                      |
| `family?`                | `{ id, role: 'head' \| 'related' }`                                                                                                                                                                                               |
| `segments?`              | `[role, text][]` in order prefix, root, suffix, ending; they rebuild the lower-case lemma; a suffix or ending may be `""` (a zero ending)                                                                                         |
| `spelling?`              | spelling points `{ at, correct, alt[], rule, test? }`: the letters at `at` (code points of the NFC lemma) are `correct`, not one of `alt`, because of `rule`; `test` proves it (hrad → hrady)                                     |
| `senses?`                | short Czech glosses of a word with several meanings                                                                                                                                                                               |

A **cell** is a form or an array of variants, the preferred first (`["mlýně", "mlýnu"]`). Verb
cells never contain the reflexive pronoun: `formCells` adds it. A perfective verb's present forms
are its future.

### 8.2 Word IDs

`lexiconId(lemma)` is deterministic ASCII: lower case; long vowels doubled (á → `aa`, í → `ii`,
ý → `yy`, …); ů → `uo`; háček letters take an `x` (č → `cx`, ř → `rx`, š → `sx`, ž → `zx`,
ě → `ex`, ď → `dx`, ť → `tx`, ň → `nx`); a space or hyphen → `-`. So být → `byyt`, byt → `byt`,
bít → `biit`, mlýn → `mlyyn`, dům → `duom`, bát se → `baat-se`: the minimal pairs the game teaches
stay distinct. A homograph adds `.<sense>` (`zaamek.1`, `zaamek.2`).

### 8.3 Families

`{ id, letter, head, order, core, root, kin, soundAlike?, src }`. A listed-word family has its
`letter` (b l m p s v z) and its `order` in the school rhyme; an ordinary family has `null` for
both. `core` marks the school list (against the extended list of the rules of Czech spelling),
`root` is the shared root as written, `kin` lists families that share the root (být, bydlet, byt,
obyvatel, příbytek, nábytek, dobytek), which are never each other's distractors, and `soundAlike`
names the sound-alike family taught beside it (bít ↔ být). The head word has `role: 'head'`.

### 8.4 Sentences

`{ id, grade, topics, text, gaps[], tokens?, kind?, subjects?, predicates?, clauses?,
conjunctions? }`. Sentences are original, at most 10 words (`MAX_SENTENCE_WORDS`), sea-themed where
natural. `text` holds inline gaps `{correct|alt|alt2}`: `Ml{ý|í}n stojí u moře.`; a gap may cover a
whole token (`{odplavala|od plavala}`, a capital letter). `parseGappedText` parses them and refuses
empty, duplicate, nested or unbalanced options. Each gap is annotated in text order:
`{ rule, word (ID or null), point?, case?, number?, subjects? }`; `point` is the `at` of the word's
spelling point the gap tests (then the gap trains that item), and `subjects` are the token indices
of the subject an agreement gap agrees with. `tokens` is an optional per-word analysis
`{ t, word?, pos?, case?, number?, gender?, person?, tense?, mood?, member? }` whose `t` values are
the text's words in order (`textWords` of the filled text). `kind` is the sentence kind; `subjects`,
`predicates` and `conjunctions` are token indices; `clauses` is 1 for a simple sentence. Every gap
sentence also serves Lov chyb: the mistake shows one gap's alternative.

### 8.5 Relations and sources

`relations: { synonyms, antonyms, hierarchies, soundAlikes }`: synonym and antonym pairs of word
IDs, sound-alike pairs, all symmetric and each pair once, and `{ general, specific[] }` sets (the
specific words are coordinate). One side of a **sound-alike pair** (`SoundRef`) is a word by its
ID, or one of its forms written out, `{ word, form }`, because some verified pairs are forms, not
lemmas: `["pyl", { "word": "piit", "form": "pil" }]`, `["my", { "word": "jaa", "form": "mi" }]`,
`[{ "word": "vysiit", "form": "vysel" }, { "word": "viset", "form": "visel" }]`. A form of a noun or
verb must be one of its paradigm's forms; a pronoun's form is checked by S3's checker. Only
verified pairs are used (curriculum.md): být × bít, bydlo × bidlo, dobýt × dobít, mýt × mít, my × mi,
pyl × pil, sýrový × syrový × sírový, výr × vír, výskat × vískat, vysel × visel, výt × vít.
`sources: { id, title, url? }[]` names the reference works the data was checked against.

### 8.6 Forms (`formCells`)

`formCells(word)` derives the forms of a noun or a verb from its paradigm, for `form`
classifications and form nets (`[]` for a colloquial word without a paradigm):

| Cells                        | Form                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `sg1` … `sg7`, `pl1` … `pl7` | a noun's case forms                                                                    |
| `inf`                        | the infinitive (`plavat`, `bát se`)                                                    |
| `pres1` … `pres6`            | present 1sg … 3pl (a perfective verb's future)                                         |
| `fut1` … `fut6`              | an imperfective verb's future: `budu plavat`, or `paradigm.fut` (`půjdu`, `budu`)      |
| `past1` … `past6`            | past: `plaval jsem`, `plaval jsi`, `plaval`, `plavali jsme`, `plavali jste`, `plavali` |
| `imp2`, `imp4`, `imp5`       | imperative 2sg, 1pl, 2pl                                                               |
| `cond1` … `cond6`            | conditional: `plaval bych`, …, `plavali by`                                            |

Composed forms use the masculine participle (a generator may show the feminine or neuter one
without changing the cell); the reflexive pronoun follows the auxiliary (`myl jsem se`,
`budu se mýt`, `myl by se`). Each cell carries only the values the form shows unambiguously: a form
shared by several cells (ryby: sg2, pl1, pl4, pl5; vyletí: 3sg and 3pl) keeps only the values those
cells agree on, so no problem asks what a form cannot tell. Past forms with an auxiliary and every
conditional are compound (`verb-form`), the others simple. Cells come in **groups** (`FORM_GROUPS`,
`formGroup(cell)`: `sg`, `pl`, `inf`, `pres`, `fut`, `past`, `imp`, `cond`) that skills choose
(§6.2). An imperfective verb whose future is not budu + infinitive must list `fut`
(`IRREGULAR_FUTURE_INFINITIVES`: být, jít, jet, letět, běžet, nést, vést, vézt, lézt, téct, růst,
kvést, hnát, plout).

### 8.7 Validation (`validateLexicon`)

The schema checks structure; `validateLexicon` (run inside `validateContentData`) checks the
linguistic consistency:

- IDs are unique and each is the lemma's `lexiconId` (or it with `.<sense>`); lemmas are NFC;
  sources exist;
- noun data only on nouns and verb data only on verbs; masculine nouns, and only they, state
  `animate`; a pattern fits the gender (hrad is masculine inanimate); a standard noun or verb has
  its paradigm (only a colloquial word may leave it out); a noun's paradigm has exactly the numbers
  `numbers` says and starts with the lemma; a proper name is capitalised;
- the infinitive with its reflexive pronoun is the lemma; only imperfective verbs list `fut`, and
  the verbs of `IRREGULAR_FUTURE_INFINITIVES` must; a colloquial word names an existing standard
  twin;
- segments rebuild the lemma in order prefix, root, suffix, ending, with exactly one root;
- every spelling point names the letters at its position, and no alternative equals the right
  form;
- a family's head is in the family with `role: 'head'`; every word of a listed family has a `vyjm`
  y or ý right after the family's letter (or a `vyjm-prefix` vy-/vý-); a listed family has a rhyme
  order and an ordinary one none; `kin` and `soundAlike` name other existing families;
- two words that differ only in i/y (or í/ý) are declared sound-alikes, so a misspelled duplicate
  cannot slip in. Capitals do not count: a proper name and its common noun (_Bublinka_,
  _bublinka_) are homographs, not an i/y pair, and a pair declared for one spelling covers its
  capitalised homographs;
- sentences parse, have as many annotations as gaps, at most 10 words, tokens that match the text,
  gap words that exist and have the named spelling point, and token indices in range;
- relation pairs are not self-pairs or duplicates and name existing words, and a sound-alike form
  is a form of its word.

S3's own checker (`scripts/lexicon/check.mjs`, dependency-free) checks the sources against these
rules as well and joins `npm run verify` in S3's pull request.

### 8.8 S3's field set in the contract

The lexicon schema carries every field of S3's field set; the differences are names and nesting:

| S3's field set                                                             | In the contract                                                                                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| noun `gender`, `animate`, `numbers`, `pattern`, `paradigm`, `proper`       | nested in `noun: { … }`; a colloquial noun may leave out `paradigm`                                                                            |
| verb `aspect`, `reflexive`, `paradigm`                                     | nested in `verb: { … }`; cells without the reflexive pronoun; optional `fut` for irregular futures; a colloquial verb may leave out `paradigm` |
| `family` (ID) and its role                                                 | `family: { id, role }`                                                                                                                         |
| per-word `soundAlikes[]`, synonym and antonym pairs, general/specific sets | `relations.soundAlikes` (a side may be a word form, `{ word, form }`), `relations.synonyms`, `relations.antonyms`, `relations.hierarchies`     |
| source IDs                                                                 | `src` naming `lexicon.sources` records `{ id, title, url? }`                                                                                   |
| family `kin`, a family's sound-alike family                                | `kin`; `soundAlike` (one family ID)                                                                                                            |
| sentence gap `{ rule, word, case?, number?, subjects? }`                   | the same plus `point` (the spelling point the gap tests)                                                                                       |
| per-token analysis `{ t, word, pos, case?, number?, person?, tense? }`     | `tokens`, plus `gender`, `mood` and `member`                                                                                                   |
| sentence syntax                                                            | `subjects`, `predicates`, `clauses`, `conjunctions`, plus `kind` (statement, question, command, wish)                                          |

The closed vocabularies are S3's exactly: the 42-letter alphabet, the consonant classes, the
paired consonants, the 7 cases, the 14 patterns, person, number, tense and mood. The spelling rules
are S3's 22 plus `interpunkce` and `spojka` for sentence gaps (the end mark, a comma, a
conjunction) and `spisovne` for the standard word against its colloquial twin, and a token's
`gender` is the class with animacy (`ma`, `mi`, `f`, `n`), from which the 3rd grade's `gender`
dimension (m, f, n) is derived.

## 9. Per-profile state (`state.ts`)

`ProfileState` is everything authoritative about one child's game. It lives in the runtime snapshot
and is saved after every commit. The structure is Dragon Valley's, with sea names.

| Field                                             | Meaning                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `day`, `firstDay`                                 | current and first session day (day numbers: days since 1970-01-01, local; `dayNumber`, `isoDay`)                            |
| `sessions`, `daysPracticed`                       | counters                                                                                                                    |
| `onboarding`                                      | `firstFriend` (the chosen first egg, or null), `placement: pending/done/skipped`                                            |
| `items`                                           | per item: `box` 0-5, `due` day, `seen`, `correct`, `recent` (last 3 buckets), `lastDay`, effort counts (§5.4)               |
| `levels`                                          | per level: best `stars`, `bestAccuracy`, `plays`, `placed`, `paidStars`                                                     |
| `monsters`                                        | freed monsters and the day (`freedDay`)                                                                                     |
| `friends`                                         | owned friends: `stage`, `obtainedDay`, `stageDay`, `outfit` (`head`, `eyes`, `neck`: an item or null)                       |
| `coins`, `coinsEarned`                            | wallet and lifetime earnings                                                                                                |
| `cosmetics`                                       | `@aegis/narrative` `CosmeticState` (owned items and idempotent grant claims; `equipped` stays empty)                        |
| `grotto`                                          | the decoration on each of the 6 spots, or null                                                                              |
| `stickers`                                        | earned stickers and the day                                                                                                 |
| `daily`                                           | today's answers, right and fast answers, levels and minigames finished, the goal, quests, the chest (`locked/ready/opened`) |
| `history`                                         | the last 60 days' records                                                                                                   |
| `race`, `questsClaimed`, `bestStreak`, `splashed` | records for stickers and the grown-ups' area (`splashed`: Inkoustíci splashed away)                                         |
| `story`                                           | the beat in progress (`NarrativeState`), `pending`, `queue`, `done`                                                         |
| `run`                                             | the level being played: `level`, `next` activity, `results`                                                                 |
| `round`                                           | the active or finished round (a problem round or a minigame round)                                                          |
| `roundCounter`                                    | for round IDs `r1`, `r2`, …                                                                                                 |
| `settings`                                        | rule settings: `dailyGoal`, `race`, `unlockAhead`, `grade` (3 or 4)                                                         |
| `finale`                                          | the day the finale was completed                                                                                            |

A **problem round** keeps its activity, source, skills, input, target (or `null` for a battle that
ends by its meter and a race that ends by time), the counters, the re-ask queue, the recent items,
the ambushes so far, the current problem (item, problem, resolved input, step, re-ask, hint, teach
and the ambushing Inkoustík), the last feedback (with the expected answer and whether the answer
splashed the Inkoustík away), its coins, the battle progress (`washed`, `target`, `arms`,
`splashes`) and the placement progress. A **minigame round** keeps the generated
`MinigameDefinition` and its `MinigameState` (persisted, never regenerated) and its board count.

**Invariants**, as in Dragon Valley:

- Bounded: items are at most the content's item universe, history keeps 60 days, the rolling lists
  are short; nothing grows per answer.
- Friends never shrink; coins are never negative; a day number never decreases.
- Every record refers to existing content (checked by the adapter on every commit and restore),
  outfits and grotto spots hold owned items of the right slot, story states restore against their
  beat graphs, and an item's effort counts are consistent.
- The grade is set from the profile editor and handed to the game at the first session
  (`initialProfileState({ dailyGoal, race, grade })`, or `setSetting` before the first
  `startSession`), as in Dragon Valley.
- **Not state**: presentation preferences (volumes, text size, reduced motion, read-aloud), the form
  of address and the grown-ups' language. They live in the shell's records (§14), so changing them
  never touches a game hash.

## 10. Actions (`actions.ts`)

Every action is validated by `gameActionSchema` and then by the rules' legality check. A rejected
action changes nothing, costs nothing and draws no randomness. Only answers cost a logical turn
(`ACTION_TURNS`); re-ask jobs count turns.

| Action                                                 | Turns | Legal when                                                                                               | Effect                                                                                          |
| ------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `startSession { day }`                                 | 0     | always (the first action of a profile)                                                                   | a new day: daily record, history; the first session: the prologue                               |
| `chooseFirstFriend { friend }`                         | 0     | no friend chosen yet; one of `FIRST_FRIEND_CHOICES`                                                      | the first egg                                                                                   |
| `startLevel { level, activity? }`                      | 0     | the level open, no active round, no blocking beat; with `activity`, a completed level's activity         | start a run (and its level-start beat), or replay one activity                                  |
| `startActivity { activity }`                           | 0     | `level` (index ≤ next), `race` (open and on), `snack` (a hungry friend, or due items), `placement`       | start a round                                                                                   |
| `answer { value, elapsedMs }`                          | 1     | a problem is on screen (not in the placement check)                                                      | grade the step; the Leitner move, coins, the ink washed, a re-ask job; the next step or problem |
| `placementAnswer { value, elapsedMs }`                 | 1     | a placement problem is on screen                                                                         | grade, climb the ladder; at the end place levels                                                |
| `minigameMove { revision, move }`                      | 0     | a board is active, `revision` is its revision, the move is legal (§12.1)                                 | reduce the board; credit items and coins; the next board or the end of the round                |
| `hint`                                                 | 0     | a problem is on screen, not yet hinted                                                                   | mark hinted (the shell shows the strategy)                                                      |
| `endRound { reason }`                                  | 0     | a round exists                                                                                           | `done`, `quit` (progress kept), `time-up` (the race), `time-limit`                              |
| `buy { item }`                                         | 0     | available at U Mrože, not owned, affordable                                                              | pay, grant                                                                                      |
| `equip { friend, slot, item \| null }`                 | 0     | friend owned; item owned and of that slot                                                                | dress the friend                                                                                |
| `decorate { spot, item \| null }`                      | 0     | spot 0-5; item owned and of slot `grotto`                                                                | place or clear a grotto decoration                                                              |
| `claimQuest { quest }`                                 | 0     | quest done and unclaimed                                                                                 | pay the quest's coins                                                                           |
| `openChest`                                            | 0     | the chest is ready (the daily goal reached)                                                              | a weighted grant from `rewards`                                                                 |
| `storyChoice { beat, node, revision, choice \| null }` | 0     | the pending beat, its node and revision                                                                  | advance (or skip a skippable beat); grant rewards                                               |
| `setSetting { setting }`                               | 0     | values in range, also before the first session; `grade` one the content serves, not in a placement round | `dailyGoal`, `race`, `unlockAhead`, `grade` (3 or 4; progress, friends and coins stay)          |

Rejections are runtime errors with stable codes, as in Dragon Valley (`no-session`, `invalid-day`,
`story-pending`, `round-active`, `unknown-level`, `locked-level`, `no-problem`, `wrong-action`,
`already-hinted`, `no-round`, `stale-move`, `invalid-move`, `insufficient-coins`, `not-owned`,
`wrong-slot`, `invalid-setting`, …) plus the sea's (`friend-chosen`, `not-a-first-friend`,
`chest-not-ready`, `race-locked`, `unknown-friend`). The shell localizes by code
(`error.<code>`) and never shows diagnostic text to a child. The shell dispatches with
`{ expectedRevision }` captured when the control was rendered, so a stale button cannot act on a
newer view; `elapsedMs` excludes paused time and is capped at 600 000 ms.

## 11. Runtime integration (`adapter.ts`, S2)

| Registration         | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | `pearl-sea` (`ADAPTER_ID`)                                                                      |
| `stateVersion`       | `STATE_VERSION` (1)                                                                             |
| `state` / `action`   | `profileStateSchema` / `gameActionSchema`                                                       |
| `content`            | `contentRegistration` (schema version 1)                                                        |
| `randomStreams`      | `problems`, `distractors`, `rewards`, `words`, `ambush`                                         |
| `eventPhases`        | `reask`                                                                                         |
| `commands`           | one rule per action type                                                                        |
| `jobs`               | `reask` with payload `{ round, item }`                                                          |
| runtime phases       | `round` (entered when a round starts), `hub` (entered when it ends, cancelling pending re-asks) |
| claims               | idempotent one-time effects (`story:<beat>:<reward>`); cosmetic grants use their own claim IDs  |
| `canActivateContent` | no round and no pending beat (the hub)                                                          |

As in Dragon Valley, a miss on turn _t_ schedules its re-ask for turn _t_ + 3, the runtime keeps a
ledger of consumed job tickets and claims capped at 10 000 entries per list, so re-asks are capped
per round and claims are used only for once-ever effects (never per day or per answer).

## 12. Views (`views.ts`)

`GameView` is recomputed on every commit; screens render only from it (plus the commit's events for
one-shots). Text is never rendered here: `*Key` fields are catalog keys, problems are structured
and words carry their Czech text from the lexicon.

- `screen`: `story` (a beat is pending), `round` (a round is active), `results` (a round finished),
  `hub` (otherwise). The shell may navigate elsewhere (U Mrože, the album, the grown-ups' area)
  without an action.
- `onboarding`: the first friend, the three eggs offered while none was chosen, and the placement
  status.
- `story`: the pending beat's node, scene art ID, text key, choices, `skippable`, `finished`.
- `hub`: regions (map, grade, unlocked, the monster with its mood, `freed` and `arms`, and level
  cards `locked/open/completed` with stars, `placed` and `glowing`); `next`, the daily adventure's
  next step (`story`, `first-friend`, `placement`, `snack`, `level`, `minigame { level, activity }`,
  `chest`, `free-play`, in the priority order of design.md); `hungry` friends; the race's
  availability and best; grade `certificates` (the 3rd grade's sea done).
- `run`: the level's activities, done flags and the result once finished.
- `round`: for problem rounds the progress, the current `problem` (item, structured problem,
  resolved input, `step` of `steps`, re-ask, hinted, `teach` and the `ambush` Inkoustík), the last
  `feedback`, coins, the friend being fed with its expression, the `battle` (`washed` of `target`,
  `arms`, `armsWashed` = ⌊washed × arms / target⌋, the current joke, `splashes`) and the placement
  ladder; for minigame rounds the board count, the raw `projectMinigame` view (`minigame`, whose
  `revision` every move carries) and the typed board `current` (§12.1). The battle's `jokeKey` is
  the joke on screen (the one `monster.joked` just told: at the start until the first answer, after
  a 5th right answer until the next one, and once freed), else `null`.
- `friends`: owned friends with stage, expression, mastery shares (percent, rounded down),
  hunger, due items, outfit and the next stage's exact counts (`have` of `need`).
- `shell`: the **Great Shell** (Velká lastura): pearls by strand and skill (`counts` per mastery
  level, `dull` pearls that need polishing: known items due again) and the latest polished pearls.
- `gallery` (freed monsters), `grotto` (the six spots), `market` (U Mrože), `album`, `daily` (goal,
  quests, chest, the week's practised days, `sleepy` after the goal, the words learned today) and
  `grownUps` (per objective and skill accuracy and mastery, the hardest items with their word, the
  60-day trend).

Expressions are hints for the art, derived from state (as in Dragon Valley): `curious` after a
miss, `eating` after a right answer, `proud` on a streak milestone, `sleepy` after the daily goal,
`happy` otherwise; eggs `idle`. Hunger, the daily adventure's order, protected success, snack
time, first tastes and the review guarantee work as in Dragon Valley with friends for dragons and
items for facts (design.md).

### 12.1 Minigame boards (`minigames.ts`)

Every minigame round carries its board twice: the narrative projection (`round.minigame.view`) and
the same board typed (`round.current`). Moves go in `minigameMove.move` with
`revision = round.minigame.revision`. Boards never punish: a wrong pair, net, cut or pick stays as
gentle feedback and can be corrected; faces of hidden cards are never in the view. After a necklace
check that was not right yet, `inPlace` marks the pearls already in their place, until the next move.

| Board                              | View (besides `kind`)                                                                                      | Moves                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `memory-match` (`matching`)        | `pair`, `cards[{ id, face, faceUp, matched }]`, `clearAvailable`, `pairs`, `matched`, `attempts`           | `{ type: 'select', card }`, `{ type: 'clear' }`                                                                        |
| `pearl-necklace` (`ordering`)      | `order` (`alphabet`/`rhyme`), `letter`, `pearls[{ id, word, text, inPlace }]`, `submitted`, `attempts`     | `{ type: 'place', item, index }`, `{ type: 'submit' }`                                                                 |
| `fishing-nets` (`ps.sorting-nets`) | `dimension`, `nets[{ value }]`, `fish[{ id, word, text, net, wrong }]`, `submitted`, `attempts`            | `{ type: 'net', fish, net \| null }`, `{ type: 'submit' }`                                                             |
| `word-shell` (`ps.word-builder`)   | `word`, `text`, `letters`, `cuts`, `parts[{ text, role }]`, `zeroEnding`, `roles`, `submitted`, `attempts` | `{ type: 'cut' \| 'uncut', at }`, `{ type: 'label', part, role }`, `{ type: 'zero-ending', on }`, `{ type: 'submit' }` |
| `word-family` (`ps.word-family`)   | `family`, `head`, `letter`, `words[{ id, word, text, picked }]`, `needed`, `submitted`, `attempts`         | `{ type: 'pick', word }`, `{ type: 'submit' }`                                                                         |

Card faces (`CardFace`) are a word, a form of a word (`cell`, §8.6), a noun pattern or a category
value; in the narrative projection they are ID-only labels: `word:<word>`, `form:<word>:<cell>`,
`pattern:<pattern>`, `cat:<dimension>:<value>`, and every card back is `card:back`. The pairs of a
board are all different, so a match is never ambiguous. The three custom kinds are `MinigameAdapter`s
the rules register; every pair, pearl, fish, part or family word earns `balance.coins.correct` and
credits its item: a Pexeso pair fast while no mismatch happened yet, else ok; a necklace, word shell
or word family fast when right at the first check, else slow; a fish fast when caught on a first
haul with no wrong fish, ok on a first haul that sent some back, slow on a later haul.

## 13. Events (`events.ts`)

Rules emit these as transient runtime events with each commit; the shell turns them into one-shot
sounds, animations and announcements, and tests assert on them by name. Events are never replayed:
after a restore the shell rebuilds the screen from the view. Names are `<subject>.<verb>`; payloads
are small JSON objects of IDs and numbers (`EventPayloads`). `monster.joked { monster, joke }`
announces a battle joke (a catalog key) at the start, after every 5th right answer while ink is
left and when the monster is freed, cycling through its `jokes`; `BattleView.jokeKey` carries the
joke on screen, so a reload redraws the bubble.

| Group                       | Events                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session and answers         | `session.started`, `round.started`, `answer.correct`, `answer.incorrect`, `item.promoted`, `reask.scheduled`, `hint.shown`                                                                                                                                                                                   |
| Progression                 | `round.completed`, `level.completed`, `region.unlocked`, `placement.completed`, `grade.completed`                                                                                                                                                                                                            |
| Monsters and Inkoustíci     | `ink.washed`, `ink.splashed`, `arm.washed`, `monster.freed`, `monster.joked`, `inkoustik.ambushed`, `inkoustik.splashed`                                                                                                                                                                                     |
| Friends and the Shell       | `egg.received`, `friend.hatched`, `friend.grew`, `friend.crowned`, `friend.dressed`, `grotto.decorated`, `pearl.polished`                                                                                                                                                                                    |
| Economy, collections, story | `coins.earned` (reasons `answer`, `streak`, `stars`, `monster`, `ambush`, `quest`, `chest`, `placement`, `story`), `item.purchased`, `sticker.earned`, `quest.completed`, `quest.claimed`, `daily.goal-reached`, `chest.opened`, `story.advanced`, `finale.completed`, `minigame.completed`, `race.finished` |

## 14. Persistence, the family record and storage names (`persistence.ts`)

Dragon Valley and Perlové moře are served from one origin (`https://rumukh.github.io`), so every
storage name is unique to Perlové moře and all of them live in `persistence.ts`:
`STORAGE_NAMESPACE` and `ADAPTER_ID` `pearl-sea`; the save database `pearl-sea`; the game IDs
`pearl-sea` (one save per child profile), `pearl-sea-family` (the family record),
`pearl-sea-preferences` and `pearl-sea-day`; the offline pack and namespace `pearl-sea` (Cache
Storage `aegis:pearl-sea:…`); the offline error message `pearl-sea-offline-error`; the backup
format `pearl-sea-backup`; the deployment base and worker scope `/pearl-sea/`; four profiles
`profile-1` … `profile-4` with seeds from `profileSeed`. `test/unit/persistence/origin-isolation.test.ts`
proves none collides with Dragon Valley's; a new storage name is added here and to that test.

The **family record** (S4's schema, `pearl-sea-family`) holds, per child, the name, the diver
avatar (`diver-1` … `diver-8`), the grade (3 or 4, picked in the profile editor and handed to the
game at the first session) and the **form of address** (`boy`, `girl` or `neutral`), and, for the
device, the **grown-ups' language** (`cs` or `en`). The form of address and the language live there
only, never in game state, and need no new storage names. The **preferences record**
(`pearl-sea-preferences`) holds presentation settings per profile (volumes, text size, reduced
motion, read-aloud).

## 15. The rules today

The contract is complete and tested. Implemented and tested in the contract: the schemas, ID
patterns and closed vocabularies; Czech alphabetical order; lexicon IDs, gapped text, forms and the
linguistic checks; problems, answers and item IDs; skill item universes; content validation,
catalog and art collection, grammar keys and curriculum gaps; the catalog convention; state, days,
actions and events (`test/unit/contract/**`, on the fixture pack). S2's rules (docs/learning.md)
implement the adapter and everything it registers: items, selection, rounds, Svačinka, placement,
the daily adventure, progression, the economy, story beats, the views, every problem generator
(`spell.*`, `classify`, `odd-one-out`, `relation`), the five minigames, battles, the finales and
the Inkoustíci (`test/unit/**`, `test/traces/**`, `test/migration/**` on the rules' lagoon fixture,
the contract's mini pack and the game's pack), and the learner simulations measure the balance
(`test/sim/**`, `scripts/simulate.mjs`, docs/balance-report.md). Planned: the content pack beyond
the 3rd grade and its strings (S3), the shell and its records (S4), art and audio (S5).
