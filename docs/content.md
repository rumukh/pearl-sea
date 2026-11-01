# Authoring content

Everything a child plays is data in `content/pearl-sea.content.json` (the pack) plus Czech strings
in `content/catalogs/cs.content.json`. This guide is for whoever adds regions, levels, skills,
friends, monsters, cosmetics, stickers, quests or story beats. The schema and its invariants are in
[contract.md §7-8](contract.md), the curriculum mapping in [curriculum.md](curriculum.md), the game
design in [design.md](design.md) and the word bank in [lexicon.md](lexicon.md).

## 1. Files and the build

| File                                          | What                                                                                                                                                              | Edited         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `content/pack-src/pack.json`                  | what the regions share: grades, Inkoustíci, the starter cosmetics, quest templates, the placement check and its skills, the prologue and first-egg beats, balance | by hand        |
| `content/pack-src/regions/<nn>-<region>.json` | one region each (`01-sunny-lagoon.json`, …): its objectives, region, levels, skills, friends, monster, cosmetics, stickers, quests and story beats                | by hand        |
| `content/lexicon-src/*.json`                  | the verified word bank ([lexicon.md](lexicon.md))                                                                                                                 | by hand        |
| `content/pearl-sea.content.json`              | the pack `{ id, revision, schemaVersion, data }`: the game data with `lexicon` built from the word bank                                                           | never: built   |
| `content/catalogs/cs.content.json`            | every Czech string the pack refers to                                                                                                                             | by hand        |
| `content/catalogs/en.content.json`            | the English twins of its grown-ups' keys (the objective titles)                                                                                                   | by hand        |
| `content/history/<revision>.json.gz`          | every deployed revision, byte for byte, gzip-compressed                                                                                                           | `content:bump` |

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
is `1.0.0`; regions 2-6 are `1.1.0`; regions 7-12, the 4th grade's start and the placement check
are `1.2.0`; the Krakatice's cap of 40 is `1.2.1`; the balance of the pacing study is `1.2.2`; four
lagoon points the word alone cannot decide, asked only in sentences, are `1.2.3`; the Czech QA of
regions 2-12 (§7) is `1.2.4`. To change content:

1. Edit the sources and rebuild the pack.
2. Run `npm run content:bump -- <revision>` (fetch first). It archives the deployed pack from
   `origin/main` byte for byte, gzip-compressed, as `content/history/<its revision>.json.gz` and
   sets the pack's `revision`, nothing else.
3. Pin the new revision and its content hash in `REVISIONS` in `test/unit/content/pack.test.ts`
   (the failing test prints the hash) and re-pin the golden traces.

A change to the catalogs alone needs no revision, since saves pin the pack and not its strings, but
every catalog key a shipped pack uses must stay. IDs are append-only: a region, level, skill,
friend, cosmetic, sticker, word or sentence is never renamed or deleted.

**What the rules really ask.** `node scripts/content/sample-problems.mjs [--region <id>,…]
[--per-skill 10] [--boards 2] [--seed qa]` writes, region by region into `out/problem-samples/`,
the problems the rules' own generators make for every problem skill. Each problem shows its word
or sentence, options, letter pad, answer and hint. The script also writes boards for every board
activity, each monster battle's skills with problems drawn in turn, and the Inkoustíci's
ambushes. It marks with ⚠ what a reviewer must decide:

- an option that spells another word of the bank;
- a form whose case the sentence must settle;
- an option the bank relates to the target.

Read it as a Czech teacher would before a playtest. For an option that spells a real word the bank
does not know, also check every single-word problem's alternatives against MorfFlex
([lexicon.md](lexicon.md) §5).

## 3. Authoring rules

**IDs and keys.** Levels are `<region>.<n>` and `<region>.monster`; skills `sk.<area>.<topic>`,
where the area is a region's short name (`lagoon`, `reef`, `kelp`, `wreck`, `bay`, `vents`, `ice`,
`moon`, `city`, `trench`, `storm`, `kraken`: `sk.lagoon.tvrda`, `sk.reef.vyjm-b`) or `place` for
the placement check's own skills; beats `beat.<region>-welcome`, `beat.<monster>`,
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
krakatice, lovče perel, inkoustíci_; a title or label starts with a capital (_Muréna Mumla_). The species
keeps its codified spelling even in a name (_muréna_, not _murena_). Story lines are at most 10
words a sentence and written to be read aloud. Standard Czech only (_děkuji, nejraději, příliš, a
proto_ rather than _tak_), and a joke or story line never contains a misspelled word. Typography:
„…“, …, –, no space before punctuation.

**Skills.** A spelling skill lists its words or sentences by ID and keeps to one grade. The tests
check that:

- every listed word or sentence serves its skill (a word has a point of the skill's rules; an
  odd-one-out set also names its odd words and a family board its distractors, which are no items);
- a listed sentence has no gap of another rule, so every gap the child sees is asked;
- every skill is practised in some level or placement step;
- every item a problem teaches is in a friend's set, except the skills listed in `BASKET` (below);
- a word whose point the word alone cannot decide (lexicon.md §2.2) has a sentence with a gap on
  it, and its skill's sentences list one (the generator asks such points only in sentences).

**Friends.** A friend's set is the union of its skills' items (design §6.5), so its skills are
chosen for growth, not only for practice:

- A friend hatches in the lesson design §3 names (`HATCH` in the test): its region's lessons up to
  that one must be able to credit 30 % of its set, counting for each activity the smaller of its
  places (problems, pearls, fish, cards) and the set's items it reaches. The chosen lagoon egg
  hatches in lesson 1 (design §4.1), so a lagoon friend's set holds about 30-40 items: its own
  consonant letters and the short words of its topics.
- At least 45 % of a lagoon friend's set must be items that problems (not boards) serve in the
  lagoon's lessons after lesson 1, so an egg a 4th grader chose warms through Svačinka's first
  tastes and the placement check (S2).
- Board-only items (`abc:` necklace words, `seg:`, `pair:`, `fam:`) never come up in Svačinka; they
  are reviewed when the daily adventure replays a finished board with due items. A friend holds
  them only on purpose, listed in `BOARD_ITEMS_ON_PURPOSE` in the test: Želva's necklace words,
  each listed-word friend's rhyme (its letter's listed words in school order), Jazýček's families
  (the Z list is short), Tuleň's plural Pexeso and Kořínek's word shells. A board right at the
  first check credits its items as fast answers, so they can reach gold.
- Every level feeds the friends design §3 names, but some problem skills stay out of every friend's
  set, so the sets stay small enough to hatch: their items wait in Osmiččin košík (design §5.15),
  which serves them with the friends' due items. The test lists these skills in `BASKET` and fails
  when another skill leaves an item to nobody (§5, §6).
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

| Skill                                          | Generator                         | Selects                                                                                                                    | Items   |
| ---------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| `abc`                                          | `alphabet`, 4 pearls              | Želva's words, one per letter of the tricky pairs: _cíl, člun, hvězdice, chobotnice, racek, řasa, zátoka, želva_           | 8       |
| `abc-pairs`                                    | `alphabet`, 3 pearls              | the words of the alphabet sets that tell _h/ch, c/č, r/ř, s/š, z/ž_ apart                                                  | 17      |
| `consonants`                                   | `sort` consonant, 12 fish         | all 24 consonants                                                                                                          | 24      |
| `letters-hard`, `letters-soft`, `letters-both` | `classify` consonant              | each friend's letters: _h ch k r d t n_; _ž š č ř c j ď ť ň_; _b f l m p s v z_                                            | 7, 9, 8 |
| `tvrda`                                        | `spell.word`, 2 choices           | _ryba, rybář, chytat, rychlý, chytrý, chyba, kytara, tygr_                                                                 | 8       |
| `mekka`                                        | `spell.word`                      | _číslo, čistý, jídlo, jiskra, křídlo, šipka, široký, žízeň_                                                                | 8       |
| `bpvm`                                         | `spell.word`                      | _oběd, pěna, pět, pěkný, věc, hvězda, medvěd, město, měsíc_                                                                | 9       |
| `delka`                                        | `spell.word`                      | _delfín, maják, pláž, přístav, zátoka, korál, víla, vila_                                                                  | 8       |
| `dtn`                                          | `spell.word`                      | _děti, tělo, těžký, někdo, kotě, divadlo, ticho, dívka_                                                                    | 9       |
| `u`                                            | `spell.word`                      | _útes, úhoř, úkol, úsměv, neúspěch, dům, kůň, sůl_                                                                         | 8       |
| `parova`                                       | `spell.word`                      | _hrad, had, led, krab, dub, zub, sníh, mráz_                                                                               | 8       |
| `capitals`                                     | `spell.word`                      | _Petr, Eva, Alík, Ferda, Vltava, Praha, Česko, Sněžka_ (_Bublinka_ and _Osmička_ only in sentences: _bublinka_, _osmička_) | 8       |
| `delka-sentences`                              | `spell.sentence`                  | 8 sentences on the `delka` words                                                                                           | 8       |
| `tvrda-mekka-sentences`                        | `spell.sentence`                  | 14 sentences on the `tvrda` and `mekka` words                                                                              | 16      |
| `e-sentences`, `e-mistakes`                    | `spell.sentence`, `spell.mistake` | 18 sentences on the `dtn` and `bpvm` words                                                                                 | 18      |
| `u-paired-sentences`                           | `spell.sentence`                  | 16 sentences on the `u` and `parova` words                                                                                 | 16      |
| `capital-mistakes`                             | `spell.mistake`                   | 7 sentences on the names                                                                                                   | 10      |
| `plural-pairs`                                 | `pairs` plural, 6 pairs           | _hrad, had, led, krab, dub, zub, plot, holub_                                                                              | 8       |

A point whose alternative spells another word is asked only in a sentence: _led_ (_let_) and
_přístav_ (_přistav_), in Krmení too, and the names _Bublinka_ and _Osmička_, in Lov chyb
([lexicon.md](lexicon.md) §2.2).

Friends (design §2.2) and their sets: **Krab Tvrďák** 32 (his 7 letters, `tvrda`, `dtn`, `parova`),
**Medúzka Měkulka** 33 (her 9 letters, `mekka`, `delka`, `u`), **Želva Obojka** 35 (her 8 letters,
her 8 necklace words, `bpvm`, `capitals` and `capital-mistakes`). Problems serve every item in lessons 2-6, except Želva's
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
part-of-speech `classify` skills and `odd-pos` (the nets credit the same items) and, from 1.2.0,
`meaning-class` (56 items).

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
| Kalmar Desetiruký  | `volcanic-vents.1` | 56  | 0                | 17   | 26                                 |

A region's first friend's egg is claimed in its welcome beat; a later egg is the reward of the
lesson before the friend's topic, and every egg is also a reward of its hatching lesson and of the
monster level. The problems that stay out of every set and wait in Osmiččin košík (§3) are the
odd-one-out sets `sk.reef.odd-listed`, `sk.kelp.odd-listed` and `sk.bay.odd-listed-all`, the
relations `sk.reef.relation-alike`, `sk.bay.relation-alike` and `sk.bay.relation-coordinate`, and
`sk.vents.inflection`. With it, Kalmar's set would be 96 items, and his first lesson can credit 26
of the 29 he would need.

**Monsters, story and economy.** Žralok Žrout and Mořský had Zamotal have meter 15 and cap 20; Ďas
Lucerník, Zéva Lakomá and Lávový úhoř Žhavák meter 18 and cap 23; all with 20 % review. Each region
has a welcome beat, its monster's beat and a freed beat (three lines each); four or five stickers
(each friend hatched, the monster freed and one or two more); one or two quest templates
(_correct-30_ and _splash-3_ on the reef, then _snack-10, minigame-2, fast-20, streak-12_); and three
cosmetics: 375-475 coins on the reef and in the kelp forest, 475-575 further on, the last a grotto
piece that the monster level gives.

## 6. Regions 7-12, content 1.2.0

Ledové moře closes the 3rd grade (design §3.7); Měsíční jeskyně, Potopené město, Temný příkop,
Bouřlivé moře and Krakatičí propast are the 4th grade's deep (§3.8-3.12, map `deep`). The pack's
`grades` start a 4th grader in Měsíční jeskyně after the placement check. Every level has design
§3's activities, counts and objectives, with the exceptions named below.

**Ledové moře.** Tuleň Pádík's lessons ask gender in word context, the number of forms (_delfín,
vlna_), and the cases in sentences (1-4 first, then all seven) and of forms. Delfín Skokánek's ask
person, number and tense where the sentence decides, and the infinitive against the finite forms
of _plavat_ and _skákat_. Lesson 5 classifies the kinds of sentences and simple against compound
sentences, and its ink sentences ask the end mark and the conjunction (lexicon.md §4.1). Lesson 6
reviews the hard and soft consonants, all the listed words, the parts of speech, gender, cases and
tense. Mořská saň Ledana has six icicles (`arms: 6`, `gradeFinale: 3`, meter 18, cap 24, no
review), one skill per strand in order: letters, listed words, parts of speech, nouns, verbs,
sentences. Her freed beat ends the 3rd grade.

**Měsíční jeskyně.** Four families whose words the school cuts the same way (_ryba, voda, moře,
hvězda_), with look-alikes (_rybíz, vodítko_) beside them on the family boards. Word shells ask the
root, the prefix, the suffix, the ending, then all four; Krmení names a highlighted part, and only
of words without an empty ending, since an empty part cannot be shown. `beat.the-deep` starts
lesson 1, and the welcome beat after it gives Kořínek's egg.

**Potopené město.** Prefix or preposition in ink sentences and Lov chyb. Krmení cannot ask a
sentence gap, so lesson 1's asks the odd part of speech among prepositions and prefixed verbs
(_od, pod, nad, odplavat_). Then the prefixes _od-, nad-, pod-, před-, roz-, bez-_ (words,
sentences, and shells of _podpis, nadpis, rozkaz, bezpečí_), _bje, vje_ (the shells of _objem,
objev, vjezd_ show the root's _j_), _mně_ in words and the pronoun _mě/mně_.

**Temný příkop.** Each gender's lesson classifies three nouns of each pattern and sorts and pairs
four, never the pattern word itself, which would answer its own question. A pattern Pexeso deals
each pattern once, so a board has as many pairs as patterns (at least three): lesson 4's Pexeso
pairs all six masculine patterns, _pán_ against _hrad_. Lesson 5 asks the endings
by pattern (`vzor`) and the cases of pattern forms, lesson 6 all 14 patterns and gender with
animacy. Chobotnice Napodobnice has meter 20 and cap 25.

**Bouřlivé moře.** The tense of perfective verbs and listed futures (_skočí, půjdu_), person in
sentences, simple and compound forms, mood of forms and in sentences, reflexive verbs, and standard
and colloquial words (register skills name `words.registers`). The reflexive questions keep to
verbs that never go without their pronoun (_bát se, všimnout si_) or never take one (_plavat_;
curriculum §7.3). No new friend: Delfín's set adds the reflexive verbs, and freeing Vír Časoplet
lets him grow up.

**Krakatičí propast.** Subject and predicate, also with an unexpressed subject (_Plaveme spolu k
majáku._); agreement (`shoda`) and the gender of subjects; simple and compound sentences; then the
great reviews of spelling and grammar. The spelling review adds 13 grade-4 related words to the
listed words, the prefixes, _bje, vje, mně_, agreement and _dobýt × dobít_. The Krakatice has ten
arms, one skill per strand in order (`arms: 10`, `finale`, meter 30, no review), and her cap is 40
problems (design §7.1). `beat.finale` takes the place of her freed beat.

**Placement.** Eight steps of three problems for the 4th grade (design §9.2), each passed at 66 %
(two of three, as the rules round down). In order:

1. vowels, _ú/ů_ and paired consonants (lagoon 2, 5);
2. hard and soft consonants, _ě_ and capitals (lagoon 3, 4, 6);
3. the listed words after B and L;
4. the listed words after M and P;
5. the listed words after S, V and Z (steps 3-5 place their region's lessons 2 onwards);
6. the sound-alikes (Perlová zátoka 2-5);
7. the parts of speech (Sopečné prameny 2-5);
8. the cases (Ledové moře 2-6).

A step never places a region's lesson 1 or a monster level. Its skill is one of `sk.place.*` (in
`pack.json`) or a region's own.

**Friends.**

| Friend                 | Hatches          | Set | 30 % | Lessons up to the hatch can credit | Holds                                                                                 |
| ---------------------- | ---------------- | --- | ---- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| Tuleň Pádík            | `ice-sea.1`      | 102 | 31   | 36                                 | gender, number, the cases in sentences and forms (also Temný příkop 5), plural Pexeso |
| Delfín Skokánek        | `ice-sea.4`      | 58  | 18   | 22                                 | person, tense, the infinitive, the reflexive verbs                                    |
| Rak poustevník Kořínek | `moon-caves.1`   | 50  | 15   | 20                                 | family boards and odd ones out, root shells, prefix or root                           |
| Štítovec Přísavka      | `sunken-city.1`  | 50  | 15   | 20                                 | prefix or preposition, the odd part of speech, the prefixes' consonants, bje/vje, mně |
| Klipka Vzorná          | `dark-trench.1`  | 57  | 18   | 22                                 | the patterns, the endings by pattern                                                  |
| Klauni Dvojčata        | `kraken-abyss.2` | 46  | 14   | 23                                 | subject and predicate, agreement                                                      |

Delfín's egg comes with `ice-sea.2` and the Klauni's with `kraken-abyss.1`, but they hatch in
`ice-sea.4` and `kraken-abyss.2` (design §3.7, §3.12): their sets reach into later lessons, so
they hatch once their lessons so far can credit 30 % of them.

The basket (`BASKET`, §3) holds:

- the number of verbs and tense forms;
- the 3rd grade's sentence kinds, clauses, end marks and conjunctions (the Klauni's in design §3.7;
  their set would not hatch with them);
- naming a word's parts after the prefix;
- the pronoun _mě/mně_;
- Bouřlivé moře's verb forms, moods and standard Czech (design §3.11: _košík_);
- Krakatičí propast's genders of subjects, clauses and reviews.

**Story and economy.** Each region has a welcome, a monster and a freed beat. Ledana's freed beat
ends the 3rd grade, `beat.the-deep` opens the deep, and `beat.finale` ends the game. There are four
or five stickers a region (_Sedm pádů, Ledana roztála, 3. třída hotová, Čtrnáct vzorů, Skokánek
dospěl, Deset umytých ramen, První korunka_), one quest template each (_level-2, correct-40,
snack-15, minigame-3, fast-30, streak-15_), and cosmetics at 475-575 coins in Ledové moře and
590-600 in the deep (design §8.2).

**Stickers across the album.** 1.2.0 brings the album to 60 stickers (design §8.3). Besides each
region's own, there are long-run stickers on the pages with fewer:

- the race's bests (design §5.14): _Deset za minutu_ on the reef's page, next to where the race
  opens, and _Dvacet za minutu_ in Temný příkop;
- _Deset kamarádů_ in Perlová zátoka;
- _Pět set mincí_, _Dvacet dní pod hladinou_ and _Dvacet inkoustíků_;
- _Sto zlatých perel_ on the last page.

_3. třída hotová_ is the Ledana battle completed. She is freed at the same moment, so the 3rd
grade's end earns two stickers.

## 7. The Czech QA of the generated problems, content 1.2.3 and 1.2.4

Before the playtest, every problem skill's problems, the boards and the battles were read as a
Czech teacher would, through `scripts/content/sample-problems.mjs` (§2). That was 1,322 problems
and 132 boards. Every alternative a word asked alone can show was also looked up in MorfFlex
([lexicon.md](lexicon.md) §5). The review established these rules for content.

**A word alone must have one right answer.** If an option or a letter-pad key spells another
common word, the point is asked only in a sentence. Its partner word joins the bank (lexicon.md
§2.2): _led_ (_let_), _přístav_ (_přistav_), _lyže_ (_líže_), _lyska_ (_líska_), _mýval_
(_míval_), _opylovat_ (_opilovat_), _slepýš_ (_slepíš_), _vy_ (_ví_), _vjet_ (_vět_).

- A word whose partner would join a family leaves the single-word lists instead:
  - _nabít_ (_nabýt_) is now asked in the B sound-alike sentences (`sk.reef.alike-b`, _Musím
    nabít baterii v ponorce._);
  - _pobyt_ (_pobýt_) in the B sentences.
- _Bublinka_ and _Osmička_ wait for the contract to tell a capital from an i/y pair (S1's #18).

**One highlighted word must carry what is asked.** A person, number, tense or mood question
highlights one word, so it cannot ask a compound form:

- _jsme «plavali»_ carries the person in _jsme_;
- _budeme «plavat»_ highlights an infinitive;
- _by «plavala»_ carries the conditional in _by_.

These sentences left the skills that ask about the highlighted word:

- `sk.ice.verb-person`, `-number` and `-tense` lost _verbs.07, 08, 10_. They gained two simple
  futures: _Zítra půjdeme k moři._ and _Racek zítra poletí k ostrovu._;
- `sk.storm.person` lost _verbs.18, 23, 30_;
- `sk.storm.mood` lost _verbs.18, 20, 25_. The conditional is asked on whole forms
  (`sk.storm.mood-forms`) until a highlight can cover several words.

**The words must show what is hidden.** A sentence-kind problem hides the end mark, so a question
must have a question word: _Plavou delfíni rychleji než ryby?_ left `sk.ice.kinds`. Wishes start
with _Kéž_, because _Ať_ can also start a command.

**No second right answer.**

- Synonyms and antonyms are closed (lexicon.md §2.6); eight antonym pairs joined, among them
  _smutný × radostný_.
- _Děti_ is neuter as _dítě_ but feminine in the agreement of the plural, so it left the gender
  question (`sk.kraken.gender-class`).
- The pronoun _mně_ in the 3rd case is asked where it is stressed, since _mi_ is the unstressed
  form: _Tu mušli dej mně, ne krabovi._

**Variety and naturalness.**

- The odd-one-out of listed words has more words that are not listed (_bitva, bidlo, líný, plíce,
  milý, smích, pilný_), so the answer is not always _bílý_ or _místo_.
- _mně_ inside a word has six words (_příjemně, skromně, rozumně, tajemně_).
- _blýskavice_, a bookish word, left the grade-3 family boards.
- _Na tuhle otázku neznám odpověď._ and _vlny ho vracely zpátky_ read more naturally.
- The rule line for standard Czech names the three common changes: _mlíko, velkej, vokno_.

**For the rules (S2).** These went to S2: reflexive problems that show _se/si_ in the word, the
full stop on the end-mark pad, typed whole-word gaps (conjunctions, _mě/mně_, prefixes), and the
punctuation the classify context drops. Also hints that give the answer away or point at the
look-alike, hint gaps, and punctuation inside Lov chyb tokens.

**Kept on purpose.** These alternatives are rare words a child does not mean: _sípat, prosít,
posýpat, vyset, sír_. A teacher would mark them wrong too, and the word read aloud decides. Also
kept:

- _Ponorka podplula pod mostem_, which shows a prefix and a preposition side by side;
- _sírové prameny_;
- the odd-one-out of listed words in the reef's first lesson, as design §3.2 places it.
