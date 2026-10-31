/**
 * Czech typesetting and catalog parsing used by every screen.
 */
import { describe, expect, it } from 'vitest';
import { parseCatalog, text } from '../../../src/app/i18n/catalog';
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

describe('catalogs', () => {
  it('accepts a flat map of non-empty strings and freezes it', () => {
    const catalog = parseCatalog({ 'app.title': 'Perlové moře' }, 'cs.ui.json');
    expect(text(catalog, 'app.title')).toBe('Perlové moře');
    expect(Object.isFrozen(catalog)).toBe(true);
  });

  it('refuses anything else, and never shows a raw key', () => {
    for (const bad of [null, [], 'text', { a: 1 }, { a: '' }, { a: { b: 'c' } }]) {
      expect(() => parseCatalog(bad, 'cs.ui.json'), JSON.stringify(bad)).toThrow(/cs\.ui\.json/);
    }
    expect(() => text(parseCatalog({}, 'cs.ui.json'), 'missing.key')).toThrow(/missing\.key/);
  });
});
