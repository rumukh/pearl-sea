/**
 * Shared harness for command traces and simulations: a `Player` drives a runtime host one traced
 * step at a time (`runCommandTrace`), records every event and commit hash, answers problems with
 * an oracle that is independent of the rules (it reads the answers off the lexicon's raw data: a
 * word's letters, a sentence's `{correct|…}` gaps; it never calls the contract's `expectedAnswer`
 * and never reads a gap's `correct`), and plays minigame boards from the typed board view only,
 * deciding with the lexicon what a child knows.
 */
import { hashString } from '@aegis/core';
import { createRuntimeHost, runCommandTrace } from '@aegis/runtime';
import type { ContentPack, RuntimeAdapter, RuntimeHost, RuntimeSnapshot } from '@aegis/runtime';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import {
  ACTION_TURNS,
  BOTH_WAY_CONSONANTS,
  formCells,
  HARD_CONSONANTS,
  SOFT_CONSONANTS,
  compareCzech,
  parseGappedText,
} from '../../src/rules/contract';
import type {
  AnswerValue,
  BoardView,
  CardFace,
  ContentData,
  GameAction,
  GameView,
  MinigameMove,
  MinigameRoundView,
  PairKind,
  Problem,
  ProblemRoundView,
  ProfileState,
  TextPart,
} from '../../src/rules/contract';
import { lagoonPack } from '../fixtures/rules/lagoon-pack';

export type Adapter = RuntimeAdapter<ProfileState, GameAction, GameView, ContentData>;
export type Host = RuntimeHost<ProfileState, GameAction, GameView, ContentData>;

/** The pack the traces play: the rules' lagoon fixture until S3's pack lands. */
export function loadPack(): ContentPack<ContentData> {
  return lagoonPack();
}

// ------------------------------------------------------------------------------ the oracle

/** A text with its gaps filled right, and where each gap's right text starts in it. */
interface Filled {
  plain: string;
  gaps: { start: number; correct: string }[];
}

const filledCache = new WeakMap<ContentData, Map<string, Filled>>();

/** A sentence's text with its gaps filled right (`plain`), from the raw lexicon. */
export function filledSentence(data: ContentData, id: string): Filled {
  let cache = filledCache.get(data);
  if (cache === undefined) {
    cache = new Map();
    filledCache.set(data, cache);
  }
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const sentence = data.lexicon.sentences.find((s) => s.id === id);
  if (!sentence) throw new Error(`no sentence ${id}`);
  const parsed = parseGappedText(sentence.text);
  let plain = '';
  const gaps: Filled['gaps'] = [];
  for (const part of parsed.parts) {
    if (part.kind === 'text') plain += part.text;
    else {
      const correct = parsed.gaps[part.gap]!.correct;
      gaps.push({ start: plain.length, correct });
      plain += correct;
    }
  }
  const filled = { plain, gaps };
  cache.set(id, filled);
  return filled;
}

function filledWord(data: ContentData, id: string): Filled {
  const word = data.lexicon.words.find((w) => w.id === id);
  if (!word) throw new Error(`no word ${id}`);
  const letters = [...word.lemma];
  return {
    plain: word.lemma,
    gaps: (word.spelling ?? []).map((point) => ({
      start: letters.slice(0, point.at).join('').length,
      correct: point.correct,
    })),
  };
}

/** The right text of each gap of a problem's parts, read off the filled word or sentence. */
function gapAnswers(parts: readonly TextPart[], filled: Filled): string[] {
  const answers: string[] = [];
  let at = 0;
  for (const part of parts) {
    if (part.kind === 'text') {
      if (filled.plain.slice(at, at + part.text.length) !== part.text) {
        throw new Error(`"${part.text}" is not in "${filled.plain}" at ${at}`);
      }
      at += part.text.length;
      continue;
    }
    const gap = filled.gaps.find((g) => g.start === at);
    if (!gap) throw new Error(`no gap of "${filled.plain}" starts at ${at}`);
    answers[part.gap] = gap.correct;
    at += gap.correct.length;
  }
  return answers;
}

/** The oracle: the right answer to a problem at its current step, from the lexicon. */
export function oracle(data: ContentData, problem: Problem, step: number): AnswerValue {
  switch (problem.kind) {
    case 'gaps': {
      const filled =
        problem.sentence !== null
          ? filledSentence(data, problem.sentence)
          : filledWord(data, problem.gaps[0]!.word!);
      return { kind: 'text', value: gapAnswers(problem.parts, filled)[step]! };
    }
    case 'mistake': {
      // The right sentence beside the shown one: the first token that differs is the wrong one,
      // and the gap where they first differ is the one to fix. A token's mark follows it.
      const filled = filledSentence(data, problem.sentence);
      let at = 0;
      for (let index = 0; index < problem.tokens.length; index++) {
        const token = problem.tokens[index]!;
        const right = filled.plain.slice(at, at + token.length);
        if (right !== token) {
          if (step === 0) return { kind: 'pick', index };
          let differ = 0;
          while (token[differ] === right[differ]) differ++;
          const gap = filled.gaps.filter((g) => g.start <= at + differ).at(-1);
          if (!gap) throw new Error(`no gap in token ${token}`);
          return { kind: 'text', value: gap.correct };
        }
        at += token.length + (problem.marks?.[index]?.length ?? 0) + 1;
      }
      throw new Error(`no wrong token in ${problem.tokens.join(' ')}`);
    }
    case 'classify':
      return { kind: 'option', value: classifyAnswer(data, problem) };
    case 'odd':
      return { kind: 'pick', index: oddAnswer(data, problem) };
    case 'relation':
      return { kind: 'pick', index: relationAnswer(data, problem) };
  }
}

// ------------------------------------------------------------------------------ classifications

const wordIndexes = new WeakMap<
  ContentData,
  Map<string, ContentData['lexicon']['words'][number]>
>();
const word = (data: ContentData, id: string | null) => {
  let index = wordIndexes.get(data);
  if (index === undefined) {
    index = new Map(data.lexicon.words.map((w) => [w.id, w]));
    wordIndexes.set(data, index);
  }
  const found = id === null ? undefined : index.get(id);
  if (!found) throw new Error(`no word ${id}`);
  return found;
};

/** The sentences of a pack by their tokens' text joined with spaces (for a token in context). */
const tokenTexts = new WeakMap<ContentData, Map<string, ContentData['lexicon']['sentences']>>();
function sentencesWithTokens(data: ContentData, text: string): ContentData['lexicon']['sentences'] {
  let index = tokenTexts.get(data);
  if (index === undefined) {
    index = new Map();
    for (const s of data.lexicon.sentences) {
      if (s.tokens === undefined) continue;
      const key = s.tokens.map((t) => t.t).join(' ');
      index.set(key, [...(index.get(key) ?? []), s]);
    }
    tokenTexts.set(data, index);
  }
  return index.get(text) ?? [];
}

/** A word's value of a word dimension, read off its lexicon entry. */
function wordValue(
  data: ContentData,
  w: ContentData['lexicon']['words'][number],
  dimension: string,
) {
  const inflected = ['noun', 'adj', 'pron', 'num', 'verb'];
  const meaning: Record<string, string> = {
    noun: 'thing',
    verb: 'action',
    adj: 'property',
    adv: 'circumstance',
  };
  switch (dimension) {
    case 'pos':
      return w.pos;
    case 'inflection':
      return inflected.includes(w.pos) ? 'inflected' : 'uninflected';
    case 'meaning-class':
      return meaning[w.pos];
    case 'gender':
      return w.noun?.gender;
    case 'gender-class':
      return w.noun === undefined
        ? undefined
        : w.noun.gender === 'm'
          ? w.noun.animate
            ? 'ma'
            : 'mi'
          : w.noun.gender;
    case 'number':
      return w.noun === undefined ? undefined : w.noun.numbers === 'pl' ? 'pl' : 'sg';
    case 'pattern':
      return w.noun?.pattern ?? undefined;
    case 'register':
      return w.register ?? 'standard';
    case 'reflexive':
      return w.verb === undefined ? undefined : (w.verb.reflexive ?? 'none');
    case 'family':
      return w.family?.id;
    case 'listed': {
      // Listed words are the families with a letter; a word of no family is not one (unless a
      // vyjm point says it is: then the lexicon cannot tell).
      const family = data.lexicon.families.find((f) => f.id === w.family?.id);
      if (family !== undefined) return family.letter !== null ? 'listed' : 'not-listed';
      return (w.spelling ?? []).some((p) => p.rule === 'vyjm' || p.rule === 'vyjm-prefix')
        ? undefined
        : 'not-listed';
    }
    default:
      throw new Error(`no word oracle for ${dimension}`);
  }
}

const FORM_DIMENSIONS = ['number', 'case', 'person', 'tense', 'mood', 'verb-form', 'finiteness'];

/** The value a shown form has: a noun's from its paradigm, a verb's from the contract's forms. */
function formValue(
  data: ContentData,
  w: ContentData['lexicon']['words'][number],
  text: string,
  dimension: string,
) {
  const values = new Set<string>();
  if (w.noun?.paradigm) {
    for (const number of ['sg', 'pl'] as const) {
      (w.noun.paradigm[number] ?? []).forEach((cell, index) => {
        const texts = typeof cell === 'string' ? [cell] : [...cell];
        if (!texts.includes(text)) return;
        values.add(
          dimension === 'case' ? String(index + 1) : dimension === 'number' ? number : '?',
        );
      });
    }
  } else {
    for (const form of formCells(w)) {
      if (form.text !== text) continue;
      const value = form.values[dimension as keyof typeof form.values];
      values.add(value ?? '?');
    }
  }
  if (values.size !== 1 || values.has('?'))
    throw new Error(`"${text}" does not tell its ${dimension}`);
  return [...values][0]!;
}

function classifyAnswer(
  data: ContentData,
  problem: Extract<Problem, { kind: 'classify' }>,
): string {
  const { dimension, target, context, span } = problem;
  if (dimension === 'consonant') return CONSONANT_CLASS[target.text.toLowerCase()]!;
  if (context !== null) {
    const sentences = sentencesWithTokens(data, context.tokens.join(' '));
    const values = new Set(
      sentences.map((s) => {
        const token = s.tokens![context.at]!;
        if (dimension === 'gender') {
          return token.gender === 'ma' || token.gender === 'mi' ? 'm' : token.gender;
        }
        if (dimension === 'gender-class') return token.gender;
        const value = (token as unknown as Record<string, unknown>)[dimension];
        return value === undefined ? undefined : String(value);
      }),
    );
    // Sentences written alike must not disagree; one without the annotation does not count.
    values.delete(undefined);
    if (values.size !== 1) throw new Error('the token does not tell');
    return [...values][0]!;
  }
  if (span !== null) {
    const w = word(data, target.word);
    let at = 0;
    for (const [role, piece] of w.segments ?? []) {
      const length = [...piece].length;
      if (at === span[0] && at + length === span[1]) return role;
      at += length;
    }
    throw new Error(`no part ${span.join('-')} of ${w.lemma}`);
  }
  if (target.word === null) {
    const found = data.lexicon.sentences.filter((s) => {
      const plain = filledSentence(data, s.id).plain.trim();
      return dimension === 'sentence-kind'
        ? plain.replace(/[\s.?!…]+$/u, '') === target.text
        : plain === target.text;
    });
    const values = new Set(
      found.map((s) =>
        dimension === 'sentence-kind'
          ? s.kind
          : s.clauses === undefined
            ? undefined
            : s.clauses > 1
              ? 'compound'
              : 'simple',
      ),
    );
    values.delete(undefined);
    if (values.size !== 1) throw new Error('the sentence does not tell');
    return [...values][0]!;
  }
  const w = word(data, target.word);
  // A form's grammar from its paradigm; a word's own (a lemma's number too) from its entry.
  if (FORM_DIMENSIONS.includes(dimension) && !(dimension === 'number' && target.text === w.lemma)) {
    return formValue(data, w, target.text, dimension);
  }
  const value = wordValue(data, w, dimension);
  if (value === undefined) throw new Error(`${w.lemma} has no ${dimension}`);
  return value;
}

/** The index of the one word that differs on the basis (the others share one value). */
function oddAnswer(data: ContentData, problem: Extract<Problem, { kind: 'odd' }>): number {
  const values = problem.words.map((ref) => wordValue(data, word(data, ref.word), problem.basis));
  const odd = values.flatMap((value, index) =>
    values.filter((other) => other === value).length === 1 ? [index] : [],
  );
  const rest = new Set(values.filter((_, index) => index !== odd[0]));
  if (odd.length !== 1 || rest.size !== 1)
    throw new Error(`no single odd word: ${values.join(', ')}`);
  return odd[0]!;
}

/** The index of the one option in the relation with the shown word, from the lexicon's relations. */
function relationAnswer(
  data: ContentData,
  problem: Extract<Problem, { kind: 'relation' }>,
): number {
  const relations = data.lexicon.relations;
  const t = problem.target;
  const pair = (pairs: readonly (readonly [string, string])[], a: string, b: string) =>
    pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const side = (
    ref: string | { word: string; form: string },
    shown: { word: string | null; text: string },
  ) =>
    typeof ref === 'string'
      ? ref === shown.word && word(data, ref).lemma === shown.text
      : ref.word === shown.word && ref.form === shown.text;
  const related = (o: { word: string | null; text: string }) => {
    const a = t.word!;
    const b = o.word!;
    switch (problem.relation) {
      case 'synonym':
        return pair(relations.synonyms, a, b);
      case 'antonym':
        return pair(relations.antonyms, a, b);
      case 'general':
        return relations.hierarchies.some((h) => h.general === b && h.specific.includes(a));
      case 'specific':
        return relations.hierarchies.some((h) => h.general === a && h.specific.includes(b));
      case 'coordinate':
        return (
          a !== b &&
          relations.hierarchies.some((h) => h.specific.includes(a) && h.specific.includes(b))
        );
      case 'sound-alike':
        return relations.soundAlikes.some(
          ([x, y]) => (side(x, t) && side(y, o)) || (side(y, t) && side(x, o)),
        );
      case 'related':
        return (
          word(data, a).family?.id !== undefined &&
          word(data, a).family?.id === word(data, b).family?.id
        );
    }
  };
  const hits = problem.options.flatMap((option, index) => (related(option) ? [index] : []));
  if (hits.length !== 1) throw new Error(`${hits.length} options are in the relation`);
  return hits[0]!;
}

/** A wrong answer a child could give: another offered option or key, or a different text. */
export function wrongAnswer(data: ContentData, view: ProblemRoundView): AnswerValue {
  const current = view.problem!;
  const right = oracle(data, current.problem, current.step);
  if (right.kind === 'pick') {
    const problem = current.problem;
    const count =
      problem.kind === 'mistake'
        ? problem.tokens.length
        : problem.kind === 'odd'
          ? problem.words.length
          : problem.kind === 'relation'
            ? problem.options.length
            : 2;
    return { kind: 'pick', index: (right.index + 1) % count };
  }
  if (right.kind === 'option') {
    const options = current.problem.kind === 'classify' ? current.problem.options : [];
    return { kind: 'option', value: options.find((o) => o !== right.value) ?? 'x' };
  }
  if (right.kind !== 'text') throw new Error('no wrong answer for this answer kind');
  const gap =
    current.problem.kind === 'gaps'
      ? current.problem.gaps[current.step]!
      : current.problem.kind === 'mistake'
        ? current.problem.fix
        : null;
  const pool = gap === null ? [] : current.input === 'choice' ? gap.options : gap.keys;
  return { kind: 'text', value: pool.find((o) => o !== right.value) ?? `${right.value}x` };
}

// ------------------------------------------------------------------------------ boards

const CONSONANT_CLASS: Record<string, string> = Object.fromEntries([
  ...HARD_CONSONANTS.map((letter) => [letter, 'hard']),
  ...SOFT_CONSONANTS.map((letter) => [letter, 'soft']),
  ...BOTH_WAY_CONSONANTS.map((letter) => [letter, 'both-way']),
]);

/** The net a fish belongs in, from the lexicon (the board does not tell). */
function fishValue(
  data: ContentData,
  dimension: string,
  fish: { word: string | null; text: string },
): string | undefined {
  if (dimension === 'consonant') return CONSONANT_CLASS[fish.text.toLowerCase()];
  if (fish.word === null) return undefined;
  const w = word(data, fish.word);
  // A form (rybou, plaval jsem) from its paradigm; a word shown as its lemma from its entry.
  if (FORM_DIMENSIONS.includes(dimension) && fish.text !== w.lemma) {
    return formValue(data, w, fish.text, dimension);
  }
  return wordValue(data, w, dimension);
}

/** The index of the net a fish of a nets board belongs in (the oracle's own reading). */
export function rightNet(
  data: ContentData,
  board: Extract<BoardView, { kind: 'fishing-nets' }>,
  fish: { word: string | null; text: string },
): number {
  const value = fishValue(data, board.dimension, fish);
  const index = board.nets.findIndex((n) => n.value === value);
  if (index < 0) throw new Error(`no net for ${fish.text}`);
  return index;
}

/** Whether two memory cards make a pair of the board's kind (from the lexicon). */
function cardsPair(data: ContentData, kind: PairKind, a: CardFace, b: CardFace): boolean {
  const wordOf = (face: CardFace) =>
    face.kind === 'word' || face.kind === 'form' ? face.word : null;
  const word = (id: string | null) => data.lexicon.words.find((w) => w.id === id);
  const relations = data.lexicon.relations;
  const pair = (pairs: readonly (readonly [string, string])[]) => {
    const [x, y] = [wordOf(a), wordOf(b)];
    return pairs.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  };
  switch (kind) {
    case 'plural':
      return (
        wordOf(a) !== null &&
        wordOf(a) === wordOf(b) &&
        ((a.kind === 'word' && b.kind === 'form') || (a.kind === 'form' && b.kind === 'word'))
      );
    case 'family': {
      const family = word(wordOf(a))?.family?.id;
      return (
        family !== undefined && family === word(wordOf(b))?.family?.id && wordOf(a) !== wordOf(b)
      );
    }
    case 'pattern': {
      const pattern = (face: CardFace) =>
        face.kind === 'pattern' ? face.pattern : word(wordOf(face))?.noun?.pattern;
      return a.kind !== b.kind && pattern(a) !== undefined && pattern(a) === pattern(b);
    }
    case 'synonym':
      return pair(relations.synonyms);
    case 'antonym':
      return pair(relations.antonyms);
    case 'general': {
      const [x, y] = [wordOf(a), wordOf(b)];
      return relations.hierarchies.some(
        (h) =>
          (h.general === x && y !== null && h.specific.includes(y)) ||
          (h.general === y && x !== null && h.specific.includes(x)),
      );
    }
    case 'standard':
      return (
        (word(wordOf(a))?.standard ?? null) === wordOf(b) ||
        (word(wordOf(b))?.standard ?? null) === wordOf(a)
      );
    case 'sound-alike': {
      // A side is a word shown as its lemma, or one of its forms written out (pil of pít).
      const side = (ref: string | { word: string; form: string }, face: CardFace) =>
        (face.kind === 'word' || face.kind === 'form') &&
        (typeof ref === 'string'
          ? face.kind === 'word' && face.word === ref
          : face.word === ref.word && face.text === ref.form);
      return relations.soundAlikes.some(
        ([x, y]) => (side(x, a) && side(y, b)) || (side(y, a) && side(x, b)),
      );
    }
    default:
      throw new Error(`no memory oracle for ${kind} yet`);
  }
}

/** The right cuts and names of a word shell, from the word's segments (the oracle's own copy). */
export function shellParts(
  segments: readonly (readonly [string, string])[],
  roles: readonly string[],
): { cuts: number[]; labels: (string | null)[]; zeroEnding: boolean } {
  const parts: { length: number; role: string | null }[] = [];
  for (const [role, piece] of segments) {
    if (piece.length === 0) continue;
    const asked = roles.includes(role) ? role : null;
    const last = parts.at(-1);
    if (asked === null && last !== undefined && last.role === null)
      last.length += [...piece].length;
    else parts.push({ length: [...piece].length, role: asked });
  }
  const cuts: number[] = [];
  let at = 0;
  for (const part of parts.slice(0, -1)) cuts.push((at += part.length));
  return {
    cuts,
    labels: parts.map((p) => p.role),
    zeroEnding: roles.includes('ending') && segments.some(([r, p]) => r === 'ending' && p === ''),
  };
}

// ------------------------------------------------------------------------------ the player

export interface Recorded {
  turn: number;
  revision: number;
  type: string;
  data: unknown;
}

/** A problem step the player answered, as it was on screen. */
export interface Served {
  round: string;
  activity: string;
  index: number;
  item: string;
  step: number;
  input: string;
  reask: boolean;
  teach: boolean;
  ambush: string | null;
  /** Whether the player meant to answer right (the style's choice). */
  right: boolean;
}

/** How a scripted child plays: which answers are wrong, how fast, how boards are played. */
export interface Style {
  /** Whether the answer to the n-th step (1-based, over the whole trace) is right. */
  right(n: number, view: ProblemRoundView): boolean;
  elapsedMs(n: number, view: ProblemRoundView): number;
  /** Make one avoidable slip on each board before solving it. */
  clumsy: boolean;
}

export const PERFECT: Style = { right: () => true, elapsedMs: () => 1500, clumsy: false };

export class Player {
  readonly host: Host;
  readonly data: ContentData;
  readonly events: Recorded[] = [];
  readonly hashes: string[] = [];
  readonly failures: string[] = [];
  /** Every problem step answered, in order. */
  readonly served: Served[] = [];
  /** Answer steps so far (the n of `Style.right`). */
  answered = 0;
  turn = 0;
  private current: GameView;
  private steps = 0;

  constructor(
    readonly style: Style = PERFECT,
    seed = 'trace',
    adapter: Adapter = pearlSeaAdapter,
    pack: ContentPack<ContentData> = loadPack(),
  ) {
    this.data = pack.data;
    this.host = createRuntimeHost({ adapter, content: pack, seed });
    this.current = this.host.getView();
    this.host.subscribeCommits((commit) => {
      this.hashes.push(commit.hash);
      this.current = commit.view;
      for (const event of commit.events) {
        this.events.push({
          turn: commit.turn,
          revision: commit.revision,
          type: event.type,
          data: event.data,
        });
      }
    });
    this.host.subscribe((view, reason) => {
      if (reason === 'restore') this.current = view;
    });
  }

  /** Continue from a save (a snapshot of this pack): the view and turn follow it. */
  async restore(snapshot: RuntimeSnapshot): Promise<boolean> {
    const outcome = await this.host.restore(snapshot);
    if (!outcome.ok) {
      this.failures.push(`restore: ${outcome.error.code}`);
      return false;
    }
    this.current = this.host.getView();
    this.turn = this.current.turn;
    return true;
  }

  /** The latest committed view (read-only by convention: do not mutate it). */
  view(): GameView {
    return this.current;
  }

  state(): ProfileState {
    return this.host.inspect().state as ProfileState;
  }

  /** Let the test runner's own messages through now and then (scheduling only). */
  protected async breathe(): Promise<void> {
    if (++this.steps % 10 === 0) await new Promise((resolve) => setImmediate(resolve));
  }

  /** One traced step; a rejection is recorded as a failure (and returns false). */
  async act(action: GameAction): Promise<boolean> {
    await this.breathe();
    const turns = ACTION_TURNS[action.type];
    const trace = await runCommandTrace(this.host, [
      { action, ruleIds: [action.type], expectedTurn: this.turn + turns },
    ]);
    if (trace.failure) {
      this.failures.push(`${action.type}: ${trace.failure.error.code}`);
      return false;
    }
    this.turn += turns;
    return true;
  }

  /** A step that must be rejected with `code` (and change nothing). */
  async reject(action: GameAction, code: string): Promise<boolean> {
    const trace = await runCommandTrace(this.host, [
      { action, ruleIds: [action.type], expectError: code, expectedTurn: this.turn },
    ]);
    if (trace.failure) this.failures.push(`${action.type} (expected ${code})`);
    return trace.failure === null;
  }

  async choose(choice: string | null): Promise<boolean> {
    const story = this.view().story;
    if (story === null) return false;
    return this.act({
      type: 'storyChoice',
      beat: story.beat,
      node: story.node,
      revision: story.revision,
      choice,
    });
  }

  /** A new child's first steps: start the day, skip the prologue, read on, choose `egg`. */
  async begin(egg: string, day = '2026-11-02'): Promise<boolean> {
    const ok = (await this.act({ type: 'startSession', day })) && (await this.choose(null));
    await this.settleStory();
    return ok && (await this.act({ type: 'chooseFirstFriend', friend: egg }));
  }

  /** Skip every pending skippable beat; click through the others. */
  async settleStory(): Promise<void> {
    for (let guard = 0; guard < 30 && this.view().story !== null; guard++) {
      const story = this.view().story!;
      const next = story.choices.find((c) => c.enabled);
      if (story.skippable) await this.choose(null);
      else if (next) await this.choose(next.id);
      else break;
    }
  }

  /** The answer the style gives to the step on screen. */
  protected decide(round: ProblemRoundView): {
    value: AnswerValue;
    elapsedMs: number;
    right: boolean;
  } {
    this.answered += 1;
    const right = this.style.right(this.answered, round);
    const problem = round.problem!;
    const value = right
      ? oracle(this.data, problem.problem, problem.step)
      : wrongAnswer(this.data, round);
    return { value, elapsedMs: this.style.elapsedMs(this.answered, round), right };
  }

  /** Answer the step on screen per the style. */
  async answer(): Promise<boolean> {
    const round = this.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return false;
    const { index, item, step, input, reask, teach, ambush } = round.problem;
    const { value, elapsedMs, right } = this.decide(round);
    this.served.push({
      round: round.id,
      activity: round.activity,
      index,
      item,
      step,
      input,
      reask,
      teach,
      ambush,
      right,
    });
    const type = round.activity === 'placement' ? 'placementAnswer' : 'answer';
    return this.act({ type, value, elapsedMs });
  }

  /** Answer the step on screen right or wrong, whatever the style says. */
  async answerAs(right: boolean, elapsedMs = 2000): Promise<boolean> {
    const round = this.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) return false;
    const problem = round.problem;
    const value = right
      ? oracle(this.data, problem.problem, problem.step)
      : wrongAnswer(this.data, round);
    this.answered += 1;
    this.served.push({
      round: round.id,
      activity: round.activity,
      index: problem.index,
      item: problem.item,
      step: problem.step,
      input: problem.input,
      reask: problem.reask,
      teach: problem.teach,
      ambush: problem.ambush,
      right,
    });
    const type = round.activity === 'placement' ? 'placementAnswer' : 'answer';
    return this.act({ type, value, elapsedMs });
  }

  async move(move: MinigameMove): Promise<boolean> {
    const round = this.view().round as MinigameRoundView;
    return this.act({ type: 'minigameMove', revision: round.minigame.revision, move });
  }

  private board(): BoardView {
    return (this.view().round as MinigameRoundView).current;
  }

  /** Play the current board to completion from the typed view. */
  async playBoard(): Promise<void> {
    const round = this.view().round;
    if (round?.type !== 'minigame' || round.status !== 'active') return;
    const board = round.current;
    const start = round.board;
    const still = () => {
      const now = this.view().round;
      return now?.type === 'minigame' && now.status === 'active' && now.board === start;
    };
    if (board.kind === 'pearl-necklace') {
      if (this.style.clumsy) await this.move({ type: 'submit' });
      const sorted =
        board.order === 'alphabet'
          ? [...board.pearls].sort((a, b) => compareCzech(a.text, b.text))
          : [...board.pearls].sort((a, b) => this.rhymeOrder(a.word) - this.rhymeOrder(b.word));
      for (const [index, pearl] of sorted.entries()) {
        await this.move({ type: 'place', item: pearl.id, index });
      }
      await this.move({ type: 'submit' });
    } else if (board.kind === 'fishing-nets') {
      const net = (fish: { word: string | null; text: string }) => rightNet(this.data, board, fish);
      if (this.style.clumsy) {
        const first = board.fish[0]!;
        await this.move({ type: 'net', fish: first.id, net: (net(first) + 1) % board.nets.length });
        await this.move({ type: 'submit' });
      }
      for (const fish of board.fish)
        await this.move({ type: 'net', fish: fish.id, net: net(fish) });
      await this.move({ type: 'submit' });
    } else if (board.kind === 'memory-match') {
      const seen = new Map<string, CardFace>();
      const face = (id: string) => {
        const now = this.board();
        return now.kind === 'memory-match' ? now.cards.find((c) => c.id === id)?.face : undefined;
      };
      for (let guard = 0; guard < 200 && still(); guard++) {
        const view = this.board();
        if (view.kind !== 'memory-match') break;
        if (view.clearAvailable) {
          await this.move({ type: 'clear' });
          continue;
        }
        const hidden = view.cards.filter((c) => !c.matched && !c.faceUp).map((c) => c.id);
        const first = hidden.find((id) => !seen.has(id)) ?? hidden[0]!;
        await this.move({ type: 'select', card: first });
        const firstFace = face(first)!;
        seen.set(first, firstFace);
        const partner = [...seen.entries()].find(
          ([id, other]) =>
            id !== first &&
            hidden.includes(id) &&
            cardsPair(this.data, view.pair, firstFace, other),
        )?.[0];
        const slip = this.style.clumsy && guard === 0;
        const second =
          partner !== undefined && !slip
            ? partner
            : (hidden.find((id) => id !== first && !seen.has(id) && id !== partner) ??
              hidden.find((id) => id !== first)!);
        await this.move({ type: 'select', card: second });
        const secondFace = face(second);
        if (secondFace) seen.set(second, secondFace);
      }
    } else if (board.kind === 'word-shell') {
      const word = this.data.lexicon.words.find((w) => w.id === board.word)!;
      const target = shellParts(word.segments ?? [], board.roles);
      if (this.style.clumsy) await this.move({ type: 'submit' });
      for (const cut of target.cuts) await this.move({ type: 'cut', at: cut });
      for (const [part, role] of target.labels.entries()) {
        if (role !== null) {
          await this.move({ type: 'label', part, role: role as 'prefix' });
        }
      }
      if (target.zeroEnding) await this.move({ type: 'zero-ending', on: true });
      await this.move({ type: 'submit' });
    } else if (board.kind === 'word-family') {
      if (this.style.clumsy) await this.move({ type: 'submit' });
      for (const entry of board.words) {
        const word = this.data.lexicon.words.find((w) => w.id === entry.word);
        if (word?.family?.id === board.family) await this.move({ type: 'pick', word: entry.id });
      }
      await this.move({ type: 'submit' });
    }
  }

  private rhymeOrder(word: string): number {
    const family = this.data.lexicon.words.find((w) => w.id === word)?.family?.id;
    return this.data.lexicon.families.find((f) => f.id === family)?.order ?? 0;
  }

  /** Play the active round (problems or boards) to its end. */
  async playRound(limit = 300): Promise<void> {
    for (let guard = 0; guard < limit; guard++) {
      const round = this.view().round;
      if (round === null || round.status !== 'active') return;
      if (round.type === 'problems') {
        if (!(await this.answer())) return;
      } else {
        const before = this.hashes.length;
        await this.playBoard();
        if (this.hashes.length === before) return;
      }
    }
  }

  /** Play every activity of a level from its start, closing each finished round. */
  async playLevel(level: string): Promise<void> {
    if (!(await this.act({ type: 'startLevel', level }))) return;
    await this.settleStory();
    for (let guard = 0; guard < 10; guard++) {
      await this.playRound();
      if (this.view().round === null) return;
      await this.act({ type: 'endRound', reason: 'done' });
      await this.settleStory();
      const run = this.view().run;
      if (run === null || run.result !== null) return;
      await this.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
      await this.settleStory();
    }
  }

  count(type: string): number {
    return this.events.filter((event) => event.type === type).length;
  }

  data_(type: string): unknown[] {
    return this.events.filter((event) => event.type === type).map((event) => event.data);
  }

  async dispose(): Promise<void> {
    await this.host.dispose();
  }
}

export function trajectoryDigest(hashes: readonly string[]): string {
  return hashString(hashes.join('|'));
}
