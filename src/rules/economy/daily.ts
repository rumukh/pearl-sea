/**
 * The day: the daily record, the daily goal, the three daily quests and the 60-day history.
 *
 * A new day starts with `startSession` on a later date: today's record is created with the goal
 * from the settings and the day's quests drawn from the `rewards` stream (weighted by
 * `quest.weight`, from templates whose unlock level is complete, never two with the same goal).
 * Quests completed but not claimed on an earlier day are paid automatically when the next day
 * starts, so nothing earned is ever lost. Claims are idempotent: a claimed quest stays claimed.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS, isoDay } from '../contract';
import type { QuestGoal, QuestState, QuestTemplate } from '../contract';
import { isComplete } from '../progression/levels';
import { earnCoins } from './rewards';
import type { Ctx, Data, ReadState } from '../types';

export function questTemplate(data: Data, quest: { template: string }) {
  return data.quests.find((q) => q.id === quest.template);
}

/** Draw today's quests: weighted, without repeating a goal. */
export function drawQuests(ctx: Ctx, day: number): QuestState[] {
  const data = ctx.content.data;
  const random = ctx.random('rewards');
  let available: DeepReadonly<QuestTemplate>[] = data.quests.filter(
    (q) => q.unlock === null || isComplete(ctx.state, q.unlock),
  );
  const picked: QuestState[] = [];
  while (picked.length < data.balance.daily.quests && available.length > 0) {
    const total = available.reduce((sum, q) => sum + q.weight, 0);
    let roll = random.int(0, total);
    const template = available.find((q) => (roll -= q.weight) < 0) ?? available[0]!;
    picked.push({
      id: `${template.id}@${day}`,
      template: template.id,
      progress: 0,
      claimed: false,
    });
    available = available.filter((q) => q.goal !== template.goal);
  }
  return picked;
}

function payQuest(ctx: Ctx, quest: QuestState, template: DeepReadonly<QuestTemplate>): void {
  quest.claimed = true;
  ctx.state.questsClaimed += 1;
  earnCoins(ctx, template.coins, 'quest');
  ctx.emit(EVENTS.questClaimed, { quest: quest.id, coins: template.coins });
}

/** Start a new day: pay yesterday's finished quests, then today's record, quests and history. */
export function startDay(ctx: Ctx, day: number): void {
  const state = ctx.state;
  const data = ctx.content.data;
  for (const quest of state.daily?.quests ?? []) {
    const template = questTemplate(data, quest);
    if (template && !quest.claimed && quest.progress >= template.target) {
      payQuest(ctx, quest, template);
    }
  }
  state.daily = {
    day,
    answers: 0,
    correct: 0,
    fast: 0,
    levels: 0,
    minigames: 0,
    goal: state.settings.dailyGoal,
    quests: [],
    chest: 'locked',
  };
  state.daily.quests = drawQuests(ctx, day);
  state.history = [...state.history, { day, answers: 0, correct: 0, fast: 0 }].slice(
    -data.balance.daily.historyDays,
  );
}

/**
 * Advance today's quests of `goal`: add `amount`, or for `best-streak` raise the progress to
 * `amount`. Progress is capped at the target; reaching it emits `quest.completed` once.
 */
export function questProgress(ctx: Ctx, goal: QuestGoal, amount: number): void {
  const daily = ctx.state.daily;
  if (!daily || daily.day !== ctx.state.day || amount <= 0) return;
  for (const quest of daily.quests) {
    const template = questTemplate(ctx.content.data, quest);
    if (!template || template.goal !== goal || quest.progress >= template.target) continue;
    const next =
      goal === 'best-streak' ? Math.max(quest.progress, amount) : quest.progress + amount;
    quest.progress = Math.min(template.target, next);
    if (quest.progress >= template.target) ctx.emit(EVENTS.questCompleted, { quest: quest.id });
  }
}

/**
 * Count one thing done today towards the daily adventure's order: a completed level or a finished
 * minigame round.
 */
export function countToday(ctx: Ctx, what: 'levels' | 'minigames'): void {
  const daily = ctx.state.daily;
  if (daily && daily.day === ctx.state.day) daily[what] += 1;
}

/**
 * Make the treasure chest ready once today's right answers reach the goal. Checked after answers
 * and after a grown-up changes the goal, so lowering the goal below today's count still opens it.
 */
export function checkDailyGoal(ctx: Ctx): void {
  const daily = ctx.state.daily;
  if (daily && daily.chest === 'locked' && daily.correct >= daily.goal) {
    daily.chest = 'ready';
    ctx.emit(EVENTS.dailyGoalReached, { day: isoDay(daily.day) });
  }
}

/** Count one graded answer step for today: the record, the history, the quests and the goal. */
export function recordAnswer(
  ctx: Ctx,
  answer: { correct: boolean; fast: boolean; snack: boolean; streak: number },
): void {
  const state = ctx.state;
  const day = state.day ?? 0;
  if (state.daily && state.daily.day === day) {
    state.daily.answers += 1;
    if (answer.correct) state.daily.correct += 1;
    if (answer.fast) state.daily.fast += 1;
  }
  const record = state.history[state.history.length - 1];
  if (record && record.day === day) {
    record.answers += 1;
    if (answer.correct) record.correct += 1;
    if (answer.fast) record.fast += 1;
  }
  if (answer.correct) {
    questProgress(ctx, 'correct-answers', 1);
    if (answer.fast) questProgress(ctx, 'fast-answers', 1);
    if (answer.snack) questProgress(ctx, 'feed-hungry', 1);
    questProgress(ctx, 'best-streak', answer.streak);
  }
  checkDailyGoal(ctx);
}

/** Why `claimQuest` is not possible now, or `null`. */
export function claimProblem(
  state: ReadState,
  data: Data,
  questId: string,
): { code: string; message: string } | null {
  const quest = state.daily?.quests.find((q) => q.id === questId);
  const template = quest ? questTemplate(data, quest) : undefined;
  if (!quest || !template || state.daily?.day !== state.day) {
    return { code: 'unknown-quest', message: "That is not one of today's quests." };
  }
  if (quest.claimed) return { code: 'quest-claimed', message: 'Already claimed.' };
  if (quest.progress < template.target) {
    return { code: 'quest-not-done', message: 'The quest is not finished yet.' };
  }
  return null;
}

export function claimQuest(ctx: Ctx, questId: string): void {
  const quest = ctx.state.daily!.quests.find((q) => q.id === questId)!;
  payQuest(ctx, quest, questTemplate(ctx.content.data, quest)!);
}
