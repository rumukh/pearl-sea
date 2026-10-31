/**
 * Ulita slov (`ps.word-builder`, design §5.11, contract §12.1) played in isolation: cutting a word
 * between its letters and joining parts again, naming the parts and marking the zero ending (only
 * with the roles the board asks), and checking; a wrong check stays editable; completion exactly
 * when the cuts, the names and the zero ending are right and checked; strict configs, progress and
 * moves; restore round trips and determinism. The boards are written by hand from námořník
 * (ná|moř|ník|∅).
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
import type { SegmentRole, WordShellBoard, WordShellMove } from '../../../src/rules/contract';
import { MINIGAMES } from '../../../src/rules/minigames/boards';
import { WORD_BUILDER_KIND, partsOf } from '../../../src/rules/minigames/word-builder';
import type {
  WordBuilderConfig,
  WordBuilderState,
} from '../../../src/rules/minigames/word-builder';

const PS_BOARD = 'AEG-NARRATIVE-PS-BOARD';

/** Every part asked: předpona ná, kořen moř, přípona ník and the zero ending. */
const ALL_ROLES: WordBuilderConfig = {
  word: 'naamorxniik',
  text: 'námořník',
  letters: ['n', 'á', 'm', 'o', 'ř', 'n', 'í', 'k'],
  roles: ['prefix', 'root', 'suffix', 'ending'],
  cuts: [2, 5],
  labels: ['prefix', 'root', 'suffix'],
  zeroEnding: true,
};

/** Only the root asked: the parts around it stay unnamed, and no ending is asked. */
const ROOT_ONLY: WordBuilderConfig = {
  ...ALL_ROLES,
  roles: ['root'],
  labels: [null, 'root', null],
  zeroEnding: false,
};

function definition(config: unknown): MinigameDefinition {
  return {
    schema: 1,
    id: 'shell',
    revision: '1',
    kind: WORD_BUILDER_KIND,
    adapterSchema: 1,
    config: config as Json,
    outputs: [],
  };
}

const ALL = definition(ALL_ROLES);
const ROOT = definition(ROOT_ONLY);

function move(def: MinigameDefinition, state: MinigameState, value: unknown): MinigameState {
  return reduceMinigame(
    def,
    state,
    { type: 'move', revision: state.revision, value: value as Json },
    MINIGAMES,
  );
}

/** Every state of a game: the new board, then one per move. */
function play(def: MinigameDefinition, moves: readonly WordShellMove[]): MinigameState[] {
  const states = [createMinigame(def, 'shell-1', MINIGAMES)];
  for (const value of moves) states.push(move(def, states[states.length - 1]!, value));
  return states;
}

const last = (def: MinigameDefinition, moves: readonly WordShellMove[]) => play(def, moves).at(-1)!;
const view = (def: MinigameDefinition, state: MinigameState) =>
  projectMinigame(def, state, MINIGAMES).view as unknown as Omit<WordShellBoard, 'kind'>;
const progress = (state: MinigameState) => state.progress as unknown as WordBuilderState;

const cut = (at: number): WordShellMove => ({ type: 'cut', at });
const uncut = (at: number): WordShellMove => ({ type: 'uncut', at });
const name = (part: number, role: SegmentRole | null): WordShellMove => ({
  type: 'label',
  part,
  role,
});
const zero = (on: boolean): WordShellMove => ({ type: 'zero-ending', on });
const CHECK: WordShellMove = { type: 'submit' };

/** ná|moř|ník named, without the zero ending. */
const RIGHT_PARTS: WordShellMove[] = [
  cut(5),
  cut(2),
  name(0, 'prefix'),
  name(1, 'root'),
  name(2, 'suffix'),
];

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

describe('partsOf', () => {
  const letters = ALL_ROLES.letters;
  it('splits the letters at the cuts', () => {
    expect(partsOf(letters, [])).toEqual(['námořník']);
    expect(partsOf(letters, [2, 5])).toEqual(['ná', 'moř', 'ník']);
    expect(partsOf(letters, [1, 2, 3, 4, 5, 6, 7])).toEqual([...'námořník']);
    expect(partsOf(['l', 'e', 's'], [1])).toEqual(['l', 'es']);
  });
});

describe('Ulita slov (ps.word-builder)', () => {
  it('starts with the whole word as one unnamed part and the roles the board asks', () => {
    expect(view(ALL, last(ALL, []))).toEqual({
      word: 'naamorxniik',
      text: 'námořník',
      letters: ['n', 'á', 'm', 'o', 'ř', 'n', 'í', 'k'],
      cuts: [],
      parts: [{ text: 'námořník', role: null }],
      zeroEnding: false,
      roles: ['prefix', 'root', 'suffix', 'ending'],
      submitted: false,
      attempts: 0,
    });
  });

  it('cuts between letters in any order and keeps the cuts ascending', () => {
    const board = view(ALL, last(ALL, [cut(5), cut(2)]));
    expect(board.cuts).toEqual([2, 5]);
    expect(board.parts).toEqual([
      { text: 'ná', role: null },
      { text: 'moř', role: null },
      { text: 'ník', role: null },
    ]);
  });

  it('names parts, renames them and takes a name back', () => {
    const named = last(ALL, [...RIGHT_PARTS, name(2, 'ending'), name(0, null)]);
    expect(view(ALL, named).parts.map((part) => part.role)).toEqual([null, 'root', 'ending']);
  });

  it('forgets the name of a part it cuts or joins, and keeps the others', () => {
    // Cutting the named root moř into m|oř leaves both new parts unnamed.
    const cutRoot = last(ALL, [...RIGHT_PARTS, cut(3)]);
    expect(view(ALL, cutRoot).parts).toEqual([
      { text: 'ná', role: 'prefix' },
      { text: 'm', role: null },
      { text: 'oř', role: null },
      { text: 'ník', role: 'suffix' },
    ]);
    // Joining moř and ník again makes one unnamed part mořník.
    const joined = last(ALL, [...RIGHT_PARTS, uncut(5)]);
    expect(view(ALL, joined).cuts).toEqual([2]);
    expect(view(ALL, joined).parts).toEqual([
      { text: 'ná', role: 'prefix' },
      { text: 'mořník', role: null },
    ]);
  });

  it('a wrong check stays editable: it counts the attempt and the next move clears the check', () => {
    const checked = last(ALL, [CHECK]);
    expect(checked.status).toBe('active');
    expect(view(ALL, checked)).toMatchObject({ submitted: true, attempts: 1 });
    const edited = move(ALL, checked, cut(2));
    expect(view(ALL, edited)).toMatchObject({ submitted: false, attempts: 1 });
  });

  it('completes only when the cuts, the names and the zero ending are right and checked', () => {
    // Right parts but no zero ending, a wrong name, an extra cut, or right but not checked.
    expect(last(ALL, [...RIGHT_PARTS, CHECK]).status).toBe('active');
    expect(last(ALL, [...RIGHT_PARTS, name(2, 'ending'), zero(true), CHECK]).status).toBe('active');
    expect(last(ALL, [...RIGHT_PARTS, cut(7), zero(true), CHECK]).status).toBe('active');
    expect(last(ALL, [...RIGHT_PARTS, zero(true)]).status).toBe('active');

    const done = last(ALL, [...RIGHT_PARTS, zero(true), CHECK]);
    expect(done.status).toBe('completed');
    expect(view(ALL, done)).toMatchObject({ zeroEnding: true, submitted: true, attempts: 1 });

    const later = last(ALL, [...RIGHT_PARTS, CHECK, zero(true), CHECK]);
    expect(later.status).toBe('completed');
    expect(view(ALL, later).attempts).toBe(2);
  });

  it('turns the zero ending off again, and then the board is not right', () => {
    const states = play(ALL, [...RIGHT_PARTS, zero(true), zero(false), CHECK]);
    expect(states.map((state) => view(ALL, state).zeroEnding)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(states.at(-1)!.status).toBe('active');
  });

  it('leaves the parts of roles not asked unnamed: a root-only shell', () => {
    const done = last(ROOT, [cut(2), cut(5), name(1, 'root'), CHECK]);
    expect(done.status).toBe('completed');
    expect(progress(done).labels).toEqual([null, 'root', null]);
    // Naming a part with a role this board does not ask is refused.
    const cutUp = last(ROOT, [cut(2), cut(5)]);
    for (const role of ['prefix', 'suffix', 'ending'] as const) {
      expect(rejection(() => move(ROOT, cutUp, name(0, role)))).toMatchObject({
        code: PS_BOARD,
        path: '$.move.role',
      });
    }
  });

  it('refuses every move once the board is complete', () => {
    const done = last(ALL, [...RIGHT_PARTS, zero(true), CHECK]);
    for (const value of [cut(1), uncut(2), name(0, null), zero(false), CHECK]) {
      expect(rejection(() => move(ALL, done, value))).toMatchObject({
        code: 'AEG-NARRATIVE-MINI-CLOSED',
        path: '$.status',
      });
    }
  });

  it('decodes moves strictly and leaves the board as it was', () => {
    const state = last(ALL, [cut(2)]);
    const before = structuredClone(state);
    const refused: [unknown, string, RegExp?][] = [
      [{ type: 'glue' }, '$.move.type'],
      [{ type: 'cut', at: 0 }, '$.move.at'],
      [{ type: 'cut', at: 8 }, '$.move.at'],
      [{ type: 'cut', at: 2.5 }, '$.move.at'],
      [{ type: 'cut' }, '$.move.at'],
      [{ type: 'cut', at: 2 }, '$.move.at', /already cut/i],
      [{ type: 'uncut', at: 3 }, '$.move.at', /no cut/i],
      [{ type: 'label', part: 2, role: 'root' }, '$.move.part', /no such part/i],
      [{ type: 'label', part: 32, role: 'root' }, '$.move.part'],
      [{ type: 'label', part: -1, role: 'root' }, '$.move.part'],
      [{ type: 'label', part: 0, role: 'stem' }, '$.move.role'],
      [{ type: 'label', part: 0 }, '$.move.role'],
      [{ type: 'zero-ending', on: 'yes' }, '$.move.on'],
      [{ type: 'cut', at: 3, part: 0 }, '$.move.part'],
      [{ type: 'label', part: 0, role: 'root', at: 1 }, '$.move.at'],
      [{ type: 'zero-ending', on: true, role: 'ending' }, '$.move.role'],
      [{ type: 'submit', on: true }, '$.move.on'],
      [{ type: 'cut', at: 3, word: 'les' }, '$.move.word'],
      [null, '$.move'],
    ];
    for (const [value, path, message] of refused) {
      const refusal = rejection(() => move(ALL, state, value));
      expect(refusal, JSON.stringify(value)).toMatchObject({ code: PS_BOARD, path });
      if (message) expect(refusal.message).toMatch(message);
    }
    expect(state).toEqual(before);
  });

  it('rejects malformed configs', () => {
    const bad: [unknown, string][] = [
      [{ ...ALL_ROLES, letters: ['n', 'a', 'm', 'o', 'ř', 'n', 'í', 'k'] }, '$.config.letters'],
      [{ ...ALL_ROLES, letters: [] }, '$.config.letters'],
      [{ ...ALL_ROLES, letters: ['nám', 'ořník'] }, '$.config.letters[0]'],
      [{ ...ALL_ROLES, roles: [] }, '$.config.roles'],
      [{ ...ALL_ROLES, roles: ['root', 'root'] }, '$.config.roles'],
      [{ ...ALL_ROLES, roles: ['stem'] }, '$.config.roles[0]'],
      [{ ...ALL_ROLES, cuts: [5, 2] }, '$.config.cuts'],
      [{ ...ALL_ROLES, cuts: [2, 2] }, '$.config.cuts'],
      [{ ...ALL_ROLES, cuts: [2, 8] }, '$.config.cuts[1]'],
      [{ ...ALL_ROLES, cuts: [0, 5] }, '$.config.cuts[0]'],
      [{ ...ALL_ROLES, labels: ['prefix', 'root'] }, '$.config.labels'],
      [{ ...ROOT_ONLY, labels: ['prefix', 'root', null] }, '$.config.labels'],
      [{ ...ALL_ROLES, labels: ['prefix', 'stem', 'suffix'] }, '$.config.labels[1]'],
      [{ ...ALL_ROLES, zeroEnding: 'yes' }, '$.config.zeroEnding'],
      [{ ...ALL_ROLES, text: '' }, '$.config.text'],
      [{ ...ALL_ROLES, parts: ['ná'] }, '$.config.parts'],
    ];
    for (const [config, path] of bad) {
      expect(
        rejection(() => createMinigame(definition(config), 'x', MINIGAMES)),
        path,
      ).toMatchObject({ code: PS_BOARD, path });
    }
  });

  it('refuses to restore a progress that breaks the rules of the board', () => {
    const state = last(ROOT, [cut(2), cut(5), name(1, 'root')]);
    const saved = progress(state);
    const forge = (changes: Record<string, unknown>) => () =>
      restoreMinigame(ROOT, { ...state, progress: { ...saved, ...changes } }, MINIGAMES);
    const bad: [() => unknown, string][] = [
      [forge({ cuts: [5, 2] }), '$.progress.cuts'],
      [forge({ cuts: [0, 5] }), '$.progress.cuts[0]'],
      [forge({ cuts: [2, 8] }), '$.progress.cuts[1]'],
      // Three parts need three names.
      [forge({ labels: [null, 'root'] }), '$.progress.labels'],
      // A name of a role this board does not ask.
      [forge({ labels: ['prefix', 'root', null] }), '$.progress.labels'],
      [forge({ zeroEnding: null }), '$.progress.zeroEnding'],
      [forge({ attempts: 1.5 }), '$.progress.attempts'],
      [forge({ hint: 'kořen' }), '$.progress.hint'],
    ];
    for (const [restore, path] of bad) {
      expect(rejection(restore), path).toMatchObject({ code: PS_BOARD, path });
    }
    // A board saved as complete must be right.
    const forgedDone = {
      ...state,
      status: 'completed',
      progress: { ...saved, labels: [null, null, null], submitted: true },
    };
    expect(rejection(() => restoreMinigame(ROOT, forgedDone, MINIGAMES))).toMatchObject({
      code: 'AEG-NARRATIVE-RESTORE',
    });
  });

  it('round-trips a half-played board through JSON and restore', () => {
    const state = last(ALL, [cut(2), name(0, 'prefix'), CHECK, cut(5)]);
    expect(restoreMinigame(ALL, JSON.parse(JSON.stringify(state)), MINIGAMES)).toEqual(state);
  });

  it('is deterministic: the same moves give the same states and never change earlier ones', () => {
    const moves = [cut(3), cut(5), CHECK, uncut(3), cut(2), ...RIGHT_PARTS.slice(2), zero(true)];
    const states = play(ALL, [...moves, CHECK]);
    const snapshots = states.map((state) => JSON.stringify(state));
    expect(play(ALL, [...moves, CHECK])).toEqual(states);
    expect(states.map((state) => JSON.stringify(state))).toEqual(snapshots);
    expect(states.at(-1)!.status).toBe('completed');
  });

  // The ∅ shell names an ending: like a label, it is only for boards that ask endings.
  it('refuses the zero ending on a board that does not ask endings', () => {
    const cutUp = last(ROOT, [cut(2), cut(5), name(1, 'root')]);
    expect(rejection(() => move(ROOT, cutUp, zero(true)))).toMatchObject({
      code: PS_BOARD,
      path: '$.move.on',
    });
    expect(view(ROOT, move(ROOT, cutUp, zero(false))).zeroEnding).toBe(false);
    const forged = { ...cutUp, progress: { ...progress(cutUp), zeroEnding: true } };
    expect(rejection(() => restoreMinigame(ROOT, forged, MINIGAMES))).toMatchObject({
      code: PS_BOARD,
      path: '$.progress.zeroEnding',
    });
  });
});
