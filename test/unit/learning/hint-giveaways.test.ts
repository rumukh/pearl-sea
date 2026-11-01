/**
 * No hint gives the answer away (design §5.3; the rule set after S6's Nápověda baseline in
 * docs/qa/defects.md): a hint teaches the method on another word, never the asked word, a
 * revealing form of it or a member of its family. Every problem the three packs serve is made
 * (each problem skill, servable item and round request), and the hint of each step is rendered as
 * the child reads it: the shell's `hintText` with the game's catalogs. No line may show the answer
 * as the problem writes it, nor a form or test form of a word the problem asks (a gap's word, the
 * fix's, the words of a set or a relation, the word to classify), of its family, of a family
 * sharing its root or of its sound-alike family. Every hint must render, so none is lost to a
 * missing line. The words are read from the raw lexicon and the problem, never from the rules.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createContentText } from '../../../src/app/content/text';
import type { ContentText } from '../../../src/app/content/text';
import { createTranslator } from '../../../src/app/i18n/messages';
import { hintText, stepHint } from '../../../src/app/screens/problem-view';
import { formCells, problemSteps } from '../../../src/rules/contract';
import type { ContentData, Hint, Problem, Word } from '../../../src/rules/contract';
import { canGenerate, problemFor, servableIndex } from '../../../src/rules/learning/generate';
import type { ProblemRequest } from '../../../src/rules/learning/generate';
import { lagoonPack, miniPack, realPack } from '../../fixtures/rules/packs';

const root = join(import.meta.dirname, '..', '..', '..');
const catalog = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(join(root, 'content', 'catalogs', name), 'utf8'));
const t = createTranslator();
const gameText = createContentText({ cs: catalog('cs.content.json'), en: {} });

const PACKS = [
  ['lagoon', lagoonPack().data],
  ['mini', miniPack().data],
  ['real', realPack().data],
] as const;
const REQUESTS: readonly ProblemRequest[] = [{}, { single: true }, { alone: true }];
const SEEDS = ['tide', 'reef'];
/**
 * The function words of a compound form or a reflexive lemma (budu plavat, plaval jsem, bát se):
 * not the word itself.
 */
const AUXILIARIES = new Set(
  'se si jsem jsi je jsme jste jsou budu budeš bude budeme budete budou bych bys by bychom byste'.split(
    ' ',
  ),
);

// ---------------------------------------------------------------- the raw lexicon

interface Raw {
  words: Map<string, Word>;
  /** Lower-case forms no hint may show for each asked word (and its words, without particles). */
  banned: Map<string, Set<string>>;
}

const raws = new Map<ContentData, Raw>();

function rawOf(data: ContentData): Raw {
  const known = raws.get(data);
  if (known) return known;
  const words = new Map(data.lexicon.words.map((w) => [w.id, w as Word]));
  const own = new Map<string, Set<string>>();
  const add = (set: Set<string>, text: string) => {
    const lower = text.toLowerCase();
    set.add(lower);
    for (const part of lower.split(/\s+/u)) if (part && !AUXILIARIES.has(part)) set.add(part);
  };
  for (const word of data.lexicon.words) {
    const set = new Set<string>();
    add(set, word.lemma);
    for (const cell of formCells(word)) add(set, cell.text);
    for (const point of word.spelling ?? []) if (point.test) add(set, point.test);
    own.set(word.id, set);
  }
  for (const pair of data.lexicon.relations.soundAlikes) {
    for (const ref of pair) if (typeof ref !== 'string') add(own.get(ref.word)!, ref.form);
  }
  // A family's close families: itself, those sharing its root (kin), its sound-alike family.
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
  const banned = new Map<string, Set<string>>();
  for (const word of data.lexicon.words) {
    const family = word.family?.id;
    const set = new Set(own.get(word.id));
    if (family !== undefined) {
      for (const other of data.lexicon.words) {
        if (other.family && near.get(family)?.has(other.family.id)) {
          for (const text of own.get(other.id)!) set.add(text);
        }
      }
    }
    banned.set(word.id, set);
  }
  const raw = { words, banned };
  raws.set(data, raw);
  return raw;
}

// ---------------------------------------------------------------- what a problem asks

/** The texts no hint of the problem may show: its answers as written, its asked words' forms. */
function forbiddenOf(data: ContentData, problem: Problem): Set<string> {
  const { banned } = rawOf(data);
  const out = new Set<string>();
  const ask = (word: string | null) => {
    for (const text of (word === null ? undefined : banned.get(word)) ?? []) out.add(text);
  };
  const show = (text: string) => {
    const bare = text.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();
    if (bare) out.add(bare);
  };
  switch (problem.kind) {
    case 'gaps': {
      // Each gap's word as the problem writes it filled in: the word alone, or its token.
      let filled = '';
      const spans: [number, number][] = [];
      for (const part of problem.parts) {
        if (part.kind === 'text') filled += part.text;
        else {
          const correct = problem.gaps[part.gap]!.correct;
          spans[part.gap] = [filled.length, filled.length + correct.length];
          filled += correct;
        }
      }
      problem.gaps.forEach((gap, index) => {
        ask(gap.word);
        const [start, end] = spans[index]!;
        const from = filled.lastIndexOf(' ', start - 1) + 1;
        const to = filled.indexOf(' ', end);
        show(filled.slice(from, to === -1 ? undefined : to));
      });
      break;
    }
    case 'mistake':
      ask(problem.fix.word);
      show(`${problem.around[0]}${problem.fix.correct}${problem.around[1]}`);
      break;
    case 'classify':
      ask(problem.target.word);
      if (problem.target.word !== null) show(problem.target.text);
      break;
    case 'odd':
      for (const ref of problem.words) {
        ask(ref.word);
        show(ref.text);
      }
      break;
    case 'relation':
      for (const ref of [problem.target, ...problem.options]) {
        ask(ref.word);
        show(ref.text);
      }
      break;
  }
  return out;
}

/** The forbidden texts a line shows: its words and phrases of up to three words, as written. */
function shown(line: string, forbidden: ReadonlySet<string>): string[] {
  const words = line.toLowerCase().match(/[\p{L}_]+/gu) ?? [];
  const found = new Set<string>();
  for (let from = 0; from < words.length; from++) {
    for (let to = from + 1; to <= Math.min(words.length, from + 3); to++) {
      if (to === from + 1 && AUXILIARIES.has(words[from]!)) continue;
      const phrase = words.slice(from, to).join(' ');
      if (forbidden.has(phrase)) found.add(phrase);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------- every served problem

interface Shown {
  pack: string;
  where: string;
  problem: Problem;
  hint: Hint;
  line: string | null;
}

/** Every hint of every step of every problem a pack serves, rendered. */
function hintsOf(pack: string, data: ContentData, text: ContentText = gameText): Shown[] {
  const lexicon = rawOf(data).words;
  const lemmaOf = (id: string) => lexicon.get(id)?.lemma ?? null;
  const served = servableIndex(data);
  const out: Shown[] = [];
  for (const skill of data.skills) {
    if (!canGenerate(skill)) continue;
    const requests = skill.generator.startsWith('spell.') ? REQUESTS : REQUESTS.slice(0, 1);
    for (const request of requests) {
      for (const seed of SEEDS) {
        const key = `${seed}:${skill.id}:${JSON.stringify(request)}`;
        const streams = {
          problems: createPrng(`${key}:problems`),
          distractors: createPrng(`${key}:distractors`),
          words: createPrng(`${key}:words`),
          data,
          choices: 4,
        };
        for (const item of served.get(skill.id) ?? []) {
          const problem = problemFor(skill, item, streams, request);
          for (let step = 0; step < problemSteps(problem); step++) {
            const hint = stepHint(problem, step);
            if (hint === null) continue;
            out.push({
              pack,
              where: `${skill.id} ${item} ${JSON.stringify(request)} ${seed} step ${step}`,
              problem,
              hint,
              line: hintText(hint, t, text, lemmaOf),
            });
          }
        }
      }
    }
  }
  return out;
}

let all: Shown[] | undefined;
const everyHint = () => (all ??= PACKS.flatMap(([pack, data]) => hintsOf(pack, data)));

/** The lines that show what their problem asks, as `pack where: "line" shows …`. */
function giveaways(list: readonly Shown[]): string[] {
  const data = new Map<string, ContentData>(PACKS);
  return list.flatMap((h) => {
    if (h.line === null) return [];
    const found = shown(h.line, forbiddenOf(data.get(h.pack)!, h.problem));
    return found.length === 0 ? [] : [`${h.pack} ${h.where}: "${h.line}" shows ${found}`];
  });
}

const first = (list: readonly string[]) =>
  list.length > 8 ? [...list.slice(0, 8), `… ${list.length} in all`] : list;

const PACKS_BY_NAME = new Map<string, ContentData>(PACKS);
const idSets = new Map<ContentData, Set<string>>();

/** The lexicon word IDs a line shows: IDs that are no written word of the pack (byyk, mlyyn). */
function idsIn(data: ContentData, line: string): string[] {
  let ids = idSets.get(data);
  if (ids === undefined) {
    const written = new Set([...rawOf(data).banned.values()].flatMap((set) => [...set]));
    ids = new Set(data.lexicon.words.map((w) => w.id).filter((id) => !written.has(id)));
    idSets.set(data, ids);
  }
  const tokens = line.toLowerCase().match(/[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?/gu) ?? [];
  return tokens.filter((token) => ids.has(token));
}

describe('hints as the child reads them', () => {
  it('never show the answer, nor a form of an asked word, its family, its kin or its sound-alikes', () => {
    expect(first(giveaways(everyHint()))).toEqual([]);
  });

  it('all render: no hint is lost to a missing line or word', () => {
    const lost = everyHint()
      .filter((h) => h.line === null)
      .map((h) => `${h.pack} ${h.where}: ${JSON.stringify(h.hint)}`);
    expect(first(lost)).toEqual([]);
  });

  it('name every word as written, never by its lexicon ID (PS-QA-22: Pomůže příbuzné slovo: byyk.)', () => {
    const named = everyHint().flatMap((h) => {
      const found = h.line === null ? [] : idsIn(PACKS_BY_NAME.get(h.pack)!, h.line);
      return found.length === 0 ? [] : [`${h.pack} ${h.where}: "${h.line}" shows ${found}`];
    });
    expect(first(named)).toEqual([]);
    // The check sees the line main's shell printed for býček.
    expect(idsIn(realPack().data, 'Pomůže příbuzné slovo: byyk.')).toEqual(['byyk']);
  });

  it('teach by example where they can: examples of other words in every kind', () => {
    // Not vacuous: the game's hints give examples for the related listed words, the test forms
    // and the rule lines, and the survey sees thousands of hints.
    const real = everyHint().filter((h) => h.pack === 'real');
    const kinds = new Set(
      real.map((h) =>
        h.hint.kind === 'rule' ? `rule${h.hint.examples ? ' with examples' : ''}` : h.hint.kind,
      ),
    );
    expect([...kinds]).toEqual(
      expect.arrayContaining([
        'family',
        'test-word',
        'rule',
        'rule with examples',
        'not-listed',
        'ten-ta-to',
        'method',
      ]),
    );
    expect(real.length).toBeGreaterThan(2000);
  });
});

describe('the check', () => {
  it('catches the giveaways S6 measured: the names rule, dům – domy, a test word of the asked word', () => {
    // docs/qa/defects.md: the rule lines listed their examples, and the test word was the asked
    // word's own. Rendered with those lines, the hints of the same problems are caught.
    const real = realPack().data;
    const old = createContentText({
      cs: {
        ...catalog('cs.content.json'),
        'grammar.rule.velke-pismeno':
          'Vlastní jména píšeme s velkým písmenem: Petr, Alík, Praha, Vltava.',
        'grammar.rule.u-uprostred':
          'Uprostřed a na konci slova píšeme ů s kroužkem. Často se střídá s o: dům – domy.',
      },
      en: {},
    });
    const lemmaOf = (id: string) => rawOf(real).words.get(id)?.lemma ?? null;
    /** The first point of a word, asked alone. */
    const asked = (word: string): Problem => {
      const entry = rawOf(real).words.get(word)!;
      const point = entry.spelling![0]!;
      const letters = [...entry.lemma];
      const before = letters.slice(0, point.at).join('');
      const after = letters.slice(point.at + [...point.correct].length).join('');
      return {
        kind: 'gaps',
        sentence: null,
        parts: [
          ...(before ? [{ kind: 'text' as const, text: before }] : []),
          { kind: 'gap', gap: 0 },
          ...(after ? [{ kind: 'text' as const, text: after }] : []),
        ],
        gaps: [
          {
            correct: point.correct,
            options: [point.correct, ...point.alt],
            keys: [point.correct, ...point.alt],
            rule: point.rule,
            word,
            item: `spell:${word}:${point.at}`,
            hint: null,
          },
        ],
      };
    };
    const caught = (problem: Problem, hint: Hint, text: ContentText = gameText) =>
      shown(hintText(hint, t, text, lemmaOf)!, forbiddenOf(real, problem));
    expect(caught(asked('petr'), { kind: 'rule', rule: 'velke-pismeno' }, old)).toEqual(['petr']);
    expect(caught(asked('duom'), { kind: 'rule', rule: 'u-uprostred' }, old)).toEqual(
      expect.arrayContaining(['dům', 'domy']),
    );
    expect(caught(asked('dub'), { kind: 'test-word', word: 'dub', test: 'duby' })).toEqual(
      expect.arrayContaining(['dub', 'duby']),
    );
    // A related word's own family: mlynář asked, mlýn shown.
    expect(
      caught(asked('mlynaarx'), { kind: 'family', word: 'mlynaarx', related: 'mlyyn' }),
    ).toEqual(expect.arrayContaining(['mlynář', 'mlýn']));
    // The game's lines name no word: the same rules pass bare.
    expect(caught(asked('petr'), { kind: 'rule', rule: 'velke-pismeno' })).toEqual([]);
    expect(caught(asked('duom'), { kind: 'rule', rule: 'u-uprostred' })).toEqual([]);
  });
});
