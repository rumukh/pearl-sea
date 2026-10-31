/**
 * A child's grade (3. or 4. třída) on the shell's side. The game save's `settings.grade` is its
 * home; the family record only holds the grade picked in the new-child editor until the save
 * exists (`persistence/family.ts`). `applyPendingGrade` hands it over before the first
 * `startSession`, so the first session's story is already the grade's (docs/design.md §4.1); the
 * grown-ups' area changes it later through the same request.
 */
import type { GameAction, GameView, Grade } from '../../rules/contract';
import type { Dispatch } from '../controller/commands';
import { CommandRejectedError } from '../controller/commands';
import { findDiver } from '../persistence/family';
import type { ActiveDiver, App } from '../shell/app';

export function gradeOf(view: GameView): Grade {
  return view.settings.grade;
}

/** Why the game kept its grade: content that does not serve it yet, or a placement round. */
export type GradeRefusal = 'not-served' | 'round-active';

/**
 * Ask the game for a grade. Content that does not serve the grade yet refuses it
 * (`invalid-setting`), and a placement round refuses a change (`round-active`); either leaves
 * the game as it is and says why.
 */
export async function requestGrade(
  view: GameView,
  dispatch: Dispatch<GameAction>,
  grade: Grade,
): Promise<GradeRefusal | null> {
  if (gradeOf(view) === grade) return null;
  try {
    await dispatch({ type: 'setSetting', setting: { key: 'grade', value: grade } });
    return null;
  } catch (error) {
    if (error instanceof CommandRejectedError && !error.accepted) {
      if (error.error.code === 'invalid-setting') return 'not-served';
      if (error.error.code === 'round-active') return 'round-active';
    }
    throw error;
  }
}

/** Hand the editor's grade to the game and drop it from the family record. */
export async function applyPendingGrade(app: App, active: ActiveDiver): Promise<void> {
  const grade = findDiver(app.family.state(), active.diver.id)?.grade;
  if (grade === undefined) return;
  await requestGrade(active.game.view(), active.commands.capture(), grade);
  await app.family.setPendingGrade(active.diver.id, null);
}
