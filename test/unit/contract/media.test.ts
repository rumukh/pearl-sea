/**
 * The art and audio conventions (media.ts): the character paintings and the art the shell shows,
 * the cosmetic anchor scale and the art catalog's cosmetic rule, and the music loops with their
 * fallback and the victory sting.
 */
import { describe, expect, it } from 'vitest';
import {
  ART_ID_PATTERN,
  AUDIO_ID_PATTERN,
  artCatalogSchema,
  CHARACTER_ART_IDS,
  COSMETIC_BASE_WIDTH,
  COSMETIC_VIEWBOX,
  cosmeticPlacement,
  CROWN_ART_ID,
  MUSIC_FALLBACK,
  MUSIC_IDS,
  musicLoop,
  OPTIONAL_MUSIC_IDS,
  SHELL_ART_IDS,
  VICTORY_STING,
} from '../../../src/rules/contract';

describe('art conventions', () => {
  it('names every character painting, Osmička cheering included', () => {
    expect(CHARACTER_ART_IDS).toEqual([
      'character/osmicka',
      'character/mroz-vousac',
      'character/bublinka',
      'character/osmicka/happy',
    ]);
  });

  it('lists the art the shell shows outside content: characters, avatars, title, grotto, crown', () => {
    expect(CROWN_ART_ID).toBe('cosmetic/shell-crown');
    expect(SHELL_ART_IDS).toEqual([
      ...CHARACTER_ART_IDS,
      'avatar/diver-1',
      'avatar/diver-2',
      'avatar/diver-3',
      'avatar/diver-4',
      'avatar/diver-5',
      'avatar/diver-6',
      'avatar/diver-7',
      'avatar/diver-8',
      'scene/title',
      'scene/grotto',
      'cosmetic/shell-crown',
    ]);
    expect(new Set(SHELL_ART_IDS).size).toBe(SHELL_ART_IDS.length);
    for (const id of SHELL_ART_IDS) expect(id, id).toMatch(ART_ID_PATTERN);
  });

  it('draws a cosmetic a quarter of the painting wide at scale 100, centred on its anchor', () => {
    expect(COSMETIC_VIEWBOX).toBe(100);
    expect(COSMETIC_BASE_WIDTH).toBe(250);
    const head = { x: 500, y: 200, scale: 100, rotate: -10 };
    expect(cosmeticPlacement(head, 800, 1000)).toEqual({
      left: 300,
      top: 100,
      size: 200,
      rotate: -10,
    });
    expect(cosmeticPlacement({ ...head, scale: 50 }, 800, 1000)).toEqual({
      left: 350,
      top: 150,
      size: 100,
      rotate: -10,
    });
    // The size follows the painting's width only; x follows the width and y the height.
    expect(cosmeticPlacement({ x: 250, y: 900, scale: 200, rotate: 15 }, 1000, 500)).toEqual({
      left: 0,
      top: 200,
      size: 500,
      rotate: 15,
    });
  });

  it('accepts a cosmetic in the art catalog only as an SVG with a 100 × 100 viewBox', () => {
    const catalog = (entry: object) => ({
      format: 'pearl-sea-art-catalog/1',
      entries: [
        {
          id: 'friend/krab-tvrdak/grown',
          kind: 'painted',
          file: 'friend/krab-tvrdak/grown.webp',
          width: 1024,
          height: 1024,
          anchors: { head: { x: 480, y: 120, scale: 100, rotate: 0 } },
        },
        entry,
      ],
    });
    const hat = {
      id: 'cosmetic/hat-captain',
      kind: 'svg',
      file: 'cosmetic/hat-captain.svg',
      width: 100,
      height: 100,
    };
    expect(artCatalogSchema.parse(catalog(hat)).ok).toBe(true);
    const sticker = { ...hat, id: 'sticker/first-pearl', width: 256, height: 256 };
    expect(artCatalogSchema.parse(catalog(sticker)).ok).toBe(true);
    for (const bad of [
      { ...hat, kind: 'painted' },
      { ...hat, width: 512, height: 512 },
      { ...hat, height: 120 },
    ]) {
      const parsed = artCatalogSchema.parse(catalog(bad));
      expect(parsed.ok ? [] : parsed.error.diagnostics.map((d) => d.message)).toEqual([
        'cosmetic/hat-captain: a cosmetic is an SVG with a 100 × 100 viewBox.',
      ]);
    }
    // The crowned stage's crown is cosmetic art too, so it follows the same scale.
    const crown = { ...hat, id: CROWN_ART_ID, file: 'cosmetic/shell-crown.svg' };
    expect(artCatalogSchema.parse(catalog(crown)).ok).toBe(true);
    const bigCrown = artCatalogSchema.parse(catalog({ ...crown, width: 512, height: 512 }));
    expect(bigCrown.ok ? [] : bigCrown.error.diagnostics.map((d) => d.message)).toEqual([
      'cosmetic/shell-crown: a cosmetic is an SVG with a 100 × 100 viewBox.',
    ]);
  });
});

describe('audio conventions', () => {
  it('has five music loops, the finale optional, and a victory sting instead of a loop', () => {
    expect([...MUSIC_IDS]).toEqual([
      'music/grotto',
      'music/map',
      'music/practice',
      'music/battle',
      'music/finale',
    ]);
    expect(OPTIONAL_MUSIC_IDS).toEqual(['music/finale']);
    expect(MUSIC_FALLBACK).toBe('music/grotto');
    expect(VICTORY_STING).toBe('sfx/victory-sting');
    for (const id of [...MUSIC_IDS, VICTORY_STING]) expect(id, id).toMatch(AUDIO_ID_PATTERN);
  });

  it('plays a mood’s own loop, else the grotto loop, else silence', () => {
    const all = new Set<string>(MUSIC_IDS);
    for (const loop of MUSIC_IDS) expect(musicLoop(loop, all)).toBe(loop);
    const required = new Set<string>(MUSIC_IDS.filter((id) => !OPTIONAL_MUSIC_IDS.includes(id)));
    expect(musicLoop('music/finale', required)).toBe('music/grotto');
    expect(musicLoop('music/battle', new Set(['music/grotto']))).toBe('music/grotto');
    expect(musicLoop('music/map', new Set(['music/battle']))).toBeNull();
  });
});
