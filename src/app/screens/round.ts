/**
 * Problem rounds: Krmení (the core), Inkoustová věta, Lov chyb, Určování, the monster battle,
 * Svačinka and the placement check, all on the rules' `ProblemRoundView` (docs/design.md §5).
 *
 * One problem at a time, one step at a time (a gap, or the find and then the fix of a mistake),
 * answered with choice tiles, the big letter pad or the Czech keyboard, as the view resolves.
 * A right answer sends a snack to the friend being fed (an egg glows instead), or, in a battle,
 * a bubble from Bublinka that washes ink off the monster; the ink meter shows how much is left.
 * The monster's harmless ink blots (`ink.splashed`) wait on the screen until the child wipes
 * them away with a tap, and its little jokes (`BattleView.jokeKey`, told with `monster.joked`)
 * appear in a speech bubble. An Inkoustík smudging a problem is splashed away by the right
 * answer.
 *
 * A miss is never punished (docs/design.md §14): an orange "?", "Skoro! Správně je …", the
 * strategy that helps, and the child goes on when ready. Response time excludes pauses. Every
 * answer goes through the command controller (stale-view guard, strict save); Escape or the pause
 * button pauses the game.
 */
import { dressedFriend, picture } from '../art/picture';
import { CommandRejectedError } from '../controller/commands';
import { createResponseTimer } from '../game/timer';
import { findFriend } from '../game/view';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { createCzechKeyboard } from '../ui/czech-keyboard';
import type { CzechKeyboardView } from '../ui/czech-keyboard';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { centerOf, flyAlongArc } from '../ui/fly';
import { icon } from '../ui/icons';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { MeterView } from '../ui/meters';
import { prefersReducedMotion } from '../ui/motion';
import { createTiles } from '../ui/tiles';
import type { TilesView } from '../ui/tiles';
import { ART, GUIDE_ID, SUBMARINE_ID } from '../../rules/contract';
import type {
  AnswerValue,
  ContentData,
  Feedback,
  GameView,
  ProblemRoundView,
  ProblemView,
} from '../../rules/contract';
import { diverSaveStatus, topBar } from './common';
import { activityName } from './level';
import {
  answerText,
  hintText,
  problemDisplay,
  promptKey,
  spokenProblem,
  stepAnswer,
  stepHint,
} from './problem-view';
import { speakerButton } from './speaker';

/** How long a right answer's praise stays before the next step. */
const CORRECT_PAUSE_MS = 1100;
/** How often the time limit is checked. */
const REST_CHECK_MS = 5000;

export function problemRound(view: GameView): ProblemRoundView | null {
  return view.round?.type === 'problems' ? view.round : null;
}

/** A live event as raw data: some types (`monster.joked`) are newer than this build's contract. */
type RawEvent = { readonly type: string; readonly data: Readonly<Record<string, unknown>> };

export function problemRoundScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const host = active.game.host;
  const diverId = active.diver.id;
  const data = active.game.content().data as ContentData;
  const first = problemRound(active.game.view())!;
  const activity = first.activity;
  const placement = activity === 'placement';
  const battle = first.battle !== null;
  const levelId = first.source.kind === 'level' ? first.source.level : null;
  const level = levelId ? data.levels.find((candidate) => candidate.id === levelId) : undefined;
  const regionId = level?.region ?? null;

  // ---- chrome ----------------------------------------------------------------------------------
  const saveStatus = diverSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.view().coins);
  const heading = h('h1', { className: 'ps-round__title', text: activityName(t, activity) });
  let progress: MeterView;
  if (first.battle) {
    progress = createMeter({
      label: t('battle.ink', { name: text(first.battle.nameKey) }),
      max: Math.max(1, first.battle.target),
      value: first.battle.washed,
      valueText: (value, max) => t('battle.inkValue', { value, max }),
      testId: 'round-progress',
    });
  } else if (first.placement) {
    progress = createMeter({
      label: t('round.progress'),
      max: Math.max(1, first.placement.steps),
      value: first.placement.step,
      valueText: (value, max) => t('round.progressValue', { value, max }),
      testId: 'round-progress',
    });
  } else {
    progress = createMeter({
      label: t('round.progress'),
      max: Math.max(1, first.progress.target ?? 1),
      value: first.progress.answered,
      valueText: (value, max) => t('round.progressValue', { value, max }),
      testId: 'round-progress',
    });
  }
  const streak = h('span', {
    className: 'ps-round__streak',
    testId: 'round-streak',
    attributes: { 'aria-live': 'polite' },
  });

  // ---- stage -----------------------------------------------------------------------------------
  const companion = h('div', { className: 'ps-round__companion', testId: 'round-companion' });
  const jokeBubble = h('p', {
    className: 'ps-round__joke',
    testId: 'monster-joke',
    attributes: { 'aria-live': 'polite' },
  });
  jokeBubble.hidden = true;
  const blots = h('div', { className: 'ps-round__splashes', testId: 'ink-splashes' });
  const ambushSlot = h('div', { className: 'ps-round__ambush' });
  const note = h('p', { className: 'ps-round__note', testId: 'problem-note' });
  const prompt = h('p', { className: 'ps-round__prompt', testId: 'problem-prompt' });
  const displaySlot = h('div', { className: 'ps-round__display' });
  const tools = h('div', { className: 'ps-round__tools' });
  const hintSlot = h('p', { className: 'ps-round__hint', testId: 'hint-text' });
  hintSlot.hidden = true;
  const feedback = h('div', {
    className: 'ps-feedback',
    testId: 'feedback',
    dataset: { kind: 'none' },
    attributes: { 'aria-live': 'polite' },
  });
  const answerSlot = h('div', { className: 'ps-round__answer', testId: 'answer' });
  const nextSlot = h('div', { className: 'ps-round__next' });

  const timer = createResponseTimer();
  let tiles: TilesView | undefined;
  let keyboard: CzechKeyboardView | undefined;
  let shown: ProblemView | null = null;
  let send = active.commands.captureSend();
  let busy = false;
  let pausedByDialog = false;
  let disposed = false;
  let restTime = false;

  /** The tile of a choice, to fly from; the answer area when it is not found. */
  const tileOf = (id: string): Element =>
    [...answerSlot.querySelectorAll<HTMLElement>('[data-testid]')].find((tile) =>
      tile.dataset['testid']?.endsWith(`-${id}`),
    ) ?? answerSlot;
  /** Mark how a picked word went (picks are word buttons, not tiles). */
  const markPick = (value: AnswerValue, state: 'correct' | 'miss'): void => {
    if (value.kind !== 'pick') return;
    const word = answerSlot.querySelector<HTMLElement>(`[data-testid="pick-${value.index}"]`);
    if (word) word.dataset['state'] = state;
  };

  const releaseInput = (): void => {
    tiles?.dispose();
    tiles = undefined;
    keyboard = undefined;
  };
  const setInputDisabled = (disabled: boolean): void => {
    tiles?.setDisabled(disabled);
    keyboard?.setDisabled(disabled);
    for (const button of answerSlot.querySelectorAll<HTMLButtonElement>('.ps-word-pick')) {
      button.disabled = disabled;
    }
  };

  /** The friend being fed, the monster being washed, or Osmička for the placement check. */
  const paintCompanion = (view: GameView): void => {
    const round = problemRound(view);
    if (round?.battle) {
      const left = round.battle.target > 0 ? 1 - round.battle.washed / round.battle.target : 0;
      // The freed form shows through as the ink washes off; the last of it goes in the results.
      const monster = h(
        'div',
        {
          className: 'ps-round__monster',
          testId: 'battle-monster',
          dataset: { monster: round.battle.monster, washed: String(round.battle.washed) },
        },
        picture(app.art, ART.monster(round.battle.monster, 'freed'), {
          className: 'ps-round__monster-freed',
        }),
        picture(app.art, ART.monster(round.battle.monster, 'inked'), {
          className: 'ps-round__monster-inked',
          alt: text(round.battle.nameKey),
        }),
      );
      monster.style.setProperty('--ink-left', String(Math.max(0, Math.min(1, left))));
      showJoke(round.battle.jokeKey);
      companion.replaceChildren(
        h(
          'div',
          { className: 'ps-round__bublinka', testId: 'bublinka' },
          picture(app.art, ART.character(SUBMARINE_ID)),
        ),
        monster,
        jokeBubble,
      );
      return;
    }
    const friendId = round?.friend?.id ?? null;
    const friend = friendId ? findFriend(view, friendId) : undefined;
    if (friend) {
      companion.replaceChildren(
        h(
          'div',
          {
            className: 'ps-round__friend',
            testId: 'round-friend',
            dataset: { friend: friend.id, expression: round?.friend?.expression ?? 'idle' },
          },
          dressedFriend(
            app.art,
            { friend: friend.id, stage: friend.stage, outfit: friend.outfit },
            { alt: text(friend.nameKey) },
          ),
        ),
      );
      return;
    }
    companion.replaceChildren(
      h(
        'div',
        { className: 'ps-round__friend', testId: 'round-friend' },
        picture(app.art, ART.character(GUIDE_ID)),
      ),
    );
  };

  const setFeedback = (
    kind: 'none' | 'correct' | 'miss' | 'info',
    ...children: (Node | null)[]
  ): void => {
    feedback.dataset['kind'] = kind;
    feedback.replaceChildren(...children.filter((child): child is Node => child !== null));
  };

  const updateProgress = (round: ProblemRoundView): void => {
    if (round.battle) progress.update(round.battle.washed);
    else if (round.placement) progress.update(round.placement.step);
    else progress.update(round.progress.answered);
    streak.textContent =
      round.progress.streak >= 3 ? t('round.streak', { count: round.progress.streak }) : '';
  };

  // ---- the monster's ink blots and jokes ----------------------------------------------------------
  const splash = (count: number): void => {
    for (let index = 0; index < count; index++) {
      const spot = blots.childElementCount;
      const blot = h('button', {
        className: 'ps-ink-blot',
        testId: 'ink-splash',
        attributes: { type: 'button', 'aria-label': t('battle.wipe') },
      });
      blot.style.left = `${12 + ((spot * 37) % 70)}%`;
      blot.style.top = `${10 + ((spot * 53) % 60)}%`;
      blot.addEventListener('click', () => {
        app.kit.cue('fx.wipe');
        blot.dataset['wiped'] = 'true';
        blot.remove();
      });
      blots.append(blot);
    }
    if (count > 0) app.kit.announcer.announce(t('battle.splashed'));
  };
  /**
   * The monster's joke on screen (`BattleView.jokeKey`): told at the battle's start, after every
   * fifth right answer and when it is washed clean, and gone again after the next answer. It
   * comes from the view, so a reload shows the same joke; `aria-live` reads a new one out.
   */
  const showJoke = (key: string | null): void => {
    const line = key !== null && text.has(key) ? text(key) : '';
    if (jokeBubble.textContent !== line) jokeBubble.textContent = line;
    jokeBubble.hidden = line === '';
  };
  /** Live battle events since the last look: ink blots to wipe away. */
  const takeBattleEvents = (): void => {
    for (const event of active.events.take([
      'ink.splashed',
      'monster.joked',
    ]) as unknown as RawEvent[]) {
      if (event.type === 'ink.splashed') splash(Number(event.data['blots'] ?? 0));
    }
  };

  // ---- one problem -------------------------------------------------------------------------------
  const hintButton = (problem: ProblemView): HTMLElement[] => {
    const hint = stepHint(problem.problem, problem.step);
    if (!hint) return [];
    const show = (): void => {
      hintSlot.textContent = hintText(hint, t, text);
      hintSlot.hidden = false;
    };
    if (problem.hinted) show();
    return [
      candyButton({
        label: t('round.hint'),
        icon: 'hint',
        variant: 'paper',
        size: 'small',
        keepsFocus: true,
        testId: 'round-hint',
        onPress: async () => {
          if (!shown?.hinted) await active.commands.capture()({ type: 'hint' });
          send = active.commands.captureSend();
          show();
        },
        onError: app.kit.onError,
      }),
    ];
  };

  const showAmbush = (problem: ProblemView): void => {
    if (!problem.ambush) {
      ambushSlot.replaceChildren();
      return;
    }
    const inkoustik = data.inkoustici.find((candidate) => candidate.id === problem.ambush);
    ambushSlot.replaceChildren(
      h(
        'div',
        { className: 'ps-ambush', testId: 'ambush', dataset: { inkoustik: problem.ambush } },
        picture(app.art, ART.inkoustik(problem.ambush), {
          alt: inkoustik ? text(inkoustik.nameKey) : problem.ambush,
        }),
        h('p', {
          className: 'ps-ambush__line',
          text: t('ambush.line', { name: inkoustik ? text(inkoustik.nameKey) : problem.ambush }),
        }),
      ),
    );
  };

  const showProblem = (problem: ProblemView): void => {
    shown = problem;
    releaseInput();
    setFeedback('none');
    nextSlot.replaceChildren();
    hintSlot.hidden = true;
    hintSlot.textContent = '';
    note.textContent = problem.teach ? t('round.teach') : problem.reask ? t('round.reask') : '';
    prompt.textContent = t(promptKey(problem.problem, problem.step));
    displaySlot.replaceChildren(problemDisplay(problem, t));
    tools.replaceChildren(
      ...speakerButton(app, active.preferences.current(), () => spokenProblem(problem, t)),
      ...hintButton(problem),
    );
    showAmbush(problem);

    const answer = stepAnswer(problem, text);
    if (answer.kind === 'text' && answer.input === 'typed') {
      keyboard = createCzechKeyboard(app.kit, {
        label: t('round.typedLabel'),
        okLabel: t('round.ok'),
        backspaceLabel: t('keys.backspace'),
        shiftLabel: t('keys.shift'),
        spaceLabel: t('keys.space'),
        onSubmit: (typed) =>
          submit(
            { kind: 'text', value: typed },
            answerSlot.querySelector('[data-testid="typed-ok"]') ?? answerSlot,
          ),
      });
      answerSlot.replaceChildren(keyboard.element);
    } else if (answer.kind === 'text') {
      const values = answer.input === 'letters' ? answer.gap.keys : answer.gap.options;
      tiles = createTiles(app.kit, {
        label: t(answer.input === 'letters' ? 'round.letters' : 'round.choices'),
        choices: values.map((value) => ({ id: value, label: value })),
        typeSelect: true,
        glyphs: answer.input === 'letters' || values.every((value) => [...value].length <= 2),
        testIdPrefix: answer.input === 'letters' ? 'key' : 'choice',
        onChoose: async (choice) => {
          await submit({ kind: 'text', value: choice.id }, tileOf(choice.id));
        },
      });
      answerSlot.replaceChildren(tiles.element);
      answerSlot.dataset['input'] = answer.input;
    } else if (answer.kind === 'option') {
      tiles = createTiles(app.kit, {
        label: t('round.choices'),
        choices: answer.options.map((option) => ({ id: option.id, label: option.label })),
        testIdPrefix: 'option',
        onChoose: async (choice) => {
          await submit({ kind: 'option', value: choice.id }, tileOf(choice.id));
        },
      });
      answerSlot.replaceChildren(tiles.element);
      answerSlot.dataset['input'] = 'choice';
    } else {
      const words = answer.words.map((word, index) => {
        const button = h('button', {
          className: 'ps-word-pick',
          testId: `pick-${index}`,
          text: word,
          attributes: { type: 'button', lang: 'cs' },
        });
        button.addEventListener('click', () => {
          void submit({ kind: 'pick', index }, button).catch(app.kit.onError);
        });
        return button;
      });
      answerSlot.replaceChildren(
        h(
          answer.inSentence ? 'p' : 'div',
          {
            className: answer.inSentence
              ? 'ps-word-picks ps-word-picks--sentence'
              : 'ps-word-picks',
            attributes: {
              role: 'group',
              'aria-label': t(promptKey(problem.problem, problem.step)),
            },
          },
          ...words.flatMap((button, index) =>
            answer.inSentence && index > 0 ? [document.createTextNode(' '), button] : [button],
          ),
        ),
      );
      answerSlot.dataset['input'] = 'pick';
    }
    send = active.commands.captureSend();
    timer.start();
    if (pausedByDialog || document.visibilityState === 'hidden') timer.pause();
  };

  // ---- answers -------------------------------------------------------------------------------------
  /** An answer the game took but could not save yet: its feedback waits for Retry. */
  let held: { asked: ProblemView; source: Element } | null = null;

  const submit = async (value: AnswerValue, source: Element): Promise<void> => {
    if (busy || !shown) return;
    busy = true;
    setInputDisabled(true);
    const asked = shown;
    try {
      // Feedback comes as soon as the answer is saved, or once it is taken if saving is slow.
      await send(
        placement
          ? { type: 'placementAnswer', value, elapsedMs: timer.elapsed() }
          : { type: 'answer', value, elapsedMs: timer.elapsed() },
      );
    } catch (error) {
      busy = false;
      send = active.commands.captureSend();
      setInputDisabled(false);
      if (error instanceof CommandRejectedError && error.accepted) {
        // Taken but not saved: no praise for what is not stored. The save says "Neuloženo"
        // and offers Retry; once it is saved, this answer gets its feedback.
        held = { asked, source };
        return;
      }
      if (error instanceof CommandRejectedError && error.error.code === 'checkpoint-blocked') {
        setFeedback('info', h('span', { text: t('round.saveBlocked') }));
        return;
      }
      throw error;
    }
    await showOutcome(asked, source);
  };

  const showOutcome = async (asked: ProblemView, source: Element): Promise<void> => {
    busy = true;
    setInputDisabled(true);
    const after = active.game.view();
    const round = problemRound(after);
    const result = round?.feedback;
    if (!round || !result || result.index !== asked.index || result.step !== asked.step) {
      busy = false;
      await advance();
      return;
    }
    takeBattleEvents();
    if (result.correct) await onCorrect(asked, result, after, source);
    else onMiss(asked, result, after);
  };

  // Retry stored a held answer: now it gets its feedback.
  const unsubscribeSaved = active.game.subscribeIndicator((indicator) => {
    if (indicator.kind !== 'saved' || !held || disposed) return;
    const { asked, source } = held;
    held = null;
    void showOutcome(asked, source).catch(app.kit.onError);
  });

  /** A snack for the friend, or a bubble at the monster, flying from the answer. */
  const fly = async (
    from: Element,
    to: Element | null,
    kind: 'bubble' | 'snack',
  ): Promise<void> => {
    if (!to) return;
    await flyAlongArc(
      app.kit.fx,
      h('span', { className: `ps-flyer__${kind}` }),
      centerOf(from),
      centerOf(to),
      { duration: 520 },
    );
  };

  const onCorrect = async (
    asked: ProblemView,
    result: Feedback,
    after: GameView,
    source: Element,
  ): Promise<void> => {
    tiles?.setState(answerId(result.given), 'correct');
    markPick(result.given, 'correct');
    setFeedback('correct', icon('check'), h('span', { text: t('praise.right') }));
    displaySlot.replaceChildren(problemDisplay({ ...asked, step: asked.step + 1 }, t));
    const round = problemRound(after)!;
    if (round.battle) {
      app.kit.cue('fx.bubble');
      await fly(source, companion.querySelector('[data-testid="battle-monster"]'), 'bubble');
    } else {
      await fly(source, companion.querySelector('[data-testid="round-friend"]'), 'snack');
    }
    if (result.ambush?.splashed) {
      const inkoustik = ambushSlot.querySelector<HTMLElement>('[data-testid="ambush"]');
      if (inkoustik) inkoustik.dataset['splashed'] = 'true';
      app.kit.announcer.announce(t('ambush.splashed'));
    }
    if (result.coins > 0) await coins.gain(result.coins, source);
    paintCompanion(after);
    updateProgress(round);
    await new Promise((resolve) =>
      setTimeout(resolve, prefersReducedMotion() ? 400 : CORRECT_PAUSE_MS),
    );
    busy = false;
    if (!disposed) await advance();
  };

  const onMiss = (asked: ProblemView, result: Feedback, after: GameView): void => {
    tiles?.setState(answerId(result.given), 'miss');
    markPick(result.given, 'miss');
    // The word spelled right, where the gap was.
    displaySlot.replaceChildren(
      problemDisplay(
        asked,
        t,
        true,
        result.expected.kind === 'text' ? result.expected.value : undefined,
      ),
    );
    const hint = stepHint(asked.problem, asked.step);
    setFeedback(
      'miss',
      h('span', {
        className: 'ps-feedback__badge',
        text: '?',
        attributes: { 'aria-hidden': 'true' },
      }),
      h(
        'span',
        { className: 'ps-feedback__text' },
        h('strong', { text: t('miss.almost') }),
        ' ',
        t('miss.answer', { answer: answerText(asked.problem, result.expected, text) }),
      ),
      hint ? h('span', { className: 'ps-feedback__hint', text: hintText(hint, t, text) }) : null,
    );
    if (result.ambush && !result.ambush.splashed) {
      app.kit.announcer.announce(t('ambush.stayed'));
    }
    const round = problemRound(after);
    if (round) updateProgress(round);
    busy = false;
    const next = candyButton({
      label: t('round.next'),
      icon: 'forward',
      variant: 'sun',
      testId: 'round-next',
      onPress: advance,
      onError: app.kit.onError,
    });
    nextSlot.replaceChildren(next);
    next.focus();
  };

  // ---- moving on -----------------------------------------------------------------------------------
  const answerFocus = (): HTMLElement | null => {
    if (keyboard) return keyboard.field;
    return (
      tiles?.element.querySelector<HTMLElement>('button:not(:disabled)') ??
      answerSlot.querySelector<HTMLElement>('.ps-word-pick:not(:disabled)')
    );
  };

  const endForRest = async (): Promise<void> => {
    clearInterval(restTimer);
    releaseInput();
    if (problemRound(active.game.view())?.status === 'active') {
      await active.commands.capture()({ type: 'endRound', reason: 'time-limit' });
    }
    await app.continueGame(diverId);
  };
  const checkRest = (): void => {
    if (restTime || !active.timeIsUp()) return;
    restTime = true;
    if (!busy) void endForRest().catch(app.kit.onError);
  };
  const restTimer = setInterval(checkRest, REST_CHECK_MS);

  /** Show the next step or problem, or leave for the results when the round is over. */
  const advance = async (): Promise<void> => {
    checkRest();
    if (restTime) {
      await endForRest();
      return;
    }
    const view = active.game.view();
    const round = problemRound(view);
    if (view.screen !== 'round' || !round || round.status !== 'active' || !round.problem) {
      await app.continueGame(diverId);
      return;
    }
    paintCompanion(view);
    updateProgress(round);
    takeBattleEvents();
    showProblem(round.problem);
    if (active.preferences.current().autoRead) app.speak(spokenProblem(round.problem, t));
    answerFocus()?.focus();
  };

  // ---- pause ---------------------------------------------------------------------------------------
  const pause = async (): Promise<void> => {
    if (pausedByDialog) return;
    pausedByDialog = true;
    timer.pause();
    host.pause('user');
    app.audio.pause();
    app.stopSpeaking();
    const choice = await openModal<'resume' | 'quit'>(app.kit, {
      label: t('pause.heading'),
      testId: 'pause-dialog',
      dismissValue: 'resume',
      build(body, close) {
        body.append(
          h('p', { text: t('pause.body') }),
          h(
            'div',
            { className: 'ps-dialog__actions' },
            candyButton({
              label: t('pause.quit'),
              variant: 'paper',
              testId: 'pause-quit',
              onPress: () => close('quit'),
              onError: app.kit.onError,
            }),
            candyButton({
              label: t('pause.resume'),
              icon: 'play',
              variant: 'sun',
              testId: 'pause-resume',
              onPress: () => close('resume'),
              onError: app.kit.onError,
            }),
          ),
        );
      },
    }).result;
    pausedByDialog = false;
    app.audio.resume();
    await active.commands.resume('user');
    if (document.visibilityState !== 'hidden') timer.resume();
    if (choice === 'quit') {
      await active.commands.capture()({ type: 'endRound', reason: 'quit' });
      await app.continueGame(diverId);
    }
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') timer.pause();
    else if (!pausedByDialog) timer.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const releaseEscape = app.kit.keyboard.push((event) => {
    if (event.key !== 'Escape') return 'pass';
    void pause().catch(app.kit.onError);
    return 'handled';
  });

  // ---- first paint ---------------------------------------------------------------------------------
  paintCompanion(active.game.view());
  updateProgress(first);
  takeBattleEvents();
  if (first.problem) showProblem(first.problem);

  const pauseButton = candyButton({
    label: t('round.pause'),
    icon: 'pause',
    iconOnly: true,
    variant: 'paper',
    size: 'small',
    testId: 'round-pause',
    onPress: pause,
    onError: app.kit.onError,
  });

  const element = h(
    'main',
    {
      className: `ps-round${battle ? ' ps-round--battle' : ''}`,
      testId: 'screen-round',
      dataset: { activity, placement: String(placement) },
    },
    h('div', { className: 'ps-backdrop' }, picture(app.art, ART.scene(regionId ?? 'grotto'))),
    topBar({
      title: h('div', { className: 'ps-round__header' }, heading, progress.element),
      tools: [streak, coins.element, saveStatus.element, pauseButton],
      onError: app.kit.onError,
    }),
    h(
      'section',
      { className: 'ps-round__stage' },
      companion,
      h(
        'div',
        { className: 'ps-card ps-round__card', testId: 'problem' },
        ambushSlot,
        note,
        h('div', { className: 'ps-round__ask' }, prompt, tools),
        displaySlot,
        hintSlot,
        feedback,
        answerSlot,
        nextSlot,
      ),
    ),
    blots,
  );
  return {
    element,
    title: activityName(t, activity),
    field: 'sea',
    region: regionId,
    music: battle ? 'battle' : 'practice',
    focusTarget: () => answerFocus() ?? heading,
    mounted: () => {
      if (shown && active.preferences.current().autoRead) app.speak(spokenProblem(shown, t));
    },
    dispose: () => {
      disposed = true;
      clearInterval(restTimer);
      releaseInput();
      releaseEscape();
      unsubscribeSaved();
      document.removeEventListener('visibilitychange', onVisibility);
      saveStatus.dispose();
    },
  };
}

/** The tile ID an answer was given with. */
function answerId(value: AnswerValue): string {
  return value.kind === 'pick' ? `pick-${value.index}` : value.value;
}
