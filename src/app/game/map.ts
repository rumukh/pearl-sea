/**
 * Where things sit on the painted sea maps (`map/shallows` for the 3rd grade, `map/deep` for the
 * 4th) and on a region's scene, in thousandths of the picture's box. The paintings have open
 * water where these spots are (docs/design.md §12), so the shell draws its markers and level
 * nodes over them; a region the table does not know (later content) gets a spot from its order.
 */
import type { SeaMap } from '../../rules/contract';

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Region markers on the two maps: a winding way from the lagoon to the ice, and down the deep. */
export const REGION_SPOTS: Readonly<Record<string, Spot>> = {
  'sunny-lagoon': { x: 150, y: 790 },
  'coral-reef': { x: 360, y: 660 },
  'kelp-forest': { x: 200, y: 430 },
  'pirate-wreck': { x: 460, y: 330 },
  'pearl-bay': { x: 650, y: 560 },
  'volcanic-vents': { x: 800, y: 360 },
  'ice-sea': { x: 860, y: 140 },
  'moon-caves': { x: 150, y: 200 },
  'sunken-city': { x: 420, y: 300 },
  'dark-trench': { x: 280, y: 620 },
  'storm-sea': { x: 640, y: 480 },
  'kraken-abyss': { x: 830, y: 800 },
};

/** A region's spot on its map: from the table, else spread by its order on that map. */
export function regionSpot(regionId: string, indexOnMap: number, onMap: number): Spot {
  const known = REGION_SPOTS[regionId];
  if (known) return known;
  const share = onMap <= 1 ? 0.5 : indexOnMap / (onMap - 1);
  return { x: Math.round(120 + share * 760), y: Math.round(820 - share * 640) };
}

/**
 * Level nodes on a region's scene: a gentle zigzag from the bottom left up to the monster at the
 * top right, whatever the number of levels.
 */
export function levelSpots(count: number): Spot[] {
  return Array.from({ length: count }, (_, index) => {
    const share = count <= 1 ? 0.5 : index / (count - 1);
    const zig = index % 2 === 0 ? -1 : 1;
    return {
      x: Math.round(110 + share * 780),
      y: Math.round(760 - share * 520 + zig * 70),
    };
  });
}

export function mapOf(regions: readonly { readonly map: SeaMap }[], map: SeaMap): number {
  return regions.filter((region) => region.map === map).length;
}
