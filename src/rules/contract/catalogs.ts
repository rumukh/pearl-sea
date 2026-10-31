/**
 * Catalog conventions shared by every catalog (`content/catalogs/<locale>.<scope>.json`): the
 * shell's UI strings (S4) and the content strings (S3). Views and content carry catalog keys,
 * never text; the shell picks the variant of a key for the child's form of address and for a
 * count.
 *
 * - The **bare key** is the required neutral phrasing (`praise.done`: "Hotovo, výborně!").
 * - **Address**: optional `<key>.boy` and `<key>.girl` come as a pair (`Dokázal jsi to!`,
 *   `Dokázala jsi to!`). The form of address lives in the family record, never in game state.
 * - **Czech plurals**: `<key>.one` (1), `<key>.few` (2-4) and `<key>.other` (0, 5 and more) come as
 *   a set of three (`1 mince`, `3 mince`, `5 mincí`); a plural key needs no bare key.
 * - Both combine as `<key>.<plural>.<address>`, with the neutral `<key>.<plural>` required.
 * - **English** exists only for the grown-ups' area (`grownups.*` keys) and uses `.one` and
 *   `.other` only.
 *
 * `catalogProblems` enforces these rules; `catalogHasKey` is how a referenced key is resolved.
 */

export const ADDRESS_VARIANTS = ['boy', 'girl'] as const;
export type AddressVariant = (typeof ADDRESS_VARIANTS)[number];
export const CZECH_PLURALS = ['one', 'few', 'other'] as const;
export const ENGLISH_PLURALS = ['one', 'other'] as const;
export type PluralCategory = (typeof CZECH_PLURALS)[number];

/** The keys the grown-ups' area may translate; every other key is Czech only. */
export const GROWN_UPS_KEY_PREFIX = 'grownups.';

/** The Czech plural category of a whole number: 1 → one, 2-4 → few, 0 and 5+ → other. */
export function czechPlural(count: number): PluralCategory {
  if (count === 1) return 'one';
  return count >= 2 && count <= 4 ? 'few' : 'other';
}

/** The English plural category: 1 → one, everything else → other. */
export function englishPlural(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other';
}

/** Whether a referenced key resolves: as a bare key, or as a plural set (`<key>.other`). */
export function catalogHasKey(catalog: Readonly<Record<string, string>>, key: string): boolean {
  return catalog[key] !== undefined || catalog[`${key}.other`] !== undefined;
}

/** Split a key into its base and its plural and address suffixes. */
export function splitCatalogKey(key: string): {
  base: string;
  plural: PluralCategory | null;
  address: AddressVariant | null;
} {
  const parts = key.split('.');
  let address: AddressVariant | null = null;
  let plural: PluralCategory | null = null;
  const last = parts[parts.length - 1];
  if (last === 'boy' || last === 'girl') {
    address = last;
    parts.pop();
  }
  const next = parts[parts.length - 1];
  if (parts.length > 1 && (next === 'one' || next === 'few' || next === 'other')) {
    plural = next;
    parts.pop();
  }
  return { base: parts.join('.'), plural, address };
}

/** The `{placeholder}` names of a string, sorted and unique. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((m) => m[1]!))].sort();
}

/**
 * Problems with a catalog's variant keys: an address variant without its pair or without its
 * neutral form, or with other placeholders than the neutral form; an incomplete plural set; a
 * plural category the locale does not have; and (for English) a key outside the grown-ups' area.
 */
export function catalogProblems(
  catalog: Readonly<Record<string, string>>,
  locale: 'cs' | 'en',
): string[] {
  const problems: string[] = [];
  const has = (key: string) => catalog[key] !== undefined;
  const plurals: readonly string[] = locale === 'cs' ? CZECH_PLURALS : ENGLISH_PLURALS;
  for (const key of Object.keys(catalog)) {
    const { base, plural, address } = splitCatalogKey(key);
    if (locale === 'en' && !key.startsWith(GROWN_UPS_KEY_PREFIX)) {
      problems.push(`"${key}": English exists only for keys starting "${GROWN_UPS_KEY_PREFIX}".`);
    }
    if (plural !== null && !plurals.includes(plural)) {
      problems.push(`"${key}": ${locale === 'cs' ? 'Czech' : 'English'} has no "${plural}" form.`);
    }
    if (address !== null) {
      const stem = plural === null ? base : `${base}.${plural}`;
      const other = address === 'boy' ? 'girl' : 'boy';
      if (!has(`${stem}.${other}`)) problems.push(`"${key}": needs its pair "${stem}.${other}".`);
      if (!has(stem)) problems.push(`"${key}": needs the neutral form "${stem}".`);
      else if (placeholders(catalog[key]!).join() !== placeholders(catalog[stem]!).join()) {
        problems.push(`"${key}": has other placeholders than "${stem}".`);
      }
    }
    if (plural !== null && address === null) {
      for (const category of plurals) {
        if (!has(`${base}.${category}`)) {
          problems.push(`"${key}": the plural set needs "${base}.${category}".`);
        }
      }
    }
  }
  return [...new Set(problems)];
}
