/**
 * A region of the sea: its painted scene with the level nodes along a path, lesson pearls first
 * and the monster's ink blot last. Each node says its number, whether it is done (with its
 * stars), open or locked; the level the game suggests glows. A node opens the level's intro.
 */
import { picture } from '../art/picture';
import { findRegion } from '../game/view';
import { levelSpots } from '../game/map';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { h, svg } from '../ui/dom';
import { icon, starIcon } from '../ui/icons';
import { ART } from '../../rules/contract';
import type { LevelCard } from '../../rules/contract';
import { topBar } from './common';

export function regionScreen(app: App, diverId: string, regionId: string): ScreenEntry {
  return {
    key: `region:${diverId}:${regionId}`,
    async build(context) {
      const active = await app.openDiver(diverId);
      const t = app.kit.t;
      const text = app.content()!.text;
      const view = active.game.view();
      const region = findRegion(view, regionId);
      if (!region) throw new Error('That region is not in this sea.');
      const levels = [...region.levels].sort((a, b) => a.order - b.order);
      const spots = levelSpots(levels.length);

      const statusText = (level: LevelCard): string => {
        if (level.status === 'locked') return t('level.locked');
        if (level.status === 'open') return level.glowing ? t('level.next') : t('level.open');
        return t.plural('level.doneStars', level.stars);
      };

      const nodes = levels.map((level, index) => {
        const spot = spots[index]!;
        const title = text(level.titleKey);
        const node = h(
          'button',
          {
            className: 'ps-level-node',
            testId: `level-${level.id}`,
            dataset: {
              status: level.status,
              kind: level.kind,
              glowing: String(level.glowing),
            },
            attributes: {
              type: 'button',
              'aria-label': `${level.order}. ${title}: ${statusText(level)}`,
            },
          },
          h(
            'span',
            { className: 'ps-level-node__pearl', attributes: { 'aria-hidden': 'true' } },
            level.kind === 'monster' && region.monster
              ? picture(
                  app.art,
                  ART.monster(region.monster.id, region.monster.freed ? 'freed' : 'inked'),
                )
              : level.status === 'locked'
                ? icon('lock')
                : h('span', { text: String(level.order) }),
          ),
          level.status === 'completed'
            ? h(
                'span',
                { className: 'ps-level-node__stars', attributes: { 'aria-hidden': 'true' } },
                ...[1, 2, 3].map((star) => starIcon(star <= level.stars)),
              )
            : null,
        );
        node.style.left = `${spot.x / 10}%`;
        node.style.top = `${spot.y / 10}%`;
        node.disabled = level.status === 'locked';
        node.addEventListener('click', () => {
          void app.router.push(app.screens.level(diverId, level.id)).catch(app.kit.onError);
        });
        return node;
      });

      const path = svg(
        'svg',
        {
          class: 'ps-region__path',
          viewBox: '0 0 1000 1000',
          preserveAspectRatio: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        svg('polyline', {
          points: spots.map((spot) => `${spot.x},${spot.y}`).join(' '),
          fill: 'none',
        }),
      );
      const heading = h('h1', { text: text(region.titleKey) });
      const element = h(
        'main',
        { className: 'ps-region', testId: 'screen-region', dataset: { region: region.id } },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        h(
          'div',
          { className: 'ps-region__board', testId: 'region-board' },
          picture(app.art, ART.scene(region.id), { className: 'ps-region__picture' }),
          path,
          ...nodes,
        ),
      );
      return {
        element,
        title: text(region.titleKey),
        field: 'sea',
        region: region.id,
        music: 'map',
        focusTarget: () =>
          nodes.find((node) => node.dataset['glowing'] === 'true') ??
          nodes.find((node) => !node.disabled) ??
          heading,
      };
    },
  };
}
