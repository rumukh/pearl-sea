/**
 * The child's game. It shows whatever the game needs now, straight from the view: a story beat,
 * the first egg's choice, the active round (a problem round or a minigame board), the results of
 * a finished round, or else the grotto. After an action that changes this, screens ask the shell
 * to continue the game, which rebuilds this entry; Back from anything opened on top of it returns
 * here.
 *
 * Building it is the safe boundary where newer content is activated: a save from before an
 * update moves to the newest pack here, before today's session starts, unless a round or a story
 * is still in progress (the rules refuse then, and the next visit tries again). Entering it starts
 * the day's session when the local date has changed (time reaches the rules only as this date).
 */
import { applyPendingGrade } from '../game/grade';
import { dayBaseline, gameDay } from '../game/view';
import { localDay } from '../persistence/day';
import type { ScreenEntry } from '../router/router';
import { playKey } from '../shell/app';
import type { ActiveDiver, App } from '../shell/app';
import { minigameScreen } from './boards';
import { firstFriendScreen } from './eggs';
import { hubScreen } from './hub';
import { resultsScreen } from './results';
import { problemRoundScreen } from './round';
import { storyScreen } from './story';

/** Start (or resume) today's session unless the game is already on today's date. */
export async function startToday(active: ActiveDiver, today = localDay()): Promise<void> {
  if (active.game.view().day === today) return;
  await active.commands.capture()({ type: 'startSession', day: today });
}

export function playScreen(app: App, diverId: string): ScreenEntry {
  return {
    key: playKey(diverId),
    async build() {
      const active = await app.openDiver(diverId);
      await active.game.activateLatestContent();
      // The diary card tells what today brought: note how the day begins.
      const today = localDay();
      await active.day.begin(gameDay(active.game.view(), today), () =>
        dayBaseline(active.game.view()),
      );
      await applyPendingGrade(app, active);
      await startToday(active, today);
      const view = active.game.view();
      switch (view.screen) {
        case 'story':
          if (view.story) return storyScreen(app, active);
          break;
        case 'round':
          if (view.round?.type === 'problems') return problemRoundScreen(app, active);
          if (view.round?.type === 'minigame') return minigameScreen(app, active);
          break;
        case 'results':
          if (view.round) return resultsScreen(app, active);
          break;
        case 'hub':
          break;
      }
      if (view.hub.next.kind === 'first-friend' && view.onboarding.choices.length > 0) {
        return firstFriendScreen(app, active);
      }
      await active.game.activateLatestContent();
      return hubScreen(app, active);
    },
  };
}
