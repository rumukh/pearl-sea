/**
 * Content strings: S3's `content/catalogs/cs.content.json` (region and level titles, friend and
 * monster names, mnemonics, jokes, story lines, grammar terms, sticker and cosmetic names) and
 * `en.content.json` (the pack's grown-ups' strings in English: objective titles). Keys come from
 * the view as data, so they are plain strings here; boot checks that every key the pack uses
 * resolves (`collectCatalogKeys`, `catalogHasKey`) before any screen renders one.
 *
 * Czech grammar is the contract's catalog convention, read by the same translator as the shell's
 * own strings: the child's form of address, plural forms and Czech typesetting.
 */
import { catalogHasKey, collectCatalogKeys, GROWN_UPS_KEY_PREFIX } from '../../rules/contract';
import type { ContentData, FormOfAddress } from '../../rules/contract';
import { createCatalogTranslator } from '../i18n/messages';
import type { Catalog, Language, Translator } from '../i18n/messages';
import { fetchSiteText } from './site';
import type { Fetcher } from './site';

export const CONTENT_CATALOG_PATHS = {
  cs: 'content/catalogs/cs.content.json',
  en: 'content/catalogs/en.content.json',
} as const;

export interface ContentCatalogs {
  readonly cs: Catalog;
  /** English for the pack's grown-ups' strings; empty when the pack has none. */
  readonly en: Catalog;
}

/** Content strings: a translator over content keys, which also says whether a key exists. */
export interface ContentText extends Translator<string, string> {
  has(key: string): boolean;
  /**
   * A line about a count: the plural set `<key>.one/.few/.other` when the key is one, else the
   * bare key; either way with `{count}`.
   */
  counted(key: string, count: number, values?: Readonly<Record<string, string | number>>): string;
}

/** A flat map of non-empty strings, or a thrown error naming what is wrong. */
export function parseCatalog(input: unknown, what: string): Catalog {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${what} must be an object.`);
  }
  const catalog: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value === '') {
      throw new Error(`${what}: the entry ${key} must be text.`);
    }
    catalog[key] = value;
  }
  return catalog;
}

/** Keys the pack refers to that the catalog cannot resolve (empty when they all resolve). */
export function missingContentKeys(data: ContentData, catalog: Catalog): string[] {
  return [
    ...new Set(
      collectCatalogKeys(data)
        .map(({ key }) => key)
        .filter((key) => !catalogHasKey(catalog, key)),
    ),
  ];
}

/** The content catalogs, checked to cover every key the pack uses. */
export async function loadContentCatalogs(
  baseUrl: string,
  data: ContentData,
  fetcher?: Fetcher,
): Promise<ContentCatalogs> {
  const parse = async (path: string): Promise<Catalog> =>
    parseCatalog(JSON.parse(await fetchSiteText(baseUrl, path, fetcher)) as unknown, path);
  const cs = await parse(CONTENT_CATALOG_PATHS.cs);
  const missing = missingContentKeys(data, cs);
  if (missing.length > 0) {
    throw new Error(`The content catalog lacks ${missing.slice(0, 5).join(', ')}.`);
  }
  // English exists only for the pack's grown-ups' strings, so it is fetched only when they do.
  const grownUps = Object.keys(cs).some((key) => key.startsWith(GROWN_UPS_KEY_PREFIX));
  const en = grownUps ? await parse(CONTENT_CATALOG_PATHS.en) : {};
  return { cs, en };
}

function withHas(translate: Translator<string, string>, catalogs: readonly Catalog[]): ContentText {
  const isPluralSet = (key: string): boolean =>
    catalogs.some((catalog) => catalog[key] === undefined && catalog[`${key}.other`] !== undefined);
  return Object.assign(translate, {
    has: (key: string) => catalogs.some((catalog) => catalogHasKey(catalog, key)),
    counted: (
      key: string,
      count: number,
      values: Readonly<Record<string, string | number>> = {},
    ): string =>
      isPluralSet(key)
        ? translate.plural(key, count, values)
        : translate(key, { ...values, count }),
  });
}

/** The child's content strings: Czech, addressing the child playing now. */
export function createContentText(
  catalogs: ContentCatalogs,
  address: () => FormOfAddress = () => 'neutral',
): ContentText {
  return withHas(createCatalogTranslator({ catalog: catalogs.cs, address }), [catalogs.cs]);
}

/** Content strings for the grown-ups' area, in its language (English falls back to Czech). */
export function createGrownUpContentText(
  catalogs: ContentCatalogs,
  language: Language,
): ContentText {
  return language === 'en'
    ? withHas(
        createCatalogTranslator({
          catalog: catalogs.en,
          language: 'en',
          fallback: { catalog: catalogs.cs, language: 'cs' },
        }),
        [catalogs.en, catalogs.cs],
      )
    : withHas(createCatalogTranslator({ catalog: catalogs.cs }), [catalogs.cs]);
}
