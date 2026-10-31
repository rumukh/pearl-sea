# The Czech word bank (lexicon)

Every exercise in Perlové moře is built from one curated, annotated word bank: Czech words with the
facts an exercise needs (spelling points, families, part of speech, gender, pattern, paradigms,
segmentation, register, relations) and short original sentences with marked gaps. This document
describes the source files in [`content/lexicon-src/`](../content/lexicon-src/), their fields, the
school conventions they encode, how they were verified and what they cover. Linguistic correctness
is the first requirement: a children's spelling game with a wrong spelling, family or category is
worse than no game.

The source files are converted into the contract's lexicon schema (`docs/contract.md` §8, owned by
S1) inside the content pack by `scripts/lexicon/build.mjs` (§8, [content.md](content.md)), where the
content gate runs the contract's own linguistic checks as well.

## 1. Files and the checker

One JSON file per topic, UTF-8 without BOM, NFC, LF line endings. `vocabulary.json` holds the closed
vocabularies (alphabet and collation, letter classes, parts of speech, cases with their questions,
the 14 patterns, persons, tenses, moods, rules, the school lists of the vyjmenovaná slova),
`sources.json` the sources that entries cite and `paradigms.json` the paradigms of the nouns and
verbs whose topic file does not give one (§2.3).

| File                                        | Grade | Topic                                                                                                                                                                                                |
| ------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alphabet.json`                             | 3     | alphabet and alphabetical order (_ch_ after _h_; _č ř š ž_ as letters)                                                                                                                               |
| `vowels.json`                               | 3     | short and long vowels, minimal pairs (_pas – pás_)                                                                                                                                                   |
| `hard-soft.json`                            | 3     | hard and soft consonants, _dy ty ny_ and _di ti ni_                                                                                                                                                  |
| `e-caron.json`                              | 3, 4  | _dě tě ně_, _bě pě vě mě_; 4th grade _bje vje_, _mně_, the pronoun _mě/mně_                                                                                                                          |
| `u-ring.json`                               | 3     | _ú/ů_, including the loanword exception _medúza_                                                                                                                                                     |
| `paired-consonants.json`                    | 3     | paired consonants inside and at the end of words, each with its test word                                                                                                                            |
| `capitals.json`                             | 3     | capital letters in proper names                                                                                                                                                                      |
| `vyjmenovana-b.json` … `vyjmenovana-z.json` | 3     | all vyjmenovaná slova after B, L, M, P, S, V, Z with related words and _i_-contrast words                                                                                                            |
| `sound-alikes.json`                         | 3, 4  | _být – bít_ (and _byl – bil_, _byli – bili_), _bydlo – bidlo_, _mýt – mít_, _my – mi_, _pyl – pil_, _sýrový – sírový_, _výr – vír_, _výt – vít_, _výskat – vískat_, _vysel – visel_, _dobýt – dobít_ |
| `meaning.json`                              | 3     | synonyms, antonyms, general and specific words, words with several meanings                                                                                                                          |
| `parts-of-speech.json`                      | 3     | the ten parts of speech, in isolation and in context                                                                                                                                                 |
| `nouns.json`                                | 3     | gender, animacy, number and the seven cases in sentences                                                                                                                                             |
| `verbs.json`                                | 3, 4  | person, number, tense, infinitive; mood, simple and compound forms, reflexive verbs                                                                                                                  |
| `sentences.json`                            | 3, 4  | simple and compound sentences, subject and predicate, past-tense agreement                                                                                                                           |
| `noun-patterns.json`                        | 4     | the 14 patterns with typical nouns and full paradigms; endings by pattern                                                                                                                            |
| `word-structure.json`                       | 4     | prefix, root, suffix, ending; word families and look-alike words                                                                                                                                     |
| `prefixes.json`                             | 4     | prefixes versus prepositions; the prefixes _od- nad- pod- před- roz- bez-_                                                                                                                           |
| `register.json`                             | 4     | standard and colloquial words                                                                                                                                                                        |

`node scripts/lexicon/check.mjs` checks every invariant below and exits non-zero on a problem;
`--summary` prints coverage counts and `--dir <path>` checks another copy. It uses Node built-ins
only and runs as the `lexicon` step of `npm run verify`, so the gate fails on any problem; it also
confirms that the reading font (`assets/fonts/pearl-reading/provenance.json`) draws every character
a text may contain. `test/tooling/lexicon-check.test.ts`, in the gate's Vitest step, proves the
checker: it injects each kind of fault into a copy of the word bank (a vyjmenované word with _i_, a
wrong pattern or case, a wrong agreement ending, a sentence over ten words, a text that is not NFC,
a missing paradigm or irregular future, an ambiguous point without its sentence, a broken file, …)
and expects it to be reported, and it checks the exit codes.

## 2. Words

A word entry is one lexeme. The same ID may appear in several topic files, each adding the facts
its topic needs (a noun's paradigm in `noun-patterns.json`, its spelling points in a spelling topic);
the checker merges them and rejects any conflicting fact.

| Field                  | Meaning                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | content ID: the transliterated lemma (§2.1), plus `.<sense>` for a homograph                                                                                                  |
| `lemma`                | citation form, NFC; proper names capitalised; reflexive verbs with _se/si_                                                                                                    |
| `pos`                  | `noun adj pron num verb adv prep conj part interj`: the ten school parts of speech, in order                                                                                  |
| `grade`                | 3 or 4, the lowest grade that uses the word (defaults to the file's grade)                                                                                                    |
| `gender`, `animate`    | nouns: `m`, `f`, `n`; `animate` for masculine nouns                                                                                                                           |
| `numbers`              | nouns: `both` (default), `sg` or `pl` (_plavky_, _housle_, _děti_); `sg` for names and for mass, abstract and verbal nouns (_sůl, ticho, mytí_)                               |
| `pattern`              | nouns: one of the 14 patterns, absent for irregular nouns (_dítě_, _den_, _noha_, _oko_, _kůň_, _loď_)                                                                        |
| `proper`               | proper names: `person animal character town river mountain country sea` (the contract's kinds)                                                                                |
| `aspect`, `reflexive`  | verbs: `impf` or `pf`; `se` or `si`                                                                                                                                           |
| `paradigm`             | nouns and verbs (§2.3): every standard noun and verb has one                                                                                                                  |
| `forms`                | further inflected forms used in sentences; a noun's or verb's forms must be cells of its paradigm                                                                             |
| `spell`, `rules`       | spelling points (§2.2)                                                                                                                                                        |
| `family`, `role`       | the word family and `head` (the vyjmenované slovo or family head) or `member`                                                                                                 |
| `segments`, `prefix`   | word structure (§2.4)                                                                                                                                                         |
| `register`, `standard` | `colloquial` words name their standard twin                                                                                                                                   |
| `senses`               | short Czech glosses of a word with several meanings                                                                                                                           |
| `loan`                 | a loanword (_medúza_), for the _ú_ exception                                                                                                                                  |
| `tags`, `note`, `src`  | `sea` marks sea-themed words, `context` a word whose part of speech is decided only in a sentence (_ať_); `note` explains homographs and exceptions; `src` lists sources (§5) |

### 2.1 IDs

IDs match the content ID pattern `/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/`. A word ID is the lemma,
lowercased and transliterated so that every Czech minimal pair stays distinct: long vowels are
doubled (`á é í ó ú ý` → `aa ee ii oo uu yy`), `ů` → `uo`, letters with a caron take an `x`
(`č ď ě ň ř š ť ž` → `cx dx ex nx rx sx tx zx`), a space becomes `-`. So _být_ is `byyt`, _byt_ `byt`,
_bít_ `biit`, _mlýn_ `mlyyn`, _dítě_ `diitex`, _blýskat se_ `blyyskat-se`, _Jaderské moře_
`jaderskee-morxe`. A homograph gets a sense suffix and a `note`: the submarine _Bublinka_ is
`bublinka.ponorka`. The checker recomputes every ID.

### 2.2 Spelling points

`spell` is the lemma with every position a child must decide written as a gap
`{answer|alternative|…}`, and `rules` gives each gap's rule in order (a string, or an object with a
`test` word): `"spell": "ml{ý|í}n", "rules": ["vyjm"]`; `"spell": "hra{d|t}", "rules": [{ "rule":
"parova", "test": "hrady" }]`. Sentences use the same gap syntax (§4). The checker verifies each rule:

| Rule                 | Gap                                        | Checked                                                                                                                     |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `vyjm`               | _y/ý_ against _i/í_                        | the word belongs to a vyjmenovaná family and the gap follows that family's letter (b l m p s v z)                           |
| `vyjm-prefix`        | _y/ý_ of the prefix _vy-/vý-_              | the gap follows a word-initial _v_ (or _nev-_)                                                                              |
| `obojetna-i`         | _i/í_ against _y/ý_                        | it follows a both-way consonant and the word is not in a vyjmenovaná family                                                 |
| `tvrda`              | _y/ý_ against _i/í_                        | it follows _h ch k r d t n_                                                                                                 |
| `mekka`              | _i/í_ against _y/ý_                        | it follows _ž š č ř c j_                                                                                                    |
| `dtn-mekke`          | _i/í_ after _d t n_ read [ď ť ň]           | it follows _d t n_                                                                                                          |
| `delka`              | short against long vowel                   | the two are a length pair (_a/á … u/ú/ů, y/ý_)                                                                              |
| `de-te-ne`           | _ě_ against _e_                            | it follows _d t n_                                                                                                          |
| `be-pe-ve-me`        | _ě_ against _je_ (after _m_: against _ně_) | it follows _b p v m_                                                                                                        |
| `bje-vje`            | _je_ against _ě_                           | it follows the prefix _ob-_ or a word-initial _v-_                                                                          |
| `mne`                | _ně_ against _ě_ after _m_                 | it follows _m_; the base word has _mn_ or _men_ (_jemný – jemně_, _zapomenout – zapomněl_, _pomněnka_)                      |
| `mne-zajmeno`        | the pronoun _mě_ or _mně_                  | _mně_ in the 3rd and 6th case, _mě_ in the 2nd and 4th (the gap names its case)                                             |
| `u-zacatek`          | _ú_ against _ů_                            | the word starts with it                                                                                                     |
| `u-predpona`         | _ú_ after a prefix or the first part       | its `test` word (_úspěch_, _úhel_) starts with _ú_ and matches the rest of the word                                         |
| `u-uprostred`        | _ů_ against _ú_                            | it does not start the word                                                                                                  |
| `u-prejate`          | _ú_ inside a loanword                      | the word is marked `loan` (_medúza_)                                                                                        |
| `parova`             | a paired consonant against its pair        | it ends the word or precedes a consonant; the `test` word has the same consonant before a vowel (_ď_ is _d_ before _ě i í_) |
| `velke-pismeno`      | a capital against a small letter           | the word is a proper name                                                                                                   |
| `predpona-predlozka` | together against apart                     | the two differ only by the space; a prefix is the word's `prefix`, a preposition is in the word bank                        |
| `predpona-souhlaska` | _d/z_ against _t/s_ ending a prefix        | the gap ends one of _od- nad- pod- před- roz- bez-_, the word's `prefix`                                                    |
| `shoda`              | past-tense ending _-i/-y/-a_               | computed from the gap's subjects (§4.2)                                                                                     |
| `vzor`               | a noun ending                              | the form is in the paradigm cell of the gap's case and number; the alternative is not                                       |
| `spisovne`           | a standard against a colloquial word       | the alternative is a form of a colloquial twin of the standard word                                                         |

The last five rules need context and occur only in sentences. A word may carry several points with
different rules (_rybník_: `r{y|i}bn{í|ý}k` is `tvrda` and `dtn-mekke`); points in different files
must agree on the answer and the rule at a position, and their alternatives are merged.

**Points the word alone cannot decide.** An exercise offers a point's alternatives, or a letter pad
of its rule: _i í y ý_ for the _i/y_ rules and `vzor`, _e é ě je_ for the _ě_ rules, _u ú ů_ for
the _ú/ů_ rules, the vowel's short and long form for `delka`, the consonant pair for `parova`, the
small and capital letter for `velke-pismeno`, the gap's own alternatives otherwise. When one of
these spells another word or form of the bank (_být – bít_, _vila – víla_, _děti – dětí_, _dál –
dal_), the word alone cannot decide, so the game asks that point only in a sentence. The checker
lists these points (`model.ambiguous`, 28 now) and fails when one has no sentence with a gap on it.

### 2.3 Paradigms

Every standard noun and verb has a paradigm, in its topic file (the patterns and verbs topics) or
in `paradigms.json` (451 more); only a colloquial word may leave it out, because it appears only as
a whole word in register exercises. A cell is a form, or a list of equally standard forms with the
usual one first (`["pánovi", "pánu"]`).

A noun's `paradigm` is `{ "sg": [7 cases], "pl": [7 cases] }`, with exactly the numbers `numbers`
names. The first nominative form is the lemma.

A verb's `paradigm` is `{ inf, pres, imp, past, fut? }`: the six present forms (1st-3rd person
singular, then plural; for a perfective verb these express the future: _skočí_), the imperative
(2nd singular, 1st and 2nd plural) and the past participle `{ m, f, n, ma, mi, fpl, npl }`
(_plaval, plavala, plavalo, plavali, plavaly, plavaly, plavala_). The rest is composed by rule: the
past tense (_plaval jsem_), the future of imperfective verbs (_budu plavat_), the conditional
(_plaval bych_). `fut` lists the six future forms of the imperfective verbs whose future is not
_budu_ + infinitive, and the checker requires it for them: _být – budu, jít – půjdu, nést – ponesu,
plout – popluji, letět – poletím, lézt – polezu_. Reflexive verbs keep their paradigm without
_se/si_.

The paradigms in `paradigms.json` were drafted from the primary forms of MorfFlex CZ 2.0 (§5) and
reviewed cell by cell; MorfFlex's contracted, archaic and colloquial variants were left out. The
choices where sources offer several standard forms:

- verbs: _-uji, -ji_ before _-uju, -ju_ in the 1st person singular (_děkuji, děkuju_), only _-ují,
  -jí_ in the 3rd plural; _hraji_ and _směji se_ first; the short participle of _-nout_ verbs first
  (_sykl, syknul_); _bydlel_ and _bydlil_; _vymyslet_ with _-el_;
- nouns: _hadi, medvědi, lachtani, mývali, sysli_ before _-ové_; _úmyslu_; both 6th-case forms of
  _korál, úkryt, pobyt, podpis, nadpis, rozkaz, ocas_ (_korále, korálu_); _chléb_ (not _chleba_) in
  the 1st and 4th case;
- irregular nouns written by hand from IJP and the school grammar: _den_ (_dne, dni, dnem; dny,
  dnů_), _dítě_ (plural _děti_), _oko_ (_oči, očí, očima_), _noha_ (_nohou, nohama_), _hlemýžď_ (1st
  plural _hlemýždi_ as _muži_, 4th _hlemýždě_), and the singular-only names _Jaderské moře_ and
  _Tichý oceán_.

### 2.4 Word structure

`segments` splits a lemma into `prefix`, `root`, `suffix` and `ending`. The suffix holds everything
between the root and the ending (the school's _příponová část_), an empty ending is a zero ending,
and the four pieces must rebuild the lemma: _podmořský_ is `pod | moř | sk | ý`, _rybář_ is
`ryb | ář | ∅`. Only nouns and adjectives with an unambiguous split are segmented; verbs carry just
their `prefix` (_odplavat_: `od`), because school books treat the infinitive _-t_ differently.

### 2.5 Families

A family is `{ id, letter, head, order, core, root, kin, soundAlikeOf, src }`:

- **Vyjmenovaná families** (`vyjm-<letter>.<head>`) have the letter, the vyjmenované slovo as head
  and its `order` in the school list. The core families of each letter must equal
  `vocabulary.json` `schoolLists` exactly, in order (B 13, L 13, M 14, P 14, S 11, V 11, Z 4).
  `schoolListTies` lists positions that textbooks order differently (_lýtko, lýko_); an ordering
  exercise never puts tied words in one necklace.
- **Ordinary families** (`fam.<head>`, letter `null`): the _bít_, _mlít_, _mít_ and _vír_ families
  that sit beside their sound-alikes (`soundAlikeOf`), and the word families of the 4th grade.
- `kin` groups families that share, or may share, a root (_být, bydlit, obyvatel, byt, příbytek,
  nábytek, dobytek_ are all from _být_; _sýček_ and _syčet_ may be). Kin families are never each
  other's distractors; families known to be unrelated (_lýtko, lýko_; _pýr, pýřit se_; _sychravý,
  usychat_) are not kin.
- Every member of a vyjmenovaná family has its `vyjm` spelling point.

### 2.6 Sets

`sets` hold relations between words: `alphabet` (words in Czech alphabetical order, checked by the
collation with no ties at the primary level), `synonyms`, `antonyms` (one part of speech),
`hyponyms` (`general` and `specific` nouns), `sound-alikes` (forms that differ only in _i/y_),
`minimal-length` (forms that differ only in one vowel's length) and `lookalikes` (words that look
like members of a family but are not related: _vodítko_ is from _vodit_, _rybíz_ is not from _ryba_).

## 3. School conventions

The data follows what Czech textbooks for the 3rd and 4th grade teach. Where textbooks differ, the
data avoids the disputed case rather than picking a side.

- **Alphabet.** 42 letters with _ch_ after _h_. Ordering compares the primary letters (_č ř š ž ch_
  are letters of their own; other diacritics fold), and no set needs the secondary rules.
- **Consonants.** Hard _h ch k r d t n_, soft _ž š č ř c j ď ť ň_, both-way _b f l m p s v z_. After
  _d t n_ the pronunciation decides (_ticho_ [ťicho], _ty_).
- **Vyjmenovaná slova.** The core school lists in the usual order; the extended words of PČP 1993
  (_babyka, slynout, mýto, mys, vyza, cavyky …_) are not used. Related words follow IJP's list.
  _mlít_ is not related to _mlýn_ (IJP), and words like _brzký_ that lose the _y_ of _brzy_ are not
  in a family.
- **ú/ů.** _ú_ at the start and after a prefix, _ů_ inside and at the end; _medúza_ is the loanword
  exception the game's Medúzka shows.
- **Paired consonants.** The test word puts a vowel after the consonant (_hrad – hrady_, _loď – lodě_).
- **Capital letters.** A common noun before a name stays small: _pes Alík, ponorka Bublinka,
  profesorka Osmička_ (IJP). In the names of seas, oceans, lakes and mountains the first word and
  any word that is itself a name are capitalised (_Jaderské moře, Tichý oceán, Vysoké Tatry_); in
  the names of towns every word except prepositions (_Karlovy Vary, Ústí nad Labem_). A pet's name
  is chosen so that its small-letter form is not a word (_papoušek Ferda_, not _kočka Micka_).
- **Cases.** The questions _kdo? co? / koho? čeho? / komu? čemu? / koho? co? / oslovujeme /
  o kom? o čem? / s kým? s čím?_ (`vocabulary.json`). Each case sentence marks one noun whose case
  is fixed by a preposition or the verb. A form can belong to several cases (_ostrovu_ is the 3rd
  and the 6th); the checker confirms the marked case is one of them, the sentence decides.
- **Verbs.** Tense exercises use imperfective verbs; perfective ones (_skočí, najdu_) are marked as
  future. A form is compound when it has an auxiliary (_plaval jsem, budu plavat, plaval bych_);
  the reflexive _se/si_ does not count (_smál se_ is simple, _smál jsem se_ compound).
- **Clauses.** A sentence has as many clauses as predicates. Sentences with several predicates of one
  subject (_krab se schoval a čeká_) are left out, because children would count them as compound
  sentences. Traps with several subjects (_Delfín a želva plavou_) are simple sentences. Every marked
  predicate is a single finite verb (no _je teplá_, no reflexive _se schovala_), so tapping the
  predicate has exactly one right answer.
- **Agreement.** Any masculine animate subject gives _-i_; neuter plural subjects only give _-a_;
  otherwise _-y_ (IJP). _děti_ take _-y_ (_děti si hrály_), _lidé_ _-i_. Subjects always precede the
  predicate, because IJP allows both endings when the predicate comes first.
- **Register.** Only clear _obecná čeština_ forms are colloquial (_vokno, mlíko, dobrej, bejt_);
  _hovorová_ words that textbooks rate differently (_táta, kluk, fotka_) are not used.
- **Meaning.** Sharks are not in the set of fish (they are _paryby_ in biology). Words with several
  meanings keep one gender and animacy across their senses (_kohoutek_ is left out). The sole
  (_jazyk_) is animate as a fish; its grammar facts describe the body part and the language.
- **Sentences.** Original, at most 10 words, sea-themed where natural, never scary; no textbook
  exercise is copied. In a gap sentence the other answer does not fit the sentence's meaning.

### 3.1 For the story and catalogs (Phase B)

The characters' names follow the capital-letter rule above: in running text it is _vydra
Výskalka, krab Tvrďák, medúzka Měkulka, profesorka Osmička, mrož Vousáč, krakatice Inkoustová_
(lowercase species, capital name), as in _liška Ryška_ or _motýl Emanuel_ (IJP 181); a name card
or title may start with a capital as any title does. Region names are proper names with one
capital (_Slunná laguna, Korálový útes, Perlové moře_).

## 4. Sentences

A sentence is `{ id, text, grade, topics, gaps, marks, clauses, note }`. `text` is one sentence of at
most 10 words that starts with a capital and ends with `.`, `!` or `?`; it uses only letters, digits
and Czech punctuation available in the reading font.

### 4.1 Gaps

A gap is written inline as `{answer|alternative|…}`: `Ml{ý|í}n stojí u zátoky.`; one word may hold
several gaps (`r{y|i}bn{í|ý}k`), and a together/apart gap spans the space (`{odplavala|od plavala}`).
`gaps` lists one record per gap in order: `{ rule, word, test?, case?, number?, subjects? }`. The
checker finds the word that holds the gap, confirms it is a form of `word` (its lemma, paradigm or
`forms`) and applies the rule's check (§2.2). Every gap sentence also serves the mistake hunt (Lov
chyb): show one gap's alternative and let the child find it.

### 4.2 Agreement

A `shoda` gap names its subjects: `{ "rule": "shoda", "word": "plavat", "subjects": [{ "t": "Delfíni",
"word": "delfiin" }, { "t": "želvy", "word": "zxelva" }] }`. Each subject is a word of the sentence
before the predicate, in its nominative plural (or several subjects); the checker computes the
ending and compares it with the answer.

### 4.3 Marks

`marks` annotate words in context: `{ t, word, pos, case, number, person, tense, mood, gender,
compound, role }`. `t` is the word as written; the checker confirms it is a form of `word`, that
`pos` matches the word's part of speech and that a marked case and number is the right paradigm
cell. A mark on a compound verb form describes the whole form (_jsme plavali_: 1st person plural,
past, compound). `role` is `subject` or `predicate`; `clauses` must equal the number of marked
predicates.

## 5. Sources and verification

`sources.json` lists every source an entry cites in `src`:

| ID                                                                          | Source and what it certifies                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ijp-100`                                                                   | IJP: _Vyjmenovaná slova_ (PČP 1993): the families and their related words                                |
| `ijp-101`, `ijp-103`, `ijp-126`, `ijp-127`, `ijp-181`, `ijp-601`, `ijp-650` | IJP articles: _být – bít_, _i/y_, _ě_, _ú/ů_, capital letters, agreement, _mě/mně_                       |
| `ijp`, `ssc`, `ssjc`, `pcp-1993`                                            | the IJP dictionary, SSČ, SSJČ and the Pravidla for spellings, meanings and register                      |
| `school-list`                                                               | the school lists and their order in common 3rd-grade textbooks                                           |
| `morfflex`                                                                  | MorfFlex CZ 2.0: the form, part of speech, gender, animacy, aspect and every paradigm cell were verified |
| `derinet`                                                                   | DeriNet 2.1: derivational families (a secondary check; IJP wins where they differ)                       |

**Machine verification.** `scripts/lexicon/morfflex-verify.py` checks the whole bank against the
MorfFlex CZ 2.0 morphological dictionary of Charles University (ÚFAL) through MorphoDiTa. It needs
`pip install ufal.morphodita` and the Czech model from <http://hdl.handle.net/11234/1-4794>
(CC BY-NC-SA; downloaded locally, never committed or shipped); nothing from it is copied into the
word bank. It reports lemmas MorfFlex does not know, part of speech, gender and animacy, aspect,
every paradigm cell including `paradigms.json` and the `fut` forms (and standard forms a cell leaves
out; MorfFlex's dual _očima, nohama_ counts as plural), unknown words in sentences, gap
alternatives that are also real words, marks MorfFlex cannot confirm, whether colloquial words are
non-standard, and DeriNet roots of family members and look-alikes. The final run (766 words, 529
sentences) found no unknown lemma or sentence word. The only paradigm cells outside MorfFlex are
the capitalised names _Bublinka_ and _Osmička_ (MorfFlex has the common nouns), the plurals of
_dítě_ and _oko_ (MorfFlex files them under the lemmas _děti_ and _oči_) and _hlemýždi_ (§2.3;
MorfFlex gives _hlemýždě_, the accusative). The remaining findings were reviewed:

- IJP's forms where MorfFlex lists others too: the vocative _pane_ (_páne_), _den_ (regular _denu,
  deny_), _nohama_ (_nohami_), _chléb_ (_chleba_);
- _hurá_ is an interjection by SSČ and the school convention, a particle in MorfFlex;
- _bydlit_ and _vymyslet_ are MorfFlex variants of _bydlet_ and _vymyslit_ (both standard);
- alternatives that are real words are asked only in sentences (§2.2: _byl/bil, výr/vír,
  oběd/objedu_) or are rare words a child does not know;
- DeriNet links _mlýn_ to _mlít_ and _bytový_ to _bajt_; IJP is followed.

The IJP dictionary forbids automated lookups (robots.txt), so it was consulted by hand only; the
verifier and the IJP articles did the systematic work. MorfFlex caught two errors during authoring
(_o racích_ → _o raccích_; the standard variants _lososové, krabové, útese, přístavě_).

**Human review.** Three independent expert reviews of the Czech (the vyjmenovaná families, the
3rd-grade spelling and meaning topics, the grammar topics) found no wrong spelling, form, family
membership, gender, pattern, aspect, case, agreement or clause count. Each of their 23 points about
meaning, facts, naturalness and conventions was checked and corrected, for example:

- facts: susliks hibernate instead of storing food; baleen whales eat krill, not _krevety_;
- ambiguous gaps: _bílá vila s bazénem_ and _mít odvahu_ replace sentences whose wrong answer also
  made sense (_bílá víla_, _mýt vlastní ponorku_);
- conventions: _kořen_ has no single pattern (it declines like _kámen_); _loď_ left the set whose
  general word is _plavidlo_; ships do not _objet_ an island; _piju_ and _potřebuju_ are not used in
  sentences for the mistake hunt.

## 6. Coverage

`node scripts/lexicon/check.mjs --summary` prints the current counts: 766 words, 91 families, 529
sentences (Phase A ended with 517), every grade-3 and grade-4 topic of the plan (§2). By region:

| Region            | Curriculum                                  | Data                                                                                                                       |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Slunná laguna     | review of the 2nd grade                     | alphabet (12 sets), vowels (17 sentences), hard and soft (38), _ě_ (27), _ú/ů_ (19), paired consonants (27), capitals (14) |
| Korálový útes     | after B, L                                  | 26 families, 97 words, 69 sentences                                                                                        |
| Chaluhový les     | after M, P                                  | 28 families, 76 words, 51 sentences                                                                                        |
| Pirátský vrak     | after S, V, Z                               | 26 families, 69 words, 65 sentences                                                                                        |
| Perlová zátoka    | all mixed, sound-alikes, meaning            | 13 sound-alike pairs (25 sentences), 11 synonym, 17 antonym, 9 general/specific sets, 14 words with several meanings       |
| Sopečné prameny   | parts of speech                             | 80 words, 17 sentences with every word tagged in context                                                                   |
| Ledové moře       | nouns, cases, verbs, sentences              | 28 case sentences, 28 verbs with paradigms and 16 grade-3 verb sentences, 13 clause sentences                              |
| Měsíční jeskyně   | word structure                              | 7 families, 31 segmented words, 3 look-alikes                                                                              |
| Potopené město    | prefixes and prepositions, _bje vje mně mě_ | 20 prefix sentences, 18 _ě_ sentences                                                                                      |
| Temný příkop      | the 14 patterns                             | 14 patterns, 71 nouns with full paradigms, 15 ending sentences                                                             |
| Bouřlivé moře     | verbs, standard and colloquial              | 14 verb sentences (mood, compound, reflexive), 15 colloquial words, 11 sentences                                           |
| Krakatičí propast | subject and predicate, agreement            | 7 subject/predicate sentences, 18 agreement sentences                                                                      |

## 7. Adding words

1. Add the word to the topic file, with the facts its exercises need and its `src`; a standard noun
   or verb also needs its paradigm (§2.3).
2. Add any inflected form a sentence uses to `forms` (or the paradigm).
3. Run `node scripts/lexicon/check.mjs`, then the MorfFlex verifier, and review every finding.
4. When unsure that a word is common, correct and unambiguous, leave it out.
5. Rebuild the pack: `node scripts/lexicon/build.mjs` ([content.md](content.md) §1).

## 8. In the content pack

`scripts/lexicon/build.mjs` builds `data.lexicon` of the content pack from the checked word bank,
in the contract's shape (contract.md §8; §8.8 maps this field set onto it):

- **Words**, sorted by ID, merged from every file that names them: noun facts nested in `noun`
  (`animate` for masculine nouns only, `pattern` `null` for an irregular noun), verb facts in
  `verb` (`reflexive` `null` for a plain verb), `family` as `{ id, role }` (`head` or `related`).
  A word of an alphabet set gets the tag `abc`, and of a set that tells _h_ from _ch_ (or _c_ from
  _č_, _r_ from _ř_, _s_ from _š_, _z_ from _ž_) also `abc-pairs`: what the necklace skills select.
- **Spelling points**: one per position of the lemma, `{ at, correct, alt, rule, test? }`, `at`
  counted in letters, `alt` every alternative any file gives there.
- **Segments**: `[role, text]` pairs; an empty prefix or suffix is left out, the zero ending of an
  inflected word kept.
- **Families**: `kin` lists the other families with the same kin label, and a sound-alike family
  names its partner both ways (`soundAlike`).
- **Sentences**: the text as written, with `{answer|alternative}` gaps; `gaps` with the `point` of
  the word each gap tests (the checker computes it); `tokens`, every word of the sentence, those of
  marks, gaps and agreement subjects described (word, part of speech, gender with animacy, case,
  number, person, tense, mood, member); `kind` from the end mark or the predicate's mood;
  `subjects`, `predicates`, `clauses` and `conjunctions` from the marks.
- **Relations** from the sets: synonym and antonym pairs, `hierarchies` from general and specific
  words, sound-alike pairs (a side names `{ word, form }` when it is not the lemma: _pil_ of
  _pít_).

Colloquial nouns and verbs keep no paradigm, and the contract's word filters select them only for
register skills. The content gate then validates the pack with the contract's own linguistic
checks (`validateLexicon`).
