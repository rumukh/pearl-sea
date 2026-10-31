/**
 * The interface palette of Perlové moře: the turquoise, coral and sun of the shallows, sand and
 * pearl for paper, deep navy instead of black, and one accent per region that darkens toward the
 * deep (docs/plan.md §6). The painted art (S5) shares these hues; the UI reads them only through
 * the tokens published by design/tokens.ts.
 *
 * Every text pairing the stylesheets use is listed in ACCESSIBLE_PAIRS with its minimum WCAG
 * contrast, and test/unit/app/tokens.test.ts measures each one.
 */
export interface RegionAccent {
  /** A short name for designers. */
  readonly name: string;
  readonly accent: string;
  /** Text and edges on paper. */
  readonly deep: string;
  /** Tinted panels behind ink. */
  readonly soft: string;
  /** The label colour on the accent itself. */
  readonly onAccent: 'ink' | 'white';
}

export const PALETTE = {
  ink: {
    ink: '#12324a',
    inkSoft: '#2b4f69',
    inkMuted: '#4d6a80',
    inkInverse: '#fdf8f0',
  },
  surface: {
    paper: '#fdf8f0',
    paperDeep: '#f4e8d0',
    card: '#ffffff',
    line: '#d6e4e8',
    lineStrong: '#93b4bf',
    abyss: '#072f4f',
    abyssSoft: '#0e4870',
    shadow: '#0b2a40',
  },
  brand: {
    primary: '#0a6e80',
    primaryDeep: '#075866',
    primarySoft: '#d9f3f5',
    sun: '#ffd45c',
    sunDeep: '#8a5a00',
    coral: '#ff7f6b',
    coralDeep: '#b3402b',
    seaSurface: '#7fe0e6',
    seaShallow: '#1aa6b7',
    seaDeep: '#0b4f7c',
    sand: '#f6e3b4',
    pearl: '#fdf8f0',
  },
  feedback: {
    success: '#1f9d63',
    successDeep: '#14714a',
    successSoft: '#dcf5e8',
    miss: '#f08a24',
    missDeep: '#a35100',
    missSoft: '#ffecd6',
    info: '#2f8fe8',
    infoDeep: '#1b5fae',
    infoSoft: '#dbebfc',
  },
  /** Pearls in the Great Shell, from a cloudy pearl to a gold one. */
  mastery: {
    cloudy: '#a9b4bf',
    bronze: '#d98a3d',
    silver: '#cfd9e3',
    gold: '#ffcf33',
  },
  regions: {
    'sunny-lagoon': {
      name: 'Lagoon',
      accent: '#1fb5c4',
      deep: '#0b6f7a',
      soft: '#d6f4f6',
      onAccent: 'ink',
    },
    'coral-reef': {
      name: 'Coral',
      accent: '#ff7f6b',
      deep: '#b3402b',
      soft: '#ffe3dc',
      onAccent: 'ink',
    },
    'kelp-forest': {
      name: 'Kelp',
      accent: '#63b052',
      deep: '#2e6b22',
      soft: '#e2f2dc',
      onAccent: 'ink',
    },
    'pirate-wreck': {
      name: 'Driftwood',
      accent: '#d29559',
      deep: '#7a4a1c',
      soft: '#f5e4d1',
      onAccent: 'ink',
    },
    'pearl-bay': {
      name: 'Pearl',
      accent: '#e3a6cb',
      deep: '#9a4a7c',
      soft: '#f9e6f1',
      onAccent: 'ink',
    },
    'volcanic-vents': {
      name: 'Lava',
      accent: '#f47b3f',
      deep: '#a8401a',
      soft: '#fde2d4',
      onAccent: 'ink',
    },
    'ice-sea': {
      name: 'Ice',
      accent: '#7cc6f2',
      deep: '#2b6fa3',
      soft: '#e3f3fd',
      onAccent: 'ink',
    },
    'moon-caves': {
      name: 'Moonlight',
      accent: '#6a5ae6',
      deep: '#4b3bb8',
      soft: '#ebe7fe',
      onAccent: 'white',
    },
    'sunken-city': {
      name: 'Verdigris',
      accent: '#43b2a3',
      deep: '#1d6e63',
      soft: '#d9f2ee',
      onAccent: 'ink',
    },
    'dark-trench': {
      name: 'Indigo',
      accent: '#3f4fb8',
      deep: '#283377',
      soft: '#e1e4f7',
      onAccent: 'white',
    },
    'storm-sea': {
      name: 'Storm',
      accent: '#4f7299',
      deep: '#34506f',
      soft: '#e2eaf3',
      onAccent: 'white',
    },
    'kraken-abyss': {
      name: 'Ink',
      accent: '#7a3fa0',
      deep: '#4e2269',
      soft: '#efe2f6',
      onAccent: 'white',
    },
  } satisfies Record<string, RegionAccent>,
  /** Bubbles and confetti. */
  rainbow: ['#ff6b6b', '#ff9f40', '#ffd93d', '#5ccc6b', '#3ec5d6', '#4a8cff', '#a66cf0'],
} as const;

export type Palette = typeof PALETTE;
export type RegionId = keyof Palette['regions'];

/** The regions of the sea, shallow to deep (docs/plan.md §2). */
export const REGION_IDS = Object.keys(PALETTE.regions) as RegionId[];

export interface ContrastPair {
  /** Dotted palette keys, such as `ink.ink` or `regions.moon-caves.deep`; `white` is `#ffffff`. */
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
  readonly use: string;
}

/** Text needs 4.5:1 (7:1 for body text where we can), graphics 3:1 (WCAG 2.1 AA). */
export const ACCESSIBLE_PAIRS: readonly ContrastPair[] = [
  { fg: 'ink.ink', bg: 'surface.paper', min: 7, use: 'Body text on paper' },
  { fg: 'ink.ink', bg: 'surface.card', min: 7, use: 'Body text on cards' },
  { fg: 'ink.ink', bg: 'surface.paperDeep', min: 7, use: 'Body text on sand' },
  { fg: 'ink.inkSoft', bg: 'surface.paper', min: 7, use: 'Secondary text' },
  { fg: 'ink.inkMuted', bg: 'surface.paper', min: 4.5, use: 'Hints and captions' },
  { fg: 'ink.inkMuted', bg: 'surface.paperDeep', min: 4.5, use: 'Captions on sand' },
  { fg: 'ink.inkInverse', bg: 'surface.abyss', min: 7, use: 'Text in the abyss' },
  { fg: 'ink.inkInverse', bg: 'surface.abyssSoft', min: 7, use: 'Text on abyss panels' },
  { fg: 'brand.sun', bg: 'surface.abyss', min: 4.5, use: 'Highlights in the abyss' },
  { fg: 'surface.card', bg: 'brand.primary', min: 4.5, use: 'Primary button label' },
  { fg: 'surface.card', bg: 'brand.primaryDeep', min: 7, use: 'Pressed primary label' },
  { fg: 'brand.primaryDeep', bg: 'surface.paper', min: 7, use: 'Links and accents on paper' },
  { fg: 'ink.ink', bg: 'brand.primarySoft', min: 7, use: 'Text on the sea tint' },
  { fg: 'ink.ink', bg: 'brand.sun', min: 7, use: 'Sun button label' },
  { fg: 'ink.ink', bg: 'brand.coral', min: 4.5, use: 'Coral button label' },
  { fg: 'brand.coralDeep', bg: 'surface.paper', min: 4.5, use: 'Coral text' },
  { fg: 'brand.sunDeep', bg: 'surface.paper', min: 4.5, use: 'Coin counts and gold text' },
  { fg: 'surface.card', bg: 'brand.seaDeep', min: 7, use: 'Text on the deep sea' },
  { fg: 'feedback.successDeep', bg: 'surface.paper', min: 4.5, use: 'Correct text' },
  { fg: 'feedback.successDeep', bg: 'feedback.successSoft', min: 4.5, use: 'Correct banner' },
  { fg: 'surface.card', bg: 'feedback.successDeep', min: 4.5, use: 'Label on a correct badge' },
  { fg: 'surface.card', bg: 'feedback.success', min: 3, use: 'Check mark on green (graphic)' },
  { fg: 'feedback.missDeep', bg: 'surface.paper', min: 4.5, use: 'Almost text' },
  { fg: 'feedback.missDeep', bg: 'feedback.missSoft', min: 4.5, use: 'Almost banner' },
  { fg: 'ink.ink', bg: 'feedback.miss', min: 4.5, use: 'Label on an orange badge' },
  { fg: 'feedback.infoDeep', bg: 'surface.paper', min: 4.5, use: 'Info text' },
  { fg: 'feedback.infoDeep', bg: 'feedback.infoSoft', min: 4.5, use: 'Info banner' },
];

/** The colour behind a dotted palette key such as `brand.primary` or `regions.ice-sea.deep`. */
export function paletteColor(key: string): string {
  if (key === 'white') return '#ffffff';
  let node: unknown = PALETTE;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) {
      throw new Error(`Unknown palette key: ${key}`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') throw new Error(`Palette key is not a colour: ${key}`);
  return node;
}
