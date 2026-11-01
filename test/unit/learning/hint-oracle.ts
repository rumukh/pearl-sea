/**
 * The examples of a hint (design §5.3), restated from the raw lexicon for the generator surveys
 * (generators.test.ts, choice-generators.test.ts), never from the rules' code. A hint teaches the
 * method on another word, never the asked word, a revealing form of it or a member of its family:
 *
 * - the problem's words are the asked word, every word of its sentence (its gaps' words and its
 *   tokens' words) and the other words of an odd-one-out set; a family is close to a problem word
 *   if it is that word's own, shares its root (`kin`) or is its sound-alike family, both ways;
 * - a word may stand as an example if it is standard, of a family close to no problem word, no
 *   problem word itself, not the asked word with an alternative in its gap, without the asked
 *   point's letters around its point (m_kk: měkkýš for měkký), with no form the problem shows,
 *   and its lemma shows no form of a close family's word nor the answer;
 * - a text (a test form, a gap's text) may be shown if it shows none of those either, and none of
 *   its words is a word the problem shows; auxiliaries and particles (budu, jsem, by, se) count
 *   as no word;
 * - candidates are content words (nouns, adjectives, verbs, adverbs), taken in this order: another
 *   deciding letter first (párové souhlásky, the prefixes' d and z; the listed letter of a related
 *   word), a test that is a form of its word first, grade 3 first, nouns, adjectives, verbs, then
 *   adverbs, then lexicon order.
 */
import { formCells, parseGappedText, textWords } from '../../../src/rules/contract';
import type {
  ContentData,
  GappedText,
  Sentence,
  SpellingPoint,
  SpellingRule,
  Word,
  WordFamily,
} from '../../../src/rules/contract';

/** What a hint is asked about. */
export interface Asked {
  word: Word | null;
  point: SpellingPoint | null;
  /** The sentence of the gap and the gap's index, or `null` for a word alone. */
  sentence: { sentence: Sentence; gap: number } | null;
  /** The other words of an odd-one-out set. */
  others?: readonly Word[];
}

const AUXILIARIES = new Set(
  'se si jsem jsi je jsme jste jsou budu budeš bude budeme budete budou bych bys by bychom byste'.split(
    ' ',
  ),
);
const WORD_RULES: readonly SpellingRule[] = [
  'velke-pismeno',
  'u-zacatek',
  'u-predpona',
  'vyjm-prefix',
  'predpona-souhlaska',
  'bje-vje',
  'mne',
];
const LETTER_RULES: readonly SpellingRule[] = ['parova', 'predpona-souhlaska'];
const POS = ['noun', 'adj', 'verb', 'adv'];

const lower = (text: string) => text.toLowerCase();
const words = (text: string) => lower(text).split(/\s+/u).filter(Boolean);

interface Lexicon {
  words: Map<string, Word>;
  order: Map<string, number>;
  families: Map<string, WordFamily>;
  /** Each family's words. */
  members: Map<string, Word[]>;
  /** Each word's forms as written, in paradigm order: lemma, form cells, paradigm cells. */
  forms: Map<string, string[]>;
  /** Each word's lower-case shapes: its forms and test forms, and their words but auxiliaries. */
  shapes: Map<string, Set<string>>;
  near: Map<string, Set<string>>;
  sentences: { sentence: Sentence; parsed: GappedText }[];
  spellings: Set<string>;
  /** The candidates of each rule (`candidatesOf`), once. */
  candidates: Map<SpellingRule, Candidate[]>;
}

const lexicons = new Map<ContentData, Lexicon>();

function lexiconOf(data: ContentData): Lexicon {
  const known = lexicons.get(data);
  if (known) return known;
  const forms = new Map<string, string[]>();
  const shapes = new Map<string, Set<string>>();
  for (const word of data.lexicon.words) {
    const list = [word.lemma, ...formCells(word).map((cell) => cell.text)];
    const verb = word.verb?.paradigm;
    const cells = [
      ...(word.noun?.paradigm?.sg ?? []),
      ...(word.noun?.paradigm?.pl ?? []),
      ...(verb
        ? [verb.inf, ...verb.pres, ...verb.imp, ...Object.values(verb.past), ...(verb.fut ?? [])]
        : []),
    ];
    for (const cell of cells) list.push(...(typeof cell === 'string' ? [cell] : cell));
    forms.set(word.id, [...new Set(list)]);
    const set = new Set<string>();
    for (const text of [
      ...list,
      ...(word.spelling ?? []).flatMap((p) => (p.test ? [p.test] : [])),
    ]) {
      set.add(lower(text));
      for (const part of words(text)) if (!AUXILIARIES.has(part)) set.add(part);
    }
    shapes.set(word.id, set);
  }
  const near = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    near.set(a, (near.get(a) ?? new Set([a])).add(b));
    near.set(b, (near.get(b) ?? new Set([b])).add(a));
  };
  for (const family of data.lexicon.families) {
    link(family.id, family.id);
    for (const kin of family.kin) link(family.id, kin);
    if (family.soundAlike) link(family.id, family.soundAlike);
  }
  const sentences: Lexicon['sentences'] = [];
  for (const sentence of data.lexicon.sentences) {
    try {
      sentences.push({ sentence, parsed: parseGappedText(sentence.text) });
    } catch {
      // An unparsable sentence is never served.
    }
  }
  const spellings = new Set<string>();
  for (const list of forms.values()) for (const text of list) spellings.add(text);
  for (const pair of data.lexicon.relations.soundAlikes) {
    for (const ref of pair) if (typeof ref !== 'string') spellings.add(ref.form);
  }
  const members = new Map<string, Word[]>();
  for (const word of data.lexicon.words) {
    if (word.family) members.set(word.family.id, [...(members.get(word.family.id) ?? []), word]);
  }
  const lexicon: Lexicon = {
    words: new Map(data.lexicon.words.map((w) => [w.id, w])),
    order: new Map(data.lexicon.words.map((w, i) => [w.id, i])),
    families: new Map(data.lexicon.families.map((f) => [f.id, f])),
    members,
    forms,
    shapes,
    near,
    sentences,
    spellings,
    candidates: new Map(),
  };
  lexicons.set(data, lexicon);
  return lexicon;
}

/** The sentence filled in right, with `text` in gap `gap`. */
function filled(parsed: GappedText, gap = -1, text = ''): { plain: string; at: number } {
  let plain = '';
  let at = -1;
  for (const part of parsed.parts) {
    if (part.kind === 'text') plain += part.text;
    else {
      if (part.gap === gap) at = plain.length;
      plain += part.gap === gap ? text : parsed.gaps[part.gap]!.correct;
    }
  }
  return { plain, at };
}

/** The answer as the problem shows it: the lemma, or the sentence's token at the gap. */
function answerOf(asked: Asked): string {
  if (asked.sentence === null) return asked.word?.lemma ?? '';
  const parsed = parseGappedText(asked.sentence.sentence.text);
  const correct = parsed.gaps[asked.sentence.gap]!.correct;
  const { plain, at } = filled(parsed, asked.sentence.gap, correct);
  const start = plain.lastIndexOf(' ', at - 1) + 1;
  const end = plain.indexOf(' ', at + correct.length);
  return plain.slice(start, end === -1 ? undefined : end).replace(/[.,!?…:;„“"]+$/u, '');
}

const respell = (word: Word, point: SpellingPoint, text: string) => {
  const letters = [...word.lemma];
  return [
    ...letters.slice(0, point.at),
    text,
    ...letters.slice(point.at + [...point.correct].length),
  ].join('');
};
const around = (word: Word, point: SpellingPoint) => {
  const letters = [...lower(word.lemma)];
  return `${letters[point.at - 1] ?? ''}_${letters[point.at + [...point.correct].length] ?? ''}`;
};

/** What the examples of `asked` must keep clear of. */
class Guard {
  readonly answer: string;
  readonly ids = new Set<string>();
  readonly texts = new Set<string>();
  readonly close = new Set<string>();
  readonly banned: Set<string>[] = [];

  constructor(
    readonly lexicon: Lexicon,
    readonly asked: Asked,
  ) {
    this.answer = lower(answerOf(asked));
    this.texts.add(this.answer);
    const problem: Word[] = [];
    const take = (id: string | null | undefined) => {
      const word = id ? lexicon.words.get(id) : undefined;
      if (word && !this.ids.has(word.id)) {
        this.ids.add(word.id);
        problem.push(word);
      }
    };
    take(asked.word?.id);
    for (const other of asked.others ?? []) {
      take(other.id);
      this.texts.add(lower(other.lemma));
    }
    const sentence = asked.sentence?.sentence;
    if (sentence) {
      for (const gap of sentence.gaps) take(gap.word);
      for (const token of sentence.tokens ?? []) {
        this.texts.add(lower(token.t));
        take(token.word);
      }
      for (const word of textWords(filled(parseGappedText(sentence.text)).plain)) {
        this.texts.add(lower(word));
      }
    }
    for (const word of problem) {
      const family = word.family?.id;
      if (family === undefined) {
        this.banned.push(lexicon.shapes.get(word.id)!);
        continue;
      }
      const set = new Set<string>();
      for (const id of lexicon.near.get(family) ?? [family]) {
        this.close.add(id);
        for (const member of lexicon.members.get(id) ?? []) {
          for (const shape of lexicon.shapes.get(member.id)!) set.add(shape);
        }
      }
      this.banned.push(set);
    }
  }

  /** Whether a text shows a banned form or the answer, whole or as a phrase of its words. */
  shows(text: string): boolean {
    const parts = words(text);
    for (let from = 0; from < parts.length; from++) {
      for (let to = from + 1; to <= parts.length; to++) {
        if (to === from + 1 && AUXILIARIES.has(parts[from]!)) continue;
        const phrase = parts.slice(from, to).join(' ');
        if (phrase === this.answer || this.banned.some((set) => set.has(phrase))) return true;
      }
    }
    return false;
  }

  fitText(text: string): boolean {
    return !this.shows(text) && !words(text).some((w) => !AUXILIARIES.has(w) && this.texts.has(w));
  }

  fitWord(word: Word, point: SpellingPoint | null): boolean {
    const { word: asked, point: askedPoint } = this.asked;
    if (word.register === 'colloquial' || this.ids.has(word.id)) return false;
    if (word.family && this.close.has(word.family.id)) return false;
    if (asked && askedPoint) {
      if (
        askedPoint.alt.some((alt) => lower(respell(asked, askedPoint, alt)) === lower(word.lemma))
      ) {
        return false;
      }
      if (point && around(word, point) === around(asked, askedPoint)) return false;
    }
    for (const shape of this.lexicon.shapes.get(word.id)!) if (this.texts.has(shape)) return false;
    return !this.shows(word.lemma);
  }
}

interface Candidate {
  word: Word;
  point: SpellingPoint;
  order: number;
}

/** The content words with a point of `rule` (their first one), in lexicon order. */
function candidatesOf(lexicon: Lexicon, rule: SpellingRule): Candidate[] {
  let list = lexicon.candidates.get(rule);
  if (list === undefined) {
    list = [...lexicon.words.values()].flatMap((word) => {
      const point = (word.spelling ?? []).find((p) => p.rule === rule);
      return point && POS.includes(word.pos)
        ? [{ word, point, order: lexicon.order.get(word.id)! }]
        : [];
    });
    lexicon.candidates.set(rule, list);
  }
  return list;
}

/** Sorted by each key in turn (lower first), then lexicon order. */
function sortBy<T extends Candidate>(list: T[], ...keys: ((c: T) => number)[]): T[] {
  return [...list].sort((a, b) => {
    for (const key of keys) if (key(a) !== key(b)) return key(a) - key(b);
    return a.order - b.order;
  });
}
const grade = (c: Candidate) => (c.word.grade === 3 ? 0 : 1);
const pos = (c: Candidate) => POS.indexOf(c.word.pos);

/** The examples of a rule line, or `[]` for the rule line alone. */
export function expectedRuleExamples(
  data: ContentData,
  rule: SpellingRule,
  asked: Asked,
): string[] {
  const lexicon = lexiconOf(data);
  const guard = new Guard(lexicon, asked);
  const letter = LETTER_RULES.includes(rule) && asked.point ? lower(asked.point.correct) : null;
  const sameLetter = (c: Candidate) =>
    letter !== null && lower(c.point.correct) === letter ? 1 : 0;
  const ranked = () => sortBy(candidatesOf(lexicon, rule), sameLetter, grade, pos);
  if (WORD_RULES.includes(rule)) {
    const picked: string[] = [];
    const families = new Set<string>();
    for (const { word, point } of ranked()) {
      const family = word.family?.id ?? word.id;
      if (picked.length === 2 || families.has(family) || picked.includes(word.lemma)) continue;
      if (!guard.fitWord(word, point)) continue;
      picked.push(word.lemma);
      families.add(family);
    }
    return picked;
  }
  if (rule === 'obojetna-i') {
    for (const { word, point } of ranked()) {
      if (!guard.fitWord(word, point)) continue;
      for (const alt of point.alt) {
        const twin = respell(word, point, alt);
        if (twin !== word.lemma && lexicon.spellings.has(twin) && guard.fitText(twin)) {
          return [twin, word.lemma];
        }
      }
    }
    return [];
  }
  // Gaps of other sentences of the rule, in lexicon order.
  const gaps = lexicon.sentences.flatMap(({ sentence, parsed }) =>
    sentence.gaps.flatMap((gap, index) =>
      gap.rule === rule && parsed.gaps[index] && sentence.id !== asked.sentence?.sentence.id
        ? [{ gap, written: parsed.gaps[index]! }]
        : [],
    ),
  );
  const fit = ({ gap, written }: (typeof gaps)[number]) => {
    const word = gap.word === null ? undefined : lexicon.words.get(gap.word);
    const point = word?.spelling?.find((p) => p.at === gap.point) ?? null;
    return (word === undefined || guard.fitWord(word, point)) && guard.fitText(written.correct);
  };
  if (rule === 'predpona-predlozka') {
    const together = gaps.find((g) => !g.written.correct.includes(' ') && fit(g));
    const apart = gaps.find((g) => g.written.correct.includes(' ') && fit(g));
    return together && apart ? [together.written.correct, apart.written.correct] : [];
  }
  if (rule === 'spisovne') {
    for (const g of gaps) {
      const colloquial = g.written.alternatives[0];
      if (colloquial !== undefined && fit(g) && guard.fitText(colloquial)) {
        return [g.written.correct, colloquial];
      }
    }
  }
  return [];
}

/** The test-word example of `parova` or `u-uprostred`, or `null` for the rule line alone. */
export function expectedTestWord(
  data: ContentData,
  rule: 'parova' | 'u-uprostred',
  asked: Asked,
): { word: string; test: string } | null {
  const lexicon = lexiconOf(data);
  const guard = new Guard(lexicon, asked);
  const letter = rule === 'parova' && asked.point ? lower(asked.point.correct) : null;
  const withTests = candidatesOf(lexicon, rule).flatMap((c) => {
    // u-uprostred without a test: the first form with o in the place of ů (dům → domu).
    const prefix = [...c.word.lemma].slice(0, c.point.at).join('');
    const alternation = lexicon.forms
      .get(c.word.id)!
      .find(
        (form) =>
          form !== c.word.lemma &&
          !form.includes(' ') &&
          [...form][c.point.at] === 'o' &&
          [...form].slice(0, c.point.at).join('') === prefix,
      );
    const test = c.point.test ?? (rule === 'u-uprostred' ? alternation : undefined);
    return test === undefined ? [] : [{ ...c, test }];
  });
  const ranked = sortBy(
    withTests,
    (c) => (letter !== null && lower(c.point.correct) === letter ? 1 : 0),
    (c) => (lexicon.forms.get(c.word.id)!.includes(c.test) ? 0 : 1),
    grade,
    pos,
  );
  const found = ranked.find((c) => guard.fitWord(c.word, c.point) && guard.fitText(c.test));
  return found ? { word: found.word.id, test: found.test } : null;
}

/**
 * The related-word example (`vyjm`, an odd-one-out set on the listed basis): a related word of a
 * listed family and its listed word, of another letter than the asked word's family first.
 */
export function expectedFamily(
  data: ContentData,
  asked: Asked,
): { word: string; related: string } | null {
  const lexicon = lexiconOf(data);
  const guard = new Guard(lexicon, asked);
  const own = asked.word?.family ? lexicon.families.get(asked.word.family.id) : undefined;
  const related = candidatesOf(lexicon, 'vyjm').flatMap((c) => {
    const family = c.word.family ? lexicon.families.get(c.word.family.id) : undefined;
    const head = family ? lexicon.words.get(family.head) : undefined;
    return family && family.letter !== null && head && head.id !== c.word.id
      ? [{ ...c, family, head }]
      : [];
  });
  const ranked = sortBy(
    related,
    (c) => (own && c.family.letter === own.letter ? 1 : 0),
    grade,
    pos,
  );
  const found = ranked.find((c) => guard.fitWord(c.word, c.point) && guard.fitWord(c.head, null));
  return found ? { word: found.word.id, related: found.head.id } : null;
}
