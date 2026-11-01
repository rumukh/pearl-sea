/**
 * S5's next paintings, rehearsed before they exist. The page gets a catalog that lists main's
 * published art plus stand-ins for the batch S5 paints next: the lagoon's babies, the freed
 * Muréna, Osmička cheering, the shallows map, the lagoon, the grotto and the title. The stand-ins
 * are SVG files served by the test (`page.route`) in the real formats (docs/art.md §3): cut-outs
 * trimmed to their own boxes, each with its own aspect ratio, as `ship_art.py` trims them, and
 * scenes and maps of 1664 × 928, dark and busy on purpose, so any text not on paper shows.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { ART, ART_CATALOG_FORMAT, GUIDE_ID } from '../../../src/rules/contract';
import type { ArtCatalog, ArtEntry } from '../../../src/rules/contract';

const CATALOG_FILE = new URL('../../../assets/art/catalog.json', import.meta.url);

/** Where the stand-ins live, below `assets/art/`. */
const FOLDER = 'e2e';

const SCENE: readonly [number, number] = [1664, 928];

/** A baby's anchors, in thousandths of its box. */
const BABY_ANCHORS: ArtEntry['anchors'] = {
  head: { x: 500, y: 110, scale: 80, rotate: 0 },
  eyes: { x: 500, y: 330, scale: 80, rotate: 0 },
  neck: { x: 500, y: 620, scale: 55, rotate: 0 },
};

function entry(
  id: string,
  [width, height]: readonly [number, number],
  anchors?: ArtEntry['anchors'],
): ArtEntry {
  return {
    id,
    kind: 'painted',
    file: `${FOLDER}/${id.replaceAll('/', '-')}.svg`,
    width,
    height,
    ...(anchors ? { anchors } : {}),
  };
}

/** S5's next batch, at the sizes its pipeline gives them. */
export const NEXT_ART: readonly ArtEntry[] = [
  entry(ART.friend('krab-tvrdak', 'baby'), [1024, 760], BABY_ANCHORS),
  entry(ART.friend('meduzka-mekulka', 'baby'), [860, 900], BABY_ANCHORS),
  entry(ART.friend('zelva-obojka', 'baby'), [1024, 640], BABY_ANCHORS),
  // Trimmed to its own box: taller than the inked master (1024 × 872).
  entry(ART.monster('murena-mumla', 'freed'), [900, 1024]),
  entry(ART.character(GUIDE_ID, 'happy'), [1000, 1010]),
  entry(ART.map('shallows'), SCENE),
  entry(ART.scene('sunny-lagoon'), SCENE),
  entry(ART.scene('grotto'), SCENE),
  entry(ART.scene('title'), SCENE),
];

export const NEXT_IDS: readonly string[] = NEXT_ART.map((art) => art.id);

/** A painting of a whole scene: deep navy with bright bands and blobs, the hardest ground for text. */
function scene(width: number, height: number): string {
  const bands = Array.from({ length: 16 }, (_, index) => {
    const x = index * 130 - 200;
    const fill = ['#ff7a59', '#ffd166', '#2ec4b6', '#f4f1de'][index % 4];
    return `<rect x="${x}" y="-100" width="58" height="${height + 200}" fill="${fill}" opacity="0.8" transform="rotate(18 ${x} 0)"/>`;
  }).join('');
  const blobs = Array.from({ length: 9 }, (_, index) => {
    const cx = (index * 197) % width;
    const cy = (index * 311) % height;
    return `<circle cx="${cx}" cy="${cy}" r="${60 + (index % 3) * 30}" fill="#0b1426" opacity="0.85"/>`;
  }).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#0b2340"/>${bands}${blobs}</svg>`
  );
}

/** A cut-out: one rounded creature filling its trimmed box, on a clear background. */
function cutOut(width: number, height: number, fill: string): string {
  const stroke = Math.round(Math.min(width, height) * 0.02);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.48}" ry="${height * 0.48}" fill="${fill}" stroke="#4a2232" stroke-width="${stroke}"/>` +
    `<circle cx="${width * 0.38}" cy="${height * 0.4}" r="${Math.min(width, height) * 0.05}" fill="#4a2232"/>` +
    `<circle cx="${width * 0.62}" cy="${height * 0.4}" r="${Math.min(width, height) * 0.05}" fill="#4a2232"/></svg>`
  );
}

function standIn(art: ArtEntry): string {
  if (art.id.startsWith('scene/') || art.id.startsWith('map/')) return scene(art.width, art.height);
  const fill = art.id.includes('happy')
    ? '#c9a4f2'
    : art.id.includes('freed')
      ? '#9be37a'
      : '#ffb38a';
  return cutOut(art.width, art.height, fill);
}

/**
 * Serve the rehearsal catalog and its stand-ins to this page. Main's own entries stay (the
 * slice's masters); a stand-in replaces an entry of the same ID.
 */
export async function rehearseNextArt(page: Page): Promise<void> {
  const published = JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as ArtCatalog;
  const ids = new Set(NEXT_IDS);
  const catalog: ArtCatalog = {
    format: ART_CATALOG_FORMAT,
    entries: [...published.entries.filter((art) => !ids.has(art.id)), ...NEXT_ART].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  };
  const byFile = new Map(NEXT_ART.map((art) => [art.file, art]));
  await page.route('**/assets/art/catalog.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(catalog) }),
  );
  await page.route(`**/assets/art/${FOLDER}/**`, (route) => {
    const file = new URL(route.request().url()).pathname.split('/assets/art/')[1] ?? '';
    const art = byFile.get(file);
    return art
      ? route.fulfill({ contentType: 'image/svg+xml', body: standIn(art) })
      : route.fulfill({ status: 404, body: '' });
  });
}

// ------------------------------------------------------------------------------ what the page shows

/** A painting on screen by art ID: drawn from the catalog's file, not a placeholder. */
export function painted(page: Page, id: string) {
  return page.locator(`[data-art-id="${id}"]:not([data-placeholder]) > img.ps-art__image`);
}

/** The rectangle a picture's painting is drawn in, inside its element (`object-fit: contain`). */
export interface Drawn {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where the painting of each `[data-art-id]` matching `selector` is drawn on the page. */
export async function drawnRects(page: Page, selector: string): Promise<Drawn[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const image = element.querySelector('img') as HTMLImageElement;
      const box = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
      const width = style.objectFit === 'contain' ? image.naturalWidth * scale : box.width;
      const height = style.objectFit === 'contain' ? image.naturalHeight * scale : box.height;
      const [px = '50%', py = '50%'] = style.objectPosition.split(' ');
      const left = box.left + (box.width - width) * (parseFloat(px) / 100);
      const top = box.top + (box.height - height) * (parseFloat(py) / 100);
      return { left, top, right: left + width, bottom: top + height };
    }),
  );
}

/**
 * Text drawn straight onto a painting: visible text in `scope` with no backing of its own (an
 * element with an opaque enough background, or a gradient, between it and `scope`). Text over a
 * painting must sit on paper, since a painting's colours are not the palette's.
 */
export async function textOffPaper(page: Page, scope: string): Promise<string[]> {
  return page
    .locator(scope)
    .first()
    .evaluate((root) => {
      // Computed colours come as rgb()/rgba(), or as color(srgb r g b / a) for a color-mix().
      const alphaOf = (colour: string): number => {
        if (colour === 'transparent') return 0;
        const slash = colour.match(/\/\s*([\d.]+)(%?)\s*\)$/);
        if (slash) return parseFloat(slash[1]!) / (slash[2] ? 100 : 1);
        const rgba = colour.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
        return rgba ? parseFloat(rgba[1]!) : 1;
      };
      const offenders: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').trim();
        const element = node.parentElement;
        if (!text || !element) continue;
        if (element.closest('[aria-hidden="true"], .ps-visually-hidden, [hidden], .ps-art__dev')) {
          continue;
        }
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue;
        // The scope's own background lies under the painting: only what is inside it counts.
        let backed = false;
        for (let at: Element | null = element; at && at !== root; at = at.parentElement) {
          const own = getComputedStyle(at);
          if (alphaOf(own.backgroundColor) >= 0.85 || own.backgroundImage !== 'none') {
            backed = true;
            break;
          }
        }
        if (!backed) offenders.push(text.slice(0, 48));
      }
      return offenders;
    });
}
