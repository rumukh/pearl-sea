/**
 * Skills: each generator's item universe on the fixture lexicon (what the Leitner boxes may
 * track), and the cross-field checks of skill parameters.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONSONANT_IDS,
  CONTEXT_DIMENSIONS,
  DIMENSIONS,
  canonicalItem,
  isRegisterSkill,
  skillItems,
  skillSchema,
  wordFilterSchema,
} from '../../../src/rules/contract';
import type { Lexicon, Skill, SkillSpec } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const lexicon: Lexicon = JSON.parse(
  readFileSync(join(root, 'test', 'fixtures', 'contract', 'mini-pack.json'), 'utf8'),
).data.lexicon;

const items = (spec: SkillSpec) =>
  skillItems(
    { id: 'sk.test', titleKey: 'skill.test', strand: 'letters-sounds', ...spec } as Skill,
    lexicon,
  );

describe('skill items', () => {
  it('spell.word: the spelling points of the selected rules and words', () => {
    expect(
      items({
        generator: 'spell.word',
        params: { words: {}, rules: ['tvrda', 'mekka'], maxGaps: 1, choices: 2 },
      }),
    ).toEqual(['spell:ryba:1', 'spell:velkyy:4']);
    expect(
      items({
        generator: 'spell.word',
        params: { words: { letters: ['l'] }, rules: ['vyjm'], maxGaps: 1, choices: 4 },
      }),
    ).toEqual(['spell:mlynaarx:2', 'spell:mlyyn:2']);
  });

  it('spell.sentence: a gap on a word’s spelling point trains that point; other gaps their own item', () => {
    expect(
      items({ generator: 'spell.sentence', params: { sentences: {}, rules: ['shoda'] } }),
    ).toEqual(['gap:s.ryby-1:0']);
    expect(
      items({ generator: 'spell.mistake', params: { sentences: {}, rules: ['spisovne'] } }),
    ).toEqual(['gap:s.mlyn-2:0']);
    expect(
      items({
        generator: 'spell.mistake',
        params: { sentences: { grades: [3] }, rules: ['vyjm'] },
      }),
    ).toEqual(['spell:mlyyn:2']);
  });

  it('classify: words, consonant letters, word parts, forms, tokens and whole sentences', () => {
    const classify = (
      dimension: string,
      context: string,
      values: string[] | null = null,
      words = {},
      cells: string[] | null = null,
    ) =>
      items({
        generator: 'classify',
        params: { dimension, context, words, sentences: {}, values, cells },
      } as SkillSpec);
    expect(classify('gender', 'word', ['f'])).toEqual(['class:gender:ryba', 'class:gender:vltava']);
    expect(classify('gender-class', 'word', ['ma'])).toEqual([
      'class:gender-class:mlynaarx',
      'class:gender-class:pes',
    ]);
    expect(classify('gender', 'sentence', ['m'])).toEqual([
      'class:gender:s.mlyn-1:0',
      'class:gender:s.ryby-1:3',
    ]);
    expect(classify('reflexive', 'word', ['none'])).toEqual([
      'class:reflexive:biit',
      'class:reflexive:byyt',
      'class:reflexive:vyletext',
    ]);
    expect(
      classify('register', 'word', null, {
        topics: ['spisovnost'],
        registers: ['standard', 'colloquial'],
      }),
    ).toEqual([
      'class:register:bejt',
      'class:register:dobrej',
      'class:register:dobryy',
      'class:register:mlejn',
    ]);
    expect(classify('pos', 'word', null, { topics: ['spisovnost'] })).toEqual(['class:pos:dobryy']);
    expect(
      classify('person', 'form', ['1'], { aspects: ['impf'] }, ['pres', 'past', 'fut']),
    ).toEqual([
      'class:person:biit:fut1',
      'class:person:biit:fut4',
      'class:person:biit:past1',
      'class:person:biit:past4',
      'class:person:biit:pres1',
      'class:person:biit:pres4',
      'class:person:byyt:fut1',
      'class:person:byyt:fut4',
      'class:person:byyt:past1',
      'class:person:byyt:past4',
      'class:person:byyt:pres1',
      'class:person:byyt:pres4',
    ]);
    expect(classify('consonant', 'word', ['hard'])).toEqual(
      ['h', 'ch', 'k', 'r', 'd', 't', 'n'].map((letter) => `class:consonant:${letter}`).sort(),
    );
    expect(classify('segment', 'word', ['prefix'])).toEqual(['class:segment:vyletext:0']);
    expect(classify('verb-form', 'form', ['compound'], { words: ['byyt'] })).toEqual([
      'class:verb-form:byyt:cond1',
      'class:verb-form:byyt:cond2',
      'class:verb-form:byyt:cond3',
      'class:verb-form:byyt:cond4',
      'class:verb-form:byyt:cond5',
      'class:verb-form:byyt:cond6',
      'class:verb-form:byyt:past1',
      'class:verb-form:byyt:past2',
      'class:verb-form:byyt:past4',
      'class:verb-form:byyt:past5',
    ]);
    expect(classify('case', 'sentence')).toEqual([
      'class:case:s.mlyn-1:0',
      'class:case:s.mlyn-1:3',
      'class:case:s.ryby-1:0',
      'class:case:s.ryby-1:3',
    ]);
    expect(classify('sentence-kind', 'sentence')).toEqual([
      'class:sentence-kind:s.mlyn-1',
      'class:sentence-kind:s.ryby-1',
    ]);
  });

  it('consonant skills: all 24 letters, or only the listed ones', () => {
    expect([...CONSONANT_IDS]).toEqual(
      'h ch k r d t n zx sx cx rx c j dx tx nx b f l m p s v z'.split(' '),
    );
    const consonantItems = (ids: string) => ids.split(' ').map((id) => `class:consonant:${id}`);
    expect(
      items({
        generator: 'classify',
        params: {
          dimension: 'consonant',
          context: 'word',
          words: {},
          sentences: {},
          values: null,
          cells: null,
        },
      }),
    ).toHaveLength(24);
    expect(
      items({
        generator: 'classify',
        params: {
          dimension: 'consonant',
          context: 'word',
          words: {},
          sentences: {},
          values: ['hard', 'soft', 'both-way'],
          cells: null,
          consonants: ['h', 'ch', 'k', 'r', 'd', 't', 'n'],
        },
      }),
    ).toEqual(consonantItems('ch d h k n r t'));
    expect(
      items({
        generator: 'sort',
        params: {
          dimension: 'consonant',
          context: 'word',
          values: ['hard', 'soft'],
          words: {},
          fish: 6,
          cells: null,
          consonants: ['zx', 'sx', 'cx', 'h'],
        },
      }),
    ).toEqual(consonantItems('cx h sx zx'));
  });

  it('odd-one-out, relation, alphabet, pairs, sort, segment and family', () => {
    expect(
      items({ generator: 'odd-one-out', params: { basis: 'listed', words: {}, size: 4 } }),
    ).toEqual(['fam:biit', 'fam:byyt', 'fam:mlynaarx', 'fam:mlyyn']);
    expect(
      items({ generator: 'relation', params: { relations: ['antonym', 'general'], words: {} } }),
    ).toEqual(['rel:antonym:malyy', 'rel:antonym:velkyy', 'rel:general:zviirxe']);
    const withForms: Lexicon = {
      ...lexicon,
      relations: {
        ...lexicon.relations,
        soundAlikes: [
          ...lexicon.relations.soundAlikes,
          [
            { word: 'byyt', form: 'byl' },
            { word: 'biit', form: 'bil' },
          ],
        ],
      },
    };
    expect(
      skillItems(
        {
          id: 'sk.sound',
          titleKey: 'skill.sound',
          strand: 'listed-words',
          generator: 'pairs',
          params: { pair: 'sound-alike', words: { words: ['biit', 'byyt'] }, pairs: 3 },
        },
        withForms,
      ),
    ).toEqual([
      'pair:sound-alike:biit',
      'pair:sound-alike:biit:bil',
      'pair:sound-alike:byyt',
      'pair:sound-alike:byyt:byl',
    ]);
    expect(
      items({
        generator: 'alphabet',
        params: { words: { pos: ['adj'] }, order: 'alphabet', size: 3 },
      }),
    ).toEqual(['abc:dobryy', 'abc:malyy', 'abc:velkyy']);
    expect(
      items({
        generator: 'pairs',
        params: { pair: 'standard', words: { registers: ['colloquial'] }, pairs: 3 },
      }),
    ).toEqual(['pair:standard:bejt', 'pair:standard:dobrej', 'pair:standard:mlejn']);
    expect(items({ generator: 'pairs', params: { pair: 'plural', words: {}, pairs: 4 } })).toEqual(
      ['mlyyn', 'mlynaarx', 'ryba', 'pes', 'zviirxe'].map((word) => `pair:plural:${word}`).sort(),
    );
    expect(
      items({
        generator: 'sort',
        params: {
          dimension: 'gender',
          context: 'word',
          values: ['f', 'n'],
          words: {},
          fish: 6,
          cells: null,
        },
      }),
    ).toEqual(['class:gender:ryba', 'class:gender:vltava', 'class:gender:zviirxe']);
    const tenseNets = (cells: ('pres' | 'past')[] | null) =>
      items({
        generator: 'sort',
        params: {
          dimension: 'tense',
          context: 'form',
          values: ['past', 'future'],
          words: { words: ['vyletext'] },
          fish: 8,
          cells,
        },
      });
    // The perfective future and the past: vyletí is 3sg and 3pl, one fish (pres3).
    expect(tenseNets(null)).toEqual([
      ...[1, 2, 3, 4, 5, 6].map((n) => `class:tense:vyletext:past${n}`),
      ...[1, 2, 3, 4, 5].map((n) => `class:tense:vyletext:pres${n}`),
    ]);
    expect(tenseNets(['past'])).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `class:tense:vyletext:past${n}`),
    );
    expect(items({ generator: 'segment', params: { words: {}, roles: ['prefix'] } })).toEqual([
      'seg:vyletext',
    ]);
    expect(
      items({
        generator: 'family',
        params: { words: {}, families: ['mlyyn'], pick: 2, distractors: 2 },
      }),
    ).toEqual(['fam:mlynaarx', 'fam:mlyyn']);
  });
});

describe('form items', () => {
  const numberOfForms = (words: string[], cells: string[] | null = null) =>
    items({
      generator: 'classify',
      params: {
        dimension: 'number',
        context: 'form',
        words: { words },
        sentences: {},
        values: null,
        cells,
      },
    } as SkillSpec);

  it('are one item per form a word shows: the first cell in paradigm order that shows it', () => {
    // mlýn is sg1 and sg4, mlýny pl1, pl4, pl5 and pl7; ryby (sg2, pl1, pl4, pl5) shows no number,
    // and rybě is sg3 and sg6.
    expect(numberOfForms(['mlyyn', 'ryba'])).toEqual([
      'class:number:mlyyn:pl1',
      'class:number:mlyyn:pl2',
      'class:number:mlyyn:pl3',
      'class:number:mlyyn:pl6',
      'class:number:mlyyn:sg1',
      'class:number:mlyyn:sg2',
      'class:number:mlyyn:sg3',
      'class:number:mlyyn:sg5',
      'class:number:mlyyn:sg6',
      'class:number:mlyyn:sg7',
      'class:number:ryba:pl2',
      'class:number:ryba:pl3',
      'class:number:ryba:pl6',
      'class:number:ryba:pl7',
      'class:number:ryba:sg1',
      'class:number:ryba:sg3',
      'class:number:ryba:sg4',
      'class:number:ryba:sg5',
      'class:number:ryba:sg7',
    ]);
    expect(numberOfForms(['mlyyn'], ['pl'])).toEqual([
      'class:number:mlyyn:pl1',
      'class:number:mlyyn:pl2',
      'class:number:mlyyn:pl3',
      'class:number:mlyyn:pl6',
    ]);
  });

  it('name the item a retired form item stands for', () => {
    const stands = (item: string) => canonicalItem(item, lexicon);
    expect(stands('class:number:mlyyn:sg4')).toBe('class:number:mlyyn:sg1');
    expect(stands('class:number:mlyyn:pl7')).toBe('class:number:mlyyn:pl1');
    expect(stands('class:number:ryba:sg6')).toBe('class:number:ryba:sg3');
    expect(stands('class:tense:vyletext:pres6')).toBe('class:tense:vyletext:pres3');
    expect(stands('class:person:vyletext:pres6')).toBe('class:person:vyletext:pres3');
    for (const item of [
      'class:number:mlyyn:sg1',
      'class:number:mlyyn:sg9',
      'class:number:nobody:sg4',
      'class:number:mlyyn',
      'class:case:s.ryby-1:0',
      'class:segment:vyletext:0',
      'class:gender:ryba',
      'spell:ryba:1',
      'not an item',
    ]) {
      expect(stands(item), item).toBe(item);
    }
  });

  it('stand for themselves in every form skill', () => {
    const forms = [
      ...(['number', 'case', 'person', 'tense', 'mood', 'verb-form', 'finiteness'] as const).map(
        (dimension) =>
          items({
            generator: 'classify',
            params: {
              dimension,
              context: 'form',
              words: {},
              sentences: {},
              values: null,
              cells: null,
            },
          } as SkillSpec),
      ),
    ].flat();
    expect(forms.length).toBeGreaterThan(50);
    for (const item of forms) expect(canonicalItem(item, lexicon), item).toBe(item);
  });
});

describe('skill records', () => {
  const skill = (spec: Record<string, unknown>) => ({
    id: 'sk.x',
    titleKey: 'skill.x',
    strand: 'nouns',
    ...spec,
  });

  it('check the generator’s own parameters', () => {
    expect(
      skillSchema.parse(
        skill({
          generator: 'spell.word',
          params: { words: {}, rules: ['vyjm'], maxGaps: 1, choices: 2 },
        }),
      ).ok,
    ).toBe(true);
    expect(
      skillSchema.parse(
        skill({
          generator: 'spell.word',
          params: { words: {}, rules: ['vyjm'], maxGaps: 4, choices: 2 },
        }),
      ).ok,
    ).toBe(false);
    expect(
      skillSchema.parse(
        skill({ generator: 'spell.word', params: { rules: ['vyjm'], maxGaps: 1, choices: 2 } }),
      ).ok,
    ).toBe(false);
    expect(skillSchema.parse(skill({ generator: 'teleport', params: {} })).ok).toBe(false);
  });

  it('refuse a dimension the context cannot show, and values outside the dimension', () => {
    const classify = (
      dimension: string,
      context: string,
      values: string[] | null = null,
      cells: string[] | null = null,
    ) =>
      skillSchema.parse(
        skill({
          generator: 'classify',
          params: { dimension, context, words: {}, sentences: {}, values, cells },
        }),
      );
    expect(classify('case', 'sentence', ['1', '2', '3', '4']).ok).toBe(true);
    expect(classify('case', 'form').ok).toBe(true);
    expect(classify('person', 'form', null, ['pres', 'past', 'fut']).ok).toBe(true);
    expect(classify('case', 'word').ok).toBe(false);
    expect(classify('member', 'form').ok).toBe(false);
    expect(classify('case', 'sentence', ['8', '1']).ok).toBe(false);
    expect(classify('pos', 'word', null, ['pres']).ok).toBe(false);
    expect(classify('person', 'form', null, ['present']).ok).toBe(false);
    const sort = (dimension: string, context: string, cells: string[] | null = null) =>
      skillSchema.parse(
        skill({
          generator: 'sort',
          params: { dimension, context, values: ['sg', 'pl'], words: {}, fish: 6, cells },
        }),
      );
    expect(sort('number', 'word').ok).toBe(true);
    expect(sort('number', 'form', ['sg', 'pl']).ok).toBe(true);
    expect(sort('member', 'word').ok).toBe(false);
    expect(sort('number', 'word', ['sg']).ok).toBe(false);
    const odd = (basis: string) =>
      skillSchema.parse(skill({ generator: 'odd-one-out', params: { basis, words: {}, size: 4 } }));
    expect(odd('pos').ok).toBe(true);
    expect(odd('reflexive').ok).toBe(true);
    expect(odd('family').ok).toBe(true);
    expect(odd('case').ok).toBe(false);
  });

  it('filter by numeric grades and by aspect', () => {
    expect(wordFilterSchema.parse({ grades: [3, 4] }).ok).toBe(true);
    expect(wordFilterSchema.parse({ grades: ['3'] }).ok).toBe(false);
    expect(wordFilterSchema.parse({ grades: [5] }).ok).toBe(false);
    expect(wordFilterSchema.parse({ aspects: ['impf'] }).ok).toBe(true);
    expect(wordFilterSchema.parse({ aspects: ['perfect'] }).ok).toBe(false);
    expect(wordFilterSchema.parse({ registers: ['colloquial'] }).ok).toBe(true);
    expect(wordFilterSchema.parse({ registers: ['slang'] }).ok).toBe(false);
  });

  it('narrow a consonant skill only to letters of the classes it offers', () => {
    const problem = (generator: string, params: Record<string, unknown>) => {
      const outcome = skillSchema.parse(skill({ generator, params }));
      return outcome.ok ? null : (outcome.error.diagnostics[0]?.message ?? 'invalid');
    };
    const classify = (values: string[] | null, consonants: unknown, dimension = 'consonant') =>
      problem('classify', {
        dimension,
        context: 'word',
        words: {},
        sentences: {},
        values,
        cells: null,
        consonants,
      });
    const all = ['hard', 'soft', 'both-way'];
    expect(classify(all, ['h', 'ch', 'k', 'r', 'd', 't', 'n'])).toBeNull();
    expect(classify(null, ['cx', 'zx'])).toBeNull();
    expect(classify(['hard', 'soft'], ['h', 'b'])).toBe(
      '"b" is a both-way consonant, which the skill\'s values leave out.',
    );
    expect(classify(null, ['h'], 'pos')).toBe('Only a consonant skill lists consonants.');
    expect(classify(all, ['č'])).not.toBeNull();
    expect(classify(all, ['x'])).not.toBeNull();
    expect(classify(all, [])).not.toBeNull();
    expect(classify(all, ['h', 'h'])).not.toBeNull();
    const sort = (values: string[], consonants: string[]) =>
      problem('sort', {
        dimension: 'consonant',
        context: 'word',
        values,
        words: {},
        fish: 6,
        cells: null,
        consonants,
      });
    expect(sort(['hard', 'soft'], ['h', 'ch', 'cx', 'sx'])).toBeNull();
    expect(sort(['hard', 'soft'], ['h', 'ch', 'v'])).toBe(
      '"v" is a both-way consonant, which the skill\'s values leave out.',
    );
  });

  it('keep colloquial words to register skills, which must select them', () => {
    const parse = (generator: string, params: Record<string, unknown>) =>
      skillSchema.parse(skill({ generator, params })).ok;
    const classify = (dimension: string, registers?: string[]) =>
      parse('classify', {
        dimension,
        context: 'word',
        words: registers ? { registers } : {},
        sentences: {},
        values: null,
        cells: null,
      });
    expect(classify('register', ['standard', 'colloquial'])).toBe(true);
    expect(classify('register')).toBe(false);
    expect(classify('register', ['standard'])).toBe(false);
    expect(classify('pos')).toBe(true);
    expect(classify('pos', ['standard', 'colloquial'])).toBe(false);
    const pairs = (pair: string, registers?: string[]) =>
      parse('pairs', { pair, words: registers ? { registers } : {}, pairs: 3 });
    expect(pairs('standard', ['colloquial'])).toBe(true);
    expect(pairs('standard')).toBe(false);
    expect(pairs('synonym', ['colloquial'])).toBe(false);
    expect(
      parse('odd-one-out', {
        basis: 'register',
        words: { registers: ['standard', 'colloquial'] },
        size: 4,
      }),
    ).toBe(true);
    expect(
      parse('spell.word', {
        words: { registers: ['colloquial'] },
        rules: ['tvrda'],
        maxGaps: 1,
        choices: 2,
      }),
    ).toBe(false);
    expect(
      isRegisterSkill({
        id: 'sk.nets',
        titleKey: 'skill.nets',
        strand: 'standard-czech',
        generator: 'sort',
        params: {
          dimension: 'register',
          context: 'word',
          values: ['standard', 'colloquial'],
          words: { registers: ['standard', 'colloquial'] },
          fish: 6,
          cells: null,
        },
      }),
    ).toBe(true);
  });

  it('can ask every dimension in some context', () => {
    const asked = new Set(Object.values(CONTEXT_DIMENSIONS).flat());
    expect(DIMENSIONS.filter((dimension) => !asked.has(dimension))).toEqual([]);
  });
});
