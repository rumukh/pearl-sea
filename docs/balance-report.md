# Balance report

Four synthetic children play Perlové moře through the real rules for up to 12 weeks. This report
records what they measured on S3's content (the slice 1.0.0, then previews of 1.1.0 and 1.2.0, the
whole sea), what works, what the content's size does to the review schedule, and the balance and
rule changes the measurements support.

**Decided** (the coordinator, 2026-11-01): the proposal of §6.5 and the targets of §3 are approved,
and follow in the pull request after this report's, with design.md and this report updated; the
band's shortfall (34-42 sessions of 60 against 45) is known, to revisit after the playtest; coins
come back to design's 50-80 through balance data if no other target breaks. The Krakatice's cap of
40 is in the contract (an activity's `count` up to 40).

- **Code**: the learner model `test/sim/learners.ts`, the driver `test/sim/driver.ts`, the named
  checks `test/sim/report.ts` and the growth probes `test/sim/growth.ts`.
  [testing.md §4](testing.md#4-learner-simulation-bots-s2) explains how they fit together.
- **Rules**: this branch (PR #8's engine with the remaining generators, the finales and the board
  review of this pull request).
- **Content** (S3's packs; the previews are S3's branches before their pull requests):

  | Pack  | What                                                    | Levels | Friends | Items (board-only) | Source                                                |
  | ----- | ------------------------------------------------------- | ------ | ------- | ------------------ | ----------------------------------------------------- |
  | 1.0.0 | Slunná laguna, the slice                                | 7      | 3       | about 120          | #7                                                    |
  | 1.1.0 | regions 1-6 of the 3rd grade                            | 39     | 12      | 849 (355)          | `rumukh-s3-regions-preview` af76804, fe165b25e4728f31 |
  | 1.2.0 | all twelve regions, the grade-4 start and the placement | 77     | 18      | 1,730 (545)        | `rumukh-s3-deep-preview` 6942c59, 7ed523b6d8a3ad19    |

  The 4th grader's run (§4.4) used the first 1.2.0 preview (d75e203); its only differences are a
  Pexeso S3 has since fixed and eight stickers.

- **Runs**: from Monday 2026-11-02 with seed `simulation`: 84 days on 1.1.0 and 1.2.0, 42 on
  1.0.0, and 28 days for a 4th grader.
- **Reproduce**:
  - `node scripts/simulate.mjs --days 84 --pack <pack> --growth test/sim/growth-study.json` runs
    the four children and writes `out/simulation/report.md`; `--check` fails on a failed check.
  - `--learners`, `--seed` and `--out` choose the run; `--grade 4 --egg zelva-obojka` plays a 4th
    grader who chooses Želva.
  - `--balance file.json` merges a partial balance block first (the intervals experiment:
    `{ "leitner": { "intervals": [0, 1, 3, 7, 14, 30] } }`); `--answers` writes every answer with
    its activity, input, box, days overdue and the child's recall.
  - The rule experiments of §6 (X1, X2, P1-P3) are a few lines each in `src/rules`, described there;
    they are not in this branch.
  - With the 1.2.0 pack a commit costs about 10 ms; an 84-day run of the four children takes 15-35
    minutes, depending on how many run at once.

## 1. Summary

**What works on every pack.** No step of any run is rejected. Every egg received in play hatches
within 4 sessions, the first in the first session; every child who reaches a monster frees it; the
chest opens every time the daily goal is met; every session earns coins (the average child's median
is 68-74 a session, design §7.1: 50-80); every child buys its first cosmetic on day 0. On 1.1.0 and
1.2.0 every child sees progress every week (on the slice alone, the slow child has one week without,
once the lagoon is done). A 4th grader's first session hatches Kořínek, and the chosen lagoon egg
hatches on day 3 (check b, §5.6). On the slice alone the average child's three friends grow up on
day 7, five days after Murena (§4.1).

**What fails: the review load outgrows the session.** Perlové moře teaches about 22 items a level
(15 that problems ask), where Dragon Valley taught about 4 facts a level. The engine is Dragon
Valley's, and so is its schedule: a new level every day, reviews at 1, 2, 4, 8 and 16 days. A child
answers about 45 problems a session; the average child meets 12-15 new problem items in each, and
each wants five or six reviews within the weeks that follow. The reviews fall behind and the backlog
grows all the way, even for the perfect child (§5.1). On the whole sea (1.2.0):

| Child      | Success per session (median; sessions at 70-90 %) | Levels in 84 days (last) | Known items due at start (last 10 sessions, median) | Friends grown (of those whose monster was freed) |
| ---------- | ------------------------------------------------- | ------------------------ | --------------------------------------------------- | ------------------------------------------------ |
| perfect    | 100 %                                             | 77 (day 45)              | 285                                                 | 11 of 18                                         |
| average    | 68 % (22 of 60)                                   | 77 (day 67)              | 157                                                 | 3 of 18                                          |
| slow       | 67 % (16 of 60)                                   | 77 (day 73)              | 109                                                 | 0 of 18                                          |
| struggling | 55 % (4 of 48)                                    | 55 (day 81)              | 9                                                   | 0 of 14                                          |

So the average child misses the success band (75 % of sessions at 70-90 %), the struggling child
falls below its 60 % floor, friends past the lagoon do not grow up, and items only boards train
wait up to 70 days for their board. Longer intervals alone change none of this within 12 weeks
(§6.1).

**Why success sits at 70 %.** After the first weeks most answers are Svačinka's, and Svačinka
serves due items most overdue first; it switches to the likeliest successes only below 70 %, the
band's lower edge. So the child's success hovers at 70 % rather than at the 82 % target the mix
aims at (§5.2).

**What the experiments show** (§6). Serving Svačinka's likeliest successes below the 82 % target
(X1) lifts the average child into the band (1.1.0: 74 % median, 46 of 60 sessions), but alone it
reviews fewer old items and fewer friends grow up. Pacing new levels by the child's success and
review load (P2) lifts every child and lets friends grow up, at the cost of speed. Together with
boards first for starving board-only items (B6) and `grown` at 70 % bronze (G70), on 1.2.0:

| Child      | Success per session (sessions at 70-90 %) | Levels in 84 days | Longest overdue (days) | Friends grown |
| ---------- | ----------------------------------------- | ----------------- | ---------------------- | ------------- |
| perfect    | 100 %                                     | 64 (Ledana 44)    | 32                     | 15 of 15      |
| average    | 75 % (41 of 60)                           | 42                | 8                      | 8 of 12       |
| slow       | 75 % (46 of 60)                           | 42                | 9                      | 7 of 12       |
| struggling | 67 % (17 of 48)                           | 27                | 6                      | 2 of 10       |

Over five seeds the gains hold (§6.5): the average child's success is 71-75 % (68 % on every seed
on today's rules) and the struggling child's 67-71 % (54-60 %). The band still falls short: 34-42
of the average child's 60 sessions are in it, against the 45 the target asks.

**Check (a), the time to `grown`** (§5.5). Under the shipped rule (80 % silver and the monster
freed) only the lagoon's friends grow up within 12 weeks for the average and slow children, and
none for the struggling child; on the slice the rule is fine (5 days after Murena). Growth is a
symptom of the review load: no rule grows friends whose items are not reviewed. With the pacing of
§6, **70 % bronze and the monster freed** grows the average child's lagoon friends 1-2 days after
Murena and the later ones 2-6 weeks after their monster.

**Proposed** (§6.5), and approved:

1. Pace new levels by success and review load (design §4.2): the day's new levels wait while recent
   success is below 70 % or more than 40 items are due, and come anyway on every third day of
   practice.
2. Svačinka aims at the success target (design §6.3): below `mix.successTarget` it serves the
   likeliest successes first.
3. Boards for starving board-only items before Svačinka's starving round, at most six a day
   (design §4.2).
4. `grown` at 70 % bronze with the monster freed (design §6.5, balance `growth`).
5. Targets that fit two school years (§3): the perfect child's finale in 4 weeks and "every level
   in 12 weeks" are Dragon Valley's targets for one trimester of tables.
6. Intervals unchanged for now; longer ones (0, 1, 3, 7, 14, 30) lower success within 12 weeks and
   need a year-long run to judge.

All six were approved on 2026-11-01 (see the top of this report).

## 2. The children

Each child knows every item to some strength from 0 to 100. As in Dragon Valley:

- **Practice and forgetting.** A right answer closes `gain` % of the gap to 100, a miss half as much
  ("Podíváme se" shows the answer). Strength fades by `forget` points a day divided by the item's
  stability.
- **Stability.** It starts at 1 + strength / 10 for knowledge from earlier grades, grows by 1 with
  every success on a new day and halves with a miss.
- **Right answers.** The chance of a right answer is a guess among what is offered plus the rest
  scaled by recall: 2 options of _i/y_ guess 50 %, a letter pad 1 in its keys, typing 2 %.
- **Response time.** Thinking time comes from recall: fluent at 85 or more, steady at 55 or more,
  unsure below. Keys add a time per letter; a sentence adds its words times a reading time.
- **Priors** (new here). The 2nd grade's spelling (the lagoon's review rules), the consonant classes
  and the alphabet are known well; the 3rd grade's listed words, both-way consonants, end marks and
  grammar are new; the 4th grade's spelling is barely known.

Boards are played by the trace harness, clumsily for the struggling child; story beats take their
first choice; at the end of each session the child claims quests, opens the chest and buys the
cheapest cosmetic it can afford.

| Child      | 2nd-grade spelling / letters | 3rd grade / grammar / 4th grade | Gain | Forget | Choice: fluent / steady / unsure | Keys: think + per letter | Reads a word | Answers a day | Plays            |
| ---------- | ---------------------------- | ------------------------------- | ---- | ------ | -------------------------------- | ------------------------ | ------------ | ------------- | ---------------- |
| perfect    | 100                          | 100                             | -    | -      | 1.5 s                            | 1.5 s + 0.3 s            | 0.25 s       | 45            | every day        |
| average    | 75 / 75                      | 20 / 25 / 5                     | 35 % | 4      | 1.8 / 4.2 / 7.5 s                | 2-9 s + 0.6 s            | 0.6 s        | 45            | Mon-Fri          |
| struggling | 55 / 55                      | 10 / 10 / 0                     | 20 % | 6      | 4.3 / 6.7 / 10 s                 | 4.5-11.5 s + 0.9 s       | 0.9 s        | 35            | 4 days (not Wed) |
| slow       | 75 / 75                      | 20 / 25 / 5                     | 35 % | 4      | 4.5 / 7 / 9 s                    | 4.7-10 s + 1 s           | 0.9 s        | 35            | Mon-Fri          |

**Why these numbers.** Gain, forgetting, the paces and the session sizes are Dragon Valley's, so the
two games are measured alike. The priors follow the Czech curriculum (curriculum.md): the lagoon
reviews the 2nd grade, the shallows teach the 3rd, the deep the 4th. The slow child knows and learns
like the average child but is never quick, which tests that gold needs quick answers. The parameters
were set before the balance was measured and were not tuned to pass a check. They are models: the
absolute numbers depend on them, the comparisons between balances are the robust part, and the
playtest with real children (testing.md §6) is the check on the model.

## 3. Targets

The checks are named in `test/sim/report.ts` (`CHECKS`); each label states what it measured. Their
targets (`TARGETS`) are Dragon Valley's unless noted, **proposed** until the coordinator agrees them.

| Check              | Target                                                                                       | Source                    |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------- |
| success band       | average, weeks 1-12: 75 % of sessions at 70-90 % success, median inside                      | the brief; testing.md §4  |
| struggling success | struggling: median success per session at least 60 %                                         | Dragon Valley             |
| rewarded           | every child earns coins every session                                                        | testing.md §4             |
| weekly progress    | average, struggling, slow: a level, hatch, growth, sticker or a pearl turning silver or gold | testing.md §4             |
| chest              | the chest opens every session that reaches the daily goal                                    | design §4.2               |
| first hatch        | the first egg hatches in the first session                                                   | design §4.1               |
| hatch pace         | every egg hatches within 5 sessions of arriving                                              | design §4.1, §6.5         |
| no dead end        | perfect, average, slow: every level completed and every monster freed within 84 days         | testing.md §4             |
| steady path        | struggling: a new level every week with play; finished regions' monsters freed; ≥ ¾ levels   | Dragon Valley (1.2.0)     |
| no starving        | no known item (Leitner box 2+) waits more than 7 days past its review day                    | testing.md §4             |
| coins              | average: median 50-80 coins per session                                                      | design §7.1               |
| starter week       | every child buys its first cosmetic in its first week                                        | Dragon Valley (1.2.0)     |
| fluency            | the slow child brings no item only problems ask to gold                                      | design §6.5               |
| perfect pace       | the perfect child reaches the finale within 4 weeks                                          | Dragon Valley's design §3 |
| grown up (a)       | average: each friend grown within 21 days of its monster being freed                         | new (check a)             |

**Some targets do not fit this game**, and the proposal is to change them with the pacing (§6.5):

- **No dead end and the perfect pace** ask for the whole game in 12 and 4 weeks. Dragon Valley's
  valley is a trimester of times tables; Perlové moře is two school years of Czech, 77 levels. On
  today's rules the perfect child needs 45 days and the average child 67, and with any pacing that
  keeps up the reviews, longer (§6). Proposed instead: no dead end as a structural check (every
  level and monster reachable, no rejected step: it passes on every pack), and pace targets per
  grade: the average 3rd grader frees Ledana within 16 weeks, the perfect child within 8.
- **The steady path's floor** of ¾ of the levels in 12 weeks is likewise the valley's; the weekly
  new level stays.
- **Grown up (a)**: 21 days is measured on the lagoon alone; with the pacing, later friends grow
  2-6 weeks after their monster. Proposed: 6 weeks.
- **Hatch pace**: eggs the placement check gives arrive together and hatch one by one (§5.8).
  Proposed: judge eggs received in play.

## 4. Results

Spreads are min / median / max over the sessions played. "Due" counts known items (box 2+) whose
review day had come when a session began, over the last 10 sessions. Friends: hatched / monster
freed / grown (day). Growth needs the friend's monster freed: a friend is judged from that day.

### 4.1 The slice: content 1.0.0, 42 days

| Child      | Success per session | Coins per session | Due | Friends grown (days)                    |
| ---------- | ------------------- | ----------------- | --- | --------------------------------------- |
| perfect    | 100 %               | 69                | 0   | 4-5                                     |
| average    | 83 / 95 / 100 %     | 68                | 2   | 7, 7, 7                                 |
| struggling | 67 / 80 / 90 %      | 71                | 7   | 15, 17 (Želva's 35 items not by day 41) |
| slow       | 82 / 95 / 100 %     | 102               | 2   | 10, 10, 10                              |

Seven levels and about 120 items are soon known: the average child is above the band (95 %), and
once the lagoon is done it mostly plays the race. The slow child brings two items to gold
(`spell:vila:1`, `spell:dexti:3`; §5.7).

### 4.2 Regions 1-6: content 1.1.0, 84 days

| Child      | Success per session (in band) | Levels (last) | Coins | Due | Longest overdue | Grown (shipped / 70 % bronze) |
| ---------- | ----------------------------- | ------------- | ----- | --- | --------------- | ----------------------------- |
| perfect    | 100 %                         | 39 (day 16)   | 96    | 80  | 23              | 11 / 12 of 12                 |
| average    | 60 / 68 / 91 % (24 of 60)     | 39 (day 25)   | 74    | 127 | 16              | 3 / 10 of 12                  |
| struggling | 37 / 60 / 83 % (5 of 48)      | 39 (day 56)   | 47    | 12  | 6               | 0 / 2 of 12                   |
| slow       | 54 / 70 / 93 % (29 of 60)     | 39 (day 30)   | 62    | 77  | 16              | 3 / 10 of 12                  |

Every item waiting more than 7 days is one only boards train (`abc:`, `fam:`, `pair:`); §5.4.

### 4.3 The whole sea: content 1.2.0, 84 days

| Child      | Success per session (in band) | Levels (last) | Finale | Coins | Due | Longest overdue | Grown (shipped / 70 % bronze) |
| ---------- | ----------------------------- | ------------- | ------ | ----- | --- | --------------- | ----------------------------- |
| perfect    | 100 %                         | 77 (day 45)   | day 45 | 102   | 285 | 70              | 11 / 14 of 18                 |
| average    | 48 / 68 / 91 % (22 of 60)     | 77 (day 67)   | day 67 | 68    | 157 | 43              | 3 / 5 of 18                   |
| struggling | 19 / 55 / 83 % (4 of 48)      | 55 (day 81)   | -      | 42    | 9   | 6               | 0 / 0 of 14                   |
| slow       | 48 / 67 / 93 % (16 of 60)     | 77 (day 73)   | day 73 | 59    | 109 | 32              | 0 / 4 of 18                   |

At the end the average child has 658 cloudy pearls of 1,200 answered. The struggling child frees
Ledana on day 66 and meets the deep's 4th-grade spelling, which it barely knows (§5.10). Both
finales play end to end: every child who reaches them frees Ledana and the Krakatice.

### 4.4 A 4th grader: content 1.2.0 (first preview), 28 days

The average and perfect 4th graders (`--grade 4 --egg zelva-obojka`): the placement check places
them, Kořínek hatches in the first session, Želva hatches on day 3, and both free the Krakatice
(the perfect child on day 14, the average child on day 24: the deep is 31 levels). The average 4th
grader's success is 66 % (5 of 20 sessions in the band). The eggs of the placed 3rd-grade levels
hatch one by one over 7-18 sessions (§5.8).

## 5. Findings

### 5.1 The review load outgrows the session

The engine reviews an item at 1, 2, 4, 8 and 16 days, then every 16 days: about seven reviews in
its first 12 weeks. A child answering 45 problems every day can keep about 45 × 16 ≈ 700 items in
the top box, fewer while they climb, and fewer still playing five days a week. Perlové moře has
1,185 items problems ask and 545 only boards train; Dragon Valley had about 250 facts, a fifth of
the review load at the same session length.

The answer logs (`--answers`) show where the time goes on 1.2.0:

| Child      | New items a session (median) | Answers to items in box 0-1 | Answers to items 7+ days overdue |
| ---------- | ---------------------------- | --------------------------- | -------------------------------- |
| perfect    | 5 (14 in weeks 1-6)          | 37 %                        | 10 %                             |
| average    | 12 (15 in weeks 1-6)         | 66 %                        | 8 %                              |
| slow       | 11 (13)                      | 86 %                        | 10 %                             |
| struggling | 11 (12)                      | 99 %                        | 5 %                              |

The perfect child is never wrong, yet by week 11 about 300 known items wait for review when its
session begins. The adventure brings a new level every day, and each brings more than the
following weeks can review.

### 5.2 Success sits at the protection threshold

The mix aims at 82 %: its learning share falls when recent success is below the target. But after
the first weeks most answers are Svačinka's (1.1.0: 80 % of them; weeks 5-12, all of them), and
Svačinka has no learning share. It serves due items most overdue first, and the likeliest successes
first only while recent success is below 70 %. So success swings around 70 %: on 1.1.0 the average
child's weekly medians run 65-76 %. In weeks 5-6 (all Svačinka) a fifth of its answers went to
learning items (box 0-1) 7 or more days overdue, recalled at 30 of 100, right 58-60 % of the time;
items just due (0-3 days) were right 74-80 %.

### 5.3 The slow and struggling children promote only what they know very well

"Right but slow stays in its box" (Dragon Valley's rule). The slow child's steady answers take 7 s,
the struggling child's 6.7 s; "ok" ends at 6 s. So their items climb only once recalled at 85 or
more: 86 % and 99 % of their answers go to items in box 0-1. The effort path still credits them
(bronze after 2 counted days, silver after 4), which is what it is for. This is unchanged from
Dragon Valley, whose report withdrew a wider "ok" for the same children; it is recorded here
because it multiplies their reviews: an item in box 1 is due again the next day.

### 5.4 Items only boards train

A board-only item (`abc:`, `fam:`, `pair:`, `seg:`) is reviewed only by replaying its board. The
daily board threads waiting items first (starving, then the chosen egg's, then due or never met),
and while one starves the adventure offers boards, at most `STARVING_BOARDS` (3) a day. On 1.1.0
that keeps them within 16 days (the check asks 7); at 6 a day within 8 days, at 10 within 7 (at
most 10 board rounds in a session, median 3). On 1.2.0 they wait up to 43 days (average) and 70
(perfect): the starving board step comes after Svačinka's starving round, and with a large backlog
Svačinka's round always has a starving item, so the budget is spent before the board's turn. In
every run on the shipped rules, every item more than 7 days overdue is board-only.

### 5.5 Check (a): the time to `grown`

Friends grown by the end of the run, of those whose monster was freed, under the shipped rule (80 %
silver) and the alternatives `test/sim/growth-study.json` follows in the same runs:

| Pack, child      | 80 % silver (shipped) | 70 % silver | 60 % silver | 80 % bronze | 70 % bronze |
| ---------------- | --------------------- | ----------- | ----------- | ----------- | ----------- |
| 1.0.0 average    | 3 of 3 (5 days after) | 3 of 3      | 3 of 3      | 3 of 3      | 3 of 3      |
| 1.1.0 perfect    | 11 of 12              | 12 of 12    | 12 of 12    | 11 of 12    | 12 of 12    |
| 1.1.0 average    | 3 of 12               | 5 of 12     | 9 of 12     | 7 of 12     | 10 of 12    |
| 1.1.0 slow       | 3 of 12               | 3 of 12     | 3 of 12     | 8 of 12     | 10 of 12    |
| 1.1.0 struggling | 0 of 12               | 0 of 12     | 0 of 12     | 2 of 12     | 2 of 12     |
| 1.2.0 average    | 3 of 18               | 3 of 18     | 3 of 18     | 4 of 18     | 5 of 18     |

On the slice the shipped rule takes 5 days for the average child. With more content it fails
because the items of later friends are not reviewed often enough to reach silver (§5.1); relaxing
the rule helps on 1.1.0 and hardly on 1.2.0. With the pacing of §6 friends grow again, and 70 %
bronze grows the lagoon's within days of Murena and the others within 2-6 weeks of their monster
(§6.5). Effort-only variants (3 days for silver) were weaker than 70 % bronze in every run.

### 5.6 Check (b): a 4th grader's first sessions

The golden trace `test/traces/fourth-grader.test.ts` proves it on the rules' fixture: Kořínek
hatches in the first session, and the chosen lagoon egg hatches in a later session after Svačinka's
first tastes, before the other lagoon eggs. On S3's 1.2.0 the simulation agrees: both 4th graders
hatch Kořínek on day 0 and Želva on day 3.

### 5.7 Fluency and the reading allowance

The slow child is never quick, yet on 1.0.0 and 1.1.0 it brought one or two items to gold
(`spell:vila:1`, `spell:dexti:3`): typed gaps in long sentences. A sentence adds 1 s a word to both
limits, and the slow child reads a word in 0.9 s, so in a sentence of 8 words or more its typing
comes out fast. On 1.2.0 it reached no gold. The design wants reading never to make an answer slow;
the cost is this small leak. Either accept it, or allow 0.8 s a word (`perSentenceWordMs`).

### 5.8 Eggs from placed levels

A 4th grader receives the eggs of every level the placement check places, up to eight at once.
They hatch from Svačinka's first tastes, three a snack, the chosen egg's first, so the others follow
one by one over 7-18 sessions, which the hatch-pace check (5 sessions) counts as late. A drip of
hatching is not bad for a child who skipped a grade; proposed: judge the pace of eggs received in
play only, and report placed eggs separately.

### 5.9 The perfect child's pace

The perfect child plays one level after another while its success is 100 %: 77 levels by day 45 on
1.2.0 (target 28 days, Dragon Valley's for 59 levels). Any pacing that keeps up the reviews slows it
further (§6).

### 5.10 A 3rd grader in the deep

Freeing Ledana opens the deep, and the adventure then suggests its levels to a 3rd grader too. The
struggling child gets there on day 66 and its success falls to 41-50 % on 4th-grade spelling it was
never taught. Whether a 3rd grader should be led into the deep, or only invited, is a design
question; pacing by success (§6) holds it back there anyway.

## 6. Experiments

Each experiment changes one thing against the shipped rules, on the same seed; §6.4 and §6.5
combine them.

| Name | Change                                                                                                                            | Kind                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| E1   | intervals 0, 1, 3, 7, 14, 30 days (shipped: 0, 1, 2, 4, 8, 16)                                                                    | balance                |
| E3   | `mix.knownShare` 80 (shipped 70)                                                                                                  | balance                |
| R6   | `STARVING_BOARDS` 6 (shipped 3)                                                                                                   | rules (`view.ts`)      |
| R10  | `STARVING_BOARDS` 10                                                                                                              | rules                  |
| X1   | Svačinka serves the likeliest successes first below `mix.successTarget` (shipped: below 70 %)                                     | rules (`problems.ts`)  |
| X2   | due reviews least overdue first (shipped: most overdue first; starving items still first)                                         | rules (`selection.ts`) |
| P1   | the day's new levels wait while more than 40 items are due                                                                        | rules (`view.ts`)      |
| P2   | the day's new levels wait while recent success is below 70 % or more than 40 items are due, except on every third day of practice | rules                  |
| P3   | P2 without the due count                                                                                                          | rules                  |
| B6   | boards for starving board-only items come before Svačinka's starving round, at most 6 a day (shipped: after it, at most 3)        | rules (`view.ts`)      |
| G70  | `grown` at 70 % bronze with the monster freed (shipped: 80 % silver)                                                              | balance (`growth`)     |

### 6.1 Balance alone (1.1.0)

| Run  | Average: success (in band) | Average: due | Average: longest overdue | Slow: due | Struggling: success | Average: grown at 70 % bronze |
| ---- | -------------------------- | ------------ | ------------------------ | --------- | ------------------- | ----------------------------- |
| base | 68 % (24 of 60)            | 127          | 16                       | 77        | 60 %                | 10 of 12                      |
| E1   | 69 % (27 of 60)            | 114          | 14                       | 48        | 60 %                | 10 of 12                      |
| E3   | 69 % (29 of 60)            | 112          | 20                       | 56        | 62 %                | 10 of 12                      |
| R6   | 69 % (24 of 60)            | 125          | 8                        | 73        | 60 %                | 9 of 12                       |
| R10  | 68 % (18 of 60)            | 123          | 7                        | 64        | 60 %                | 10 of 12                      |

Longer intervals shrink the slow child's backlog but within 12 weeks few items reach the long
intervals, so success does not move; on 1.2.0, E1 leaves every child's success where it was (68 %,
67 %, 55 %). More starving boards fix the board-only items on 1.1.0 (R10: 7 days) at up to 10
board rounds in a session.

### 6.2 Svačinka's order (1.1.0)

| Run  | Average: success (in band) | Slow: success (in band) | Struggling: success | Average: grown at 70 % bronze | Average: cloudy pearls |
| ---- | -------------------------- | ----------------------- | ------------------- | ----------------------------- | ---------------------- |
| base | 68 % (24 of 60)            | 70 % (29 of 60)         | 60 %                | 10 of 12                      | 159                    |
| X1   | 74 % (46 of 60)            | 78 % (42 of 60)         | 63 %                | 6 of 12                       | 192                    |
| X2   | 75 % (45 of 60)            | 78 % (43 of 60)         | 60 %                | 5 of 12                       | 248                    |

Both bring the average and slow children into the band and both review old items less: friends
grow more slowly and more pearls stay cloudy. They treat the symptom; the load stays.

### 6.3 Pacing (1.2.0)

| Run  | Child      | Success (in band) | Levels in 84 days | Ledana (day) | Due | Grown: shipped / 70 % bronze |
| ---- | ---------- | ----------------- | ----------------- | ------------ | --- | ---------------------------- |
| base | perfect    | 100 %             | 77                | 22           | 285 | 11 / 14 of 18                |
|      | average    | 68 % (22 of 60)   | 77                | 32           | 157 | 3 / 5 of 18                  |
|      | slow       | 67 % (16 of 60)   | 77                | 38           | 109 | 0 / 4 of 18                  |
|      | struggling | 55 % (4 of 48)    | 55                | 66           | 9   | 0 / 0 of 14                  |
| P1   | perfect    | 100 %             | 53                | 59           | 196 | 11 / 13 of 14                |
|      | average    | 78 % (54 of 60)   | 27                | -            | 121 | 3 / 4 of 10                  |
|      | slow       | 85 % (49 of 60)   | 17                | -            | 85  | 4 / 4 of 5                   |
|      | struggling | 69 % (23 of 48)   | 8                 | -            | 11  | 2 / 2 of 3                   |
| P2   | perfect    | 100 %             | 64                | 44           | 261 | 12 / 14 of 15                |
|      | average    | 71 % (35 of 60)   | 40                | -            | 115 | 5 / 8 of 12                  |
|      | slow       | 75 % (34 of 60)   | 38                | -            | 78  | 3 / 8 of 11                  |
|      | struggling | 65 % (12 of 48)   | 26                | -            | 6   | 2 / 2 of 7                   |
| P3   | average    | 69 % (25 of 60)   | 77                | 36           | 158 | 3 / 5 of 18                  |
|      | slow       | 66 % (18 of 60)   | 77                | 42           | 75  | 0 / 4 of 18                  |
|      | struggling | 60 % (4 of 48)    | 41                | -            | 11  | 0 / 2 of 12                  |

- **P1** counts every due item, learning items too, so for most children the count never falls
  below 40 and new levels all but stop (the struggling child plays 8).
- **P3** holds little: recent success counts the last 20 answers, and the day's first Svačinka
  usually lifts them above 70 % before the level is chosen.
- **P2** works for every child: success rises (the struggling child above its floor), friends grow
  again, and the backlog grows more slowly (the average child's levels off at about 120 known items
  due from week 7). The price is speed: the average child plays 40 levels in 12 weeks and the
  perfect child frees Ledana on day 44.

### 6.4 Combined (1.2.0)

| Run      | Child      | Success (in band) | Levels in 84 days | Due | Longest overdue | Grown at 70 % bronze |
| -------- | ---------- | ----------------- | ----------------- | --- | --------------- | -------------------- |
| P2+X1    | perfect    | 100 %             | 64                | 261 | 58              | 14 of 15             |
|          | average    | 77 % (47 of 60)   | 41                | 98  | 35              | 9 of 12              |
|          | slow       | 75 % (49 of 60)   | 38                | 81  | 34              | 6 of 11              |
|          | struggling | 67 % (17 of 48)   | 27                | 9   | 6               | 2 of 10              |
| P2+X1+E1 | average    | 71 % (36 of 60)   | 45                | 126 | 18              | 10 of 12             |
|          | slow       | 79 % (44 of 60)   | 39                | 95  | 17              | 6 of 12              |
|          | struggling | 67 % (20 of 48)   | 28                | 10  | 6               | 0 of 10              |

X1 adds what P2 lacks for the average child: 47 of its 60 sessions are in the band (78 %; the
target is 75 %), with friends still growing (9 of 12). The longer intervals (E1) on top cut the
board-only waits but bring the average child's success back to 71 %: a review comes later, after
more forgetting. Within 12 weeks they do not earn their place; whether they do over a school year
needs a year-long run.

Pacing has two side effects. An egg that arrives for a later lesson waits for it: Hvězdice
Rodinka's egg took 6-7 sessions to hatch (the check asks 5). And the board-only items still starve
(35 days), since a paced day spends its time on Svačinka; B6 is for them.

### 6.5 The proposal

P2, X1, B6 and G70 together, on 1.2.0 (seed `simulation`):

| Child      | Success per session (in band) | Levels in 84 days | Due | Longest overdue | Grown (70 % bronze) | Coins | Board rounds a session |
| ---------- | ----------------------------- | ----------------- | --- | --------------- | ------------------- | ----- | ---------------------- |
| perfect    | 100 %                         | 64 (Ledana 44)    | 248 | 32              | 15 of 15            | 117   | 1 / 4 / 10             |
| average    | 56 / 75 / 91 % (41 of 60)     | 42                | 100 | 8               | 8 of 12             | 81    | 1 / 4 / 8              |
| slow       | 33 / 75 / 93 % (46 of 60)     | 42                | 81  | 9               | 7 of 12             | 73    | 0 / 4 / 8              |
| struggling | 45 / 67 / 85 % (17 of 48)     | 27                | 9   | 6               | 2 of 10             | 43    | 0 / 1 / 4              |

Against the shipped rules (§4.3): every child's success rises (average 68 → 75 %, slow 67 → 75 %,
struggling 55 → 67 %), board-only items wait 8-9 days instead of 32-70, the average child's known
items due at a session's start fall from 157 to 100, and friends grow up: the average child's
lagoon friends 1-2 days after Murena, the others 2-6 weeks after their monster (8 of 12 by day 84,
against 3 of 18). The average child plays about 3.5 levels a week, so the 3rd grade's 46 levels take
about 13 weeks; the struggling child plays about 2 a week.

What it does not reach: 41 of the average child's 60 sessions are in the band (68 %, target 75 %;
P2+X1 without B6 had 47 of 60, on this one seed); the longest wait is 8-9 days (target 7); the
average child's coins are 81 a session (design 50-80: B6's boards pay coins too); the perfect child
does not reach the finale in 12 weeks. With E1 as well, the perfect child frees the Krakatice on day
83 and grows all 18 friends, the average child frees Ledana on day 78 and its board-only items wait
7 days at most, but its success is 73 % (39 of 60 in the band).

**Over five seeds** (`simulation`, `s2`-`s5`; the average and struggling children, 84 days on
1.2.0), the shipped rules and the proposal, as min-max over the seeds:

| Measure                                    | Shipped rules | Proposal |
| ------------------------------------------ | ------------- | -------- |
| Average: success per session (median)      | 68 % (all 5)  | 71-75 %  |
| Average: sessions at 70-90 % (of 60)       | 20-25         | 34-42    |
| Average: longest overdue (days)            | 43-61         | 7-9      |
| Average: friends grown (of those freed)    | 2-3 of 18     | 8-10     |
| Average: levels in 84 days                 | 77            | 42-46    |
| Average: coins per session (median)        | 66-71         | 80-86    |
| Struggling: success per session (median)   | 54-60 %       | 67-71 %  |
| Struggling: levels in 84 days              | 55-60         | 27-33    |
| Struggling: friends grown (of those freed) | 0             | 2-3      |

The gains hold on every seed. So do the two misses: the band (34-42 sessions of 60, against 45 for
75 %) and coins a little above design's 80. The band is the closer of the two to reach, and the
next lever is the mix's own target: Svačinka now aims at 82 % while the band asks only for 70-90 %.

**Proposed**, and approved on 2026-11-01 (the rules changes follow with tests and design text):

1. **Pacing** (P2, design §4.2): the day's new levels wait while recent success is below 70 % or
   more than 40 items are due for review, and come anyway on every third day of practice. A level
   under way always continues, and every open level stays playable from the map.
2. **Svačinka aims at the target** (X1, design §6.3): below `mix.successTarget` (82 %) it serves the
   likeliest successes first, not only below 70 %.
3. **Boards for starving board-only items first** (B6, design §4.2, §6.3): before Svačinka's
   starving round, at most 6 a day.
4. **`grown` at 70 % bronze** with the monster freed (G70, balance `growth`; check a).
5. **Targets** (§3): no dead end as a structural check; a pace per grade (the average 3rd grader
   frees Ledana within 16 weeks, the perfect child within 8); the steady path's weekly new level
   without the ¾ floor; check (a) at 6 weeks from the monster; the hatch pace for eggs received in
   play (§5.8).
6. **Intervals**: keep 0, 1, 2, 4, 8, 16 for now, and decide E1 on a year-long run.
7. **Coins**: measure again once the rules are agreed; if the average child still earns more than
   80 a session, trim the balance's coin rates (`coins`).

## 7. Limits

- **Models.** The children are models with Dragon Valley's learning numbers and priors chosen from
  the curriculum, not measured children. Comparisons between balances are the robust part; the
  playtest (testing.md §6) checks the model.
- **Seeds.** The shipped rules and the proposal were run over five seeds for the average and
  struggling children (§6.5); every other run uses seed `simulation`, so differences of a few
  points between experiments may be noise (Dragon Valley's five-seed spreads were 1-4 points).
- **Session length.** A session is a number of answers; boards and stories are not timed. More
  board rounds make a real session longer (R10 and the proposal: up to 8-10 in a session).
- **Previews.** 1.1.0 and 1.2.0 are S3's previews; their pull requests may still change them.
- **The 4th grader** was simulated for 28 days only, on the first 1.2.0 preview.
