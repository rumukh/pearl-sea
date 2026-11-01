/**
 * Problem generation: the dispatch over the problem generators of the contract (docs/learning.md).
 *
 * `problemFor(skill, item, sources)` makes a problem that practises `item` through `skill`: the
 * shape and the carrying sentence from the `problems` stream, options from `distractors` and
 * companion words from `words`. Every problem it emits has exactly one expected answer per step
 * and stays inside the skill's parameters and the bounds of docs/curriculum.md §7.
 *
 * Not every item of a skill's universe can be served: a point that is ambiguous bare needs a
 * sentence (generators/spell.ts). `servableItems` is the part of a skill's universe its
 * generator can really serve; rounds draw only from it.
 */
import type { DeepReadonly } from '@aegis/runtime';
import type { GeneratorId, Problem, Skill } from '../contract';
import { isBoardGenerator, itemIndex, perPack } from './index-cache';
import {
  sentencesFor,
  spellMistakeProblem,
  spellSentenceProblem,
  spellServable,
  spellWordProblem,
} from './generators/spell';
import type { SpellRequest } from './generators/spell';
import { classifyProblem, classifyServable } from './generators/classify';
import { oddProblem, oddServable } from './generators/odd';
import { relationProblem, relationServable } from './generators/relation';
import type { GeneratorSources } from './generators/shared';
import type { Data } from '../types';

export type { GeneratorSources } from './generators/shared';
export type { SpellRequest as ProblemRequest } from './generators/spell';

/** The problem generators this build implements. */
export const PROBLEM_GENERATORS: readonly GeneratorId[] = [
  'spell.word',
  'spell.sentence',
  'spell.mistake',
  'classify',
  'odd-one-out',
  'relation',
];

/** Whether this build can make single problems for the skill (boards are minigames.ts's). */
export function canGenerate(skill: DeepReadonly<Skill>): boolean {
  return PROBLEM_GENERATORS.includes(skill.generator) && !isBoardGenerator(skill.generator);
}

/**
 * Whether `skill` can serve `item` (an item of its universe) as a problem; any skill, also one
 * outside the pack (`servableIndex` covers the pack's own).
 */
export function canServe(data: Data, skill: DeepReadonly<Skill>, item: string): boolean {
  switch (skill.generator) {
    case 'spell.word':
      return spellServable(data, item);
    case 'spell.sentence':
    case 'spell.mistake':
      return sentencesFor(data, item, skill.params.sentences, skill.params.rules).length > 0;
    case 'classify':
      return classifyServable(data, skill.params, item);
    case 'odd-one-out':
      return oddServable(data, skill, item);
    case 'relation':
      return relationServable(data, skill, item);
    default:
      return false;
  }
}

/** Each problem skill's servable items (sorted), by skill ID. */
export const servableIndex: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack(
  (data) => {
    const index = itemIndex(data);
    const result = new Map<string, readonly string[]>();
    for (const skill of data.skills) {
      if (!canGenerate(skill)) continue;
      result.set(
        skill.id,
        (index.get(skill.id) ?? []).filter((item) => canServe(data, skill, item)),
      );
    }
    return result;
  },
);

/**
 * Items of a skill's universe its generator cannot serve, by skill: content that can never be
 * asked (the real pack has none; test/unit/learning).
 */
export function unservableItems(data: Data): { skill: string; items: string[] }[] {
  const index = itemIndex(data);
  const served = servableIndex(data);
  return data.skills
    .filter((skill) => canGenerate(skill))
    .map((skill) => {
      const ok = new Set(served.get(skill.id) ?? []);
      return { skill: skill.id, items: (index.get(skill.id) ?? []).filter((i) => !ok.has(i)) };
    })
    .filter((entry) => entry.items.length > 0);
}

/**
 * The problem that practises `item` through `skill`. Throws when the skill can never produce the
 * item (an item outside `servableIndex`, or invalid content).
 */
export function problemFor(
  skill: DeepReadonly<Skill>,
  item: string,
  sources: GeneratorSources,
  request: SpellRequest = {},
): Problem {
  switch (skill.generator) {
    case 'spell.word':
      return spellWordProblem(skill.params, item, sources, request);
    case 'spell.sentence':
      return spellSentenceProblem(skill.params, item, sources, request);
    case 'spell.mistake':
      // A re-ask of a hunted mistake asks the word alone where possible (design §6.4).
      return request.alone
        ? spellSentenceProblem(skill.params, item, sources, { ...request, single: true })
        : spellMistakeProblem(skill.params, item, sources);
    case 'classify':
      return classifyProblem(skill.params, item, sources);
    case 'odd-one-out':
      return oddProblem(skill, item, sources);
    case 'relation':
      return relationProblem(skill, item, sources);
    default:
      throw new Error(`Generator ${skill.generator} makes no single problems in this build.`);
  }
}
