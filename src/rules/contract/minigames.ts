/**
 * Minigame boards: the typed view and the moves of every minigame activity.
 *
 * A minigame round shows one board at a time. The rules generate each board as an
 * `@aegis/narrative` `MinigameDefinition` (the built-in `matching` and `ordering` kinds, or a
 * custom `ps.*` adapter), keep it with its `MinigameState` in the round, and project it twice: the
 * narrative projection (`MinigameRoundView.minigame.view`) and the same board as a typed
 * `BoardView` (`MinigameRoundView.current`). The shell renders the typed board and answers with
 * `minigameMove { revision, move }`: `revision` is the board revision from the view and `move` is
 * one of the moves below. Each adapter parses its own moves.
 *
 * Boards never punish: a wrong pair, net, cut or pick stays on the board as gentle feedback and
 * can be corrected. Faces of hidden cards are never in the view.
 */
import type { Dimension } from './kinds';
import type { ListedLetter, NounPattern, SegmentRole } from './language';
import type { PairKind } from './problems';
import type { AlphabetOrder } from './skills';

/**
 * What a memory-match card shows:
 * - `word`: a lexicon word (mlýn, ryba, dobrej);
 * - `form`: a form of a word (`cell` names the paradigm cell: `pl1` = plural 1st case);
 * - `pattern`: a noun pattern word (hrad, žena, město);
 * - `category`: a category value of a dimension (a part of speech, a gender, …).
 */
export type CardFace =
  | { kind: 'word'; word: string; text: string }
  | { kind: 'form'; word: string; cell: string; text: string }
  | { kind: 'pattern'; pattern: NounPattern }
  | { kind: 'category'; dimension: Dimension; value: string };

/**
 * Card faces in the narrative projection are `labelKey` strings that encode the face with IDs only
 * (the typed board carries the Czech text):
 *
 * | Label                     | Face                                       |
 * | ------------------------- | ------------------------------------------ |
 * | `word:<word>`             | a lexicon word                             |
 * | `form:<word>:<cell>`      | a form of a word (`form:ryba:pl1`)         |
 * | `pattern:<pattern>`       | a noun pattern (`pattern:hrad`)            |
 * | `cat:<dimension>:<value>` | a category value (`cat:pos:noun`)          |
 * | `card:back`               | a card back: every card's `backLabelKey`   |
 */
export const CARD_BACK_LABEL = 'card:back';

/** The label of a face. */
export function cardLabel(face: CardFace): string {
  switch (face.kind) {
    case 'word':
      return `word:${face.word}`;
    case 'form':
      return `form:${face.word}:${face.cell}`;
    case 'pattern':
      return `pattern:${face.pattern}`;
    case 'category':
      return `cat:${face.dimension}:${face.value}`;
  }
}

// ------------------------------------------------------------------------------ Pexeso

/** One card of a memory-match board, in board order (the grid is filled row by row). */
export interface MemoryMatchCard {
  id: string;
  /** The face, or `null` while the card is face down. */
  face: CardFace | null;
  faceUp: boolean;
  matched: boolean;
}

/**
 * Pexeso (`memory-match`, narrative `matching`): flip two cards; a pair is a word and its partner
 * of the board's `pair` kind (mlýn ↔ mlynář, velký ↔ malý, ryba ↔ ryby, kapr ↔ pán, rybník ↔
 * hrad, dobrej ↔ dobrý). A mismatch stays face up until the child taps "Otočit zpět" (`clear`),
 * with no timer.
 */
export interface MemoryMatchBoard {
  kind: 'memory-match';
  pair: PairKind;
  cards: MemoryMatchCard[];
  /** Two mismatched cards are face up: only `clear` is possible now. */
  clearAvailable: boolean;
  pairs: number;
  matched: number;
  /** Pairs of cards turned so far (matches and mismatches). */
  attempts: number;
}

export type MemoryMatchMove = { type: 'select'; card: string } | { type: 'clear' };

// ------------------------------------------------------------------------------ Perlový náhrdelník

/**
 * Perlový náhrdelník (`pearl-necklace`, narrative `ordering`): thread word pearls in
 * alphabetical order (ch after h), or the listed words of one letter in the order of the school
 * rhyme. The child moves pearls (`place`) and checks the necklace (`submit`); a wrong order stays
 * editable.
 */
export interface NecklaceBoard {
  kind: 'pearl-necklace';
  order: AlphabetOrder;
  /** The listed-word letter of a rhyme necklace, else `null`. */
  letter: ListedLetter | null;
  /** The pearls in their current order on the string. */
  pearls: { id: string; word: string; text: string }[];
  /** True after a check that was not right yet, until the next move. */
  submitted: boolean;
  attempts: number;
}

/** Move pearl `item` to position `index` (the others shift), or check the necklace. */
export type NecklaceMove = { type: 'place'; item: string; index: number } | { type: 'submit' };

// ------------------------------------------------------------------------------ Rybářské sítě

/**
 * Rybářské sítě (`fishing-nets`, custom `ps.sorting-nets`): drag fish-words into 2-4 nets, one
 * net per value of the board's dimension (gender, part of speech, hard/soft/both-way consonant,
 * standard/colloquial, …), then haul the nets in (`submit`). Fish in a wrong net swim back out
 * (`wrong`) to be placed again.
 */
export interface FishingNetsBoard {
  kind: 'fishing-nets';
  dimension: Dimension;
  nets: { value: string }[];
  fish: {
    id: string;
    word: string | null;
    text: string;
    /** The net the fish is in, or `null` while it swims free. */
    net: number | null;
    /** Marked by the last haul as being in the wrong net. */
    wrong: boolean;
  }[];
  submitted: boolean;
  attempts: number;
}

export type FishingNetsMove =
  { type: 'net'; fish: string; net: number | null } | { type: 'submit' };

// ------------------------------------------------------------------------------ Ulita slov

/**
 * Ulita slov (`word-shell`, custom `ps.word-builder`, 4th grade): split a word into its parts
 * (cut between letters) and name each part (prefix, root, suffix, ending: předpona, kořen,
 * přípona, koncovka). `roles` lists the parts this board asks about; a zero ending is named by
 * the shell's empty "∅ koncovka" shell after the last letter.
 */
export interface WordShellBoard {
  kind: 'word-shell';
  word: string;
  text: string;
  /** The word's letters (code points), between which cuts go. */
  letters: string[];
  /** Cut positions, ascending, each in 1..letters.length-1. */
  cuts: number[];
  /** The parts the cuts make, in order, with the role the child gave each. */
  parts: { text: string; role: SegmentRole | null }[];
  /** The child marked a zero ending. */
  zeroEnding: boolean;
  roles: SegmentRole[];
  submitted: boolean;
  attempts: number;
}

export type WordShellMove =
  | { type: 'cut'; at: number }
  | { type: 'uncut'; at: number }
  | { type: 'label'; part: number; role: SegmentRole | null }
  | { type: 'zero-ending'; on: boolean }
  | { type: 'submit' };

// ------------------------------------------------------------------------------ Slovní rodinka

/**
 * Slovní rodinka (`word-family`, custom `ps.word-family`): pick every word of one family; words of
 * a sound-alike family sit beside them (být × bít), never words of a kin family (byt, bydlet are
 * kin of být and are never distractors of each other).
 */
export interface WordFamilyBoard {
  kind: 'word-family';
  family: string;
  head: { word: string; text: string };
  letter: ListedLetter | null;
  words: { id: string; word: string; text: string; picked: boolean }[];
  /** Family members on the board. */
  needed: number;
  submitted: boolean;
  attempts: number;
}

export type WordFamilyMove = { type: 'pick'; word: string } | { type: 'submit' };

// ------------------------------------------------------------------------------ unions

export type BoardView =
  MemoryMatchBoard | NecklaceBoard | FishingNetsBoard | WordShellBoard | WordFamilyBoard;

export type MinigameMove =
  MemoryMatchMove | NecklaceMove | FishingNetsMove | WordShellMove | WordFamilyMove;
