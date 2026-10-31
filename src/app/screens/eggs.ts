/**
 * The first egg (docs/design.md §4.1): Osmička offers the lagoon friends' eggs
 * (`view.onboarding.choices`) and the child picks one (`chooseFirstFriend`). Each egg says whose
 * it is, and the chosen egg glows before the game goes on; it hatches in the lagoon's lesson 1.
 */
import { picture } from '../art/picture';
import { taken } from '../controller/commands';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { ART, GUIDE_ID } from '../../rules/contract';
import type { ContentData } from '../../rules/contract';
import { speakerButton } from './speaker';

export function firstFriendScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const data = active.game.content().data as ContentData;
  const view = active.game.view();
  const friends = new Map(data.friends.map((friend) => [friend.id, friend]));
  const send = active.commands.captureSend();
  const line = h('p', { className: 'ps-story__line', text: t('eggs.offer') });
  const actions = h('div', { className: 'ps-story__actions' });

  let busy = false;
  const choose = async (friend: string, button: HTMLElement): Promise<void> => {
    if (busy) return;
    busy = true;
    for (const egg of eggs) egg.disabled = true;
    button.dataset['chosen'] = 'true';
    app.kit.cue('ui.tap');
    await taken(send({ type: 'chooseFirstFriend', friend }));
    const name = friends.get(friend);
    line.textContent = name
      ? t('eggs.chosen', { name: text(name.nameKey) })
      : t('eggs.chosenPlain');
    const next = candyButton({
      label: t('story.next'),
      icon: 'forward',
      variant: 'sun',
      size: 'big',
      testId: 'eggs-next',
      onPress: () => app.continueGame(active.diver.id),
      onError: app.kit.onError,
    });
    actions.replaceChildren(next);
    next.focus();
  };

  const eggs = view.onboarding.choices.map((friend) => {
    const name = friends.get(friend);
    const label = name ? text(name.nameKey) : friend;
    const button = h(
      'button',
      {
        className: 'ps-egg-choice',
        testId: `egg-${friend}`,
        attributes: { type: 'button', 'aria-label': t('eggs.choose', { name: label }) },
      },
      picture(app.art, ART.egg(friend)),
      h('span', { className: 'ps-egg-choice__label', text: label }),
    );
    button.addEventListener('click', () => {
      void choose(friend, button).catch(app.kit.onError);
    });
    return button;
  });

  const heading = h('h1', { className: 'ps-story__heading', text: t('eggs.heading') });
  const element = h(
    'main',
    { className: 'ps-story ps-eggs', testId: 'screen-eggs' },
    h('div', { className: 'ps-backdrop' }, picture(app.art, ART.scene('grotto'))),
    h(
      'section',
      { className: 'ps-story__stage' },
      h('div', { className: 'ps-story__figure' }, picture(app.art, ART.character(GUIDE_ID))),
      h(
        'div',
        { className: 'ps-card ps-story__card' },
        heading,
        h(
          'div',
          { className: 'ps-story__text' },
          line,
          h(
            'div',
            { className: 'ps-story__speaker' },
            ...speakerButton(app, active.preferences.current(), () => line.textContent ?? ''),
          ),
        ),
        h(
          'div',
          {
            className: 'ps-egg-choices',
            attributes: { role: 'group', 'aria-labelledby': 'ps-eggs-heading' },
          },
          ...eggs,
        ),
        actions,
      ),
    ),
  );
  heading.id = 'ps-eggs-heading';
  return {
    element,
    title: t('eggs.heading'),
    field: 'sea',
    region: 'sunny-lagoon',
    music: 'grotto',
    focusTarget: () => eggs.find((egg) => !egg.disabled) ?? heading,
  };
}
