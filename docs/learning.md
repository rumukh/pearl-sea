# The rules: how Perlové moře teaches and plays

How the deterministic rules (S2, `src/rules/**` outside `contract/`) turn the content pack into
rounds, problems, boards, monsters and growing sea friends. The vocabulary is the domain contract's
([contract.md](contract.md)); the design is [design.md](design.md); this document says what the
code does where the design leaves a choice, with the balance names in `code`. Dragon Valley's
engine is the reference: where this says "as in Dragon Valley" the behaviour and its numbers carried
over unchanged.

## 1. Map of the code

| Module                                                         | What it holds                                                                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter.ts`                                                   | the runtime adapter: legality (named rejection codes), one command per action, the `reask` job, `validateState`, content activation, `createGameHost` |
| `view.ts`                                                      | `GameView` from state and content: the daily adventure's next step, rounds, friends, the Great Shell, the grown-ups' area                             |
| `learning/items.ts`                                            | response buckets, Leitner boxes, the effort path, mastery levels, due items                                                                           |
| `learning/migrate.ts`                                          | content activation: records under item IDs the contract retired merge into the items they stand for                                                   |
| `learning/selection.ts`                                        | what a round serves next: tiers, the learning share, the focus egg, no repeats                                                                        |
| `learning/generate.ts`                                         | the problem generators' registry, servable items, `problemFor`                                                                                        |
| `learning/generators/spell.ts`                                 | `spell.word`, `spell.sentence`, `spell.mistake`                                                                                                       |
| `learning/generators/classify.ts`, `odd.ts`, `relation.ts`     | `classify`, `odd-one-out`, `relation`; `companions.ts`: the words a set or a relation may show                                                        |
| `learning/distractors.ts`, `hints.ts`                          | gap options, letter keys and strategy hints                                                                                                           |
| `learning/index-cache.ts`, `item-info.ts`                      | per-pack lookups (lexicon, items, sentences) and what an item is about                                                                                |
| `progression/problems.ts`                                      | problem rounds: serving, grading step by step, re-asks, teaching, battles, ambushes                                                                   |
| `progression/rounds.ts`, `minigame-rounds.ts`                  | level runs, round completion, stars, level and monster rewards                                                                                        |
| `progression/snack.ts`, `placement.ts`, `ladder.ts`, `race.ts` | Svačinka, Ukaž, co umíš, the race                                                                                                                     |
| `progression/friends.ts`, `levels.ts`, `grades.ts`             | sea friends' sets and growth, unlocking, grades and finales                                                                                           |
| `minigames/*.ts`                                               | the five boards: makers, the three custom adapters, typed views and credits                                                                           |
| `economy/*.ts`                                                 | coins, U Mrože, stickers, daily quests and the treasure chest                                                                                         |
| `story/beats.ts`                                               | narrative beats: triggers, choices, rewards                                                                                                           |

Everything is a pure function of the state, the pack and the action. Randomness comes only from the
runtime's named streams (`problems`, `distractors`, `words`, `rewards`, `ambush`), time only from
`startSession.day` and `answer.elapsedMs`. Per-pack lookups are memoised on the frozen pack data
(`perPack`), so they cost one build per pack.

## 2. Items, answers and mastery

**Items** are the contract's item IDs (§5.4): `spell:<word>:<at>` for a word's spelling point,
`gap:<sentence>:<n>` for a sentence gap that is not a word's point, `class:`, `rel:`, and the
board-only `pair:`, `abc:`, `seg:`, `fam:`. A spelling point is one item wherever it is asked, so
a sentence gap on _mlýn_ reviews `spell:mlyyn:2`, and a form is one item however many cells show it
(_delfíni_ is `class:number:delfiin:pl1`, never `…:pl5`). Saves made before content 1.2.5 can hold
records under such retired IDs; activating newer content merges them into the item they stand for
(`learning/migrate.ts`, [contract.md](contract.md) §7.6).

**Response buckets** (`responseBucket`): `miss`, or by time against the input's limits
(`response.choice`, `.letters`, `.typed` with `perExtraLetterMs` per letter after the first). The
first step of a problem shown in a sentence adds `response.perSentenceWordMs` per word of the
sentence to both limits, so reading never makes an answer slow; later steps do not add it again.

**Leitner** (`updateItem`, as in Dragon Valley): fast or ok moves up a box (at most 5), slow stays,
a miss drops to box 1; due when `leitner.intervals[box]` days have passed since the last answer; an
item answered today is not due again today. **Mastery** (`masteryLevel`) is the better of the box
path (cloudy 0-1, bronze 2, silver 3-4 or 5 without fast answers, gold 5 with
`mastery.goldFast` fast answers among the last `goldOfLast`) and the effort path (bronze after
`effort.bronzeDays` counted days, silver after `silverDays`; a day counts when the item is right at
least `gapDays` after the last counted day). A Lov chyb hunt is credited once, at the fix, with the
worse of its two answers (a wrong find counts as a miss). The Great Shell's new pearls and the diary's
words learned today are read from the item records, as the state keeps no history: a level reached
today shows in the box and the last answer (`polishedToday`), so a rare step (gold reached with an
ok answer) can go unannounced; scheduling never reads it.

## 3. Problems from the lexicon

`problemFor(skill, item, sources, request)` draws one problem; every problem passes the contract's
`problemSchema` and has exactly one expected answer per step (`expectedAnswer`).

- **`spell.word`**: the word with the drawn point as a gap and, unless `request.single`, up to
  `maxGaps - 1` more of the skill's rules that do not overlap it. A point is **ambiguous bare** when
  writing one of its alternatives (or a pad key in the answer's case) gives another word or form of
  the lexicon (_pas × pás_, _být × bít_): such a point is asked in a lexicon sentence that carries
  it instead. A point with neither is not servable (§3.2).
- **`spell.sentence`**: a sentence of the skill's filter with the drawn gap and up to two more gaps
  of the skill's rules, in text order, each item once (a word written twice, _dál a dál_, is asked
  at the drawn gap and filled at the other), filled one by one; with `single` only the drawn gap. A
  re-ask of a sentence item asks the word alone where it is not ambiguous (`request.alone`).
- **`spell.mistake`**: a sentence with the drawn gap written as one of its authored alternatives;
  the tokens are the sentence split at spaces (a gap's own spaces stay in its token), each token's
  punctuation its mark (`marks`: _dosita_ with `.`), so a word button never holds a comma or an end
  mark; a slip in the punctuation itself keeps every mark in its token. Step 0 picks
  the wrong token, step 1 writes the gap right; a wrong find still leads to the fix.
- **`classify`**: the skill's `values` (every value of the dimension when `null`) in the dimension's
  school order (`DIMENSION_VALUES`), never shuffled; the target as the child reads it: the consonant
  letter, the word, the form (`formCells`), a token of its sentence (`context`, with each token's
  `marks`, the punctuation right after it, read from the filled sentence: the comma of address
  decides _Delfíne, skoč!_), a part of the word
  (`span`, a zero ending the empty span after the last letter), or the whole sentence (`word:
null`, at most 240 characters, without its end mark for `sentence-kind`). A word on its own is
  never one written like another lexicon word. Hints: _ten, ta, to_ for gender; the `method` of
  the case, the pattern, the tense, the mood and the verb form (never the case question or the
  pattern, which name the answer).
- **`odd-one-out`**: 3 to the skill's `size` words, the drawn item's word among the ones that
  belong, exactly one differing on the basis (a word dimension, the family, listed or not). The
  companions are the skill's words (a family set may add its family's other members, of the
  filter's registers and grades); never a homograph; a family set's odd word never from a kin
  family, the sound-alike family's first; a listed set's words of the same letter first. A word of
  no family is not a listed word (unless a `vyjm` point says it is: then it is left out). A word
  alone in its family is the odd one beside another family. The hint names the listed letter.
- **`relation`**: the shown word and `choices` options (2-4), exactly one in the relation with it:
  the drawn item's word (`rel:general:zviirxe` is "zvíře is the general word" of the shown _pes_).
  Wrong options: the opposite relation first (an antonym for a synonym, a synonym for an antonym, a
  coordinate word for a general one, the general word for a coordinate one, the sound-alike
  family's words for `related`), then the skill's words of the same part of speech, then the rest;
  never a word of a kin family for `related`, never a homograph. Words the filter does not select
  (a partner, a tempting option) keep to its registers and grades (`suits`).

### 3.1 Options, keys and hints

A word gap offers the skill's `choices` (2-4): the right text and the rule's alternatives
(`spelling.alt`, then the rule's further slips: _i í y ý_, _e é ě je_, _u ú ů_, …, in the answer's
case; for `be-pe-ve-me` the slip one hears, _je_ after _b, p, v_ and _ně_ after _m_). A
sentence gap offers `1 +` its authored alternatives, at most the grade's `input.choices`, so a
sentence never offers a spelling its author did not foresee. `keys` (the letter pad) are the rule's
pad in the answer's case plus every option. A gap whose rule has no pad holding its answer (a whole
word, an end mark) shows its own options instead, in a fixed order (end marks _. ? ! ,_, then the
alphabet), so the answer's place on the pad tells nothing; an end mark offers only its gap's marks,
since after a command a full stop is right too. A gap that is a whole word (a conjunction, _mě_ or
_mně_, a word with or without a space, a standard word) is never typed: the child could not know
which word to type, and another one may be right too. Hints follow design §5.3: `vyjm` the family
word (the rhyme for a head word); `obojetna-i` after a listed letter `not-listed` with the gap's
`span` (never the rhyme, which lists only y-words and may hold a look-alike: _být_ for _bít_), else
the rule line, also wherever the other letter makes another word: the lemma (_b_t_: _být_), a word
of its family's sound-alike family (_nab_t_: _nabýt_), or the gap's word in its sentence (_v_sela_:
_vysela_); `parova` and `u-uprostred` the test word, `mne-zajmeno` the case question, `shoda`
_ten, ta, to_ (`plural` for a plural subject: _ti, ty, ta_) for one subject and the rule line for
several, `vzor` the pattern, other rules the
rule. Classifications hint the gender test, or the `method` of the case, the pattern, the tense,
the mood and the verb form; a sound-alike relation hints its `method`.
A verb asked for its reflexive pronoun is shown without it (_bát_, not _bát se_), alone, on a net or
in an odd-one-out set; a verb that shown so is another lexicon verb with another pronoun (_hrát_,
_hrát si_) is not asked.

### 3.2 Servable and board-only items

An item is **servable** when a problem skill of the pack can ask it (`servableIndex`).
`unservableItems(data)` lists the others: for a released pack it must be empty, because such an item
counts in a friend's set but no problem could ever ask it. Items only boards train (`abc:`, `pair:`,
`seg:`, `fam:`, and consonant letters while no classification asks them) are never served as single
problems: they count for growth and shine in the Great Shell, a friend is hungry only for items
Svačinka can serve, and boards review them and introduce them (§5, §8): they have no first taste
and no Svačinka.

## 4. Rounds

A **problem round** serves problems one at a time. Its counters (`answered`, `correct`, `fast`,
`streak`), coins (`coins.correct` a right step, `coins.streakBonus` at every `streakEvery` in a
row), the battle's washing, the daily goal and the stars count **answer steps**; `asked` and the
round's `target` count **problems**, re-asks included (`progress.answered` in the view is the
problems finished). Every step is one logical turn.

**What comes next** (`chooseItem`, as in Dragon Valley): a re-ask whose turn has come first; else
the activity's draw. `mix` rounds take likely successes (due and known items, box 2+) and learning
items in the learning share, which moves between `mix.minLearningShare` and `maxLearningShare` with
the success of the last `mix.window` answers against `successTarget`; below 70 % recent success
(`LOW_SUCCESS`) the likeliest successes come first, snacks are shorter and reviews and re-asks are
asked by choice; Svačinka serves its likeliest successes first already below `successTarget`
(`belowTarget`), since most answers are its reviews once levels pile up. A starving item (box 2+, 4
days past due) is the first choice whenever a round draws a due or known item; Svačinka's first
tastes and a mixed round's learning draws keep their turns (as in Dragon Valley). `weakest` takes
the
least mastered items. **The focus egg**: learning draws prefer the never-right items of the chosen
first egg while it is an egg (then the oldest egg's), among eggs the round practises; the placement
check warms it on every other problem. **No repeats**: an item never comes back within
`mix.noRepeatWithin` problems, a word's items counting as one, and a sound-alike partner (_být_
after _bít_) never comes right after the other.

**Input** (`inputFor`): `auto` gives choice below box `input.lettersFromBox`, the letter pad below
`typedFromBox`, then typing where every gap letter can be typed (else the letter pad); reviews and
re-asks made easier by low success are by choice; the race and the placement check use the letter
pad at least; classifications, odd ones, relations and Lov chyb's find are always picked.

**Re-asks** (`reask` job, as in Dragon Valley): a miss is asked again `reask.delay` problems later
(the job is anchored to the round's phase and the logical turn), at most `reask.maxPerRound` a round,
as a fresh problem (the word alone where possible); leaving the round cancels them. **Teach first**:
the first problem of a teaching unit (a listed family, a classification value, a 4th-grade rule or
a sentence rule, `TAUGHT_RULES`) the child meets is shown with its strategy first, and so is an item
missed twice in a row; never in the race or the placement check; the 2nd-grade review rules are
never taught first.

## 5. Levels, Svačinka and the daily adventure

A level run plays its activities in order; each is a round, and only a finished round completes its
activity. An activity this build cannot play (a board the content cannot make, a skill no generator
serves) is skipped. The level completes when the run first reaches its end: stars (1 completed, 2 at
`stars.twoStars.accuracy`, 3 at `threeStars` with its fast share; boards do not count towards
accuracy), first-time star coins, eggs and cosmetics, the monster freed, region unlocks, beats,
quests, growth and stickers. A single activity of a finished level can be replayed
(`startLevel { level, activity }`) and never completes the level again.

**Svačinka** (`snack.ts`): hungry friends' due items, 6-10 problems (4-6 while recent success is
low), with a first taste at every other problem, at most three: a taught item never answered (the
items of finished or placed levels' skills), eggs first (the chosen egg before the others), then
the oldest friend's. Feeding every friend also empties **Osmiččin košík**: due items no hatched
friend eats (eggs' items included). A snack of the basket alone is never longer than the basket and
its tastes.

**The daily adventure** (`hub.next`, design §4.2): a pending beat; the first egg; the placement
check while pending; Svačinka at the start of the day; the next glowing level until one is done
today; once a day a board replay, for variety after a level or, on a day without one, while a
finished board's items wait (the board with the most items waiting: due, or board-only and never
answered); the chest once the goal is reached; the review guarantee: a board while a board-only
item starves (the board with the most of them, at most `STARVING_BOARDS` 6 boards a day, so an item
a board cannot thread never fills the day), then Svačinka while an item it serves starves; more
levels while today's success is at least 70 % (a level under way always continues), else a review
(Svačinka, or an activity of the last three finished levels, rotating); then free play.

**Pacing** (`levelsHeld`, design §4.2): new levels, the day's first too, wait while recent success
is below 70 % (`lowSuccess`) or more than `BACKLOG_LIMIT` 40 items Svačinka can serve are due
(`reviewBacklog`), except on the first day of practice and every `PACE_EVERY`-th (3rd) day
(`daysPracticed`), so every child moves on at least every third day and a 4th grader's first lesson
follows the placement check. A held day offers Svačinka or a review instead; a level under way is
never held.

**The race** opens after `race.unlockAfter`: known items first (box 2+, then any answered right
before), at most `race.maxProblems`, single gaps on the letter pad, ended by the shell with
`endRound { reason: 'time-up' }`.

## 6. Ukaž, co umíš

The ladder (`placementFor`) is the pack's steps for the child's grade whose skill a problem
generator can ask; a step whose skill cannot be asked is left out, and a step never places a monster
level or a region's first lesson, whatever it lists. Each step asks its `problems` single gaps; a
step passes at `passAccuracy` percent, **rounded down** (two of three is 66 %, so a three-problem
step at 67 % needs all three; author 66 to pass two of three); a failed step, `stopAfterMisses`
misses in a row or `maxProblems` end it. Passed steps place their levels (one star, `placed`, their
first-time eggs and cosmetics); finishing pays `coins.placementDone` once; leaving early or playing
a level first marks it skipped and keeps what was placed.

## 7. Monsters and the Inkoustíci

**Battles** (`battle`): the round serves the level's skills with a `reviewShare` percent of known
items from outside them (none for the finales, whose share is 0). Every right answer washes one blot
(`ink.washed`); a miss never washes or refills. Every `battle.splashEvery` answers a harmless blot
splashes (`ink.splashed`). The **kindness cap**: the battle ends after the activity's `count`
problems, never fewer than `meter + 5` (`BATTLE_SPARE`), and a capped battle washes the rest off
with a flourish: the monster is freed all the same. **Jokes** (`monster.joked`, `jokeIndex`): the
first at the start, the next after every 5th right answer while ink is left, the next when freed,
going round the monster's list, so a joke never repeats at once; `BattleView.jokeKey` is the joke on
screen (until the next answer), so a reload redraws the bubble. A many-armed monster (`arms`) washes
arm by arm: arm _k_ is clean at `k × meter / arms` blots (`arm.washed`); the finales serve one skill
per arm in order: a fresh problem is asked through the current arm's skill, a re-ask through any of
the battle's skills (its item came from an earlier arm).

**The Inkoustíci** (`drawAmbush`): only once `ambush.unlockAfter` is complete; in Krmení,
Inkoustová věta, Lov chyb, Určování and Svačinka, from problem `ambush.minIndex` on, with
`ambush.chance` percent, at most `ambush.maxPerRound` a round, never on a re-ask or a taught
problem, never in a battle, the race, the placement check or a board. The draw uses its own stream
after the problem is drawn, so an ambush never changes any problem. A right answer splashes the
Inkoustík (`inkoustik.splashed`, `coins.ambush`, the album's tally); a wrong one gets the usual kind
feedback and it swims off.

## 8. Boards

| Board              | Made from                                                                                                                                                                     | Credits                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Perlový náhrdelník | `alphabet`: words with distinct first letters on the first board, ordered by `compareCzech`; `rhyme`: a listed letter's core family heads in rhyme order                      | `abc:` items of the pearls: fast at the first check, else slow                            |
| Pexeso             | `pairs` of the board's kind; no card that would match a card of another pair (sound-alike cards only by sound: _být ↔ bít_ and _byl ↔ bil_ share a board); no two cards alike | the pair's item: fast while no mismatch happened yet, else ok                             |
| Rybářské sítě      | `sort`: fish round-robin over the nets, distinct texts                                                                                                                        | each fish: fast on a clean first haul, ok on a first haul that sent some back, slow later |
| Ulita slov         | `segment`: a word's segments and the asked roles                                                                                                                              | `seg:`: fast at the first check, else slow                                                |
| Slovní rodinka     | `family`: a family's words beside its sound-alike family's, never a kin family's                                                                                              | `fam:` items: fast at the first check, else slow                                          |

Every pair, pearl, fish, part or family word earns `coins.correct`. A board is made only at the
design's sizes (Pexeso 3-8 pairs, nets 4-12 fish, a family 2-8 words besides its head); an activity
whose items cannot make one is skipped. Each board of a round takes the round's skills of its kind
in turn and threads **its own skill's words** (an activity of two necklace skills threads each
from its own words). It threads first (`boardFocus`): starving items (the review guarantee), else
the chosen egg's never-right items (the other eggs' after it), else the items waiting for a board
(due, or never answered). When one move hatches several eggs, the chosen egg hatches first. A
board never repeats the previous board of its round while
another is possible (the same rhyme run, the same family). Boards never punish: a wrong move stays on
the board to be corrected, and hauling in empty nets is not counted as a haul. A move the board
cannot take (a role or a zero ending the board does not ask, a fish already caught) is rejected as
`invalid-move`, one for an old board revision as `stale-move`. A family board credits its head
word's `fam:` item too, so every item of a family skill can be learned.

## 9. Sea friends, the economy and the story

A friend's set is the union of its skills' items (`friendSet`). Growth follows `balance.growth`
(baby at 30 % seen, grown at 70 % bronze with its monster freed, crowned at 100 % gold with its
monster freed); friends never shrink. A hatched friend is hungry when `hungry.minDue` of its
servable items are due. Coins come only from playing (§4, stars, monsters, ambushes, quests, the
chest, the placement check, story rewards); U Mrože sells what `cosmetic.unlock` has opened, each
friend keeps its own outfit, and a grotto decoration moves rather than copies. Daily quests and the
chest use the `rewards` stream. Beats trigger on the first session, level starts, monsters freed and
other beats; their rewards are claimed once.

## 10. Content the rules rely on

Checks S3's pack must pass for the rules to work as designed (most are in the content gate; the rest
are proved by the rules' tests on the pack):

- `unservableItems(data)` is empty (§3.2).
- An ambiguous spelling point (another lexicon word or form one alternative away) has a lexicon
  sentence that carries it.
- A lagoon friend's set is about 30-40 items, and at least about 45 % of it problem-servable items
  taught in the lagoon's lessons 2-6, so a 4th grader's chosen egg can hatch from Svačinka's first
  tastes (lesson 1 is never placed).
- A placement step at 67 % with three problems needs all three right (§6).

## 11. Tests

`test/unit/**` (the modules: items, the spelling generators exhaustively over the fixtures and the
game's pack, the choice generators exhaustively over the three packs with test skills of every
dimension, basis and relation, selection, boards and their adapters, the boards' review, battles,
ambushes, placement, Svačinka, steps and re-asks, the adapter's legality and commands),
`test/traces/**` (golden command traces with named checks and mutation checks: a 3rd grader's first
session with each lagoon egg, a 4th grader's first sessions, the lagoon slice end to end with the
first Inkoustíci) and `test/migration/**` (a mid-round save, the next content revision, a save
with retired item IDs). They run on
the rules' lagoon fixture (`test/fixtures/rules/lagoon-pack.ts`), the contract's mini pack and the
game's pack (`realPack`); the harness's oracle answers from the lexicon's raw data, never from the
code under test ([testing.md](testing.md)).
