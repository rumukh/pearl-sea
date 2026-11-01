/**
 * A level's intro: its title and region, the monster for a monster level, the activities that
 * wait (a done mark for those of a run under way) and its stars. "Začít" enters the level; a run
 * under way continues at its next activity; a finished level can replay one of its games.
 */
import { picture } from '../art/picture';
import { taken } from '../controller/commands';
import { findLevel } from '../game/view';
import type { MessageKey } from '../i18n/messages';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon, starIcon } from '../ui/icons';
import { ART, isMinigameKind } from '../../rules/contract';
import type { ContentData, GameAction } from '../../rules/contract';
import { diverSaveStatus, topBar } from './common';

export function activityName(t: (key: MessageKey) => string, kind: string): string {
  return t(`activity.${kind}` as MessageKey);
}

export function levelScreen(app: App, diverId: string, levelId: string): ScreenEntry {
  return {
    key: `level:${diverId}:${levelId}`,
    async build(context) {
      const active = await app.openDiver(diverId);
      const saveStatus = diverSaveStatus(app, active);
      const t = app.kit.t;
      const text = app.content()!.text;
      const view = active.game.view();
      const data = active.game.content().data as ContentData;
      const found = findLevel(view, levelId);
      const level = data.levels.find((candidate) => candidate.id === levelId);
      if (!found || !level) throw new Error('That level is not in this sea.');
      const card = found.level;
      const run = view.run?.level === levelId && view.run.result === null ? view.run : null;

      const start = async (action: GameAction): Promise<void> => {
        await taken(active.commands.capture()(action));
        await app.continueGame(diverId);
      };

      const activities = h(
        'ol',
        { className: 'ps-activities', testId: 'level-activities' },
        ...level.activities.map((activity, index) => {
          const done = run?.activities[index]?.done === true;
          const row = h(
            'li',
            { className: 'ps-activity', dataset: { kind: activity.kind, done: String(done) } },
            done ? icon('check') : icon(isMinigameKind(activity.kind) ? 'sparkle' : 'pearl'),
            h('span', { text: activityName(t, activity.kind) }),
            done
              ? h('span', { className: 'ps-visually-hidden', text: t('level.activityDone') })
              : null,
          );
          if (card.status === 'completed' && !run && isMinigameKind(activity.kind)) {
            row.append(
              candyButton({
                label: t('level.replay'),
                icon: 'retry',
                variant: 'paper',
                size: 'small',
                testId: `level-replay-${index}`,
                onPress: () => start({ type: 'startLevel', level: levelId, activity: index }),
                onError: app.kit.onError,
              }),
            );
          }
          return row;
        }),
      );

      const go = run
        ? candyButton({
            label: t('level.continue'),
            icon: 'play',
            variant: 'sun',
            size: 'big',
            testId: 'level-start',
            onPress: () =>
              start({ type: 'startActivity', activity: { kind: 'level', index: run.next } }),
            onError: app.kit.onError,
          })
        : candyButton({
            label: t(card.status === 'completed' ? 'level.again' : 'level.start'),
            icon: 'play',
            variant: 'sun',
            size: 'big',
            testId: 'level-start',
            onPress: () => start({ type: 'startLevel', level: levelId }),
            onError: app.kit.onError,
          });

      const heading = h('h1', { text: text(card.titleKey) });
      const monster = found.region.monster;
      const element = h(
        'main',
        { className: 'ps-level', testId: 'screen-level', dataset: { level: levelId } },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          tools: [saveStatus.element],
          onError: app.kit.onError,
        }),
        h(
          'section',
          { className: 'ps-card ps-level__card' },
          h('p', { className: 'ps-level__region', text: text(found.region.titleKey) }),
          card.kind === 'monster' && monster
            ? h(
                'div',
                { className: 'ps-level__monster' },
                picture(app.art, ART.monster(monster.id, monster.freed ? 'freed' : 'inked'), {
                  alt: text(monster.nameKey),
                }),
              )
            : null,
          card.status === 'completed'
            ? h(
                'p',
                { className: 'ps-level__stars', testId: 'level-stars' },
                h(
                  'span',
                  { attributes: { 'aria-hidden': 'true' } },
                  ...[1, 2, 3].map((star) => starIcon(star <= card.stars)),
                ),
                h('span', {
                  className: 'ps-visually-hidden',
                  text: t.plural('level.stars', card.stars),
                }),
              )
            : null,
          h('h2', { text: t('level.activities') }),
          activities,
          h('div', { className: 'ps-row ps-row--center' }, go),
        ),
      );
      return {
        element,
        title: text(card.titleKey),
        field: 'sea',
        region: found.region.id,
        music: 'map',
        focusTarget: () => go,
        dispose: saveStatus.dispose,
      };
    },
  };
}
