/**
 * Rybářské sítě (`ps.sorting-nets`, design §5.10, contract §12.1) played in isolation: what the
 * board accepts as a config, a saved progress and a move; hauling in (fish in their right net are
 * caught and stay locked, fish in a wrong net swim back out marked `wrong`, the board stays open;
 * a haul with no fish to check is not counted, so the first real haul still credits fast);
 * completion exactly when every fish is caught; restore round trips and determinism. The board is
 * written by hand: six consonant letters for the hard, soft and both-way nets.
 */
import { describe, expect, it } from 'vitest';
import {
  ToolkitError,
  createMinigame,
  projectMinigame,
  reduceMinigame,
  restoreMinigame,
} from '@aegis/narrative';
import type { Json, MinigameDefinition, MinigameState } from '@aegis/narrative';
import type { FishingNetsBoard, FishingNetsMove } from '../../../src/rules/contract';
import { MINIGAMES, boardCredits } from '../../../src/rules/minigames/boards';
import { SORTING_NETS_KIND, sortingNetsAdapter } from '../../../src/rules/minigames/sorting-nets';
import type {
  SortingNetsConfig,
  SortingNetsState,
} from '../../../src/rules/minigames/sorting-nets';

const PS_BOARD = 'AEG-NARRATIVE-PS-BOARD';

/** h, ch hard; č, j soft; l, v both-way (`net` is the index of the right net). */
const CONFIG: SortingNetsConfig = {
  dimension: 'consonant',
  values: ['hard', 'soft', 'both-way'],
  fish: [
    { id: 'f1', item: 'class:consonant:h', word: null, text: 'h', net: 0 },
    { id: 'f2', item: 'class:consonant:ch', word: null, text: 'ch', net: 0 },
    { id: 'f3', item: 'class:consonant:cx', word: null, text: 'č', net: 1 },
    { id: 'f4', item: 'class:consonant:j', word: null, text: 'j', net: 1 },
    { id: 'f5', item: 'class:consonant:l', word: null, text: 'l', net: 2 },
    { id: 'f6', item: 'class:consonant:v', word: null, text: 'v', net: 2 },
  ],
};

function definition(config: unknown): MinigameDefinition {
  return {
    schema: 1,
    id: 'nets',
    revision: '1',
    kind: SORTING_NETS_KIND,
    adapterSchema: 1,
    config: config as Json,
    outputs: [],
  };
}

const DEF = definition(CONFIG);

function move(state: MinigameState, value: unknown): MinigameState {
  return reduceMinigame(
    DEF,
    state,
    { type: 'move', revision: state.revision, value: value as Json },
    MINIGAMES,
  );
}

/** Every state of a game: the new board, then one per move. */
function play(moves: readonly FishingNetsMove[]): MinigameState[] {
  const states = [createMinigame(DEF, 'nets-1', MINIGAMES)];
  for (const value of moves) states.push(move(states[states.length - 1]!, value));
  return states;
}

const last = (moves: readonly FishingNetsMove[]) => play(moves).at(-1)!;
const view = (state: MinigameState) =>
  projectMinigame(DEF, state, MINIGAMES).view as unknown as Omit<FishingNetsBoard, 'kind'>;
const progress = (state: MinigameState) => state.progress as unknown as SortingNetsState;

const put = (fish: string, net: number | null): FishingNetsMove => ({ type: 'net', fish, net });
const HAUL: FishingNetsMove = { type: 'submit' };
/** Every fish in its right net. */
const RIGHT = CONFIG.fish.map((fish) => put(fish.id, fish.net));

/** How the board refused `run`: the narrative error code, the path and the message. */
function rejection(run: () => unknown): { code: string; path: string; message: string } {
  try {
    run();
  } catch (error) {
    if (!(error instanceof ToolkitError)) throw error;
    return { code: error.code, path: error.path, message: error.diagnostics[0]?.message ?? '' };
  }
  return expect.unreachable('the board accepted it');
}

describe('Rybářské sítě (ps.sorting-nets)', () => {
  it('starts with every fish swimming free, one net per value, and no right net shown', () => {
    expect(view(last([]))).toEqual({
      dimension: 'consonant',
      nets: [{ value: 'hard' }, { value: 'soft' }, { value: 'both-way' }],
      fish: CONFIG.fish.map((fish) => ({
        id: fish.id,
        word: null,
        text: fish.text,
        net: null,
        wrong: false,
      })),
      submitted: false,
      attempts: 0,
    });
  });

  it('puts a fish into a net, moves it to another net and takes it out again', () => {
    const states = play([put('f3', 0), put('f3', 1), put('f3', null)]);
    expect(states.map((state) => view(state).fish[2]!.net)).toEqual([null, 0, 1, null]);
    expect(states.every((state) => state.status === 'active' && !view(state).submitted)).toBe(true);
  });

  it('hauls in: fish in their right net are caught, fish in a wrong net swim back marked wrong', () => {
    // h right, č in the hard net (wrong), l right; the other three still swim free.
    const state = last([put('f1', 0), put('f3', 0), put('f5', 2), HAUL]);
    expect(state.status).toBe('active');
    expect(view(state).fish.map(({ net, wrong }) => ({ net, wrong }))).toEqual([
      { net: 0, wrong: false },
      { net: null, wrong: false },
      { net: null, wrong: true },
      { net: null, wrong: false },
      { net: 2, wrong: false },
      { net: null, wrong: false },
    ]);
    expect(progress(state).caught).toEqual([1, 0, 0, 0, 1, 0]);
    expect(view(state)).toMatchObject({ submitted: true, attempts: 1 });
  });

  it('keeps caught fish locked in their nets', () => {
    const hauled = last([put('f1', 0), HAUL]);
    for (const to of [1, 2, 0, null]) {
      expect(rejection(() => move(hauled, put('f1', to)))).toEqual({
        code: PS_BOARD,
        path: '$.move.fish',
        message: 'This fish is already caught.',
      });
    }
  });

  it('never punishes: after a wrong haul every fish not caught can be placed and hauled again', () => {
    const wrongHaul = last([put('f1', 1), put('f2', 2), put('f3', 0), HAUL]);
    expect(wrongHaul.status).toBe('active');
    expect(
      view(wrongHaul)
        .fish.filter((fish) => fish.wrong)
        .map((fish) => fish.id),
    ).toEqual(['f1', 'f2', 'f3']);
    // Placing a fish that swam back clears its mark and the check; the others keep theirs.
    const replaced = move(wrongHaul, put('f1', 0));
    expect(view(replaced).fish[0]).toMatchObject({ net: 0, wrong: false });
    expect(view(replaced).fish[1]).toMatchObject({ net: null, wrong: true });
    expect(view(replaced).submitted).toBe(false);
    let state = replaced;
    for (const value of [...RIGHT.slice(1), HAUL]) state = move(state, value);
    expect(state.status).toBe('completed');
    expect(view(state).attempts).toBe(2);
  });

  it('completes exactly when every fish is caught, by one haul or by several', () => {
    expect(last(RIGHT).status).toBe('active');
    const once = last([...RIGHT, HAUL]);
    expect(once.status).toBe('completed');
    expect(progress(once).caught).toEqual([1, 1, 1, 1, 1, 1]);

    expect(last([...RIGHT.slice(0, 5), HAUL]).status).toBe('active');
    expect(last([...RIGHT.slice(0, 5), put('f6', 0), HAUL]).status).toBe('active');

    const twice = last([...RIGHT.slice(0, 5), HAUL, put('f6', 2), HAUL]);
    expect(twice.status).toBe('completed');
    expect(progress(twice).caught).toEqual([1, 1, 1, 1, 1, 2]);
    expect(view(twice)).toMatchObject({ submitted: true, attempts: 2 });
  });

  it('does not count a haul with no fish to check: the attempts stay, the board is unchanged', () => {
    // A new board, or one whose placed fish were all taken out again.
    for (const moves of [[HAUL], [put('f1', 0), put('f1', null), HAUL]]) {
      const states = play(moves);
      const [before, after] = states.slice(-2) as [MinigameState, MinigameState];
      expect(after.status).toBe('active');
      expect(progress(after)).toEqual({ ...progress(before), submitted: true });
      expect(view(after)).toMatchObject({ submitted: true, attempts: 0 });
    }
    // After a haul only caught fish sit in the nets; hauling again before placing a fish checks
    // nothing: h stays caught, č still swims free marked wrong.
    const hauled = last([put('f1', 0), put('f3', 0), HAUL]);
    const again = move(hauled, HAUL);
    expect(progress(again)).toEqual(progress(hauled));
    expect(view(again).fish[2]).toMatchObject({ net: null, wrong: true });
    // The next real haul is the second.
    const next = last([put('f1', 0), put('f3', 0), HAUL, HAUL, put('f3', 1), HAUL]);
    expect(progress(next).caught).toEqual([1, 0, 2, 0, 0, 0]);
    expect(view(next).attempts).toBe(2);
  });

  it('credits the first real haul after an empty one as the first haul (boardCredits)', () => {
    const pool = new Set(CONFIG.fish.map((fish) => fish.item));
    const credit = (states: MinigameState[], at: number) =>
      boardCredits(DEF, states[at - 1]!, states[at]!, pool);
    // An empty haul earns nothing; the clean first real haul credits every fish fast.
    const clean = play([HAUL, ...RIGHT, HAUL]);
    expect(credit(clean, 1)).toEqual({ items: [], coins: 0 });
    expect(clean.at(-1)!.status).toBe('completed');
    expect(credit(clean, clean.length - 1)).toEqual({
      items: CONFIG.fish.map((fish) => ({ item: fish.item, bucket: 'fast' })),
      coins: 6,
    });
    // With v in a wrong net, the first real haul credits the right fish ok; an empty haul between
    // real ones earns nothing, and v caught by the second real haul is slow.
    const mixed = play([HAUL, ...RIGHT.slice(0, 5), put('f6', 0), HAUL, HAUL, put('f6', 2), HAUL]);
    expect(credit(mixed, 8)).toEqual({
      items: CONFIG.fish.slice(0, 5).map((fish) => ({ item: fish.item, bucket: 'ok' })),
      coins: 5,
    });
    expect(credit(mixed, 9)).toEqual({ items: [], coins: 0 });
    expect(credit(mixed, 11)).toEqual({
      items: [{ item: 'class:consonant:v', bucket: 'slow' }],
      coins: 1,
    });
    expect(mixed.at(-1)!.status).toBe('completed');
  });

  it('refuses every move once the board is complete', () => {
    const done = last([...RIGHT, HAUL]);
    for (const value of [put('f1', 0), put('f2', null), HAUL]) {
      expect(rejection(() => move(done, value))).toMatchObject({
        code: 'AEG-NARRATIVE-MINI-CLOSED',
        path: '$.status',
      });
    }
  });

  it('decodes moves strictly and leaves the board as it was', () => {
    const state = last([put('f1', 0)]);
    const before = structuredClone(state);
    const refused: [unknown, string][] = [
      [{ type: 'swim' }, '$.move.type'],
      [{ type: 'net', fish: 'f7', net: 0 }, '$.move.fish'],
      [{ type: 'net', fish: 'h', net: 0 }, '$.move.fish'],
      [{ type: 'net', fish: 1, net: 0 }, '$.move.fish'],
      [{ type: 'net', fish: 'f1', net: 3 }, '$.move.net'],
      [{ type: 'net', fish: 'f1', net: -1 }, '$.move.net'],
      [{ type: 'net', fish: 'f1', net: 0.5 }, '$.move.net'],
      [{ type: 'net', fish: 'f1', net: 'hard' }, '$.move.net'],
      [{ type: 'net', fish: 'f1' }, '$.move.net'],
      [{ type: 'net', fish: 'f1', net: 0, wrong: true }, '$.move.wrong'],
      [{ type: 'submit', fish: 'f1' }, '$.move.fish'],
      ['submit', '$.move'],
      [null, '$.move'],
      [[put('f1', 0)], '$.move'],
    ];
    for (const [value, path] of refused) {
      expect(
        rejection(() => move(state, value)),
        JSON.stringify(value),
      ).toMatchObject({
        code: PS_BOARD,
        path,
      });
    }
    expect(state).toEqual(before);
  });

  it('rejects malformed configs', () => {
    const [first, second] = CONFIG.fish as [
      SortingNetsConfig['fish'][number],
      SortingNetsConfig['fish'][number],
    ];
    const { item: _item, ...noItem } = first;
    const bad: [unknown, string][] = [
      [{ ...CONFIG, dimension: 'colour' }, '$.config.dimension'],
      [{ ...CONFIG, values: ['hard'] }, '$.config.values'],
      [{ ...CONFIG, values: ['hard', 'soft', 'both-way', 'a', 'b'] }, '$.config.values'],
      [{ ...CONFIG, values: ['hard', 'hard', 'soft'] }, '$.config.values'],
      [{ ...CONFIG, values: ['hard', ''] }, '$.config.values[1]'],
      [{ ...CONFIG, fish: [first] }, '$.config.fish'],
      [
        { ...CONFIG, fish: Array.from({ length: 13 }, (_, i) => ({ ...first, id: `f${i}` })) },
        '$.config.fish',
      ],
      [{ ...CONFIG, fish: [{ ...first, id: 'F 1' }, second] }, '$.config.fish[0].id'],
      [{ ...CONFIG, fish: [{ ...first, id: 'f1234567890123456' }, second] }, '$.config.fish[0].id'],
      [{ ...CONFIG, fish: [first, { ...second, id: 'f1' }] }, '$.config.fish'],
      [{ ...CONFIG, fish: [{ ...first, net: 3 }, second] }, '$.config.fish[0].net'],
      [{ ...CONFIG, fish: [{ ...first, net: null }, second] }, '$.config.fish[0].net'],
      [{ ...CONFIG, fish: [{ ...first, text: '' }, second] }, '$.config.fish[0].text'],
      [{ ...CONFIG, fish: [noItem, second] }, '$.config.fish[0].item'],
      [{ ...CONFIG, fish: [{ ...first, word: 7 }, second] }, '$.config.fish[0].word'],
      [{ ...CONFIG, fish: [{ ...first, hint: 'tvrdá' }, second] }, '$.config.fish[0].hint'],
      [{ ...CONFIG, answers: [0, 0] }, '$.config.answers'],
    ];
    for (const [config, path] of bad) {
      expect(
        rejection(() => createMinigame(definition(config), 'x', MINIGAMES)),
        path,
      ).toMatchObject({ code: PS_BOARD, path });
    }
    // Fish may carry words (or forms) of the lexicon: a gender board.
    const gender = sortingNetsAdapter.config({
      dimension: 'gender',
      values: ['m', 'f', 'n'],
      fish: [
        { id: 'f1', item: 'class:gender:ryba', word: 'ryba', text: 'ryba', net: 1 },
        { id: 'f2', item: 'class:gender:hrad', word: 'hrad', text: 'hrad', net: 0 },
        { id: 'f3', item: 'class:gender:mexsto', word: 'mexsto', text: 'město', net: 2 },
        { id: 'f4', item: 'class:gender:zub', word: 'zub', text: 'zub', net: 0 },
      ],
    });
    expect(gender.fish.map((fish) => [fish.word, gender.values[fish.net]])).toEqual([
      ['ryba', 'f'],
      ['hrad', 'm'],
      ['mexsto', 'n'],
      ['zub', 'm'],
    ]);
  });

  it('refuses to restore a progress that breaks the rules of the board', () => {
    const state = last([put('f1', 0), put('f3', 0), HAUL]);
    const saved = progress(state);
    const forge = (changes: Record<string, unknown>) => () =>
      restoreMinigame(DEF, { ...state, progress: { ...saved, ...changes } }, MINIGAMES);
    const bad: [() => unknown, string][] = [
      // A caught fish taken out of its right net.
      [forge({ nets: [1, null, null, null, null, null] }), '$.progress.caught[0]'],
      // A fish marked wrong that still sits in a net.
      [forge({ nets: [0, null, 0, null, null, null] }), '$.progress.wrong[2]'],
      // Caught by a haul that has not happened.
      [forge({ caught: [2, 0, 0, 0, 0, 0] }), '$.progress.caught[0]'],
      [forge({ nets: [0, null, null] }), '$.progress.nets'],
      [forge({ nets: [0, null, null, null, null, 3] }), '$.progress.nets[5]'],
      [forge({ wrong: [false, false, 'yes', false, false, false] }), '$.progress.wrong[2]'],
      [forge({ attempts: -1 }), '$.progress.attempts'],
      [forge({ submitted: 1 }), '$.progress.submitted'],
      [forge({ score: 3 }), '$.progress.score'],
    ];
    for (const [restore, path] of bad) {
      expect(rejection(restore), path).toMatchObject({ code: PS_BOARD, path });
    }
  });

  it('round-trips a half-played board through JSON and restore', () => {
    const state = last([put('f1', 0), put('f3', 0), HAUL, put('f4', 1)]);
    expect(restoreMinigame(DEF, JSON.parse(JSON.stringify(state)), MINIGAMES)).toEqual(state);
  });

  it('is deterministic: the same moves give the same states and never change earlier ones', () => {
    const moves = [
      put('f2', 1),
      put('f5', 2),
      HAUL,
      put('f2', 0),
      put('f1', 0),
      put('f3', 1),
      put('f4', 1),
      put('f6', 2),
      HAUL,
    ];
    const states = play(moves);
    const snapshots = states.map((state) => JSON.stringify(state));
    expect(play(moves)).toEqual(states);
    expect(states.map((state) => JSON.stringify(state))).toEqual(snapshots);
    expect(states.at(-1)!.status).toBe('completed');
    expect(progress(states.at(-1)!).caught).toEqual([2, 2, 2, 2, 1, 2]);
  });
});
