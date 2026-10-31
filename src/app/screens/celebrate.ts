/**
 * Small celebrations shared by the game screens: a friend's stage in words, and toasts for the
 * stickers the last actions earned (`sticker.earned` events, taken from the child's inbox so each
 * is told once).
 */
import type { Translate } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import type { ActiveDiver, App } from '../shell/app';
import type { ContentData, FriendStage } from '../../rules/contract';

/** "Krab Tvrďák – mládě": a friend's name and stage, for pictures and lists. */
export function friendStageName(t: Translate, name: string, stage: FriendStage): string {
  return t(`stage.${stage}` as MessageKey, { name });
}

/** Toasts for stickers earned since a screen last looked. */
export function toastStickers(app: App, active: ActiveDiver): void {
  const content = app.content();
  if (!content) return;
  const data = active.game.content().data as ContentData;
  for (const event of active.events.take(['sticker.earned'])) {
    if (event.type !== 'sticker.earned') continue;
    const sticker = data.stickers.find((candidate) => candidate.id === event.data.sticker);
    app.kit.toasts.show(
      app.kit.t('sticker.earned', {
        name: sticker ? content.text(sticker.nameKey) : event.data.sticker,
      }),
      { tone: 'success' },
    );
  }
}
