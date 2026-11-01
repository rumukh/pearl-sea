/**
 * Minigame rounds (docs/design.md §5.8-5.12) on the typed board of the rules' `MinigameRoundView`
 * (contract minigames.ts): Pexeso (memory match), Perlový náhrdelník (thread the word pearls in
 * order), Rybářské sítě (sort the fish-words into nets), Ulita slov (cut a word into its parts
 * and name them) and Slovní rodinka (pick the words of one family). Every move goes to the rules
 * as `minigameMove { revision, move }`; the screen redraws from the view. Boards never punish: a
 * wrong pair, a wrong order, a fish in the wrong net, a wrong cut or pick stays on the board,
 * gently marked, and can be corrected.
 *
 * Touch and keyboard both work everywhere: cards, pearls, cuts, names and words are buttons; a
 * pearl picked up is put down by tapping its new place, or moved with the arrow keys; a fish is
 * dragged into a net, or tapped and then its net tapped.
 */
import { taken } from '../controller/commands';
import type { Screen } from '../router/router';
import type { ActiveDiver, App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { createCoinCounter, createMeter } from '../ui/meters';
import { picture } from '../art/picture';
import { ART } from '../../rules/contract';
import type {
  BoardView,
  CardFace,
  ContentData,
  FishingNetsBoard,
  GameView,
  MemoryMatchBoard,
  MinigameMove,
  MinigameRoundView,
  NecklaceBoard,
  SegmentRole,
  WordFamilyBoard,
  WordShellBoard,
} from '../../rules/contract';
import type { ContentText } from '../content/text';
import { diverSaveStatus, topBar } from './common';
import { activityName } from './level';

function minigameRound(view: GameView): MinigameRoundView | null {
  return view.round?.type === 'minigame' ? view.round : null;
}

/** A card face in words: a word or form, a noun pattern, or a category value. */
export function faceText(face: CardFace, text: ContentText): string {
  switch (face.kind) {
    case 'word':
    case 'form':
      return face.text;
    case 'pattern':
      return text(`grammar.pattern.${face.pattern}`);
    case 'category':
      return text(`grammar.${face.dimension}.${face.value}`);
  }
}

export function minigameScreen(app: App, active: ActiveDiver): Screen {
  const t = app.kit.t;
  const text = app.content()!.text;
  const diverId = active.diver.id;
  const data = active.game.content().data as ContentData;
  const first = minigameRound(active.game.view())!;
  const levelId = first.source.kind === 'level' ? first.source.level : null;
  const regionId = levelId
    ? (data.levels.find((candidate) => candidate.id === levelId)?.region ?? null)
    : null;

  const saveStatus = diverSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.view().coins);
  const heading = h('h1', { className: 'ps-round__title', text: activityName(t, first.activity) });
  const progress = createMeter({
    label: t('board.progress'),
    max: Math.max(1, first.boards),
    value: first.board,
    valueText: (value, max) => t('board.progressValue', { value, max }),
    testId: 'board-progress',
  });
  const boardSlot = h('div', {
    className: 'ps-board-slot',
    testId: 'board',
    dataset: { board: String(first.board) },
  });
  const message = h('p', {
    className: 'ps-board__message',
    testId: 'board-message',
    attributes: { 'aria-live': 'polite' },
  });
  const actions = h('div', { className: 'ps-board__actions' });

  let busy = false;
  let disposed = false;
  let lastBoard = first.board;

  /** Send a move made on the board as it is drawn now, then draw what the rules say. */
  const move = async (made: MinigameMove): Promise<void> => {
    if (busy) return;
    const round = minigameRound(active.game.view());
    if (!round || round.status !== 'active') return;
    busy = true;
    try {
      await taken(
        active.commands.captureSend()({
          type: 'minigameMove',
          revision: round.minigame.revision,
          move: made as unknown as MinigameRoundView['minigame']['view'],
        }),
      );
    } finally {
      busy = false;
    }
    if (!disposed) await redraw();
  };

  const redraw = async (): Promise<void> => {
    const view = active.game.view();
    const round = minigameRound(view);
    if (view.screen !== 'round' || !round || round.status !== 'active') {
      if (round && round.coins > 0) coins.set(view.coins);
      await app.continueGame(diverId);
      return;
    }
    coins.set(view.coins);
    progress.update(round.board);
    boardSlot.dataset['board'] = String(round.board);
    if (round.board !== lastBoard) {
      lastBoard = round.board;
      app.kit.cue('fx.board-done');
      message.textContent = t('board.solved');
    }
    draw(round.current);
  };

  // ---- Pexeso -------------------------------------------------------------------------------------
  const memoryBoard = (board: MemoryMatchBoard): HTMLElement => {
    const cards = board.cards.map((card, index) => {
      const face = card.face;
      const label = face ? faceText(face, text) : t('board.card', { number: index + 1 });
      const button = h(
        'button',
        {
          className: 'ps-card-tile',
          testId: `card-${card.id}`,
          dataset: { up: String(card.faceUp), matched: String(card.matched) },
          attributes: {
            type: 'button',
            'aria-label': card.matched ? t('board.matched', { word: label }) : label,
          },
        },
        face && card.faceUp
          ? h('span', { className: 'ps-card-tile__face', text: label, attributes: { lang: 'cs' } })
          : h(
              'span',
              { className: 'ps-card-tile__back', attributes: { 'aria-hidden': 'true' } },
              icon('pearl'),
            ),
      );
      button.disabled = card.matched || card.faceUp || board.clearAvailable;
      button.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void move({ type: 'select', card: card.id }).catch(app.kit.onError);
      });
      return button;
    });
    if (board.clearAvailable) {
      message.textContent = t('board.mismatch');
      actions.replaceChildren(
        candyButton({
          label: t('board.turnBack'),
          icon: 'retry',
          variant: 'sun',
          testId: 'board-clear',
          onPress: () => move({ type: 'clear' }),
          onError: app.kit.onError,
        }),
      );
    } else {
      actions.replaceChildren();
    }
    return h(
      'div',
      {
        className: 'ps-memory',
        dataset: { cards: String(board.cards.length) },
        attributes: {
          role: 'group',
          'aria-label': t('board.memoryLabel', { matched: board.matched, pairs: board.pairs }),
        },
      },
      ...cards,
    );
  };

  // ---- Perlový náhrdelník ---------------------------------------------------------------------------
  let held: string | null = null;
  const necklaceBoard = (board: NecklaceBoard): HTMLElement => {
    const pearls = board.pearls.map((pearl, index) => {
      const button = h(
        'button',
        {
          className: 'ps-pearl-bead',
          testId: `pearl-${pearl.id}`,
          dataset: { held: String(held === pearl.id) },
          attributes: {
            type: 'button',
            lang: 'cs',
            'aria-pressed': String(held === pearl.id),
            'aria-label': t('board.pearl', { word: pearl.text, place: index + 1 }),
          },
        },
        h('span', { className: 'ps-pearl-bead__word', text: pearl.text }),
      );
      button.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        if (held === null) {
          held = pearl.id;
          message.textContent = t('board.pearlHeld', { word: pearl.text });
          draw(board);
          return;
        }
        const item = held;
        held = null;
        if (item === pearl.id) {
          draw(board);
          return;
        }
        void move({ type: 'place', item, index }).catch(app.kit.onError);
      });
      button.addEventListener('keydown', (event) => {
        const by = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (by === 0) return;
        event.preventDefault();
        const target = index + by;
        if (target < 0 || target >= board.pearls.length) return;
        held = null;
        void move({ type: 'place', item: pearl.id, index: target })
          .then(() => {
            boardSlot.querySelector<HTMLElement>(`[data-testid="pearl-${pearl.id}"]`)?.focus();
          })
          .catch(app.kit.onError);
      });
      return h('li', { className: 'ps-necklace__place' }, button);
    });
    if (board.submitted) message.textContent = t('board.notYet');
    actions.replaceChildren(
      candyButton({
        label: t('board.check'),
        icon: 'check',
        variant: 'sun',
        testId: 'board-submit',
        onPress: () => move({ type: 'submit' }),
        onError: app.kit.onError,
      }),
    );
    return h(
      'div',
      { className: 'ps-necklace' },
      h('p', {
        className: 'ps-board__task',
        text: t(board.letter ? 'board.necklaceRhyme' : 'board.necklaceAbc', {
          letter: board.letter ?? '',
        }),
      }),
      h(
        'ol',
        { className: 'ps-necklace__string', attributes: { 'aria-label': t('board.necklace') } },
        ...pearls,
      ),
    );
  };

  // ---- Rybářské sítě -------------------------------------------------------------------------------
  let chosenFish: string | null = null;
  const netsBoard = (board: FishingNetsBoard): HTMLElement => {
    const netName = (value: string): string => text(`grammar.${board.dimension}.${value}`);
    const fishButton = (fish: FishingNetsBoard['fish'][number]): HTMLElement => {
      const button = h(
        'button',
        {
          className: 'ps-fish',
          testId: `fish-${fish.id}`,
          dataset: { wrong: String(fish.wrong), chosen: String(chosenFish === fish.id) },
          attributes: {
            type: 'button',
            lang: 'cs',
            'aria-pressed': String(chosenFish === fish.id),
            'aria-label':
              fish.net === null
                ? t('board.fishFree', { word: fish.text })
                : t('board.fishIn', { word: fish.text, net: netName(board.nets[fish.net]!.value) }),
          },
        },
        h('span', { className: 'ps-fish__word', text: fish.text }),
        fish.wrong
          ? h('span', {
              className: 'ps-fish__wrong',
              text: '?',
              attributes: { 'aria-hidden': 'true' },
            })
          : null,
      );
      button.addEventListener('click', () => {
        if (dragged) return;
        app.kit.cue('ui.tap');
        if (fish.net !== null) {
          // A fish in a net swims back out, to be placed again.
          chosenFish = null;
          void move({ type: 'net', fish: fish.id, net: null }).catch(app.kit.onError);
          return;
        }
        chosenFish = chosenFish === fish.id ? null : fish.id;
        message.textContent = chosenFish ? t('board.fishChosen', { word: fish.text }) : '';
        draw(board);
      });
      startDrag(button, fish.id);
      return button;
    };
    const nets = board.nets.map((net, index) => {
      const button = h(
        'button',
        {
          className: 'ps-net',
          testId: `net-${index}`,
          dataset: { net: String(index) },
          attributes: { type: 'button' },
        },
        h('span', { className: 'ps-net__name', text: netName(net.value) }),
      );
      button.addEventListener('click', () => {
        if (!chosenFish) {
          message.textContent = t('board.chooseFish');
          return;
        }
        const fish = chosenFish;
        chosenFish = null;
        message.textContent = '';
        void move({ type: 'net', fish, net: index }).catch(app.kit.onError);
      });
      const caught = board.fish.filter((fish) => fish.net === index).map(fishButton);
      return h(
        'div',
        { className: 'ps-net-area', dataset: { net: String(index) } },
        button,
        h('div', { className: 'ps-net__catch' }, ...caught),
      );
    });
    if (board.submitted && board.fish.some((fish) => fish.wrong))
      message.textContent = t('board.netsWrong');
    actions.replaceChildren(
      candyButton({
        label: t('board.haul'),
        icon: 'check',
        variant: 'sun',
        testId: 'board-submit',
        onPress: () => move({ type: 'submit' }),
        onError: app.kit.onError,
      }),
    );
    return h(
      'div',
      { className: 'ps-nets', dataset: { nets: String(board.nets.length) } },
      h('p', { className: 'ps-board__task', text: t('board.netsTask') }),
      h(
        'div',
        {
          className: 'ps-nets__pool',
          testId: 'fish-pool',
          attributes: { role: 'group', 'aria-label': t('board.pool') },
        },
        ...board.fish.filter((fish) => fish.net === null).map(fishButton),
      ),
      h('div', { className: 'ps-nets__nets' }, ...nets),
    );
  };

  /** Drag a fish onto a net with a finger or the mouse; a short press stays a tap. */
  let dragged = false;
  const startDrag = (button: HTMLElement, fish: string): void => {
    button.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      dragged = false;
      const startX = down.clientX;
      const startY = down.clientY;
      const onMove = (event: PointerEvent): void => {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) < 12) return;
        dragged = true;
        button.dataset['dragging'] = 'true';
        button.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const onUp = (event: PointerEvent): void => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (!dragged) return;
        button.style.removeProperty('transform');
        delete button.dataset['dragging'];
        button.style.visibility = 'hidden';
        const under = document.elementFromPoint(event.clientX, event.clientY);
        button.style.removeProperty('visibility');
        const area = under?.closest<HTMLElement>('[data-net]');
        const net = area ? Number(area.dataset['net']) : null;
        chosenFish = null;
        if (net !== null && Number.isInteger(net)) {
          message.textContent = '';
          void move({ type: 'net', fish, net }).catch(app.kit.onError);
        }
        // The click that follows a drag is not a tap.
        setTimeout(() => {
          dragged = false;
        }, 0);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  };

  // ---- Ulita slov ------------------------------------------------------------------------------------
  /**
   * The word with a cut between every two letters (a toggle), the parts the cuts make, each named
   * with one of the board's asked roles (tap the name again to take it off), and the empty
   * "∅ koncovka" shell when endings are asked.
   */
  const shellBoard = (board: WordShellBoard): HTMLElement => {
    const roleName = (role: SegmentRole): string => text(`grammar.segment.${role}`);
    const word = h('div', {
      className: 'ps-shell-word',
      testId: 'shell-word',
      dataset: { letters: String(board.letters.length) },
      attributes: { role: 'group', 'aria-label': t('board.shellWord', { word: board.text }) },
    });
    board.letters.forEach((letter, index) => {
      if (index > 0) {
        const at = index;
        const cut = board.cuts.includes(at);
        const button = h('button', {
          className: 'ps-shell-word__cut',
          testId: `cut-${at}`,
          dataset: { cut: String(cut) },
          attributes: {
            type: 'button',
            'aria-pressed': String(cut),
            'aria-label': t('board.shellCut', { before: board.letters[at - 1]!, after: letter }),
          },
        });
        button.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          void move({ type: cut ? 'uncut' : 'cut', at }).catch(app.kit.onError);
        });
        word.append(button);
      }
      word.append(
        h('span', {
          className: 'ps-shell-word__letter',
          text: letter,
          attributes: { 'aria-hidden': 'true' },
        }),
      );
    });
    if (board.roles.includes('ending')) {
      const zero = h(
        'button',
        {
          className: 'ps-shell-word__zero',
          testId: 'zero-ending',
          attributes: { type: 'button', 'aria-pressed': String(board.zeroEnding) },
        },
        h('span', {
          className: 'ps-shell-word__zero-mark',
          text: '∅',
          attributes: { 'aria-hidden': 'true' },
        }),
        h('span', { text: t('board.shellZero') }),
      );
      zero.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void move({ type: 'zero-ending', on: !board.zeroEnding }).catch(app.kit.onError);
      });
      word.append(zero);
    }
    const parts = h(
      'ol',
      { className: 'ps-shell-parts', testId: 'shell-parts' },
      ...board.parts.map((part, index) =>
        h(
          'li',
          {
            className: 'ps-shell-part',
            testId: `part-${index}`,
            dataset: { role: part.role ?? 'none' },
          },
          h('span', {
            className: 'ps-shell-part__text',
            text: part.text,
            attributes: { lang: 'cs' },
          }),
          h(
            'span',
            {
              className: 'ps-shell-part__roles',
              attributes: {
                role: 'group',
                'aria-label': t('board.shellPart', { part: part.text }),
              },
            },
            ...board.roles.map((role) => {
              const named = part.role === role;
              const button = h('button', {
                className: 'ps-shell-role',
                testId: `role-${index}-${role}`,
                text: roleName(role),
                attributes: { type: 'button', 'aria-pressed': String(named) },
              });
              button.addEventListener('click', () => {
                app.kit.cue('ui.tap');
                void move({ type: 'label', part: index, role: named ? null : role }).catch(
                  app.kit.onError,
                );
              });
              return button;
            }),
          ),
        ),
      ),
    );
    if (board.submitted) message.textContent = t('board.shellNotYet');
    actions.replaceChildren(
      candyButton({
        label: t('board.check'),
        icon: 'check',
        variant: 'sun',
        testId: 'board-submit',
        onPress: () => move({ type: 'submit' }),
        onError: app.kit.onError,
      }),
    );
    return h(
      'div',
      { className: 'ps-shell-board' },
      h('p', {
        className: 'ps-board__task',
        text: t('board.shellTask', { roles: board.roles.map(roleName).join(', ') }),
      }),
      word,
      parts,
    );
  };

  // ---- Slovní rodinka ----------------------------------------------------------------------------------
  /** Pick every word of the head word's family; a pick toggles, the check says when it is right. */
  const familyBoard = (board: WordFamilyBoard): HTMLElement => {
    const picked = board.words.filter((word) => word.picked).length;
    const words = board.words.map((word) => {
      const button = h('button', {
        className: 'ps-family-word',
        testId: `family-${word.id}`,
        text: word.text,
        attributes: { type: 'button', lang: 'cs', 'aria-pressed': String(word.picked) },
      });
      button.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void move({ type: 'pick', word: word.id }).catch(app.kit.onError);
      });
      return button;
    });
    if (board.submitted) message.textContent = t('board.familyNotYet');
    actions.replaceChildren(
      candyButton({
        label: t('board.check'),
        icon: 'check',
        variant: 'sun',
        testId: 'board-submit',
        onPress: () => move({ type: 'submit' }),
        onError: app.kit.onError,
      }),
    );
    return h(
      'div',
      { className: 'ps-family' },
      h('p', {
        className: 'ps-family__head',
        testId: 'family-head',
        text: board.head.text,
        attributes: { lang: 'cs' },
      }),
      h('p', {
        className: 'ps-board__task',
        text: t('board.familyTask', { word: board.head.text }),
      }),
      h('p', {
        className: 'ps-family__count',
        testId: 'family-count',
        text: t('board.familyCount', { picked, needed: board.needed }),
      }),
      h(
        'div',
        {
          className: 'ps-family__words',
          attributes: { role: 'group', 'aria-label': t('board.familyWords') },
        },
        ...words,
      ),
    );
  };

  const draw = (board: BoardView): void => {
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset['testid'];
    let content: HTMLElement;
    switch (board.kind) {
      case 'memory-match':
        content = memoryBoard(board);
        break;
      case 'pearl-necklace':
        content = necklaceBoard(board);
        break;
      case 'fishing-nets':
        content = netsBoard(board);
        break;
      case 'word-shell':
        content = shellBoard(board);
        break;
      case 'word-family':
        content = familyBoard(board);
        break;
      default:
        content = h('p', { className: 'ps-note', text: t('board.unknown') });
        actions.replaceChildren(
          candyButton({
            label: t('board.leave'),
            variant: 'paper',
            testId: 'board-leave',
            onPress: async () => {
              await taken(active.commands.capture()({ type: 'endRound', reason: 'quit' }));
              await app.continueGame(diverId);
            },
            onError: app.kit.onError,
          }),
        );
    }
    boardSlot.replaceChildren(content);
    boardSlot.dataset['kind'] = board.kind;
    if (focusedId) boardSlot.querySelector<HTMLElement>(`[data-testid="${focusedId}"]`)?.focus();
  };

  const quit = candyButton({
    label: t('board.quit'),
    icon: 'close',
    iconOnly: true,
    variant: 'paper',
    size: 'small',
    testId: 'board-quit',
    onPress: async () => {
      await taken(active.commands.capture()({ type: 'endRound', reason: 'quit' }));
      await app.continueGame(diverId);
    },
    onError: app.kit.onError,
  });

  draw(first.current);
  const element = h(
    'main',
    { className: 'ps-board', testId: 'screen-board', dataset: { activity: first.activity, round: first.id } },
    h('div', { className: 'ps-backdrop' }, picture(app.art, ART.scene(regionId ?? 'grotto'))),
    topBar({
      title: h('div', { className: 'ps-round__header' }, heading, progress.element),
      tools: [coins.element, saveStatus.element, quit],
      onError: app.kit.onError,
    }),
    h('section', { className: 'ps-card ps-board__card' }, message, boardSlot, actions),
  );
  return {
    element,
    title: activityName(t, first.activity),
    field: 'sea',
    region: regionId,
    music: 'practice',
    focusTarget: () => boardSlot.querySelector<HTMLElement>('button:not(:disabled)') ?? heading,
    dispose: () => {
      disposed = true;
      saveStatus.dispose();
    },
  };
}
