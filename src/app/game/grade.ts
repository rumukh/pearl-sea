/**
 * A child's grade (3. or 4. třída) on the shell's side. The game save's `settings.grade` is its
 * home; the family record only holds the grade picked in the new-child editor until the save
 * exists (`persistence/family.ts`). `applyPendingGrade` hands it over before the first
 * `startSession`, so the first session's story is already the grade's (docs/design.md §4.1).
 */
import type { GameView, Grade } from '../../rules/contract';
import { CommandRejectedError } from '../controller/commands';
import { findDiver } from '../persistence/family';
import type { ActiveDiver, App } from '../shell/app';

export function gradeOf(view: GameView): Grade {
  return view.settings.grade;
}

/**
 * Ask the game for a grade. Content that does not serve the grade yet refuses it
 * (`invalid-setting`), and a placement round refuses a change (`round-active`); either leaves
 * the game as it is and returns false.
 */
export async function requestGrade(active: ActiveDiver, grade: Grade): Promise<boolean> {
  if (gradeOf(active.game.view()) === grade) return true;
  try {
    await active.commands.capture()({
      type: 'setSetting',
      setting: { key: 'grade', value: grade },
    });
    return true;
  } catch (error) {
    if (
      error instanceof CommandRejectedError &&
      (error.error.code === 'invalid-setting' || error.error.code === 'round-active')
    ) {
      return false;
    }
    throw error;
  }
}

/** Hand the editor's grade to the game and drop it from the family record. */
export async function applyPendingGrade(app: App, active: ActiveDiver): Promise<void> {
  const grade = findDiver(app.family.state(), active.diver.id)?.grade;
  if (grade === undefined) return;
  await requestGrade(active, grade);
  await app.family.setPendingGrade(active.diver.id, null);
}
