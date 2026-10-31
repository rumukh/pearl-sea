/**
 * Grades (design §9): certificates and the finales.
 *
 * Freeing a monster with `gradeFinale: g` (Mořská saň Ledana: the 3rd grade) completes grade g's
 * sea: `grade.completed` is emitted once, when it is first freed, and the hub lists the grades
 * done (`certificates`). Certificates are derived from the freed monsters, never stored. Freeing
 * the `finale` monster (Krakatice Inkoustová) completes the game: the day is recorded and the
 * finale beats play.
 */
import { EVENTS, GRADES } from '../contract';
import type { Grade } from '../contract';
import { triggerBeats } from '../story/beats';
import type { Ctx, Data, ReadState } from '../types';

/** The grades whose finale monster has been freed, in grade order. */
export function completedGrades(state: ReadState, data: Data): Grade[] {
  return GRADES.filter((grade) =>
    data.monsters.some((m) => m.gradeFinale === grade && state.monsters[m.id] !== undefined),
  );
}

/** After `monster` was freed for the first time: its grade's certificate, or the finale. */
export function monsterMilestones(ctx: Ctx, monster: string): void {
  const record = ctx.content.data.monsters.find((m) => m.id === monster);
  if (!record) return;
  if (record.gradeFinale !== undefined) {
    ctx.emit(EVENTS.gradeCompleted, { grade: record.gradeFinale });
  }
  if (record.finale === true && ctx.state.finale.day === null) {
    ctx.state.finale.day = ctx.state.day ?? 0;
    ctx.emit(EVENTS.finaleCompleted, {});
    triggerBeats(ctx, (t) => t.kind === 'finale');
  }
}
