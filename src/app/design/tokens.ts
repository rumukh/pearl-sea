/**
 * Design tokens: the interface palette (design/palette.ts) and the SDK's child-safe thresholds,
 * published as CSS custom properties on the document root at boot. Stylesheets read colours only
 * through `var(--ps-…)` (test/unit/app/tokens.test.ts holds them to it).
 */
import { CHILD_SAFE_PRESET } from '@aegis/browser/ui';
import { PALETTE } from './palette';
import type { RegionAccent } from './palette';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

const regions = PALETTE.regions as Readonly<Record<string, RegionAccent>>;

function onAccent(region: RegionAccent): string {
  return region.onAccent === 'white' ? PALETTE.surface.card : PALETTE.ink.ink;
}

/** Every token as `[custom property, value]`, in a stable order. */
export function tokenEntries(): [string, string][] {
  const entries: [string, string][] = [];
  for (const group of [PALETTE.ink, PALETTE.surface, PALETTE.brand, PALETTE.feedback]) {
    for (const [name, value] of Object.entries(group)) entries.push([`--ps-${kebab(name)}`, value]);
  }
  for (const [name, value] of Object.entries(PALETTE.mastery)) {
    entries.push([`--ps-mastery-${kebab(name)}`, value]);
  }
  for (const [id, region] of Object.entries(regions)) {
    entries.push(
      [`--ps-region-${id}-accent`, region.accent],
      [`--ps-region-${id}-deep`, region.deep],
      [`--ps-region-${id}-soft`, region.soft],
      [`--ps-region-${id}-on-accent`, onAccent(region)],
    );
  }
  PALETTE.rainbow.forEach((color, index) => entries.push([`--ps-rainbow-${index + 1}`, color]));
  entries.push(
    ['--ps-target', `${CHILD_SAFE_PRESET.targetPixels}px`],
    ['--ps-reading', `${CHILD_SAFE_PRESET.readingPixels}px`],
  );
  return entries;
}

export function applyTokens(root: HTMLElement): void {
  for (const [name, value] of tokenEntries()) root.style.setProperty(name, value);
}

/**
 * The region accent of a screen: `--ps-accent*` follow the region, or the sea teal outside any
 * region. A region this build does not know (from newer content) uses the sea teal too.
 */
export function applyRegion(element: HTMLElement, region: string | null): void {
  const colors = region === null ? undefined : regions[region];
  if (colors && region) element.dataset['region'] = region;
  else delete element.dataset['region'];
  element.style.setProperty('--ps-accent', colors?.accent ?? PALETTE.brand.primary);
  element.style.setProperty('--ps-accent-deep', colors?.deep ?? PALETTE.brand.primaryDeep);
  element.style.setProperty('--ps-accent-soft', colors?.soft ?? PALETTE.brand.primarySoft);
  element.style.setProperty('--ps-on-accent', colors ? onAccent(colors) : PALETTE.surface.card);
}
