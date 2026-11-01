/**
 * Slovní rodinka (`ps.word-family`, design §5.12): Hvězdice holds a family's head word; the child
 * picks every word of the family among neighbours (words of the sound-alike family on purpose,
 * never of a kin family) and checks (`submit`). A pick toggles; a wrong check stays editable. The
 * board is complete when exactly the family's words are picked.
 *
 * Config `{ family, head, letter, words: [{ id, word, text, member }] }`; moves
 * `{ type: 'pick', word }` (a board word's `id`) and `{ type: 'submit' }`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { LISTED_LETTERS } from '../contract';
import type { ListedLetter, WordFamilyBoard, WordFamilyMove } from '../contract';
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

export const WORD_FAMILY_KIND = 'ps.word-family';

export interface FamilyWord {
  id: string;
  word: string;
  text: string;
  member: boolean;
}

export interface WordFamilyConfig {
  family: string;
  head: { word: string; text: string };
  letter: ListedLetter | null;
  words: FamilyWord[];
}

export interface WordFamilyState {
  picked: boolean[];
  submitted: boolean;
  attempts: number;
}

export const wordFamilyAdapter: MinigameAdapter<
  WordFamilyConfig,
  WordFamilyState,
  WordFamilyMove,
  Omit<WordFamilyBoard, 'kind'>
> = {
  kind: WORD_FAMILY_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['family', 'head', 'letter', 'words']);
    const head = object(o.head, '$.config.head', ['word', 'text']);
    const words = array(o.words, '$.config.words', { min: 2, max: 14 }).map((entry, i) => {
      const path = `$.config.words[${i}]`;
      const w = object(entry, path, ['id', 'word', 'text', 'member']);
      return {
        id: text(w.id, `${path}.id`, 16),
        word: text(w.word, `${path}.word`, 64),
        text: text(w.text, `${path}.text`, 64),
        member: boolean(w.member, `${path}.member`),
      };
    });
    uniqueTexts(
      words.map((w) => w.id),
      '$.config.words',
    );
    if (!words.some((w) => w.member) || words.every((w) => w.member)) {
      invalid('$.config.words', 'A board has family words and others.');
    }
    return {
      family: text(o.family, '$.config.family', 64),
      head: {
        word: text(head.word, '$.config.head.word', 64),
        text: text(head.text, '$.config.head.text', 64),
      },
      letter: nullableLiteral(o.letter, '$.config.letter', LISTED_LETTERS),
      words,
    };
  },
  state(value, config) {
    const o = object(value, '$.progress', ['picked', 'submitted', 'attempts']);
    const count = config.words.length;
    return {
      picked: array(o.picked, '$.progress.picked', { min: count, max: count }).map((p, i) =>
        boolean(p, `$.progress.picked[${i}]`),
      ),
      submitted: boolean(o.submitted, '$.progress.submitted'),
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'word']);
    const type = literal(o.type, '$.move.type', ['pick', 'submit'] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    const word = text(o.word, '$.move.word', 16);
    if (!config.words.some((w) => w.id === word)) invalid('$.move.word', 'No such word here.');
    return { type, word };
  },
  initial: (config) => ({ picked: config.words.map(() => false), submitted: false, attempts: 0 }),
  reduce(config, state, move) {
    if (move.type === 'submit') return { ...state, submitted: true, attempts: state.attempts + 1 };
    const at = config.words.findIndex((w) => w.id === move.word);
    return {
      ...state,
      picked: state.picked.map((picked, i) => (i === at ? !picked : picked)),
      submitted: false,
    };
  },
  project: (config, state) => ({
    family: config.family,
    head: { ...config.head },
    letter: config.letter,
    words: config.words.map((w, i) => ({
      id: w.id,
      word: w.word,
      text: w.text,
      picked: state.picked[i] ?? false,
    })),
    needed: config.words.filter((w) => w.member).length,
    submitted: state.submitted,
    attempts: state.attempts,
  }),
  completed: (config, state) =>
    state.submitted && config.words.every((w, i) => state.picked[i] === w.member),
};
