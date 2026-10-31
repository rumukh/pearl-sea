/**
 * Levels and regions: completion, unlocks and stars.
 *
 * A level is complete when it has at least one star or was placed by the placement check. A level
 * is open when every level in its `unlock.after` is complete and its region is open; a region is
 * open when every level in its `unlock.after` is complete, a grown-up unlocked it ahead, it is the
 * start region of the child's grade, or it belongs to an earlier grade (free practice for a 4th
 * grader in the shallows, design §9.1). Unlocks are derived, never stored, so new content levels
 * slot in by data alone, and a grade change only moves the start and the suggestions.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { gradeStart, regionGrade } from '../contract';
import type { Level, LevelStatus, StarRule } from '../contract';
import type { Data, ReadState } from '../types';

export function isComplete(state: ReadState, level: string): boolean {
  const progress = state.levels[level];
  return progress !== undefined && (progress.stars >= 1 || progress.placed);
}

export function regionOpen(state: ReadState, data: Data, region: string): boolean {
  const found = data.regions.find((r) => r.id === region);
  if (!found) return false;
  return (
    state.settings.unlockAhead.includes(region) ||
    regionGrade(found) < state.settings.grade ||
    gradeStart(data, state.settings.grade) === region ||
    found.unlock.after.every((level) => isComplete(state, level))
  );
}

export function openRegions(state: ReadState, data: Data): string[] {
  return data.regions.filter((r) => regionOpen(state, data, r.id)).map((r) => r.id);
}

export function levelStatus(state: ReadState, data: Data, level: DeepReadonly<Level>): LevelStatus {
  if (isComplete(state, level.id)) return 'completed';
  const open =
    regionOpen(state, data, level.region) &&
    (state.settings.unlockAhead.includes(level.region) ||
      level.unlock.after.every((id) => isComplete(state, id)));
  return open ? 'open' : 'locked';
}

export function isPlayable(state: ReadState, data: Data, levelId: string): boolean {
  const level = data.levels.find((l) => l.id === levelId);
  return level !== undefined && levelStatus(state, data, level) !== 'locked';
}

/** Levels in map order: by region order, then level order. */
export function levelsInMapOrder(data: Data): DeepReadonly<Level>[] {
  const regionOrder = new Map(data.regions.map((r) => [r.id, r.order]));
  return [...data.levels].sort(
    (a, b) =>
      (regionOrder.get(a.region) ?? 0) - (regionOrder.get(b.region) ?? 0) || a.order - b.order,
  );
}

/**
 * The first open, not yet completed level in map order from the child's grade's start region on:
 * the one the map makes glow. Regions before the start (an earlier grade) are free practice and
 * never suggested.
 */
export function nextLevel(state: ReadState, data: Data): string | null {
  const start = data.regions.find((r) => r.id === gradeStart(data, state.settings.grade));
  const regionOrder = new Map(data.regions.map((r) => [r.id, r.order]));
  return (
    levelsInMapOrder(data).find(
      (level) =>
        (start === undefined || (regionOrder.get(level.region) ?? 0) >= start.order) &&
        levelStatus(state, data, level) === 'open',
    )?.id ?? null
  );
}

/** Integer percentage, rounded down; 0 when there is nothing to measure. */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part * 100 - ((part * 100) % whole)) / whole;
}

/**
 * Stars for a finished level run: 1 = completed; 2 = accuracy at least the two-star threshold;
 * 3 = accuracy at least the three-star threshold and enough fast answers. Minigames do not count
 * towards accuracy; a run of minigames only earns 3 stars by completion.
 */
export function starsFor(
  answered: number,
  correct: number,
  fast: number,
  rule: DeepReadonly<StarRule>,
): number {
  if (answered === 0) return 3;
  const accuracy = percentOf(correct, answered);
  if (
    accuracy >= rule.threeStars.accuracy &&
    percentOf(fast, correct) >= rule.threeStars.fastShare
  ) {
    return 3;
  }
  return accuracy >= rule.twoStars.accuracy ? 2 : 1;
}
