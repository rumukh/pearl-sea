/**
 * Rybářské sítě (`ps.sorting-nets`, design §5.10): fish carrying words, forms or consonant
 * letters are dragged into 2-4 nets, one per value of the board's dimension, and the nets are
 * hauled in (`submit`). A haul keeps the fish that are in their right net (they stay there,
 * caught) and sends every fish in a wrong net swimming back out (`wrong`) to be placed again;
 * fish not placed yet just keep swimming. The board is complete when every fish is caught.
 *
 * Config `{ dimension, values, fish: [{ id, item, word, text, net }] }` (`net`: the right net's
 * index); moves `{ type: 'net', fish, net | null }` and `{ type: 'submit' }`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { DIMENSIONS } from '../contract';
import type { Dimension, FishingNetsBoard, FishingNetsMove } from '../contract';
import {
  array,
  boolean,
  integer,
  invalid,
  literal,
  nullableInteger,
  nullableText,
  object,
  text,
  uniqueTexts,
} from './decode';

export const SORTING_NETS_KIND = 'ps.sorting-nets';

export interface NetFish {
  id: string;
  /** The item a caught fish credits. */
  item: string;
  word: string | null;
  text: string;
  /** The right net. */
  net: number;
}

export interface SortingNetsConfig {
  dimension: Dimension;
  values: string[];
  fish: NetFish[];
}

export interface SortingNetsState {
  /** The net each fish is in, or `null` while it swims free. */
  nets: (number | null)[];
  /** Marked by the last haul as having been in a wrong net. */
  wrong: boolean[];
  /** The haul that caught each fish (1-based), or 0 while it is not caught. */
  caught: number[];
  submitted: boolean;
  attempts: number;
}

const ID = /^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/;

export const sortingNetsAdapter: MinigameAdapter<
  SortingNetsConfig,
  SortingNetsState,
  FishingNetsMove,
  Omit<FishingNetsBoard, 'kind'>
> = {
  kind: SORTING_NETS_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['dimension', 'values', 'fish']);
    const dimension = literal(o.dimension, '$.config.dimension', DIMENSIONS);
    const values = array(o.values, '$.config.values', { min: 2, max: 4 }).map((v, i) =>
      text(v, `$.config.values[${i}]`, 24),
    );
    uniqueTexts(values, '$.config.values');
    const fish = array(o.fish, '$.config.fish', { min: 2, max: 12 }).map((entry, i) => {
      const path = `$.config.fish[${i}]`;
      const f = object(entry, path, ['id', 'item', 'word', 'text', 'net']);
      const id = text(f.id, `${path}.id`, 16);
      if (!ID.test(id)) invalid(`${path}.id`, 'Expected an ID.');
      return {
        id,
        item: text(f.item, `${path}.item`, 128),
        word: nullableText(f.word, `${path}.word`, 64),
        text: text(f.text, `${path}.text`, 64),
        net: integer(f.net, `${path}.net`, 0, values.length - 1),
      };
    });
    uniqueTexts(
      fish.map((f) => f.id),
      '$.config.fish',
    );
    return { dimension, values, fish };
  },
  state(value, config) {
    const o = object(value, '$.progress', ['nets', 'wrong', 'caught', 'submitted', 'attempts']);
    const count = config.fish.length;
    const attempts = integer(o.attempts, '$.progress.attempts', 0, 1_000_000);
    const nets = array(o.nets, '$.progress.nets', { min: count, max: count }).map((net, i) =>
      nullableInteger(net, `$.progress.nets[${i}]`, 0, config.values.length - 1),
    );
    const wrong = array(o.wrong, '$.progress.wrong', { min: count, max: count }).map((w, i) =>
      boolean(w, `$.progress.wrong[${i}]`),
    );
    const caught = array(o.caught, '$.progress.caught', { min: count, max: count }).map((c, i) =>
      integer(c, `$.progress.caught[${i}]`, 0, attempts),
    );
    config.fish.forEach((fish, i) => {
      if (caught[i]! > 0 && nets[i] !== fish.net) {
        invalid(`$.progress.caught[${i}]`, 'A caught fish stays in its right net.');
      }
      if (wrong[i] && nets[i] !== null) {
        invalid(`$.progress.wrong[${i}]`, 'A fish sent back swims free.');
      }
    });
    return {
      nets,
      wrong,
      caught,
      submitted: boolean(o.submitted, '$.progress.submitted'),
      attempts,
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'fish', 'net']);
    const type = literal(o.type, '$.move.type', ['net', 'submit'] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    const fish = text(o.fish, '$.move.fish', 16);
    if (!config.fish.some((f) => f.id === fish)) invalid('$.move.fish', 'No such fish.');
    return {
      type,
      fish,
      net: nullableInteger(o.net, '$.move.net', 0, config.values.length - 1),
    };
  },
  initial: (config) => ({
    nets: config.fish.map(() => null),
    wrong: config.fish.map(() => false),
    caught: config.fish.map(() => 0),
    submitted: false,
    attempts: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'net') {
      const at = config.fish.findIndex((f) => f.id === move.fish);
      if (state.caught[at]! > 0) invalid('$.move.fish', 'This fish is already caught.');
      return {
        ...state,
        nets: state.nets.map((net, i) => (i === at ? move.net : net)),
        wrong: state.wrong.map((w, i) => (i === at ? false : w)),
        submitted: false,
      };
    }
    const attempts = state.attempts + 1;
    const nets = [...state.nets];
    const wrong = [...state.wrong];
    const caught = [...state.caught];
    // Hauling in empty nets checks nothing: it is not counted as a haul.
    if (config.fish.every((_, i) => caught[i]! > 0 || nets[i] === null)) {
      return { ...state, submitted: true };
    }
    config.fish.forEach((fish, i) => {
      if (caught[i]! > 0) return;
      if (nets[i] === fish.net) caught[i] = attempts;
      else if (nets[i] !== null) {
        nets[i] = null;
        wrong[i] = true;
      }
    });
    return { nets, wrong, caught, submitted: true, attempts };
  },
  project: (config, state) => ({
    dimension: config.dimension,
    nets: config.values.map((value) => ({ value })),
    fish: config.fish.map((fish, i) => ({
      id: fish.id,
      word: fish.word,
      text: fish.text,
      net: state.nets[i] ?? null,
      wrong: state.wrong[i] ?? false,
    })),
    submitted: state.submitted,
    attempts: state.attempts,
  }),
  completed: (config, state) => state.caught.every((haul) => haul > 0),
};
