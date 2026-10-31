# Authoring content

Everything a child plays is data in `content/pearl-sea.content.json` (the pack) plus Czech strings
in `content/catalogs/cs.content.json`. This guide is for whoever adds regions, levels, skills,
friends, monsters, cosmetics, stickers, quests or story beats. The schema and its invariants are in
[contract.md §7-8](contract.md), the curriculum mapping in [curriculum.md](curriculum.md), the game
design in [design.md](design.md) and the word bank in [lexicon.md](lexicon.md).

## 1. Files and the build

| File                               | What                                                                                                                                                           | Edited         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `content/pack-src/pack.json`       | the game: grades, objectives, regions, levels, skills, friends, monsters, Inkoustíci, cosmetics, stickers, quests, placement, story, balance (not the lexicon) | by hand        |
| `content/lexicon-src/*.json`       | the verified word bank ([lexicon.md](lexicon.md))                                                                                                              | by hand        |
| `content/pearl-sea.content.json`   | the pack `{ id, revision, schemaVersion, data }`: `pack.json` with `lexicon` built from the word bank                                                          | never: built   |
| `content/catalogs/cs.content.json` | every Czech string the pack refers to                                                                                                                          | by hand        |
| `content/catalogs/en.content.json` | the English twins of its grown-ups' keys (the objective titles)                                                                                                | by hand        |
| `content/history/<revision>.json`  | every deployed revision, byte for byte                                                                                                                         | `content:bump` |

```sh
node scripts/lexicon/check.mjs          # the word bank's linguistic checks (lexicon.md §1)
node scripts/lexicon/build.mjs          # write the pack from its sources
node scripts/lexicon/build.mjs --check  # fail when the pack is not the build of its sources
npm run validate:content                # the content gate (part of npm run verify)
```

The build checks the word bank first, converts it (lexicon.md §8), puts it beside the game data and
formats the file with the repository's Prettier. It keeps the pack's `id`, `revision` and
`schemaVersion` from the current pack file, so a rebuild never undoes `content:bump`. The content
gate checks the schema, every cross-reference, reachability, skill item pools, activity options,
the lexicon's linguistic consistency, catalog keys, Czech typography, the reading font, story
sentence length, history packs, art IDs (a warning until the art catalog is published) and the
curriculum mapping. `test/unit/content/pack.test.ts` proves that the pack is the build of its
sources and checks the authoring rules of §3.

## 2. Revisions and history

A save pins the exact pack it was played with (ID, revision and content hash), and `main` deploys,
so **every content change merged to `main` gets a new revision** (MAJOR.MINOR.PATCH: patch for
balance or text, minor for new levels or regions; contract §7.6). The vertical slice, Slunná laguna,
is `1.0.0`. To change content:

1. Edit the sources and rebuild the pack.
2. Run `npm run content:bump -- <revision>` (fetch first). It archives the deployed pack from
   `origin/main` byte for byte as `content/history/<its revision>.json` and sets the pack's
   `revision`, nothing else.
3. Pin the new revision and its content hash in `REVISIONS` in `test/unit/content/pack.test.ts`
   (the failing test prints the hash) and re-pin the golden traces.

A change to the catalogs alone needs no revision, since saves pin the pack and not its strings, but
every catalog key a shipped pack uses must stay. IDs are append-only: a region, level, skill,
friend, cosmetic, sticker, word or sentence is never renamed or deleted.

## 3. Authoring rules

**IDs and keys.** Levels are `<region>.<n>` and `<region>.monster`; skills `sk.<region>.<topic>`
(`sk.lagoon.tvrda`); beats `beat.<region>-welcome`, `beat.<monster>`, `beat.<monster>-freed`. Every
record names its strings by catalog key: `region.<id>`, `level.<id>`, `skill.<region>.<topic>`,
`friend.<id>` and `friend.<id>.mnemonic`, `monster.<id>` and `monster.<id>.joke.<n>`,
`inkoustik.<name>`, `cosmetic.<id>`, `sticker.<id>`, `quest.<id>`, `story.<beat>.<n>` and
`story.next`, and objectives `grownups.objective.<strand>.<id>` with an English twin. A skill also
shows the grammar keys of its rules and values: `grammar.rule.<rule>` (the strategy after a miss)
and `grammar.<dimension>.<value>` (contract §7.4).

**Czech.** The child is addressed with _ty_; a bare key is neutral (no _naučil(a)_), with optional
`.boy`/`.girl` pairs (design §10). Monsters and friends agree in gender with their names (_Murena
je umazaná_). Story lines are at most 10 words a sentence and written to be read aloud. Standard
Czech only (_děkuji, nejraději, příliš_), and a joke or story line never contains a misspelled
word. Typography: „…“, …, –, no space before punctuation.

**Skills.** A spelling skill lists its words or sentences by ID and keeps to one grade. The tests
check that:

- every listed word or sentence serves its skill (a word has a point of the skill's rules);
- a listed sentence has no gap of another rule, so every gap the child sees is asked;
- every skill is practised in some level;
- every item a sentence skill teaches is in a friend's set, so ink sentences feed friends;
- a word whose point the word alone cannot decide (lexicon.md §2.2) has a sentence with a gap on
  it, and its skill's sentences list one (the generator asks such points only in sentences).

**Friends.** A friend's set is the union of its skills' items (design §6.5), so its skills are
chosen for growth, not only for practice:

- A lagoon friend's set holds about 30-40 items (design §4.1; the tests allow 25-40): its own
  consonant letters and the short words of its topics. Lesson 1 then hatches the chosen egg.
- At least 45 % of a friend's set must be items that problems (not boards) serve in its region's
  lessons after lesson 1, so an egg a 4th grader chose warms through Svačinka's first tastes and
  the placement check (S2).
- Board-only items (`abc:` necklace words, `seg:`, `pair:`, `fam:`) never come up in Svačinka, so a
  friend holds them only on purpose, listed in `BOARD_ITEMS_ON_PURPOSE` in the test.
- A consonant skill can keep to one friend's letters (`consonants`); one-class skills share an
  activity with the other classes' skills, so the answer varies within a round.

**Story.** A beat's eggs are claimed in its first node, so skipping still gives them; a level's
`storyBeat` is also the beat's `level-start` trigger, as in Dragon Valley.

## 4. Slunná laguna (`sunny-lagoon`), content 1.0.0

The 2nd grade's review (design §3.1), grade 3, the `shallows` map. All spelling skills select grade-3
words and sentences by ID.

| Level                  | Activities                                                                                              | Objectives            |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | --------------------- |
| `sunny-lagoon.1`       | necklace 2 (`abc`, `abc-pairs`), nets 1 (`consonants`), Krmení 10 by choice (`tvrda`, `mekka`, `bpvm`)  | alphabet              |
| `sunny-lagoon.2`       | Krmení 10 by choice (`delka`), ink sentence 5 (`delka-sentences`)                                       | vowel-length          |
| `sunny-lagoon.3`       | nets 2, Krmení 10 (`tvrda`, `mekka`, the three letter skills), ink sentence 5 (`tvrda-mekka-sentences`) | hard-soft             |
| `sunny-lagoon.4`       | Krmení 10 (`dtn`, `bpvm`), ink sentence 5 (`e-sentences`), Lov chyb 4 (`e-mistakes`)                    | de-te-ne, be-pe-ve-me |
| `sunny-lagoon.5`       | Krmení 10 (`u`, `parova`), Pexeso 1 (`plural-pairs`), ink sentence 5 (`u-paired-sentences`)             | u-ring, paired        |
| `sunny-lagoon.6`       | Krmení 10 (`capitals`), Lov chyb 5 (`capital-mistakes`)                                                 | capitals              |
| `sunny-lagoon.monster` | battle with Murena Mumla: meter 15, cap 20, 20 % review; the word skills and four sentence skills       | all eight             |

Skills (`sk.lagoon.*`) and their items:

| Skill                                          | Generator                         | Selects                                                                              | Items   |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| `abc`, `abc-pairs`                             | `alphabet`, 4 and 3 pearls        | the words of the alphabet sets; `abc-pairs` the sets with _h/ch, c/č, r/ř, s/š, z/ž_ | 34, 17  |
| `consonants`                                   | `sort` consonant, 12 fish         | all 24 consonants                                                                    | 24      |
| `letters-hard`, `letters-soft`, `letters-both` | `classify` consonant              | each friend's letters: _h ch k r d t n_; _ž š č ř c j ď ť ň_; _b f l m p s v z_      | 7, 9, 8 |
| `tvrda`                                        | `spell.word`, 2 choices           | _ryba, rybář, chytat, rychlý, chytrý, chyba, kytara, tygr_                           | 8       |
| `mekka`                                        | `spell.word`                      | _číslo, čistý, jídlo, jiskra, křídlo, šipka, široký, žízeň_                          | 8       |
| `bpvm`                                         | `spell.word`                      | _oběd, pěna, pět, pěkný, věc, hvězda, medvěd, město, měsíc_                          | 9       |
| `delka`                                        | `spell.word`                      | _delfín, maják, pláž, přístav, zátoka, korál, víla, vila_                            | 8       |
| `dtn`                                          | `spell.word`                      | _děti, tělo, těžký, někdo, kotě, divadlo, ticho, dívka_                              | 9       |
| `u`                                            | `spell.word`                      | _útes, úhoř, úkol, úsměv, neúspěch, dům, kůň, sůl_                                   | 8       |
| `parova`                                       | `spell.word`                      | _hrad, had, led, krab, dub, zub, sníh, mráz_                                         | 8       |
| `capitals`                                     | `spell.word`                      | _Petr, Eva, Alík, Ferda, Bublinka, Osmička, Vltava, Praha, Česko, Sněžka_            | 10      |
| `delka-sentences`                              | `spell.sentence`                  | 8 sentences on the `delka` words                                                     | 8       |
| `tvrda-mekka-sentences`                        | `spell.sentence`                  | 14 sentences on the `tvrda` and `mekka` words                                        | 16      |
| `e-sentences`, `e-mistakes`                    | `spell.sentence`, `spell.mistake` | 18 sentences on the `dtn` and `bpvm` words                                           | 18      |
| `u-paired-sentences`                           | `spell.sentence`                  | 16 sentences on the `u` and `parova` words                                           | 16      |
| `capital-mistakes`                             | `spell.mistake`                   | 7 sentences on the names                                                             | 10      |
| `plural-pairs`                                 | `pairs` plural, 6 pairs           | _hrad, had, led, krab, dub, zub, plot, holub_                                        | 8       |

Friends (design §2.2) and their sets: **Krab Tvrďák** 32 (his 7 letters, `tvrda`, `dtn`, `parova`),
**Medúzka Měkulka** 33 (her 9 letters, `mekka`, `delka`, `u`), **Želva Obojka** 27 (her 8 letters,
`bpvm`, `capitals`). Every item is one that problems serve in lessons 2-6. Želva's set leaves out
the necklace's 34 `abc:` words that design §2.2 gives her as a topic: board-only, they would hold
her growth and crowning on necklace replays and double her set; lesson 1 still feeds her through
the nets (her letters) and the Krmení (_bě pě vě mě_). The child chooses the first egg
(`chooseFirstFriend`); `beat.sunny-lagoon-eggs` brings the other two as lesson 3 starts, and
lesson 3 and the monster level give all three eggs as rewards (an owned egg is never given twice).

Story: `beat.prologue` (design §2.1's five lines, the last with `.boy`/`.girl`), `beat.first-egg`
(not skippable), `beat.sunny-lagoon-welcome`, `beat.sunny-lagoon-eggs`, `beat.murena-mumla`,
`beat.murena-mumla-freed` and `beat.inkoustici`. Economy (design §8): 3 starter cosmetics at 15-25
coins and 8 lagoon cosmetics at 175-325 (lesson 4 gives the wave scarf, the monster level the shell
bow tie), 9 stickers on the lagoon's album page, and 7 quest templates.
