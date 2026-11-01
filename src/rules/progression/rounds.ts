/**
 * Rounds and level runs: the shared lifecycle of problem and minigame rounds.
 *
 * A level run plays the level's activities in order; each activity is one round (a problem round
 * or a minigame round). A round ends when it is finished (`finished`, or `time-up` in the race),
 * quit, or stopped by the grown-ups' time limit; only a finished round completes its activity.
 * Activities this build cannot play (a board the content cannot make) are skipped, and the level
 * completes when the run first reaches its end: stars, star coins, first-time eggs and cosmetics,
 * the monster freed, region unlocks, story beats, quests, growth and stickers.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS, isMinigameKind } from '../contract';
import type { Level, MinigameActivityKind, ProblemActivityKind, RoundEndReason } from '../contract';
import { countToday, questProgress } from '../economy/daily';
import { awardStickers, earnCoins, grantEgg, grantItem } from '../economy/rewards';
import { itemsOf, perPack } from '../learning/index-cache';
import { canMakeBoard } from '../minigames/boards';
import { triggerBeats } from '../story/beats';
import { applyGrowth } from './friends';
import { monsterMilestones } from './grades';
import { openRegions, starsFor } from './levels';
import { startMinigameRound } from './minigame-rounds';
import { finishPlacement } from './placement';
import { jokeIndex, playableSkills, startProblemRound } from './problems';
import { finishRace } from './race';
import type { Ctx, Data, Index, ReadState } from '../types';

function levelOf(data: Data, id: string): DeepReadonly<Level> | undefined {
  return data.levels.find((level) => level.id === id);
}

/** Whether each level activity's board can be made, once per pack (it depends on content only). */
const boardPlayable: (data: Data) => Map<string, boolean> = perPack(() => new Map());

/** Whether this build can play activity `activityIndex` of `level`. */
export function canPlay(
  data: Data,
  level: DeepReadonly<Level>,
  activityIndex: number,
  index: Index,
  state: ReadState,
): boolean {
  const activity = level.activities[activityIndex];
  if (activity === undefined) return false;
  if (isMinigameKind(activity.kind)) {
    const key = `${level.id}#${activityIndex}`;
    const cache = boardPlayable(data);
    let playable = cache.get(key);
    if (playable === undefined) {
      const skills = data.skills.filter((skill) => activity.skills.includes(skill.id));
      playable = canMakeBoard(data, activity.kind, itemsOf(activity.skills, index), skills, state);
      cache.set(key, playable);
    }
    return playable;
  }
  return playableSkills(data, activity.skills).length > 0;
}

/** Start activity `activityIndex` of the active run (skipping it if it cannot be played). */
export function startRunActivity(ctx: Ctx, index: Index, activityIndex: number): void {
  const run = ctx.state.run!;
  const data = ctx.content.data;
  const level = levelOf(data, run.level)!;
  const skip = () => {
    const before = run.next;
    run.next = Math.max(run.next, activityIndex);
    advanceRun(ctx, index, before);
    if (run.next < level.activities.length && ctx.state.run) startRunActivity(ctx, index, run.next);
  };
  if (!canPlay(data, level, activityIndex, index, ctx.state)) {
    skip();
    return;
  }
  const activity = level.activities[activityIndex]!;
  const source = { kind: 'level' as const, level: level.id, activity: activityIndex };
  if (isMinigameKind(activity.kind)) {
    const started = startMinigameRound(ctx, index, {
      activity: activity.kind as MinigameActivityKind,
      source,
      skills: [...activity.skills],
      boards: activity.count,
    });
    if (!started) skip();
    return;
  }
  const monster =
    activity.kind === 'battle' ? data.monsters.find((m) => m.id === level.monster) : undefined;
  startProblemRound(ctx, index, {
    activity: activity.kind as ProblemActivityKind,
    source,
    skills: playableSkills(data, activity.skills),
    input: activity.input,
    target: monster ? null : activity.count,
    battle: monster
      ? {
          monster: monster.id,
          washed: 0,
          target: monster.meter,
          arms: monster.arms ?? 1,
          splashes: 0,
        }
      : null,
  });
}

/** Finish the active round, record its result and, at the end of a level, complete the level. */
export function completeRound(ctx: Ctx, index: Index, reason: RoundEndReason): void {
  const round = ctx.state.round;
  if (!round || round.status !== 'active') return;
  round.status = 'complete';
  round.endReason = reason;
  const finished = reason === 'finished' || reason === 'time-up';
  // The ink a battle's answers washed off, before the kindness cap's flourish.
  const washed = round.type === 'problems' && round.battle !== null ? round.battle.washed : 0;
  if (round.type === 'problems') {
    round.current = null;
    // The battle's kindness cap: a finished battle washes the last ink off with a flourish.
    if (round.battle !== null && finished) round.battle.washed = round.battle.target;
  }
  ctx.enterPhase('hub', 0, 'cancel');
  const answered = round.type === 'problems' ? round.answered : 0;
  const correct = round.type === 'problems' ? round.correct : 0;
  const fast = round.type === 'problems' ? round.fast : 0;
  ctx.emit(EVENTS.roundCompleted, { round: round.id, answered, correct, fast });
  if (round.type === 'problems' && round.placement !== null) {
    finishPlacement(ctx, round, finished);
  }
  if (round.type === 'problems' && round.activity === 'race' && finished) finishRace(ctx, round);
  if (round.type === 'minigame' && finished) {
    questProgress(ctx, 'play-minigame', 1);
    countToday(ctx, 'minigames');
  }
  const run = ctx.state.run;
  if (round.source.kind === 'level' && run && run.level === round.source.level) {
    const activity = round.source.activity;
    run.results = [
      ...run.results.filter((r) => r.activity !== activity),
      { activity, answered, correct, fast, completed: finished },
    ].sort((a, b) => a.activity - b.activity);
    if (finished) {
      const before = run.next;
      run.next = Math.max(run.next, activity + 1);
      advanceRun(ctx, index, before);
    }
  }
  if (round.type === 'problems' && round.battle !== null && finished) {
    // Washed clean, the monster tells one more joke (design §7.1).
    const battle = round.battle;
    const monster = ctx.content.data.monsters.find((m) => m.id === battle.monster);
    if (monster && monster.jokes.length > 0) {
      const joke = monster.jokes[jokeIndex(battle.target, washed, true) % monster.jokes.length]!;
      ctx.emit(EVENTS.monsterJoked, { monster: monster.id, joke });
    }
  }
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

/**
 * Skip activities this build cannot play, then complete the level when the run first reaches its
 * end. `before` is the run's next activity before this step: replaying an activity of a finished
 * run does not complete the level again (start the level again for a new run instead).
 */
function advanceRun(ctx: Ctx, index: Index, before: number): void {
  const run = ctx.state.run!;
  const level = levelOf(ctx.content.data, run.level)!;
  while (
    run.next < level.activities.length &&
    !canPlay(ctx.content.data, level, run.next, index, ctx.state)
  ) {
    const skipped = run.next;
    run.results = [
      ...run.results.filter((r) => r.activity !== skipped),
      { activity: skipped, answered: 0, correct: 0, fast: 0, completed: false },
    ].sort((a, b) => a.activity - b.activity);
    run.next += 1;
  }
  if (before < level.activities.length && run.next >= level.activities.length) {
    completeLevel(ctx, index);
  }
}

/** Complete the run's level: stars, coins for new stars, first-time rewards, monster, unlocks. */
export function completeLevel(ctx: Ctx, index: Index): void {
  const run = ctx.state.run!;
  const data = ctx.content.data;
  const level = levelOf(data, run.level)!;
  const regionsBefore = openRegions(ctx.state, data);
  const answered = run.results.reduce((sum, r) => sum + r.answered, 0);
  const correct = run.results.reduce((sum, r) => sum + r.correct, 0);
  const fast = run.results.reduce((sum, r) => sum + r.fast, 0);
  // A run with no answers earns stars by completion only when every activity was really played
  // (minigame-only levels); a run whose activities were all skipped counts as completed (1 star).
  const played = run.results.every((r) => r.completed);
  const stars =
    answered === 0 && !played
      ? 1
      : starsFor(answered, correct, fast, level.stars ?? data.balance.stars);
  const progress = ctx.state.levels[level.id] ?? {
    stars: 0,
    bestAccuracy: 0,
    plays: 0,
    placed: false,
    paidStars: 0,
  };
  const firstTime = progress.stars === 0;
  const accuracy = answered === 0 ? 100 : (correct * 100 - ((correct * 100) % answered)) / answered;
  ctx.state.levels[level.id] = {
    stars: Math.max(progress.stars, stars),
    bestAccuracy: Math.max(progress.bestAccuracy, accuracy),
    plays: progress.plays + 1,
    placed: progress.placed,
    paidStars: Math.max(progress.paidStars, stars),
  };
  for (let star = progress.paidStars + 1; star <= stars; star++) {
    earnCoins(ctx, level.rewards.coins[star - 1] ?? 0, 'stars');
  }
  if (firstTime) {
    for (const friend of level.rewards.eggs) grantEgg(ctx, friend);
    for (const item of level.rewards.cosmetics) grantItem(ctx, item, `level:${level.id}:${item}`);
  }
  ctx.emit(EVENTS.levelCompleted, { level: level.id, stars, firstTime });
  questProgress(ctx, 'finish-level', 1);
  countToday(ctx, 'levels');
  if (level.monster && !ctx.state.monsters[level.monster]) {
    ctx.state.monsters[level.monster] = { freedDay: ctx.state.day ?? 0 };
    earnCoins(ctx, data.balance.coins.monsterFreed, 'monster');
    ctx.emit(EVENTS.monsterFreed, { monster: level.monster });
    const monster = level.monster;
    triggerBeats(ctx, (t) => t.kind === 'monster-freed' && t.monster === monster);
    monsterMilestones(ctx, level.monster);
  }
  for (const region of openRegions(ctx.state, data)) {
    if (!regionsBefore.includes(region)) ctx.emit(EVENTS.regionUnlocked, { region });
  }
  triggerBeats(ctx, (t) => t.kind === 'level-complete' && t.level === level.id);
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

/** Close a finished round (and a finished run) to return to the map. */
export function closeRound(ctx: Ctx): void {
  const run = ctx.state.run;
  ctx.state.round = null;
  if (run) {
    const level = levelOf(ctx.content.data, run.level);
    if (!level || run.next >= level.activities.length) ctx.state.run = null;
  }
}
