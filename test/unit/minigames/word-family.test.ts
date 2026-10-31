/**
 * Slovní rodinka (`ps.word-family`, design §5.12, contract §12.1) played in isolation: picking and
 * unpicking words, checking; a wrong check (a word missing, a neighbour picked) stays editable;
 * completion exactly when the family's words and only they are picked and checked; strict configs,
 * progress and moves; restore round trips and determinism. The boards are written by hand: voda
 * (vodník, vodní, podvodní among lesník, mořský) and the listed být (among sound-alike bít, bitva).
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
import type { WordFamilyBoard, WordFamilyMove } from '../../../src/rules/contract';
import { MINIGAMES } from '../../../src/rules/minigames/boards';
import { WORD_FAMILY_KIND, wordFamilyAdapter } from '../../../src/rules/minigames/word-family';
import type { WordFamilyConfig, WordFamilyState } from '../../../src/rules/minigames/word-family';

const PS_BOARD = 'AEG-NARRATIVE-PS-BOARD';

/** Hvězdice holds voda; w1, w3 and w4 are the family's words. */
const VODA: WordFamilyConfig = {
  family: 'voda',
  head: { word: 'voda', text: 'voda' },
  letter: null,
  words: [
    { id: 'w1', word: 'vodniik', text: 'vodník', member: true },
    { id: 'w2', word: 'lesniik', text: 'lesník', member: false },
    { id: 'w3', word: 'vodnii', text: 'vodní', member: true },
    { id: 'w4', word: 'podvodnii', text: 'podvodní', member: true },
    { id: 'w5', word: 'morxskyy', text: 'mořský', member: false },
  ],
};
const MEMBERS = ['w1', 'w3', 'w4'];

function definition(config: unknown): MinigameDefinition {
  return {
    schema: 1,
    id: 'family',
    revision: '1',
    kind: WORD_FAMILY_KIND,
    adapterSchema: 1,
    config: config as Json,
    outputs: [],
  };
}

const DEF = definition(VODA);

function move(state: MinigameState, value: unknown, def = DEF): MinigameState {
  return reduceMinigame(
    def,
    state,
    { type: 'move', revision: state.revision, value: value as Json },
    MINIGAMES,
  );
}

/** Every state of a game: the new board, then one per move. */
function play(moves: readonly WordFamilyMove[], def = DEF): MinigameState[] {
  const states = [createMinigame(def, 'family-1', MINIGAMES)];
  for (const value of moves) states.push(move(states[states.length - 1]!, value, def));
  return states;
}

const last = (moves: readonly WordFamilyMove[], def = DEF) => play(moves, def).at(-1)!;
const view = (state: MinigameState, def = DEF) =>
  projectMinigame(def, state, MINIGAMES).view as unknown as Omit<WordFamilyBoard, 'kind'>;
const picked = (state: MinigameState) =>
  view(state)
    .words.filter((word) => word.picked)
    .map((word) => word.id);

const pick = (word: string): WordFamilyMove => ({ type: 'pick', word });
const CHECK: WordFamilyMove = { type: 'submit' };
const RIGHT = MEMBERS.map(pick);

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

describe('Slovní rodinka (ps.word-family)', () => {
  it('shows the head word, every word unpicked and how many family words to find', () => {
    expect(view(last([]))).toEqual({
      family: 'voda',
      head: { word: 'voda', text: 'voda' },
      letter: null,
      words: VODA.words.map(({ id, word, text }) => ({ id, word, text, picked: false })),
      needed: 3,
      submitted: false,
      attempts: 0,
    });
  });

  it('shows the letter of a listed family', () => {
    const listed = definition({
      family: 'byyt',
      head: { word: 'byyt', text: 'být' },
      letter: 'b',
      words: [
        { id: 'w1', word: 'biit', text: 'bít', member: false },
        { id: 'w2', word: 'bytost', text: 'bytost', member: true },
        { id: 'w3', word: 'bitva', text: 'bitva', member: false },
        { id: 'w4', word: 'byyvalyy', text: 'bývalý', member: true },
      ],
    });
    const board = view(createMinigame(listed, 'listed', MINIGAMES), listed);
    expect(board).toMatchObject({ family: 'byyt', letter: 'b', needed: 2 });
  });

  it('a pick toggles a word', () => {
    const states = play([pick('w2'), pick('w4'), pick('w2')]);
    expect(states.map(picked)).toEqual([[], ['w2'], ['w2', 'w4'], ['w4']]);
    expect(states.every((state) => state.status === 'active')).toBe(true);
  });

  it('a wrong check stays editable: a missing word or a neighbour picked', () => {
    const missing = last([pick('w1'), pick('w3'), CHECK]);
    expect(missing.status).toBe('active');
    expect(view(missing)).toMatchObject({ submitted: true, attempts: 1 });

    const tooMany = last([...RIGHT, pick('w5'), CHECK]);
    expect(tooMany.status).toBe('active');
    const everything = last([...VODA.words.map((word) => pick(word.id)), CHECK]);
    expect(everything.status).toBe('active');

    // Taking the neighbour back clears the check; checking again completes.
    const corrected = move(tooMany, pick('w5'));
    expect(view(corrected)).toMatchObject({ submitted: false, attempts: 1 });
    const done = move(corrected, CHECK);
    expect(done.status).toBe('completed');
    expect(view(done).attempts).toBe(2);
  });

  it('completes exactly when the family words, and only they, are picked and checked', () => {
    expect(last(RIGHT).status).toBe('active');
    const done = last([...RIGHT, CHECK]);
    expect(done.status).toBe('completed');
    expect(picked(done)).toEqual(MEMBERS);
    expect(view(done)).toMatchObject({ submitted: true, attempts: 1 });
    // Picks in any order, with a change of mind on the way.
    expect(last([pick('w4'), pick('w2'), pick('w1'), pick('w2'), pick('w3'), CHECK]).status).toBe(
      'completed',
    );
  });

  it('refuses every move once the board is complete', () => {
    const done = last([...RIGHT, CHECK]);
    for (const value of [pick('w1'), pick('w2'), CHECK]) {
      expect(rejection(() => move(done, value))).toMatchObject({
        code: 'AEG-NARRATIVE-MINI-CLOSED',
        path: '$.status',
      });
    }
  });

  it('decodes moves strictly and leaves the board as it was', () => {
    const state = last([pick('w1')]);
    const before = structuredClone(state);
    const refused: [unknown, string][] = [
      [{ type: 'choose', word: 'w1' }, '$.move.type'],
      [{ type: 'pick', word: 'w6' }, '$.move.word'],
      // Board words are picked by their board ID, not by their lexicon ID.
      [{ type: 'pick', word: 'vodniik' }, '$.move.word'],
      [{ type: 'pick', word: '' }, '$.move.word'],
      [{ type: 'pick', word: 1 }, '$.move.word'],
      [{ type: 'pick' }, '$.move.word'],
      [{ type: 'pick', word: 'w1', picked: true }, '$.move.picked'],
      [{ type: 'submit', word: 'w1' }, '$.move.word'],
      [[pick('w1')], '$.move'],
      [null, '$.move'],
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
    const words = VODA.words;
    const word = words[0]!;
    const bad: [unknown, string][] = [
      // A board has family words and other words.
      [{ ...VODA, words: words.map((w) => ({ ...w, member: false })) }, '$.config.words'],
      [{ ...VODA, words: words.map((w) => ({ ...w, member: true })) }, '$.config.words'],
      [{ ...VODA, words: [word] }, '$.config.words'],
      [
        { ...VODA, words: Array.from({ length: 15 }, (_, i) => ({ ...word, id: `w${i}` })) },
        '$.config.words',
      ],
      [{ ...VODA, words: [word, { ...words[1]!, id: 'w1' }] }, '$.config.words'],
      [
        { ...VODA, words: [{ ...word, id: 'w12345678901234567' }, words[1]] },
        '$.config.words[0].id',
      ],
      [{ ...VODA, words: [{ ...word, member: 'yes' }, words[1]] }, '$.config.words[0].member'],
      [{ ...VODA, words: [{ ...word, text: '' }, words[1]] }, '$.config.words[0].text'],
      [{ ...VODA, words: [{ ...word, family: 'voda' }, words[1]] }, '$.config.words[0].family'],
      [{ ...VODA, letter: 'x' }, '$.config.letter'],
      [{ ...VODA, letter: 'y' }, '$.config.letter'],
      [{ ...VODA, head: { word: 'voda' } }, '$.config.head.text'],
      [{ ...VODA, head: 'voda' }, '$.config.head'],
      [{ ...VODA, family: '' }, '$.config.family'],
      [{ ...VODA, solution: MEMBERS }, '$.config.solution'],
    ];
    for (const [config, path] of bad) {
      expect(
        rejection(() => createMinigame(definition(config), 'x', MINIGAMES)),
        path,
      ).toMatchObject({ code: PS_BOARD, path });
    }
    expect(wordFamilyAdapter.config(VODA)).toEqual(VODA);
  });

  it('refuses to restore a progress that breaks the rules of the board', () => {
    const state = last([pick('w1'), CHECK]);
    const saved = state.progress as unknown as WordFamilyState;
    const forge = (changes: Record<string, unknown>) => () =>
      restoreMinigame(DEF, { ...state, progress: { ...saved, ...changes } }, MINIGAMES);
    const bad: [() => unknown, string][] = [
      [forge({ picked: [true, false, false, false] }), '$.progress.picked'],
      [forge({ picked: [true, false, false, false, false, false] }), '$.progress.picked'],
      [forge({ picked: [true, false, 1, false, false] }), '$.progress.picked[2]'],
      [forge({ submitted: 'no' }), '$.progress.submitted'],
      [forge({ attempts: -2 }), '$.progress.attempts'],
      [forge({ members: MEMBERS }), '$.progress.members'],
    ];
    for (const [restore, path] of bad) {
      expect(rejection(restore), path).toMatchObject({ code: PS_BOARD, path });
    }
    // A board saved as complete must have exactly the family picked.
    const forgedDone = { ...state, status: 'completed' };
    expect(rejection(() => restoreMinigame(DEF, forgedDone, MINIGAMES))).toMatchObject({
      code: 'AEG-NARRATIVE-RESTORE',
    });
  });

  it('round-trips a half-played board through JSON and restore', () => {
    const state = last([pick('w2'), CHECK, pick('w2'), pick('w1')]);
    expect(restoreMinigame(DEF, JSON.parse(JSON.stringify(state)), MINIGAMES)).toEqual(state);
  });

  it('is deterministic: the same moves give the same states and never change earlier ones', () => {
    const moves = [pick('w2'), pick('w1'), CHECK, pick('w2'), pick('w3'), pick('w4'), CHECK];
    const states = play(moves);
    const snapshots = states.map((state) => JSON.stringify(state));
    expect(play(moves)).toEqual(states);
    expect(states.map((state) => JSON.stringify(state))).toEqual(snapshots);
    expect(states.at(-1)!.status).toBe('completed');
  });
});
