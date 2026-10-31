/**
 * The catalog convention shared by the shell's and the content's catalogs: bare key = neutral
 * phrasing; `.boy`/`.girl` as a pair; Czech plurals `.one`/`.few`/`.other` as a set; combined
 * `<key>.<plural>.<address>`; English only for the grown-ups' area, with `.one`/`.other`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  catalogHasKey,
  catalogProblems,
  czechPlural,
  englishPlural,
  splitCatalogKey,
} from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');

describe('plural categories', () => {
  it('follow Czech: 1 one, 2-4 few, 0 and 5+ other', () => {
    const table = [0, 1, 2, 3, 4, 5, 11, 21, 22, 100].map((count) => [count, czechPlural(count)]);
    expect(table).toEqual([
      [0, 'other'],
      [1, 'one'],
      [2, 'few'],
      [3, 'few'],
      [4, 'few'],
      [5, 'other'],
      [11, 'other'],
      [21, 'other'],
      [22, 'other'],
      [100, 'other'],
    ]);
    expect([0, 1, 2].map(englishPlural)).toEqual(['other', 'one', 'other']);
  });
});

describe('catalog keys', () => {
  it('split into base, plural and address', () => {
    expect(splitCatalogKey('praise.done')).toEqual({
      base: 'praise.done',
      plural: null,
      address: null,
    });
    expect(splitCatalogKey('praise.done.girl')).toEqual({
      base: 'praise.done',
      plural: null,
      address: 'girl',
    });
    expect(splitCatalogKey('coins.few')).toEqual({ base: 'coins', plural: 'few', address: null });
    expect(splitCatalogKey('freed.one.boy')).toEqual({
      base: 'freed',
      plural: 'one',
      address: 'boy',
    });
  });

  it('resolve a reference as a bare key or a plural set', () => {
    const catalog = {
      'praise.done': 'Hotovo!',
      'coins.one': '1 mince',
      'coins.few': '{n} mince',
      'coins.other': '{n} mincí',
    };
    expect(catalogHasKey(catalog, 'praise.done')).toBe(true);
    expect(catalogHasKey(catalog, 'coins')).toBe(true);
    expect(catalogHasKey(catalog, 'praise.missing')).toBe(false);
  });
});

describe('catalog problems', () => {
  it('accept the convention', () => {
    expect(
      catalogProblems(
        {
          'praise.done': 'Hotovo, výborně!',
          'praise.done.boy': 'Dokázal jsi to!',
          'praise.done.girl': 'Dokázala jsi to!',
          'freed.one': 'Jedna příšera je volná.',
          'freed.few': '{n} příšery jsou volné.',
          'freed.other': '{n} příšer je volných.',
          'freed.one.boy': 'Osvobodil jsi jednu příšeru.',
          'freed.one.girl': 'Osvobodila jsi jednu příšeru.',
        },
        'cs',
      ),
    ).toEqual([]);
    expect(
      catalogProblems({ 'grownups.days.one': '{n} day', 'grownups.days.other': '{n} days' }, 'en'),
    ).toEqual([]);
  });

  it('report a lone address variant, a missing neutral form and an incomplete plural set', () => {
    expect(
      catalogProblems({ 'praise.done': 'Hotovo!', 'praise.done.boy': 'Dokázal jsi to!' }, 'cs'),
    ).toEqual(['"praise.done.boy": needs its pair "praise.done.girl".']);
    expect(
      catalogProblems(
        { 'praise.done.boy': 'Dokázal jsi to!', 'praise.done.girl': 'Dokázala jsi to!' },
        'cs',
      ),
    ).toEqual([
      '"praise.done.boy": needs the neutral form "praise.done".',
      '"praise.done.girl": needs the neutral form "praise.done".',
    ]);
    expect(catalogProblems({ 'coins.one': '1 mince', 'coins.other': '{n} mincí' }, 'cs')).toEqual([
      '"coins.one": the plural set needs "coins.few".',
      '"coins.other": the plural set needs "coins.few".',
    ]);
  });

  it('keep an address variant’s placeholders equal to its neutral form’s', () => {
    expect(
      catalogProblems(
        {
          'coins.earned': 'Máš {count} nových mincí!',
          'coins.earned.boy': 'Získal jsi {count} mincí!',
          'coins.earned.girl': 'Získala jsi mince!',
        },
        'cs',
      ),
    ).toEqual(['"coins.earned.girl": has other placeholders than "coins.earned".']);
  });

  it('keep English to the grown-ups’ area, with one and other only', () => {
    expect(catalogProblems({ 'title.name': 'Pearl Sea' }, 'en')).toEqual([
      '"title.name": English exists only for keys starting "grownups.".',
    ]);
    expect(
      catalogProblems(
        { 'grownups.days.one': 'a', 'grownups.days.few': 'b', 'grownups.days.other': 'c' },
        'en',
      ),
    ).toEqual(['"grownups.days.few": English has no "few" form.']);
  });

  it('pass for the shipped catalogs', () => {
    const czech = JSON.parse(readFileSync(join(root, 'content', 'catalogs', 'cs.ui.json'), 'utf8'));
    expect(catalogProblems(czech, 'cs')).toEqual([]);
  });
});
