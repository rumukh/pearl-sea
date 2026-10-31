/**
 * Canonical identifiers shared by rules, content, art (S5), audio (S5) and the shell (S4).
 *
 * Two kinds of lists live here:
 *
 * - **Closed vocabularies** whose meaning is implemented in code: friend growth stages,
 *   expressions, monster forms, cosmetic slots and art anchors, mastery levels (pearls), diver
 *   avatars and forms of address. Adding a value is a code change and a contract change.
 * - **Canonical v1 content IDs**: the regions, sea friends, monsters, Inkoustíci and characters
 *   that version 1 ships (docs/design.md §3). Content is open: a later content revision may add
 *   more with new IDs, so schemas accept any well-formed ID and these lists check the v1 pack and
 *   key art and audio.
 *
 * IDs are stable forever once shipped: saves, the art catalog and the audio manifest refer to
 * them. Never rename or reuse one; retire it with a content migration instead (docs/contract.md).
 */

/** Lower-case words of a-z and 0-9 joined by `.`, `:` or `-`; at most 64 characters. */
export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/;
export const CONTENT_ID_MAX_LENGTH = 64;

export function isContentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= CONTENT_ID_MAX_LENGTH &&
    CONTENT_ID_PATTERN.test(value)
  );
}

/** The twelve v1 regions, in map order: the shallows (3rd grade), then the deep (4th grade). */
export const CANONICAL_REGION_IDS = [
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
] as const;
export type CanonicalRegionId = (typeof CANONICAL_REGION_IDS)[number];

/** The two sea maps: the sunny shallows (regions 1-7) and the deep (regions 8-12). */
export const SEA_MAPS = ['shallows', 'deep'] as const;
export type SeaMap = (typeof SEA_MAPS)[number];

/** The three lagoon friends offered as the first egg; the child chooses one. */
export const FIRST_FRIEND_CHOICES = ['krab-tvrdak', 'meduzka-mekulka', 'zelva-obojka'] as const;

/** The eighteen v1 sea friends, in the order they join (region order). */
export const CANONICAL_FRIEND_IDS = [
  'krab-tvrdak',
  'meduzka-mekulka',
  'zelva-obojka',
  'barakuda-bystrinka',
  'lachtan-lyzar',
  'konik-mydlinek',
  'pyskoun-pysny',
  'jezik-sycik',
  'vydra-vyskalka',
  'jazyk-jazycek',
  'hvezdice-rodinka',
  'kalmar-desetiruky',
  'tulen-padik',
  'delfin-skokanek',
  'rak-korinek',
  'stitovec-prisavka',
  'klipka-vzorna',
  'klauni-dvojcata',
] as const;
export type CanonicalFriendId = (typeof CANONICAL_FRIEND_IDS)[number];

/** The twelve v1 region monsters, in region order. Freed monsters join the friends' gallery. */
export const CANONICAL_MONSTER_IDS = [
  'murena-mumla',
  'zralok-zrout',
  'had-zamotal',
  'das-lucernik',
  'zeva-lakoma',
  'uhor-zhavak',
  'san-ledana',
  'humr-nuzkar',
  'meduza-lepka',
  'chobotnice-napodobnice',
  'vir-casoplet',
  'krakatice-inkoustova',
] as const;
export type CanonicalMonsterId = (typeof CANONICAL_MONSTER_IDS)[number];

/** The 3rd grader's finale before the deep. */
export const GRADE_3_FINALE_MONSTER_ID = 'san-ledana';
/** The grand finale: ten inky arms, one curriculum strand per arm. */
export const FINALE_MONSTER_ID = 'krakatice-inkoustova';

/** The four Inkoustíci: little ink monsters that ambush a round now and then. */
export const CANONICAL_INKOUSTIK_IDS = [
  'inkoustik-kanka',
  'inkoustik-smouha',
  'inkoustik-cmara',
  'inkoustik-klikyhak',
] as const;
export type CanonicalInkoustikId = (typeof CANONICAL_INKOUSTIK_IDS)[number];

/** Characters, not raisable: the guide, the shopkeeper and the player's submarine. */
export const GUIDE_ID = 'osmicka';
export const SHOPKEEPER_ID = 'mroz-vousac';
export const SUBMARINE_ID = 'bublinka';
export const CHARACTER_IDS = [GUIDE_ID, SHOPKEEPER_ID, SUBMARINE_ID] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

/** Sea friend growth stages, in order. Friends never shrink: a stage index only increases. */
export const FRIEND_STAGES = ['egg', 'baby', 'grown', 'crowned'] as const;
export type FriendStage = (typeof FRIEND_STAGES)[number];
/** Stages with painted art; an egg is SVG, and crowned is the grown painting plus a shell crown. */
export const PAINTED_STAGES = ['baby', 'grown'] as const;
export type PaintedStage = (typeof PAINTED_STAGES)[number];

/** Expression hints the rules project for the shell. Presentation only; never authoritative. */
export const FRIEND_EXPRESSIONS = [
  'idle',
  'happy',
  'curious',
  'eating',
  'sleepy',
  'proud',
] as const;
export type FriendExpression = (typeof FRIEND_EXPRESSIONS)[number];

/** A monster is painted twice: soaked in ink, and washed clean. */
export const MONSTER_FORMS = ['inked', 'freed'] as const;
export type MonsterForm = (typeof MONSTER_FORMS)[number];

/** Cosmetic slots: worn on a friend (`head`, `eyes`, `neck`) or placed in the grotto. */
export const COSMETIC_SLOTS = ['head', 'eyes', 'neck', 'grotto'] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
/** Anchor points painted friends publish so SVG cosmetics sit on them (docs/contract.md §7.5). */
export const ART_ANCHORS = ['head', 'eyes', 'neck'] as const;
export type ArtAnchor = (typeof ART_ANCHORS)[number];

/** Diver (player) avatars offered when a child profile is created. */
export const DIVER_AVATARS = [
  'diver-1',
  'diver-2',
  'diver-3',
  'diver-4',
  'diver-5',
  'diver-6',
  'diver-7',
  'diver-8',
] as const;
export type DiverAvatar = (typeof DIVER_AVATARS)[number];

/**
 * How the game addresses a child (a profile preference, never game state): grammatical gender of
 * praise in Czech (Dokázal jsi to! / Dokázala jsi to!), or gender-neutral phrasing.
 */
export const FORMS_OF_ADDRESS = ['boy', 'girl', 'neutral'] as const;
export type FormOfAddress = (typeof FORMS_OF_ADDRESS)[number];

/** Per-item mastery, shown as pearls in the Great Shell and used for friend growth. */
export const MASTERY_LEVELS = ['cloudy', 'bronze', 'silver', 'gold'] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];
