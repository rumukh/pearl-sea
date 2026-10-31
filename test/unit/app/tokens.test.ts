/**
 * Design tokens come from the interface palette and the SDK's child-safe preset; every text
 * pairing the stylesheets use meets its WCAG contrast; and the stylesheets read no colour or size
 * that is not a published token or a local variable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_SAFE_PRESET } from '@aegis/browser/ui';
import { describe, expect, it } from 'vitest';
import {
  ACCESSIBLE_PAIRS,
  PALETTE,
  paletteColor,
  REGION_IDS,
} from '../../../src/app/design/palette';
import { tokenEntries } from '../../../src/app/design/tokens';

/** Custom properties set locally by components or the SDK rather than by the token table. */
const LOCAL = new Set([
  '--ps-accent',
  '--ps-accent-deep',
  '--ps-accent-soft',
  '--ps-on-accent',
  '--aegis-text-scale',
  '--face',
  '--lip',
  '--label',
  '--value',
  '--progress',
  '--size',
  '--x',
  '--y',
  '--w',
  '--h',
  '--paper-width',
  '--paper-height',
  '--paper-ratio',
  '--paper-pt',
  '--font-pt',
]);

/** The regions of the plan (docs/plan.md §2), shallow to deep. */
const PLAN_REGIONS = [
  'sunny-lagoon',
  'coral-reef',
  'kelp-forest',
  'pirate-wreck',
  'pearl-bay',
  'volcanic-vents',
  'ice-sea',
  'moon-caves',
  'sunken-city',
  'dark-trench',
  'storm-sea',
  'kraken-abyss',
];

function files(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

/** x^2.4 on [0, 1] with plain arithmetic (the test rules ban Math.pow): the fifth root of x^12. */
function pow24(x: number): number {
  const x4 = x * x * (x * x);
  const target = x4 * x4 * x4;
  let root = 1;
  for (let step = 0; step < 100; step++) {
    const fourth = root * root * (root * root);
    root = (4 * root + target / fourth) / 5;
  }
  return root;
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const share = channel / 255;
    return share <= 0.03928 ? share / 12.92 : pow24((share + 0.055) / 1.055);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('design tokens', () => {
  const tokens = new Map(tokenEntries());

  it('publish the palette under predictable names', () => {
    expect(tokens.get('--ps-ink')).toBe(PALETTE.ink.ink);
    expect(tokens.get('--ps-paper')).toBe(PALETTE.surface.paper);
    expect(tokens.get('--ps-primary-deep')).toBe(PALETTE.brand.primaryDeep);
    expect(tokens.get('--ps-sea-surface')).toBe(PALETTE.brand.seaSurface);
    expect(tokens.get('--ps-success-soft')).toBe(PALETTE.feedback.successSoft);
    expect(tokens.get('--ps-mastery-gold')).toBe(PALETTE.mastery.gold);
    expect(tokens.get('--ps-rainbow-7')).toBe(PALETTE.rainbow[6]);
  });

  it('give every region of the sea its accent, deep, soft and label colours', () => {
    expect(REGION_IDS).toEqual(PLAN_REGIONS);
    for (const region of PLAN_REGIONS) {
      for (const part of ['accent', 'deep', 'soft', 'on-accent']) {
        expect(tokens.has(`--ps-region-${region}-${part}`), `${region} ${part}`).toBe(true);
      }
    }
  });

  it('derive sizes from the SDK child-safe preset', () => {
    expect(tokens.get('--ps-target')).toBe(`${CHILD_SAFE_PRESET.targetPixels}px`);
    expect(tokens.get('--ps-reading')).toBe(`${CHILD_SAFE_PRESET.readingPixels}px`);
    expect(CHILD_SAFE_PRESET.targetPixels).toBeGreaterThanOrEqual(48);
    expect(CHILD_SAFE_PRESET.readingPixels).toBeGreaterThanOrEqual(24);
  });

  it('measure the contrast arithmetic against known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('keep every listed text pairing at its WCAG contrast', () => {
    const weak: string[] = [];
    for (const pair of ACCESSIBLE_PAIRS) {
      const ratio = contrast(paletteColor(pair.fg), paletteColor(pair.bg));
      if (ratio < pair.min) weak.push(`${pair.use}: ${ratio.toFixed(2)} < ${pair.min}`);
    }
    expect(weak).toEqual([]);
  });

  it('keep every region accent readable: its label on it, its deep on paper, ink on its soft', () => {
    const weak: string[] = [];
    for (const region of PLAN_REGIONS) {
      const label = paletteColor(`regions.${region}.onAccent`) === 'white' ? 'white' : 'ink.ink';
      const checks: [string, string, number][] = [
        [label, `regions.${region}.accent`, 4.5],
        [`regions.${region}.deep`, 'surface.paper', 4.5],
        ['ink.ink', `regions.${region}.soft`, 7],
      ];
      for (const [fg, bg, min] of checks) {
        const ratio = contrast(paletteColor(fg), paletteColor(bg));
        if (ratio < min) weak.push(`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
      }
    }
    expect(weak).toEqual([]);
  });

  it('are the only custom properties the stylesheets and components read', () => {
    const sources = [
      ...files(join('src', 'app', 'styles'), '.css'),
      ...files(join('src', 'app'), '.ts'),
    ];
    const unknown = new Set<string>();
    for (const path of sources) {
      for (const match of readFileSync(path, 'utf8').matchAll(/var\((--[a-z0-9-]+)[,)]/g)) {
        const name = match[1]!;
        if (!tokens.has(name) && !LOCAL.has(name)) unknown.add(`${path}: ${name}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('keep raw colours out of the stylesheets, except the pre-boot splash and the backdrop', () => {
    const offenders: string[] = [];
    for (const path of files(join('src', 'app', 'styles'), '.css')) {
      const css = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\.ps-splash[\s\S]*?\n}\n/g, '')
        .replace(/::backdrop\s*{[^}]*}/g, '')
        .replace(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g, '');
      for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) {
        offenders.push(`${path}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
