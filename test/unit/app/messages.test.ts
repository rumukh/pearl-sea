/**
 * The translator (src/app/i18n/messages.ts): the contract's Czech plural forms and grammatical
 * address with a neutral fallback, Czech typesetting, and the grown-ups' translator in Czech or
 * English.
 */
import { describe, expect, it } from 'vitest';
import {
  createGrownUpTranslator,
  createTranslator,
  hasMessage,
} from '../../../src/app/i18n/messages';
import type { FormOfAddress } from '../../../src/rules/contract';

const NBSP = '\u00a0';

/** A translator over a catalog that names each plural form, to see which one is chosen. */
function forms(language: 'cs' | 'en'): (count: number) => string {
  const catalog = {
    'n.one': '{count} one',
    ...(language === 'cs' ? { 'n.few': '{count} few' } : {}),
    'n.other': '{count} other',
  };
  const t = createTranslator({ catalog, language });
  return (count) => (t.plural as unknown as (key: string, count: number) => string)('n', count);
}

describe('Czech plural forms', () => {
  it('are one for 1, few for 2-4 and other for 0, 5 and more', () => {
    const czech = forms('cs');
    expect([0, 1, 2, 3, 4, 5, 11, 12, 21, 22, 100, 101].map(czech)).toEqual([
      '0 other',
      '1 one',
      '2 few',
      '3 few',
      '4 few',
      '5 other',
      '11 other',
      '12 other',
      '21 other',
      // Unlike some languages, Czech does not go back to "few" for 22, 23, 24.
      '22 other',
      '100 other',
      '101 other',
    ]);
  });

  it('are one and other in English', () => {
    expect([0, 1, 2, 4, 5].map(forms('en'))).toEqual([
      '0 other',
      '1 one',
      '2 other',
      '4 other',
      '5 other',
    ]);
  });

  it('pick the coin forms: 1 mince, 3 mince, 5 mincí', () => {
    const t = createTranslator();
    expect(t.plural('coins.label', 1)).toBe('1 mince');
    expect(t.plural('coins.label', 3)).toBe('3 mince');
    expect(t.plural('coins.label', 5)).toBe('5 mincí');
    expect(t.plural('coins.label', 0)).toBe('0 mincí');
    expect(t.plural('coins.earned', 1)).toBe(`Máš o${NBSP}1 minci víc!`);
    expect(t.plural('coins.earned', 2)).toBe(`Máš o${NBSP}2 mince víc!`);
    expect(t.plural('coins.earned', 12)).toBe(`Máš o${NBSP}12 mincí víc!`);
  });
});

describe('grammatical address', () => {
  const catalog = {
    'praise.done': 'Hotovo! To se ti povedlo!',
    'praise.done.boy': 'Dokázal jsi to!',
    'praise.done.girl': 'Dokázala jsi to!',
    'pearls.found.one': 'Máš {count} novou perlu!',
    'pearls.found.one.boy': 'Našel jsi {count} perlu!',
    'pearls.found.one.girl': 'Našla jsi {count} perlu!',
    'pearls.found.few': 'Máš {count} nové perly!',
    'pearls.found.other': 'Máš {count} nových perel!',
    'hello.plain': 'Ahoj!',
  };

  function speaking(address: FormOfAddress) {
    return createTranslator({ catalog, address: () => address }) as unknown as (
      key: string,
    ) => string;
  }

  it('praises a boy and a girl in their own grammatical forms', () => {
    expect(speaking('boy')('praise.done')).toBe('Dokázal jsi to!');
    expect(speaking('girl')('praise.done')).toBe('Dokázala jsi to!');
  });

  it('uses the neutral phrasing for a child who chose neither, and where no variant exists', () => {
    expect(speaking('neutral')('praise.done')).toBe('Hotovo! To se ti povedlo!');
    expect(speaking('girl')('hello.plain')).toBe('Ahoj!');
  });

  it('follows the child playing now', () => {
    let address: FormOfAddress = 'boy';
    const t = createTranslator({ catalog, address: () => address }) as unknown as (
      key: string,
    ) => string;
    expect(t('praise.done')).toBe('Dokázal jsi to!');
    address = 'girl';
    expect(t('praise.done')).toBe('Dokázala jsi to!');
  });

  it('combines with plural forms as <key>.<plural>.<address>', () => {
    let address: FormOfAddress = 'girl';
    const t = createTranslator({ catalog, address: () => address });
    const plural = t.plural as unknown as (key: string, count: number) => string;
    expect(plural('pearls.found', 1)).toBe('Našla jsi 1 perlu!');
    address = 'boy';
    expect(plural('pearls.found', 1)).toBe('Našel jsi 1 perlu!');
    address = 'neutral';
    expect(plural('pearls.found', 1)).toBe('Máš 1 novou perlu!');
    address = 'girl';
    expect(plural('pearls.found', 3), 'no variant for few: the neutral form').toBe(
      'Máš 3 nové perly!',
    );
    expect(plural('pearls.found', 7)).toBe('Máš 7 nových perel!');
  });
});

describe('the translator', () => {
  it('binds one-letter words to the next word in Czech, never in English', () => {
    const t = createTranslator();
    expect(t('title.tagline')).toContain(`s${NBSP}ponorkou`);
    expect(t('title.tagline')).toContain(`z${NBSP}mořských`);
    const english = createTranslator({ catalog: { a: 'a crab and a fish' }, language: 'en' });
    expect((english as unknown as (key: string) => string)('a')).toBe('a crab and a fish');
  });

  it('keeps an ending’s hyphen with its letters in Czech, the placeholders’ text too', () => {
    const t = createTranslator({
      catalog: { rule: 'Ta prasátka chrochtala (rod střední: -a).', ending: 'Koncovka {e}.' },
    }) as unknown as (key: string, values?: Record<string, string>) => string;
    expect(t('rule')).toBe('Ta prasátka chrochtala (rod střední: \u2011a).');
    expect(t('ending', { e: '-y' })).toBe('Koncovka \u2011y.');
  });

  it('fills placeholders and refuses to invent missing values or keys', () => {
    const t = createTranslator();
    expect(t('error.code', { code: 'QuotaExceededError' })).toBe(
      'Kód pro dospělé: QuotaExceededError',
    );
    expect(() => t('error.code')).toThrow();
    expect(() => (t as unknown as (key: string) => string)('no.such.key')).toThrow();
    expect(hasMessage('toast.failed')).toBe(true);
    expect(hasMessage('error.no-such-code')).toBe(false);
  });

  it('speaks to grown-ups in Czech or English', () => {
    const cs = createGrownUpTranslator('cs');
    const en = createGrownUpTranslator('en');
    expect(cs.language).toBe('cs');
    expect(en.language).toBe('en');
    expect(cs('grownups.heading')).toBe('Pro dospělé');
    expect(en('grownups.heading')).toBe('For grown-ups');
    expect(cs('grownups.gate.question', { a: 23, b: 47 })).toBe('Kolik je 23 × 47?');
    expect(en('grownups.gate.question', { a: 23, b: 47 })).toBe('What is 23 × 47?');
    expect(cs.plural('grownups.settings.minutes', 1)).toBe('1 minuta');
    expect(cs.plural('grownups.settings.minutes', 3)).toBe('3 minuty');
    expect(cs.plural('grownups.settings.minutes', 15)).toBe('15 minut');
    expect(en.plural('grownups.settings.minutes', 1)).toBe('1 minute');
    expect(en.plural('grownups.settings.minutes', 3), 'English has no few form').toBe('3 minutes');
  });
});
