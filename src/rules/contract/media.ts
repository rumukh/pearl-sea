/**
 * Art and audio reference conventions: how content, rules and the shell name painted art, SVG art,
 * music and sounds, and the formats the art pipeline and the audio pipeline (S5, local models
 * only: docs/assets.md) publish.
 *
 * Art IDs (`artId`, schema.ts) are paths of lower-case IDs:
 *
 * | Art                              | ID                                   | Kind    |
 * | -------------------------------- | ------------------------------------ | ------- |
 * | a sea friend, baby or grown up   | `friend/<friend>/baby`, `…/grown`    | painted |
 * | a friend's egg                   | `egg/<friend>`                       | svg     |
 * | a monster, inked or freed        | `monster/<monster>/inked`, `…/freed` | painted |
 * | an Inkoustík                     | `inkoustik/<inkoustik>`              | painted |
 * | a region scene, the grotto, title| `scene/<region>`, `scene/grotto`, `scene/title` | painted |
 * | the two sea maps                 | `map/shallows`, `map/deep`           | painted |
 * | a character                      | `character/<character>`              | painted |
 * | a diver avatar                   | `avatar/<diver-n>`                   | painted |
 * | a cosmetic                       | `cosmetic/<item>`                    | svg     |
 * | a sticker                        | `sticker/<sticker>`                  | svg     |
 *
 * A crowned friend is its grown painting plus an SVG shell crown on the `head` anchor.
 */
import { schema } from '@aegis/runtime';
import type { Schema } from '@aegis/runtime';
import { ART_ANCHORS } from './ids';
import type { ArtAnchor, CharacterId, DiverAvatar, MonsterForm, PaintedStage, SeaMap } from './ids';
import { artId, int, objectWithOptional, oneOf } from './schema';

export const ART_CATALOG_PATH = 'assets/art/catalog.json';
export const ART_CATALOG_FORMAT = 'pearl-sea-art-catalog/1';

export const ART = {
  friend: (friend: string, stage: PaintedStage) => `friend/${friend}/${stage}`,
  egg: (friend: string) => `egg/${friend}`,
  monster: (monster: string, form: MonsterForm) => `monster/${monster}/${form}`,
  inkoustik: (inkoustik: string) => `inkoustik/${inkoustik}`,
  scene: (scene: string) => `scene/${scene}`,
  map: (map: SeaMap) => `map/${map}`,
  character: (character: CharacterId) => `character/${character}`,
  avatar: (avatar: DiverAvatar) => `avatar/${avatar}`,
  cosmetic: (item: string) => `cosmetic/${item}`,
  sticker: (sticker: string) => `sticker/${sticker}`,
} as const;

/**
 * Where an SVG cosmetic sits on a painted friend: `x` and `y` in thousandths of the image box
 * (0..1000 from the top left), the cosmetic's `scale` in percent of its natural size, and its
 * `rotate` in degrees. Integers only.
 */
export interface AnchorPoint {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

/** One published art file. Painted friends publish their anchors. */
export interface ArtEntry {
  id: string;
  kind: 'painted' | 'svg';
  /** Path relative to `assets/art/`. */
  file: string;
  width: number;
  height: number;
  anchors?: Partial<Record<ArtAnchor, AnchorPoint>>;
}

export interface ArtCatalog {
  format: typeof ART_CATALOG_FORMAT;
  entries: ArtEntry[];
}

export const anchorPointSchema: Schema<AnchorPoint> = schema.object({
  x: int(0, 1000),
  y: int(0, 1000),
  scale: int(10, 400),
  rotate: int(-180, 180),
});

export const artEntrySchema: Schema<ArtEntry> = objectWithOptional(
  {
    id: artId,
    kind: oneOf(['painted', 'svg'] as const),
    file: schema.string({ minLength: 1, maxLength: 200, pattern: /^[a-z0-9][a-z0-9/._-]*$/ }),
    width: int(1, 8192),
    height: int(1, 8192),
  },
  {
    anchors: objectWithOptional(
      {},
      Object.fromEntries(ART_ANCHORS.map((anchor) => [anchor, anchorPointSchema])) as Record<
        ArtAnchor,
        Schema<AnchorPoint>
      >,
    ),
  },
);

export const artCatalogSchema: Schema<ArtCatalog> = schema.object({
  format: schema.literal(ART_CATALOG_FORMAT),
  entries: schema.array(artEntrySchema, { max: 4096 }),
});

// ---------------------------------------------------------------------------------------------
// Audio

/** S5's audio manifest: Dragon Valley's format, renamed (S4 reads it into the shell's map). */
export const AUDIO_MANIFEST_PATH = 'assets/audio/manifest.json';
export const AUDIO_MANIFEST_SCHEMA = 'pearl-sea-audio-manifest/1';

/** Music loops (ACE-Step 1.5, local): six, one per mood of play. */
export const MUSIC_IDS = [
  'music/grotto',
  'music/map',
  'music/practice',
  'music/battle',
  'music/victory',
  'music/finale',
] as const;
export type MusicId = (typeof MUSIC_IDS)[number];

/** Sound IDs: `music/<loop>` and `sfx/<name>` (bubble, splash, pearl-chime, ink-splat, …). */
export const AUDIO_ID_PATTERN = /^(music|sfx)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
