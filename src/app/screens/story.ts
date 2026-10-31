/**
 * A story beat: its scene, the figure who speaks (the beat's first art asset: Osmička, a monster,
 * a friend) and one short line at a time, read aloud on request or automatically, with big
 * buttons to go on. Skippable beats can be skipped whole. The last line of a beat ends the beat
 * in the rules and arrives as an event; the screen shows it before moving on.
 */
import { picture } from '../art/picture';
import { taken } from '../controller/commands';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { ART, GUIDE_ID } from '../../rules/contract';
import type { ContentData, GameEvent } from '../../rules/contract';
import { speakerButton } from './speaker';

type StoryAdvanced = Extract<GameEvent, { type: 'story.advanced' }>;

/** The catalog key of a beat node's line. */
export function nodeText(data: ContentData, beat: string, node: string): string | null {
  const graph = data.story.beats.find((candidate) => candidate.id === beat)?.graph;
  return graph?.nodes.find((candidate) => candidate.id === node)?.text ?? null;
}

/** Who a beat shows speaking: its first art asset, else Osmička the guide. */
export function beatFigure(data: ContentData, beat: string): string {
  const assets = data.story.beats.find((candidate) => candidate.id === beat)?.graph.catalogs.asset;
  return assets?.[0] ?? ART.character(GUIDE_ID);
}

export function storyScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const data = active.game.content().data as ContentData;
  const story = active.game.view().story!;

  const line = h('p', { className: 'ps-story__line', testId: 'story-line' });
  const speaker = h('div', { className: 'ps-story__speaker' });
  const actions = h('div', { className: 'ps-story__actions' });
  const figure = h(
    'div',
    { className: 'ps-story__figure', dataset: { figure: beatFigure(data, story.beat) } },
    picture(app.art, beatFigure(data, story.beat)),
  );

  let spoken = '';
  const say = (key: string): void => {
    spoken = text(key);
    line.textContent = spoken;
    speaker.replaceChildren(
      ...speakerButton(app, active.preferences.current(), () => spoken, 'story-read'),
    );
  };
  const autoRead = (): void => {
    if (active.preferences.current().autoRead) app.speak(spoken);
  };

  // The next line follows the committed view at once; the save goes on behind it.
  const send = active.commands.captureSend();
  let busy = false;
  const choose = async (choice: string | null): Promise<void> => {
    if (busy) return;
    busy = true;
    for (const button of actions.querySelectorAll('button')) button.disabled = true;
    app.stopSpeaking();
    await taken(
      send({
        type: 'storyChoice',
        beat: story.beat,
        node: story.node,
        revision: story.revision,
        choice,
      }),
    );
    const ended = active.events
      .take(['story.advanced'])
      .filter((event): event is StoryAdvanced => event.type === 'story.advanced')
      .find((event) => event.data.beat === story.beat && event.data.finished);
    const last =
      ended && ended.data.node !== story.node ? nodeText(data, story.beat, ended.data.node) : null;
    if (last && choice !== null) {
      showLast(last);
      return;
    }
    await app.continueGame(active.diver.id);
  };

  /** The beat's closing line, then on to whatever the game needs next. */
  const showLast = (key: string): void => {
    say(key);
    autoRead();
    const next = candyButton({
      label: t('story.next'),
      icon: 'forward',
      variant: 'sun',
      size: 'big',
      testId: 'story-next',
      onPress: () => app.continueGame(active.diver.id),
      onError: app.kit.onError,
    });
    actions.replaceChildren(next);
    next.focus();
  };

  for (const choice of story.choices) {
    actions.append(
      candyButton({
        label: text(choice.text),
        icon: 'forward',
        variant: 'sun',
        size: 'big',
        testId: story.choices.length === 1 ? 'story-next' : `story-choice-${choice.id}`,
        onPress: () => choose(choice.id),
        onError: app.kit.onError,
      }),
    );
  }
  if (story.choices.length === 0) {
    // A line with no choice of its own goes on with the beat's single way forward.
    actions.append(
      candyButton({
        label: t('story.next'),
        icon: 'forward',
        variant: 'sun',
        size: 'big',
        testId: 'story-next',
        onPress: () => app.continueGame(active.diver.id),
        onError: app.kit.onError,
      }),
    );
  }
  if (story.skippable) {
    actions.append(
      candyButton({
        label: t('story.skip'),
        variant: 'paper',
        size: 'small',
        testId: 'story-skip',
        onPress: () => choose(null),
        onError: app.kit.onError,
      }),
    );
  }

  say(story.text);
  const heading = h('h1', { className: 'ps-visually-hidden', text: t('story.heading') });
  const element = h(
    'main',
    { className: 'ps-story', testId: 'screen-story', dataset: { beat: story.beat } },
    h('div', { className: 'ps-backdrop' }, picture(app.art, story.scene)),
    heading,
    h(
      'section',
      { className: 'ps-story__stage' },
      figure,
      h(
        'div',
        { className: 'ps-card ps-story__card' },
        h('div', { className: 'ps-story__text' }, line, speaker),
        actions,
      ),
    ),
  );
  return {
    element,
    title: t('story.heading'),
    field: 'sea',
    region: null,
    music: 'grotto',
    focusTarget: () => actions.querySelector<HTMLElement>('button:not(:disabled)') ?? heading,
    mounted: autoRead,
  };
}
