/**
 * Ulita slov (`ps.word-builder`, design §5.11, the 4th grade): the child cuts a word between its
 * letters, names each part (předpona, kořen, přípona, koncovka) and marks a zero ending in the
 * empty "∅ koncovka" shell, then checks (`submit`). `roles` limits what is asked: a part of a role
 * not asked is not named (it stays unlabelled), and runs of such parts are one part. A wrong check
 * stays editable. The board is complete when the cuts, the names and the zero ending are right.
 *
 * Config `{ word, text, letters, roles, cuts, labels, zeroEnding }` (the target); moves
 * `{ type: 'cut' | 'uncut', at }`, `{ type: 'label', part, role | null }`,
 * `{ type: 'zero-ending', on }` and `{ type: 'submit' }`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { SEGMENT_ROLES } from '../contract';
import type { SegmentRole, WordShellBoard, WordShellMove } from '../contract';
import {
  array,
  boolean,
  integer,
  invalid,
  literal,
  nullableLiteral,
  object,
  text,
  uniqueTexts,
} from './decode';

export const WORD_BUILDER_KIND = 'ps.word-builder';

export interface WordBuilderConfig {
  word: string;
  text: string;
  letters: string[];
  roles: SegmentRole[];
  /** The right cuts, ascending. */
  cuts: number[];
  /** The right name of each part the right cuts make (`null`: a part of no asked role). */
  labels: (SegmentRole | null)[];
  /** The word has an empty ending and the board asks endings. */
  zeroEnding: boolean;
}

export interface WordBuilderState {
  cuts: number[];
  labels: (SegmentRole | null)[];
  zeroEnding: boolean;
  submitted: boolean;
  attempts: number;
}

function cutList(value: unknown, path: string, letters: number): number[] {
  const cuts = array(value, path, { min: 0, max: Math.max(0, letters - 1) }).map((cut, i) =>
    integer(cut, `${path}[${i}]`, 1, Math.max(1, letters - 1)),
  );
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i]! <= cuts[i - 1]!) invalid(path, 'Cuts are ascending and distinct.');
  }
  return cuts;
}

function labelList(value: unknown, path: string, parts: number): (SegmentRole | null)[] {
  return array(value, path, { min: parts, max: parts }).map((label, i) =>
    nullableLiteral(label, `${path}[${i}]`, SEGMENT_ROLES),
  );
}

/** The parts the cuts make. */
export function partsOf(letters: readonly string[], cuts: readonly number[]): string[] {
  const bounds = [0, ...cuts, letters.length];
  return bounds.slice(1).map((end, i) => letters.slice(bounds[i], end).join(''));
}

const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

export const wordBuilderAdapter: MinigameAdapter<
  WordBuilderConfig,
  WordBuilderState,
  WordShellMove,
  Omit<WordShellBoard, 'kind'>
> = {
  kind: WORD_BUILDER_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', [
      'word',
      'text',
      'letters',
      'roles',
      'cuts',
      'labels',
      'zeroEnding',
    ]);
    const letters = array(o.letters, '$.config.letters', { min: 1, max: 32 }).map((l, i) =>
      text(l, `$.config.letters[${i}]`, 2),
    );
    const roles = array(o.roles, '$.config.roles', { min: 1, max: 4 }).map((r, i) =>
      literal(r, `$.config.roles[${i}]`, SEGMENT_ROLES),
    );
    uniqueTexts(roles, '$.config.roles');
    const cuts = cutList(o.cuts, '$.config.cuts', letters.length);
    const labels = labelList(o.labels, '$.config.labels', cuts.length + 1);
    for (const label of labels) {
      if (label !== null && !roles.includes(label))
        invalid('$.config.labels', 'Not an asked role.');
    }
    const word = text(o.word, '$.config.word', 64);
    const shown = text(o.text, '$.config.text', 64);
    if (letters.join('') !== shown) invalid('$.config.letters', 'The letters spell the word.');
    return {
      word,
      text: shown,
      letters,
      roles,
      cuts,
      labels,
      zeroEnding: boolean(o.zeroEnding, '$.config.zeroEnding'),
    };
  },
  state(value, config) {
    const o = object(value, '$.progress', [
      'cuts',
      'labels',
      'zeroEnding',
      'submitted',
      'attempts',
    ]);
    const cuts = cutList(o.cuts, '$.progress.cuts', config.letters.length);
    const labels = labelList(o.labels, '$.progress.labels', cuts.length + 1);
    for (const label of labels) {
      if (label !== null && !config.roles.includes(label)) {
        invalid('$.progress.labels', 'Not an asked role.');
      }
    }
    const zeroEnding = boolean(o.zeroEnding, '$.progress.zeroEnding');
    if (zeroEnding && !config.roles.includes('ending')) {
      invalid('$.progress.zeroEnding', 'Not an asked role.');
    }
    return {
      cuts,
      labels,
      zeroEnding,
      submitted: boolean(o.submitted, '$.progress.submitted'),
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'at', 'part', 'role', 'on']);
    const type = literal(o.type, '$.move.type', [
      'cut',
      'uncut',
      'label',
      'zero-ending',
      'submit',
    ] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    if (type === 'cut' || type === 'uncut') {
      object(value, '$.move', ['type', 'at']);
      return { type, at: integer(o.at, '$.move.at', 1, Math.max(1, config.letters.length - 1)) };
    }
    if (type === 'zero-ending') {
      object(value, '$.move', ['type', 'on']);
      const on = boolean(o.on, '$.move.on');
      // The ∅ shell names an ending: like a label, only where endings are asked.
      if (on && !config.roles.includes('ending')) invalid('$.move.on', 'Not asked here.');
      return { type, on };
    }
    object(value, '$.move', ['type', 'part', 'role']);
    const role = nullableLiteral(o.role, '$.move.role', SEGMENT_ROLES);
    if (role !== null && !config.roles.includes(role)) invalid('$.move.role', 'Not asked here.');
    return { type, part: integer(o.part, '$.move.part', 0, 31), role };
  },
  initial: () => ({
    cuts: [],
    labels: [null],
    zeroEnding: false,
    submitted: false,
    attempts: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'submit') return { ...state, submitted: true, attempts: state.attempts + 1 };
    if (move.type === 'zero-ending') return { ...state, zeroEnding: move.on, submitted: false };
    if (move.type === 'label') {
      if (move.part >= state.labels.length) invalid('$.move.part', 'No such part.');
      return {
        ...state,
        labels: state.labels.map((label, i) => (i === move.part ? move.role : label)),
        submitted: false,
      };
    }
    if (move.at >= config.letters.length) invalid('$.move.at', 'Cut between letters.');
    const part = state.cuts.filter((cut) => cut < move.at).length;
    if (move.type === 'cut') {
      if (state.cuts.includes(move.at)) invalid('$.move.at', 'Already cut there.');
      const labels = [...state.labels];
      labels.splice(part, 1, null, null);
      return {
        ...state,
        cuts: [...state.cuts, move.at].sort((a, b) => a - b),
        labels,
        submitted: false,
      };
    }
    if (!state.cuts.includes(move.at)) invalid('$.move.at', 'No cut there.');
    const labels = [...state.labels];
    labels.splice(part, 2, null);
    return {
      ...state,
      cuts: state.cuts.filter((cut) => cut !== move.at),
      labels,
      submitted: false,
    };
  },
  project: (config, state) => ({
    word: config.word,
    text: config.text,
    letters: [...config.letters],
    cuts: [...state.cuts],
    parts: partsOf(config.letters, state.cuts).map((part, i) => ({
      text: part,
      role: state.labels[i] ?? null,
    })),
    zeroEnding: state.zeroEnding,
    roles: [...config.roles],
    submitted: state.submitted,
    attempts: state.attempts,
  }),
  completed: (config, state) =>
    state.submitted &&
    same(state.cuts, config.cuts) &&
    same(state.labels, config.labels) &&
    state.zeroEnding === config.zeroEnding,
};
