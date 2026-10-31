/**
 * The lexicon schema and its linguistic checks on a small, real Czech fixture
 * (test/fixtures/contract/mini-pack.json): the fixture is clean, and each kind of mistake the
 * content gate must catch is caught.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formCells,
  lexiconId,
  lexiconSchema,
  parseGappedText,
  textWords,
  validateLexicon,
} from '../../../src/rules/contract';
import type { Lexicon, Word } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const fixture = (): Lexicon =>
  JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'contract', 'mini-pack.json'), 'utf8'))
    .data.lexicon;
const messages = (lexicon: Lexicon) =>
  validateLexicon(lexicon).map((p) => `${p.where}: ${p.message}`);

describe('lexicon IDs', () => {
  it('transliterate lemmas so the minimal pairs stay distinct', () => {
    expect(lexiconId('být')).toBe('byyt');
    expect(lexiconId('byt')).toBe('byt');
    expect(lexiconId('bít')).toBe('biit');
    expect(lexiconId('mlýn')).toBe('mlyyn');
    expect(lexiconId('dům')).toBe('duom');
    expect(lexiconId('čáp')).toBe('cxaap');
    expect(lexiconId('ďas')).toBe('dxas');
    expect(lexiconId('Vltava')).toBe('vltava');
    expect(lexiconId('mlynář')).toBe('mlynaarx');
    expect(lexiconId('bát se')).toBe('baat-se');
    expect(lexiconId('ryba!')).toBeNull();
  });
});

describe('gapped text', () => {
  it('parses inline gaps and fills them with the correct option', () => {
    const parsed = parseGappedText('Ml{ý|í}n stojí u {moře|more}.');
    expect(parsed.plain).toBe('Mlýn stojí u moře.');
    expect(parsed.gaps).toEqual([
      { correct: 'ý', alternatives: ['í'] },
      { correct: 'moře', alternatives: ['more'] },
    ]);
    expect(parsed.parts.filter((part) => part.kind === 'gap')).toHaveLength(2);
    expect(textWords(parsed.plain)).toEqual(['Mlýn', 'stojí', 'u', 'moře']);
  });

  it('refuses malformed gaps', () => {
    for (const bad of ['Ml{ý}n', 'Ml{ý|}n', 'Ml{ý|ý}n', 'Ml{ý|í n', 'Mlýn}', 'M{l{ý|í}}n']) {
      expect(() => parseGappedText(bad), bad).toThrow(RangeError);
    }
  });
});

describe('the fixture lexicon', () => {
  it('passes the schema and every linguistic check', () => {
    expect(lexiconSchema.parse(fixture()).ok).toBe(true);
    expect(messages(fixture())).toEqual([]);
  });

  it('catches segments that do not rebuild the word', () => {
    const lexicon = fixture();
    lexicon.words.find((w) => w.id === 'vyletext')!.segments = [
      ['prefix', 'vy'],
      ['root', 'lit'],
      ['suffix', 'ět'],
    ];
    expect(messages(lexicon)).toContain(
      'word vyletext: The segments rebuild "vylitět", not "vyletět".',
    );
  });

  it('catches a pattern that does not fit the gender', () => {
    const lexicon = fixture();
    lexicon.words.find((w) => w.id === 'ryba')!.noun!.pattern = 'hrad';
    expect(messages(lexicon)).toContain('word ryba: The pattern "hrad" does not fit the gender f.');
  });

  it('catches a listed-family word without its y', () => {
    const lexicon = fixture();
    lexicon.words.find((w) => w.id === 'mlynaarx')!.spelling = [];
    expect(messages(lexicon)).toContain(
      'word mlynaarx: A word of a listed family needs a "vyjm" y/ý after "l".',
    );
  });

  it('catches a listed family whose words have no y after its letter', () => {
    const lexicon = fixture();
    lexicon.families.find((f) => f.id === 'mlyyn')!.letter = 'b';
    expect(messages(lexicon)).toContain(
      'word mlyyn: A word of a listed family needs a "vyjm" y/ý after "b".',
    );
  });

  it('catches a spelling point that names the wrong letters', () => {
    const lexicon = fixture();
    lexicon.words.find((w) => w.id === 'ryba')!.spelling![0]!.at = 2;
    expect(messages(lexicon)).toContain('word ryba: Spelling point at 2 reads "b", not "y".');
  });

  it('catches an i/y twin that is not declared a sound-alike (a misspelled duplicate)', () => {
    const lexicon = fixture();
    lexicon.relations.soundAlikes = [];
    expect(messages(lexicon)).toContain(
      'word biit: "bít" and "být" differ only in i/y: declare them sound-alikes or fix the spelling.',
    );
  });

  it('catches sentence gaps and tokens that disagree with the text', () => {
    const lexicon = fixture();
    lexicon.sentences[0]!.gaps = [];
    lexicon.sentences[1]!.tokens![1]!.t = 'plavali';
    const found = messages(lexicon);
    expect(found).toContain('sentence s.mlyn-1: 1 gaps in the text, 0 annotated.');
    expect(
      found.some((m) => m.startsWith('sentence s.ryby-1: Tokens "Ryby plavali u útesu"')),
    ).toBe(true);
  });

  it('catches references to unknown words, families and sources', () => {
    const lexicon = fixture();
    lexicon.relations.antonyms.push(['velkyy', 'obrovskyy']);
    lexicon.words[0]!.src = ['nowhere'];
    lexicon.words[0]!.family = { id: 'nobody', role: 'head' };
    const found = messages(lexicon);
    expect(found).toContain('relations.antonyms: Unknown word "obrovskyy".');
    expect(found).toContain('word mlyyn: Unknown source "nowhere".');
    expect(found).toContain('word mlyyn: Unknown family "nobody".');
  });

  it('catches an ID that is not the lemma’s transliteration', () => {
    const lexicon = fixture();
    lexicon.words[0]!.id = 'mlin';
    expect(messages(lexicon)).toContain('word mlin: The ID must be "mlyyn" or "mlyyn.<sense>".');
  });

  it('demands the future of verbs that do not use budu, and the reflexive pronoun in the lemma', () => {
    const lexicon = fixture();
    delete lexicon.words.find((w) => w.id === 'byyt')!.verb!.paradigm.fut;
    lexicon.words.find((w) => w.id === 'biit')!.verb!.reflexive = 'se';
    const found = messages(lexicon);
    expect(found).toContain('word byyt: "být" forms its future without "budu": list `fut`.');
    expect(found).toContain(
      'word biit: The infinitive (with its reflexive pronoun) must be the lemma.',
    );
  });

  it('pairs sound-alike word forms, and refuses a form the word does not have', () => {
    const lexicon = fixture();
    lexicon.relations.soundAlikes.push([
      { word: 'byyt', form: 'byl' },
      { word: 'biit', form: 'bil' },
    ]);
    expect(messages(lexicon)).toEqual([]);
    lexicon.relations.soundAlikes.push([
      { word: 'byyt', form: 'bul' },
      { word: 'biit', form: 'bil jsem' },
    ]);
    expect(messages(lexicon)).toEqual(['relations.soundAlikes: "bul" is not a form of "být".']);
  });
});

describe('forms', () => {
  const word = (id: string): Word => fixture().words.find((w) => w.id === id)!;
  const cells = (w: Word) => Object.fromEntries(formCells(w).map((cell) => [cell.cell, cell]));

  it('keep only what an ambiguous noun form shows', () => {
    const ryba = cells(word('ryba'));
    expect(ryba['sg7']).toEqual({
      cell: 'sg7',
      text: 'rybou',
      values: { number: 'sg', case: '7' },
    });
    expect(ryba['sg2']).toEqual({ cell: 'sg2', text: 'ryby', values: {} });
    expect(ryba['pl3']!.values).toEqual({ number: 'pl', case: '3' });
    const mlyn = cells(word('mlyyn'));
    expect(mlyn['sg3']!.values).toEqual({ number: 'sg' });
    expect(mlyn['pl1']!.values).toEqual({ number: 'pl' });
  });

  it('compose the past, the future and the conditional', () => {
    const byt = cells(word('byyt'));
    expect(byt['inf']).toEqual({ cell: 'inf', text: 'být', values: { finiteness: 'infinitive' } });
    expect(byt['past1']!.text).toBe('byl jsem');
    expect(byt['past1']!.values).toEqual({
      person: '1',
      number: 'sg',
      finiteness: 'finite',
      tense: 'past',
      mood: 'indicative',
      'verb-form': 'compound',
    });
    expect(byt['past3']!.text).toBe('byl');
    expect(byt['past3']!.values['verb-form']).toBe('simple');
    expect(byt['fut4']!.text).toBe('budeme');
    expect(byt['fut4']!.values['verb-form']).toBe('simple');
    expect(byt['cond5']!.text).toBe('byli byste');
    expect(byt['cond5']!.values.mood).toBe('conditional');
    expect(byt['imp4']!.text).toBe('buďme');
    expect(byt['imp4']!.values).toMatchObject({ person: '1', number: 'pl', mood: 'imperative' });
    expect(cells(word('biit'))['fut1']!.text).toBe('budu bít');
    expect(cells(word('biit'))['fut1']!.values['verb-form']).toBe('compound');
  });

  it('treat a perfective present as the future and keep shared forms honest', () => {
    const vyletet = cells(word('vyletext'));
    expect(vyletet['fut1']).toBeUndefined();
    expect(vyletet['pres1']!.values.tense).toBe('future');
    expect(vyletet['pres3']!.text).toBe('vyletí');
    expect(vyletet['pres3']!.values).toEqual({
      person: '3',
      finiteness: 'finite',
      tense: 'future',
      mood: 'indicative',
      'verb-form': 'simple',
    });
  });

  it('place the reflexive pronoun after the auxiliary', () => {
    const myt: Word = {
      id: 'myyt-se',
      lemma: 'mýt se',
      pos: 'verb',
      grade: 3,
      topics: [],
      tags: [],
      src: [],
      verb: {
        aspect: 'impf',
        reflexive: 'se',
        paradigm: {
          inf: 'mýt',
          pres: ['myji', 'myješ', 'myje', 'myjeme', 'myjete', 'myjí'],
          imp: ['myj', 'myjme', 'myjte'],
          past: {
            m: 'myl',
            f: 'myla',
            n: 'mylo',
            ma: 'myli',
            mi: 'myly',
            fpl: 'myly',
            npl: 'myla',
          },
        },
      },
    };
    const texts = Object.fromEntries(formCells(myt).map((cell) => [cell.cell, cell.text]));
    expect(texts).toMatchObject({
      inf: 'mýt se',
      pres1: 'myji se',
      fut1: 'budu se mýt',
      past1: 'myl jsem se',
      past3: 'myl se',
      imp2: 'myj se',
      cond1: 'myl bych se',
    });
    expect(lexiconId(myt.lemma)).toBe(myt.id);
    expect(formCells({ ...myt, pos: 'adj', verb: undefined } as Word)).toEqual([]);
  });
});
