/**
 * Závod s delfíny (design §5.14): an optional race of known items against the child's own best.
 * It opens once `balance.race.unlockAfter` is complete, if the grown-ups left it on. The shell
 * keeps the time (`balance.race.seconds`) and ends the round with `endRound{ reason: 'time-up' }`;
 * the rules cap it at `balance.race.maxProblems` problems. Known items (box 2+) come first; misses
 * are never re-asked and never cost anything. The score is the number of right answers; a finished
 * race updates the personal best (`state.race`).
 */
import { EVENTS } from '../contract';
import type { ProblemRound } from '../contract';
import { isComplete } from './levels';
import { playableSkills, poolOf, startProblemRound } from './problems';
import type { Ctx, Data, Index, ReadState } from '../types';

/** The round state keeps at most this many skills. */
const MAX_ROUND_SKILLS = 64;

/**
 * Problem skills of every completed level: what the race may ask, at most `MAX_ROUND_SKILLS`,
 * those with the most known items first.
 */
export function raceSkills(state: ReadState, data: Data): string[] {
  const skills = data.levels
    .filter((level) => isComplete(state, level.id))
    .flatMap((level) => level.activities.flatMap((activity) => activity.skills));
  const playable = playableSkills(data, [...new Set(skills)]);
  if (playable.length <= MAX_ROUND_SKILLS) return playable;
  const known = (skill: string) =>
    poolOf(data, [skill]).filter((item) => (state.items[item]?.box ?? 0) >= 2).length;
  return playable
    .map((skill, order) => ({ skill, order, known: known(skill) }))
    .sort((a, b) => b.known - a.known || a.order - b.order)
    .slice(0, MAX_ROUND_SKILLS)
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.skill);
}

/** Why the race cannot start, or `null`. */
export function raceProblem(state: ReadState, data: Data): string | null {
  if (!state.settings.race) return 'The race is switched off.';
  if (!isComplete(state, data.balance.race.unlockAfter)) return 'The race is not open yet.';
  return raceSkills(state, data).length === 0 ? 'Nothing to race with yet.' : null;
}

export function startRace(ctx: Ctx, index: Index): void {
  startProblemRound(ctx, index, {
    activity: 'race',
    source: { kind: 'race' },
    skills: raceSkills(ctx.state, ctx.content.data),
    input: 'auto',
    target: null,
    battle: null,
  });
}

/** A race that ran to its end (time up or the problem cap) counts for the personal best. */
export function finishRace(ctx: Ctx, round: ProblemRound): void {
  const race = ctx.state.race;
  const previous = race.best;
  race.plays += 1;
  race.best = Math.max(previous, round.correct);
  ctx.emit(EVENTS.raceFinished, {
    score: round.correct,
    best: race.best,
    record: round.correct > previous,
  });
}
