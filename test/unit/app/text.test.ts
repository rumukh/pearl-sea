/**
 * Czech typesetting used by every screen: a one-letter preposition or conjunction never ends a
 * line, so the space after it becomes a no-break space.
 */
import { describe, expect, it } from 'vitest';
import { keepOneLetterWordsWithNext } from '../../../src/app/i18n/typography';

const NBSP = '\u00a0';

describe('keepOneLetterWordsWithNext', () => {
  it('binds one-letter prepositions and conjunctions to the next word', () => {
    expect(
      keepOneLetterWordsWithNext('Ponoř se s ponorkou a umyj inkoust z mořských příšer.'),
    ).toBe(`Ponoř se s${NBSP}ponorkou a${NBSP}umyj inkoust z${NBSP}mořských příšer.`);
    expect(keepOneLetterWordsWithNext('k moři, v lese, o rybě, u útesu, i ty')).toBe(
      `k${NBSP}moři, v${NBSP}lese, o${NBSP}rybě, u${NBSP}útesu, i${NBSP}ty`,
    );
  });

  it('handles chains, capitals and quotation marks', () => {
    expect(keepOneLetterWordsWithNext('a v lese')).toBe(`a${NBSP}v${NBSP}lese`);
    expect(keepOneLetterWordsWithNext('V moři žije „s rybkami“ krab.')).toBe(
      `V${NBSP}moři žije „s${NBSP}rybkami“ krab.`,
    );
  });

  it('leaves letters inside words, final letters and other one-letter words alone', () => {
    for (const unchanged of ['Krab Tvrďák', 'i', 'pes a', 'ryby y', 'x y']) {
      expect(keepOneLetterWordsWithNext(unchanged)).toBe(unchanged);
    }
  });
});
