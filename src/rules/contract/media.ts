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
 * | a character; Osmička cheering    | `character/<character>`, `character/osmicka/happy` | painted |
 * | a diver avatar                   | `avatar/<diver-n>`                   | painted |
 * | a cosmetic                       | `cosmetic/<item>`                    | svg     |
 * | the crowned stage's crown        | `cosmetic/shell-crown`               | svg     |
 * | a sticker                        | `sticker/<sticker>`                  | svg     |
 *
 * A crowned friend is its grown painting plus the golden shell crown (`CROWN_ART_ID`) on the
 * `head` anchor. Eggs, cosmetics, the crown and sticker art are static SVG files that S5 makes and
 * lists in the art catalog; the shell (S4) renders them.
 */
import { schema } from '@aegis/runtime';
import type { Schema } from '@aegis/runtime';
import { ART_ANCHORS, CHARACTER_IDS, DIVER_AVATARS, GUIDE_ID } from './ids';
import type { ArtAnchor, CharacterId, DiverAvatar, MonsterForm, PaintedStage, SeaMap } from './ids';
import { artId, int, objectWithOptional, oneOf, refine } from './schema';

export const ART_CATALOG_PATH = 'assets/art/catalog.json';
export const ART_CATALOG_FORMAT = 'pearl-sea-art-catalog/1';

/** Extra character paintings beyond the portraits: Osmička cheering (praise, results). */
export const CHARACTER_POSES = ['happy'] as const;
export type CharacterPose = (typeof CHARACTER_POSES)[number];

export const ART = {
  friend: (friend: string, stage: PaintedStage) => `friend/${friend}/${stage}`,
  egg: (friend: string) => `egg/${friend}`,
  monster: (monster: string, form: MonsterForm) => `monster/${monster}/${form}`,
  inkoustik: (inkoustik: string) => `inkoustik/${inkoustik}`,
  scene: (scene: string) => `scene/${scene}`,
  map: (map: SeaMap) => `map/${map}`,
  /** A character's portrait, or one of its poses (only `character/osmicka/happy` is painted). */
  character: (character: CharacterId, pose?: CharacterPose) =>
    pose === undefined ? `character/${character}` : `character/${character}/${pose}`,
  avatar: (avatar: DiverAvatar) => `avatar/${avatar}`,
  cosmetic: (item: string) => `cosmetic/${item}`,
  sticker: (sticker: string) => `sticker/${sticker}`,
} as const;

/** Every character painting: the three portraits and Osmička cheering. */
export const CHARACTER_ART_IDS: readonly string[] = [
  ...CHARACTER_IDS.map((character) => ART.character(character)),
  ART.character(GUIDE_ID, 'happy'),
];

/**
 * The crowned stage's golden shell crown: a cosmetic SVG that sits on the friend's `head` anchor by
 * the cosmetic anchor scale, the centre of its base at the viewBox centre. It is never a cosmetic
 * item, sold or given (design §8.2): shop crowns have art of their own.
 */
export const CROWN_ART_ID = ART.cosmetic('shell-crown');

/**
 * Art the shell shows directly rather than through content (`collectArtIds`): the characters,
 * the diver avatars, the title, the home grotto and the crowned stage's crown. The content gate
 * checks them against the art catalog too.
 */
export const SHELL_ART_IDS: readonly string[] = [
  ...CHARACTER_ART_IDS,
  ...DIVER_AVATARS.map((avatar) => ART.avatar(avatar)),
  ART.scene('title'),
  ART.scene('grotto'),
  CROWN_ART_ID,
];

/**
 * Where an SVG cosmetic sits on a painted friend: `x` and `y` in thousandths of the image box
 * (0..1000 from the top left), the cosmetic's `scale` in percent of its base size
 * (`COSMETIC_BASE_WIDTH`), and its `rotate` in degrees. Integers only.
 */
export interface AnchorPoint {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

/**
 * The cosmetic anchor scale. A cosmetic SVG (`cosmetic/<item>`) has a `0 0 100 100` viewBox
 * (`COSMETIC_VIEWBOX`) with its attachment point at the centre (50, 50): a hat's brim centre, the
 * goggles' bridge, a scarf's knot. An anchor puts that centre at (`x`, `y`) on the painting. At
 * `scale` 100 the cosmetic is drawn `COSMETIC_BASE_WIDTH` thousandths of the painting's width
 * wide (250: a quarter), and as tall, since the viewBox is square; at other scales `scale`
 * percent of that; turned `rotate` degrees about its centre. Grotto decorations (slot `grotto`)
 * share the viewBox and sit on the grotto's spots instead of anchors.
 */
export const COSMETIC_VIEWBOX = 100;
export const COSMETIC_BASE_WIDTH = 250;

/** A cosmetic's square box on a painting: its top left, its side and its turn. */
export interface CosmeticPlacement {
  left: number;
  top: number;
  size: number;
  rotate: number;
}

/**
 * Where a cosmetic is drawn on a painting `width` × `height` (in any unit, the result in the same
 * unit), by the cosmetic anchor scale.
 */
export function cosmeticPlacement(
  anchor: AnchorPoint,
  width: number,
  height: number,
): CosmeticPlacement {
  const size = (width * COSMETIC_BASE_WIDTH * anchor.scale) / 100_000;
  return {
    left: (width * anchor.x) / 1000 - size / 2,
    top: (height * anchor.y) / 1000 - size / 2,
    size,
    rotate: anchor.rotate,
  };
}

/**
 * One published art file. Painted friends publish their anchors. For an SVG, `width` and
 * `height` are its viewBox size, so a cosmetic's are `COSMETIC_VIEWBOX` × `COSMETIC_VIEWBOX`.
 */
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

export const artCatalogSchema: Schema<ArtCatalog> = refine(
  schema.object({
    format: schema.literal(ART_CATALOG_FORMAT),
    entries: schema.array(artEntrySchema, { max: 4096 }),
  }),
  (catalog) => {
    const cosmetic = catalog.entries.find(
      (entry) =>
        entry.id.startsWith('cosmetic/') &&
        (entry.kind !== 'svg' ||
          entry.width !== COSMETIC_VIEWBOX ||
          entry.height !== COSMETIC_VIEWBOX),
    );
    return cosmetic === undefined
      ? null
      : `${cosmetic.id}: a cosmetic is an SVG with a ${COSMETIC_VIEWBOX} × ${COSMETIC_VIEWBOX} viewBox.`;
  },
);

// ---------------------------------------------------------------------------------------------
// Audio

/** S5's audio manifest: Dragon Valley's format, renamed (S4 reads it into the shell's map). */
export const AUDIO_MANIFEST_PATH = 'assets/audio/manifest.json';
export const AUDIO_MANIFEST_SCHEMA = 'pearl-sea-audio-manifest/1';

/**
 * Music loops (ACE-Step 1.5, local), one per mood of play: the grotto (the title, the grotto,
 * story, the shop, the album, the Shell, results), the map, practice, battles and the finale.
 * There is no victory loop: a freed monster gets the one-shot `VICTORY_STING`.
 */
export const MUSIC_IDS = [
  'music/grotto',
  'music/map',
  'music/practice',
  'music/battle',
  'music/finale',
] as const;
export type MusicId = (typeof MUSIC_IDS)[number];

/** Loops the audio pack may leave out: the finale's. */
export const OPTIONAL_MUSIC_IDS: readonly MusicId[] = ['music/finale'];

/** The loop a mood plays when the pack has no loop of its own for it: the grotto's. */
export const MUSIC_FALLBACK: MusicId = 'music/grotto';

/**
 * The loop to play for a mood's `loop`: the loop itself when the pack has it (`available`), else
 * `MUSIC_FALLBACK` (and silence when even that is missing).
 */
export function musicLoop(loop: MusicId, available: ReadonlySet<string>): MusicId | null {
  if (available.has(loop)) return loop;
  return available.has(MUSIC_FALLBACK) ? MUSIC_FALLBACK : null;
}

/** The one-shot played when a monster is freed (`monster.freed`): the approved 9-second take. */
export const VICTORY_STING = 'sfx/victory-sting';

/** Sound IDs: `music/<loop>` and `sfx/<name>` (bubble, splash, pearl-chime, ink-splat, …). */
export const AUDIO_ID_PATTERN = /^(music|sfx)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
