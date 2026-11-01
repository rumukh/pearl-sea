/**
 * Minigame boards: generating each board of a minigame round, projecting it as a typed
 * `BoardView`, and the credits a move earns (contract §12.1, design §5.8-§5.12).
 *
 * | Activity         | Narrative kind     | Board                                                          |
 * | ---------------- | ------------------ | -------------------------------------------------------------- |
 * | `memory-match`   | `matching`         | `pairs` cards of one kind (mlýn ↔ mlynář, ryba ↔ ryby, kapr ↔ pán) |
 * | `pearl-necklace` | `ordering`         | 3-10 word pearls in alphabetical order, or a rhyme's words in order |
 * | `fishing-nets`   | `ps.sorting-nets`  | 4-12 fish (words, forms, consonant letters) into 2-4 nets         |
 * | `word-shell`     | `ps.word-builder`  | a word cut into its parts and the parts named                     |
 * | `word-family`    | `ps.word-family`   | a family's words picked among sound-alike neighbours              |
 *
 * Boards take the round's items (the activity's skills), prefer the focus egg's items (as Krmení
 * does) and never repeat the previous board of the round. Companion words (a family's neighbours)
 * come from the `words` stream, everything else from `problems`.
 *
 * Credits (every credited step also earns `balance.coins.correct` coins): a matched pair credits
 * its item, `fast` while nothing was mismatched on the board before, else `ok`; a finished
 * necklace, word shell or family credits its items `fast` when it was right at the first check,
 * else `slow` (right, no box move); a fish caught by a clean first haul is `fast`, by a first haul
 * that had wrong fish `ok`, by a later haul `slow` (design §5.10 as refined for growth: items
 * only boards train must be able to reach gold).
 */
import { createMinigameRegistry } from '@aegis/narrative';
import type { Json, MinigameDefinition, MinigameState } from '@aegis/narrative';
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import {
  CARD_BACK_LABEL,
  DIMENSIONS,
  DIMENSION_VALUES,
  NOUN_PATTERNS,
  compareCzech,
  lexiconId,
  parseItemId,
} from '../contract';
import type {
  BoardView,
  CardFace,
  Dimension,
  ListedLetter,
  MinigameActivityKind,
  NounPattern,
  PairKind,
  ResponseBucket,
  SegmentRole,
  Skill,
  SoundRef,
  Word,
} from '../contract';
import { formOfTarget, formsOf, lexiconIndex } from '../learning/index-cache';
import { classTarget } from '../learning/item-info';
import { shuffle } from '../learning/random';
import { SORTING_NETS_KIND, sortingNetsAdapter } from './sorting-nets';
import type { SortingNetsConfig, SortingNetsState } from './sorting-nets';
import { WORD_BUILDER_KIND, wordBuilderAdapter } from './word-builder';
import type { WordBuilderConfig, WordBuilderState } from './word-builder';
import { WORD_FAMILY_KIND, wordFamilyAdapter } from './word-family';
import type { WordFamilyConfig, WordFamilyState } from './word-family';
import type { Data, ReadState } from '../types';

type Read<T> = DeepReadonly<T>;

/** The minigame registry of the rules: the narrative built-ins plus Perlové moře's adapters. */
export const MINIGAMES = createMinigameRegistry()
  .register(sortingNetsAdapter)
  .register(wordBuilderAdapter)
  .register(wordFamilyAdapter);

/** The smallest boards the design allows (§5.8-§5.12): fewer cannot make a board. */
export const MIN_PAIRS = 3;
export const MIN_FISH = 4;
export const MIN_FAMILY_WORDS = 2;

export interface BoardRequest {
  activity: MinigameActivityKind;
  /** The definition ID's base (`<round>.b<board>`). */
  id: string;
  /** The board's number in its round (1-based) and the round's number of boards. */
  board: number;
  boards: number;
  /** The round's items. */
  pool: readonly string[];
  focus: readonly string[] | null;
  /** The activity's skills (records). */
  skills: readonly Read<Skill>[];
  previous: Read<MinigameDefinition> | null;
  state: ReadState;
  data: Data;
  random: RandomStream;
  words: RandomStream;
}

interface MatchingConfig {
  cards: { id: string; pair: string; labelKey: string; backLabelKey: string }[];
}
interface MatchingState {
  open: string[];
  matched: string[];
  attempts: number;
}
interface OrderingConfig {
  items: { id: string; labelKey: string }[];
  solution: string[];
}
interface OrderingState {
  order: string[];
  submitted: boolean;
  attempts: number;
}

const definition = (kind: string, config: unknown, id: string): MinigameDefinition => ({
  schema: 1,
  id,
  revision: '1',
  kind,
  adapterSchema: 1,
  config: config as Json,
  outputs: [],
});

/** Items of `pool` whose kind is `kind`, parsed. */
function poolWords(pool: readonly string[], kind: 'abc' | 'seg' | 'fam'): string[] {
  return pool.flatMap((item) => {
    const parsed = parseItemId(item);
    return parsed?.kind === kind ? [parsed.word] : [];
  });
}

/** Prefer the focus egg's entries, never the previous board's, else anything. */
function preferFresh<T>(
  entries: readonly T[],
  request: BoardRequest,
  itemOf: (entry: T) => string,
  previous: (entry: T) => boolean,
): T[] {
  const fresh = entries.filter((entry) => !previous(entry));
  const from = fresh.length > 0 ? fresh : [...entries];
  const focused =
    request.focus === null ? [] : from.filter((entry) => request.focus!.includes(itemOf(entry)));
  return focused.length > 0 ? focused : from;
}

/** The words of the previous board (its config's word IDs), for "never the same board". */
function previousWords(request: BoardRequest): Set<string> {
  const previous = request.previous;
  if (previous === null) return new Set();
  const config = previous.config as Record<string, unknown>;
  const words = new Set<string>();
  for (const entry of (config['items'] as { id: string }[] | undefined) ?? []) words.add(entry.id);
  for (const card of (config['cards'] as { pair: string }[] | undefined) ?? [])
    words.add(card.pair);
  for (const fish of (config['fish'] as { item: string }[] | undefined) ?? []) words.add(fish.item);
  for (const w of (config['words'] as { word: string }[] | undefined) ?? []) words.add(w.word);
  if (typeof config['word'] === 'string') words.add(config['word']);
  return words;
}

// ------------------------------------------------------------------------------ necklace

/** A word without the diacritics that only break ties in Czech order (á, ď, é, ě, í, …). */
function primaryFold(text: string): string {
  const fold: Readonly<Record<string, string>> = {
    á: 'a',
    ď: 'd',
    é: 'e',
    ě: 'e',
    í: 'i',
    ň: 'n',
    ó: 'o',
    ť: 't',
    ú: 'u',
    ů: 'u',
    ý: 'y',
  };
  return [...text.toLowerCase()].map((c) => fold[c] ?? c).join('');
}

/** The first Czech letter of a word (ch is one letter). */
function firstLetter(text: string): string {
  const lower = text.toLowerCase();
  return lower.startsWith('ch') ? 'ch' : primaryFold(lower[0] ?? '');
}

interface NecklaceShape {
  order: 'alphabet' | 'rhyme';
  letter: ListedLetter | null;
}

/** The necklace's order and letter, from its definition ID (`….alphabet`, `….rhyme.<letter>`). */
export function necklaceShape(definitionId: string): NecklaceShape {
  const rhyme = /\.rhyme\.([blmpsvz])$/.exec(definitionId);
  return rhyme
    ? { order: 'rhyme', letter: rhyme[1] as ListedLetter }
    : { order: 'alphabet', letter: null };
}

/** The rhyme heads among `words`: head words of core listed families, by letter. */
function rhymeHeads(data: Data, words: readonly string[]): Map<ListedLetter, Read<Word>[]> {
  const lexicon = lexiconIndex(data);
  const heads = new Map<ListedLetter, Read<Word>[]>();
  for (const id of words) {
    const word = lexicon.words.get(id);
    const family = word?.family ? lexicon.families.get(word.family.id) : undefined;
    if (!word || !family || family.head !== id || family.letter === null || !family.core) continue;
    if (family.order === null) continue;
    heads.set(family.letter, [...(heads.get(family.letter) ?? []), word]);
  }
  for (const [letter, list] of heads) {
    const order = (w: Read<Word>) => lexicon.families.get(w.family!.id)!.order!;
    heads.set(
      letter,
      [...list].sort((a, b) => order(a) - order(b)),
    );
  }
  return heads;
}

function necklaceSkill(request: BoardRequest) {
  const skills = request.skills.filter((s) => s.generator === 'alphabet');
  if (skills.length === 0) return undefined;
  return skills[(request.board - 1) % skills.length];
}

/** Words an alphabetical necklace can thread: no two that only diacritics tell apart. */
function alphabetWords(
  request: BoardRequest,
  words: readonly Read<Word>[],
  size: number,
): Read<Word>[] {
  const previous = previousWords(request);
  const candidates = preferFresh(
    words,
    request,
    (w) => `abc:${w.id}`,
    (w) => previous.has(w.id),
  );
  const ordered = shuffle(candidates, request.random);
  const fallback = shuffle(words, request.random);
  // The first board of a round threads words with different first letters (design §5.9).
  const distinctFirst = request.board === 1;
  const chosen: Read<Word>[] = [];
  for (const pass of [ordered, fallback]) {
    for (const word of pass) {
      if (chosen.length >= size) break;
      if (
        chosen.some((c) => c.id === word.id || primaryFold(c.lemma) === primaryFold(word.lemma))
      ) {
        continue;
      }
      if (distinctFirst && chosen.some((c) => firstLetter(c.lemma) === firstLetter(word.lemma))) {
        continue;
      }
      chosen.push(word);
    }
  }
  return chosen;
}

function necklaceBoard(request: BoardRequest): MinigameDefinition | null {
  const skill = necklaceSkill(request);
  if (skill === undefined || skill.generator !== 'alphabet') return null;
  const lexicon = lexiconIndex(request.data);
  const words = poolWords(request.pool, 'abc')
    .map((id) => lexicon.words.get(id))
    .filter((w): w is Read<Word> => w !== undefined);
  const size = skill.params.size;
  let pearls: Read<Word>[];
  let solution: string[];
  let id: string;
  if (skill.params.order === 'rhyme') {
    const heads = rhymeHeads(
      request.data,
      words.map((w) => w.id),
    );
    const letters = [...heads.keys()].filter((letter) => heads.get(letter)!.length >= 3);
    if (letters.length === 0) return null;
    // Every run of the rhyme (a line of consecutive words) the board can thread; never the
    // previous board's run again while another is possible, the focus's letters first.
    const runs = letters.flatMap((letter) => {
      const line = heads.get(letter)!;
      const length = Math.min(size, line.length);
      return Array.from({ length: line.length - length + 1 }, (_, start) => ({
        letter,
        words: line.slice(start, start + length),
      }));
    });
    const previous = previousWords(request);
    const fresh = runs.filter((run) => run.words.some((w) => !previous.has(w.id)));
    const from = fresh.length > 0 ? fresh : runs;
    const focused =
      request.focus === null
        ? []
        : from.filter((run) => run.words.some((w) => request.focus!.includes(`abc:${w.id}`)));
    const run = request.random.pick(focused.length > 0 ? focused : from);
    pearls = run.words;
    solution = pearls.map((w) => w.id);
    id = `${request.id}.rhyme.${run.letter}`;
  } else {
    pearls = alphabetWords(request, words, size);
    if (pearls.length < 3) return null;
    solution = [...pearls].sort((a, b) => compareCzech(a.lemma, b.lemma)).map((w) => w.id);
    id = `${request.id}.alphabet`;
  }
  let items = shuffle(pearls, request.random).map((w) => ({ id: w.id, labelKey: `word:${w.id}` }));
  if (items.length > 1 && items.every((item, i) => item.id === solution[i])) {
    items = [...items.slice(1), items[0]!];
  }
  return definition('ordering', { items, solution } satisfies OrderingConfig, id);
}

// ------------------------------------------------------------------------------ Pexeso

interface MemoryPair {
  /** The item the pair credits (`pair:<kind>:<target>`). */
  item: string;
  faces: [string, string];
  /** Word IDs on the pair's cards. */
  words: string[];
}

/** The pair kind of a memory board, from its definition ID (`….pairs.<kind>`). */
export function memoryPairKind(definitionId: string): PairKind {
  const match = /\.pairs\.([a-z-]+)$/.exec(definitionId);
  return (match?.[1] ?? 'family') as PairKind;
}

/** The face label of a sound-alike side: a word, or one of its forms. */
function soundFace(data: Data, ref: Read<SoundRef>): { label: string; word: string } {
  if (typeof ref === 'string') return { label: `word:${ref}`, word: ref };
  const word = lexiconIndex(data).words.get(ref.word);
  const cell = word ? formsOf(word).find((form) => form.text === ref.form)?.cell : undefined;
  return { label: `form:${ref.word}:${cell ?? lexiconId(ref.form) ?? 'form'}`, word: ref.word };
}

/** Every pair of `kind` a pool item can give: the item's word and a partner. */
function candidatePairs(data: Data, kind: PairKind, item: string): MemoryPair[] {
  const lexicon = lexiconIndex(data);
  const parsed = parseItemId(item);
  if (parsed?.kind !== 'pair' || parsed.pair !== kind) return [];
  const target = parsed.word;
  const word = lexicon.words.get(target);
  const pairs: MemoryPair[] = [];
  const withWord = (partner: string) =>
    pairs.push({ item, faces: [`word:${target}`, `word:${partner}`], words: [target, partner] });
  switch (kind) {
    case 'family': {
      const family = word?.family?.id;
      for (const member of family ? (lexicon.members.get(family) ?? []) : []) {
        if (member !== target) withWord(member);
      }
      break;
    }
    case 'synonym':
      for (const partner of lexicon.synonyms.get(target) ?? []) withWord(partner);
      break;
    case 'antonym':
      for (const partner of lexicon.antonyms.get(target) ?? []) withWord(partner);
      break;
    case 'general':
      for (const partner of lexicon.specifics.get(target) ?? []) withWord(partner);
      break;
    case 'sound-alike': {
      const self = formOfTarget(data, target);
      const own = self
        ? soundFace(data, { word: self.word, form: self.text })
        : { label: `word:${target}`, word: target };
      for (const ref of lexicon.soundAlikes.get(target) ?? []) {
        const other = soundFace(data, ref);
        pairs.push({ item, faces: [own.label, other.label], words: [own.word, other.word] });
      }
      break;
    }
    case 'plural':
      if (word?.noun?.paradigm?.pl) {
        pairs.push({ item, faces: [`word:${target}`, `form:${target}:pl1`], words: [target] });
      }
      break;
    case 'pattern':
      if (word?.noun?.pattern) {
        pairs.push({
          item,
          faces: [`word:${target}`, `pattern:${word.noun.pattern}`],
          words: [target],
        });
      }
      break;
    case 'standard':
      if (word?.standard !== undefined) withWord(word.standard);
      break;
  }
  return pairs;
}

/** Whether two cards of different pairs relate by the board's kind (a match would be ambiguous). */
function related(data: Data, kind: PairKind, a: string, b: string): boolean {
  const lexicon = lexiconIndex(data);
  if (a === b) return true;
  const wa = lexicon.words.get(a);
  const wb = lexicon.words.get(b);
  switch (kind) {
    case 'family': {
      const fa = wa?.family?.id;
      const fb = wb?.family?.id;
      if (fa === undefined || fb === undefined) return false;
      if (fa === fb) return true;
      // Kin either way: one family listing the other is enough.
      return (
        (lexicon.families.get(fa)?.kin.includes(fb) ?? false) ||
        (lexicon.families.get(fb)?.kin.includes(fa) ?? false)
      );
    }
    case 'synonym':
      return lexicon.synonyms.get(a)?.has(b) ?? false;
    case 'antonym':
      return lexicon.antonyms.get(a)?.has(b) ?? false;
    case 'general':
      return (
        (lexicon.specifics.get(a)?.has(b) ?? false) ||
        (lexicon.specifics.get(b)?.has(a) ?? false) ||
        [...(lexicon.generals.get(a) ?? [])].some((g) => lexicon.generals.get(b)?.has(g))
      );
    case 'standard':
      return wa?.standard === b || wb?.standard === a;
    default:
      return false;
  }
}

/** The text a face shows (for "no two cards look alike"). */
function faceText(data: Data, label: string): string {
  const face = parseFace(data, label);
  if (face === null) return label;
  return face.kind === 'word' || face.kind === 'form'
    ? face.text
    : face.kind === 'pattern'
      ? `pattern:${face.pattern}`
      : `${face.dimension}:${face.value}`;
}

function memorySkill(request: BoardRequest) {
  const skills = request.skills.filter((s) => s.generator === 'pairs');
  if (skills.length === 0) return undefined;
  return skills[(request.board - 1) % skills.length];
}

/** The pairs a memory board deals: distinct, unrelated across pairs, never two alike-looking cards. */
function memoryPairs(request: BoardRequest, kind: PairKind, wanted: number): MemoryPair[] {
  const data = request.data;
  const previous = previousWords(request);
  const items = preferFresh(
    request.pool.filter((item) => item.startsWith(`pair:${kind}:`)),
    request,
    (item) => item,
    (item) => previous.has(item),
  );
  const others = request.pool.filter(
    (item) => item.startsWith(`pair:${kind}:`) && !items.includes(item),
  );
  const picks: MemoryPair[] = [];
  const texts = new Set<string>();
  const patterns = new Set<string>();
  for (const item of [...shuffle(items, request.random), ...shuffle(others, request.random)]) {
    if (picks.length >= wanted) break;
    if (picks.some((p) => p.item === item)) continue;
    for (const pair of shuffle(candidatePairs(data, kind, item), request.random)) {
      const shown = pair.faces.map((face) => faceText(data, face));
      if (shown[0] === shown[1] || shown.some((text) => texts.has(text))) continue;
      const pattern = pair.faces.find((face) => face.startsWith('pattern:'));
      if (pattern !== undefined && patterns.has(pattern)) continue;
      const clash = picks.some((p) =>
        p.words.some((w) => pair.words.some((v) => related(data, kind, w, v))),
      );
      if (clash) continue;
      picks.push(pair);
      for (const text of shown) texts.add(text);
      if (pattern !== undefined) patterns.add(pattern);
      break;
    }
  }
  return picks;
}

function memoryBoard(request: BoardRequest): MinigameDefinition | null {
  const skill = memorySkill(request);
  if (skill === undefined || skill.generator !== 'pairs') return null;
  const kind = skill.params.pair;
  const picks = memoryPairs(request, kind, skill.params.pairs);
  if (picks.length < MIN_PAIRS) return null;
  const cards = shuffle(
    picks.flatMap((pick) => [
      { pair: pick.item, labelKey: pick.faces[0] },
      { pair: pick.item, labelKey: pick.faces[1] },
    ]),
    request.random,
  );
  const config: MatchingConfig = {
    cards: cards.map((card, index) => ({
      id: `c${index + 1}`,
      pair: card.pair,
      labelKey: card.labelKey,
      backLabelKey: CARD_BACK_LABEL,
    })),
  };
  return definition('matching', config, `${request.id}.pairs.${kind}`);
}

/** A face label as a typed card face (with its Czech text), or `null` for an unknown label. */
export function parseFace(data: Data, label: string): CardFace | null {
  const lexicon = lexiconIndex(data);
  const [kind, ...rest] = label.split(':');
  if (kind === 'word' && rest.length === 1) {
    const word = lexicon.words.get(rest[0]!);
    return word ? { kind: 'word', word: word.id, text: word.lemma } : null;
  }
  if (kind === 'form' && rest.length === 2) {
    const [id, cell] = rest as [string, string];
    const word = lexicon.words.get(id);
    if (!word) return null;
    const form = formsOf(word).find((f) => f.cell === cell);
    if (form) return { kind: 'form', word: id, cell, text: form.text };
    const named = formOfTarget(data, `${id}:${cell}`);
    return named ? { kind: 'form', word: id, cell, text: named.text } : null;
  }
  if (kind === 'pattern' && rest.length === 1) {
    return (NOUN_PATTERNS as readonly string[]).includes(rest[0]!)
      ? { kind: 'pattern', pattern: rest[0] as NounPattern }
      : null;
  }
  if (kind === 'cat' && rest.length === 2) {
    const [dimension, value] = rest as [string, string];
    return (DIMENSIONS as readonly string[]).includes(dimension) &&
      DIMENSION_VALUES[dimension as Dimension].includes(value)
      ? { kind: 'category', dimension: dimension as Dimension, value }
      : null;
  }
  return null;
}

// ------------------------------------------------------------------------------ nets

function netsSkill(request: BoardRequest) {
  const skills = request.skills.filter((s) => s.generator === 'sort');
  if (skills.length === 0) return undefined;
  return skills[(request.board - 1) % skills.length];
}

/** The fish a nets board can take: the pool's classification items with their value and text. */
function netFish(request: BoardRequest, values: readonly string[]) {
  const data = request.data;
  return request.pool.flatMap((item) => {
    const target = classTarget(data, item);
    if (target === null || target.kind === 'segment') return [];
    const value = target.value;
    if (!values.includes(value)) return [];
    const text =
      target.kind === 'consonant'
        ? target.letter
        : target.kind === 'form'
          ? target.form.text
          : target.kind === 'word'
            ? target.word.lemma
            : target.kind === 'token'
              ? target.token.t
              : target.sentence.parsed.plain;
    const word =
      target.kind === 'word' || target.kind === 'form'
        ? target.word.id
        : target.kind === 'token'
          ? (target.token.word ?? null)
          : null;
    return [{ item, value, text, word }];
  });
}

function netsBoard(request: BoardRequest): MinigameDefinition | null {
  const skill = netsSkill(request);
  if (skill === undefined || skill.generator !== 'sort') return null;
  const values = [...skill.params.values];
  const previous = previousWords(request);
  const all = netFish(request, values);
  const fresh = preferFresh(
    all,
    request,
    (f) => f.item,
    (f) => previous.has(f.item),
  );
  // Round-robin over the nets, so every net gets fish; focus and fresh fish first.
  const byValue = new Map<string, typeof all>();
  for (const pass of [shuffle(fresh, request.random), shuffle(all, request.random)]) {
    for (const fish of pass) {
      const list = byValue.get(fish.value) ?? [];
      if (!list.some((f) => f.item === fish.item)) list.push(fish);
      byValue.set(fish.value, list);
    }
  }
  const chosen: typeof all = [];
  const texts = new Set<string>();
  for (let round = 0; chosen.length < skill.params.fish && round < 12; round++) {
    for (const value of values) {
      if (chosen.length >= skill.params.fish) break;
      const next = (byValue.get(value) ?? []).find(
        (f) => !chosen.some((c) => c.item === f.item) && !texts.has(f.text),
      );
      if (next === undefined) continue;
      chosen.push(next);
      texts.add(next.text);
    }
  }
  if (chosen.length < MIN_FISH || new Set(chosen.map((f) => f.value)).size < 2) return null;
  const config: SortingNetsConfig = {
    dimension: skill.params.dimension,
    values,
    fish: shuffle(chosen, request.random).map((fish, index) => ({
      id: `f${index + 1}`,
      item: fish.item,
      word: fish.word,
      text: fish.text,
      net: values.indexOf(fish.value),
    })),
  };
  return definition(SORTING_NETS_KIND, config, request.id);
}

// ------------------------------------------------------------------------------ word shell

/**
 * The target of a word shell: the parts the asked `roles` make (a run of parts of roles not asked
 * is one unnamed part; empty parts are left out) and whether the empty ending is asked.
 */
export function shellTarget(
  word: Read<Word>,
  roles: readonly SegmentRole[],
): {
  letters: string[];
  cuts: number[];
  labels: (SegmentRole | null)[];
  zeroEnding: boolean;
} | null {
  const segments = word.segments;
  if (!segments || segments.length === 0) return null;
  const letters = [...segments.map(([, piece]) => piece).join('')];
  const parts: { length: number; role: SegmentRole | null }[] = [];
  for (const [role, piece] of segments) {
    const length = [...piece].length;
    if (length === 0) continue;
    const asked = roles.includes(role) ? role : null;
    const last = parts[parts.length - 1];
    if (asked === null && last !== undefined && last.role === null) last.length += length;
    else parts.push({ length, role: asked });
  }
  const zeroEnding =
    roles.includes('ending') && segments.some(([role, piece]) => role === 'ending' && piece === '');
  // Nothing to name and no zero ending to mark: the word asks nothing of these roles.
  if (!parts.some((part) => part.role !== null) && !zeroEnding) return null;
  const cuts: number[] = [];
  let at = 0;
  for (const part of parts.slice(0, -1)) {
    at += part.length;
    cuts.push(at);
  }
  return { letters, cuts, labels: parts.map((part) => part.role), zeroEnding };
}

function shellBoard(request: BoardRequest): MinigameDefinition | null {
  const skill = request.skills.find((s) => s.generator === 'segment');
  if (skill === undefined || skill.generator !== 'segment') return null;
  const lexicon = lexiconIndex(request.data);
  const previous = previousWords(request);
  const words = poolWords(request.pool, 'seg')
    .map((id) => lexicon.words.get(id))
    .filter((w): w is Read<Word> => w !== undefined && shellTarget(w, skill.params.roles) !== null);
  if (words.length === 0) return null;
  const word = request.random.pick(
    preferFresh(
      words,
      request,
      (w) => `seg:${w.id}`,
      (w) => previous.has(w.id),
    ),
  );
  const target = shellTarget(word, skill.params.roles)!;
  const config: WordBuilderConfig = {
    word: word.id,
    text: target.letters.join(''),
    letters: target.letters,
    roles: [...skill.params.roles],
    cuts: target.cuts,
    labels: target.labels,
    zeroEnding: target.zeroEnding,
  };
  return definition(WORD_BUILDER_KIND, config, request.id);
}

// ------------------------------------------------------------------------------ word family

/** A family's neighbours: its sound-alike family's words first, then same-letter families, then
 * other families; never the family itself or a kin family (they share the root). */
function neighbours(data: Data, family: string): string[][] {
  const lexicon = lexiconIndex(data);
  const record = lexicon.families.get(family);
  if (!record) return [];
  const banned = new Set([family, ...record.kin]);
  for (const other of lexicon.families.values()) {
    if (other.kin.includes(family)) banned.add(other.id);
  }
  const wordsOf = (id: string) => [...(lexicon.members.get(id) ?? [])];
  const sound =
    record.soundAlike !== undefined && !banned.has(record.soundAlike)
      ? wordsOf(record.soundAlike)
      : [];
  const sameLetter: string[] = [];
  const others: string[] = [];
  for (const other of lexicon.families.values()) {
    if (banned.has(other.id) || other.id === record.soundAlike) continue;
    (record.letter !== null && other.letter === record.letter ? sameLetter : others).push(
      ...wordsOf(other.id),
    );
  }
  return [sound, sameLetter, others];
}

function familyBoard(request: BoardRequest): MinigameDefinition | null {
  const skill = request.skills.find((s) => s.generator === 'family');
  if (skill === undefined || skill.generator !== 'family') return null;
  const data = request.data;
  const lexicon = lexiconIndex(data);
  const previous = previousWords(request);
  const familyOf = (id: string) => lexicon.words.get(id)?.family?.id;
  // A family board shows at least `MIN_FAMILY_WORDS` words besides the head Hvězdice holds.
  const candidates = poolWords(request.pool, 'fam').filter((id) => {
    const family = familyOf(id);
    if (family === undefined) return false;
    const head = lexicon.families.get(family)?.head;
    const members = (lexicon.members.get(family) ?? []).filter((member) => member !== head);
    return (
      (skill.params.families === null || skill.params.families.includes(family)) &&
      members.length >= MIN_FAMILY_WORDS
    );
  });
  if (candidates.length === 0) return null;
  // Never the previous board's family again while another family is possible.
  const previousFamily = (request.previous?.config as { family?: unknown } | undefined)?.family;
  const otherFamilies = candidates.filter((id) => familyOf(id) !== previousFamily);
  const drawn = request.random.pick(
    preferFresh(
      otherFamilies.length > 0 ? otherFamilies : candidates,
      request,
      (id) => `fam:${id}`,
      (id) => previous.has(id),
    ),
  );
  const familyId = lexicon.words.get(drawn)!.family!.id;
  const family = lexicon.families.get(familyId)!;
  const head = lexicon.words.get(family.head)!;
  const members = (lexicon.members.get(familyId) ?? []).filter((id) => id !== family.head);
  if (members.length === 0) return null;
  const rest = shuffle(
    members.filter((id) => id !== drawn),
    request.random,
  );
  const picked = (drawn === family.head ? rest : [drawn, ...rest]).slice(0, skill.params.pick);
  if (picked.length < MIN_FAMILY_WORDS) return null;
  const tiers = neighbours(data, familyId);
  const others: string[] = [];
  const shown = new Set([head.lemma, ...picked.map((id) => lexicon.words.get(id)!.lemma)]);
  for (const tier of tiers) {
    for (const id of shuffle(tier, request.words)) {
      if (others.length >= skill.params.distractors) break;
      const lemma = lexicon.words.get(id)?.lemma;
      if (lemma === undefined || shown.has(lemma)) continue;
      shown.add(lemma);
      others.push(id);
    }
  }
  if (others.length === 0) return null;
  const words = shuffle(
    [...picked.map((id) => ({ id, member: true })), ...others.map((id) => ({ id, member: false }))],
    request.random,
  ).map((entry, index) => ({
    id: `w${index + 1}`,
    word: entry.id,
    text: lexicon.words.get(entry.id)!.lemma,
    member: entry.member,
  }));
  const config: WordFamilyConfig = {
    family: familyId,
    head: { word: head.id, text: head.lemma },
    letter: family.letter,
    words,
  };
  return definition(WORD_FAMILY_KIND, config, request.id);
}

// ------------------------------------------------------------------------------ dispatch

/** Generate the next board of a round as a narrative minigame definition, or `null`. */
export function makeBoard(request: BoardRequest): MinigameDefinition | null {
  switch (request.activity) {
    case 'pearl-necklace':
      return necklaceBoard(request);
    case 'memory-match':
      return memoryBoard(request);
    case 'fishing-nets':
      return netsBoard(request);
    case 'word-shell':
      return shellBoard(request);
    case 'word-family':
      return familyBoard(request);
  }
}

/** A stream that always draws its first option: boards made with it say what is possible. */
const FIRST: RandomStream = {
  nextUint32: () => 0,
  nextFloat: () => 0,
  range: (min) => min,
  int: (min) => min,
  bool: () => false,
  pick: (items) => items[0]!,
};

/**
 * Whether the items and skills of an activity can make a board at all: a board drawn with fixed
 * streams, no focus and no previous board (the makers fall back to every candidate when the
 * preferred ones run out, so this depends on the content only).
 */
export function canMakeBoard(
  data: Data,
  activity: MinigameActivityKind,
  pool: readonly string[],
  skills: readonly Read<Skill>[],
  state: ReadState,
): boolean {
  return (
    makeBoard({
      activity,
      id: 'r1.b1',
      board: 1,
      boards: 1,
      pool,
      focus: null,
      skills,
      previous: null,
      state,
      data,
      random: FIRST,
      words: FIRST,
    }) !== null
  );
}

/** The typed board of a (validated) definition and state; `projected` is the adapter view. */
export function boardView(
  data: Data,
  definitionValue: Read<MinigameDefinition>,
  state: Read<MinigameState>,
  projected: Json,
): BoardView {
  const lexicon = lexiconIndex(data);
  if (definitionValue.kind === 'matching') {
    const config = definitionValue.config as unknown as MatchingConfig;
    const progress = state.progress as unknown as MatchingState;
    return {
      kind: 'memory-match',
      pair: memoryPairKind(definitionValue.id),
      cards: config.cards.map((card) => {
        const faceUp = progress.open.includes(card.id) || progress.matched.includes(card.id);
        return {
          id: card.id,
          face: faceUp ? parseFace(data, card.labelKey) : null,
          faceUp,
          matched: progress.matched.includes(card.id),
        };
      }),
      clearAvailable: progress.open.length === 2,
      pairs: config.cards.length / 2,
      matched: progress.matched.length / 2,
      attempts: progress.attempts,
    };
  }
  if (definitionValue.kind === 'ordering') {
    const progress = state.progress as unknown as OrderingState;
    const shape = necklaceShape(definitionValue.id);
    return {
      kind: 'pearl-necklace',
      order: shape.order,
      letter: shape.letter,
      pearls: progress.order.map((id) => ({
        id,
        word: id,
        text: lexicon.words.get(id)?.lemma ?? id,
      })),
      submitted: progress.submitted,
      attempts: progress.attempts,
    };
  }
  if (definitionValue.kind === SORTING_NETS_KIND) {
    return { kind: 'fishing-nets', ...(projected as unknown as Omit<SortingNetsView, 'kind'>) };
  }
  if (definitionValue.kind === WORD_BUILDER_KIND) {
    return { kind: 'word-shell', ...(projected as unknown as Omit<WordShellView, 'kind'>) };
  }
  return { kind: 'word-family', ...(projected as unknown as Omit<WordFamilyView, 'kind'>) };
}

type SortingNetsView = Extract<BoardView, { kind: 'fishing-nets' }>;
type WordShellView = Extract<BoardView, { kind: 'word-shell' }>;
type WordFamilyView = Extract<BoardView, { kind: 'word-family' }>;

export interface BoardCredit {
  items: { item: string; bucket: ResponseBucket }[];
  coins: number;
}

/**
 * What a move earned: items to credit and coin steps. `pool` limits credits to the round's items
 * (a family word outside the round's skills earns coins but credits no item).
 */
export function boardCredits(
  definitionValue: Read<MinigameDefinition>,
  before: Read<MinigameState>,
  after: Read<MinigameState>,
  pool: ReadonlySet<string>,
): BoardCredit {
  const credit: BoardCredit = { items: [], coins: 0 };
  const add = (item: string, bucket: ResponseBucket) => {
    if (pool.has(item) && !credit.items.some((c) => c.item === item)) {
      credit.items.push({ item, bucket });
    }
  };
  const completed = after.status === 'completed' && before.status !== 'completed';
  const firstCheck = (attempts: number): ResponseBucket => (attempts === 1 ? 'fast' : 'slow');
  if (definitionValue.kind === 'matching') {
    const config = definitionValue.config as unknown as MatchingConfig;
    const was = (before.progress as unknown as MatchingState).matched;
    const now = after.progress as unknown as MatchingState;
    const fresh = now.matched.filter((card) => !was.includes(card));
    const pairs = [...new Set(fresh.map((card) => config.cards.find((c) => c.id === card)!.pair))];
    const clean = now.attempts * 2 === now.matched.length;
    for (const pair of pairs) add(pair, clean ? 'fast' : 'ok');
    credit.coins += pairs.length;
  } else if (definitionValue.kind === 'ordering' && completed) {
    const config = definitionValue.config as unknown as OrderingConfig;
    const bucket = firstCheck((after.progress as unknown as OrderingState).attempts);
    for (const id of config.solution) add(`abc:${id}`, bucket);
    credit.coins += config.solution.length;
  } else if (definitionValue.kind === SORTING_NETS_KIND) {
    const config = definitionValue.config as unknown as SortingNetsConfig;
    const was = before.progress as unknown as SortingNetsState;
    const now = after.progress as unknown as SortingNetsState;
    if (now.attempts > was.attempts) {
      const wrong = now.wrong.some((w) => w);
      config.fish.forEach((fish, i) => {
        if (was.caught[i] !== 0 || now.caught[i] === 0) return;
        add(fish.item, now.attempts > 1 ? 'slow' : wrong ? 'ok' : 'fast');
        credit.coins += 1;
      });
    }
  } else if (definitionValue.kind === WORD_BUILDER_KIND && completed) {
    const config = definitionValue.config as unknown as WordBuilderConfig;
    add(`seg:${config.word}`, firstCheck((after.progress as unknown as WordBuilderState).attempts));
    credit.coins += config.labels.length + (config.zeroEnding ? 1 : 0);
  } else if (definitionValue.kind === WORD_FAMILY_KIND && completed) {
    const config = definitionValue.config as unknown as WordFamilyConfig;
    const bucket = firstCheck((after.progress as unknown as WordFamilyState).attempts);
    add(`fam:${config.head.word}`, bucket);
    for (const word of config.words) if (word.member) add(`fam:${word.word}`, bucket);
    credit.coins += config.words.filter((w) => w.member).length;
  }
  return credit;
}
