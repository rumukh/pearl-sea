# Perlové moře: Game Design Document

This is the full design of v1, expanding the approved [plan](plan.md). The plan's decisions are
binding; where this document adds detail it says so. Numbers marked _(balance)_ live in the
content pack's `balance` block ([contract.md](contract.md) §7.3) and are tuned without code
changes. Objectives, RVP codes and textbook alignment are in [curriculum.md](curriculum.md). All IDs
are the S1 spec's (contract §4) and never change once shipped.

Perlové moře is Dragon Valley's sister game: the same Aegis SDK, architecture and learning engine.
Where the engine is the same, this document says "as in Dragon Valley" and keeps its rules and
numbers (Dragon Valley's `docs/design.md`, `docs/learning.md`, `docs/content.md`). New are the
subject, Czech grammar and spelling (_mluvnice a pravopis_), the sea and its creatures.

Audience: an 8-10-year-old Czech 3rd or 4th grader playing in Czech on a family tablet or PC, and
the parent who sets it up.

---

## 1. Pillars

1. **Learn for real.** The _jazyková výchova_ of the RVP ZV for grades 3 and 4: spaced retrieval
   of every spelling point of a curated word list, and the strategies a teacher teaches (the family
   word _mlýn → mlynář_, the test word _hrad → hrady_, the listed words' rhyme, _ten, ta, to_, the
   case question, the pattern).
2. **Joy every few seconds.** Every answer gets a reaction: a shrimp for a friend, a bubble at a
   monster, a chime, a splash. Activities change every few minutes.
3. **Visible growth.** Eggs hatch, sea friends grow up and get crowned, inky monsters turn back into
   friends, Bublinka dives deeper, and the Great Shell fills with shining pearls.
4. **Kind and safe.** As in Dragon Valley: no lives, no losing, no red X, no streak shaming, no ads,
   no purchases, no accounts, no network beyond the game's own files.
5. **Czech done right** (new). A spelling game must be spelled perfectly: every word is checked
   against reference works, praise agrees with the child (_Dokázal jsi to! / Dokázala jsi to!_),
   plurals are Czech (_1 mince, 3 mince, 5 mincí_), and _i, í, y, ý_ never look alike.

## 2. Story

**Premise** (the plan's). Every Czech word is a pearl in the **Velká lastura** (the Great Shell),
looked after by the octopus teacher **Profesorka Osmička**. One stormy night the giant **Krakatice
Inkoustová** squirted magic ink: pearls went dull, letters smudged (_i, or y?_), words fell apart,
eggs drifted away, and inked creatures became grumpy **sea monsters**. The child, the new **Lovec
perel** (Pearl Diver) in the yellow submarine **Bublinka**, polishes pearls, hatches eggs into sea
friends and washes the monsters clean. At the bottom the Krakatice's ten arms are washed, one
strand per arm; she was only lonely, and becomes the sea's guardian.

**Tone.** Exciting, never scary: monsters are grumpy and inky, never gory, and ink always washes
off. Every line is Czech, at most 10 words a sentence (the `@aegis/narrative` child profile,
enforced by the content gate as in Dragon Valley), and can be read aloud. The child's title follows
the form of address (§10.2): _Lovec perel_ for a boy, _Lovkyně perel_ for a girl, neutral lines
avoid the noun (_Teď lovíš perly ty!_).

### 2.1 Beats

Short skippable beats (2-4 lines), each a narrative graph started by a trigger, as in Dragon
Valley. An egg a beat gives is claimed in its first node, so skipping still gives it.

| Beat                          | Trigger                                    | Content                                                                |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `beat.prologue`               | first session                              | The storm, the ink, dull pearls, drifting eggs; Osmička asks for help  |
| `beat.first-egg`              | after the prologue (no skip)               | Three lagoon eggs; the child picks one (`chooseFirstFriend`)           |
| `beat.<region>-welcome` (×12) | first start of a region's lesson 1         | The region, a new friend's egg if any, the monster's ink               |
| `beat.sunny-lagoon-eggs`      | first start of the lagoon's lesson 3       | The two other lagoon eggs float back                                   |
| `beat.<monster>` (×12)        | first start of a monster level             | The monster grumbles, shows its ink trick and a first joke             |
| `beat.<monster>-freed` (×11)  | a monster freed (all but the Krakatice)    | The ink runs off; thanks; the gallery; the way onward opens            |
| `beat.san-ledana-freed`       | (one of the above)                         | The 3rd grade's finale: _3. třída hotová!_ and a certificate           |
| `beat.the-deep`               | first start of the Moon Caves' lesson 1    | Bublinka lights her lamps and dives into the deep                      |
| `beat.inkoustici`             | after Muréna Mumla's freed beat (optional) | Introduces the Inkoustíci, who arrive with `ambush.unlockAfter` (§7.4) |
| `beat.finale`                 | the Krakatice freed                        | She was lonely; now the guardian; the shell shines; credits            |

Triggers may carry `grades`; v1 gives both grades the same beats, and whether a 4th grader's
first-egg beat should differ is an open point (§4.1). A 4th grader meets `beat.the-deep` in the
first session (§9). The prologue's voice, one catalog key a line: _Hluboko pod vlnami leží Perlové
moře. · Každé slovo tu žije jako perla ve Velké lastuře. · Jedné bouřlivé noci vystříkla obří
krakatice kouzelný inkoust. · Perly zmatněly, písmenka se rozmazala a vajíčka uplavala. · Pomůžeš
mi je zachránit?_ (boy: _Pomůžeš mi, lovče perel?_, girl: _Pomůžeš mi, lovkyně perel?_).

### 2.2 Characters and sea friends

| ID            | Character          | Role and personality                                                    |
| ------------- | ------------------ | ----------------------------------------------------------------------- |
| `osmicka`     | Profesorka Osmička | Guide and teacher: eight arms, round glasses, patient; sings the rhymes |
| `mroz-vousac` | Mrož Vousáč        | Walrus captain, huge moustache; keeps U Mrože; gruff but soft-hearted   |
| `bublinka`    | Bublinka           | The child's yellow submarine; hums, blinks, fires the battle bubbles    |
| (the child)   | Lovec perel        | A name, an avatar (`diver-1` … `diver-8`), a form of address            |

The 18 **sea friends** are raised like Dragon Valley's dragons; each is the plan's memory hook:

| ID                   | Friend                 | Topic: memory hook (plan)                                                    |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `krab-tvrdak`        | Krab Tvrďák            | hard consonants _h ch k r d t n_ → _y_: a hard shell with seven hard spikes  |
| `meduzka-mekulka`    | Medúzka Měkulka        | soft consonants _ž š č ř c j ď ť ň_ → _i_: soft jelly, nine soft tentacles   |
| `zelva-obojka`       | Želva Obojka           | both-way consonants _b f l m p s v z_: in the sea and on the beach; 8 plates |
| `barakuda-bystrinka` | Barakuda Bystřinka     | after **B** (_bystrý_): the quickest fish of the reef                        |
| `lachtan-lyzar`      | Lachtan Lyžař          | after **L** (_lyže_): a sea lion who skis down the waves                     |
| `konik-mydlinek`     | Koník Mýdlínek         | after **M** (_mýt, mýdlo_): a seahorse blowing soap bubbles                  |
| `pyskoun-pysny`      | Pyskoun Pyšný          | after **P** (_pysk, pýcha_): a real wrasse with big, proud lips              |
| `jezik-sycik`        | Ježík Syčík            | after **S** (_syčet_): a porcupinefish that puffs up and hisses _sss_        |
| `vydra-vyskalka`     | Vydra Výskalka         | after **V** (_vydra, výskat_): the otter is itself a listed word             |
| `jazyk-jazycek`      | Jazyk Jazýček          | after **Z** (_jazyk_): the sole really is called _jazyk_ in Czech            |
| `hvezdice-rodinka`   | Hvězdice Rodinka       | word families: five arms, one heart; related words share a root              |
| `kalmar-desetiruky`  | Kalmar Desetiruký      | the 10 parts of speech: ten arms, one part of speech in each                 |
| `tulen-padik`        | Tuleň Pádík            | the 7 cases: slides (_padá_) down seven icy steps, one question on each      |
| `delfin-skokanek`    | Delfín Skokánek        | verbs: always doing something (_skáče, plave, hraje si_)                     |
| `rak-korinek`        | Rak poustevník Kořínek | word structure: the root lives inside; prefixes and suffixes are the shell   |
| `stitovec-prisavka`  | Štítovec Přísavka      | prefix or preposition: sticks to the shark like a prefix to its word         |
| `klipka-vzorna`      | Klipka Vzorná          | noun patterns: a butterflyfish covered in patterns (_vzory_)                 |
| `klauni-dvojcata`    | Klauni Dvojčata        | subject and predicate: twin clownfish who always swim together               |

**Second topics** (added here, so every lesson feeds a friend): Krab also has _dě tě ně, di ti ni_
(_d, t, n_ are his spikes) and paired consonants (he knocks on a word's end: _hrad → hrady_);
Medúzka short and long vowels (her tentacles stretch a sound) and _ú/ů_ (her round bell is the
little ring); Želva _bě pě vě mě_ (_b, p, v, m_ are on her plates), the alphabet and capital
letters (she has lived everywhere and knows every name); Hvězdice the meaning of words; the Klauni
the 3rd grade's sentences. They are simply part of these friends' skills (§6.5).

### 2.3 Monsters

Twelve monsters, painted `inked` (grumpy, smudged, a little spooky) and `freed` (clean, bright,
smiling), with real-animal anatomy (the plan's style test). Their jokes are catalog lines
(`monster.<id>.joke.<n>`), read aloud, and **never contain a misspelled word**.

| ID                       | Monster                | Inked: ink and mood                     | Joke style and sample                                        | Freed                        |
| ------------------------ | ---------------------- | --------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| `murena-mumla`           | Muréna Mumla           | sleepy, mumbles the ends of words       | half-words: _Proč mumlám? Inkoust mi slepil pusu!_           | sings every word to its end  |
| `zralok-zrout`           | Žralok Žrout           | greedy, eats the _i_'s and _y_'s        | menus: _Mňam! Tvrdé y ke snídani, měkké i k večeři!_         | full and friendly            |
| `had-zamotal`            | Mořský had Zamotal     | fidgety, tangles words into knots       | twisters: _Zamotám ti slova jako uzel na laně!_              | ties kelp into swings        |
| `das-lucernik`           | Ďas Lucerník           | sly showman, lures with false spellings | tricks: _Pojď blíž! Moje lucerna svítí správně… nebo ne?_    | lights the wreck for all     |
| `zeva-lakoma`            | Zéva Lakomá            | a greedy giant clam, snaps shut         | hoarding: _Moje perly! Moje slova! Nedám, nedám!_            | shares her pearls            |
| `uhor-zhavak`            | Lávový úhoř Žhavák     | hot-headed, boils word kinds together   | heat: _Jsem tak žhavý, že se mi vaří slova!_                 | warms the springs kindly     |
| `san-ledana`             | Mořská saň Ledana      | proud and cold, ink frozen to icicles   | cold puns: _Brr! Zmrazím ti všechny pády!_                   | the shallows' warm guardian  |
| `humr-nuzkar`            | Humr Nůžkař            | a fussy tailor, snips words apart       | clacks: _Cvak, cvak! Ustřihnu ti předponu!_                  | cuts ribbons for parties     |
| `meduza-lepka`           | Medúza Lepka           | giggly and clingy, glues words together | sticky: _Lepím a lepím! Kdo mě odlepí?_                      | floats free and light        |
| `chobotnice-napodobnice` | Chobotnice Napodobnice | a mimic, copies wrong patterns          | imitations: _Jsem žena? Jsem hrad? Jsem všechno!_            | herself at last              |
| `vir-casoplet`           | Vír Časoplet           | dizzy whirlpool, mixes up tenses        | jumbles: _Včera bude pršet, zítra pršelo! Točí se mi hlava!_ | a calm eddy carrying friends |
| `krakatice-inkoustova`   | Krakatice Inkoustová   | dramatic and lonely, ten inky arms      | sighs: _Mám deset ramen a nikoho k objímání!_                | hugs everyone; the guardian  |

Vír Časoplet's joke mixes tenses on purpose: meaning, not spelling.

**Inkoustíci** (§7.4), four little ink monsters, each with its own smudge and its own lines (Czech
agreement differs: _Kaňka ušpinila slovo!_, _Klikyhák ušpinil slovo!_):

| ID                   | Inkoustík | What it is              | Its smudge                       |
| -------------------- | --------- | ----------------------- | -------------------------------- |
| `inkoustik-kanka`    | Kaňka     | a round, dripping blot  | a blot beside the word           |
| `inkoustik-smouha`   | Šmouha    | a sleepy smudge         | a grey haze around the word      |
| `inkoustik-cmara`    | Čmára     | a quick zigzag scribble | zigzags above and below the word |
| `inkoustik-klikyhak` | Klikyhák  | a giggly curly squiggle | loops curling around the word    |

## 3. The sea and its levels

Twelve regions, **65 lessons and 12 monster levels**, in curriculum order, on two sea maps: the
**`shallows`** (`map/shallows`; regions 1-7, the 3rd grade; turquoise water, coral, kelp, a wreck,
ice at the far end) and the **`deep`** (`map/deep`; regions 8-12, the 4th grade; darker blues,
glowing creatures, the abyss at the bottom). Level IDs are `<region>.<n>` and `<region>.monster`.
Lessons go from concept and guided recall to free recall, related words, sentences and mixed review;
the monster mixes the region with spaced review (`reviewShare`, as in Dragon Valley).

**Unlocking** (as in Dragon Valley): a lesson needs the previous one; a region's lesson 1 needs
the previous monster level. A region is also open as the start of the child's grade (Slunná laguna
for the 3rd, Měsíční jeskyně for the 4th), when a parent unlocked it ahead, or when it belongs to an
earlier grade (free practice, §9). Placed levels count as completed and stay replayable.

**Eggs** (detail added here, after Dragon Valley's pattern): an egg arrives just before its topic,
so practice warms it and it hatches in "its" lesson. The first egg is chosen in the first session,
and the lagoon's lesson 1 serves all three lagoon friends' letters, so the chosen one hatches there
(§4.1). The other two float back as lesson 3 starts. Elsewhere the first new friend's egg comes with
the region's welcome, a second or third as the reward of the lesson before its topic. Every egg is
also a reward of its hatching level and of its monster level (never given twice), so a child who
was placed or unlocked ahead still gets every friend.

**Table notation.** Activities: `kind` and its count (problems, or boards for minigames); input is
`auto` (choice, then letter pad, then typing, §5.2), and a count ending in "c" is by choice.
Practises: the generator and its rules or dimensions; `spell.*` stands for `spell.word`,
`spell.sentence` and `spell.mistake` as the activities need them. A classification looks at a word
on its own unless the table says "of forms" (the `form` context, with its form groups) or "in
sentences" (the `sentence` context; contract §6.2). Feeds: the friend whose set the items join
(§6.5); _košík_ is Osmička's basket for items no hatched friend eats (§5.15).

### 3.1 Slunná laguna (`sunny-lagoon`): review of the 2nd grade

Friends Krab Tvrďák, Medúzka Měkulka, Želva Obojka. Monster Muréna Mumla. Accent sunny turquoise.

| Level                  | Czech title                     | English                        | Activities                                          | Practises                                                            | Feeds                 |
| ---------------------- | ------------------------------- | ------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| `sunny-lagoon.1`       | Abeceda a řazení podle abecedy  | The alphabet; _ch_ after _h_   | `pearl-necklace` 2, `fishing-nets` 1, `feeding` 10c | `alphabet`; `sort` consonant; `spell.word` tvrda, mekka, be-pe-ve-me | the chosen egg; Želva |
| `sunny-lagoon.2`       | Krátké a dlouhé samohlásky      | Short and long vowels          | `feeding` 10c, `ink-sentence` 5                     | `spell.*` delka (_pila × píla_)                                      | Medúzka               |
| `sunny-lagoon.3`       | Tvrdé a měkké souhlásky         | Hard and soft consonants       | `fishing-nets` 2, `feeding` 10, `ink-sentence` 5    | `sort` consonant; `spell.*` tvrda, mekka                             | Krab, Medúzka         |
| `sunny-lagoon.4`       | dě tě ně, di ti ni, bě pě vě mě | _ě_ syllables; soft _di ti ni_ | `feeding` 10, `ink-sentence` 5, `bug-hunt` 4        | `spell.*` de-te-ne, dtn-mekke, be-pe-ve-me                           | Krab, Želva           |
| `sunny-lagoon.5`       | ú/ů a párové souhlásky          | _ú/ů_; paired consonants       | `feeding` 10, `memory-match` 1, `ink-sentence` 5    | `spell.*` u-zacatek, u-predpona, u-uprostred, parova; `pairs` plural | Medúzka, Krab         |
| `sunny-lagoon.6`       | Velká písmena ve jménech        | Capital letters in names       | `feeding` 10, `bug-hunt` 5                          | `spell.*` velke-pismeno (_Alík, Praha, Vltava_)                      | Želva                 |
| `sunny-lagoon.monster` | Muréna Mumla                    | Monster battle                 | `battle` meter 15, cap 20                           | the lagoon, 20 % review                                              | the lagoon trio       |

### 3.2 Korálový útes (`coral-reef`): listed words after B and L

Friends Barakuda Bystřinka (hatches in lesson 2), Lachtan Lyžař (egg for lesson 3, hatches in 4).
Monster Žralok Žrout. Accent coral pink.

| Level                | Czech title                            | English               | Activities                                          | Practises                                                      | Feeds             |
| -------------------- | -------------------------------------- | --------------------- | --------------------------------------------------- | -------------------------------------------------------------- | ----------------- |
| `coral-reef.1`       | Obojetné souhlásky                     | Both-way consonants   | `fishing-nets` 1, `feeding` 10c                     | `sort` consonant; `spell.word` obojetna-i, vyjm; `odd-one-out` | Želva             |
| `coral-reef.2`       | Vyjmenovaná slova po B                 | Listed words after B  | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm                               | Barakuda          |
| `coral-reef.3`       | Slova příbuzná po B                    | Related words after B | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` family (_býk ↔ býček_); `spell.word` vyjm    | Barakuda          |
| `coral-reef.4`       | Vyjmenovaná slova po L                 | Listed words after L  | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm                               | Lachtan           |
| `coral-reef.5`       | Slova příbuzná po L                    | Related words after L | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` family (_mlýn ↔ mlynář_); `spell.word` vyjm  | Lachtan           |
| `coral-reef.6`       | B a L dohromady (být/bít, bydlo/bidlo) | B and L together      | `memory-match` 1, `feeding` 12, `bug-hunt` 5        | `pairs` sound-alike; `spell.*` vyjm, obojetna-i; `relation`    | Barakuda, Lachtan |
| `coral-reef.monster` | Žralok Žrout                           | Monster battle        | `battle` meter 15, cap 20                           | the reef, 20 % review                                          | Barakuda, Lachtan |

### 3.3 Chaluhový les (`kelp-forest`): listed words after M and P

Friends Koník Mýdlínek (hatches in lesson 1), Pyskoun Pyšný (egg for lesson 2, hatches in 3).
Monster Mořský had Zamotal. Accent kelp green.

| Level                 | Czech title                          | English               | Activities                                          | Practises                                        | Feeds          |
| --------------------- | ------------------------------------ | --------------------- | --------------------------------------------------- | ------------------------------------------------ | -------------- |
| `kelp-forest.1`       | Vyjmenovaná slova po M               | Listed words after M  | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm                 | Koník          |
| `kelp-forest.2`       | Slova příbuzná po M (mýt/mít, my/mi) | Related words after M | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` sound-alike; `spell.*` vyjm    | Koník          |
| `kelp-forest.3`       | Vyjmenovaná slova po P               | Listed words after P  | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm                 | Pyskoun        |
| `kelp-forest.4`       | Slova příbuzná po P (pyl/pil)        | Related words after P | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` sound-alike; `spell.*` vyjm    | Pyskoun        |
| `kelp-forest.5`       | M a P dohromady                      | M and P together      | `feeding` 12, `bug-hunt` 5                          | `spell.*` vyjm, obojetna-i; `odd-one-out` listed | Koník, Pyskoun |
| `kelp-forest.monster` | Mořský had Zamotal                   | Monster battle        | `battle` meter 15, cap 20                           | the forest, 20 % review                          | Koník, Pyskoun |

### 3.4 Pirátský vrak (`pirate-wreck`): listed words after S, V and Z

Friends Ježík Syčík (hatches in lesson 1), Vydra Výskalka (egg for 2, hatches in 3), Jazyk Jazýček
(egg for 4, hatches in 5). Monster Ďas Lucerník. Accent brass and teal.

| Level                  | Czech title                                               | English                   | Activities                                          | Practises                                                    | Feeds               |
| ---------------------- | --------------------------------------------------------- | ------------------------- | --------------------------------------------------- | ------------------------------------------------------------ | ------------------- |
| `pirate-wreck.1`       | Vyjmenovaná slova po S                                    | Listed words after S      | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm                             | Ježík               |
| `pirate-wreck.2`       | Slova příbuzná po S (sýrový/syrový/sírový)                | Related words after S     | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` sound-alike; `spell.*` vyjm                | Ježík               |
| `pirate-wreck.3`       | Vyjmenovaná slova po V                                    | After V; prefix _vy-/vý-_ | `pearl-necklace` 1, `feeding` 10c, `ink-sentence` 4 | `alphabet` rhyme; `spell.*` vyjm, vyjm-prefix                | Vydra               |
| `pirate-wreck.4`       | Slova příbuzná po V (výr/vír, výskat/vískat, vysel/visel) | Related words after V     | `word-family` 2, `memory-match` 1, `feeding` 10     | `family`; `pairs` sound-alike; `spell.*` vyjm                | Vydra               |
| `pirate-wreck.5`       | Vyjmenovaná slova po Z                                    | Listed words after Z      | `pearl-necklace` 1, `feeding` 10c, `word-family` 1  | `alphabet` rhyme; `spell.word` vyjm; `family` (_jazyk_)      | Jazyk               |
| `pirate-wreck.6`       | S, V, Z dohromady                                         | S, V and Z together       | `feeding` 12, `memory-match` 1, `bug-hunt` 5        | `spell.*` vyjm, vyjm-prefix, obojetna-i; `pairs` sound-alike | Ježík, Vydra, Jazyk |
| `pirate-wreck.monster` | Ďas Lucerník                                              | Monster battle            | `battle` meter 18, cap 23                           | the wreck, 20 % review                                       | Ježík, Vydra, Jazyk |

### 3.5 Perlová zátoka (`pearl-bay`): all listed words, word families and meanings

Friend Hvězdice Rodinka (hatches in lesson 2). Monster Zéva Lakomá. Accent pearl and lilac.

| Level               | Czech title                           | English                    | Activities                                       | Practises                                                                  | Feeds                    |
| ------------------- | ------------------------------------- | -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------ |
| `pearl-bay.1`       | Všechna vyjmenovaná slova             | All the listed words       | `pearl-necklace` 2, `feeding` 12, `bug-hunt` 5   | `alphabet` rhyme; `spell.*` vyjm, obojetna-i; `odd-one-out`                | the listed-word friends  |
| `pearl-bay.2`       | Slovní rodiny                         | Word families              | `word-family` 3, `memory-match` 1, `feeding` 8c  | `family`; `pairs` family; `relation` related; `odd-one-out` family         | Hvězdice                 |
| `pearl-bay.3`       | Slova stejně znějící                  | Words that sound the same  | `memory-match` 1, `ink-sentence` 6, `feeding` 10 | `pairs` sound-alike; `spell.sentence` (_Na stromě houká výr._); `relation` | the listed-word friends  |
| `pearl-bay.4`       | Slova souznačná a protikladná         | Synonyms and antonyms      | `memory-match` 2, `feeding` 10c                  | `pairs` synonym, antonym; `relation` synonym, antonym                      | Hvězdice                 |
| `pearl-bay.5`       | Slova nadřazená, podřazená a souřadná | General and specific words | `memory-match` 1, `feeding` 10c                  | `pairs` general (_ryba ↔ kapr_); `relation` general, specific, coordinate  | Hvězdice                 |
| `pearl-bay.monster` | Zéva Lakomá                           | Monster battle             | `battle` meter 18, cap 23                        | the bay, 20 % review                                                       | Hvězdice, listed friends |

### 3.6 Sopečné prameny (`volcanic-vents`): the ten parts of speech

Friend Kalmar Desetiruký (hatches in lesson 1). Monster Lávový úhoř Žhavák. Accent ember orange.

| Level                    | Czech title                            | English                           | Activities                      | Practises                                                           | Feeds  |
| ------------------------ | -------------------------------------- | --------------------------------- | ------------------------------- | ------------------------------------------------------------------- | ------ |
| `volcanic-vents.1`       | Podstatná jména a slovesa              | Nouns and verbs                   | `fishing-nets` 2, `analysis` 10 | `sort` pos; `classify` pos, alone and in sentences                  | Kalmar |
| `volcanic-vents.2`       | Přídavná jména a příslovce             | Adjectives and adverbs            | `fishing-nets` 2, `analysis` 10 | `sort` pos; `classify` pos                                          | Kalmar |
| `volcanic-vents.3`       | Zájmena a číslovky                     | Pronouns and numerals             | `fishing-nets` 2, `analysis` 10 | `sort` pos; `classify` pos                                          | Kalmar |
| `volcanic-vents.4`       | Předložky, spojky, částice, citoslovce | Prepositions to interjections     | `fishing-nets` 1, `analysis` 10 | `sort` pos (four nets); `classify` pos                              | Kalmar |
| `volcanic-vents.5`       | Všech deset slovních druhů             | All ten; inflected; meaning class | `fishing-nets` 2, `analysis` 12 | `sort` inflection, meaning-class; `classify` pos; `odd-one-out` pos | Kalmar |
| `volcanic-vents.monster` | Lávový úhoř Žhavák                     | Monster battle                    | `battle` meter 18, cap 23       | the springs, 20 % review                                            | Kalmar |

### 3.7 Ledové moře (`ice-sea`): nouns, verbs and sentences; the 3rd-grade finale

Friends Tuleň Pádík (hatches in lesson 1), Delfín Skokánek (egg for lesson 2, hatches in 4).
Monster Mořská saň Ledana, the 3rd grade's finale (§7.3). Accent ice blue.

| Level             | Czech title                     | English                              | Activities                                        | Practises                                                                   | Feeds                             |
| ----------------- | ------------------------------- | ------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| `ice-sea.1`       | Rod a číslo podstatných jmen    | Gender and number of nouns           | `fishing-nets` 2, `memory-match` 1, `analysis` 10 | `sort` gender (m, f, n); `pairs` plural; `classify` gender, number of forms | Tuleň                             |
| `ice-sea.2`       | Pády a pádové otázky            | Cases and case questions             | `analysis` 12                                     | `classify` case of forms and in sentences (1-4 first)                       | Tuleň                             |
| `ice-sea.3`       | Slovesa: osoba, číslo, čas      | Verbs: person, number, tense         | `analysis` 12                                     | `classify` person, number, tense of forms (pres, past, fut; impf)           | Delfín                            |
| `ice-sea.4`       | Infinitiv a určitý tvar slovesa | Infinitive and finite forms          | `analysis` 10                                     | `classify` finiteness of forms (_plavat_ or _plave_?)                       | Delfín                            |
| `ice-sea.5`       | Věta a souvětí, druhy vět       | Sentences, compound sentences, kinds | `analysis` 10, `ink-sentence` 5                   | `classify` sentence-kind, clauses; `spell.sentence` interpunkce, spojka     | Klauni (_košík_ until they hatch) |
| `ice-sea.6`       | Velké opakování 3. třídy        | Great review of the 3rd grade        | `feeding` 12, `analysis` 10, `bug-hunt` 5         | every 3rd-grade rule; `classify` pos, gender, case, tense                   | every 3rd-grade friend            |
| `ice-sea.monster` | Mořská saň Ledana               | The 3rd-grade finale                 | `battle` 6 icicles, meter 18, cap 24              | one icicle per 3rd-grade strand                                             | every 3rd-grade friend            |

### 3.8 Měsíční jeskyně (`moon-caves`): word structure

The 4th grade starts here. Friend Rak poustevník Kořínek (welcome after `beat.the-deep`; hatches in
lesson 1). Monster Humr Nůžkař. Accent moonlight violet.

| Level                | Czech title            | English                | Activities                                     | Practises                                                 | Feeds   |
| -------------------- | ---------------------- | ---------------------- | ---------------------------------------------- | --------------------------------------------------------- | ------- |
| `moon-caves.1`       | Kořen a slova příbuzná | Root and related words | `word-family` 2, `word-shell` 2, `feeding` 10c | `family`; `segment` root; `odd-one-out` family            | Kořínek |
| `moon-caves.2`       | Předpona               | The prefix             | `word-shell` 3, `feeding` 10c                  | `segment` prefix, root (_vý\|let_); `classify` segment    | Kořínek |
| `moon-caves.3`       | Přípona                | The suffix             | `word-shell` 3, `feeding` 10c                  | `segment` root, suffix (_les\|ník_); `classify` segment   | Kořínek |
| `moon-caves.4`       | Koncovka               | The ending             | `word-shell` 3, `memory-match` 1, `feeding` 10 | `segment` root, ending, zero ending; `pairs` plural       | Kořínek |
| `moon-caves.5`       | Celá stavba slova      | The whole structure    | `word-shell` 4, `feeding` 12                   | `segment` all four (_za\|hrád\|k\|a_); `classify` segment | Kořínek |
| `moon-caves.monster` | Humr Nůžkař            | Monster battle         | `battle` meter 18, cap 23                      | the caves, 20 % review                                    | Kořínek |

### 3.9 Potopené město (`sunken-city`): prefixes and prepositions

Friend Štítovec Přísavka (hatches in lesson 1). Monster Medúza Lepka. Accent drowned jade.

| Level                 | Czech title                                 | English                      | Activities                                     | Practises                                                        | Feeds    |
| --------------------- | ------------------------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | -------- |
| `sunken-city.1`       | Předpona, nebo předložka?                   | Together or apart?           | `ink-sentence` 6, `bug-hunt` 4, `feeding` 8c   | `spell.*` predpona-predlozka (_Kachna odplavala od mola._)       | Přísavka |
| `sunken-city.2`       | Předpony od-, nad-, pod-, před-, roz-, bez- | Six prefixes                 | `word-shell` 2, `feeding` 10, `ink-sentence` 4 | `segment`; `spell.*` predpona-souhlaska (_odtáhnout, rozzlobit_) | Přísavka |
| `sunken-city.3`       | bě/bje, vě/vje                              | _bě_ or _bje_, _vě_ or _vje_ | `feeding` 10, `word-shell` 2, `ink-sentence` 4 | `spell.*` bje-vje, be-pe-ve-me (_oběd × objednat_); `segment`    | Přísavka |
| `sunken-city.4`       | pě, mě/mně                                  | _pě_; _mě_ or _mně_          | `feeding` 10, `ink-sentence` 5, `bug-hunt` 4   | `spell.*` be-pe-ve-me, mne (_zapomněl_), mne-zajmeno             | Přísavka |
| `sunken-city.5`       | Potopené město: všechno dohromady           | The sunken city together     | `feeding` 12, `bug-hunt` 5, `word-shell` 2     | the region's rules; `segment`                                    | Přísavka |
| `sunken-city.monster` | Medúza Lepka                                | Monster battle               | `battle` meter 18, cap 23                      | the city, 20 % review                                            | Přísavka |

### 3.10 Temný příkop (`dark-trench`): noun patterns

Friend Klipka Vzorná (hatches in lesson 1). Monster Chobotnice Napodobnice. Accent indigo.

| Level                 | Czech title                                                | English                      | Activities                                        | Practises                                                 | Feeds  |
| --------------------- | ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------ |
| `dark-trench.1`       | Vzory rodu středního (město, moře, kuře, stavení)          | Neuter patterns              | `fishing-nets` 1, `memory-match` 1, `analysis` 10 | `sort`, `pairs`, `classify` pattern (_jablko ↔ město_)    | Klipka |
| `dark-trench.2`       | Vzory rodu ženského (žena, růže, píseň, kost)              | Feminine patterns            | `fishing-nets` 1, `memory-match` 1, `analysis` 10 | the same (_ryba ↔ žena, noc ↔ kost_)                      | Klipka |
| `dark-trench.3`       | Vzory rodu mužského životného (pán, muž, předseda, soudce) | Masculine animate patterns   | `fishing-nets` 1, `memory-match` 1, `analysis` 10 | the same (_kapr ↔ pán, rytíř ↔ muž_)                      | Klipka |
| `dark-trench.4`       | Vzory rodu mužského neživotného (hrad, stroj)              | Masculine inanimate patterns | `fishing-nets` 1, `memory-match` 1, `analysis` 10 | the same (_rybník ↔ hrad, koš ↔ stroj_)                   | Klipka |
| `dark-trench.5`       | Skloňování podle vzorů (i/y v koncovkách)                  | Endings by pattern           | `ink-sentence` 6, `bug-hunt` 5, `analysis` 8      | `spell.*` vzor (_Hráli jsme si s míči._); `classify` case | Klipka |
| `dark-trench.6`       | Všech 14 vzorů                                             | All fourteen patterns        | `analysis` 12, `memory-match` 1, `fishing-nets` 1 | `classify` pattern; `pairs` pattern; `sort` gender-class  | Klipka |
| `dark-trench.monster` | Chobotnice Napodobnice                                     | Monster battle               | `battle` meter 20, cap 25                         | the trench, 20 % review                                   | Klipka |

### 3.11 Bouřlivé moře (`storm-sea`): verbs, standard and colloquial Czech

No new friend: **Delfín Skokánek grows up here**. His skills include the 4th-grade verbs, and his
`monster` is Vír Časoplet, so he grows up when it is freed (§6.5). Monster Vír Časoplet. Accent
storm slate.

| Level               | Czech title                                 | English                       | Activities                                                     | Practises                                                                                                                      | Feeds   |
| ------------------- | ------------------------------------------- | ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `storm-sea.1`       | Osoba, číslo a čas sloves                   | Person, number, tense         | `analysis` 12                                                  | `classify` person, number, tense of forms (_napíšu_ is future)                                                                 | Delfín  |
| `storm-sea.2`       | Tvary jednoduché a složené                  | Simple and compound forms     | `analysis` 10                                                  | `classify` verb-form of forms (_psal jsem, bude psát_)                                                                         | Delfín  |
| `storm-sea.3`       | Způsob oznamovací, rozkazovací, podmiňovací | The three moods               | `analysis` 12                                                  | `classify` mood of forms (_píše, piš, psal by_)                                                                                | Delfín  |
| `storm-sea.4`       | Zvratná slovesa (se, si)                    | Reflexive verbs               | `fishing-nets` 1, `analysis` 10                                | `sort`, `classify` reflexive (_se, si_, none)                                                                                  | Delfín  |
| `storm-sea.5`       | Spisovná a nespisovná čeština               | Standard and colloquial Czech | `memory-match` 1, `fishing-nets` 1, `analysis` 8, `bug-hunt` 4 | `pairs` standard (_dobrej ↔ dobrý_); `sort`, `classify` register; `spell.mistake` spisovne (_Ke snídani mám mlíko._ → _mléko_) | _košík_ |
| `storm-sea.monster` | Vír Časoplet                                | Monster battle                | `battle` meter 18, cap 23                                      | the storm, 20 % review                                                                                                         | Delfín  |

### 3.12 Krakatičí propast (`kraken-abyss`): the sentence and the grand finale

Friend Klauni Dvojčata (hatches in lesson 2). Monster Krakatice Inkoustová, the grand finale (§7.2).
Accent abyss violet.

| Level                  | Czech title                       | English                     | Activities                                        | Practises                                                                 | Feeds               |
| ---------------------- | --------------------------------- | --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| `kraken-abyss.1`       | Podmět a přísudek                 | Subject and predicate       | `analysis` 12                                     | `classify` member                                                         | Klauni              |
| `kraken-abyss.2`       | Shoda přísudku s podmětem         | Subject-predicate agreement | `ink-sentence` 6, `bug-hunt` 5, `analysis` 6      | `spell.*` shoda (_Psi štěkali. Kočky mňoukaly._); `classify` gender-class | Klauni              |
| `kraken-abyss.3`       | Věta jednoduchá, souvětí a spojky | Sentences and conjunctions  | `analysis` 10, `ink-sentence` 5, `fishing-nets` 1 | `classify` clauses; `spell.sentence` spojka, interpunkce; `sort` pos      | Klauni              |
| `kraken-abyss.4`       | Velké opakování: pravopis         | Great review: spelling      | `feeding` 12, `ink-sentence` 5, `bug-hunt` 6      | `spell.*` vyjm, predpona-predlozka, bje-vje, mne, mne-zajmeno, shoda      | each rule's friend  |
| `kraken-abyss.5`       | Velké opakování: mluvnice         | Great review: grammar       | `analysis` 12, `word-shell` 2, `memory-match` 1   | `classify` pattern, mood, member; `segment`; `pairs`                      | each skill's friend |
| `kraken-abyss.monster` | Krakatice Inkoustová              | The grand finale            | `battle` 10 arms, meter 30, cap 40                | one arm per strand                                                        | every friend        |

After the finale the **endless daily adventure** keeps the spaced review going (hungry friends,
cloudy pearls, the race, the treasure chest), as in Dragon Valley.

## 4. Session flow

### 4.1 First session (the hook within five minutes)

As in Dragon Valley. A 3rd grader: title (the tap unlocks audio) → new profile (name, avatar, form
of address, grade; §10.2) → prologue (about 30 s, skippable) → **choose the first egg** →
Slunná laguna 1 (necklace, nets, Krmení) → **the egg hatches** → first sticker and coins → a hat at
U Mrože → the map makes the next level glow. The hatch is designed in: a baby needs 30 % of its
set answered right once (§6.5); the content keeps a lagoon friend's set to about 30-40 items (its
7-9 consonant letters, through a letter skill narrowed to them with `consonants`, contract §6.2,
and short words of its two topics); the nets of all 24 letters credit each friend's own, and the
focus egg (§6.3) makes the first Krmení of 10 meet about 9 of its items. A golden trace checks all
three choices.

A 4th grader: profile (grade 4) → prologue → the same egg choice → **Ukaž, co umíš** (§9.2; its
letters step serves the chosen egg's items on every other problem) → `beat.the-deep` → Měsíční
jeskyně 1, where **Kořínek hatches**. The lagoon egg hatches in the next sessions from Svačinka's
first tastes (§5.15): the chosen egg's tastes come first. Only Kořínek hatches in the first session;
a golden trace checks both hatches.

### 4.2 The daily adventure (_Dnešní výprava_)

One big button, about 10-15 minutes. `hub.next` (contract §12) decides, in Dragon Valley's priority
order: a pending beat; the first friend's choice (`first-friend`, answered with
`chooseFirstFriend`); the placement check (a 4th grader who has not done it); **Svačinka** for
hungry friends and the basket at the start of the day; the next glowing level until one is done
today; a minigame for variety once (`startLevel { level, activity }`, which never completes a level
again; it replays the finished board whose items wait most, due or never met, which is how items
only boards train are reviewed and first met, §6.5; on a day with no level to play it comes only
when such items wait); the **treasure chest** once the daily goal is met; a board while an item
only boards train is starving (at most six boards a day), then Svačinka again while an item is
starving; the next level again **while today's success is at least 70 %** (below it the adventure
reviews the last three finished levels instead, and a level under way always continues); then free
play. **Pacing** (a balance study for content 1.2, balance-report.md): new levels, the day's first
too, wait while the last 20 answers are below 70 % right or more than **40 items** wait for review
_(`BACKLOG_LIMIT`)_, and come all the same on the first day of practice and on **every third
day** _(`PACE_EVERY`)_, so a child always moves on and a 4th grader's first lesson follows the
placement check; Svačinka and reviews come instead, and every open level stays playable from the
map. After the goal the friends get **sleepy** (an expression, never a lock). A time
limit set by the grown-ups ends the round gently (`endRound{ reason: 'time-limit' }`).

The hub is the **home grotto** (`scene/grotto`): the featured friend with its next stage (the
rules' exact `next.have` of `next.need`), the other friends, the week, today's goal and quests, the
chest and the button. Places: the sea map, U Mrože, the wardrobe and grotto decorations, the
friends' gallery, the sticker album, the Great Shell and, once open, the race.

### 4.3 Habit, not streaks

Seven dots for the days practised this week (_Po Út St Čt Pá So Ne_). No streak to lose, no "come
back or else", no notifications.

## 5. Activities

A level lists activities as `{ kind, skills, count, input, options }`. **Problem activities**
(`feeding`, `ink-sentence`, `bug-hunt`, `analysis`, `battle`; hub-only `race`, `snack`,
`placement`) are answered with `answer`; their problems are `gaps`, `classify`, `odd`, `relation`
and `mistake`, and an answer is `text` (a gap's letters), `option` (a category value) or `pick` (a
word of a list). **Minigames** (`memory-match`, `pearl-necklace`, `fishing-nets`, `word-shell`,
`word-family`) are `@aegis/narrative` boards played with `minigameMove`.

### 5.1 General rules

- **No failing** (as in Dragon Valley): a miss gets a curious friend, warm orange, a "?", a soft
  _blub_ and _Skoro! Pojďme se podívat…_ with the answer and its strategy. Nothing is taken away.
- **Steps.** Each answer step is one turn. A wrong step (a gap, Lov chyb's find) shows the answer
  and strategy and the next step follows: nobody is stuck.
- **Gaps are ink blots** (_kaňky_); a right answer bursts one with a bubble.
- **A wrong spelling appears only where the child corrects it** (Lov chyb, an option), and the
  correct word is always the last thing shown.

### 5.2 Input modes

- **`choice`**: 2-4 big buttons: _i / y_, _i / í / y / ý_, _ě / je_, _mě / mně_,
  _dohromady / zvlášť_, category values.
- **`letters`**: the big letter pad, only the keys of the gap's rule (`Gap.keys`), at least 64 px:
  _i í y ý_ (listed words, hard and soft consonants, pattern endings); _i y a_ (agreement);
  _e é ě je_ (_dě, bě, bje_); _mě mně_; _u ú ů_; a vowel's short and long form; a consonant pair
  (_d t_, _s z_); the small and capital letter; the writings together and apart; a seam's letters;
  the gap's own end marks (`interpunkce`: a question's _? ._, a command's or wish's _! ?_; never all
  four, since after a command a full stop is right too); the conjunctions offered (`spojka`). A
  gap's own options (end marks, conjunctions, whole words) stand in a fixed order, so the answer's
  place tells nothing.
- **`typed`**: the Czech on-screen keyboard, QWERTZ with _ě š č ř ž ý á í é ú ů ď ť ň_, Shift and
  space. Typed text is compared after NFC and trimming; case counts (`normalizeTyped`). A gap that
  is a whole word (a conjunction, _mě/mně_, a word with or without a space, a standard word) is
  never typed: the child could not know which word to type, and another may be right too.

`auto` resolves from the item's box: choice in boxes 0-1, letters from box 2 _(balance
`input.lettersFromBox`, Dragon Valley's `keypadFromBox`)_, typed from box 4 _(`input.typedFromBox`)_.
Only gap steps can be letters or typed; classifications, odd ones, relations and Lov chyb's find are
picked. Protected reviews and re-asks use choice (§6.3); the race and the placement check use the
letter pad at least, because a guess between two buttons measures nothing. Keyboard: digits press
choices and pad keys, letters type, Enter confirms, Backspace deletes.

### 5.3 Hints: the strategy

A `hint` shows the strategy, not just the answer. Hints are free, never reduce rewards, and come on
request (_Poraď mi!_), after a miss, before a re-ask and before a taught problem (§6.4).

| Hint            | Shows                                   | Example                                    |
| --------------- | --------------------------------------- | ------------------------------------------ |
| `family`        | a related word that proves the spelling | _mlýn → mlynář_; _zapomenout → zapomněl_   |
| `test-word`     | a form that makes the sound clear       | _hrad → hrady_, _led → ledy_, _dům → domy_ |
| `listed`        | the school rhyme of a letter            | _být, bydlit, obyvatel, byt, příbytek…_    |
| `ten-ta-to`     | the gender test; for a plural subject   | _ten pes, ta ryba, to moře_; _ti, ty, ta_  |
| `case-question` | the case question                       | _komu? čemu? → Dej to mně._                |
| `pattern`       | the pattern and its ending              | _o hradech, o strojích_                    |
| `rule`          | the rule in one line                    | _Po h, ch, k, r, d, t, n píšeme y._        |
| `method`        | how to find the answer, step by step    | _the case questions in turn_               |
| `not-listed`    | the word is not listed, with its gap    | _Slovo b_lý mezi vyjmenovanými není._      |

`vyjm` uses the family word (the rhyme for a head word); `obojetna-i` after a listed letter says the
word is not listed, shown with its gap, never spelled out (not the rhyme: it lists only y-words, and
a look-alike in it, _být_ for _bít_, would confirm the slip), and elsewhere the rule line; `parova`
and `u-uprostred` a test word, `mne-zajmeno` the case question, `shoda` the subject's test, _ti, ty,
ta_ for a plural subject (_ti psi, ty kočky_; _ten, ta, to_ would give _to dítě_ for _děti_), `vzor`
the pattern, the rest the rule. Classifications show the gender test, or the method of the case,
the pattern, the tense, the mood or the verb form (`grammar.method.<method>`): never the case
question or the pattern, which name the answer. A sound-alike relation shows how such words differ.

### 5.4 Krmení (`feeding`): the core

A friend is hungry; each right answer feeds it a shrimp (_mňam!_; an egg glows). 8-12 problems of
any kind the skills generate; `options.draw` `mix` or `weakest` (as in Dragon Valley). A miss is
re-asked about three problems later, at most twice a round, strategy first. Results: right and fast
answers, best streak, coins.

### 5.5 Inkoustová věta (`ink-sentence`)

A sentence of at most 10 words with 1-3 ink blots, filled left to right (`V ml_ně b_dlí ml_nář.`).
Each gap is a step with its own item (a word's spelling point, or a `gap` item for _shoda_, _vzor_,
_mě/mně_ and the sentence rules). The finished sentence is shown clean and can be read aloud.
Sound-alikes are taught by meaning (`Musím b_t doma.` against `Nesmíš b_t psa.`). Two rules belong
to whole sentences: `interpunkce`, the end mark by the kind of sentence and the comma between
clauses (`Kdo to tam plave_`, `Krab spí_ protože je unavený.`), and `spojka`, the conjunction that
joins two clauses (`Krab chtěl plavat, _ voda byla studená.`). 4-8 sentences; `spell.sentence`.

### 5.6 Lov chyb (`bug-hunt`)

The ink hid one mistake in a sentence: tap the wrong word, then fix it (a gap, by any input). Both
steps train the fix's item. The mistake is always one of the sentence's annotated alternatives
(`{correct|alt}`), a plausible slip, never a random typo. In Bouřlivé moře the slip can be a
colloquial word in a standard sentence (`spisovne`: _Ke snídani mám mlíko._ → _mléko_). A tap on a
right word says _Tohle slovo je v pořádku._, counts as a miss and the fix follows (as Dragon
Valley's wrong operation pick). The words are the buttons; commas and end marks stand beside them,
never inside: the child taps _dosita_, not _dosita._, and fixes _dos_ta_. 4-6 sentences;
`spell.mistake`.

### 5.7 Určování (`analysis`)

Which part of speech, gender, number, case, person, tense, mood, pattern, verb form, reflexive
pronoun, sentence kind or member? A classification looks at a word on its own (`word`; a consonant
letter, or a highlighted part of a word for `segment`), at a form made from the word's paradigm
(`form`: _rybou, plaval jsem, budu plavat, plav, plaval bych_; a skill picks form groups with
`cells`, so a 3rd-grade person question shows only present, past and future forms, and the word
filter `aspects` keeps 3rd-grade tense skills to imperfective verbs), or at a token or the whole of
a sentence (`sentence`, the token marked and underlined; contract §6.2). Gender is `gender` (m, f,
n: _ten, ta, to_) in the 3rd grade and `gender-class` (ma, mi, f, n: with animacy) in the 4th. The
options are the skill's values (2-14), always picked, named as in textbooks
(`grammar.<dimension>.<value>`: _3. pád_, _vzor hrad_) and kept in the dimension's **school order**
(cases 1-7, parts of speech 1-10, the patterns by gender), never shuffled, so each value keeps its
place on screen. Rounds also serve `odd` (which word does not belong) and `relation` (pick the
synonym, antonym, general, specific, coordinate or sound-alike word). 8-12 problems.

### 5.8 Pexeso (`memory-match`): built-in `matching`

Pairs of the board's kind: `family` (_mlýn ↔ mlynář_), `synonym` (_veselý ↔ radostný_), `antonym`
(_velký ↔ malý_), `general` (_ryba ↔ kapr_), `sound-alike` (_být ↔ bít_, each with a picture or
gloss), `plural` (_ryba ↔ ryby_), `pattern` (_kapr ↔ pán_), `standard` (_dobrej ↔ dobrý_; the
colloquial card wears a speech bubble, so it never passes for standard writing). As in Dragon
Valley: mismatches stay up until _Otočit zpět_ (`clear`), no timer, 3-8 pairs (default 6), a coin a
pair, first-try pairs count as fast; faces are the contract's labels (`word:`, `form:`, `pattern:`,
`cat:`, `card:back`; contract §12.1).

### 5.9 Perlový náhrdelník (`pearl-necklace`): built-in `ordering`

Thread 3-10 word pearls in **alphabetical order** (_ch_ after _h_, _č ř š ž_ after _c r s z_, other
accents only break ties: `compareCzech`) or a letter's listed words in **the school rhyme's order**
(`rhyme`). A wrong necklace stays editable; pearls in place gleam (a mark, not only colour). A coin a
pearl; credits `abc:<word>`. The rhyme order is a publisher's convention (ÚJČ); the pack uses one
common textbook order, named for grown-ups.

### 5.10 Rybářské sítě (`fishing-nets`): custom `ps.sorting-nets`

Drag fish into 2-4 nets, one per value of a dimension. Fish carry words (gender with _ten, ta, to_
nets in the 3rd grade, `gender-class` in the 4th, part of speech, inflected or not, meaning class,
standard or colloquial, pattern, reflexive pronoun), consonant letters (`consonant`: fish _h, ch, k_
… into hard, soft and both-way nets) or forms (`form`: number, tense, person, …). Tap-then-tap and
keys work too. Hauling in (`submit`) sends fish in a wrong net swimming back (`wrong`). 4-12 fish; a
coin a fish; a fish caught on a first haul with no fish in a wrong net is fast, on a first haul
that sent some back ok, on a later haul slow; drag by `createPlacement`.

### 5.11 Ulita slov (`word-shell`): custom `ps.word-builder` (4th grade)

Cut a word in Kořínek's shell between letters, name each part (_předpona, kořen, přípona,
koncovka_), mark a zero ending (the empty "∅ koncovka" shell) and check. `roles` limits what is
asked. The lexicon's segmentation rebuilds the word (_za|hrád|k|a_). A coin a part; credits
`seg:<word>`.

### 5.12 Slovní rodinka (`word-family`): custom `ps.word-family`

Pick every word of the family whose head word Hvězdice holds, then check. Words of the
**sound-alike family** sit beside them on purpose (around _mýt_: _umýt, mýdlo_ among _mít, mívat_);
words of a **kin family** (one sharing the root) never do. 2-8 family words, 1-6 others; a coin a
word; credits `fam:<word>`.

### 5.13 Souboj s příšerou (`battle`)

The monster battle that ends every region: §7.

### 5.14 Závod s delfíny (`race`, optional)

Opens after Muréna Mumla is freed _(balance `race.unlockAfter`)_ if the parent left it on: a
60-second race _(`race.seconds`)_ of known items (box 2+) against the child's own best, dolphins
leaping beside Bublinka; the shell ends it with `endRound{ reason: 'time-up' }`; at most 60
problems; a new best earns a sticker. As Dragon Valley's Arena.

### 5.15 Svačinka (`snack`) and Osmiččin košík

As Dragon Valley's snack time: a hungry friend's due items, 6-10 problems (4-6 while recent success
is below 70 %). Due items no hatched friend eats wait in **Osmiččin košík** (Osmička's basket:
standard Czech, the 3rd grade's sentences until the Klauni hatch, eggs' items) and are served with
the friends' due items; the adventure offers Svačinka when only the basket has something due.
**First tastes**: items a finished level taught but the child never answered, every other problem
(2nd, 4th, 6th), up to three; eggs' items first, then the oldest friend's.

### 5.16 Ukaž, co umíš (`placement`)

As Dragon Valley's placement: a ladder of steps, 2-4 problems each, 12-24 in all, a gentle stop
after three misses in a row. A passed step **places** its levels (completed with one star,
replayable, eggs and cosmetics given; stickers only for what the child did). It never places a
region's lesson 1 or a monster level. In v1 it is the 4th grader's (§9.2); grown-ups can rerun it.

## 6. Learning engine

Dragon Valley's engine carries over almost unchanged, because it is about items, not arithmetic.
Rules are deterministic: same actions, content and seed, same state hash. Time enters only as data
(`startSession.day`, `answer.elapsedMs`). New is the domain.

### 6.1 The lexicon and items

The **lexicon** (`data.lexicon`, by S3; contract §8) holds words with grammar and paradigms,
family, segmentation and **spelling points** (rule and proof word), families (listed ones with
letter, rhyme order, `kin` and a sound-alike family), sentences of at most 10 words with annotated
gaps `{correct|alt}`, and relations. Forms are derived from the paradigms (`formCells`: cells
`sg1`…`pl7`, `inf`, `pres1`…, `fut1`…, `past1`…, `imp2`, `imp4`, `imp5`, `cond1`…). Word IDs are
ASCII (_být_ `byyt`, _bít_ `biit`, _mlýn_ `mlyyn`). Item IDs per word and skill (contract §5.4):
`spell:<word>:<at>` (`spell:mlyyn:2`), `gap:<sentence>:<gap>`, `class:<dimension>:<target>` (a word
`class:pos:ryba`, a letter `class:consonant:cx`, a form `class:person:plavat:past1`, a token
`class:case:<sentence>:<index>`), `rel:<relation>:<word>` (a sound-alike form
`rel:sound-alike:piit:pil`), `pair:<kind>:<word>`, `abc:<word>`, `seg:<word>`, `fam:<word>`. A
spelling point is **one item wherever it appears**, so a sentence gap reviews its word.
**Colloquial words** (_dobrej, mlíko, bejt_) appear only where the register is taught: word
filters select standard words unless a register skill names `registers` (contract §6), such a word
may have no paradigm, and in a sentence it is only the wrong option of a `spisovne` gap.

### 6.2 Leitner boxes and response times

As in Dragon Valley: right and fast or ok moves up a box (max 5), right but slow stays, wrong goes
back to box 1 invisibly; intervals **0, 1, 2, 4, 8, 16 days** _(`leitner.intervals`)_. Response
buckets, paused time excluded:

| Input              | Fast                         | OK                            | Source                          |
| ------------------ | ---------------------------- | ----------------------------- | ------------------------------- |
| choice (and picks) | ≤ 2.5 s                      | ≤ 6 s                         | Dragon Valley's choice          |
| letters            | ≤ 3.5 s                      | ≤ 8 s                         | Dragon Valley's keypad, one key |
| typed              | ≤ 5 s + 1 s per extra letter | ≤ 12 s + 1 s per extra letter | new _(balance)_                 |

**Time the spelling, not the reading** (as Dragon Valley's word problems): a problem shown with a
sentence adds **its words × 1 s** to both limits _(`response.perSentenceWordMs`)_, so reading a
sentence never makes a right answer slow. Typing adds 1 s per letter after the first
_(`response.typed.perExtraLetterMs`)_.

### 6.3 Round composition

As in Dragon Valley: the success band is 70-85 %, with a target of **82 %** _(`mix.successTarget`)_;
**70 %** likely successes and 30 % learning items _(`knownShare`)_, the learning share moving
between 10 and 50 % with the last 20 answers. **Protecting success** below 70 %: likeliest
successes first, smaller snacks, reviews and re-asks by choice, no further new levels that day
(and pacing, §4.2). **Svačinka aims at the target**: below 82 % it serves the likeliest successes
first, since once the levels pile up most answers are its reviews.
**Review guarantee**: a known item (box 2+) 4 days past its review is _starving_ and comes first
everywhere (a board threads it first); Svačinka comes before new levels, and for an item only
boards train a board does, before Svačinka.
**No repeats** within 2 problems _(`noRepeatWithin`)_, a word's items counting as one; new here,
sound-alike partners are never served back to back unless one problem shows both. Skills
interleave. **The focus egg**: learning draws prefer the chosen egg's never-right items while it is
an egg (else the oldest egg's), among eggs the round practises; the placement check warms it too.
**Random streams**: `problems` (items, shapes, carrying sentences), `distractors` (options and
their order), `rewards` (chest, quests), `words` (companion words: odd sets, fish, family
neighbours, fillers), `ambush` (Inkoustíci); independent, so a reward or an ambush never changes the
next problem.

### 6.4 Re-asking and teaching

A miss is re-asked about **3 problems later** _(`reask.delay`)_, at most **2 a round**
_(`reask.maxPerRound`)_, strategy first, in a fresh problem (the word alone where possible); leaving
the round cancels it. **Teach, then ask** (`teach`; not in the race or the placement check): the
first problem of each listed family (its rhyme line first), of each classification (_ten, ta, to_
before the first gender, a case's question before that case), of each 4th-grade rule (`bje-vje`,
`mne`, `mne-zajmeno`, `predpona-predlozka`, `predpona-souhlaska`, `shoda`, `vzor`, `spisovne`) and
of each sentence rule (`interpunkce`, `spojka`); an item a board credited has been met. The 2nd-grade
review rules are never taught first, as Dragon Valley never teaches small-table facts first. An item
missed twice in a row is shown with its strategy first.

### 6.5 Pearls, the Great Shell and friend growth

Mastery is a **pearl**, the better of two paths, as in Dragon Valley (content 1.3.0 numbers):

| Pearl    | By the Leitner box                        | Or by effort (`mastery.effort`)        |
| -------- | ----------------------------------------- | -------------------------------------- |
| `cloudy` | box 0-1                                   | fewer than 2 counted days              |
| `bronze` | box 2                                     | right on 2 counted days (`bronzeDays`) |
| `silver` | box 3-4 (or 5 without fast answers)       | right on 4 counted days (`silverDays`) |
| `gold`   | box 5 and 2 fast answers among the last 3 | never: gold is fluency                 |

A day counts when the item is answered right at any speed and at least 2 days (`gapDays`) after the
last counted day. Scheduling reads only the box.

**The Great Shell** (_Velká lastura_), the Magic Window reborn: a giant open shell with **ten
pearl beds**, one per strand, coloured like the Krakatice's arms. Each pearl is an item of an open
region, labelled with its word (the point marked: _ml**ý**n_), lying in the bed of its first
skill's strand. Lustre **and** a mark show the level: cloudy (a little cloud), bronze (one ring),
silver (two rings), gold (a star). A due known item "needs polishing" (a glint of dust, never a
crack). A closed oyster stands for each region ahead. The view's `shell` counts the pearls by strand
and skill (contract §12).

**Friend growth** _(balance `growth`)_: a friend's set is the items of its skills. Dragon Valley's
five stages fold into four, since only baby and grown are painted:

| Stage     | Requirement                                                         |
| --------- | ------------------------------------------------------------------- |
| `egg`     | received                                                            |
| `baby`    | 30 % of its set answered right at least once (hatchling)            |
| `grown`   | 70 % at bronze or better, and its monster freed (adult)             |
| `crowned` | 100 % gold, and its monster freed; the golden shell crown (crowned) |

A friend's set is the union of its skills' items, and its `monster` is the one whose freeing lets
it grow up (each rule is `{ stage, share, mastery, monster }`). That monster is the friend's
region's, except for Delfín Skokánek: his skills include the 4th-grade verbs and his monster is Vír
Časoplet, so he grows up in Bouřlivé moře. Friends never shrink; a friend with a due item is
**hungry** _(`hungry.minDue` 1)_; an item practised today is not due again that day. Items only
boards train (`abc:`, `pair:`, `seg:`, `fam:`, and consonant letters no classification asks) are
never served as single problems: they count for growth and shine in the Great Shell, a friend is
hungry only for items Svačinka can serve, and the daily adventure's variety minigame reviews them
by replaying the board whose items wait most (§4.2); each board threads its own skill's words,
starving ones first, then the chosen egg's, then the ones due or never met. **`grown` at 70 %
bronze** (check (a), balance-report.md): Dragon Valley's adult rule, 80 % at silver, left every
friend past the lagoon a baby for the whole 12-week study, because with Perlové moře's many items a
pearl reaches silver late; at 70 % bronze, and with pacing, friends grow up within days to six
weeks of their monster.

### 6.6 Generators and distractors

Generators (contract §6.1): `spell.word` and `spell.sentence` make `gaps`, `spell.mistake` makes
`mistake`, `classify`, `odd-one-out` and `relation` make their problems, and `alphabet`, `pairs`,
`sort`, `segment` and `family` make the boards of the necklace, Pexeso, the nets, the shell and the
family. **Distractors** are plausible mistakes, a signature one first (as in Dragon Valley):

- _i/y_ rules: _i↔y_ at the same length, then the other length; `delka`: the other length;
  _ú/ů_: _ú↔ů_, then _u_;
- `de-te-ne`: _e_ for _ě_; `be-pe-ve-me`: the heard _je_ or _ně_ (_objed, mněsto_); `bje-vje`: _ě_
  for _je_; `mne`, `mne-zajmeno`: _mě↔mně_;
- `parova`: the letter heard (_hrat_); `velke-pismeno`: the small letter; `predpona-predlozka`:
  together↔apart; `predpona-souhlaska`: the seam simplified (_rozlobit_);
- `shoda`: the other gender's ending (_psi štěkaly_); `vzor`: the sibling pattern's ending (_se
  strojy_); a sound-alike gap: the other member (_bít_ for _být_);
- `interpunkce`: the end mark of another kind of sentence (`.` for `?`), or no comma; `spojka`: a
  conjunction of another meaning (_a_ for _ale_); `spisovne`: the standard word's colloquial twin
  (_mlíko_ for _mléko_);
- classifications: the **sibling category** (_ma↔mi_ in `gender-class`; _hrad↔stroj, pán↔muž,
  žena↔růže, město↔moře_; 1st↔4th case; adjective↔adverb; preposition↔conjunction; past↔present);
  relations: the opposite relation (an antonym offered for a synonym).

A gap's options are unique, include the answer, number 2-4 and come in seeded order; a
classification's options keep the dimension's school order (§5.7). A word with a sound-alike twin is
asked only in a sentence or with its gloss or picture, never bare. Board and odd-one-out words are
real lexicon words; **kin families never distract each other**; sound-alike families sit side by
side on purpose. **Only verified sound-alikes**: _být × bít, bydlo × bidlo, dobýt × dobít, mýt ×
mít, my × mi, pyl × pil, sýrový × syrový × sírový, výr × vír, výskat × vískat, vysel × visel, výt ×
vít_; a side may be a word
form (`{ word, form }`: _pil_ of _pít_, _mi_ of _já_, _vysel_ of _vysít_, _visel_ of _viset_;
contract §8.5). Never _pýřit se_ / "pířit" or _zvykat_ / "zvikat".

### 6.7 Checks, traces and simulations

The content gate checks the lexicon (`validateLexicon`, contract §8.7), as the plan asks: listed
words have _y/ý_ after their letter, segments rebuild the word, every noun's pattern fits its
gender, no word appears twice in spellings differing only in _i/y_ (unless declared
sound-alikes), and every word cites a source (ÚJČ's Internetová jazyková příručka, the Pravidla
českého pravopisu). Golden traces pin each first-egg choice, a 4th grader's first session, an
ambush, Ledana and the Krakatice; learner simulations (S2) measure the balance
([balance-report.md](balance-report.md)): the review load of the whole sea set the pacing, Svačinka's
aim and the `grown` rule.

## 7. Monsters and Inkoustíci

### 7.1 Souboj s příšerou (`battle`)

Dragon Valley's boss challenge as a wash: **every right answer fires a bubble from Bublinka** and
washes ink off (the meter fills and the ink layer over the painting thins); **misses never refill
it**. Problems mix the region with 20 % spaced review (`reviewShare`). A battle cannot be lost: it
ends when the monster is clean or, as a kindness cap, after `count` problems (at least meter + 5)
with a flourish. Every 4 answers _(`battle.splashEvery`)_ the monster flicks a **harmless ink blot**
onto the scene, never over the problem, the controls or the progress; a tap wipes it with a squeak,
or it fades after 4 s; blots are hidden from screen readers and plain with reduced motion. The
monster tells a **joke** at the start, after every 5th right answer and when freed (going round
its jokes, never the same one twice in a row), never during feedback. When clean it **transforms**
on screen (ink runs off; a cross-fade with reduced motion), thanks the child and joins the
**friends' gallery**. Retry any time for stars. Meters and caps
(content): 15/20 for the first three, 18/23 for the others, Chobotnice Napodobnice 20/25, Ledana
18/24, the Krakatice 30/40.

### 7.2 The finale: Krakatice Inkoustová

Ten inky arms (`arms: 10`, `finale`), washed one by one as Dragon Valley's Seven-Headed Dragon is
cured head by head: three right answers wash an arm, and arm _k_ serves the battle's _k_-th skill,
one per strand in order: `letters-sounds`, `listed-words`, `word-meaning`, `word-structure`,
`prefixes`, `parts-of-speech`, `nouns`, `verbs`, `standard-czech`, `sentences`. No review share.
Washed arms curl up clean (_Umytá ramena: 4 z 10_). Then `beat.finale`: she hugs Bublinka with all
ten arms and becomes the guardian; the Great Shell shines; the finale certificate prints. She joins
the gallery and is not raised.

### 7.3 Mořská saň Ledana, the 3rd grade's finale

Her ink froze into **six icicles** (detail added here; `arms: 6`, `gradeFinale: 3`), three right
answers melting one, one per 3rd-grade strand of her objectives: `letters-sounds`, `listed-words`,
`parts-of-speech`, `nouns`, `verbs`, `sentences`. No review share. Her freed beat ends the 3rd
grade (_3. třída hotová!_ and a certificate) and the deep opens. For a 4th grader she is free
practice.

### 7.4 Inkoustíci: ambushes

- **Seeded and deterministic** (the `ambush` stream): the same seed and actions bring the same
  ambushes, and an ambush never changes the next problem.
- They come only once the lagoon's monster level (Muréna Mumla's) is complete _(balance
  `ambush.unlockAfter`)_; `beat.inkoustici` may introduce them.
- In Krmení, Inkoustová věta, Lov chyb, Určování and Svačinka, with a chance per problem _(balance
  `ambush.chance`, 10 %)_ from the third problem on (`minIndex`), at most one a round
  (`maxPerRound`), never on a re-ask or a taught problem, and never in a battle, the race or the
  placement check.
- The Inkoustík **smudges the next word** in its own way; the problem is unchanged and every letter
  stays readable at full contrast.
- **A right answer splashes it away** for a **bonus coin** _(`coins.ambush` 1)_ and a tally in the
  album; a wrong one gets the usual kind feedback and it swims off. **Never a penalty.**
- Screen readers hear its name (_Pozor, Kaňka!_).

### 7.5 The friends' gallery (_Galerie přátel_)

A grotto wall with each freed monster's portrait (`monster/<id>/freed`), its name and a favourite
joke, read aloud on a tap. Freed monsters are not raised: no growth, food or cosmetics.

## 8. Rewards and economy

Balance data, with Dragon Valley's numbers where the economy is the same; coins are earned only by
playing.

### 8.1 Coins (_mince_)

1 a right answer; +1 at every 10 in a row; lesson stars 2 / 4 / 6 and monster level stars 4 / 8 / 12
(first time each); 15 for a monster freed; 10 for the placement check; 1 for an Inkoustík splashed
(new); 2-5 a daily quest (3 a day); 1-3 from the treasure chest. Stars as in Dragon Valley: 1 for
completing, 2 at 80 % right, 3 at 95 % with 60 % fast; minigames do not count towards accuracy. A
15-minute session earns roughly 50-80 coins (balance-report.md: the streak bonus and the chest are
smaller than Dragon Valley's, since the reviewing boards pay a coin a pair, pearl or fish).

### 8.2 U Mrože

Mrož Vousáč's shop: about 40 SVG cosmetics in four slots: `head` (hats, caps, shell crowns), `eyes`
(diving goggles, glasses, masks), `neck` (scarves, bows, pearl necklaces) on the painted friends'
anchors, and `grotto` (anemone lamps, coral arches, a shell swing) in the home grotto. As in Dragon
Valley: things unlock as regions open (`cosmetic.unlock`), level rewards are given, not sold, any
friend can wear any item, and each keeps its own outfit. The `crowned` stage's golden crown
(`cosmetic/shell-crown`) is never sold or given as an item, and the content gate refuses a cosmetic
made of it; shop crowns come in other colours. Prices keep Dragon Valley's 1.2.0 tiers over twelve
regions _(balance)_: starters 15-25, Slunná laguna 175-325, Korálový útes and Chaluhový les 375-475,
Pirátský vrak to Ledové moře 475-575, the deep 590-600, so something new comes about every five
sessions.

### 8.3 Stickers (_samolepky_)

About 60, one album page per region, composed from data (`{ id, nameKey, page, criteria, icon,
color, frame }`). Names are Czech and never address the child with a gendered word: _První mládě ·
Muréna zpívá · Žrout je sytý · Mýt, nebo mít? · Sedm pádů · Ledana roztála · 3. třída hotová ·
Čtrnáct vzorů · Skokánek dospěl · Deset umytých ramen · První korunka_. A sticker for something the
child does needs a criterion only that action meets (_První ozdoba_ needs a friend wearing
something); _Pět inkoustíků_ adds the criterion `inkoustici-splashed`.

### 8.4 Daily quests and the treasure chest

Three quests a day (the `rewards` stream, from unlocked templates, never two alike): N right
answers, N quick answers, feed N snacks, play a minigame, finish a level, N right in a row, and
(new) splash an Inkoustík. Unclaimed quests are paid the next day. The **treasure chest** (_truhla
s pokladem_) opens after the daily goal (default 30 right answers) with 2-6 coins _(`chest`)_.

### 8.5 Printables

Through `layoutPrint` on A4, as in Dragon Valley: **flashcards of the ten hardest words** (or of a
listed letter), 2 × 5 a sheet, the front with its ink blot (_ml▢n_), the back with the word and its
strategy (_mlýn – mlynář_); **certificates** (_diplom_) for each crowned friend, each monster freed,
the 3rd grade and the finale. The child's name stands alone in the nominative: code never declines a
name.

### 8.6 The diary card (_Můj deník_)

Each session ends with a card made from data (Dragon Valley's diary): words whose pearls reached
bronze today (at most five, then "+N"), friends that hatched or grew, monsters freed, stickers.
The first line follows the form of address: _Dnes ses naučil: mlýn, slyšet!_, _Dnes ses naučila:
mlýn, slyšet!_, or neutral _Dnešní nové perly: mlýn, slyšet!_ It can be read aloud.

## 9. Grades 3 and 4

### 9.1 One sea, a grade per child

As Dragon Valley's grades. `GRADES = [3, 4]`, `DEFAULT_GRADE = 3`; the grade is rules state
(`settings.grade`, changed by `setSetting` with `{ key: 'grade', value }`). The profile editor asks
_Do které třídy chodíš?_ (_3. třída_, _4. třída_); the family record keeps the answer (contract
§14) and the shell hands it to the game before the first session. The pack's `grades` list names
the starts, `{ grade: 3, start: 'sunny-lagoon' }` and `{ grade: 4, start: 'moon-caves' }`; the
shallows are grade 3, the deep grade 4. Měsíční jeskyně's `unlock.after` is Ledana's monster
level, but as a start it is open to every 4th grader; a 4th grader's shallows are open for review,
never pushed. Parents can unlock ahead; changing the grade only moves the start and the
suggestions.

### 9.2 The 4th grader's placement check

Eight steps of 3 problems over 3rd-grade skills (`grades: [4]`), gaps on the letter pad, a step
passed at 66 % (two of three, as the rules round down); Dragon Valley's limits (4-24 problems, a
stop after 3 misses in a row). Steps and
the levels they place: vowel length, _ú/ů_, paired consonants (Slunná laguna 2, 5); consonants,
_dě tě ně, bě pě vě mě_, capitals, with the chosen egg's items on every other problem (Slunná laguna
3, 4, 6, giving the other lagoon eggs); listed words after B and L (Korálový útes 2-6), after M and
P (Chaluhový les 2-5), after S, V and Z (Pirátský vrak 2-6); families, sound-alikes and meanings
(Perlová zátoka 2-5); parts of speech (Sopečné prameny 2-5); gender, cases, person and tense
(Ledové moře 2-6). Lesson 1 of each region and every monster stay open for fun.

### 9.3 Finishing a grade

Freeing Ledana ends the 3rd grade (_3. třída hotová!_) and opens the deep; freeing the Krakatice is
the finale. Then the endless daily adventure goes on.

## 10. Czech in the UI

### 10.1 Czech for the child

Every child-facing string is Czech (`content/catalogs/cs.ui.json` and `cs.content.json`, contract
§7.4). English exists only for the grown-ups' area (§11). Story lines keep to the child profile
(the gate checks them); every line is written for the ear and names grammar as textbooks do
(`grammar.<dimension>.<value>`). The rules emit keys and IDs; the shell renders text.

### 10.2 The form of address

After name and avatar the profile editor asks _Jsi kluk, nebo holka?_ (_Kluk_, _Holka_, _Nechci
říct_). The answer, `boy`, `girl` or `neutral`, lives **in the family record only** (contract §14):
never in the save, a snapshot, an action or a game hash; the rules never see it. `neutral` is the
default and the fallback, written as full Czech, never as "naučil(a)".

### 10.3 The catalog convention

For **every** catalog: the **bare key** `<key>` is the required neutral phrasing (`praise.done`:
_Hotovo, výborně!_); optional `<key>.boy` and `<key>.girl` come **as a pair** (_Dokázal jsi to! /
Dokázala jsi to!_). A counted message has Czech plurals `<key>.one` (1), `<key>.few` (2-4) and
`<key>.other` (0, 5+): `coins.count.one` _{count} mince_ (1 mince), `.few` _{count} mince_ (3
mince), `.other` _{count} mincí_ (5 mincí); its plural forms are the required neutral phrasings and
may carry address pairs, `<key>.<plural>.<address>` (`coins.earned.few` _Máš {count} nové mince!_,
`coins.earned.few.girl` _Získala jsi {count} mince!_). **The shell picks the variant**: the plural
form by the count, then the address variant if there is one, else the neutral form. English exists
only for `grownups.*` keys and uses `.one` and `.other`; every Czech `grownups.*` string has its
English twin, and objective titles are `grownups.objective.*` keys, shown only to grown-ups.

**Inserted names** (from S3's Czech copy review of the UI templates). The code inserts a name (a
child's, a friend's, a monster's, a cosmetic's) as it is: in the nominative, as its catalog label,
with its capital. So a name placeholder stands only at the start of a sentence or after a colon or
dash, and nothing in the sentence agrees with it: no verb, adjective or pronoun that depends on its
gender or number (never _{friend} vyrostl_). The child is never addressed by name (never _Ahoj,
{name}!_): Czech addresses people in the vocative (_Petře_, _Jano_), which code cannot derive, so
address goes through the form of address (§10.2). Inside a sentence a species label is lowercase
(_krab Tvrďák_, [lexicon.md](lexicon.md) §3.1), the capitals rule the game teaches, so only
authored lines name a creature mid-sentence. Copy review checks this rule; the gate does not.

**Validation**: the content gate enforces, with `catalogProblems`, the address pairs, the required
neutral and plural forms, and equal placeholders between an address variant and its neutral form,
and it keeps story lines to the child profile (`CHILD_PROFILE`, at most 10 words a sentence). It
also checks that every Czech `grownups.*` string has its English twin. It does not compare
placeholders across plural forms (`.one` may say _jednu minci_ without `{count}`), and it does not
check the length of every string.

### 10.4 Czech typography

Catalogs keep ordinary spaces: the shell adds the **no-break space** after one-letter prepositions
and conjunctions (_k s v z o u a i_: _v moři_, _s Bublinkou_) when it renders
(`src/app/i18n/typography.ts`). Binding a number to its word (_5 mincí_, _3. třída_) is a planned
renderer rule of S4, not a gate check. The content gate checks quotation marks „…“ and ‚…‘, the
ellipsis …, an en dash – instead of a spaced hyphen, and no space before punctuation or inside
quotation marks and brackets.

### 10.5 The reading font: Pearl Reading

Dragon Valley's Andika-based font re-subset: **Pearl Reading**, an **Andika** subset (SIL OFL 1.1,
renamed because Andika is a Reserved Font Name), WOFF2 Regular and Bold, with every Czech letter and
capital (_á č ď é ě í ň ó ř š ť ú ů ý ž_), „“ ‚‘, …, – and the no-break space. Unit tests check
four distinct outlines for _i, í, y, ý_ and for their capitals, descenders on _y_ and _ý_ only, and
the same acute on _í_ and _ý_ as on _á, é, ó, ú_; the browser smoke test draws Czech text in Pearl
Reading, and the content gate checks that Czech text uses only the font's characters. No remote
fonts; provenance and a byte-exact rebuild script.

### 10.6 Read-aloud

Only the device's **local Czech voices** (Web Speech API, `localService`, a `cs` language, the voice
named in every utterance), **hidden when there is none**; the grown-ups' area explains why (Windows
needs the Czech speech pack; iPad has Zuzana). Per child; it stops on screen changes and pauses;
music ducks under it. A gapped word is read whole, as a teacher dictates: Czech sound does not give
away _i/y, ú/ů_ or _mě/mně_, and listening is the school's way to hear length and soft _dě_. Aliases
(`speech.alias.*`) fix words a voice says wrongly. The game works fully without it.

## 11. The grown-ups' area (_Pro dospělé_)

As in Dragon Valley, behind the **gate** (hold for two seconds, then a two-digit × two-digit
multiplication; a wrong answer asks a new one, no lockout). **Czech, with an English switch**: the
grown-ups' language (`cs` or `en`) is a device-level setting in the family record (contract §14);
every Czech `grownups.*` string has an English twin, and objectives are named only here
(`grownups.objective.*`). **Progress** (the view's `grownUps`, contract §12): days, answers,
pearls, friends, the Great Shell as plain lists per strand, accuracy and mastery per objective and
skill, the **ten hardest words** with their strategies, the last 60 days. **Printables** (§8.5).
**Settings**: grade, daily goal (10-100 right answers, default 30), time limit (5-120 minutes), the
race on or off, **unlock ahead**, rerun the placement check, form of address, voice and auto-read,
volumes, text size, reduced motion. **Data**: backup export and import per child
(`pearl-sea-backup`), confirmed reset, **offline install**, storage status (_Uloženo v tomto
zařízení_). Up to four children (`profile-1` … `profile-4`), names of at most 16 characters.

## 12. Art and audio direction (summary)

**Local only, on this PC** (binding): Qwen Image Edit Plus 2511 in WanGP (offline) for paintings,
local `rembg` for cut-outs, ACE-Step 1.5 for instrumental music, Dragon Valley's deterministic
synthesis for sound effects; never Azure or any cloud generator. Prompts, seeds, sketches, model
revisions and digests are committed; the user approves the style, each character batch and the art
in the game. Style B, the user's choice (plan §10): storybook gouache and watercolour, rounded
shapes, a clean medium plum-brown outline, no sticker border, a turquoise-coral-sun palette
darkening toward the deep, no text in images, open water for the UI.

- **Painted**: friends `friend/<friend>/baby` and `/grown` (36; the baby from the approved grown),
  monsters `monster/<monster>/inked` and `/freed` (24; freed from the inked master), Inkoustíci
  `inkoustik/<id>` (4), scenes `scene/<region>`, `scene/grotto`, `scene/title` and maps
  `map/shallows`, `map/deep` (16), characters `character/osmicka`, `character/mroz-vousac`,
  `character/bublinka` and Osmička cheering `character/osmicka/happy` (4 images), avatars
  `avatar/diver-1` … `avatar/diver-8`.
- **SVG**: eggs `egg/<friend>`, cosmetics `cosmetic/<item>` and the crowned stage's golden shell
  crown `cosmetic/shell-crown` on the friends' anchors (`head`, `eyes`, `neck`: `{ x, y }` in
  0-1000, `scale`, `rotate`), stickers `sticker/<sticker>`, UI, blots and pearls. S5 makes the eggs,
  cosmetics, the crown and sticker art as static SVG files listed in the art catalog; S4 renders
  them. A cosmetic, the crown included, has a 100 × 100 viewBox with its attachment point at the
  centre (a hat's brim centre, the goggles' bridge, a scarf's knot, the crown's base) and at `scale`
  100 is drawn 250/1000 of the painting's width wide. Catalog: `assets/art/catalog.json`
  (`pearl-sea-art-catalog/1`); art and audio references in contract §7.5.
- Expressions (`idle`, `happy`, `curious`, `eating`, `sleepy`, `proud`) are motion on the paintings,
  never authoritative; reduced motion turns movement into fades.
- **Music** (ACE-Step 1.5): `music/grotto` (title, grotto, story, shop, album, shell, results),
  `music/map`, `music/practice` (lessons, minigames, Svačinka, placement), `music/battle` (battles,
  race), `music/finale` (the Krakatice and the finale; optional). A mood without its own loop plays
  `music/grotto`. A freed monster gets the 9-second one-shot `sfx/victory-sting`, not a loop.
- **Sound effects** (`sfx/<name>`, about 30, re-voiced for water; S5's audio manifest
  `pearl-sea-audio-manifest/1`): bubble, splash, pearl chime rising with the streak, shrimp gulp,
  coins, egg wobble and crack, hatch fanfare, ink splat and wipe, monster grumble, the victory sting
  (a monster freed), Inkoustík giggle, star, sticker, map unlock, chest, purchase, chirp, yawn, a
  soft _blub_ for a miss, taps and swoosh; Dragon Valley's loudness tiers and buses.

## 13. Accessibility

As in Dragon Valley: touch-first with targets of at least 48 px (`CHILD_SAFE_PRESET`; pad keys 64
px); text to 200 % with reflow; **reduced motion** (fades instead of splashes and swimming);
**keyboard for everything** (digits, letters, arrows, Enter, Backspace, Escape pauses; keyboard
moves for nets and the shell); screen readers get text equivalents (a gap is read _kaňka_),
`aria-live` feedback and managed focus, while blots and smudges are decoration; **colour is never the
only signal** (✓ and ?, friends' faces, pearl marks, a marker and an underline); pause on a hidden
page; no timers but the opt-in race; no outbound links, third-party requests or telemetry.

## 14. Kindness rules

As Dragon Valley's: **no lives, no losing** (a battle always ends with a freed monster), **no red
X**, nothing ever taken away (friends never shrink, an Inkoustík costs nothing), **no streak
shaming** and no FOMO (unclaimed quests are paid the next day), **no ads, no purchases, no
accounts**, **no network** beyond the game's own files, and short sessions with a daily goal, sleepy
friends and an optional time limit.
