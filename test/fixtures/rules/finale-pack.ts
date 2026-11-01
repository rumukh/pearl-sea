/**
 * The finales on the rules' lagoon fixture (design §3.7, §3.12, §7.2, §7.3, §9.1): the lagoon
 * fixture (lagoon-pack.ts) with
 *
 * - Ledové moře (`ice-sea`, the 3rd grade, after Murena Mumla): one lesson and Mořská saň Ledana,
 *   the 3rd grade's finale (`arms: 6`, `gradeFinale: 3`, meter 18, battle count 24);
 * - Měsíční jeskyně unlocked after Ledana's level rather than Murena's (design §9.1), still the 4th
 *   grade's start;
 * - Krakatičí propast (`kraken-abyss`, the 4th grade, after Humr Nůžkař): the Krakatice Inkoustová,
 *   the grand finale (`arms: 10`, `finale`, meter 30);
 * - Ledana's freed beat and `beat.finale`, a sticker for each finale.
 *
 * Each icicle and arm serves one problem skill of the fixture, in the order of
 * `LEDANA_ARM_SKILLS` and `KRAKATICE_ARM_SKILLS` (deliberately not the skills' content order).
 * No two skills of one finale share an item and every one of them asks a single gap, so a served
 * item tells its arm, and three right answers are three problems. Two spelling skills split the
 * lagoon's dě tě ně skill (which may ask two gaps of dítě) by rule, so the Krakatice has ten.
 * Neither finale has a review share (design §7.2, §7.3).
 *
 * The design's cap for the Krakatice is 40 problems, but an activity's `count` is at most 30 in
 * the contract, so her battle counts 30 (cap max(30, 30 + 5) = 35).
 */
import type { ContentPack } from '@aegis/runtime';
import type { NarrativeGraph } from '@aegis/narrative';
import { FINALE_MONSTER_ID, GRADE_3_FINALE_MONSTER_ID } from '../../../src/rules/contract';
import type { ContentData, Level, Skill } from '../../../src/rules/contract';
import { lagoonPackWith } from './packs';

export const LEDANA = GRADE_3_FINALE_MONSTER_ID;
export const KRAKATICE = FINALE_MONSTER_ID;
export const ICE_SEA_LESSON = 'ice-sea.1';
export const LEDANA_LEVEL = 'ice-sea.monster';
export const KRAKATICE_LEVEL = 'kraken-abyss.monster';

/** Ledana's six icicles: the skill each one serves, in the order they melt. */
export const LEDANA_ARM_SKILLS: readonly string[] = [
  'sk.lagoon.u',
  'sk.lagoon.hard',
  'sk.lagoon.capitals',
  'sk.lagoon.soft',
  'sk.lagoon.length',
  'sk.lagoon.bepeveme',
];

/** The Krakatice's ten arms: the skill each one serves, in the order they are washed. */
export const KRAKATICE_ARM_SKILLS: readonly string[] = [
  'sk.lagoon.capitals',
  'sk.finale.di-ti-ni',
  'sk.lagoon.hard',
  'sk.caves.bjevje',
  'sk.lagoon.length',
  'sk.lagoon.soft',
  'sk.finale.de-te-ne',
  'sk.lagoon.u',
  'sk.lagoon.bepeveme',
  'sk.lagoon.paired',
];

/** The finales' meters and battle counts (design §3.7, §3.12; the count capped by the contract). */
const LEDANA_METER = 18;
const LEDANA_COUNT = 24;
const KRAKATICE_METER = 30;
const KRAKATICE_COUNT = 30;

/** dě tě ně and the soft di ti ni of the lagoon's words, one gap each. */
const splitSkills: Skill[] = [
  {
    id: 'sk.finale.de-te-ne',
    titleKey: 'skill.finale.de-te-ne',
    strand: 'letters-sounds',
    generator: 'spell.word',
    params: { words: { topics: ['de-te-ne'] }, rules: ['de-te-ne'], maxGaps: 1, choices: 2 },
  },
  {
    id: 'sk.finale.di-ti-ni',
    titleKey: 'skill.finale.di-ti-ni',
    strand: 'letters-sounds',
    generator: 'spell.word',
    params: { words: { topics: ['de-te-ne'] }, rules: ['dtn-mekke'], maxGaps: 1, choices: 2 },
  },
];

type Activity = Level['activities'][number];

const battle = (skills: readonly string[], count: number): Activity => ({
  kind: 'battle',
  skills: [...skills],
  count,
  input: 'auto',
  options: {},
});

/** A level of the fixture: one of order n > 1 unlocks after its region's level n - 1. */
function level(
  id: string,
  order: number,
  activities: Activity[],
  objectives: string[],
  monster: string | null = null,
): Level {
  const region = id.slice(0, id.lastIndexOf('.'));
  return {
    id,
    region,
    order,
    titleKey: `level.${id}`,
    kind: monster === null ? 'lesson' : 'monster',
    unlock: { after: order === 1 ? [] : [`${region}.${order - 1}`] },
    activities,
    stars: null,
    rewards: { coins: monster === null ? [2, 4, 6] : [4, 8, 12], eggs: [], cosmetics: [] },
    monster,
    storyBeat: null,
    objectives,
  };
}

type Beat = ContentData['story']['beats'][number];

/** A skippable beat of a few lines with a "next" choice between them (as the lagoon fixture's). */
function beat(id: string, trigger: Beat['trigger'], scene: string, lines: number): Beat {
  const key = id.slice('beat.'.length);
  const texts = Array.from({ length: lines }, (_, i) => `story.${key}.${i + 1}`);
  const graph = {
    schema: 1,
    id: `story.${key}`,
    revision: '1',
    start: 'line-1',
    catalogs: {
      scene: [scene],
      text: [...texts, ...(lines > 1 ? ['story.next'] : [])],
      asset: [],
      clue: [],
      fact: [],
      glossary: [],
      reward: [],
      completion: [],
    },
    flags: [],
    items: [],
    data: [],
    effects: [],
    nodes: texts.map((text, i) => ({
      id: `line-${i + 1}`,
      scene,
      text,
      narration: null,
      revisit: 'allow',
      entryEffects: [],
      choices:
        i + 1 < lines
          ? [{ id: 'next', text: 'story.next', to: `line-${i + 2}`, guard: null, effects: [] }]
          : [],
      automatic: [],
      resolveEnding: false,
    })),
    maxAutomaticSteps: 4,
    endings: [],
  } as unknown as NarrativeGraph;
  return { id, trigger, skippable: true, graph };
}

/** Add Ledové moře, Ledana, Krakatičí propast and the Krakatice to the lagoon fixture. */
function addFinales(data: ContentData): void {
  data.skills.push(...splitSkills.map((skill) => JSON.parse(JSON.stringify(skill)) as Skill));

  const caves = data.regions.findIndex((r) => r.id === 'moon-caves');
  data.regions[caves]!.unlock = { after: [LEDANA_LEVEL] };
  data.regions.splice(caves, 0, {
    id: 'ice-sea',
    order: 7,
    titleKey: 'region.ice-sea',
    unlock: { after: ['sunny-lagoon.monster'] },
    monster: LEDANA,
    map: 'shallows',
    grade: 3,
  });
  data.regions.push({
    id: 'kraken-abyss',
    order: 12,
    titleKey: 'region.kraken-abyss',
    unlock: { after: ['moon-caves.monster'] },
    monster: KRAKATICE,
    map: 'deep',
    grade: 4,
  });

  const third = data.objectives.filter((o) => o.grade === 3).map((o) => o.id);
  const caveLesson = data.levels.findIndex((l) => l.id === 'moon-caves.1');
  data.levels.splice(
    caveLesson,
    0,
    level(
      ICE_SEA_LESSON,
      1,
      [
        {
          kind: 'feeding',
          skills: ['sk.lagoon.length', 'sk.lagoon.paired'],
          count: 6,
          input: 'auto',
          options: {},
        },
      ],
      ['obj.letters.vowel-length', 'obj.letters.paired'],
    ),
    level(LEDANA_LEVEL, 2, [battle(LEDANA_ARM_SKILLS, LEDANA_COUNT)], third, LEDANA),
  );
  data.levels.push(
    level(
      KRAKATICE_LEVEL,
      1,
      [battle(KRAKATICE_ARM_SKILLS, KRAKATICE_COUNT)],
      data.objectives.map((o) => o.id),
      KRAKATICE,
    ),
  );

  const humr = data.monsters.findIndex((m) => m.id === 'humr-nuzkar');
  data.monsters.splice(humr, 0, {
    id: LEDANA,
    region: 'ice-sea',
    nameKey: `monster.${LEDANA}`,
    mood: 'sulky',
    meter: LEDANA_METER,
    reviewShare: 0,
    jokes: [1, 2, 3].map((n) => `monster.${LEDANA}.joke.${n}`),
    arms: 6,
    gradeFinale: 3,
  });
  data.monsters.push({
    id: KRAKATICE,
    region: 'kraken-abyss',
    nameKey: `monster.${KRAKATICE}`,
    mood: 'grumpy',
    meter: KRAKATICE_METER,
    reviewShare: 0,
    jokes: [1, 2, 3, 4].map((n) => `monster.${KRAKATICE}.joke.${n}`),
    arms: 10,
    finale: true,
  });

  data.stickers.push(
    {
      id: 'sticker.ledana-melted',
      nameKey: 'sticker.ledana-melted',
      page: 'ice-sea',
      criteria: { kind: 'monster-freed', monster: LEDANA },
      icon: 'sticker/ledana-melted',
      color: '#9fd8f0',
      frame: 'sticker/frame-shell',
    },
    {
      id: 'sticker.ten-arms',
      nameKey: 'sticker.ten-arms',
      page: 'kraken-abyss',
      criteria: { kind: 'finale' },
      icon: 'sticker/ten-arms',
      color: '#5b3a8c',
      frame: 'sticker/frame-shell',
    },
  );

  data.story.beats.push(
    beat(`beat.${LEDANA}-freed`, { kind: 'monster-freed', monster: LEDANA }, 'scene/ice-sea', 2),
    beat('beat.finale', { kind: 'finale' }, 'scene/kraken-abyss', 3),
  );
}

/**
 * The finale fixture, validated by the contract; `change` edits it further (a mutation check's
 * broken capability) before it is validated.
 */
export function finalePack(
  change: (data: ContentData) => void = () => undefined,
): ContentPack<ContentData> {
  return lagoonPackWith((data) => {
    addFinales(data);
    change(data);
  });
}
