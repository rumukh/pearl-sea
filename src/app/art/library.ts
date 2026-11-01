/**
 * S5's art catalog (the contract's `ART_CATALOG_PATH`, `assets/art/catalog.json`, format
 * `pearl-sea-art-catalog/1`): every published painting (WebP with alpha) and SVG by art ID (`ART`
 * in media.ts), with its pixel size and, for painted friends, the anchors where SVG cosmetics sit.
 *
 * The repository ships an empty catalog until S5's assets land. An art ID the catalog lacks is
 * drawn as a visibly labelled dev placeholder (art/picture.ts), so the real files drop in without
 * code changes. A catalog that cannot be read means placeholders everywhere, never a failed boot.
 */
import { ART_CATALOG_PATH, artCatalogSchema } from '../../rules/contract';
import type { ArtEntry } from '../../rules/contract';
import { fetchSiteText } from '../content/site';
import type { Fetcher } from '../content/site';

export const ART_DIRECTORY = 'assets/art/';

export interface ArtLibrary {
  /** The published entry for an art ID, or undefined (its placeholder is drawn). */
  entry(id: string): ArtEntry | undefined;
  /** The file of an entry, below the deployment base. */
  url(entry: ArtEntry): string;
  /** How many art IDs are published. */
  readonly size: number;
}

/** A catalog file path stays inside `assets/art/`. */
function safeFile(file: string): boolean {
  return !file.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

export function createArtLibrary(baseUrl: string, entries: readonly ArtEntry[]): ArtLibrary {
  const byId = new Map<string, ArtEntry>();
  for (const entry of entries) if (safeFile(entry.file)) byId.set(entry.id, entry);
  return {
    entry: (id) => byId.get(id),
    url: (entry) => new URL(ART_DIRECTORY + entry.file, baseUrl).href,
    size: byId.size,
  };
}

/** S5's catalog as a library; an unreadable or invalid catalog is an empty one. */
export async function loadArtLibrary(baseUrl: string, fetcher?: Fetcher): Promise<ArtLibrary> {
  try {
    const text = await fetchSiteText(baseUrl, ART_CATALOG_PATH, fetcher);
    const parsed = artCatalogSchema.parse(JSON.parse(text) as unknown);
    return createArtLibrary(baseUrl, parsed.ok ? parsed.value.entries : []);
  } catch {
    return createArtLibrary(baseUrl, []);
  }
}

/** What a preload needs of an image: `new Image()` in the browser. */
export interface PreloadImage {
  src: string;
  decoding: string;
  decode(): Promise<void>;
}

/** Pictures fetched ahead of their screen, kept with their library so the page keeps them. */
const preloaded = new WeakMap<ArtLibrary, PreloadImage[]>();

/**
 * Fetch and decode published pictures before their screen is built: the title's painting at
 * boot, while the content pack loads, so the first screen never shows bare sea while its
 * painting is still on its way (S6's PS-QA-20). A page keeps the images it has loaded for the
 * same address, so the screen's own picture of it is drawn at once. Nothing waits for it, and an
 * ID the catalog lacks (a placeholder) or a picture that fails is simply left to its screen.
 * Resolves once every picture is decoded or has failed.
 */
export function preloadPictures(
  art: ArtLibrary,
  ids: readonly string[],
  create: () => PreloadImage = () => new Image(),
): Promise<void> {
  const held = preloaded.get(art) ?? [];
  preloaded.set(art, held);
  const loads = ids.flatMap((id) => {
    const entry = art.entry(id);
    if (!entry) return [];
    const image = create();
    image.decoding = 'async';
    image.src = art.url(entry);
    held.push(image);
    return [image.decode().catch(() => undefined)];
  });
  return Promise.all(loads).then(() => undefined);
}
