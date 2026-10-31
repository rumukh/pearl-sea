# Authoring content

Everything a child plays is data in `content/pearl-sea.content.json` (the pack) plus Czech strings
in `content/catalogs/cs.content.json`. This guide is for whoever adds regions, levels, skills,
friends, monsters, cosmetics, stickers, quests or story beats. The schema and its invariants are in
[contract.md §7-8](contract.md), the curriculum mapping in [curriculum.md](curriculum.md), the game
design in [design.md](design.md) and the word bank in [lexicon.md](lexicon.md).

## 1. Files and the build

| File                                          | What                                                                                                                                               | Edited         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `content/pack-src/pack.json`                  | what the regions share: grades, Inkoustíci, the starter cosmetics, quest templates, placement, the prologue and first-egg beats, balance           | by hand        |
| `content/pack-src/regions/<nn>-<region>.json` | one region each (`01-sunny-lagoon.json`, …): its objectives, region, levels, skills, friends, monster, cosmetics, stickers, quests and story beats | by hand        |
| `content/lexicon-src/*.json`                  | the verified word bank ([lexicon.md](lexicon.md))                                                                                                  | by hand        |
| `content/pearl-sea.content.json`              | the pack `{ id, revision, schemaVersion, data }`: the game data with `lexicon` built from the word bank                                            | never: built   |
| `content/catalogs/cs.content.json`            | every Czech string the pack refers to                                                                                                              | by hand        |
| `content/catalogs/en.content.json`            | the English twins of its grown-ups' keys (the objective titles)                                                                                    | by hand        |
| `content/history/<revision>.json`             | every deployed revision, byte for byte                                                                                                             | `content:bump` |

```sh
node scripts/lexicon/check.mjs          # the word bank's linguistic checks (lexicon.md §1)
node scripts/lexicon/build.mjs          # write the pack from its sources
node scripts/lexicon/build.mjs --check  # fail when the pack is not the build of its sources
npm run validate:content                # the content gate (part of npm run verify)
```

The build checks the word bank first and appends each region file's records to the shared lists in
file-name order (a region file holds only region records; its `story` adds beats and rewards). It
then converts the word bank (lexicon.md §8), puts it beside the game data and formats the file with
the repository's Prettier. It keeps the pack's `id`, `revision` and
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
is `1.0.0`; regions 2-6 are `1.1.0`. To change content:

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

**IDs and keys.** Levels are `<region>.<n>` and `<region>.monster`; skills `sk.<area>.<topic>`,
where the area is a region's short name (`lagoon`, `reef`, `kelp`, `wreck`, `bay`, `vents`:
`sk.lagoon.tvrda`, `sk.reef.vyjm-b`); beats `beat.<region>-welcome`, `beat.<monster>`,
`beat.<monster>-freed`. Every
record names its strings by catalog key: `region.<id>`, `level.<id>`, `skill.<region>.<topic>`,
`friend.<id>` and `friend.<id>.mnemonic`, `monster.<id>` and `monster.<id>.joke.<n>`,
`inkoustik.<name>`, `cosmetic.<id>`, `sticker.<id>`, `quest.<id>`, `story.<beat>.<n>` and
`story.next`, and objectives `grownups.objective.<strand>.<id>` with an English twin. A skill also
shows the grammar keys of its rules and values: `grammar.rule.<rule>` (the strategy after a miss)
and `grammar.<dimension>.<value>` (contract §7.4).

**Czech.** The child is addressed with _ty_; a bare key is neutral (no _naučil(a)_), with optional
`.boy`/`.girl` pairs (design §10). Monsters and friends agree in gender with their names (_Muréna
je umazaná_). In running text a species noun before a name, a role noun and a kind of creature
are written small, as the capitals lesson teaches (lexicon.md §3.1): _muréna Mumla, obří
krakatice, lovče perel_; a title or label starts with a capital (_Muréna Mumla_). The species
keeps its codified spelling even in a name (_muréna_, not _murena_). Story lines are at most 10
words a sentence and written to be read aloud. Standard Czech only (_děkuji, nejraději, příliš, a
proto_ rather than _tak_), and a joke or story line never contains a misspelled word. Typography:
„…“, …, –, no space before punctuation.

**Skills.** A spelling skill lists its words or sentences by ID and keeps to one grade. The tests
check that:

- every listed word or sentence serves its skill (a word has a point of the skill's rules; an
  odd-one-out set also names its odd words, which are no items);
- a listed sentence has no gap of another rule, so every gap the child sees is asked;
- every skill is practised in some level;
- every item a sentence skill teaches is in a friend's set, so ink sentences feed friends;
- a word whose point the word alone cannot decide (lexicon.md §2.2) has a sentence with a gap on
  it, and its skill's sentences list one (the generator asks such points only in sentences).

**Friends.** A friend's set is the union of its skills' items (design §6.5), so its skills are
chosen for growth, not only for practice:

- A friend hatches in the lesson design §3 names (`HATCH` in the test): its region's lessons up to
  that one must be able to credit 30 % of its set, counting for each activity the smaller of its
  places (problems, pearls, fish, cards) and the set's items it reaches. The chosen lagoon egg
  hatches in lesson 1 (design §4.1), so a lagoon friend's set holds about 30-40 items: its own
  consonant letters and the short words of its topics.
- At least 45 % of a friend's set must be items that problems (not boards) serve in its region's
  lessons after lesson 1, so an egg a 4th grader chose warms through Svačinka's first tastes and
  the placement check (S2).
- Board-only items (`abc:` necklace words, `seg:`, `pair:`, `fam:`) never come up in Svačinka; they
  are reviewed when the daily adventure replays a finished board with due items. A friend holds
  them only on purpose, listed in `BOARD_ITEMS_ON_PURPOSE` in the test: Želva's necklace words,
  each listed-word friend's rhyme (its letter's listed words in school order) and Jazýček's
  families (the Z list is short). A board right at the first check credits its items as fast
  answers, so they can reach gold.
- Every level feeds the friends design §3 names, but a few problem skills stay out of every
  friend's set, so the sets stay small enough to hatch: their items wait in Osmiččin košík (design
  §5.15), which serves them with the friends' due items (§5).
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
| `sunny-lagoon.monster` | battle with Muréna Mumla: meter 15, cap 20, 20 % review; the word skills and four sentence skills       | all eight             |

Skills (`sk.lagoon.*`) and their items:

| Skill                                          | Generator                         | Selects                                                                                                          | Items   |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| `abc`                                          | `alphabet`, 4 pearls              | Želva's words, one per letter of the tricky pairs: _cíl, člun, hvězdice, chobotnice, racek, řasa, zátoka, želva_ | 8       |
| `abc-pairs`                                    | `alphabet`, 3 pearls              | the words of the alphabet sets that tell _h/ch, c/č, r/ř, s/š, z/ž_ apart                                        | 17      |
| `consonants`                                   | `sort` consonant, 12 fish         | all 24 consonants                                                                                                | 24      |
| `letters-hard`, `letters-soft`, `letters-both` | `classify` consonant              | each friend's letters: _h ch k r d t n_; _ž š č ř c j ď ť ň_; _b f l m p s v z_                                  | 7, 9, 8 |
| `tvrda`                                        | `spell.word`, 2 choices           | _ryba, rybář, chytat, rychlý, chytrý, chyba, kytara, tygr_                                                       | 8       |
| `mekka`                                        | `spell.word`                      | _číslo, čistý, jídlo, jiskra, křídlo, šipka, široký, žízeň_                                                      | 8       |
| `bpvm`                                         | `spell.word`                      | _oběd, pěna, pět, pěkný, věc, hvězda, medvěd, město, měsíc_                                                      | 9       |
| `delka`                                        | `spell.word`                      | _delfín, maják, pláž, přístav, zátoka, korál, víla, vila_                                                        | 8       |
| `dtn`                                          | `spell.word`                      | _děti, tělo, těžký, někdo, kotě, divadlo, ticho, dívka_                                                          | 9       |
| `u`                                            | `spell.word`                      | _útes, úhoř, úkol, úsměv, neúspěch, dům, kůň, sůl_                                                               | 8       |
| `parova`                                       | `spell.word`                      | _hrad, had, led, krab, dub, zub, sníh, mráz_                                                                     | 8       |
| `capitals`                                     | `spell.word`                      | _Petr, Eva, Alík, Ferda, Bublinka, Osmička, Vltava, Praha, Česko, Sněžka_                                        | 10      |
| `delka-sentences`                              | `spell.sentence`                  | 8 sentences on the `delka` words                                                                                 | 8       |
| `tvrda-mekka-sentences`                        | `spell.sentence`                  | 14 sentences on the `tvrda` and `mekka` words                                                                    | 16      |
| `e-sentences`, `e-mistakes`                    | `spell.sentence`, `spell.mistake` | 18 sentences on the `dtn` and `bpvm` words                                                                       | 18      |
| `u-paired-sentences`                           | `spell.sentence`                  | 16 sentences on the `u` and `parova` words                                                                       | 16      |
| `capital-mistakes`                             | `spell.mistake`                   | 7 sentences on the names                                                                                         | 10      |
| `plural-pairs`                                 | `pairs` plural, 6 pairs           | _hrad, had, led, krab, dub, zub, plot, holub_                                                                    | 8       |

Friends (design §2.2) and their sets: **Krab Tvrďák** 32 (his 7 letters, `tvrda`, `dtn`, `parova`),
**Medúzka Měkulka** 33 (her 9 letters, `mekka`, `delka`, `u`), **Želva Obojka** 35 (her 8 letters,
her 8 necklace words, `bpvm`, `capitals`). Problems serve every item in lessons 2-6, except Želva's
necklace words: she knows the alphabet (design §2.2), so they are in her set on purpose (§3), and
lesson 1's necklace, nets and Krmení all feed her. Any 4 of her 8 necklace words hold a whole pair
(_c, č_ or _h, ch_ …) three times in four. The child chooses the first egg (`chooseFirstFriend`);
`beat.sunny-lagoon-eggs` brings the other two as lesson 3 starts, and lesson 3 and the monster
level give all three eggs as rewards (an owned egg is never given twice).

Story: `beat.prologue` (design §2.1's five lines, the last with `.boy`/`.girl`), `beat.first-egg`
(not skippable), `beat.sunny-lagoon-welcome`, `beat.sunny-lagoon-eggs`, `beat.murena-mumla`,
`beat.murena-mumla-freed` and `beat.inkoustici`. Economy (design §8): 3 starter cosmetics at 15-25
coins and 8 lagoon cosmetics at 175-325 (lesson 4 gives the wave scarf, the monster level the shell
bow tie), 9 stickers on the lagoon's album page, and 7 quest templates.

## 5. Regions 2-6, content 1.1.0

Korálový útes, Chaluhový les and Pirátský vrak teach the listed words after B and L, M and P, and S,
V and Z (design §3.2-3.4); Perlová zátoka all of them with sound-alikes, word families and meanings
(§3.5); Sopečné prameny the ten parts of speech (§3.6). All are grade 3 on the `shallows` map, and
each opens after the previous region's monster level. Every level has design §3's activities,
counts and objectives; the Krmení that §3 marks _c_ is `input: 'choice'`.

**A listed letter.** Each of B, L, M, P, S, V and Z has the same skills, named by the letter
(`sk.reef.vyjm-b`, `sk.kelp.rhyme-m`):

| Skill           | Generator                       | Selects                                                                                                              |
| --------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `rhyme-<x>`     | `alphabet` rhyme, 4-7 pearls    | the listed words (its families' heads) in school order; _lýko_ stays out, as rhymes put it on either side of _lýtko_ |
| `vyjm-<x>`      | `spell.word`, 2 choices         | the listed words and 4-12 related words (_bydliště, mlynář, mýdlo, pyšný, synek, zvyk, jazýček_)                     |
| `related-<x>`   | `spell.word`                    | the related words alone, for the lessons on related words                                                            |
| `sentences-<x>` | `spell.sentence`                | the letter's sentences whose gaps are all rule `vyjm`                                                                |
| `contrast-<x>`  | `spell.word`, rule `obojetna-i` | common words with _i/í_ after the letter (_bílý, mlít, místo, písek, síla, vítr, zima_)                              |
| `family-<x>`    | `family`, pick 3                | the letter's families                                                                                                |

The letters with sound-alike pairs also have `alike-<x>` (`spell.sentence`: _být/bít, bydlo/bidlo;
mýt/mít, my/mi; pyl/pil; sýrový/sírový; výr/vír, výt/vít, výskat/vískat, vysel/visel_) and a Pexeso
of the pairs (`sk.reef.pairs-alike`, `pairs-alike-m`, `-p`, `-s`, `-v` and `sk.wreck.pairs-alike-svz`;
a board with fewer than three pairs adds an earlier letter's). Besides them: `sk.reef.obojetna-i`
(one i-word after each letter: _bílý, lípa, mince, pírko, síla, vítr, zima_, which the friends eat
through their `contrast` skills), `sk.reef.pairs-family-b` and `-l` (words with a relative), `sk.wreck.prefix-vy`
and `prefix-vy-sentences` (rule `vyjm-prefix`: _vyplout, výlet_), `odd-listed` (odd-one-out basis
`listed`: three listed or related words and one i-word) and the Lov chyb sets `mistakes-bl`,
`mistakes-mp`, `mistakes-svz` and `sk.bay.mistakes-all`. A Lov chyb sentence has only gaps the word
alone decides: a mistake that makes another word (_bil → byl_) is left to the sound-alike sentences,
where the gap is asked (§3).

Perlová zátoka reuses the letters' `vyjm` skills and adds `rhyme-all`, `odd-listed-all` and
`mistakes-all` (lesson 1), `family-all`, `pairs-family`, `relation-related` and `odd-family`
(lesson 2), `pairs-alike-all`, `alike-all` and `relation-alike` (lesson 3), `pairs-synonym`,
`pairs-antonym` and `relation-synonym-antonym` (lesson 4), and `pairs-general` (the general words),
`relation-general` and `relation-coordinate` (the specific words: _kapr, štika, pstruh_) for
lesson 5.

Sopečné prameny asks parts of speech in word context (the 3rd grade, curriculum §7). Its `classify`
values grow lesson by lesson: nouns and verbs; adjectives and adverbs with the earlier values;
pronouns and numerals with the earlier values; then prepositions, conjunctions, particles and
interjections alone; then all ten. Each lesson's nets sort its words. The 40 words (_velryba, plavat,
krásný, daleko, můj, tři, na, ale, prý, bác_ …) also serve `inflection` and `odd-pos`, and 16 of
them `meaning-class`.

**Friends.** Each listed-word friend holds its letter's `rhyme`, `vyjm`, `sentences`, `contrast` and
`alike` skills; Vydra also the prefix _vy-/vý-_, Jazýček also `family-z`. Hvězdice holds
`relation-related`, `odd-family`, `relation-synonym-antonym` and `relation-general`; Kalmar the five
part-of-speech `classify` skills and `odd-pos` (the nets credit the same items).

| Friend             | Hatches            | Set | Necklace words   | 30 % | Lessons up to the hatch can credit |
| ------------------ | ------------------ | --- | ---------------- | ---- | ---------------------------------- |
| Barakuda Bystřinka | `coral-reef.2`     | 50  | 13               | 15   | 31                                 |
| Lachtan Lyžař      | `coral-reef.4`     | 43  | 12               | 13   | 21                                 |
| Koník Mýdlínek     | `kelp-forest.1`    | 47  | 14               | 15   | 21                                 |
| Pyskoun Pyšný      | `kelp-forest.3`    | 44  | 14               | 14   | 21                                 |
| Ježík Syčík        | `pirate-wreck.1`   | 36  | 11               | 11   | 20                                 |
| Vydra Výskalka     | `pirate-wreck.3`   | 50  | 11               | 15   | 20                                 |
| Jazyk Jazýček      | `pirate-wreck.5`   | 23  | 4 (and 6 `fam:`) | 7    | 15                                 |
| Hvězdice Rodinka   | `pearl-bay.2`      | 39  | 0                | 12   | 16                                 |
| Kalmar Desetiruký  | `volcanic-vents.1` | 40  | 0                | 12   | 26                                 |

A region's first friend's egg is claimed in its welcome beat; a later egg is the reward of the
lesson before the friend's topic, and every egg is also a reward of its hatching lesson and of the
monster level. The problems that stay out of every set and wait in Osmiččin košík (§3) are the
odd-one-out sets `sk.reef.odd-listed`, `sk.kelp.odd-listed` and `sk.bay.odd-listed-all`, the
relations `sk.reef.relation-alike`, `sk.bay.relation-alike` and `sk.bay.relation-coordinate`, and
`sk.vents.inflection` and `sk.vents.meaning-class`. With them, Kalmar's set would be 96 items, and
his first lesson can credit 26 of the 29 he would need.

**Monsters, story and economy.** Žralok Žrout and Mořský had Zamotal have meter 15 and cap 20; Ďas
Lucerník, Zéva Lakomá and Lávový úhoř Žhavák meter 18 and cap 23; all with 20 % review. Each region
has a welcome beat, its monster's beat and a freed beat (three lines each); four or five stickers
(each friend hatched, the monster freed and one or two more); one or two quest templates
(_correct-30_ and _splash-3_ on the reef, then _snack-10, minigame-2, fast-20, streak-12_); and three
cosmetics: 375-475 coins on the reef and in the kelp forest, 475-575 further on, the last a grotto
piece that the monster level gives.
