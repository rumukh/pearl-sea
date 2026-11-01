/**
 * Goodbye, with the diary card (_Můj deník_, docs/design.md §8.6), made from data: words whose
 * pearls reached bronze today (at most five, then "+N"), friends that hatched or grew since the
 * day began (the day record's stages), monsters freed and stickers earned today. Its first line
 * follows the form of address (_Dnes ses naučil: …_, _Dnes ses naučila: …_, or the neutral
 * _Dnešní nové perly: …_). It can be read aloud. "Ahoj zítra!" closes the child's game.
 */
import { picture } from '../art/picture';
import type { ScreenEntry } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { ART } from '../../rules/contract';
import type { GameView } from '../../rules/contract';
import { speakerButton } from './speaker';

/** Words shown by name on the diary card before "+N". */
export const DIARY_WORDS = 5;

export interface Diary {
  readonly words: readonly string[];
  readonly moreWords: number;
  /** Friends that hatched or grew today, with the stage they reached. */
  readonly grown: readonly { readonly friend: string; readonly stage: string }[];
  readonly freed: readonly string[];
  readonly stickers: readonly string[];
}

/** What today brought, from the view and the stages the day began with. */
export function diaryOf(view: GameView, began: Readonly<Record<string, string>> | null): Diary {
  const today = view.daily?.day ?? view.day;
  const learned = view.daily?.learned ?? [];
  return {
    words: learned.slice(0, DIARY_WORDS).map((word) => word.text),
    moreWords: Math.max(0, learned.length - DIARY_WORDS),
    grown: began
      ? view.friends
          .filter((friend) => friend.stage !== 'egg' && began[friend.id] !== friend.stage)
          .map((friend) => ({ friend: friend.id, stage: friend.stage }))
      : [],
    freed: view.gallery.monsters
      .filter((monster) => monster.freed && monster.day === today)
      .map((monster) => monster.id),
    stickers: view.album.pages.flatMap((page) =>
      page.stickers
        .filter((sticker) => sticker.earned && sticker.day === today)
        .map((sticker) => sticker.id),
    ),
  };
}

export function goodbyeScreen(app: App, diverId: string): ScreenEntry {
  return {
    key: `goodbye:${diverId}`,
    async build() {
      const active: ActiveDiver = await app.openDiver(diverId);
      const t = app.kit.t;
      const text = app.content()!.text;
      const view = active.game.view();
      const data = active.game.content().data;
      const record = active.day.current();
      const diary = diaryOf(
        view,
        record && record.day === (view.daily?.day ?? view.day) ? record.stages : null,
      );
      const name = (list: readonly { id: string; nameKey: string }[], id: string): string => {
        const found = list.find((candidate) => candidate.id === id);
        return found ? text(found.nameKey) : id;
      };

      const lines: string[] = [];
      if (diary.words.length > 0) {
        const words =
          diary.words.join(', ') +
          (diary.moreWords > 0 ? ` ${t('diary.more', { count: diary.moreWords })}` : '');
        lines.push(t('diary.learned', { words }));
      }
      for (const grown of diary.grown) {
        lines.push(
          t(grown.stage === 'baby' ? 'diary.hatched' : 'diary.grew', {
            name: name(data.friends, grown.friend),
          }),
        );
      }
      for (const monster of diary.freed)
        lines.push(t('diary.freed', { name: name(data.monsters, monster) }));
      for (const sticker of diary.stickers)
        lines.push(t('diary.sticker', { name: name(data.stickers, sticker) }));
      if (lines.length === 0) lines.push(t('diary.empty'));

      const card = h(
        'section',
        { className: 'ps-card ps-diary', testId: 'diary' },
        h('h2', { text: t('diary.heading') }),
        h('ul', { className: 'ps-diary__lines' }, ...lines.map((line) => h('li', { text: line }))),
        h(
          'div',
          { className: 'ps-row' },
          ...speakerButton(app, active.preferences.current(), () => lines.join(' '), 'diary-read'),
        ),
      );
      const heading = h('h1', { text: t('goodbye.heading') });
      const bye = candyButton({
        label: t('goodbye.bye'),
        icon: 'home',
        variant: 'sun',
        size: 'big',
        testId: 'goodbye-bye',
        onPress: async () => {
          await app.closeDiver();
          await app.router.reset(app.screens.title());
        },
        onError: app.kit.onError,
      });
      const stay = candyButton({
        label: t('goodbye.stay'),
        icon: 'back',
        variant: 'paper',
        testId: 'goodbye-stay',
        onPress: () => app.continueGame(diverId),
        onError: app.kit.onError,
      });
      const element = h(
        'main',
        { className: 'ps-goodbye', testId: 'screen-goodbye' },
        h('div', { className: 'ps-backdrop' }, picture(app.art, ART.scene('grotto'))),
        h(
          'section',
          { className: 'ps-goodbye__stage' },
          heading,
          card,
          h('div', { className: 'ps-row ps-row--center' }, stay, bye),
        ),
      );
      return {
        element,
        title: heading.textContent ?? '',
        field: 'sea',
        region: null,
        music: 'grotto',
        focusTarget: () => bye,
      };
    },
  };
}
