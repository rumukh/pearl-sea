# Curriculum: Czech language for the 3rd and 4th grade

Perlové moře teaches the language component (_jazyková výchova_: grammar and spelling) of the Czech
primary-school subject _Český jazyk a literatura_ to children in the 3rd and 4th grade (_3. a 4.
ročník ZŠ_), in Czech. This document lists every learning objective with a **stable objective ID**,
the lessons and monster levels that teach it, the ten strands behind Krakatice's ten arms, the RVP
ZV coverage, the textbook alignment, the bounds the generators must respect, the listed words
(_vyjmenovaná slova_), the school terms the game shows and a Czech-English glossary for the
grown-ups' area.

The objective IDs are data: the content pack `content/pearl-sea.content.json` declares them under
`objectives`, and levels list the objectives they teach. `scripts/validate-content.mjs
--strict-coverage` (part of `npm run verify`) fails on any objective without a lesson level or
without a monster level: on the content pack once the content session (S3) publishes it, and until
then on the §3 table of this document. A test (`test/unit/contract/curriculum-doc.test.ts`) keeps
this document, [design.md](design.md) and the content pack in step. Objective IDs are stable
forever once shipped: an objective is retired with a content migration, never renamed or reused.

## 1. Sources and scope

**The framework programme.** The _Rámcový vzdělávací program pro základní vzdělávání_ (RVP ZV),
subject _Český jazyk a literatura_, component _Jazyková výchova_. The text in force is MŠMT's
January 2021 revision, which left _Jazyková výchova_ unchanged, carried forward by the amendment
in force from 1 September 2023 (MSMT-12464/2023). The outcomes quoted in §5 were checked word for
word against the official text with marked changes
([rvp-zv-2021-s-vyznacenymi-zmenami.pdf](https://digitalizace.rvp.cz/files/rvp-zv-2021-s-vyznacenymi-zmenami.pdf),
pp. 20-22) and the RVP portals ([digifolio.rvp.cz](https://digifolio.rvp.cz/view/view.php?id=10575),
[prohlednout.rvp.cz](https://prohlednout.rvp.cz/zakladni-vzdelavani/vzdelavaci-oblasti/jjk)). The
game serves these expected outcomes (_očekávané výstupy_):

- **ČJL-3-2-01 to ČJL-3-2-08**, the 1st period (_1. období_, grades 1-3);
- **ČJL-5-2-01 to ČJL-5-2-09**, the 2nd period (_2. období_, grades 4-5). The 4th grade is the
  first year of the period and takes the part of these outcomes that the textbooks give it (§6).

**The revised framework.** MŠMT approved a revised RVP ZV on 30 December 2024
([npi.cz](https://www.npi.cz/aktuality/87794-msmt-schvalilo-revidovane-rvp)), with expected
learning results (_očekávané výsledky učení_) set at nodal points (_uzlové body_) at the end of the
5th and the 9th grade. Schools may follow it from 1 September 2025; it becomes mandatory first only
in the 1st and the 6th grade (from the 2028/29 school year in the published timeline; some sources
give a year earlier) and reaches the 3rd and 4th grade years later. Until then the codes
ČJL-3-2-xx and ČJL-5-2-xx stand. When the revised outcomes reach these grades, §5 gains a column
for them; the objective IDs do not change.

**Reference works.** The _Internetová jazyková příručka_ of the Czech Language Institute (ÚJČ AV
ČR): the listed words ([prirucka.ujc.cas.cz/?id=100](https://prirucka.ujc.cas.cz/?id=100), after
the 1993 academic edition of the _Pravidla českého pravopisu_, PČP), the consonants and _i/y_
([?id=103](https://prirucka.ujc.cas.cz/?id=103)) and the pattern _předseda_
([?id=222](https://prirucka.ujc.cas.cz/?id=222)). The textbooks are listed in §6.

**In scope**: the _jazyková výchova_ of the 3rd and 4th grade, read and written: letters and
sounds, spelling, the listed words, word meaning, word structure, prefixes, parts of speech, nouns,
verbs, standard Czech and the sentence.

**Out of scope** (the plan, §9): reading and literature (_Literární výchova_, ČJL-3-3-01 to
ČJL-3-3-04 and ČJL-5-3-01 to ČJL-5-3-04); handwriting and the oral and written communication skills
of _Komunikační a slohová výchova_ (ČJL-3-1-01 to ČJL-3-1-11 and ČJL-5-1-01 to ČJL-5-1-10,
including the spoken side of standard Czech, ČJL-5-1-08); direct speech (_přímá řeč_), which some
4th-grade books add (§6.2); recorded voice-over; and the 5th grade, the second year of the 2nd
period (typically the kinds of adjectives and their endings, the categories of pronouns and
numerals, the prefixes _s-, z-, vz-_).

**Only partly covered**, in detail in §5:

- ČJL-3-2-01: splitting a word into its sounds (_člení slova na hlásky_) is practised only through
  letters, vowel length and the paired consonants, never on its own;
- ČJL-3-2-05 and ČJL-5-2-03 ask for correct forms "in speech" (_v mluveném projevu_, _ve svém
  mluveném projevu_); the game practises them through written forms, and adjective forms have no
  objective of their own;
- ČJL-3-2-07: the kinds of sentence and their written means (the end marks) are practised; the
  spoken means (_zvukové prostředky_, intonation) are outside a reading and writing game;
- ČJL-5-2-01: words with several meanings (_slova vícevýznamová_) appear only as senses in hints
  (the lexicon's `senses`), never as an exercise of their own;
- ČJL-5-2-06: the child tells a simple sentence from a compound one and joins clauses with a chosen
  conjunction, but does not rewrite a simple sentence as a compound one in their own words.

Choosing a conjunction (ČJL-3-2-06, ČJL-5-2-07) and the end mark of a sentence (ČJL-3-2-07) are
practised as sentence gaps (rules `spojka` and `interpunkce`, §7.1).

## 2. Objectives

Objectives are listed by grade and grouped by strand, in the order the sea first teaches each
group. _Grade_ is the school grade the objective belongs to; _Strand_ is one of the ten strands of
§4; _Czech program wording_ is the term of Czech textbooks and school programmes (_ŠVP_); _RVP ZV_
names the expected outcomes of §5 that the objective serves. Objectives are named only in the
grown-ups' area: in the content pack an objective's title is a `grownups.objective.*` catalog key
with an English twin ([contract.md](contract.md) §7.4), and the two wording columns below are their
starting point.

| ID                                | Grade | Strand            | Objective (English)                                                                                         | Czech program wording                                                                           | RVP ZV                 |
| --------------------------------- | ----- | ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| `obj.letters.alphabet`            | 3     | `letters-sounds`  | The Czech alphabet and alphabetical order, _ch_ after _h_                                                   | abeceda, řazení slov podle abecedy                                                              | ČJL-3-2-01             |
| `obj.letters.vowel-length`        | 3     | `letters-sounds`  | Short and long vowels                                                                                       | samohlásky krátké a dlouhé                                                                      | ČJL-3-2-01             |
| `obj.letters.hard-soft`           | 3     | `letters-sounds`  | Hard and soft consonants: _y_ after the hard ones, _i_ after the soft ones                                  | tvrdé a měkké souhlásky, psaní y/ý po tvrdých a i/í po měkkých souhláskách                      | ČJL-3-2-08             |
| `obj.letters.de-te-ne`            | 3     | `letters-sounds`  | _dě, tě, ně_ and the soft _di, ti, ni_                                                                      | psaní dě, tě, ně a di, ti, ni                                                                   | ČJL-3-2-08             |
| `obj.letters.be-pe-ve-me`         | 3     | `letters-sounds`  | _bě, pě, vě, mě_ inside a word (not at a prefix seam)                                                       | psaní bě, pě, vě, mě mimo morfologický šev                                                      | ČJL-3-2-08             |
| `obj.letters.u-ring`              | 3     | `letters-sounds`  | _ú_ or _ů_                                                                                                  | psaní ú/ů                                                                                       | ČJL-3-2-08             |
| `obj.letters.paired`              | 3     | `letters-sounds`  | Paired consonants inside and at the end of a word, checked by a test word (_hrad → hrady_)                  | párové souhlásky, psaní souhlásek uvnitř a na konci slov                                        | ČJL-3-2-01, ČJL-3-2-08 |
| `obj.letters.capitals`            | 3     | `letters-sounds`  | Capital letters at the start of a sentence and in typical names of people, animals and places               | velká písmena na začátku věty a ve vlastních jménech osob, zvířat a místních pojmenování        | ČJL-3-2-08             |
| `obj.listed.both-way`             | 3     | `listed-words`    | The both-way consonants _b, f, l, m, p, s, v, z_: _y_ only in the listed words                              | obojetné souhlásky                                                                              | ČJL-3-2-08             |
| `obj.listed.b`                    | 3     | `listed-words`    | The listed words after _b_                                                                                  | vyjmenovaná slova po B                                                                          | ČJL-3-2-08             |
| `obj.listed.l`                    | 3     | `listed-words`    | The listed words after _l_                                                                                  | vyjmenovaná slova po L                                                                          | ČJL-3-2-08             |
| `obj.listed.m`                    | 3     | `listed-words`    | The listed words after _m_                                                                                  | vyjmenovaná slova po M                                                                          | ČJL-3-2-08             |
| `obj.listed.p`                    | 3     | `listed-words`    | The listed words after _p_                                                                                  | vyjmenovaná slova po P                                                                          | ČJL-3-2-08             |
| `obj.listed.s`                    | 3     | `listed-words`    | The listed words after _s_                                                                                  | vyjmenovaná slova po S                                                                          | ČJL-3-2-08             |
| `obj.listed.v`                    | 3     | `listed-words`    | The listed words after _v_, with the prefix _vy-/vý-_                                                       | vyjmenovaná slova po V, předpona vy-/vý-                                                        | ČJL-3-2-08             |
| `obj.listed.z`                    | 3     | `listed-words`    | The listed words after _z_                                                                                  | vyjmenovaná slova po Z                                                                          | ČJL-3-2-08             |
| `obj.listed.related`              | 3     | `listed-words`    | Words related to the listed words keep their _y_ (_bydlet, obyvatel, mlynář_)                               | slova příbuzná k vyjmenovaným slovům                                                            | ČJL-3-2-02, ČJL-3-2-08 |
| `obj.listed.all`                  | 3     | `listed-words`    | All the listed words together                                                                               | všechna vyjmenovaná slova                                                                       | ČJL-3-2-08             |
| `obj.listed.sound-alikes`         | 3     | `listed-words`    | Sound-alike pairs: a listed word or not (_být × bít, mýt × mít, výr × vír_)                                 | slova stejně znějící                                                                            | ČJL-3-2-08, ČJL-5-2-08 |
| `obj.meaning.families`            | 3     | `word-meaning`    | Word families: finding the related words                                                                    | slova příbuzná, slovní rodina                                                                   | ČJL-3-2-02             |
| `obj.meaning.synonyms-antonyms`   | 3     | `word-meaning`    | Synonyms and antonyms                                                                                       | slova souznačná a protikladná                                                                   | ČJL-3-2-02, ČJL-5-2-01 |
| `obj.meaning.general-specific`    | 3     | `word-meaning`    | General, specific and coordinate words                                                                      | slova nadřazená, podřazená a souřadná                                                           | ČJL-3-2-02             |
| `obj.pos.ten`                     | 3     | `parts-of-speech` | The ten parts of speech, in the basic form                                                                  | slovní druhy                                                                                    | ČJL-3-2-04             |
| `obj.pos.inflected`               | 3     | `parts-of-speech` | Inflected and uninflected parts of speech                                                                   | slovní druhy ohebné a neohebné                                                                  | ČJL-3-2-04             |
| `obj.pos.meaning-class`           | 3     | `parts-of-speech` | Sorting words by their generalised meaning: action, thing, circumstance, property                           | třídění slov podle významu: děj, věc, okolnost, vlastnost                                       | ČJL-3-2-03             |
| `obj.nouns.gender-number`         | 3     | `nouns`           | Gender (masculine, feminine, neuter) and number of nouns                                                    | rod a číslo podstatných jmen                                                                    | ČJL-3-2-05             |
| `obj.nouns.cases`                 | 3     | `nouns`           | The seven cases and their questions                                                                         | pády a pádové otázky                                                                            | ČJL-3-2-05             |
| `obj.verbs.person-number-tense`   | 3     | `verbs`           | Person, number and tense of verbs                                                                           | osoba, číslo a čas sloves                                                                       | ČJL-3-2-05             |
| `obj.verbs.infinitive`            | 3     | `verbs`           | The infinitive and the finite forms of a verb                                                               | infinitiv a určitý tvar slovesa                                                                 | ČJL-3-2-05             |
| `obj.sentences.kinds`             | 3     | `sentences`       | Kinds of sentence by the speaker's attitude (statement, question, command, wish) and their end marks        | druhy vět podle postoje mluvčího: oznamovací, tázací, rozkazovací, přací; znaménka na konci vět | ČJL-3-2-07             |
| `obj.sentences.compound-3`        | 3     | `sentences`       | Simple and compound sentences; joining clauses with a fitting conjunction                                   | věta jednoduchá a souvětí, spojování vět spojkami                                               | ČJL-3-2-06             |
| `obj.structure.root`              | 4     | `word-structure`  | The root, shared by related words                                                                           | kořen slova, slova příbuzná                                                                     | ČJL-5-2-02             |
| `obj.structure.prefix`            | 4     | `word-structure`  | The prefix                                                                                                  | předpona (část předponová)                                                                      | ČJL-5-2-02             |
| `obj.structure.suffix`            | 4     | `word-structure`  | The suffix                                                                                                  | přípona (část příponová)                                                                        | ČJL-5-2-02             |
| `obj.structure.ending`            | 4     | `word-structure`  | The ending                                                                                                  | koncovka                                                                                        | ČJL-5-2-02             |
| `obj.prefixes.vs-prepositions`    | 4     | `prefixes`        | Prefix or preposition: written together or apart (_odplavala × od mola_)                                    | předpony a předložky                                                                            | ČJL-5-2-02, ČJL-5-2-09 |
| `obj.prefixes.consonants`         | 4     | `prefixes`        | The prefixes _od-, nad-, pod-, před-, roz-, bez-_ and the consonants at their seam (_odtáhnout, rozzlobit_) | předpony od-, nad-, pod-, před-, roz-, bez-                                                     | ČJL-5-2-02             |
| `obj.prefixes.bje-vje`            | 4     | `prefixes`        | _bje, vje_ at a prefix seam against _bě, vě_ (_objet, vjezd × oběd, věda_)                                  | skupiny bě/bje, vě/vje                                                                          | ČJL-5-2-02             |
| `obj.prefixes.pe-me-mne`          | 4     | `prefixes`        | _pě_, and _mě_ against _mně_ in words and in the pronoun _já_ (_město, zapomněl; mě, mně_)                  | skupiny pě, mě/mně                                                                              | ČJL-5-2-02             |
| `obj.listed.grade4`               | 4     | `listed-words`    | The listed words and their related words, reviewed and extended in the 4th grade                            | vyjmenovaná slova a slova příbuzná, opakování a rozšíření                                       | ČJL-5-2-08             |
| `obj.nouns.patterns`              | 4     | `nouns`           | Animacy and the 14 noun patterns: finding a noun's pattern                                                  | životnost, vzory podstatných jmen, určování vzoru                                               | ČJL-5-2-03             |
| `obj.nouns.declension`            | 4     | `nouns`           | Declining nouns by their pattern; _i_ or _y_ in the endings                                                 | skloňování podstatných jmen podle vzorů, psaní i/y v koncovkách                                 | ČJL-5-2-03             |
| `obj.verbs.tense-forms`           | 4     | `verbs`           | Person, number and tense; simple and compound verb forms                                                    | osoba, číslo, čas; tvary jednoduché a složené                                                   | ČJL-5-2-03             |
| `obj.verbs.mood`                  | 4     | `verbs`           | Mood: indicative, imperative, conditional                                                                   | způsob oznamovací, rozkazovací, podmiňovací                                                     | ČJL-5-2-03             |
| `obj.verbs.reflexive`             | 4     | `verbs`           | Reflexive verbs with _se_ and _si_                                                                          | zvratná slovesa                                                                                 | ČJL-5-2-03             |
| `obj.standard.register`           | 4     | `standard-czech`  | Standard words and their colloquial forms                                                                   | spisovná a nespisovná čeština                                                                   | ČJL-5-2-04             |
| `obj.sentences.subject-predicate` | 4     | `sentences`       | Subject and predicate, also with an unexpressed subject                                                     | základní skladební dvojice: podmět a přísudek                                                   | ČJL-5-2-05             |
| `obj.sentences.agreement`         | 4     | `sentences`       | Agreement of the past-tense predicate with the subject (_psi štěkali, kočky mňoukaly_)                      | shoda přísudku s podmětem                                                                       | ČJL-5-2-09             |
| `obj.sentences.compound-4`        | 4     | `sentences`       | Simple sentence or compound sentence; choosing conjunctions and other connectives                           | věta jednoduchá a souvětí, spojovací výrazy                                                     | ČJL-5-2-06, ČJL-5-2-07 |

## 3. Objectives by level and monster

Level IDs and titles follow [design.md](design.md) §3: `<region>.<n>` is a lesson and
`<region>.monster` the region's monster level, 77 levels in 12 regions (65 lessons, 12 monster
levels). Every objective has at least one lesson and at least one monster level, and every level
teaches at least one objective. The mapping is exact in both directions: a level's `objectives` in
the content pack are exactly the objectives whose row below lists that level.

- **Review levels.** `ice-sea.6` (_Velké opakování 3. třídy_) reviews the 3rd grade: hard and soft
  consonants, all the listed words, the ten parts of speech, the cases, and the person, number and
  tense of verbs. `kraken-abyss.4` (_Velké opakování: pravopis_) reviews 4th-grade spelling:
  prefixes and prepositions, _bě/bje, vě/vje_, _pě, mě/mně_, the listed words and agreement.
  `kraken-abyss.5` (_Velké opakování: mluvnice_) reviews 4th-grade grammar: the noun patterns,
  tenses and verb forms, mood and compound sentences.
- **Finales.** Mořská saň Ledana (`ice-sea.monster`) is the 3rd grader's finale before the deep:
  hard and soft consonants, all the listed words, the parts of speech, gender, number and cases,
  the verbs and the sentence. Krakatice Inkoustová (`kraken-abyss.monster`) is the grand finale:
  ten inky arms, one per strand (§4), over twelve objectives (the sentence arm has three).

| Objective                         | Lessons                                                                                                         | Monster levels                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `obj.letters.alphabet`            | `sunny-lagoon.1`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.vowel-length`        | `sunny-lagoon.2`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.hard-soft`           | `sunny-lagoon.3`, `ice-sea.6`                                                                                   | `sunny-lagoon.monster`, `ice-sea.monster`, `kraken-abyss.monster`   |
| `obj.letters.de-te-ne`            | `sunny-lagoon.4`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.be-pe-ve-me`         | `sunny-lagoon.4`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.u-ring`              | `sunny-lagoon.5`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.paired`              | `sunny-lagoon.5`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.letters.capitals`            | `sunny-lagoon.6`                                                                                                | `sunny-lagoon.monster`                                              |
| `obj.listed.both-way`             | `coral-reef.1`                                                                                                  | `coral-reef.monster`                                                |
| `obj.listed.b`                    | `coral-reef.2`, `coral-reef.3`, `coral-reef.6`                                                                  | `coral-reef.monster`                                                |
| `obj.listed.l`                    | `coral-reef.4`, `coral-reef.5`, `coral-reef.6`                                                                  | `coral-reef.monster`                                                |
| `obj.listed.m`                    | `kelp-forest.1`, `kelp-forest.2`, `kelp-forest.5`                                                               | `kelp-forest.monster`                                               |
| `obj.listed.p`                    | `kelp-forest.3`, `kelp-forest.4`, `kelp-forest.5`                                                               | `kelp-forest.monster`                                               |
| `obj.listed.s`                    | `pirate-wreck.1`, `pirate-wreck.2`, `pirate-wreck.6`                                                            | `pirate-wreck.monster`                                              |
| `obj.listed.v`                    | `pirate-wreck.3`, `pirate-wreck.4`, `pirate-wreck.6`                                                            | `pirate-wreck.monster`                                              |
| `obj.listed.z`                    | `pirate-wreck.5`, `pirate-wreck.6`                                                                              | `pirate-wreck.monster`                                              |
| `obj.listed.related`              | `coral-reef.3`, `coral-reef.5`, `kelp-forest.2`, `kelp-forest.4`, `pirate-wreck.2`, `pirate-wreck.4`            | `coral-reef.monster`, `kelp-forest.monster`, `pirate-wreck.monster` |
| `obj.listed.all`                  | `pearl-bay.1`, `ice-sea.6`                                                                                      | `pearl-bay.monster`, `ice-sea.monster`                              |
| `obj.listed.sound-alikes`         | `coral-reef.6`, `kelp-forest.2`, `kelp-forest.4`, `pirate-wreck.2`, `pirate-wreck.4`, `pearl-bay.3`             | `pearl-bay.monster`                                                 |
| `obj.meaning.families`            | `pearl-bay.2`                                                                                                   | `pearl-bay.monster`                                                 |
| `obj.meaning.synonyms-antonyms`   | `pearl-bay.4`                                                                                                   | `pearl-bay.monster`, `kraken-abyss.monster`                         |
| `obj.meaning.general-specific`    | `pearl-bay.5`                                                                                                   | `pearl-bay.monster`                                                 |
| `obj.pos.ten`                     | `volcanic-vents.1`, `volcanic-vents.2`, `volcanic-vents.3`, `volcanic-vents.4`, `volcanic-vents.5`, `ice-sea.6` | `volcanic-vents.monster`, `ice-sea.monster`, `kraken-abyss.monster` |
| `obj.pos.inflected`               | `volcanic-vents.5`                                                                                              | `volcanic-vents.monster`                                            |
| `obj.pos.meaning-class`           | `volcanic-vents.5`                                                                                              | `volcanic-vents.monster`                                            |
| `obj.nouns.gender-number`         | `ice-sea.1`                                                                                                     | `ice-sea.monster`                                                   |
| `obj.nouns.cases`                 | `ice-sea.2`, `ice-sea.6`                                                                                        | `ice-sea.monster`                                                   |
| `obj.verbs.person-number-tense`   | `ice-sea.3`, `ice-sea.6`                                                                                        | `ice-sea.monster`                                                   |
| `obj.verbs.infinitive`            | `ice-sea.4`                                                                                                     | `ice-sea.monster`                                                   |
| `obj.sentences.kinds`             | `ice-sea.5`                                                                                                     | `ice-sea.monster`                                                   |
| `obj.sentences.compound-3`        | `ice-sea.5`                                                                                                     | `ice-sea.monster`                                                   |
| `obj.structure.root`              | `moon-caves.1`, `moon-caves.5`                                                                                  | `moon-caves.monster`, `kraken-abyss.monster`                        |
| `obj.structure.prefix`            | `moon-caves.2`, `moon-caves.5`                                                                                  | `moon-caves.monster`                                                |
| `obj.structure.suffix`            | `moon-caves.3`, `moon-caves.5`                                                                                  | `moon-caves.monster`                                                |
| `obj.structure.ending`            | `moon-caves.4`, `moon-caves.5`                                                                                  | `moon-caves.monster`                                                |
| `obj.prefixes.vs-prepositions`    | `sunken-city.1`, `sunken-city.5`, `kraken-abyss.4`                                                              | `sunken-city.monster`, `kraken-abyss.monster`                       |
| `obj.prefixes.consonants`         | `sunken-city.2`, `sunken-city.5`                                                                                | `sunken-city.monster`                                               |
| `obj.prefixes.bje-vje`            | `sunken-city.3`, `sunken-city.5`, `kraken-abyss.4`                                                              | `sunken-city.monster`                                               |
| `obj.prefixes.pe-me-mne`          | `sunken-city.4`, `sunken-city.5`, `kraken-abyss.4`                                                              | `sunken-city.monster`                                               |
| `obj.listed.grade4`               | `kraken-abyss.4`                                                                                                | `kraken-abyss.monster`                                              |
| `obj.nouns.patterns`              | `dark-trench.1`, `dark-trench.2`, `dark-trench.3`, `dark-trench.4`, `dark-trench.6`, `kraken-abyss.5`           | `dark-trench.monster`, `kraken-abyss.monster`                       |
| `obj.nouns.declension`            | `dark-trench.5`, `dark-trench.6`                                                                                | `dark-trench.monster`                                               |
| `obj.verbs.tense-forms`           | `storm-sea.1`, `storm-sea.2`, `kraken-abyss.5`                                                                  | `storm-sea.monster`, `kraken-abyss.monster`                         |
| `obj.verbs.mood`                  | `storm-sea.3`, `kraken-abyss.5`                                                                                 | `storm-sea.monster`                                                 |
| `obj.verbs.reflexive`             | `storm-sea.4`                                                                                                   | `storm-sea.monster`                                                 |
| `obj.standard.register`           | `storm-sea.5`                                                                                                   | `storm-sea.monster`, `kraken-abyss.monster`                         |
| `obj.sentences.subject-predicate` | `kraken-abyss.1`                                                                                                | `kraken-abyss.monster`                                              |
| `obj.sentences.agreement`         | `kraken-abyss.2`, `kraken-abyss.4`                                                                              | `kraken-abyss.monster`                                              |
| `obj.sentences.compound-4`        | `kraken-abyss.3`, `kraken-abyss.5`                                                                              | `kraken-abyss.monster`                                              |

## 4. Strands and Krakatice's arms

The ten strands are `STRANDS` in `src/rules/contract/kinds.ts`, in this order, and every skill
names its strand. In the grand finale each of Krakatice's ten inky arms is washed clean with
problems of one strand, as Dragon Valley's Seven-Headed Dragon is cured head by head: arm 1 is
`letters-sounds`, arm 10 `sentences`. An arm reviews the objectives of its strand that list
`kraken-abyss.monster` in §3, so every strand comes back once more before the end.

| Arm | Strand            | Czech name           | What it covers                                                                                                                                                                                   | Objectives                                                                                                                                                                                                                    | The arm reviews                                                                          |
| --- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `letters-sounds`  | Hlásky a písmena     | the alphabet and alphabetical order, short and long vowels, hard and soft consonants, _dě, tě, ně_ and _di, ti, ni_, _bě, pě, vě, mě_, _ú/ů_, paired consonants, capital letters                 | `obj.letters.alphabet`, `obj.letters.vowel-length`, `obj.letters.hard-soft`, `obj.letters.de-te-ne`, `obj.letters.be-pe-ve-me`, `obj.letters.u-ring`, `obj.letters.paired`, `obj.letters.capitals`                            | `obj.letters.hard-soft`                                                                  |
| 2   | `listed-words`    | Vyjmenovaná slova    | the both-way consonants, the listed words after _b, l, m, p, s, v, z_ and their related words, all of them together, the sound-alike pairs, the 4th-grade review                                 | `obj.listed.both-way`, `obj.listed.b`, `obj.listed.l`, `obj.listed.m`, `obj.listed.p`, `obj.listed.s`, `obj.listed.v`, `obj.listed.z`, `obj.listed.related`, `obj.listed.all`, `obj.listed.sound-alikes`, `obj.listed.grade4` | `obj.listed.grade4`                                                                      |
| 3   | `word-meaning`    | Význam slov          | word families, synonyms and antonyms, general, specific and coordinate words                                                                                                                     | `obj.meaning.families`, `obj.meaning.synonyms-antonyms`, `obj.meaning.general-specific`                                                                                                                                       | `obj.meaning.synonyms-antonyms`                                                          |
| 4   | `word-structure`  | Stavba slova         | root, prefix, suffix and ending                                                                                                                                                                  | `obj.structure.root`, `obj.structure.prefix`, `obj.structure.suffix`, `obj.structure.ending`                                                                                                                                  | `obj.structure.root`                                                                     |
| 5   | `prefixes`        | Předpony a předložky | prefix or preposition (together or apart), the prefixes _od-, nad-, pod-, před-, roz-, bez-_, _bě/bje_, _vě/vje_, _pě_, _mě/mně_                                                                 | `obj.prefixes.vs-prepositions`, `obj.prefixes.consonants`, `obj.prefixes.bje-vje`, `obj.prefixes.pe-me-mne`                                                                                                                   | `obj.prefixes.vs-prepositions`                                                           |
| 6   | `parts-of-speech` | Slovní druhy         | the ten parts of speech, inflected and uninflected, action, thing, circumstance and property                                                                                                     | `obj.pos.ten`, `obj.pos.inflected`, `obj.pos.meaning-class`                                                                                                                                                                   | `obj.pos.ten`                                                                            |
| 7   | `nouns`           | Podstatná jména      | gender, number and the cases (3rd grade); animacy, the 14 patterns and declension (4th grade)                                                                                                    | `obj.nouns.gender-number`, `obj.nouns.cases`, `obj.nouns.patterns`, `obj.nouns.declension`                                                                                                                                    | `obj.nouns.patterns`                                                                     |
| 8   | `verbs`           | Slovesa              | person, number, tense and the infinitive (3rd grade); simple and compound forms, mood and reflexive verbs (4th grade)                                                                            | `obj.verbs.person-number-tense`, `obj.verbs.infinitive`, `obj.verbs.tense-forms`, `obj.verbs.mood`, `obj.verbs.reflexive`                                                                                                     | `obj.verbs.tense-forms`                                                                  |
| 9   | `standard-czech`  | Spisovná čeština     | standard words and their colloquial forms                                                                                                                                                        | `obj.standard.register`                                                                                                                                                                                                       | `obj.standard.register`                                                                  |
| 10  | `sentences`       | Věta a souvětí       | kinds of sentence and their end marks, simple and compound sentences and their conjunctions (3rd grade); subject and predicate, agreement, connectives and the comma between clauses (4th grade) | `obj.sentences.kinds`, `obj.sentences.compound-3`, `obj.sentences.subject-predicate`, `obj.sentences.agreement`, `obj.sentences.compound-4`                                                                                   | `obj.sentences.subject-predicate`, `obj.sentences.agreement`, `obj.sentences.compound-4` |

Word families appear in two strands: by meaning in the 3rd grade (`obj.meaning.families`, _slova
příbuzná_) and by their shared root in the 4th (`obj.structure.root`). The sound-alike pairs (_slova
stejně znějící_) belong to `listed-words`, because a listed word decides each of them. Mořská saň
Ledana, the 3rd-grade finale, reviews the 3rd-grade part of six strands: `letters-sounds`,
`listed-words`, `parts-of-speech`, `nouns`, `verbs` and `sentences`.

## 5. RVP ZV coverage

The expected outcomes of _Jazyková výchova_ in the exact wording of the RVP ZV 2021 (pp. 20-22 of
the official text; each continues "žák …", the pupil …), with the objectives that serve them.
**Covered** means the game practises and checks the whole outcome in reading and writing;
**partly** says what is missing.

### 5.1 The 1st period (grades 1-3)

- **ČJL-3-2-01** "rozlišuje zvukovou a grafickou podobu slova, člení slova na hlásky, odlišuje
  dlouhé a krátké samohlásky"
  - objectives: `obj.letters.alphabet`, `obj.letters.vowel-length`, `obj.letters.paired`;
  - **partly**: vowel length, the letters of the alphabet (_ch_ is one letter) and sound against
    spelling (_hrad_ ends in a [t] but is written with _d_) are covered; splitting a word into its
    sounds is not asked on its own.
- **ČJL-3-2-02** "porovnává významy slov, zvláště slova opačného významu a slova významem
  souřadná, nadřazená a podřazená, vyhledá v textu slova příbuzná"
  - objectives: `obj.listed.related`, `obj.meaning.families`, `obj.meaning.synonyms-antonyms`,
    `obj.meaning.general-specific`;
  - **covered**; related words are found in sets of words and in short sentences rather than in
    longer texts.
- **ČJL-3-2-03** "porovnává a třídí slova podle zobecněného významu – děj, věc, okolnost,
  vlastnost"
  - objectives: `obj.pos.meaning-class`;
  - **covered**.
- **ČJL-3-2-04** "rozlišuje slovní druhy v základním tvaru"
  - objectives: `obj.pos.ten`, `obj.pos.inflected`;
  - **covered**: all ten parts of speech, in the basic form.
- **ČJL-3-2-05** "užívá v mluveném projevu správné gramatické tvary podstatných jmen,
  přídavných jmen a sloves"
  - objectives: `obj.nouns.gender-number`, `obj.nouns.cases`, `obj.verbs.person-number-tense`,
    `obj.verbs.infinitive`;
  - **partly**: practised through written forms, where the child names and chooses the forms of
    nouns and verbs. Speech (_v mluveném projevu_) is outside a reading and writing game, and
    adjective forms have no objective of their own.
- **ČJL-3-2-06** "spojuje věty do jednodušších souvětí vhodnými spojkami a jinými spojovacími
  výrazy"
  - objectives: `obj.sentences.compound-3`;
  - **covered**: the child tells a simple sentence from a compound one, finds its conjunctions and
    joins two clauses with a fitting one (`spojka` gaps: _Ryba nemá nohy, ale umí plavat._).
- **ČJL-3-2-07** "rozlišuje v textu druhy vět podle postoje mluvčího a k jejich vytvoření volí
  vhodné jazykové i zvukové prostředky"
  - objectives: `obj.sentences.kinds`;
  - **partly**: the four kinds are told apart in written sentences and written with the right end
    mark (`interpunkce` gaps: _Kde je mušle?_); only the spoken means (intonation) are outside a
    reading and writing game.
- **ČJL-3-2-08** "odůvodňuje a píše správně: i/y po tvrdých a měkkých souhláskách i po obojetných
  souhláskách ve vyjmenovaných slovech; dě, tě, ně, ú/ů, bě, pě, vě, mě – mimo morfologický šev;
  velká písmena na začátku věty a v typických případech vlastních jmen osob, zvířat a místních
  pojmenování"
  - objectives: `obj.letters.hard-soft`, `obj.letters.de-te-ne`, `obj.letters.be-pe-ve-me`,
    `obj.letters.u-ring`, `obj.letters.paired`, `obj.letters.capitals`, `obj.listed.both-way`,
    `obj.listed.b`, `obj.listed.l`, `obj.listed.m`, `obj.listed.p`, `obj.listed.s`,
    `obj.listed.v`, `obj.listed.z`, `obj.listed.related`, `obj.listed.all`,
    `obj.listed.sound-alikes`;
  - **covered**; the reasoning (_odůvodňuje_) is practised by naming the consonant class and the
    listed word, and every hint shows it.

### 5.2 The 2nd period (grades 4-5)

- **ČJL-5-2-01** "porovnává významy slov, zvláště slova stejného nebo podobného významu a slova
  vícevýznamová"
  - objectives: `obj.meaning.synonyms-antonyms`;
  - **partly**: synonyms are covered; words with several meanings appear only as senses in hints.
- **ČJL-5-2-02** "rozlišuje ve slově kořen, část příponovou, předponovou a koncovku"
  - objectives: `obj.structure.root`, `obj.structure.prefix`, `obj.structure.suffix`,
    `obj.structure.ending`, `obj.prefixes.vs-prepositions`, `obj.prefixes.consonants`,
    `obj.prefixes.bje-vje`, `obj.prefixes.pe-me-mne`;
  - **covered**.
- **ČJL-5-2-03** "určuje slovní druhy plnovýznamových slov a využívá je v gramaticky správných
  tvarech ve svém mluveném projevu"
  - objectives: `obj.nouns.patterns`, `obj.nouns.declension`, `obj.verbs.tense-forms`,
    `obj.verbs.mood`, `obj.verbs.reflexive`;
  - **partly**: nouns and verbs, as 4th-grade textbooks take them, in written forms; the parts of
    speech themselves come back in Krakatice's parts-of-speech arm. The categories of adjectives,
    pronouns and numerals are later work.
- **ČJL-5-2-04** "rozlišuje slova spisovná a jejich nespisovné tvary"
  - objectives: `obj.standard.register`;
  - **covered** in writing: words on their own (Pexeso, fishing nets and Určování by register) and
    in sentences (Lov chyb finds and fixes the colloquial word, `spisovne` gaps); the spoken side,
    ČJL-5-1-08, is out of scope.
- **ČJL-5-2-05** "vyhledává základní skladební dvojici a v neúplné základní skladební dvojici
  označuje základ věty"
  - objectives: `obj.sentences.subject-predicate`;
  - **covered**, including sentences with an unexpressed subject (_Plavali jsme k útesu._), where
    the predicate alone is the basis of the sentence.
- **ČJL-5-2-06** "odlišuje větu jednoduchou a souvětí, vhodně změní větu jednoduchou v souvětí"
  - objectives: `obj.sentences.compound-4`;
  - **partly**: telling them apart and joining clauses with a chosen conjunction are covered;
    rewriting a simple sentence as a compound one in the child's own words is not checked.
- **ČJL-5-2-07** "užívá vhodných spojovacích výrazů, podle potřeby projevu je obměňuje"
  - objectives: `obj.sentences.compound-4`;
  - **covered**: connectives are recognised in sentences and chosen to fit the meaning of each
    sentence (`spojka` gaps: _a, ale, protože, když_).
- **ČJL-5-2-08** "píše správně i/y ve slovech po obojetných souhláskách"
  - objectives: `obj.listed.sound-alikes`, `obj.listed.grade4`;
  - **covered**.
- **ČJL-5-2-09** "zvládá základní příklady syntaktického pravopisu"
  - objectives: `obj.prefixes.vs-prepositions`, `obj.sentences.agreement`;
  - **covered** for the RVP's own example, the agreement of the predicate with a bare subject
    (_shoda přísudku s holým podmětem_); prefix or preposition, which the sentence decides,
    counts here as well.

### 5.3 Minimum recommended level

For pupils with support measures the RVP sets a minimum level (_minimální doporučená úroveň_). The
game's choice-first input and early lessons serve most of it:

- ČJL-3-2-01p "rozlišuje všechna písmena malé a velké abecedy; rozeznává samohlásky (odlišuje
  jejich délku) a souhlásky; tvoří slabiky; rozlišuje věty, slova, slabiky, hlásky": letters,
  vowels and consonants are covered (`sunny-lagoon.1` to `sunny-lagoon.3`); syllables are not
  practised;
- ČJL-3-2-08p "píše velká písmena na začátku věty a ve vlastních jménech": `sunny-lagoon.6`;
- ČJL-5-2-03p "pozná podstatná jména a slovesa": `volcanic-vents.1`;
- ČJL-5-2-06p "dodržuje pořádek slov ve větě, pozná a určí druhy vět podle postoje mluvčího": the
  kinds of sentence are covered (`ice-sea.5`); word order is not practised;
- ČJL-5-2-08p "rozlišuje tvrdé, měkké a obojetné souhlásky a ovládá pravopis měkkých a tvrdých
  slabik": `sunny-lagoon.3`, `coral-reef.1`;
- the uncoded "určuje samohlásky a souhlásky", "seřadí slova podle abecedy", "správně vyslovuje a
  píše slova se skupinami hlásek dě-tě-ně-bě-pě-vě-mě" and "správně vyslovuje a píše znělé a
  neznělé souhlásky": covered in writing (`sunny-lagoon.1` to `sunny-lagoon.5`); pronunciation is
  out of scope.

### 5.4 Subject matter

The RVP gives one block of subject matter (_učivo_) for the whole of primary school, grades 1-5:

| Učivo (RVP ZV, exact wording)                                                                                                                                                         | In Pearl Sea                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zvuková stránka jazyka – sluchové rozlišení hlásek, výslovnost samohlásek, souhlásek a souhláskových skupin, modulace souvislé řeči (tempo, intonace, přízvuk)                        | Only where the sound decides the spelling: vowel length, _di, ti, ni_, _dě, tě, ně_, the paired consonants, with optional read-aloud. Pronunciation and the modulation of speech are out of scope.                                                                                                                                                                                       |
| slovní zásoba a tvoření slov – slova a pojmy, význam slov, slova jednoznačná a mnohoznačná, antonyma, synonyma, homonyma; stavba slova (kořen, část předponová a příponová, koncovka) | `word-meaning` and `word-structure`. Homonyms only as the sound-alike pairs of the listed words; words with one or several meanings only as senses in hints.                                                                                                                                                                                                                             |
| tvarosloví – slovní druhy, tvary slov                                                                                                                                                 | `parts-of-speech`, `nouns`, `verbs`.                                                                                                                                                                                                                                                                                                                                                     |
| skladba – věta jednoduchá a souvětí, základní skladební dvojice                                                                                                                       | `sentences`.                                                                                                                                                                                                                                                                                                                                                                             |
| pravopis – lexikální, základy morfologického (koncovky podstatných jmen a přídavných jmen tvrdých a měkkých) a syntaktického (shoda přísudku s holým podmětem)                        | Lexical: `letters-sounds`, `listed-words`, `prefixes`. Morphological: the noun endings by pattern (`obj.nouns.declension`); the endings of hard and soft adjectives (_mladý, jarní_) come with the kinds of adjectives after the 4th grade and are out of scope. Syntactic: `obj.sentences.agreement`, with the end marks and the commas between clauses (`interpunkce`) in `sentences`. |

## 6. Textbook alignment

Czech schools choose their own textbooks, and the order of topics differs between publishers, but
the big blocks are stable. Confidence is **high** where a table of contents was read in a
publisher's sample and **lower** where only a publisher's description was available.

### 6.1 The 3rd grade

**Source** (high confidence): Lenka Bičanová and Alena Bára Doležalová, _Český jazyk 3, pracovní
sešit pro 3. ročník, 1. díl_ (Nová škola, Brno, 2021), the table of contents of the publisher's
sample; the workbook follows the textbook _Český jazyk 3_. Its 2nd part (lower confidence, the
publisher's description): the listed words after P, S, V, Z, then the parts of speech, nouns,
verbs, the sentence and the compound sentence.

| Textbook (Nová škola, Český jazyk 3)                                                                                                                                                                       | Pearl Sea                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Opakování: věta, slovo, slabika, hláska; abeceda; psaní u/ú/ů; psaní i/í po měkkých a y/ý po tvrdých souhláskách; slova se skupinami dě, tě, ně, bě, pě, vě, mě; psaní souhlásek uvnitř a na konci slov | Slunná laguna (`sunny-lagoon.1` to `sunny-lagoon.5`): the same review of the 2nd grade; capital letters (`sunny-lagoon.6`) added from ČJL-3-2-08                                                                                                                          |
| II. Nauka o slově: význam slov; slova protikladná, souznačná, nadřazená, podřazená, souřadná, mnohoznačná, citově zabarvená, příbuzná                                                                      | Related words inside the listed-word regions (_slova příbuzná_ after each letter); the rest in Perlová zátoka (`pearl-bay.2` to `pearl-bay.5`). Words with several meanings only as senses in hints; emotionally coloured words (_slova citově zabarvená_) are not taught |
| III. Hláskosloví a výslovnost: stavba slova, slovní přízvuk                                                                                                                                                | Word structure is formalised in the 4th grade (Měsíční jeskyně, ČJL-5-2-02); in the 3rd grade the root is only the part related words share. Word stress is spoken and out of scope                                                                                       |
| IV. Psaní i, í / y, ý uvnitř slov po B, L, M: obojetné souhlásky; vyjmenovaná slova po B, L, M                                                                                                             | Korálový útes (both-way consonants, B, L) and Chaluhový les (M)                                                                                                                                                                                                           |
| 2nd part: vyjmenovaná slova po P, S, V, Z                                                                                                                                                                  | Chaluhový les (P), Pirátský vrak (S, V, Z), Perlová zátoka (all of them together, the sound-alike pairs)                                                                                                                                                                  |
| 2nd part: slovní druhy                                                                                                                                                                                     | Sopečné prameny                                                                                                                                                                                                                                                           |
| 2nd part: podstatná jména, slovesa, věta a souvětí                                                                                                                                                         | Ledové moře                                                                                                                                                                                                                                                               |

**One difference.** The workbook takes word meaning (_nauka o slově_) before the listed words.
Pearl Sea teaches the related words that the listed words need inside the listed-word regions and
gathers the rest of word meaning in Perlová zátoka, after all seven letters. A class that follows
the book's order can have Perlová zátoka unlocked ahead in the grown-ups' area.

**The cases.** Pearl Sea introduces the seven cases and their questions in the 3rd grade, as the
plan places them in Ledové moře. The correct forms of nouns in ČJL-3-2-05 imply them, and a 3rd
grader names a case only by its number and question (_3. pád, komu? čemu?_), with no patterns. The
4th grade formalises the cases with the patterns and their endings in Temný příkop, where
_Hravá čeština 4_ puts _Skloňování podstatných jmen_ (§6.2). Schools differ in how far they take
the cases in the 3rd grade; every 4th grader meets them again, formally, in Temný příkop.

### 6.2 The 4th grade

**Source** (high confidence): Iva Hlásenská and Jana Olžbutová, _Hravá čeština 4, pracovní sešit
pro 4. ročník ZŠ_ (Taktik International, Praha, 1st edition 2016), the table of contents of the
publisher's sample
([etaktik.cz](https://www.etaktik.cz/UserFiles/Image/1586868211hrava-cestina-4-sesit.pdf)); the
workbook follows the textbook _Hravá čeština 4_. Lower confidence (publisher pages, no sample
read): Fraus _Český jazyk 4_ and SPN _Český jazyk pro 4. ročník_ take word structure with _bě, pě,
vě, mě_ and prefixes against prepositions, then the parts of speech, nouns with their patterns,
verbs with mood and tense, and the sentence with agreement: the same order.

| Workbook (Taktik, Hravá čeština 4)                | Pearl Sea                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opakování po prázdninách                          | The placement check _Ukaž, co umíš_; the shallows stay open for review                                                                                                                                              |
| Nauka o slově                                     | Perlová zátoka, open for review; Krakatice's word-meaning arm (`obj.meaning.synonyms-antonyms`, ČJL-5-2-01)                                                                                                         |
| Stavba slova                                      | Měsíční jeskyně (root, prefix, suffix, ending), then Potopené město (prefix or preposition, _bě/bje, vě/vje, pě, mě/mně_), which Fraus and SPN teach within word structure                                          |
| Vyjmenovaná slova po B, L, M, P, S, V, Z; shrnutí | Spaced review rather than a block: the 3rd-grade regions stay open, hungry friends ask for their due words (_Svačinka_), and `kraken-abyss.4` and Krakatice's listed-words arm close the year (`obj.listed.grade4`) |
| Slovní druhy                                      | Sopečné prameny, open for review; Krakatice's parts-of-speech arm                                                                                                                                                   |
| Podstatná jména; Skloňování podstatných jmen      | Temný příkop: animacy, the 14 patterns, declension                                                                                                                                                                  |
| Slovesa; Časování sloves                          | Bouřlivé moře: person, number, tense, simple and compound forms, mood, reflexive verbs                                                                                                                              |
| Stavba věty; Shoda přísudku s podmětem            | Krakatičí propast (`kraken-abyss.1` to `kraken-abyss.3`)                                                                                                                                                            |
| Přímá řeč                                         | Not taught (out of scope)                                                                                                                                                                                           |
| Opakování podstatných jmen; Závěrečné opakování   | `kraken-abyss.4`, `kraken-abyss.5` and Krakatice Inkoustová                                                                                                                                                         |

**Standard and colloquial Czech** (ČJL-5-2-04) has no chapter of its own in this table of contents.
Pearl Sea teaches it at the end of Bouřlivé moře (`storm-sea.5`), after the verbs, because many
colloquial forms a child hears are verb forms and endings (_dělaj × dělají_, _dobrej × dobrý_).

## 7. Generator bounds

A skill names a generator and its parameters (`src/rules/contract/skills.ts`,
[contract.md](contract.md) §6); the generator draws words, forms and sentences from the lexicon of
the content pack (`src/rules/contract/lexicon.ts`, [contract.md](contract.md) §8). Skills must keep
every problem inside these bounds.

### 7.1 Rules for every generator

- **The curated lexicon only.** Every word, form and sentence comes from the lexicon: no word
  outside it, and no form that its paradigm does not give. The compound past, the future with
  _budu_ and the conditional are composed from the paradigm by rule (`formCells`,
  [contract.md](contract.md) §8.6). Every word and family names its sources.
- **Names only from the lexicon's proper nouns** (`noun.proper`: people, animals, towns, rivers,
  mountains, countries, seas, characters), never invented on the fly. A capital-letter gap
  (`velke-pismeno`) asks for the start of a sentence, a one-word name or a first name with a
  surname; multi-word names (_Severní moře_) appear without a gap. ÚJČ notes that names need not
  follow the spelling rules (_Mlynář_ and _Mlinář_), so a name never carries an _i/y_ gap unless
  it is a word of the school rhyme the content follows (§8.2).
- **Grade filters.** A word's or sentence's `grade` is the first grade that may see it. Skills of
  3rd-grade levels select `grades: [3]`; skills of 4th-grade levels may select `grades: [3, 4]`.
- **Sentences** are original (written for the game, never copied from a textbook or a workbook),
  at most 10 words (`MAX_SENTENCE_WORDS`) with at most 3 gaps (`MAX_SENTENCE_GAPS`), and use the
  words of a child's world and the sea.
- **2-4 options.** A gap offers 2-4 options with choice input (`choices`, `Gap.options`), and its
  letter-pad keys always include the answer.
- **Exactly one right answer.** No option is another accepted spelling: ÚJČ accepts both
  _umývadlo_ and _umyvadlo_, so such a word never carries a length gap. A sound-alike gap always
  has a sentence or a picture that decides it.
- **A mistake is really a mistake.** Lov chyb misspells exactly one token, with one of its gap's
  alternatives, and the wrong sentence never reads as another correct sentence: _Chci mít psa_
  cannot hide _mýt_, because _Chci mýt psa_ (I want to wash the dog) is correct too.
- **End marks, commas and conjunctions** are sentence gaps in Inkoustová věta and Lov chyb (rules
  `interpunkce` and `spojka`). An end-mark gap (`{.|?|!}`) sits in a sentence whose kind leaves one
  mark; a command or a wish, which may also end with a full stop, offers _!_ against _?_ only. A
  comma gap sits only before a conjunction that always takes one (_ale, protože, když, že_), never
  before _a_. A conjunction gap (`{a|ale|protože}`) offers only conjunctions that are wrong in that
  sentence: _Ryba nemá nohy, {ale|protože} umí plavat._
- **Colloquial words only where the register is taught.** A colloquial word (_dobrej, mlíko, bejt_)
  is never asked its gender, its forms or its spelling, and never stands in a sentence as if it were
  standard: word filters select standard words unless a register skill names `registers`
  ([contract.md](contract.md) §6), and a colloquial word may have no paradigm. In a sentence it
  appears only as the wrong option of a `spisovne` gap (`Ke snídani mám {mléko|mlíko}.`, 4th
  grade), whose sentence is standard Czech otherwise; in Lov chyb it is the word to find and fix.
- **Rule breakers stay out of their rule.** Loanwords that break a rule being taught never carry a
  gap for it (_kino_; the hard _di_ of _diktát_; _y_ after a both-way consonant in _systém_ or
  _fyzika_). Words whose spelling is disputed never carry a gap: ÚJČ advises schools not to mark
  _lyžina_ wrong next to _ližina_.
- **Hints show the strategy** (`Hint` in `src/rules/contract/problems.ts`,
  [contract.md](contract.md) §5.3): the school rhyme of the listed words, a related word (_mlýn →
  mlynář_), a test word (_hrad → hrady_), _ten, ta, to_, the case question, the pattern, or the
  rule.

### 7.2 Per generator

| Generator        | Activity           | Core bounds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spell.word`     | Krmení, battles    | One lexicon word with 1-3 gaps (`maxGaps`), each a spelling point whose rule the skill lists; 2-4 options (`choices`): two for a contrast (_i/y_, _ú/ů_, _d/t_, _mě/mně_, a capital or not), four for quality and length together (_i/í/y/ý_).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `spell.sentence` | Inkoustová věta    | One lexicon sentence of the grade with 1-3 gaps, filled one by one, 2-4 options each; a gap may cover a whole token (_odplavala_ against _od plavala_), an end mark or a conjunction (§7.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `spell.mistake`  | Lov chyb           | One lexicon sentence of the grade with exactly one wrong token; step 1 finds it, step 2 fixes it (2-4 options).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `classify`       | Určování           | One dimension of a word, a form or a sentence, in one of three contexts (below), from the dimensions of the grade (§7.3). It offers the skill's `values` in the dimension's school order (cases 1-7, parts of speech 1-10, patterns by gender), never shuffled; all ten parts of speech, all seven cases or all 14 patterns at once only from the lesson that completes the set onwards (`volcanic-vents.5`, `ice-sea.2`, `dark-trench.6`); earlier lessons offer the values they teach. A `form` skill may keep to some form groups (`cells`), and a `consonant` skill to some letters (`consonants`), sharing its activity with the other classes' letters so the answer varies. |
| `odd-one-out`    | Krmení, battles    | 3-6 words (usually 4); exactly one differs on the basis (a dimension, the word family, or listed against not listed) and the others share it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `relation`       | Krmení             | A word and 2-6 options (usually 3-4); exactly one is in the relation (`synonym`, `antonym`, `general`, `specific`, `coordinate`, `sound-alike`, `related`), and no other option is in that relation with the word.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `alphabet`       | Perlový náhrdelník | 3-10 words: in the 3rd grade first with different first letters, then with shared ones (_ch_ after _h_, _č_ after _c_); `order: 'rhyme'` threads only core listed families, in their rhyme `order` (§8.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `pairs`          | Pexeso             | 3-8 pairs of one kind: `family`, `synonym`, `antonym`, `general`, `sound-alike` (each word with a picture or gloss) and `plural` in both grades; `pattern` and `standard` in the 4th.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sort`           | Rybářské sítě      | 2-4 nets, the values of one dimension; 4-12 fish, each of which belongs in exactly one net. `context: 'word'` sorts words by a word dimension (or consonant letters by class: all 24, or the skill's `consonants`); `context: 'form'` sorts forms of the groups in `cells` by a form dimension (_plavu, plaval jsem, budu plavat_ into present, past and future).                                                                                                                                                                                                                                                                                                                  |
| `segment`        | Ulita slov         | 4th grade only. Words whose school segmentation is clear-cut, split into the roles of the lesson: the root (`moon-caves.1`), the prefix (`moon-caves.2`), the suffix (`moon-caves.3`), the ending (`moon-caves.4`), then all four (`moon-caves.5`); an empty ending is an empty shell.                                                                                                                                                                                                                                                                                                                                                                                             |
| `family`         | Slovní rodinka     | Pick 2-8 words of one family among 1-6 distractors; a sound-alike family sits beside its twin (_být_ beside _bít_); `kin` families, which share the root, are never each other's distractors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Contexts** ([contract.md](contract.md) §6.2). A `classify` problem looks at a word, a form or a
sentence, and each context can ask only some dimensions:

| Context    | Looks at                                                                                                                                                                                                                                                                                                               | Dimensions                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `word`     | a lexicon word on its own (its lemma), a consonant letter, or a highlighted part of a word                                                                                                                                                                                                                             | `pos`, `inflection`, `meaning-class`, `gender`, `gender-class`, `number`, `pattern`, `register`, `reflexive`, `consonant`, `segment` |
| `form`     | one form from a word's paradigm (`formCells`, [contract.md](contract.md) §8.6): a noun's `sg1`…`sg7` and `pl1`…`pl7`; a verb's `inf`, `pres1`…`pres6`, `fut1`…`fut6` (_budu_ with the infinitive, or the verb's listed `fut`), `past1`…`past6` (_plaval jsem_ … _plavali_), `imp2`, `imp4`, `imp5` and `cond1`…`cond6` | `number`, `case`, `person`, `tense`, `mood`, `verb-form`, `finiteness`                                                               |
| `sentence` | a token of an annotated sentence, or the sentence itself                                                                                                                                                                                                                                                               | `pos`, `gender`, `gender-class`, `number`, `case`, `person`, `tense`, `mood`, `member`, `sentence-kind`, `clauses`                   |

A form shared by several cells keeps only the values they agree on, so no problem asks what a form
cannot tell: _ryby_ (`sg2`, `pl1`, `pl4`, `pl5`) is never asked its number or case, and _vyletí_
(3rd person singular and plural) never its number. A `form` skill may keep to some form groups
(`cells`, `FORM_GROUPS`: `sg`, `pl`, `inf`, `pres`, `fut`, `past`, `imp`, `cond`; `null` for all),
in `classify` and in fishing nets alike. A skill uses `form` where a form from the paradigm is
enough and `sentence` where the sentence decides (the verb lessons are in §7.3).

### 7.3 What each grade may be asked

| Area                                           | 3rd grade                                                                                                                                                                                                                                                                        | 4th grade                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensions (`classify`, `sort`, `odd-one-out`) | `pos` of a word in its basic form, `inflection`, `meaning-class`, `gender` (`m`, `f`, `n`), `number`, `case`, `person`, `tense`, `finiteness`, `consonant`, `sentence-kind`, `clauses`                                                                                           | All of the 3rd grade, plus `pos` of a token in a sentence, `gender-class` (`ma`, `mi`, `f`, `n`), `pattern`, `mood`, `verb-form`, `reflexive` (`se`, `si`, `none`), `register`, `segment` and `member`                                                                                    |
| Gender                                         | _rod mužský, ženský, střední_ (`gender`), found with _ten, ta, to_; animacy is not asked                                                                                                                                                                                         | Adds animacy (`gender-class`): _mužský životný_ and _neživotný_, which the patterns need                                                                                                                                                                                                  |
| Cases                                          | The seven cases of a noun form (_rybou_) or of a noun in a sentence, named by number and question (_7. pád, s kým? s čím?_); never a pattern or an ending rule                                                                                                                   | The cases with the endings of the 14 patterns (`vzor` gaps: _o hradech, se stroji_)                                                                                                                                                                                                       |
| Patterns                                       | Never                                                                                                                                                                                                                                                                            | All 14 (§9.3)                                                                                                                                                                                                                                                                             |
| Verbs                                          | Person, number and tense of imperfective verbs (`aspects: ['impf']`) in the form groups `pres`, `past` and `fut`: present (_plavu_), past (_plaval jsem_) and the future with _budu_ (_budu plavat_), never an imperative or a conditional; the infinitive against a finite form | Adds perfective verbs, whose present forms are future (_vyletí_), simple and compound forms (_plavu, plaval × plaval jsem, budu plavat_), mood (indicative, imperative, conditional) and reflexive verbs (`reflexive`: _se_, _si_ or none)                                                |
| Aspect (_vid_)                                 | Never asked                                                                                                                                                                                                                                                                      | Never asked; the lexicon records it so that tenses are right                                                                                                                                                                                                                              |
| Spelling rules (`rules`, §9.6)                 | `vyjm`, `vyjm-prefix`, `obojetna-i`, `tvrda`, `mekka`, `dtn-mekke`, `de-te-ne`, `be-pe-ve-me`, `u-zacatek`, `u-predpona`, `u-uprostred`, `u-prejate`, `delka`, `parova`, `velke-pismeno`, `interpunkce`, `spojka`                                                                | Adds `bje-vje`, `mne`, `mne-zajmeno`, `predpona-predlozka`, `predpona-souhlaska`, `shoda`, `vzor`, `spisovne`                                                                                                                                                                             |
| Listed words                                   | Core families only (`core: true`)                                                                                                                                                                                                                                                | Core and extended families                                                                                                                                                                                                                                                                |
| Word structure                                 | Never by name: the root is only the part related words share                                                                                                                                                                                                                     | Prefix, root, suffix, ending                                                                                                                                                                                                                                                              |
| Sentence members                               | Never                                                                                                                                                                                                                                                                            | Subject and predicate, including an unexpressed subject (the predicate alone)                                                                                                                                                                                                             |
| Agreement                                      | Never                                                                                                                                                                                                                                                                            | The past-tense predicate with a bare subject (_holý podmět_); a subject of several nouns of different genders is left out                                                                                                                                                                 |
| Register                                       | Never                                                                                                                                                                                                                                                                            | Standard and colloquial: colloquial words (_dobrej, mlíko, bejt_) only in register skills, asked their register or paired with their standard twin (`registers`, [contract.md](contract.md) §6); in sentences the standard word against its colloquial twin (`spisovne` gaps in Lov chyb) |

**Verb lessons and their contexts.** Verb skills use `form` where a form from the paradigm is enough
and `sentence` where the sentence decides; whether a verb is reflexive belongs to the verb itself
(`word`):

| Lesson                                                        | Asks                        | Context                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ice-sea.3` (_Slovesa: osoba, číslo, čas_)                    | `person`, `number`, `tense` | `form` with `cells: ['pres', 'past', 'fut']` and `aspects: ['impf']`: the present, past and future of imperfective verbs (_plaveš, plaval jsem, budou plavat_); `sentence` where the sentence decides (_Včera jsme plavali._, where _jsme_ gives the person) |
| `ice-sea.4` (_Infinitiv a určitý tvar slovesa_)               | `finiteness`                | `form` with `cells: ['inf', 'pres', 'past', 'fut']`: the infinitive against the finite forms (_plavat × plavu, plaval_)                                                                                                                                      |
| `storm-sea.1` (_Osoba, číslo a čas sloves_)                   | `person`, `number`, `tense` | `form` with `cells: ['pres', 'past', 'fut']`, now with perfective verbs, whose present forms are future (_vyletí_), and the listed futures (_půjdu, poletím_); `sentence` where the sentence decides                                                         |
| `storm-sea.2` (_Tvary jednoduché a složené_)                  | `verb-form`                 | `form` with `cells: ['pres', 'past', 'fut']`: simple (_plavu, plaval, vyletí_) against compound (_plaval jsem, budu plavat_); the conditional, always compound, joins with mood (`storm-sea.3`, `kraken-abyss.5`)                                            |
| `storm-sea.3` (_Způsob oznamovací, rozkazovací, podmiňovací_) | `mood`                      | `form` with `imp` and `cond` and the indicative groups it needs (`cells: ['pres', 'past', 'fut', 'imp', 'cond']`): _plavu, plav, plaval bych_; `sentence` for a mood in its sentence (_Plav ke břehu!_)                                                      |
| `storm-sea.4` (_Zvratná slovesa_)                             | `reflexive`                 | `word`: whether a verb takes _se_, _si_ or no pronoun (_bát se, všimnout si, plavat_), in Určování, fishing nets and odd-one-out; a hidden pronoun only for verbs that exist with it alone, never _mýt (se)_ or _hrát (si)_, which exist both ways           |

Fishing nets may sort the same forms (`sort` with `context: 'form'` and the same `cells`), by tense
in `ice-sea.3` and by form or mood in `storm-sea.2` and `storm-sea.3`. The 3rd grade never shows an
imperative or a conditional (its form skills keep to `pres`, `past` and `fut`), and every future it
shows is composed with _budu_ (`aspects: ['impf']`); both arrive in the 4th grade. In composed
forms a reflexive verb's pronoun follows the auxiliary (_myl jsem se, budu se mýt, myl by se_).

## 8. Vyjmenovaná slova

The listed words are native words that write _y_ or _ý_ after a both-way consonant in their root
(exceptionally in a suffix: _brzy, slepýš, kopyto_), and the words related to them keep it (ÚJČ).
Every other native word writes _i_ or _í_ after a both-way consonant (rule `obojetna-i`: _bílý,
pivo_). There is no single canonical school list. ÚJČ: "Výběr slov v učebnicích není záležitostí
Ústavu pro jazyk český, ale jednotlivých autorů a nakladatelství." Its overview, based on the 1993
academic edition of the PČP, is the game's reference; the order of each school rhyme is a
publisher's convention.

### 8.1 The reference list

| Letter | ÚJČ reference list (prirucka.ujc.cas.cz/?id=100, PČP 1993)                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B      | být (→ bydlit, obydlí, obyvatel, byt, příbytek, nábytek, dobytek …), obyčej, bystrý, bylina, kobyla, býk, babyka; names: Bydžov, Přibyslav, Bylany, Hrabyně, Zbyněk |
| L      | slyšet, mlýn, blýskat se, polykat, vzlykat, plynout, plýtvat, lysý, lýtko, lýko, lyže, pelyněk, plyš, slynout, plytký, vlys; Volyně                                 |
| M      | my, mýt, myslit/myslet, mýlit se, hmyz, myš, hlemýžď, mýtit, zamykat, smýkat, dmýchat, chmýří, nachomýtnout se, mýto, mykat, mys, sumýš; Litomyšl, Kamýk            |
| P      | pýcha, pytel, pysk, netopýr, slepýš, pyl, kopyto, klopýtat, třpytit se, zpytovat, pykat, pýr, pýří/pýřit se, pyj; Chropyně, Pyšely, Spytihněv                       |
| S      | syn, sytý, sýr, syrový, syrý, sychravý, usychat, sýkora, sýček, sysel, syčet, sypat; Bosyně                                                                         |
| V      | vy, vykat, vysoký, výt, výskat, zvykat, žvýkat, vydra, výr, vyžle, povyk, výheň, cavyky, vyza; the prefix vy-/vý-; Vyškov, Výtoň                                    |
| Z      | brzy, jazyk, nazývat (se); Ruzyně                                                                                                                                   |

**There are none after F.** _F_ is a both-way consonant, but no native word writes _y_ after it
(ÚJČ: "vyjmenovaná slova po f v češtině nemáme"). Some textbooks list the loanword _fyzika_; the
game leaves it out. Želva Obojka still has eight shell plates, one for each both-way consonant,
_f_ among them.

### 8.2 How the game marks them

The lexicon's word families (`WordFamily` in `src/rules/contract/lexicon.ts`,
[contract.md](contract.md) §8.3) carry the listed
words:

- **`letter`** is the listed letter (`LISTED_LETTERS`: `b`, `l`, `m`, `p`, `s`, `v`, `z`, in school
  order); an ordinary family has `null`.
- **One family per word of the rhyme.** Where a rhyme names several words of one root (_být,
  bydlit, obyvatel, byt, příbytek, nábytek, dobytek_), each is a family of its own, headed by the
  rhyme word (`head`) with its related words (`role: 'related'`), and the families of one root list
  each other as `kin`, so they are never each other's distractors.
- **`core`** is `true` for the words of the school rhyme (the core list) and `false` for the words
  only the reference list has (the extended list).
- **`order`** is the 1-based position in its letter's school rhyme. The rhyme is a publisher's
  convention: the content follows one textbook series and names it among the family's sources
  (`src`). Extended families continue the numbering after the rhyme, in the reference list's order.
- **`soundAlike`** names the sound-alike family taught beside it (_bít_ beside _být_, §8.3).

The game uses the marks this way:

- 3rd-grade lessons use core families only (`core: true` in their word filters); extended families
  appear in the 4th grade (`obj.listed.grade4`), introduced as further listed words. The necklace
  in rhyme order (`alphabet` with `order: 'rhyme'`) threads core families only.
- What children do not need stays out of the lexicon: the anatomical _pyj_, and rare or archaic
  words such as _slynout, syrý, vlys, sumýš_ unless the followed textbook lists them.
- A name carries an _i/y_ gap only when the followed rhyme lists it (§7.1).
- Look-alikes that are not related never join a family: _mlít_ is not related to _mlýn_, nor
  _lišaj_ to _lysý_ (ÚJČ).
- `validateLexicon` ([contract.md](contract.md) §8.7) checks that every word of a listed family has
  a `vyjm` (or `vyjm-prefix`) _y_ or _ý_ after its letter, and that two words that differ only in
  _i/y_ are declared sound-alikes.

### 8.3 Sound-alike pairs

Only verified pairs are used (ÚJČ and pedagogical sources); a new pair needs a source before it
enters the lexicon. In Pexeso each word has a picture or a gloss; everywhere else a sentence decides
which word is meant.

In the lexicon (`relations.soundAlikes`, [contract.md](contract.md) §8.5) a side of a pair is a word
by its ID (`byyt`, `biit`) or, where the pair is between forms rather than basic forms, one form of
a word written out (`{ word, form }`, a form of the word's paradigm). The pair pyl × pil is
`["pyl", { "word": "piit", "form": "pil" }]` (_pil_ is the past of _pít_), my × mi is
`["my", { "word": "jaa", "form": "mi" }]` (_mi_ is a form of _já_), and vysel × visel pairs the past
forms of _vysít_ and _viset_:
`[{ "word": "vysiit", "form": "vysel" }, { "word": "viset", "form": "visel" }]`.

| Letter | Listed word    | Sound-alike | Meanings                                         |
| ------ | -------------- | ----------- | ------------------------------------------------ |
| B      | být            | bít         | to be × to beat                                  |
| B      | bydlo          | bidlo       | a dwelling × a pole (ÚJČ's own word-play)        |
| B      | dobýt          | dobít       | to conquer (a castle) × to charge (a battery)    |
| M      | mýt            | mít         | to wash × to have                                |
| M      | my             | mi          | we × (to) me (a form of _já_)                    |
| P      | pyl            | pil         | pollen × drank (a form of _pít_)                 |
| S      | sýrový, syrový | sírový      | of cheese, raw × of sulphur                      |
| V      | výr            | vír         | an eagle owl × a whirlpool (Vír Časoplet is one) |
| V      | výskat         | vískat      | to whoop × to ruffle someone's hair              |
| V      | vysel          | visel       | sowed (_vysít_) × hung (_viset_)                 |
| V      | výt            | vít         | to howl × to weave (a wreath)                    |

ÚJČ's language guide (IJP) confirms the two latest additions: _dobýt × dobít_ among the prefixed
verbs of _být_ and _bít_, and _vít_, whose entry notes "jiné je: _výt_".

**Rejected** as not genuine, and never used: _pýřit se_ × "pířit" and _zvykat_ × "zvikat"; the
second words do not exist.

## 9. Terminology and notation

The game shows the terms of Czech 3rd- and 4th-grade textbooks. The closed vocabularies behind them
are in `src/rules/contract/language.ts` ([contract.md](contract.md) §4.3), with ASCII IDs. Their
Czech names live in `content/catalogs/cs.content.json` ([contract.md](contract.md) §7.4): a value
`v` of a dimension `d` is `grammar.<d>.<v>` (`grammar.case.7`, `grammar.gender-class.mi`), a case's
question `grammar.case-question.<n>`, a spelling rule's hint `grammar.rule.<rule>`, a letter's
school rhyme `grammar.listed.<letter>`, a relation `grammar.relation.<relation>` and a part of a
word `grammar.segment.<role>`. The tables below list every value of those vocabularies in their
code order.

### 9.1 Letters and sounds

| Term on screen                     | Values                                                                                                            | `language.ts`                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| abeceda                            | a á b c č d ď e é ě f g h ch i í j k l m n ň o ó p q r ř s š t ť u ú ů v w x y ý z ž (42 letters; _ch_ after _h_) | `ALPHABET`                         |
| samohlásky krátké                  | a e i o u y                                                                                                       | `SHORT_VOWELS`                     |
| samohlásky dlouhé                  | á é í ó ú ů ý                                                                                                     | `LONG_VOWELS`                      |
| tvrdé souhlásky                    | h ch k r d t n                                                                                                    | `HARD_CONSONANTS` (`hard`)         |
| měkké souhlásky                    | ž š č ř c j ď ť ň                                                                                                 | `SOFT_CONSONANTS` (`soft`)         |
| obojetné souhlásky                 | b f l m p s v z                                                                                                   | `BOTH_WAY_CONSONANTS` (`both-way`) |
| vyjmenovaná slova po …             | b l m p s v z                                                                                                     | `LISTED_LETTERS`                   |
| párové souhlásky (znělá – neznělá) | b – p, d – t, ď – ť, z – s, ž – š, v – f, h – ch, g – k                                                           | `PAIRED_CONSONANTS`                |

Alphabetical order (`compareCzech`) is a school dictionary's: _ch_ follows _h_; _č, ř, š, ž_ are
letters of their own after _c, r, s, z_; the other accented letters (_á, ď, é, ě, í, ň, ó, ť, ú, ů,
ý_) sort with their base letter and only break ties; on a full tie, lower case comes first.

### 9.2 Parts of speech

The ten parts of speech (_slovní druhy_, `PARTS_OF_SPEECH`) in school order, by the number textbooks
give them. The first five inflect (_ohebné_, `INFLECTED_PARTS_OF_SPEECH`), the other five do not
(_neohebné_); `INFLECTION`: `inflected`, `uninflected`.

| No. | Slovní druh     | English       | ID       | Inflection |
| --- | --------------- | ------------- | -------- | ---------- |
| 1   | podstatná jména | nouns         | `noun`   | ohebné     |
| 2   | přídavná jména  | adjectives    | `adj`    | ohebné     |
| 3   | zájmena         | pronouns      | `pron`   | ohebné     |
| 4   | číslovky        | numerals      | `num`    | ohebné     |
| 5   | slovesa         | verbs         | `verb`   | ohebné     |
| 6   | příslovce       | adverbs       | `adv`    | neohebné   |
| 7   | předložky       | prepositions  | `prep`   | neohebné   |
| 8   | spojky          | conjunctions  | `conj`   | neohebné   |
| 9   | částice         | particles     | `part`   | neohebné   |
| 10  | citoslovce      | interjections | `interj` | neohebné   |

Generalised meaning (`MEANING_CLASSES`, ČJL-3-2-03): _děj_ (`action`, verbs), _věc_ (`thing`,
nouns), _okolnost_ (`circumstance`, adverbs), _vlastnost_ (`property`, adjectives).

### 9.3 Nouns

- **Gender** (_rod_): the 3rd grade asks the dimension `gender` (`GENDERS`: `m`, `f`, `n`;
  _mužský, ženský, střední_), found with the test words _ten, ta, to_ (hint `ten-ta-to`). The 4th
  grade adds the dimension `gender-class` (`GENDER_CLASSES`: `ma`, `mi`, `f`, `n`; _mužský
  životný, mužský neživotný, ženský, střední_): the animacy (_životnost_) that the patterns need. A
  sentence token records the class with animacy, and its `gender` is derived from it.
- **Number** (_číslo_, `NUMBERS`): _jednotné_ (`sg`), _množné_ (`pl`). A noun has both numbers or
  only one (`NOUN_NUMBERS`: `both`, `sg`, `pl`); plural-only nouns are _pomnožná_ (_nůžky_).
- **Cases** (_pády_, `CASES` 1-7) with their questions (`CASE_QUESTIONS`):

| Pád    | Pádová otázka      |
| ------ | ------------------ |
| 1. pád | kdo? co?           |
| 2. pád | koho? čeho?        |
| 3. pád | komu? čemu?        |
| 4. pád | koho? co?          |
| 5. pád | oslovujeme, voláme |
| 6. pád | o kom? o čem?      |
| 7. pád | s kým? s čím?      |

- **The 14 patterns** (_vzory_, `NOUN_PATTERNS`, with `PATTERN_GENDER` and `PATTERN_WORD`), grouped
  by gender:

| Rod                     | Vzory                      | IDs                                |
| ----------------------- | -------------------------- | ---------------------------------- |
| mužský životný (`ma`)   | pán, muž, předseda, soudce | `pan`, `muz`, `predseda`, `soudce` |
| mužský neživotný (`mi`) | hrad, stroj                | `hrad`, `stroj`                    |
| ženský (`f`)            | žena, růže, píseň, kost    | `zena`, `ruze`, `pisen`, `kost`    |
| střední (`n`)           | město, moře, kuře, stavení | `mesto`, `more`, `kure`, `staveni` |

The school order of the masculine patterns is _pán, hrad, muž, stroj, předseda, soudce_ (the
order of `NOUN_PATTERNS`). The hard patterns (`HARD_PATTERNS`: _pán, hrad, žena, město_) write _y_
in the endings where the soft ones write _i_: _s pány × s muži_, _s hrady × se stroji_, _s městy ×
s moři_. Irregular nouns (_dítě, člověk, oko_) have no pattern (`pattern: null`) and are never
asked for one.

### 9.4 Verbs

| Category               | Czech terms                                         | IDs                                                             |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| osoba                  | 1., 2., 3. osoba                                    | `PERSONS`: `1`, `2`, `3`                                        |
| číslo                  | jednotné, množné                                    | `NUMBERS`: `sg`, `pl`                                           |
| čas                    | minulý, přítomný, budoucí                           | `TENSES`: `past`, `present`, `future`                           |
| způsob                 | oznamovací, rozkazovací, podmiňovací                | `MOODS`: `indicative`, `imperative`, `conditional`              |
| tvar                   | jednoduchý, složený (_píše × psal jsem, bude psát_) | `VERB_FORMS`: `simple`, `compound`                              |
| tvar určitý a neurčitý | určitý tvar × infinitiv (neurčitý tvar)             | `VERB_FINITENESS`: `finite`, `infinitive`                       |
| zvratná slovesa        | se, si (or none: _plavat_)                          | `REFLEXIVES`: `se`, `si`; the dimension `reflexive` adds `none` |
| vid (never asked)      | nedokonavý, dokonavý                                | `ASPECTS`: `impf`, `pf`                                         |

**Agreement** (_shoda přísudku s podmětem_, rule `shoda`) lives in the past participle, recorded by
gender and number (`PAST_KEYS`: `m`, `f`, `n`, `ma`, `mi`, `fpl`, `npl`): masculine animate
plural _-i_ (_psi štěkali_), masculine inanimate and feminine plural _-y_ (_stromy rostly, kočky
mňoukaly_), neuter plural _-a_ (_kuřata pípala_); _děti_ agrees as a feminine plural (_děti si
hrály_).

### 9.5 Words and sentences

| Area                       | Czech terms                                                                            | IDs                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| stavba slova               | předpona, kořen, přípona, koncovka                                                     | `SEGMENT_ROLES`: `prefix`, `root`, `suffix`, `ending`                                                 |
| význam slov                | slova souznačná, protikladná, nadřazená, podřazená, souřadná, stejně znějící, příbuzná | `WORD_RELATIONS`: `synonym`, `antonym`, `general`, `specific`, `coordinate`, `sound-alike`, `related` |
| spisovná čeština           | spisovná, nespisovná                                                                   | `REGISTERS`: `standard`, `colloquial`                                                                 |
| vlastní jména              | jména osob, zvířat, měst a obcí, řek, hor, států, moří, postav                         | `PROPER_KINDS`: `person`, `animal`, `town`, `river`, `mountain`, `country`, `sea`, `character`        |
| druhy vět                  | oznamovací, tázací, rozkazovací, přací                                                 | `SENTENCE_KINDS`: `statement`, `question`, `command`, `wish`                                          |
| věta a souvětí             | věta jednoduchá, souvětí                                                               | `CLAUSE_STRUCTURES`: `simple`, `compound`                                                             |
| základní skladební dvojice | podmět, přísudek (any other word: neither)                                             | `SENTENCE_MEMBERS`: `subject`, `predicate`, `other`                                                   |

### 9.6 Spelling rules

Every spelling point of the lexicon and every sentence gap names the rule that decides it
(`SPELLING_RULES`, 25 rules, [contract.md](contract.md) §4.3); hints (`grammar.rule.<rule>`),
distractors and item IDs ([contract.md](contract.md) §5.4) build on it.

| Rule                 | School wording                          | What decides the spelling                                                  | Example                                                        | Grade |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ----- |
| `vyjm`               | vyjmenované slovo, slovo příbuzné       | a listed word or a word related to it                                      | _bydlet, mlýn, pytel_                                          | 3     |
| `vyjm-prefix`        | předpona vy-/vý-                        | the prefix _vy-/vý-_                                                       | _vyletět, výlet_                                               | 3     |
| `obojetna-i`         | i po obojetné souhlásce                 | _i_ after a both-way consonant in a word that is not listed                | _bílý, pivo_                                                   | 3     |
| `tvrda`              | y po tvrdé souhlásce                    | _y_ after a hard consonant                                                 | _ryba, kytka_                                                  | 3     |
| `mekka`              | i po měkké souhlásce                    | _i_ after a soft consonant                                                 | _čížek, šipka_                                                 | 3     |
| `dtn-mekke`          | di, ti, ni                              | _di, ti, ni_ pronounced soft                                               | _dítě, ticho, nikdo_                                           | 3     |
| `de-te-ne`           | dě, tě, ně                              | _dě, tě, ně_                                                               | _děti, tělo, něco_                                             | 3     |
| `be-pe-ve-me`        | bě, pě, vě, mě                          | _bě, pě, vě, mě_ inside a word                                             | _oběd, pěna, věda, město_                                      | 3     |
| `bje-vje`            | bje, vje                                | _bje, vje_ where a prefix meets the root                                   | _objet, vjezd_                                                 | 4     |
| `mne`                | mně uvnitř slova                        | _mně_ inside a word, against _mě_                                          | _zapomněl_                                                     | 4     |
| `mne-zajmeno`        | mně, nebo mě?                           | the pronoun _já_: _mně_ in the 3rd and 6th case, _mě_ in the 2nd and 4th   | _Dej to mně. Vidíš mě?_                                        | 4     |
| `u-zacatek`          | ú na začátku slova                      | _ú_ at the start of a word                                                 | _úkol_                                                         | 3     |
| `u-predpona`         | ú po předponě                           | _ú_ after a prefix                                                         | _neúplný_                                                      | 3     |
| `u-uprostred`        | ů uvnitř a na konci slova               | _ů_ inside or at the end of a word                                         | _dům, domů_                                                    | 3     |
| `u-prejate`          | ú ve slovech přejatých a citoslovcích   | _ú_ in borrowed words and interjections                                    | _múza, vrkú_                                                   | 3     |
| `delka`              | krátká, nebo dlouhá samohláska          | a short or a long vowel                                                    | _pila × píla_                                                  | 3     |
| `parova`             | párová souhláska                        | a paired consonant, checked by a test word                                 | _hrad → hrady_                                                 | 3     |
| `velke-pismeno`      | velké písmeno                           | a capital letter: the start of a sentence or a proper name                 | _Vltava_                                                       | 3     |
| `predpona-predlozka` | předpona, nebo předložka?               | a prefix is written together, a preposition apart                          | _odplavala × od mola_                                          | 4     |
| `predpona-souhlaska` | souhláska na hranici předpony           | the consonant where a prefix meets the root                                | _odtáhnout, rozzlobit_                                         | 4     |
| `shoda`              | shoda přísudku s podmětem               | agreement of the past-tense predicate with its subject                     | _psi štěkali, kočky mňoukaly_                                  | 4     |
| `vzor`               | koncovka podle vzoru                    | an ending decided by the noun pattern                                      | _o hradech, se stroji_                                         | 4     |
| `interpunkce`        | znaménko na konci věty, čárka v souvětí | the end mark by the kind of sentence (. ? !) and the comma between clauses | _Kde je mušle? Plav ke břehu! Ryba nemá nohy, ale umí plavat._ | 3     |
| `spojka`             | spojka v souvětí                        | the conjunction that joins clauses                                         | _a, ale, protože, když_                                        | 3     |
| `spisovne`           | spisovné slovo                          | the standard word in a sentence, not its colloquial twin                   | _Ke snídani mám mléko_ (not _mlíko_)                           | 4     |

### 9.7 Notation

- A case is named by its number and question (_3. pád, komu? čemu?_); the Latin case names are not
  shown.
- Parts of speech are named in full and, where textbooks number words, by their number (1-10).
- Patterns are shown by their pattern word (_hrad_) and genders in words (_rod mužský životný_);
  IDs are never shown.
- The answer buttons of a classification keep the dimension's school order (_1. pád_ to _7. pád_,
  the parts of speech 1-10, the patterns by gender) and are never shuffled, so each value keeps its
  place on screen.
- Contrasting words stand on either side of ×, as Czech textbooks write them (_být × bít_); letter
  choices take a slash (_i/y_, _ú/ů_, _mě/mně_).
- A gap is an ink blot on screen; in this document it is `_` (`b_t`, `ml_n`). Sentence gaps are
  written `{correct|alternative}` in the lexicon ([contract.md](contract.md) §8.4), end marks and
  conjunctions too (`{.|?|!}`, `{a|ale|protože}`).
- The letter pad offers the letters a gap is about: _i í y ý_, _ú ů_, _d t_, _ě je_, a capital
  and a small letter.
- Read-aloud uses the device's local Czech voices only. It reads words as they are spoken, which
  gives nothing away for _i/y_, _ú/ů_, the paired consonants or _mě/mně_ and supports vowel length
  and _dě, tě, ně_ as the school's listening exercises do; it never spells out a gap's answer.
- Czech catalog text uses Czech typography („…“, the en dash, the ellipsis), which
  `scripts/validate-content.mjs` enforces.

## 10. Glossary (Czech – English)

For the English switch of the grown-ups' area: every school term the game uses, with the English
used there.

| Czech                                       | English                                           |
| ------------------------------------------- | ------------------------------------------------- |
| abeceda                                     | alphabet                                          |
| řazení podle abecedy                        | alphabetical order                                |
| hláska                                      | speech sound                                      |
| písmeno                                     | letter                                            |
| slabika                                     | syllable                                          |
| samohláska krátká, dlouhá                   | short vowel, long vowel                           |
| souhláska                                   | consonant                                         |
| tvrdé souhlásky                             | hard consonants                                   |
| měkké souhlásky                             | soft consonants                                   |
| obojetné souhlásky                          | both-way consonants                               |
| párové souhlásky                            | paired consonants                                 |
| souhláska znělá, neznělá                    | voiced, voiceless consonant                       |
| velké písmeno                               | capital letter                                    |
| vlastní jméno                               | proper name                                       |
| vyjmenovaná slova                           | listed words                                      |
| slova příbuzná                              | related words                                     |
| slovní rodina                               | word family                                       |
| slova stejně znějící                        | sound-alike words                                 |
| slova souznačná (synonyma)                  | synonyms                                          |
| slova protikladná (antonyma)                | antonyms                                          |
| slova nadřazená                             | general words                                     |
| slova podřazená                             | specific words                                    |
| slova souřadná                              | coordinate words                                  |
| slova mnohoznačná (vícevýznamová)           | words with several meanings                       |
| nauka o slově                               | word meaning                                      |
| stavba slova                                | word structure                                    |
| kořen                                       | root                                              |
| předpona                                    | prefix                                            |
| přípona                                     | suffix                                            |
| koncovka                                    | ending                                            |
| předložka                                   | preposition                                       |
| morfologický šev                            | morpheme seam (where a prefix meets the root)     |
| slovní druhy                                | parts of speech                                   |
| ohebné, neohebné slovní druhy               | inflected, uninflected parts of speech            |
| podstatné jméno                             | noun                                              |
| přídavné jméno                              | adjective                                         |
| zájmeno                                     | pronoun                                           |
| číslovka                                    | numeral                                           |
| sloveso                                     | verb                                              |
| příslovce                                   | adverb                                            |
| spojka                                      | conjunction                                       |
| částice                                     | particle                                          |
| citoslovce                                  | interjection                                      |
| děj, věc, okolnost, vlastnost               | action, thing, circumstance, property             |
| rod mužský, ženský, střední                 | masculine, feminine, neuter gender                |
| životný, neživotný                          | animate, inanimate                                |
| číslo jednotné, množné                      | singular, plural                                  |
| pomnožné podstatné jméno                    | plural-only noun                                  |
| pád                                         | case                                              |
| pádová otázka                               | case question                                     |
| skloňování                                  | declension                                        |
| vzor                                        | noun pattern                                      |
| tvrdý, měkký vzor                           | hard, soft pattern                                |
| osoba                                       | person                                            |
| čas minulý, přítomný, budoucí               | past, present, future tense                       |
| časování                                    | conjugation                                       |
| způsob oznamovací, rozkazovací, podmiňovací | indicative, imperative, conditional mood          |
| tvar jednoduchý, složený                    | simple, compound form                             |
| infinitiv (neurčitý tvar)                   | infinitive                                        |
| určitý tvar slovesa                         | finite verb form                                  |
| zvratné sloveso                             | reflexive verb                                    |
| vid nedokonavý, dokonavý                    | imperfective, perfective aspect                   |
| spisovná čeština                            | standard Czech                                    |
| nespisovná čeština                          | colloquial Czech                                  |
| věta                                        | sentence                                          |
| věta jednoduchá                             | simple sentence                                   |
| souvětí                                     | compound sentence                                 |
| věta oznamovací, tázací, rozkazovací, přací | statement, question, command, wish                |
| podmět                                      | subject                                           |
| přísudek                                    | predicate                                         |
| základní skladební dvojice                  | subject and predicate (the basic sentence pair)   |
| podmět nevyjádřený                          | unexpressed subject                               |
| holý podmět                                 | bare subject                                      |
| shoda přísudku s podmětem                   | subject-predicate agreement                       |
| spojovací výraz                             | connective                                        |
| pravopis                                    | spelling                                          |
| mluvnice                                    | grammar                                           |
| jazyková výchova                            | language education (grammar and spelling)         |
| ročník, třída                               | grade (school year)                               |
| očekávaný výstup                            | expected outcome                                  |
| učivo                                       | subject matter                                    |
| RVP ZV                                      | Framework Education Programme for Basic Education |
