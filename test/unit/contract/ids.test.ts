/**
 * The contract's identifiers and closed vocabularies: canonical v1 IDs are well formed, unique
 * and complete for the approved plan (12 regions, 18 friends, 12 monsters, 4 Inkoustíci), art IDs
 * follow the conventions, and the Czech grammar lists match the school terms.
 */
import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  ART,
  ART_ID_PATTERN,
  BOTH_WAY_CONSONANTS,
  CANONICAL_FRIEND_IDS,
  CANONICAL_INKOUSTIK_IDS,
  CANONICAL_MONSTER_IDS,
  CANONICAL_REGION_IDS,
  CASE_QUESTIONS,
  CHARACTER_IDS,
  DIMENSIONS,
  DIVER_AVATARS,
  FINALE_MONSTER_ID,
  FIRST_FRIEND_CHOICES,
  FRIEND_STAGES,
  GRADE_3_FINALE_MONSTER_ID,
  GRADES,
  HARD_CONSONANTS,
  LISTED_LETTERS,
  MINIGAME_KIND_BY_ACTIVITY,
  MINIGAME_ACTIVITY_KINDS,
  NOUN_PATTERNS,
  PAIRED_CONSONANTS,
  PARTS_OF_SPEECH,
  PATTERN_GENDER,
  PATTERN_WORD,
  SOFT_CONSONANTS,
  STRANDS,
  compareCzech,
  czechLetters,
  isContentId,
  isInflected,
  partOfSpeechNumber,
} from '../../../src/rules/contract';
import { DIMENSION_VALUES } from '../../../src/rules/contract/skills';

describe('canonical v1 IDs', () => {
  it('are well-formed, unique content IDs in the numbers the plan approved', () => {
    const lists: [string, readonly string[], number][] = [
      ['regions', CANONICAL_REGION_IDS, 12],
      ['friends', CANONICAL_FRIEND_IDS, 18],
      ['monsters', CANONICAL_MONSTER_IDS, 12],
      ['inkoustici', CANONICAL_INKOUSTIK_IDS, 4],
      ['characters', CHARACTER_IDS, 3],
      ['avatars', DIVER_AVATARS, 8],
    ];
    for (const [name, list, count] of lists) {
      expect(list, name).toHaveLength(count);
      expect(new Set(list).size, `${name} are unique`).toBe(count);
      for (const id of list) expect(isContentId(id), id).toBe(true);
    }
  });

  it('offers the three lagoon friends first and names both finales', () => {
    expect([...FIRST_FRIEND_CHOICES]).toEqual(CANONICAL_FRIEND_IDS.slice(0, 3));
    expect(CANONICAL_MONSTER_IDS[6]).toBe(GRADE_3_FINALE_MONSTER_ID);
    expect(CANONICAL_MONSTER_IDS[11]).toBe(FINALE_MONSTER_ID);
    expect([...FRIEND_STAGES]).toEqual(['egg', 'baby', 'grown', 'crowned']);
  });

  it('builds art IDs by convention, each a valid art ID', () => {
    const ids = [
      ART.friend('krab-tvrdak', 'baby'),
      ART.friend('krab-tvrdak', 'grown'),
      ART.egg('krab-tvrdak'),
      ART.monster('murena-mumla', 'inked'),
      ART.monster('murena-mumla', 'freed'),
      ART.inkoustik('inkoustik-kanka'),
      ART.scene('sunny-lagoon'),
      ART.map('shallows'),
      ART.character('osmicka'),
      ART.avatar('diver-1'),
      ART.cosmetic('hat-captain'),
      ART.sticker('first-pearl'),
    ];
    expect(ids).toContain('friend/krab-tvrdak/baby');
    expect(ids).toContain('monster/murena-mumla/freed');
    for (const id of ids) expect(id, id).toMatch(ART_ID_PATTERN);
  });

  it('maps every minigame activity to a narrative kind', () => {
    expect(Object.keys(MINIGAME_KIND_BY_ACTIVITY).sort()).toEqual(
      [...MINIGAME_ACTIVITY_KINDS].sort(),
    );
    expect(MINIGAME_KIND_BY_ACTIVITY['fishing-nets']).toBe('ps.sorting-nets');
    expect([...GRADES]).toEqual([3, 4]);
    expect(STRANDS).toHaveLength(10);
  });
});

describe('Czech letters and alphabetical order', () => {
  it('has the 42 letters of the school alphabet, ch right after h', () => {
    expect(ALPHABET).toHaveLength(42);
    expect(ALPHABET.indexOf('ch')).toBe(ALPHABET.indexOf('h') + 1);
    expect(czechLetters('Chobotnice')).toEqual(['ch', 'o', 'b', 'o', 't', 'n', 'i', 'c', 'e']);
  });

  it('sorts like a school dictionary', () => {
    const words = [
      'žába',
      'chobotnice',
      'cihla',
      'ibis',
      'čáp',
      'hvězda',
      'řeka',
      'ryba',
      'šnek',
      'sůl',
      'zebra',
      'dům',
      'ďas',
      'pila',
      'píla',
    ];
    expect([...words].sort(compareCzech)).toEqual([
      'cihla',
      'čáp',
      'ďas',
      'dům',
      'hvězda',
      'chobotnice',
      'ibis',
      'pila',
      'píla',
      'ryba',
      'řeka',
      'sůl',
      'šnek',
      'zebra',
      'žába',
    ]);
    expect(compareCzech('ďas', 'dům')).toBeLessThan(0);
    expect(compareCzech('mlýn', 'mlýn')).toBe(0);
    expect(compareCzech('petr', 'Petr')).toBeLessThan(0);
  });

  it('splits the consonants into hard, soft and both-way, with the paired consonants', () => {
    const all = [...HARD_CONSONANTS, ...SOFT_CONSONANTS, ...BOTH_WAY_CONSONANTS];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(24);
    expect([...HARD_CONSONANTS]).toEqual(['h', 'ch', 'k', 'r', 'd', 't', 'n']);
    expect([...LISTED_LETTERS]).toEqual(['b', 'l', 'm', 'p', 's', 'v', 'z']);
    expect(PAIRED_CONSONANTS).toHaveLength(8);
  });
});

describe('grammar', () => {
  it('lists the ten parts of speech in school order, the first five inflected', () => {
    expect(PARTS_OF_SPEECH).toHaveLength(10);
    expect(partOfSpeechNumber('noun')).toBe(1);
    expect(partOfSpeechNumber('interj')).toBe(10);
    expect(PARTS_OF_SPEECH.filter(isInflected)).toEqual(['noun', 'adj', 'pron', 'num', 'verb']);
  });

  it('has the 14 noun patterns, four per gender except two inanimate masculine', () => {
    expect(NOUN_PATTERNS).toHaveLength(14);
    const byGender = (gender: string) => NOUN_PATTERNS.filter((p) => PATTERN_GENDER[p] === gender);
    expect(byGender('ma').map((p) => PATTERN_WORD[p])).toEqual([
      'pán',
      'muž',
      'předseda',
      'soudce',
    ]);
    expect(byGender('mi').map((p) => PATTERN_WORD[p])).toEqual(['hrad', 'stroj']);
    expect(byGender('f').map((p) => PATTERN_WORD[p])).toEqual(['žena', 'růže', 'píseň', 'kost']);
    expect(byGender('n').map((p) => PATTERN_WORD[p])).toEqual(['město', 'moře', 'kuře', 'stavení']);
  });

  it('asks the seven cases with the school questions', () => {
    expect(Object.keys(CASE_QUESTIONS)).toHaveLength(7);
    expect(CASE_QUESTIONS[2]).toBe('koho? čeho?');
    expect(CASE_QUESTIONS[5]).toBe('oslovujeme, voláme');
  });

  it('gives every classification dimension a closed list of values', () => {
    for (const dimension of DIMENSIONS) {
      const values = DIMENSION_VALUES[dimension];
      expect(values.length, dimension).toBeGreaterThanOrEqual(2);
      expect(new Set(values).size, dimension).toBe(values.length);
    }
    expect(DIMENSION_VALUES.case).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
});
