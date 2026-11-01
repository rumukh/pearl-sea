/**
 * Problem rounds: Krmení, Inkoustová věta, Lov chyb, Určování, the monster battle, Svačinka, the
 * race and the placement check. One problem is on screen at a time and is answered step by step
 * (a gap per step; find, then fix for Lov chyb). Each step is graded, credits its item (a gap its
 * own item; the find and the fix of a mistake together credit the fix's item once, a miss if
 * either was wrong), pays coins, counts for the day, washes ink in a battle and may schedule a
 * re-ask job about `balance.reask.delay` turns later (at most `balance.reask.maxPerRound` per
 * round, never in the placement check or the race). A wrong step shows the answer and the next
 * step follows: nobody is stuck. Re-ask jobs are anchored to the round's runtime phase, so leaving
 * the round cancels any that have not fired.
 *
 * Which item comes next is learning/selection.ts: re-asks first, then the activity's draw (the
 * mix for Krmení and the lessons, the arms and the spaced review of a battle, due reviews and
 * first tastes for Svačinka, the current ladder step for placement, known items for the race).
 * A round whose draw comes back empty serves nothing and finishes.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import { EVENTS, expectedAnswer, gradeBalance, isCorrectAnswer, problemSteps } from '../contract';
import type {
  AnswerValue,
  BattleProgress,
  InputMode,
  ItemState,
  PlacementProgress,
  Problem,
  ProblemActivityKind,
  ProblemRound,
  ResolvedInputMode,
  ResponseBucket,
  RoundSource,
  Skill,
} from '../contract';
import { canGenerate, problemFor, servableIndex } from '../learning/generate';
import type { ProblemRequest } from '../learning/generate';
import { creditItem } from '../learning/credit';
import { itemsOf, lexiconIndex, sortText } from '../learning/index-cache';
import { teachUnitItems, teachUnits } from '../learning/item-info';
import { isDue, letterCount, responseBucket, worseBucket } from '../learning/items';
import {
  blockedKeys,
  focusItems,
  lowSuccess,
  belowTarget,
  missedTwice,
  pickMixed,
  pickPlacement,
  pickRace,
  pickReview,
  pickSnack,
  withoutBlocked,
} from '../learning/selection';
import { questProgress, recordAnswer } from '../economy/daily';
import { earnCoins } from '../economy/rewards';
import { basketItems, firstTastes, servableItems, taughtItems } from './friends';
import { advanceLadder, ladderDone, placementFor } from './ladder';
import { isComplete } from './levels';
import type { Ctx, Data, Index, ReadState } from '../types';

/** A phase allowance large enough that rounds are never limited by it. */
export const ROUND_ALLOWANCE = 1_000_000;
/** First tastes a snack serves at most (items taught but never answered, every other problem). */
export const TASTES_PER_SNACK = 3;
/** Items remembered per round (the state schema's cap), for no-repeat and served-first draws. */
const RECENT_LIMIT = 20;
/** Right answers between a monster's jokes. */
export const JOKE_EVERY = 5;
/** Activities the Inkoustíci ambush (design §7.4): never a battle, the race or the placement. */
export const AMBUSH_ACTIVITIES: readonly ProblemActivityKind[] = [
  'feeding',
  'ink-sentence',
  'bug-hunt',
  'analysis',
  'snack',
];

/** Integer division rounded down for non-negative operands. */
function quotient(a: number, b: number): number {
  return (a - (a % b)) / b;
}

export function activeProblemRound(ctx: Ctx): ProblemRound | null {
  const round = ctx.state.round;
  return round !== null && round.type === 'problems' && round.status === 'active' ? round : null;
}

export function skillById(data: Data, id: string): DeepReadonly<Skill> | undefined {
  return data.skills.find((skill) => skill.id === id);
}

/** Problem skills of `skills` this build can serve something of. */
export function playableSkills(data: Data, skills: readonly string[]): string[] {
  const served = servableIndex(data);
  return skills.filter((id) => {
    const skill = skillById(data, id);
    return skill !== undefined && canGenerate(skill) && (served.get(id)?.length ?? 0) > 0;
  });
}

/** The items the problem skills `skills` can serve (sorted, unique). */
export function poolOf(data: Data, skills: readonly string[]): string[] {
  return itemsOf(skills, servableIndex(data));
}

/**
 * A problem skill that can serve `item`: the round's own first, else any in the pack. When several
 * of the round's skills serve the item, `random` picks one, so every skill of the activity is used.
 */
export function skillFor(
  data: Data,
  skills: readonly string[],
  item: string,
  random?: RandomStream,
): DeepReadonly<Skill> | undefined {
  const served = servableIndex(data);
  const serves = (id: string) => served.get(id)?.includes(item) ?? false;
  const own = playableSkills(data, skills).filter(serves);
  if (own.length > 0) {
    return skillById(data, own.length > 1 && random ? random.pick(own) : own[0]!);
  }
  return data.skills.find((skill) => canGenerate(skill) && serves(skill.id));
}

/** The level activity a round plays, if it comes from a level. */
export function roundActivity(data: Data, round: DeepReadonly<{ source: RoundSource }>) {
  const source = round.source;
  return source.kind === 'level'
    ? data.levels.find((l) => l.id === source.level)?.activities[source.activity]
    : undefined;
}

/** The monster a battle round fights. */
export function battleMonster(data: Data, round: DeepReadonly<ProblemRound>) {
  return round.battle === null
    ? undefined
    : data.monsters.find((monster) => monster.id === round.battle!.monster);
}

/**
 * Problems a battle asks at most, the kindness cap (design §7.1): its activity's `count`, and
 * never fewer than `meter + 5`, so a few misses never keep the monster inked.
 */
export function battleCap(data: Data, round: DeepReadonly<ProblemRound>): number {
  const target = round.battle?.target ?? 1;
  return Math.max(roundActivity(data, round)?.count ?? target, target + BATTLE_SPARE);
}

/** Problems a battle allows beyond its meter at least. */
export const BATTLE_SPARE = 5;

/** The arm a battle is washing now (0-based): ⌊washed × arms / target⌋, the last one at most. */
export function currentArm(battle: DeepReadonly<BattleProgress>): number {
  return Math.min(battle.arms - 1, quotient(battle.washed * battle.arms, battle.target));
}

/** In a many-armed battle, the skill of the arm being washed (design §7.2), else `null`. */
function armSkill(data: Data, round: DeepReadonly<ProblemRound>): string | null {
  const battle = round.battle;
  if (battle === null || battle.arms <= 1) return null;
  return roundActivity(data, round)?.skills[currentArm(battle)] ?? null;
}

export function startProblemRound(
  ctx: Ctx,
  index: Index,
  options: {
    activity: ProblemActivityKind;
    source: RoundSource;
    skills: string[];
    input: InputMode;
    target: number | null;
    battle: BattleProgress | null;
    placement?: PlacementProgress;
  },
): void {
  ctx.state.roundCounter += 1;
  const id = `r${ctx.state.roundCounter}`;
  ctx.enterPhase('round', ROUND_ALLOWANCE, 'cancel');
  ctx.state.round = {
    id,
    type: 'problems',
    activity: options.activity,
    source: options.source,
    skills: options.skills,
    input: options.input,
    target: options.target,
    asked: 0,
    answered: 0,
    correct: 0,
    fast: 0,
    streak: 0,
    bestStreak: 0,
    reasks: 0,
    ambushes: 0,
    queue: [],
    recent: [],
    current: null,
    feedback: null,
    coins: 0,
    battle: options.battle,
    placement: options.placement ?? null,
    status: 'active',
    endReason: null,
  };
  ctx.emit(EVENTS.roundStarted, { round: id, activity: options.activity });
  if (options.battle !== null) {
    const monster = ctx.content.data.monsters.find((m) => m.id === options.battle!.monster);
    const joke = monster?.jokes[0];
    if (monster && joke !== undefined) {
      ctx.emit(EVENTS.monsterJoked, { monster: monster.id, joke });
    }
  }
  serveNext(ctx, index);
}

/** The round has nothing more to ask: target reached, meter full or capped, ladder over. */
export function roundDone(
  state: ReadState,
  data: Data,
  round: DeepReadonly<ProblemRound>,
): boolean {
  if (round.placement !== null) {
    return ladderDone(round.placement, placementFor(data, state.settings.grade), round.asked);
  }
  if (round.battle !== null) {
    return round.battle.washed >= round.battle.target || round.asked >= battleCap(data, round);
  }
  if (round.activity === 'race') return round.asked >= data.balance.race.maxProblems;
  return round.target !== null && round.asked >= round.target;
}

/** Known items outside the round's own pool, for a battle's spaced review. */
function reviewItems(state: ReadState, data: Data, pool: ReadonlySet<string>): string[] {
  const servable = servableItems(data);
  return Object.keys(state.items)
    .filter((item) => !pool.has(item) && state.items[item]!.correct > 0 && servable.has(item))
    .sort(sortText);
}

/** The round's next item from its activity's draw, or `null` when it has nothing left to serve. */
function chooseItem(
  ctx: Ctx,
  round: ProblemRound,
  index: Index,
  random: RandomStream,
): string | null {
  const state = ctx.state;
  const data = ctx.content.data;
  const blocked = blockedKeys(data, round.recent, data.balance.mix.noRepeatWithin);
  const served = round.recent;
  if (round.placement !== null) {
    const step = placementFor(data, state.settings.grade).steps[round.placement.step]!;
    const pool = poolOf(data, [step.skill]);
    // Every other problem of a step prefers the chosen egg's items (design §9.2).
    const focus = round.placement.stepAsked % 2 === 0 ? focusItems(state, data, index, pool) : null;
    return pickPlacement({ state, data, pool, blocked, served, random, focus });
  }
  let pool = poolOf(data, round.skills);
  // Below the success band, reviews serve the likeliest successes first (Svačinka below the target).
  const protect = lowSuccess(state, data);
  if (round.activity === 'snack') {
    const friend = round.source.kind === 'snack' ? round.source.friend : null;
    if (round.source.kind === 'snack' && friend === null) {
      // Feeding every friend empties Osmička's basket too: due items no hatched friend eats.
      const basket = basketItems(state, data, index).filter((item) => !pool.includes(item));
      pool = [...pool, ...basket];
    }
    // Only items the child has met or was taught, and those it was taught but never answered
    // as first tastes, at every other problem.
    const taught = taughtItems(state, data, index);
    pool = pool.filter((item) => state.items[item] !== undefined || taught.has(item));
    const tastes = firstTastes(state, data, index, friend, taught);
    pool = [...pool, ...tastes.filter((item) => !pool.includes(item))];
    return pickSnack({
      state,
      data,
      pool,
      blocked,
      served,
      random,
      // Svačinka aims at the success target: below it, the likeliest successes first (§6.3).
      likelyFirst: belowTarget(state, data),
      tastes,
      tastesPerSnack: TASTES_PER_SNACK,
    });
  }
  if (round.activity === 'race') return pickRace({ state, data, pool, blocked, served, random });
  const activity = roundActivity(data, round);
  if (round.activity === 'feeding' && activity?.options['draw'] === 'weakest') {
    return pickSnack({ state, data, pool, blocked, served, random, likelyFirst: protect });
  }
  if (round.battle !== null && activity !== undefined) {
    const battle = round.battle;
    if (battle.arms > 1) {
      // One arm after another: arm k is washed with the battle's k-th skill (design §7.2).
      const own = playableSkills(data, [activity.skills[currentArm(battle)] ?? '']);
      const armPool = own.length > 0 ? poolOf(data, own) : pool;
      return pickMixed({ state, data, pool: armPool, blocked, served, focus: null, random });
    }
    const share = battleMonster(data, round)?.reviewShare ?? 0;
    if (random.int(0, 100) < share) {
      const review = withoutBlocked(data, reviewItems(state, data, new Set(pool)), blocked).filter(
        (item) => !blocked.has(item),
      );
      const day = state.day ?? 0;
      const due = review.filter((item) => isDue(state.items[item], day));
      const picked =
        pickReview(state, due, random, protect) ?? (review.length > 0 ? random.pick(review) : null);
      if (picked !== null) return picked;
    }
  }
  return pickMixed({
    state,
    data,
    pool,
    blocked,
    served,
    focus: focusItems(state, data, index, pool),
    random,
  });
}

/** Whether every gap of a problem can be typed on the Czech keyboard (letters and spaces). */
export function typeable(problem: Problem): boolean {
  const gaps =
    problem.kind === 'gaps' ? problem.gaps : problem.kind === 'mistake' ? [problem.fix] : [];
  return gaps.length > 0 && gaps.every((gap) => /^[\p{L} ]+$/u.test(gap.correct));
}

/**
 * The input a problem is asked with (design §5.2): the round's mode (`auto`: choice below
 * `lettersFromBox`, the letter pad below `typedFromBox`, then typing), the letter pad where the
 * answer cannot be typed (end marks), by choice when retrieval is made `easier` (a review or
 * re-ask while recent success is low), and at least the letter pad in the race and the placement
 * check (`atLeastLetters`), where a guess between two buttons measures nothing. Problems without
 * gaps (classifications, odd ones, relations) are always picked.
 */
export function inputFor(options: {
  round: InputMode;
  box: number;
  lettersFromBox: number;
  typedFromBox: number;
  easier: boolean;
  gaps: boolean;
  typeable: boolean;
  atLeastLetters: boolean;
}): ResolvedInputMode {
  if (!options.gaps) return 'choice';
  let resolved: ResolvedInputMode =
    options.round === 'auto'
      ? options.box < options.lettersFromBox
        ? 'choice'
        : options.box < options.typedFromBox
          ? 'letters'
          : 'typed'
      : options.round;
  if (resolved === 'typed' && !options.typeable) resolved = 'letters';
  if (options.easier && !options.atLeastLetters) return 'choice';
  if (options.atLeastLetters && resolved === 'choice') return 'letters';
  return resolved;
}

/** What a serving decision knows about the problem: its round and whether it is a re-ask. */
interface Serving {
  activity: ProblemActivityKind;
  /** The placement check (a measurement): served as is. */
  placement: boolean;
  reask: boolean;
}

/**
 * Whether retrieval is made easier (the problem is asked by choice): a re-ask or a review (a
 * snack, a due item) while recent success is `low`; never in the race or the placement check.
 */
export function easierRetrieval(serving: Serving & { due: boolean; low: boolean }): boolean {
  const { activity, placement, reask, due, low } = serving;
  return low && !placement && activity !== 'race' && (reask || due || activity === 'snack');
}

/**
 * Whether the item is taught before it is asked (design §6.4): the first problem of a listed
 * family, of a classification (and of each case), of a 4th-grade rule or a sentence rule, which
 * the child meets for the first time (no item of that unit answered or credited by a board yet),
 * or any item whose last two answers were misses. Not in the race or the placement check.
 */
export function teachFirst(
  state: ReadState,
  data: Data,
  serving: Serving & { item: string; record: DeepReadonly<ItemState> | undefined },
): boolean {
  if (serving.placement || serving.activity === 'race') return false;
  if (missedTwice(serving.record)) return true;
  if (serving.record !== undefined) return false;
  const units = teachUnitItems(data);
  return teachUnits(data, serving.item).some((unit) =>
    (units.get(unit) ?? []).every((item) => state.items[item] === undefined),
  );
}

/** The Inkoustík ambushing the next problem, drawn from the `ambush` stream, or `null`. */
function drawAmbush(
  ctx: Ctx,
  round: ProblemRound,
  problem: { index: number; reask: boolean; teach: boolean },
): string | null {
  const data = ctx.content.data;
  const ambush = data.balance.ambush;
  if (!AMBUSH_ACTIVITIES.includes(round.activity) || data.inkoustici.length === 0) return null;
  if (round.ambushes >= ambush.maxPerRound || !isComplete(ctx.state, ambush.unlockAfter)) {
    return null;
  }
  if (problem.reask || problem.teach || problem.index < ambush.minIndex) return null;
  const random = ctx.random('ambush');
  if (random.int(0, 100) >= ambush.chance) return null;
  return random.pick(data.inkoustici).id;
}

/**
 * Serve the next problem: a fired re-ask first, else a fresh draw. When the round has nothing
 * left to serve, nothing is put on screen and the round finishes (`settleRound` in the adapter).
 */
export function serveNext(ctx: Ctx, index: Index): void {
  const round = activeProblemRound(ctx);
  if (!round) return;
  const data = ctx.content.data;
  const problems = ctx.random('problems');
  const skillIds =
    round.placement !== null
      ? [placementFor(data, ctx.state.settings.grade).steps[round.placement.step]!.skill]
      : round.skills;
  let queued: string | undefined;
  let item: string | null = null;
  let skill: DeepReadonly<Skill> | undefined;
  // A many-armed battle asks a fresh item through the arm's own skill (design §7.2); a re-ask
  // through any of the battle's skills (its item came from an earlier arm).
  const arm = round.placement === null ? armSkill(data, round) : null;
  for (let guard = 0; guard < 4 && skill === undefined; guard++) {
    queued = round.queue.shift();
    item = queued ?? chooseItem(ctx, round, index, problems);
    if (item === null) return;
    const armServes =
      arm !== null &&
      queued === undefined &&
      (servableIndex(data).get(arm)?.includes(item) ?? false);
    skill = skillFor(data, armServes ? [arm] : skillIds, item, problems);
  }
  if (item === null || skill === undefined) return;
  const balance = gradeBalance(data.balance, ctx.state.settings.grade);
  const measure = round.placement !== null || round.activity === 'race';
  const request: ProblemRequest = { single: measure, alone: queued !== undefined };
  const problem = problemFor(
    skill,
    item,
    {
      problems,
      distractors: ctx.random('distractors'),
      words: ctx.random('words'),
      data,
      choices: balance.input.choices,
    },
    request,
  );
  const record = ctx.state.items[item];
  const serving = {
    activity: round.activity,
    placement: round.placement !== null,
    reask: queued !== undefined,
  };
  const input = inputFor({
    round: round.input,
    box: record?.box ?? 0,
    lettersFromBox: data.balance.input.lettersFromBox,
    typedFromBox: data.balance.input.typedFromBox,
    easier: easierRetrieval({
      ...serving,
      due: isDue(record, ctx.state.day ?? 0),
      low: lowSuccess(ctx.state, data),
    }),
    gaps: problem.kind === 'gaps' || problem.kind === 'mistake',
    typeable: typeable(problem),
    atLeastLetters: measure,
  });
  const teach = teachFirst(ctx.state, data, { ...serving, item, record });
  round.asked += 1;
  round.recent = [...round.recent, item].slice(-RECENT_LIMIT);
  const ambush = drawAmbush(ctx, round, { index: round.asked, reask: serving.reask, teach });
  if (ambush !== null) {
    round.ambushes += 1;
    ctx.emit(EVENTS.inkoustikAmbushed, { inkoustik: ambush, item });
  }
  round.current = {
    index: round.asked,
    item,
    problem,
    input,
    step: 0,
    reask: serving.reask,
    hinted: false,
    teach,
    ambush,
  };
}

/** The input of one step: gap steps use the problem's input; picks are always choice. */
export function stepInput(
  problem: Problem,
  step: number,
  input: ResolvedInputMode,
): ResolvedInputMode {
  if (problem.kind === 'gaps') return input;
  if (problem.kind === 'mistake') return step === 1 ? input : 'choice';
  return 'choice';
}

/**
 * The reading time a problem shown with a sentence allows (design §6.2: time the spelling, not
 * the reading): its words × `response.perSentenceWordMs`, for the first step only (later steps
 * of the same sentence need no second reading).
 */
export function readingAllowance(data: Data, problem: Problem, step: number): number {
  if (step !== 0) return 0;
  const perWord = data.balance.response.perSentenceWordMs;
  const lexicon = lexiconIndex(data);
  if (problem.kind === 'gaps') {
    return problem.sentence === null
      ? 0
      : (lexicon.sentences.get(problem.sentence)?.words.length ?? 0) * perWord;
  }
  if (problem.kind === 'mistake') {
    return (
      (lexicon.sentences.get(problem.sentence)?.words.length ?? problem.tokens.length) * perWord
    );
  }
  if (problem.kind === 'classify') {
    if (problem.context !== null) return problem.context.tokens.length * perWord;
    return problem.target.text.includes(' ') ? problem.target.text.split(' ').length * perWord : 0;
  }
  return 0;
}

/** The item a step credits and its bucket, or `null` (a mistake's find step; a repeated gap). */
function stepCredit(
  round: ProblemRound,
  problem: Problem,
  step: number,
  item: string,
  bucket: ResponseBucket,
): { item: string; bucket: ResponseBucket } | null {
  if (problem.kind === 'gaps') {
    const gap = problem.gaps[step]!;
    const repeated = problem.gaps.slice(0, step).some((g) => g.item === gap.item);
    return repeated ? null : { item: gap.item, bucket };
  }
  if (problem.kind === 'mistake') {
    if (step === 0) return null;
    const find = round.feedback;
    const findBucket: ResponseBucket =
      find !== null && find.index === round.current!.index && find.step === 0
        ? find.bucket
        : 'miss';
    return { item: problem.fix.item, bucket: worseBucket(findBucket, bucket) };
  }
  return { item, bucket };
}

/** The item a step trains, for its feedback and events. */
function stepItem(problem: Problem, step: number, item: string): string {
  if (problem.kind === 'gaps') return problem.gaps[step]!.item;
  if (problem.kind === 'mistake') return problem.fix.item;
  return item;
}

/** Grade the answer to the current step (the `answer`/`placementAnswer` command's start). */
export function gradeAnswer(ctx: Ctx, value: AnswerValue, elapsedMs: number): void {
  const round = activeProblemRound(ctx)!;
  const current = round.current!;
  const data = ctx.content.data;
  const balance = gradeBalance(data.balance, ctx.state.settings.grade);
  const { problem, step } = current;
  const expected = expectedAnswer(problem, step);
  const correct = isCorrectAnswer(problem, step, value);
  const letters = expected.kind === 'text' ? letterCount(expected.value) : 1;
  const bucket = responseBucket(
    correct,
    elapsedMs,
    stepInput(problem, step, current.input),
    letters,
    balance,
    readingAllowance(data, problem, step),
  );
  const item = stepItem(problem, step, current.item);
  const credit = stepCredit(round, problem, step, current.item, bucket);
  // A mistake hunted right: both its steps right (the find's feedback is the one before this).
  const findRight =
    problem.kind !== 'mistake' ||
    step === 0 ||
    (round.feedback !== null && round.feedback.index === current.index && round.feedback.correct);
  if (credit !== null) creditItem(ctx, credit.item, credit.bucket);
  round.answered += 1;
  let coins = 0;
  const battle = round.battle;
  if (correct) {
    round.correct += 1;
    if (bucket === 'fast') round.fast += 1;
    round.streak += 1;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    ctx.state.bestStreak = Math.max(ctx.state.bestStreak, round.streak);
    coins = balance.coins.correct;
    earnCoins(ctx, balance.coins.correct, 'answer');
    if (round.streak % balance.coins.streakEvery === 0) {
      coins += balance.coins.streakBonus;
      earnCoins(ctx, balance.coins.streakBonus, 'streak');
    }
    ctx.emit(EVENTS.answerCorrect, {
      item,
      bucket: bucket as 'fast' | 'ok' | 'slow',
      streak: round.streak,
    });
    if (battle !== null && battle.washed < battle.target) washInk(ctx, battle);
  } else {
    round.streak = 0;
    ctx.emit(EVENTS.answerIncorrect, { item });
  }
  if (battle !== null && round.answered % data.balance.battle.splashEvery === 0) {
    battle.splashes += 1;
    ctx.emit(EVENTS.inkSplashed, { monster: battle.monster, blots: 1 });
  }
  const reaskable = round.placement === null && round.activity !== 'race' && !current.reask;
  if (credit?.bucket === 'miss' && reaskable && round.reasks < data.balance.reask.maxPerRound) {
    round.reasks += 1;
    const phase = ctx.phase!;
    const offset = ctx.turn - phase.enteredTurn + data.balance.reask.delay;
    ctx.schedule({
      id: `reask:${round.id}:${round.reasks}`,
      rule: 'reask',
      payload: { round: round.id, item: credit.item },
      anchor: { kind: 'phase-entry', instance: phase.instance, offset },
      phase: 'reask',
      priority: 0,
    });
    ctx.emit(EVENTS.reaskScheduled, { item: credit.item, dueTurn: phase.enteredTurn + offset });
  }
  let ambush: { inkoustik: string; splashed: boolean } | null = null;
  if (current.ambush !== null) {
    // The Inkoustík is splashed away by a right first answer, else it swims off (design §7.4).
    ambush = { inkoustik: current.ambush, splashed: correct };
    if (correct) {
      ctx.state.splashed += 1;
      coins += balance.coins.ambush;
      earnCoins(ctx, balance.coins.ambush, 'ambush');
      ctx.emit(EVENTS.inkoustikSplashed, {
        inkoustik: current.ambush,
        coins: balance.coins.ambush,
      });
      questProgress(ctx, 'splash-inkoustik', 1);
    }
    current.ambush = null;
  }
  round.coins += coins;
  recordAnswer(ctx, {
    correct,
    fast: bucket === 'fast',
    snack: round.activity === 'snack',
    streak: round.streak,
  });
  round.feedback = {
    index: current.index,
    item,
    step,
    correct,
    bucket,
    given: value,
    expected,
    coins,
    ambush,
  };
  if (step + 1 < problemSteps(problem)) {
    current.step = step + 1;
    return;
  }
  if (round.placement !== null) {
    advanceLadder(
      round.placement,
      placementFor(data, ctx.state.settings.grade),
      correct && findRight,
    );
  }
  round.current = null;
}

/** A right answer in a battle fires a bubble: ink washed, an arm clean, a joke every fifth. */
function washInk(ctx: Ctx, battle: BattleProgress): void {
  const before = currentArmCount(battle);
  battle.washed += 1;
  ctx.emit(EVENTS.inkWashed, {
    monster: battle.monster,
    washed: battle.washed,
    target: battle.target,
  });
  const after = currentArmCount(battle);
  if (battle.arms > 1 && after > before) {
    ctx.emit(EVENTS.armWashed, { monster: battle.monster, arm: after, arms: battle.arms });
  }
  const monster = ctx.content.data.monsters.find((m) => m.id === battle.monster);
  if (
    monster !== undefined &&
    monster.jokes.length > 0 &&
    battle.washed % JOKE_EVERY === 0 &&
    battle.washed < battle.target
  ) {
    ctx.emit(EVENTS.monsterJoked, {
      monster: monster.id,
      joke: monster.jokes[jokeIndex(battle.target, battle.washed, false) % monster.jokes.length]!,
    });
  }
}

/**
 * Which of a monster's jokes a battle tells, counting from 0 and cycling through the list: the
 * first at the start, the next after every 5th right answer while ink is left, and the next one
 * again when the monster is washed clean (by the meter or the kindness cap), so a joke never
 * repeats at once.
 */
export function jokeIndex(target: number, washed: number, freed: boolean): number {
  const told = quotient(Math.max(0, Math.min(washed, target - 1)), JOKE_EVERY);
  return freed ? told + 1 : told;
}

/** Arms already clean: ⌊washed × arms / target⌋. */
export function currentArmCount(battle: DeepReadonly<BattleProgress>): number {
  return quotient(battle.washed * battle.arms, battle.target);
}

export { sortText };
