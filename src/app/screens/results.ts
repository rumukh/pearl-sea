/**
 * After a round: what the child achieved and what comes next. Big moments come first, one at a
 * time and full size: an egg that hatched (the egg cracks, the baby swims out), and a monster set
 * free (the inked painting washes into its freed form, and it joins the friends' gallery). Then
 * the round's card: stars for a finished level, right answers, coins, and the smaller news
 * (a friend grew or got its crown, a new egg, a sticker, a new region). Celebrations come from the
 * round's live events, so a reload never celebrates twice; the card itself comes from the view.
 */
import { dressedFriend, picture } from '../art/picture';
import { taken } from '../controller/commands';
import { findFriend, resultsNext } from '../game/view';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import { createStars } from '../ui/meters';
import { ART } from '../../rules/contract';
import type { ContentData, GameAction, GameEvent } from '../../rules/contract';
import { friendStageName } from './celebrate';

const CELEBRATED = [
  'friend.hatched',
  'friend.grew',
  'friend.crowned',
  'egg.received',
  'sticker.earned',
  'monster.freed',
  'region.unlocked',
  'grade.completed',
] as const;

type Celebrated = Extract<GameEvent, { type: (typeof CELEBRATED)[number] }>;

export function resultsScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const diverId = active.diver.id;
  const data = active.game.content().data as ContentData;
  const view = active.game.view();
  const round = view.round!;
  const events = active.events.take(CELEBRATED) as Celebrated[];
  const next = resultsNext(view);
  const result = view.run?.result ?? null;
  const name = (list: readonly { id: string; nameKey: string }[], id: string): string => {
    const found = list.find((candidate) => candidate.id === id);
    return found ? text(found.nameKey) : id;
  };

  // ---- the card ------------------------------------------------------------------------------------
  const card = h('section', { className: 'ps-card ps-results__card', testId: 'results-card' });
  const heading = h('h1', {
    text: t(
      round.endReason === 'quit'
        ? 'results.quit'
        : round.endReason === 'time-limit'
          ? 'results.rest'
          : 'results.done',
    ),
  });
  card.append(heading);
  let stars: ReturnType<typeof createStars> | null = null;
  if (result && round.source.kind === 'level') {
    stars = createStars(result.stars, t.plural('results.stars', result.stars));
    card.append(stars.element);
  }
  if (round.type === 'problems' && round.progress.answered > 0) {
    card.append(
      h('p', {
        className: 'ps-results__score',
        testId: 'results-score',
        text: t('results.score', {
          correct: round.progress.correct,
          answered: round.progress.answered,
        }),
      }),
    );
  }
  if (round.coins > 0) {
    card.append(
      h('p', {
        className: 'ps-results__coins',
        testId: 'results-coins',
        text: t.plural('results.coins', round.coins),
      }),
    );
  }

  const news: Node[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'friend.grew': {
        const friend = findFriend(view, event.data.friend);
        news.push(
          h('p', {
            className: 'ps-celebrate',
            testId: 'celebrate-grew',
            text: t('results.grew', {
              name: friend ? text(friend.nameKey) : event.data.friend,
            }),
          }),
        );
        break;
      }
      case 'friend.crowned':
        news.push(
          h('p', {
            className: 'ps-celebrate',
            testId: 'celebrate-crowned',
            text: t('results.crowned', { name: name(data.friends, event.data.friend) }),
          }),
        );
        break;
      case 'egg.received':
        news.push(
          h(
            'div',
            { className: 'ps-celebrate', testId: 'celebrate-egg' },
            picture(app.art, ART.egg(event.data.friend), { className: 'ps-celebrate__art' }),
            h('p', { text: t('results.egg', { name: name(data.friends, event.data.friend) }) }),
          ),
        );
        break;
      case 'sticker.earned': {
        news.push(
          h(
            'div',
            { className: 'ps-celebrate', testId: 'celebrate-sticker' },
            picture(app.art, ART.sticker(event.data.sticker), { className: 'ps-celebrate__art' }),
            h('p', {
              text: t('sticker.earned', { name: name(data.stickers, event.data.sticker) }),
            }),
          ),
        );
        break;
      }
      case 'region.unlocked': {
        const region = data.regions.find((candidate) => candidate.id === event.data.region);
        news.push(
          h('p', {
            className: 'ps-celebrate',
            testId: 'celebrate-region',
            text: t('results.region', {
              name: region ? text(region.titleKey) : event.data.region,
            }),
          }),
        );
        break;
      }
      default:
        break;
    }
  }
  if (news.length > 0) {
    card.append(h('div', { className: 'ps-results__news', testId: 'results-news' }, ...news));
  }

  const go = async (): Promise<void> => {
    const dispatch = active.commands.capture();
    const action: GameAction =
      next.kind === 'activity'
        ? { type: 'startActivity', activity: { kind: 'level', index: next.index } }
        : { type: 'endRound', reason: 'done' };
    await taken(dispatch(action));
    await app.continueGame(diverId);
  };
  const button = candyButton({
    label: t(next.kind === 'activity' ? 'results.next' : 'results.home'),
    icon: 'forward',
    variant: 'sun',
    size: 'big',
    testId: 'results-next',
    onPress: go,
    onError: app.kit.onError,
  });
  card.append(h('div', { className: 'ps-row ps-row--center' }, button));

  // ---- the big moments, one at a time ---------------------------------------------------------------
  const moments: (() => HTMLElement)[] = [];
  for (const event of events) {
    if (event.type === 'friend.hatched') {
      const friend = findFriend(view, event.data.friend);
      moments.push(() =>
        h(
          'section',
          { className: 'ps-moment ps-moment--hatch', testId: 'moment-hatch' },
          h(
            'div',
            { className: 'ps-moment__art' },
            friend
              ? dressedFriend(
                  app.art,
                  { friend: friend.id, stage: friend.stage, outfit: friend.outfit },
                  { alt: friendStageName(t, text(friend.nameKey), friend.stage) },
                )
              : picture(app.art, ART.friend(event.data.friend, 'baby')),
          ),
          h('h2', {
            text: t('results.hatched', { name: name(data.friends, event.data.friend) }),
          }),
        ),
      );
    } else if (event.type === 'monster.freed') {
      const monster = event.data.monster;
      // The joke it tells once washed clean stays on the finished round's battle.
      const joke = round.type === 'problems' ? (round.battle?.jokeKey ?? null) : null;
      moments.push(() =>
        h(
          'section',
          { className: 'ps-moment ps-moment--freed', testId: 'moment-freed' },
          h(
            'div',
            { className: 'ps-moment__art ps-moment__wash' },
            picture(app.art, ART.monster(monster, 'inked'), { className: 'ps-moment__inked' }),
            picture(app.art, ART.monster(monster, 'freed'), {
              className: 'ps-moment__freed',
              alt: name(data.monsters, monster),
            }),
          ),
          h('h2', { text: t('results.freed', { name: name(data.monsters, monster) }) }),
          joke !== null && text.has(joke)
            ? h('p', { className: 'ps-moment__joke', testId: 'moment-joke', text: text(joke) })
            : null,
          h('p', { text: t('results.gallery') }),
        ),
      );
    } else if (event.type === 'grade.completed') {
      moments.push(() =>
        h(
          'section',
          { className: 'ps-moment ps-moment--grade', testId: 'moment-grade' },
          h('h2', { text: t('results.grade', { grade: event.data.grade }) }),
        ),
      );
    }
  }

  const stage = h('div', { className: 'ps-results__stage' });
  let current = 0;
  /** Draw moment `index` (or the card after the last); effects only once it is on the screen. */
  const showMoment = (index: number, live: boolean): void => {
    current = index;
    const moment = moments[index];
    if (!moment) {
      stage.replaceChildren(card);
      if (live) {
        void stars?.reveal();
        button.focus();
      }
      return;
    }
    const onward = candyButton({
      label: t('results.onward'),
      icon: 'forward',
      variant: 'sun',
      size: 'big',
      testId: 'moment-next',
      onPress: () => showMoment(index + 1, true),
      onError: app.kit.onError,
    });
    const shown = moment();
    shown.append(h('div', { className: 'ps-row ps-row--center' }, onward));
    stage.replaceChildren(shown);
    if (live) celebrate(shown, onward);
  };
  const celebrate = (shown: HTMLElement, onward: HTMLElement): void => {
    app.kit.cue(shown.dataset['testid'] === 'moment-hatch' ? 'friend.hatched' : 'monster.freed');
    void confetti(app.kit.fx);
    onward.focus();
  };
  showMoment(0, false);

  const element = h(
    'main',
    { className: 'ps-results', testId: 'screen-results' },
    h('div', { className: 'ps-backdrop' }, picture(app.art, ART.scene('grotto'))),
    stage,
  );
  return {
    element,
    title: heading.textContent ?? '',
    field: 'sea',
    region: null,
    // The victory sting is a one-shot effect of the round's events; the grotto loop plays on.
    music: 'grotto',
    focusTarget: () => stage.querySelector<HTMLElement>('button') ?? heading,
    mounted: () => {
      const shown = stage.firstElementChild as HTMLElement | null;
      const onward = stage.querySelector<HTMLElement>('[data-testid="moment-next"]');
      if (current < moments.length && shown && onward) celebrate(shown, onward);
      else void stars?.reveal();
    },
  };
}
