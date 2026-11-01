/**
 * Czech typesetting used by every screen: a one-letter preposition or conjunction never ends a
 * line, so the space after it becomes a no-break space, and an ending's hyphen (-a) never stays
 * alone at a line's end.
 */
import { describe, expect, it } from 'vitest';
import {
  keepEndingsWhole,
  keepOneLetterWordsWithNext,
  typesetCzech,
} from '../../../src/app/i18n/typography';

const NBSP = '\u00a0';
const NBHY = '\u2011';

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

describe('keepEndingsWhole', () => {
  it('keeps an ending’s hyphen with its letters', () => {
    expect(keepEndingsWhole('ta prasátka chrochtala (rod střední: -a).')).toBe(
      `ta prasátka chrochtala (rod střední: ${NBHY}a).`,
    );
    expect(keepEndingsWhole('-i, nebo -y? (-ách)')).toBe(`${NBHY}i, nebo ${NBHY}y? (${NBHY}ách)`);
    expect(keepEndingsWhole('píšeme -i/-y')).toBe(`píšeme ${NBHY}i/${NBHY}y`);
  });

  it('leaves prefixes, hyphens inside words, dashes and minus signs alone', () => {
    for (const unchanged of ['vy-/vý-', 'od-, nad-', 'e-mail', 'psi - kočky', 'je -5 °C', '–a']) {
      expect(keepEndingsWhole(unchanged)).toBe(unchanged);
    }
  });
});

describe('typesetCzech', () => {
  it('binds one-letter words and keeps endings whole', () => {
    expect(typesetCzech('píšeme -i: psi a kočky utíkali')).toBe(
      `píšeme ${NBHY}i: psi a${NBSP}kočky utíkali`,
    );
    expect(typesetCzech('a -y')).toBe(`a${NBSP}${NBHY}y`);
  });
});
