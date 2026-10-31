/**
 * The placement check (Ukaž, co umíš, design §5.16, §9.2). It walks the ladder of
 * `content.placement.steps` for the child's grade with problems on the letter pad at least (no
 * re-asks, no hints taught first, single gaps); see ladder.ts. When it ends, every level of a
 * passed step is **placed**: completed with one star, replayable for more, with its
 * first-completion eggs and cosmetics given (stickers only for what the child did). Finishing the
 * check pays `balance.coins.placementDone` once; leaving it early keeps the levels placed so far
 * and marks the check skipped (grown-ups can re-run it).
 */
import { EVENTS } from '../contract';
import type { ProblemRound } from '../contract';
import { earnCoins, grantEgg, grantItem } from '../economy/rewards';
import { isComplete, openRegions } from './levels';
import { placementFor } from './ladder';
import { playableSkills, startProblemRound } from './problems';
import type { Ctx, Data, Index, ReadState } from '../types';

/** Why the placement check cannot start for the child's grade, or `null`. */
export function placementProblem(state: ReadState, data: Data): string | null {
  const first = placementFor(data, state.settings.grade).steps[0];
  return first === undefined || playableSkills(data, [first.skill]).length === 0
    ? 'There is no placement check for this grade.'
    : null;
}

export function startPlacement(ctx: Ctx, index: Index): void {
  const data = ctx.content.data;
  const ladder = placementFor(data, ctx.state.settings.grade);
  const skills = playableSkills(data, [...new Set(ladder.steps.map((s) => s.skill))]);
  startProblemRound(ctx, index, {
    activity: 'placement',
    source: { kind: 'placement' },
    skills,
    input: 'auto',
    target: null,
    battle: null,
    placement: { step: 0, stepAsked: 0, stepCorrect: 0, missesInRow: 0, placed: [] },
  });
}

/** Mark a level completed by placement and grant its first-completion rewards. */
function placeLevel(ctx: Ctx, levelId: string): void {
  const level = ctx.content.data.levels.find((l) => l.id === levelId);
  if (!level) return;
  const firstTime = !isComplete(ctx.state, level.id);
  const progress = ctx.state.levels[level.id] ?? {
    stars: 0,
    bestAccuracy: 0,
    plays: 0,
    placed: false,
    paidStars: 0,
  };
  ctx.state.levels[level.id] = { ...progress, stars: Math.max(progress.stars, 1), placed: true };
  if (!firstTime) return;
  for (const friend of level.rewards.eggs) grantEgg(ctx, friend);
  for (const item of level.rewards.cosmetics) grantItem(ctx, item, `level:${level.id}:${item}`);
}

/** End of the placement round: place the levels of passed steps; pay and mark the check. */
export function finishPlacement(ctx: Ctx, round: ProblemRound, finished: boolean): void {
  const state = ctx.state;
  const data = ctx.content.data;
  const regionsBefore = openRegions(state, data);
  const placed = round.placement?.placed ?? [];
  for (const level of placed) placeLevel(ctx, level);
  if (finished) {
    if (state.onboarding.placement !== 'done') {
      earnCoins(ctx, data.balance.coins.placementDone, 'placement');
    }
    state.onboarding.placement = 'done';
  } else if (state.onboarding.placement === 'pending') {
    state.onboarding.placement = 'skipped';
  }
  ctx.emit(EVENTS.placementCompleted, { placed: [...placed] });
  for (const region of openRegions(state, data)) {
    if (!regionsBefore.includes(region)) ctx.emit(EVENTS.regionUnlocked, { region });
  }
}
