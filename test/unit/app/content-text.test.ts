/**
 * Content strings (S3's `cs.content.json` and `en.content.json`): read with the contract's
 * catalog convention by the shell's translator, addressing the child playing now, with counted
 * lines (`counted`) whether the key is a plural set or a bare key; checked at boot to cover every
 * key the pack uses; English fetched only when the pack has grown-ups' strings.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_CATALOG_PATHS,
  createContentText,
  createGrownUpContentText,
  loadContentCatalogs,
  missingContentKeys,
  parseCatalog,
} from '../../../src/app/content/text';
import { collectCatalogKeys } from '../../../src/rules/contract';
import type { ContentData, FormOfAddress } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const pack = JSON.parse(
  readFileSync(join(root, 'test', 'fixtures', 'contract', 'mini-pack.json'), 'utf8'),
) as { data: ContentData };
const BASE = 'https://example.test/pearl-sea/';

describe('content text', () => {
  const catalogs = {
    cs: {
      'friend.krab.name': 'Krab Tvrďák',
      'quest.correct.one': 'Odpověz {count} správně.',
      'quest.correct.few': 'Odpověz {count}krát správně.',
      'quest.correct.other': 'Odpověz {count}krát správně.',
      'quest.fast': 'Odpověz {count}krát rychle.',
      'joke.ready': 'Jsi připravený na souboj?',
      'joke.ready.boy': 'Jsi připravený na souboj?',
      'joke.ready.girl': 'Jsi připravená na souboj?',
      'grownups.objective.listed-l': 'Vyjmenovaná slova po l',
    },
    en: { 'grownups.objective.listed-l': 'Listed words after l' },
  };

  it('reads keys from the view as data and says whether one exists', () => {
    const text = createContentText(catalogs);
    expect(text('friend.krab.name')).toBe('Krab Tvrďák');
    expect(text.has('friend.krab.name')).toBe(true);
    expect(text.has('quest.correct')).toBe(true);
    expect(text.has('friend.nobody.name')).toBe(false);
  });

  it('counts with Czech plural forms, or fills {count} into a bare key', () => {
    const text = createContentText(catalogs);
    expect(text.counted('quest.correct', 1)).toBe('Odpověz 1 správně.');
    expect(text.counted('quest.correct', 3)).toBe('Odpověz 3krát správně.');
    expect(text.counted('quest.correct', 20)).toBe('Odpověz 20krát správně.');
    expect(text.counted('quest.fast', 10)).toBe('Odpověz 10krát rychle.');
  });

  it('addresses the child playing now, and the neutral form otherwise', () => {
    let address: FormOfAddress = 'girl';
    const text = createContentText(catalogs, () => address);
    expect(text('joke.ready')).toBe('Jsi připravená na souboj?');
    address = 'boy';
    expect(text('joke.ready')).toBe('Jsi připravený na souboj?');
    address = 'neutral';
    expect(text('joke.ready')).toBe('Jsi připravený na souboj?');
  });

  it('gives the grown-ups English where the pack has it, and Czech for the rest', () => {
    const english = createGrownUpContentText(catalogs, 'en');
    expect(english('grownups.objective.listed-l')).toBe('Listed words after l');
    expect(english('friend.krab.name')).toBe('Krab Tvrďák');
    expect(english.has('friend.krab.name')).toBe(true);
    const czech = createGrownUpContentText(catalogs, 'cs');
    expect(czech('grownups.objective.listed-l')).toBe('Vyjmenovaná slova po l');
  });
});

describe('content catalogs at boot', () => {
  const everyKey = (data: ContentData = pack.data): Record<string, string> =>
    Object.fromEntries(collectCatalogKeys(data).map(({ key }) => [key, `[${key}]`]));

  it('find the keys the pack uses that the catalog cannot resolve', () => {
    const catalog = everyKey();
    expect(missingContentKeys(pack.data, catalog)).toEqual([]);
    const [first] = Object.keys(catalog);
    delete catalog[first!];
    expect(missingContentKeys(pack.data, catalog)).toEqual([first]);
  });

  it('accept only a flat map of text', () => {
    expect(parseCatalog({ a: 'A' }, 'cs')).toEqual({ a: 'A' });
    expect(() => parseCatalog([], 'cs')).toThrow('cs must be an object.');
    expect(() => parseCatalog({ a: '' }, 'cs')).toThrow('the entry a must be text');
    expect(() => parseCatalog({ a: 1 }, 'cs')).toThrow('the entry a must be text');
  });

  function serve(files: Record<string, unknown>) {
    const asked: string[] = [];
    const fetcher = async (url: string) => {
      const path = url.slice(BASE.length);
      asked.push(path);
      return path in files
        ? new Response(JSON.stringify(files[path]), { status: 200 })
        : new Response('', { status: 404 });
    };
    return { asked, fetcher };
  }

  it('load Czech, and English only when the pack has grown-ups’ strings', async () => {
    // The fixture's objective titles are grown-ups' strings; a pack without any loads Czech only.
    const childOnly = JSON.parse(
      JSON.stringify(pack.data).replaceAll('"grownups.', '"child.'),
    ) as ContentData;
    const plainCs = everyKey(childOnly);
    const plain = serve({ [CONTENT_CATALOG_PATHS.cs]: plainCs });
    expect(await loadContentCatalogs(BASE, childOnly, plain.fetcher)).toEqual({
      cs: plainCs,
      en: {},
    });
    expect(plain.asked).toEqual([CONTENT_CATALOG_PATHS.cs]);

    const cs = everyKey();
    const en = { 'grownups.objective.letters.hard-soft': 'Hard and soft consonants' };
    const both = serve({ [CONTENT_CATALOG_PATHS.cs]: cs, [CONTENT_CATALOG_PATHS.en]: en });
    expect(await loadContentCatalogs(BASE, pack.data, both.fetcher)).toEqual({ cs, en });
    expect(both.asked).toEqual([CONTENT_CATALOG_PATHS.cs, CONTENT_CATALOG_PATHS.en]);
  });

  it('refuse a catalog that misses keys the pack uses', async () => {
    const cs = everyKey();
    const [first] = Object.keys(cs);
    delete cs[first!];
    const files = serve({ [CONTENT_CATALOG_PATHS.cs]: cs });
    await expect(loadContentCatalogs(BASE, pack.data, files.fetcher)).rejects.toThrow(
      `The content catalog lacks ${first}`,
    );
  });
});
