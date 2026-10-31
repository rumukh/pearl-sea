/**
 * Title: open water with rising bubbles, the name, and the four pearls i, í, y, ý that the game
 * is about. Children start here; a quiet "Pro dospělé" button leads grown-ups through the gate to
 * their area. The profiles and the dive into the sea join this screen with the game screens.
 */
import { openGrownUpsGate } from '../grownups/gate-dialog';
import { linkButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';

const PEARLS = ['i', 'í', 'y', 'ý'] as const;
const BUBBLES = 12;

export function titleScreen(app: App): ScreenEntry {
  return {
    key: 'title',
    build() {
      const t = app.kit.t;
      const pearls = h(
        'ul',
        { className: 'ps-title__pearls', attributes: { 'aria-hidden': 'true' } },
        ...PEARLS.map((letter) => h('li', { className: 'ps-pearl', text: letter })),
      );
      const bubbles = h(
        'div',
        { className: 'ps-title__bubbles', attributes: { 'aria-hidden': 'true' } },
        ...Array.from({ length: BUBBLES }, () => h('span', { className: 'ps-bubble' })),
      );
      const grownUps = linkButton({
        label: t('title.grownups'),
        icon: 'grownups',
        testId: 'title-grownups',
        onPress: async () => {
          if (await openGrownUpsGate(app.kit, app.grownUps())) {
            await app.router.push(app.screens.grownUps());
          }
        },
        onError: app.kit.onError,
      });
      const element = h(
        'main',
        { className: 'ps-title', testId: 'title-screen' },
        bubbles,
        h(
          'div',
          { className: 'ps-title__card' },
          h('h1', { className: 'ps-title__name', text: t('app.title') }),
          h('p', { className: 'ps-title__subtitle', text: t('title.subtitle') }),
          pearls,
          h('p', { className: 'ps-title__tagline', text: t('title.tagline') }),
          h('p', { className: 'ps-title__soon', text: t('title.soon') }),
        ),
        h('div', { className: 'ps-title__corner' }, grownUps),
      );
      return {
        element,
        title: t('app.title'),
        field: 'sea',
        region: 'sunny-lagoon',
        music: 'title',
      };
    },
  };
}
