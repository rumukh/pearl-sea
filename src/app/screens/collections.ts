/**
 * The places of the sea, one tap from the grotto (docs/design.md §4.2, §6.5, §7.5, §8):
 *
 * - **U Mrože**: Mrož Vousáč's shop of hats, glasses, scarves and grotto decorations for coins;
 *   what a child cannot afford yet stays visible with its price, never hidden.
 * - **Kamarádi**: the sea friends with how close each is to growing, and the wardrobe: what a
 *   friend wears on its head, eyes and neck (SVG cosmetics on its painting's anchors), and the six
 *   places for decorations in Bublinka's grotto.
 * - **Galerie přátel**: monsters washed clean, with the day they were freed.
 * - **Album samolepek**: a page of stickers for each region, earned ones with their day.
 * - **Velká lastura**: the Great Shell, every skill's pearls by how well they shine.
 */
import { dressedFriend, picture } from '../art/picture';
import { taken } from '../controller/commands';
import { growthOf } from '../game/view';
import type { MessageKey } from '../i18n/messages';
import type { Screen, ScreenEntry } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { coinIcon, icon } from '../ui/icons';
import { createCoinCounter, createMeter } from '../ui/meters';
import { createTabs } from '../ui/tabs';
import {
  ART,
  GROTTO_SPOTS,
  MASTERY_LEVELS,
  SHOPKEEPER_ID,
  WEARABLE_SLOTS,
} from '../../rules/contract';
import type { MarketItem, WearableSlot } from '../../rules/contract';
import { diverSaveStatus, topBar } from './common';
import { friendStageName } from './celebrate';

/** A place's screen entry: it opens the child's game and draws from the latest view. */
function placeEntry(
  app: App,
  key: string,
  diverId: string,
  draw: (active: ActiveDiver, canGoBack: boolean, redraw: () => Promise<void>) => Screen,
): ScreenEntry {
  return {
    key: `${key}:${diverId}`,
    async build(context) {
      const active = await app.openDiver(diverId);
      return draw(active, context.canGoBack, () => app.router.refresh());
    },
  };
}

function placeChrome(
  app: App,
  active: ActiveDiver,
  canGoBack: boolean,
  heading: HTMLElement,
  withCoins: boolean,
): {
  readonly bar: HTMLElement;
  readonly coins: ReturnType<typeof createCoinCounter> | null;
  dispose(): void;
} {
  const t = app.kit.t;
  const saveStatus = diverSaveStatus(app, active);
  const coins = withCoins ? createCoinCounter(app.kit, active.game.view().coins) : null;
  const bar = topBar({
    back: canGoBack
      ? { label: t('common.back'), onPress: () => app.router.back() }
      : { label: t('common.back'), onPress: () => app.continueGame(active.diver.id) },
    title: heading,
    tools: [...(coins ? [coins.element] : []), saveStatus.element],
    onError: app.kit.onError,
  });
  return { bar, coins, dispose: () => saveStatus.dispose() };
}

// ---- U Mrože -------------------------------------------------------------------------------------

export function shopScreen(app: App, diverId: string): ScreenEntry {
  return placeEntry(app, 'shop', diverId, (active, canGoBack, redraw) => {
    const t = app.kit.t;
    const text = app.content()!.text;
    const view = active.game.view();
    const heading = h('h1', { text: t('shop.heading') });
    const chrome = placeChrome(app, active, canGoBack, heading, true);
    const line = h('p', { className: 'ps-shop__line', testId: 'shop-line', text: t('shop.hello') });

    const buy = async (item: MarketItem, card: HTMLElement): Promise<void> => {
      await taken(active.commands.capture()({ type: 'buy', item: item.id }));
      app.kit.cue('fx.buy');
      app.kit.announcer.announce(t('shop.bought', { name: text(item.nameKey) }));
      card.dataset['bought'] = 'true';
      await redraw();
    };
    const items = view.market.items.filter((item) => item.available);
    const cards = items.map((item) => {
      const card = h(
        'li',
        {
          className: 'ps-shop__item',
          testId: `item-${item.id}`,
          dataset: {
            owned: String(item.owned),
            affordable: String(item.affordable),
            slot: item.slot,
          },
        },
        picture(app.art, item.assetId, { className: 'ps-shop__art' }),
        h('span', { className: 'ps-shop__name', text: text(item.nameKey) }),
      );
      if (item.owned) {
        card.append(h('span', { className: 'ps-shop__owned', text: t('shop.owned') }));
      } else {
        const price = candyButton({
          label: t.plural('shop.buy', item.price, { name: text(item.nameKey) }),
          icon: 'bag',
          variant: item.affordable ? 'sun' : 'paper',
          size: 'small',
          testId: `buy-${item.id}`,
          onPress: () => buy(item, card),
          onError: app.kit.onError,
        });
        price.disabled = !item.affordable;
        card.append(
          h('span', { className: 'ps-shop__price' }, coinIcon(), String(item.price)),
          price,
        );
      }
      return card;
    });
    const element = h(
      'main',
      { className: 'ps-shop', testId: 'screen-shop' },
      chrome.bar,
      h(
        'section',
        { className: 'ps-shop__counter' },
        h('div', { className: 'ps-shop__keeper' }, picture(app.art, ART.character(SHOPKEEPER_ID))),
        line,
      ),
      items.length > 0
        ? h('ul', { className: 'ps-shop__items', testId: 'shop-items' }, ...cards)
        : h('p', { className: 'ps-note', text: t('shop.empty') }),
      h(
        'div',
        { className: 'ps-row ps-row--center' },
        candyButton({
          label: t('shop.dress'),
          icon: 'home',
          variant: 'paper',
          testId: 'shop-dress',
          onPress: () => app.router.push(app.screens.friends(diverId)),
          onError: app.kit.onError,
        }),
      ),
    );
    return {
      element,
      title: t('shop.heading'),
      field: 'sea',
      region: null,
      music: 'grotto',
      dispose: chrome.dispose,
    };
  });
}

// ---- Kamarádi: friends, wardrobe and the grotto ------------------------------------------------------

export function friendsScreen(app: App, diverId: string): ScreenEntry {
  let chosen: string | null = null;
  return placeEntry(app, 'friends', diverId, (active, canGoBack, redraw) => {
    const t = app.kit.t;
    const text = app.content()!.text;
    const view = active.game.view();
    const heading = h('h1', { text: t('friends.heading') });
    const chrome = placeChrome(app, active, canGoBack, heading, false);
    chosen ??= view.onboarding.firstFriend ?? view.friends[0]?.id ?? null;
    const owned = view.market.items.filter((item) => item.owned);
    const friend = view.friends.find((candidate) => candidate.id === chosen);

    const list = h(
      'ul',
      { className: 'ps-friends', testId: 'friends-list' },
      ...view.friends.map((each) => {
        const name = text(each.nameKey);
        const button = h(
          'button',
          {
            className: 'ps-friends__friend',
            testId: `friend-${each.id}`,
            dataset: { stage: each.stage, hungry: String(each.hungry) },
            attributes: {
              type: 'button',
              'aria-pressed': String(each.id === chosen),
              'aria-label': friendStageName(t, name, each.stage),
            },
          },
          dressedFriend(app.art, { friend: each.id, stage: each.stage, outfit: each.outfit }),
          h('span', { className: 'ps-friends__name', text: name }),
          each.hungry
            ? h('span', { className: 'ps-friends__hungry', text: t('friends.hungry') })
            : null,
        );
        button.addEventListener('click', () => {
          chosen = each.id;
          void redraw().catch(app.kit.onError);
        });
        return h('li', {}, button);
      }),
    );

    const wardrobe = (): HTMLElement | null => {
      if (!friend) return null;
      const name = text(friend.nameKey);
      const growth = growthOf(friend);
      const slots = WEARABLE_SLOTS.map((slot) => {
        const choices = owned.filter((item) => item.slot === slot);
        const select = h('select', {
          className: 'ps-select',
          testId: `wear-${slot}`,
          attributes: { id: `ps-wear-${slot}` },
        });
        select.append(
          h('option', { text: t('friends.nothing'), attributes: { value: '' } }),
          ...choices.map((item) =>
            h('option', { text: text(item.nameKey), attributes: { value: item.id } }),
          ),
        );
        select.value = friend.outfit[slot] ?? '';
        select.disabled = friend.stage === 'egg' || choices.length === 0;
        select.addEventListener('change', () => {
          const item = select.value === '' ? null : select.value;
          void taken(
            active.commands.capture()({
              type: 'equip',
              friend: friend.id,
              slot: slot as WearableSlot,
              item,
            }),
          )
            .then(redraw)
            .catch(app.kit.onError);
        });
        return h(
          'div',
          { className: 'ps-field' },
          h('label', {
            className: 'ps-field__label',
            text: t(`friends.slot.${slot}` as MessageKey),
            attributes: { for: `ps-wear-${slot}` },
          }),
          select,
        );
      });
      return h(
        'section',
        { className: 'ps-card ps-wardrobe', testId: 'wardrobe' },
        h('h2', { text: name }),
        h(
          'div',
          { className: 'ps-wardrobe__friend' },
          dressedFriend(
            app.art,
            { friend: friend.id, stage: friend.stage, outfit: friend.outfit },
            {
              alt: friendStageName(t, name, friend.stage),
            },
          ),
        ),
        h('p', { className: 'ps-wardrobe__hook', text: text(friend.mnemonicKey) }),
        growth
          ? createMeter({
              label: t(`grow.${growth.next}` as MessageKey),
              max: growth.need,
              value: growth.have,
              valueText: (value, max) => t('grow.progress', { value, max }),
              testId: 'wardrobe-growth',
            }).element
          : h('p', { className: 'ps-note', text: t('friends.crowned') }),
        friend.stage === 'egg'
          ? h('p', { className: 'ps-note', text: t('friends.eggWardrobe') })
          : h('div', { className: 'ps-wardrobe__slots' }, ...slots),
      );
    };

    const decorations = owned.filter((item) => item.slot === 'grotto');
    const grotto = h(
      'section',
      { className: 'ps-card ps-grotto-decor', testId: 'grotto-decor' },
      h('h2', { text: t('friends.grotto') }),
      decorations.length === 0
        ? h('p', { className: 'ps-note', text: t('friends.noDecorations') })
        : h(
            'div',
            { className: 'ps-grotto-decor__spots' },
            ...Array.from({ length: GROTTO_SPOTS }, (_, spot) => {
              const select = h('select', {
                className: 'ps-select',
                testId: `decor-${spot}`,
                attributes: { id: `ps-decor-${spot}` },
              });
              select.append(
                h('option', { text: t('friends.nothing'), attributes: { value: '' } }),
                ...decorations.map((item) =>
                  h('option', { text: text(item.nameKey), attributes: { value: item.id } }),
                ),
              );
              select.value = view.grotto.spots[spot] ?? '';
              select.addEventListener('change', () => {
                const item = select.value === '' ? null : select.value;
                void taken(active.commands.capture()({ type: 'decorate', spot, item }))
                  .then(redraw)
                  .catch(app.kit.onError);
              });
              return h(
                'div',
                { className: 'ps-field' },
                h('label', {
                  className: 'ps-field__label',
                  text: t('friends.spot', { number: spot + 1 }),
                  attributes: { for: `ps-decor-${spot}` },
                }),
                select,
              );
            }),
          ),
    );

    const element = h(
      'main',
      { className: 'ps-friends-screen', testId: 'screen-friends' },
      chrome.bar,
      view.friends.length > 0 ? list : h('p', { className: 'ps-note', text: t('hub.noFriends') }),
      wardrobe(),
      grotto,
    );
    return {
      element,
      title: t('friends.heading'),
      field: 'sea',
      region: null,
      music: 'grotto',
      dispose: chrome.dispose,
    };
  });
}

// ---- Galerie přátel ----------------------------------------------------------------------------------

export function galleryScreen(app: App, diverId: string): ScreenEntry {
  return placeEntry(app, 'gallery', diverId, (active, canGoBack) => {
    const t = app.kit.t;
    const text = app.content()!.text;
    const view = active.game.view();
    const heading = h('h1', { text: t('gallery.heading') });
    const chrome = placeChrome(app, active, canGoBack, heading, false);
    const freed = view.gallery.monsters.filter((monster) => monster.freed).length;
    const element = h(
      'main',
      { className: 'ps-gallery', testId: 'screen-gallery' },
      chrome.bar,
      h('p', {
        className: 'ps-note',
        testId: 'gallery-count',
        text: t('gallery.count', { freed, total: view.gallery.monsters.length }),
      }),
      h(
        'ul',
        { className: 'ps-gallery__frames' },
        ...view.gallery.monsters.map((monster) =>
          h(
            'li',
            {
              className: 'ps-gallery__frame',
              testId: `gallery-${monster.id}`,
              dataset: { freed: String(monster.freed) },
            },
            picture(app.art, ART.monster(monster.id, monster.freed ? 'freed' : 'inked'), {
              alt: monster.freed ? text(monster.nameKey) : t('gallery.waiting'),
              className: monster.freed
                ? 'ps-gallery__art'
                : 'ps-gallery__art ps-gallery__art--waiting',
            }),
            h('span', {
              className: 'ps-gallery__name',
              text: monster.freed ? text(monster.nameKey) : t('gallery.unknown'),
            }),
            monster.freed && monster.day
              ? h('span', {
                  className: 'ps-gallery__day',
                  text: t('gallery.day', { day: czechDate(monster.day) }),
                })
              : null,
          ),
        ),
      ),
    );
    return {
      element,
      title: t('gallery.heading'),
      field: 'sea',
      region: null,
      music: 'grotto',
      dispose: chrome.dispose,
    };
  });
}

/** `2026-10-31` as a Czech date, `31. 10. 2026`. */
export function czechDate(day: string): string {
  const [year, month, date] = day.split('-');
  return `${Number(date)}. ${Number(month)}. ${year}`;
}

// ---- Album samolepek ---------------------------------------------------------------------------------

export function albumScreen(app: App, diverId: string): ScreenEntry {
  let page: string | null = null;
  return placeEntry(app, 'album', diverId, (active, canGoBack) => {
    const t = app.kit.t;
    const text = app.content()!.text;
    const view = active.game.view();
    const data = active.game.content().data;
    const heading = h('h1', { text: t('album.heading') });
    const chrome = placeChrome(app, active, canGoBack, heading, false);
    const pages = view.album.pages;
    page ??= pages[0]?.region ?? null;
    const sheet = h('div', { className: 'ps-album__page', testId: 'album-page' });
    const drawPage = (region: string): void => {
      page = region;
      const current = pages.find((candidate) => candidate.region === region);
      sheet.replaceChildren(
        h(
          'ul',
          { className: 'ps-album__stickers' },
          ...(current?.stickers ?? []).map((sticker) =>
            h(
              'li',
              {
                className: 'ps-album__sticker',
                testId: `sticker-${sticker.id}`,
                dataset: { earned: String(sticker.earned) },
              },
              sticker.earned
                ? picture(app.art, ART.sticker(sticker.id), { alt: text(sticker.nameKey) })
                : h(
                    'span',
                    { className: 'ps-album__empty', attributes: { 'aria-hidden': 'true' } },
                    icon('question'),
                  ),
              h('span', {
                className: 'ps-album__name',
                text: sticker.earned ? text(sticker.nameKey) : t('album.missing'),
              }),
              sticker.earned && sticker.day
                ? h('span', { className: 'ps-album__day', text: czechDate(sticker.day) })
                : null,
            ),
          ),
        ),
      );
    };
    const regionTitle = (region: string): string => {
      const found = data.regions.find((candidate) => candidate.id === region);
      return found ? text(found.titleKey) : region;
    };
    const tabs =
      pages.length > 1
        ? createTabs(app.kit, {
            label: t('album.pages'),
            tabs: pages.map((each) => ({ id: each.region, name: regionTitle(each.region) })),
            current: page ?? pages[0]!.region,
            testIdPrefix: 'album',
            arrows: { previous: t('album.previous'), next: t('album.next') },
            onChange: drawPage,
          })
        : null;
    if (page) drawPage(page);
    const element = h(
      'main',
      { className: 'ps-album', testId: 'screen-album' },
      chrome.bar,
      h('p', {
        className: 'ps-note',
        testId: 'album-count',
        text: t('album.count', { earned: view.album.earned, total: view.album.total }),
      }),
      tabs?.element ?? null,
      sheet,
    );
    return {
      element,
      title: t('album.heading'),
      field: 'sea',
      region: null,
      music: 'grotto',
      dispose: chrome.dispose,
    };
  });
}

// ---- Velká lastura ---------------------------------------------------------------------------------

export function shellScreen(app: App, diverId: string): ScreenEntry {
  return placeEntry(app, 'shell', diverId, (active, canGoBack) => {
    const t = app.kit.t;
    const text = app.content()!.text;
    const view = active.game.view();
    const heading = h('h1', { text: t('shell.heading') });
    const chrome = placeChrome(app, active, canGoBack, heading, false);
    const levels = (counts: Readonly<Record<string, number>>): HTMLElement =>
      h(
        'span',
        { className: 'ps-shell__pearls' },
        ...MASTERY_LEVELS.map((level) =>
          h(
            'span',
            { className: 'ps-shell__level', dataset: { level } },
            h('span', { className: 'ps-shell__pearl', attributes: { 'aria-hidden': 'true' } }),
            h('span', {
              text: t(`shell.count.${level}` as MessageKey, { count: counts[level] ?? 0 }),
            }),
          ),
        ),
      );
    const strands = view.shell.strands.map((strand) =>
      h(
        'section',
        { className: 'ps-card ps-shell__strand', testId: `strand-${strand.strand}` },
        h('h2', { text: t(`strand.${strand.strand}` as MessageKey) }),
        h(
          'ul',
          { className: 'ps-shell__skills' },
          ...strand.skills.map((skill) =>
            h(
              'li',
              { className: 'ps-shell__skill', testId: `skill-${skill.skill}` },
              h('span', { className: 'ps-shell__skill-name', text: text(skill.titleKey) }),
              levels(skill.counts),
              skill.dull > 0
                ? h('span', {
                    className: 'ps-shell__dull',
                    text: t.plural('shell.dull', skill.dull),
                  })
                : null,
            ),
          ),
        ),
      ),
    );
    const element = h(
      'main',
      { className: 'ps-shell-screen', testId: 'screen-shell' },
      chrome.bar,
      h(
        'section',
        { className: 'ps-card ps-shell__total', testId: 'shell-total' },
        h('h2', { text: t('shell.total') }),
        levels(view.shell.counts),
      ),
      ...strands,
    );
    return {
      element,
      title: t('shell.heading'),
      field: 'sea',
      region: null,
      music: 'grotto',
      dispose: chrome.dispose,
    };
  });
}
