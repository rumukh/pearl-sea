/**
 * Who is diving? Up to four children's cards with their diver pictures, a "Nový profil" card
 * while there is room, a small change button per child, and the grown-ups' door behind the gate.
 * Choosing a card opens that child's game.
 */
import { picture } from '../art/picture';
import { openGrownUpsGate } from '../grownups/gate-dialog';
import { MAX_DIVERS } from '../persistence/family';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { ART } from '../../rules/contract';
import { topBar } from './common';

export function diversScreen(app: App): ScreenEntry {
  return {
    key: 'divers',
    async build(context) {
      await app.closeDiver();
      const t = app.kit.t;
      const divers = app.family.state().profiles;
      const grownUps = candyButton({
        label: t('title.grownups'),
        icon: 'grownups',
        variant: 'paper',
        size: 'small',
        testId: 'divers-grownups',
        onPress: async () => {
          if (await openGrownUpsGate(app.kit, app.grownUps())) {
            await app.router.push(app.screens.grownUps());
          }
        },
        onError: app.kit.onError,
      });
      const heading = h('h1', { text: t('divers.heading') });
      const cards = divers.map((diver) => {
        const play = h(
          'button',
          {
            className: 'ps-diver-card__play',
            testId: `diver-${diver.id}`,
            attributes: { type: 'button', 'aria-label': t('divers.play', { name: diver.name }) },
          },
          picture(app.art, ART.avatar(diver.avatar), { className: 'ps-avatar ps-avatar--large' }),
          h('span', { className: 'ps-diver-card__name', text: diver.name }),
        );
        play.addEventListener('click', () => {
          app.audio.unlock();
          void app.router.push(app.screens.play(diver.id)).catch(app.kit.onError);
        });
        const edit = candyButton({
          label: t('divers.edit', { name: diver.name }),
          icon: 'pencil',
          iconOnly: true,
          variant: 'paper',
          size: 'small',
          testId: `diver-edit-${diver.id}`,
          onPress: () => app.router.push(app.screens.editor(diver.id)),
          onError: app.kit.onError,
        });
        return h('li', { className: 'ps-diver-card' }, play, edit);
      });
      const list = h('ul', { className: 'ps-diver-grid', testId: 'diver-list' }, ...cards);
      if (divers.length < MAX_DIVERS) {
        const add = h(
          'button',
          {
            className: 'ps-diver-card__play ps-diver-card__play--add',
            testId: 'diver-add',
            attributes: { type: 'button' },
          },
          h('span', { className: 'ps-diver-card__plus' }, icon('plus')),
          h('span', { className: 'ps-diver-card__name', text: t('divers.add') }),
        );
        add.addEventListener('click', () => {
          void app.router.push(app.screens.editor(null)).catch(app.kit.onError);
        });
        list.append(h('li', { className: 'ps-diver-card ps-diver-card--add' }, add));
      }
      const element = h(
        'main',
        { className: 'ps-divers', testId: 'screen-divers' },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          tools: [grownUps],
          onError: app.kit.onError,
        }),
        list,
        divers.length >= MAX_DIVERS
          ? h('p', { className: 'ps-note', text: t('divers.full') })
          : null,
      );
      return {
        element,
        title: t('divers.heading'),
        field: 'sea',
        region: null,
        music: 'grotto',
      };
    },
  };
}
