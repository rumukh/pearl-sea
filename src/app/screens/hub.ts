/**
 * Bublinka's home grotto (docs/design.md §4.2): the featured friend big, with how close it is to
 * growing (the rules' exact `next.have` of `next.need`), the other friends as a strip that opens
 * the friends' screen, the coin purse and save status, today's goal with the week's practised
 * days (a habit view, never a streak), the daily quests and the treasure chest, and one big
 * "Dnešní výprava" button that does what the game suggests next. The places of the sea are one
 * tap away: the map, U Mrože, the friends, the gallery, the album and the Great Shell.
 */
import { dressedFriend } from '../art/picture';
import { taken } from '../controller/commands';
import { adventureFor, featuredFriend, findLevel, growthOf } from '../game/view';
import type { MessageKey } from '../i18n/messages';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import type { IconName } from '../ui/icons';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { FriendView, GameView, Grant } from '../../rules/contract';
import { diverSaveStatus, topBar } from './common';
import { friendStageName, toastStickers } from './celebrate';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Other friends drawn in the grotto's strip; the rest are counted ("+8"). */
export const GROTTO_FRIENDS = 5;

export function hubScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const diverId = active.diver.id;
  const view = active.game.view();
  const saveStatus = diverSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, view.coins);
  const heading = h('h1', {
    className: 'ps-hub__greeting',
    testId: 'hub-greeting',
    text: t('hub.greeting', { name: active.diver.name }),
  });

  // ---- Friends ----------------------------------------------------------------------------
  const friendsSection = (current: GameView): HTMLElement => {
    const featured = featuredFriend(current);
    if (!featured) {
      return h(
        'section',
        { className: 'ps-hub__friend', testId: 'hub-friend' },
        h('p', { className: 'ps-note', text: t('hub.noFriends') }),
      );
    }
    const name = text(featured.nameKey);
    const parts: Node[] = [
      h(
        'div',
        {
          className: 'ps-hub__featured',
          testId: 'hub-featured',
          dataset: {
            friend: featured.id,
            stage: featured.stage,
            expression: current.daily?.sleepy ? 'sleepy' : featured.expression,
          },
        },
        dressedFriend(
          app.art,
          { friend: featured.id, stage: featured.stage, outfit: featured.outfit },
          { alt: friendStageName(t, name, featured.stage) },
        ),
      ),
      h('p', { className: 'ps-hub__friend-name', text: name }),
    ];
    const growth = growthOf(featured);
    if (growth) {
      parts.push(
        createMeter({
          label: t(`grow.${growth.next}` as MessageKey),
          max: growth.need,
          value: growth.have,
          valueText: (value, max) => t('grow.progress', { value, max }),
          testId: 'friend-growth',
        }).element,
      );
      if (growth.monster) {
        const monster = current.hub.regions
          .map((region) => region.monster)
          .find((candidate) => candidate?.id === growth.monster);
        if (monster && !monster.freed) {
          parts.push(
            h('p', {
              className: 'ps-note',
              text: t('grow.monster', { name: text(monster.nameKey) }),
            }),
          );
        }
      }
    }
    const others = current.friends.filter((friend) => friend.id !== featured.id);
    if (others.length > 0) parts.push(friendsStrip(others));
    return h('section', { className: 'ps-hub__friend', testId: 'hub-friend' }, ...parts);
  };

  /** The other friends, small, in one strip that opens the friends' screen. */
  const friendsStrip = (others: readonly FriendView[]): HTMLElement => {
    const shown = others.slice(0, GROTTO_FRIENDS);
    const more = others.length - shown.length;
    const strip = h(
      'button',
      {
        className: 'ps-hub__friends',
        testId: 'hub-friends',
        attributes: { type: 'button' },
      },
      h(
        'span',
        { className: 'ps-hub__friends-art', attributes: { 'aria-hidden': 'true' } },
        ...shown.map((friend) =>
          dressedFriend(
            app.art,
            { friend: friend.id, stage: friend.stage, outfit: friend.outfit },
            {
              className: 'ps-hub__small-friend',
            },
          ),
        ),
      ),
      h('span', { className: 'ps-hub__friends-label', text: t('hub.friends') }),
      more > 0
        ? h('span', {
            className: 'ps-hub__friends-more',
            text: t('hub.moreFriends', { count: more }),
            attributes: { 'aria-hidden': 'true' },
          })
        : null,
      h('span', {
        className: 'ps-visually-hidden',
        text: others.map((friend) => text(friend.nameKey)).join(', '),
      }),
    );
    strip.addEventListener('click', () => {
      void app.router.push(app.screens.friends(diverId)).catch(app.kit.onError);
    });
    return strip;
  };

  // ---- The daily adventure -------------------------------------------------------------------
  const adventureNote = (current: GameView): string => {
    const next = current.hub.next;
    switch (next.kind) {
      case 'level': {
        const found = findLevel(current, next.level);
        return found
          ? t('adventure.level', { title: text(found.level.titleKey) })
          : t('adventure.go');
      }
      case 'minigame':
        return t('adventure.minigame');
      case 'snack':
        return t('adventure.snack');
      case 'placement':
        return t('adventure.placement');
      case 'chest':
        return t('adventure.chest');
      case 'story':
      case 'first-friend':
        return t('adventure.story');
      case 'free-play':
        return t('adventure.free');
    }
  };
  const adventure = candyButton({
    label: t('adventure.button'),
    icon: 'play',
    variant: 'sun',
    size: 'big',
    testId: 'adventure',
    onPress: async () => {
      const step = adventureFor(view);
      if (step.kind === 'map') {
        await app.router.push(app.screens.map(diverId));
        return;
      }
      if (step.kind === 'action') {
        await taken(active.commands.capture()(step.action));
        if (step.action.type === 'openChest') {
          await showChest();
          return;
        }
      }
      await app.continueGame(diverId);
    },
    onError: app.kit.onError,
  });

  // ---- Today: goal, week, quests, chest ---------------------------------------------------------
  const todaySection = (current: GameView): HTMLElement | null => {
    const daily = current.daily;
    if (!daily) return null;
    const goal = createMeter({
      label: t('today.goal'),
      max: Math.max(1, daily.goal),
      value: Math.min(daily.correct, daily.goal),
      valueText: (value, max) => t('today.goalValue', { value, max }),
      testId: 'today-goal',
    });
    const week = h(
      'ol',
      { className: 'ps-week', testId: 'today-week', attributes: { 'aria-label': t('today.week') } },
      ...WEEKDAYS.map((day, index) => {
        const practised = daily.week[index] === true;
        return h(
          'li',
          {
            className: 'ps-week__day',
            dataset: { practised: String(practised) },
          },
          h('span', { className: 'ps-week__dot', attributes: { 'aria-hidden': 'true' } }),
          h('span', { className: 'ps-week__name', text: t(`day.${day}` as MessageKey) }),
          h('span', {
            className: 'ps-visually-hidden',
            text: practised ? t('today.practised') : t('today.notPractised'),
          }),
        );
      }),
    );
    const quests = h(
      'ul',
      { className: 'ps-quests', testId: 'today-quests' },
      ...daily.quests.map((quest) => {
        const row = h(
          'li',
          {
            className: 'ps-quest',
            dataset: { done: String(quest.done), claimed: String(quest.claimed) },
          },
          h('span', {
            className: 'ps-quest__title',
            text: text.counted(quest.titleKey, quest.target),
          }),
          h('span', {
            className: 'ps-quest__progress',
            text: t('today.questProgress', {
              value: Math.min(quest.progress, quest.target),
              max: quest.target,
            }),
          }),
        );
        if (quest.done && !quest.claimed) {
          row.append(
            candyButton({
              label: t.plural('today.claim', quest.coins),
              icon: 'gift',
              variant: 'sun',
              size: 'small',
              testId: `quest-claim-${quest.id}`,
              onPress: async () => {
                await taken(active.commands.capture()({ type: 'claimQuest', quest: quest.id }));
                await coins.gain(quest.coins, row);
                await app.continueGame(diverId);
              },
              onError: app.kit.onError,
            }),
          );
        }
        return row;
      }),
    );
    const chest =
      daily.chest === 'ready'
        ? candyButton({
            label: t('today.chestOpen'),
            icon: 'gift',
            variant: 'coral',
            testId: 'chest-open',
            onPress: async () => {
              await taken(active.commands.capture()({ type: 'openChest' }));
              await showChest();
            },
            onError: app.kit.onError,
          })
        : h('p', {
            className: 'ps-note',
            testId: 'chest-state',
            dataset: { chest: daily.chest },
            text: t(daily.chest === 'opened' ? 'today.chestOpened' : 'today.chestLocked'),
          });
    return h(
      'section',
      { className: 'ps-card ps-hub__today', testId: 'hub-today' },
      h('h2', { text: t('today.heading') }),
      goal.element,
      week,
      daily.quests.length > 0 ? h('h3', { text: t('today.quests') }) : null,
      daily.quests.length > 0 ? quests : null,
      chest,
    );
  };

  /** What the treasure chest held, from its event; then the grotto again. */
  const showChest = async (): Promise<void> => {
    const opened = active.events
      .take(['chest.opened'])
      .find((event) => event.type === 'chest.opened');
    const grant = opened?.type === 'chest.opened' ? opened.data.grant : null;
    app.kit.cue('fx.chest');
    const handle = openModal<void>(app.kit, {
      label: t('chest.heading'),
      testId: 'chest-dialog',
      dismissValue: undefined,
      build(body, close) {
        body.append(
          h('p', { testId: 'chest-grant', text: grant ? grantText(grant) : t('chest.empty') }),
          candyButton({
            label: t('chest.close'),
            icon: 'check',
            variant: 'sun',
            testId: 'chest-close',
            onPress: () => close(undefined),
            onError: app.kit.onError,
          }),
        );
      },
    });
    await handle.result;
    await app.continueGame(diverId);
  };

  const grantText = (grant: Grant): string => {
    const data = active.game.content().data;
    switch (grant.kind) {
      case 'coins':
        return t.plural('chest.coins', grant.amount);
      case 'cosmetic': {
        const item = data.cosmetics.find((candidate) => candidate.id === grant.item);
        return t('chest.cosmetic', { name: item ? text(item.nameKey) : grant.item });
      }
      case 'egg': {
        const friend = data.friends.find((candidate) => candidate.id === grant.friend);
        return t('chest.egg', { name: friend ? text(friend.nameKey) : grant.friend });
      }
    }
  };

  // ---- Places ----------------------------------------------------------------------------------
  const place = (
    label: MessageKey,
    iconName: IconName,
    testId: string,
    open: () => Promise<void>,
  ) =>
    candyButton({
      label: t(label),
      icon: iconName,
      variant: 'paper',
      testId,
      onPress: open,
      onError: app.kit.onError,
    });
  const places = h(
    'nav',
    { className: 'ps-hub__places', attributes: { 'aria-label': t('hub.places') } },
    place('hub.map', 'map', 'place-map', () => app.router.push(app.screens.map(diverId))),
    place('hub.shop', 'bag', 'place-shop', () => app.router.push(app.screens.shop(diverId))),
    place('hub.friends', 'home', 'place-friends', () =>
      app.router.push(app.screens.friends(diverId)),
    ),
    place('hub.gallery', 'sparkle', 'place-gallery', () =>
      app.router.push(app.screens.gallery(diverId)),
    ),
    place('hub.album', 'book', 'place-album', () => app.router.push(app.screens.album(diverId))),
    place('hub.shell', 'pearl', 'place-shell', () => app.router.push(app.screens.shell(diverId))),
  );

  const goodbye = candyButton({
    label: t('hub.goodbye'),
    icon: 'close',
    variant: 'paper',
    size: 'small',
    testId: 'hub-goodbye',
    onPress: () => app.router.push(app.screens.goodbye(diverId)),
    onError: app.kit.onError,
  });

  const element = h(
    'main',
    { className: 'ps-hub', testId: 'screen-hub' },
    topBar({
      title: heading,
      tools: [coins.element, saveStatus.element, goodbye],
      onError: app.kit.onError,
    }),
    h(
      'div',
      { className: 'ps-hub__layout' },
      friendsSection(view),
      h(
        'section',
        { className: 'ps-hub__adventure', testId: 'hub-adventure' },
        adventure,
        h('p', { className: 'ps-hub__next', testId: 'adventure-next', text: adventureNote(view) }),
      ),
      todaySection(view),
      places,
    ),
  );
  return {
    element,
    title: t('hub.title'),
    field: 'sea',
    region: null,
    music: 'grotto',
    focusTarget: () => adventure,
    mounted: () => toastStickers(app, active),
    dispose: () => saveStatus.dispose(),
  };
}
