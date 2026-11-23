/**
 * Levels and regions: completion, unlocks and stars.
 *
 * A level is complete when it has at least one star or was placed by the placement check. A level
 * is open when every level in its `unlock.after` is complete and its region is open; a region is
 * open when every level in its `unlock.after` is complete, a grown-up unlocked it ahead, it is the
 * start region of the child's grade, or it belongs to an earlier grade (free practice for a 4th
 * grader in the shallows, design §9.1). Unlocks are derived, never stored, so new content levels
 * slot in by data alone, and a grade change only moves the start and the suggestions.
 *
 * An open level that was never finished may still wait (`levelWait`, design §4.2): for tomorrow,
 * once today's new levels reach the grown-ups' limit, or for the school, while it practises the
 * listed words after a letter a 3rd grader's school has not taught yet. A level under way never
 * waits, and finished levels stay free to replay.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { DEFAULT_NEW_LEVELS, LISTED_LETTERS, gradeStart, regionGrade } from '../contract';
import type { Level, LevelStatus, LevelWait, ListedLetter, StarRule } from '../contract';
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

/** The most new levels today: the grown-ups' choice, else `DEFAULT_NEW_LEVELS`; 0 is no limit. */
export function newLevelLimit(state: ReadState): number {
  return state.settings.newLevels ?? DEFAULT_NEW_LEVELS;
}

/** Levels finished for the first time today. */
export function newLevelsToday(state: ReadState): number {
  const daily = state.daily;
  return daily !== null && daily.day === state.day ? (daily.newLevels ?? 0) : 0;
}

/** The objective a level declares for the listed words after one letter, or for all of them. */
const LISTED_OBJECTIVE = /^obj\.listed\.([a-z]+)$/;

/**
 * The listed-word letters a level practises, from its objectives (`obj.listed.<letter>`, and
 * `obj.listed.all` for every letter), in school order.
 */
export function levelLetters(level: DeepReadonly<Level>): ListedLetter[] {
  const letters = new Set<string>();
  for (const objective of level.objectives) {
    const match = LISTED_OBJECTIVE.exec(objective);
    if (match === null) continue;
    if (match[1] === 'all') LISTED_LETTERS.forEach((letter) => letters.add(letter));
    else letters.add(match[1]!);
  }
  return LISTED_LETTERS.filter((letter) => letters.has(letter));
}

/**
 * The listed-word letters the child's school has not taught yet: a 3rd grader's letters left out
 * of `settings.listedLetters` (absent: every letter is taught). A 4th grader has learnt them all.
 */
export function untaughtLetters(state: ReadState): ListedLetter[] {
  const taught = state.settings.listedLetters;
  if (taught === undefined || state.settings.grade !== 3) return [];
  return LISTED_LETTERS.filter((letter) => !taught.includes(letter));
}

/**
 * Why a level the child has not finished cannot start now (design §4.2), or `null`: `school` while
 * it practises the listed words after a letter the school has not taught, else `tomorrow` once
 * today's new levels reached the limit. A finished level or the level under way never waits.
 */
export function levelWait(state: ReadState, level: DeepReadonly<Level>): LevelWait | null {
  if (isComplete(state, level.id) || state.run?.level === level.id) return null;
  const untaught = untaughtLetters(state);
  if (untaught.length > 0 && levelLetters(level).some((letter) => untaught.includes(letter))) {
    return 'school';
  }
  const limit = newLevelLimit(state);
  return limit > 0 && newLevelsToday(state) >= limit ? 'tomorrow' : null;
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
