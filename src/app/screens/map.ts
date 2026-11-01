/**
 * The sea map: the painted map of the shallows (3rd grade) or the deep (4th grade) with a marker
 * for every region on it: its name, how many of its levels are done, and its monster, inked or
 * freed. Locked regions show a lock. A region opens its own view with the level nodes
 * (screens/region.ts). The map shown first is the one with the glowing level.
 */
import { picture, pictureSize } from '../art/picture';
import { findLevel } from '../game/view';
import { regionSpot } from '../game/map';
import type { Screen, ScreenEntry } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { createCoinCounter } from '../ui/meters';
import { createTabs } from '../ui/tabs';
import { ART, SEA_MAPS } from '../../rules/contract';
import type { GameView, RegionView, SeaMap } from '../../rules/contract';
import { diverSaveStatus, topBar } from './common';

/** The map to open first: where the glowing level is, else the child's grade's sea. */
export function firstMap(view: GameView): SeaMap {
  for (const region of view.hub.regions) {
    if (region.levels.some((level) => level.glowing)) return region.map;
  }
  return view.settings.grade === 4 ? 'deep' : 'shallows';
}

export function mapScreen(app: App, diverId: string, initial?: SeaMap): ScreenEntry {
  let sea: SeaMap | undefined = initial;
  return {
    key: `map:${diverId}`,
    async build(context) {
      const active = await app.openDiver(diverId);
      sea ??= firstMap(active.game.view());
      return mapView(app, active, context.canGoBack, sea, (next) => {
        sea = next;
      });
    },
  };
}

function mapView(
  app: App,
  active: ActiveDiver,
  canGoBack: boolean,
  initial: SeaMap,
  remember: (sea: SeaMap) => void,
): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const view = active.game.view();
  const saveStatus = diverSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, view.coins);
  const board = h('div', { className: 'ps-map__board', testId: 'map-board' });

  const marker = (region: RegionView, index: number, onMap: number): HTMLElement => {
    const spot = regionSpot(region.id, index, onMap);
    const done = region.levels.filter((level) => level.status === 'completed').length;
    const title = text(region.titleKey);
    const glowing = region.levels.some((level) => level.glowing);
    const status = region.unlocked
      ? t('map.progress', { done, total: region.levels.length })
      : t('map.locked');
    const button = h(
      'button',
      {
        className: 'ps-map__region',
        testId: `region-${region.id}`,
        dataset: {
          unlocked: String(region.unlocked),
          glowing: String(glowing),
          region: region.id,
        },
        attributes: { type: 'button', 'aria-label': `${title}: ${status}` },
      },
      region.monster
        ? picture(
            app.art,
            ART.monster(region.monster.id, region.monster.freed ? 'freed' : 'inked'),
            {
              className: 'ps-map__monster',
            },
          )
        : null,
      h('span', { className: 'ps-map__region-title', text: title }),
      h(
        'span',
        { className: 'ps-map__region-status' },
        region.unlocked ? icon('pearl') : icon('lock'),
        h('span', { text: region.unlocked ? `${done}/${region.levels.length}` : t('map.locked') }),
      ),
    );
    button.style.left = `${spot.x / 10}%`;
    button.style.top = `${spot.y / 10}%`;
    button.disabled = !region.unlocked;
    button.addEventListener('click', () => {
      void app.router.push(app.screens.region(active.diver.id, region.id)).catch(app.kit.onError);
    });
    return button;
  };

  const draw = (sea: SeaMap): void => {
    remember(sea);
    const regions = view.hub.regions
      .filter((region) => region.map === sea)
      .sort((a, b) => a.order - b.order);
    board.dataset['sea'] = sea;
    // The board is as tall as the painting is for its width, and fits the screen by that ratio.
    const [width, height] = pictureSize(app.art, ART.map(sea));
    board.style.setProperty('--ps-picture-ratio', String(width / height));
    board.replaceChildren(
      picture(app.art, ART.map(sea), { className: 'ps-map__picture' }),
      ...regions.map((region, index) => marker(region, index, regions.length)),
    );
  };

  const tabs = createTabs(app.kit, {
    label: t('map.seas'),
    tabs: SEA_MAPS.map((sea) => ({ id: sea, name: t(`map.${sea}`) })),
    current: initial,
    testIdPrefix: 'map',
    onChange: (sea) => draw(sea as SeaMap),
  });
  draw(initial);

  const glow = view.hub.next.kind === 'level' ? findLevel(view, view.hub.next.level) : undefined;
  const heading = h('h1', { text: t('map.heading') });
  const element = h(
    'main',
    { className: 'ps-map', testId: 'screen-map' },
    topBar({
      back: canGoBack
        ? { label: t('map.back'), onPress: () => app.router.back() }
        : { label: t('map.back'), onPress: () => app.continueGame(active.diver.id) },
      title: heading,
      tools: [coins.element, saveStatus.element],
      onError: app.kit.onError,
    }),
    tabs.element,
    board,
    glow
      ? h('p', {
          className: 'ps-note',
          testId: 'map-next',
          text: t('map.next', { title: text(glow.level.titleKey) }),
        })
      : null,
  );
  return {
    element,
    title: t('map.heading'),
    field: 'sea',
    region: null,
    music: 'map',
    dispose: () => saveStatus.dispose(),
  };
}
