/**
 * The vocative the grotto greets a child with (design §10.2): common Czech first names by their
 * ending and the child's form of address, and `null` wherever the rules are not sure.
 */
import { describe, expect, it } from 'vitest';
import { suggestVocative } from '../../../src/app/i18n/vocative';

describe('the vocative of a first name', () => {
  it('turns -a into -o, for girls and boys alike', () => {
    expect(suggestVocative('Klára', 'girl')).toBe('Kláro');
    expect(suggestVocative('Eliška', 'neutral')).toBe('Eliško');
    expect(suggestVocative('Honza', 'boy')).toBe('Honzo');
  });

  it('keeps other vowels, and a girl’s consonant', () => {
    expect(suggestVocative('Marie', 'girl')).toBe('Marie');
    expect(suggestVocative('Jiří', 'boy')).toBe('Jiří');
    expect(suggestVocative('Hugo', 'boy')).toBe('Hugo');
    expect(suggestVocative('Nikol', 'girl')).toBe('Nikol');
  });

  it('declines a boy’s consonant by its kind', () => {
    const boys: Record<string, string> = {
      Jan: 'Jane',
      Jakub: 'Jakube',
      Václav: 'Václave',
      Ruslan: 'Ruslane',
      Tomáš: 'Tomáši',
      Matěj: 'Matěji',
      Max: 'Maxi',
      Patrik: 'Patriku',
      Vojtěch: 'Vojtěchu',
      Marek: 'Marku',
      Zdeněk: 'Zdeňku',
      Petr: 'Petře',
      Viktor: 'Viktore',
      Michal: 'Michale',
      Daniel: 'Danieli',
      Pavel: 'Pavle',
    };
    for (const [name, vocative] of Object.entries(boys)) {
      expect(suggestVocative(name, 'boy'), name).toBe(vocative);
    }
  });

  it('says nothing where it is not sure', () => {
    expect(suggestVocative('Michal', 'neutral'), 'a consonant without kluk or holka').toBeNull();
    expect(suggestVocative('Marcel', 'boy'), 'an -el that may not drop its e').toBeNull();
    expect(suggestVocative('Vavřinec', 'boy')).toBeNull();
    expect(suggestVocative('Anna Marie', 'girl'), 'several words').toBeNull();
    expect(suggestVocative('  ', 'girl')).toBeNull();
  });
});
