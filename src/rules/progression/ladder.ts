/**
 * The placement ladder (Ukaž, co umíš, design §5.16): a few problems per step of
 * `content.placement.steps`. Passing a step (`passAccuracy`) places its levels and moves up the
 * ladder; failing a step, `stopAfterMisses` misses in a row or `maxProblems` problems end it
 * gently. Pure functions over the round's `PlacementProgress`.
 */
import type { DeepReadonly } from '@aegis/runtime';
import type { Grade, Placement, PlacementProgress } from '../contract';
import { canGenerate, servableIndex } from '../learning/generate';
import { perPack } from '../learning/index-cache';
import { percentOf } from './levels';
import type { Data } from '../types';

const ladders: (data: Data) => Map<Grade, DeepReadonly<Placement>> = perPack(() => new Map());

/**
 * Whether the placement check may place a level: never a monster level or a region's first
 * lesson (design §5.16: the welcome gives the region's egg, and monsters are fun and gate the
 * next region), whatever a step lists.
 */
function placeable(data: Data, id: string): boolean {
  const level = data.levels.find((l) => l.id === id);
  if (level === undefined || level.kind !== 'lesson') return false;
  const lessons = data.levels.filter((l) => l.region === level.region && l.kind === 'lesson');
  return lessons.some((l) => l.order < level.order);
}

/**
 * The placement ladder of `grade`: the steps whose `grades` name it (v1: the 4th grade's) and
 * that this build can ask (a step whose skill no problem generator serves is left out, so its
 * levels are not placed), each placing only levels the check may place (`placeable`), once per
 * pack and grade.
 */
export function placementFor(data: Data, grade: Grade): DeepReadonly<Placement> {
  const cache = ladders(data);
  let ladder = cache.get(grade);
  if (ladder === undefined) {
    const served = servableIndex(data);
    const placement = data.placement;
    const steps = placement.steps
      .filter((step) => {
        const skill = data.skills.find((s) => s.id === step.skill);
        return (
          (step.grades as readonly number[]).includes(grade) &&
          skill !== undefined &&
          canGenerate(skill) &&
          (served.get(skill.id)?.length ?? 0) > 0
        );
      })
      .map((step) =>
        step.levels.every((id) => placeable(data, id))
          ? step
          : { ...step, levels: step.levels.filter((id) => placeable(data, id)) },
      );
    const same =
      steps.length === placement.steps.length && steps.every((s, i) => s === placement.steps[i]);
    ladder = same ? placement : { ...placement, steps };
    cache.set(grade, ladder);
  }
  return ladder;
}

/** The ladder is over: every step asked, a step failed, or stopped early. */
export function ladderDone(
  progress: DeepReadonly<PlacementProgress>,
  placement: DeepReadonly<Placement>,
  problems: number,
): boolean {
  return progress.step >= placement.steps.length || problems >= placement.maxProblems;
}

/** Record one placement problem (right when every step of it was) and climb, stop or continue. */
export function advanceLadder(
  progress: PlacementProgress,
  placement: DeepReadonly<Placement>,
  correct: boolean,
): void {
  const step = placement.steps[progress.step];
  if (!step) return;
  progress.stepAsked += 1;
  if (correct) {
    progress.stepCorrect += 1;
    progress.missesInRow = 0;
  } else {
    progress.missesInRow += 1;
  }
  const stop = () => {
    progress.step = placement.steps.length;
  };
  if (progress.missesInRow >= placement.stopAfterMisses) {
    stop();
    return;
  }
  if (progress.stepAsked < step.problems) return;
  if (percentOf(progress.stepCorrect, progress.stepAsked) < step.passAccuracy) {
    stop();
    return;
  }
  progress.placed = [...new Set([...progress.placed, ...step.levels])];
  progress.step += 1;
  progress.stepAsked = 0;
  progress.stepCorrect = 0;
}
