/**
 * UI string catalogs: `content/catalogs/<locale>.ui.json`, flat maps from key to text. Czech holds
 * every string; English exists only for the grown-ups' area (scripts/validate-content.mjs).
 */
export type Locale = 'cs' | 'en';
export type Catalog = Readonly<Record<string, string>>;

export class CatalogError extends Error {
  override readonly name = 'CatalogError';
}

/** Accept only a flat object of non-empty strings. */
export function parseCatalog(value: unknown, source: string): Catalog {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogError(`${source} is not a catalog object.`);
  }
  const entries = Object.entries(value);
  for (const [key, text] of entries) {
    if (typeof text !== 'string' || text.length === 0) {
      throw new CatalogError(`${source}: "${key}" is not a non-empty string.`);
    }
  }
  return Object.freeze(Object.fromEntries(entries)) as Catalog;
}

export async function loadCatalog(baseUrl: string, locale: Locale): Promise<Catalog> {
  const source = `content/catalogs/${locale}.ui.json`;
  const response = await fetch(new URL(source, baseUrl).href, {
    credentials: 'same-origin',
    redirect: 'error',
  });
  if (!response.ok) throw new CatalogError(`${source} could not be loaded (${response.status}).`);
  return parseCatalog(await response.json(), source);
}

/** The text of `key`; a missing key is a defect, never shown as a raw key to a child. */
export function text(catalog: Catalog, key: string): string {
  const value = catalog[key];
  if (value === undefined) throw new CatalogError(`Missing catalog key "${key}".`);
  return value;
}
