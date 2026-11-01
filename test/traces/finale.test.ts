/**
 * Golden trace: the two finales, Mořská saň Ledana and the Krakatice Inkoustová (design §7.2,
 * §7.3, §9.1, §9.3), on the finale fixture (test/fixtures/rules/finale-pack.ts).
 *
 * On 2026-11-02 a 3rd grader who answers everything right chooses Krab's egg and plays Slunná
 * laguna (lessons 1-6 and Muréna Mumla), Ledové moře 1 and Ledana's battle: six icicles, three
 * right answers melting each, icicle k serving only the battle's k-th skill (no review share),
 * jokes at the start, after every 5th blot and when she is freed. Freeing her completes the 3rd
 * grade once (`grade.completed`, the hub's certificate, her freed beat) and opens the deep. On
 * 2026-11-03 the child plays Měsíční jeskyně 1, Humr Nůžkař and the Krakatice: ten arms washed
 * one by one, arm k serving only skill k in the authored order, the finale completed once (its day
 * kept, `beat.finale`, the map, the gallery and the finale sticker) and no level left to glow.
 * Replaying both finales afterwards completes nothing again. From the save just before the
 * Krakatice, a child who misses every answer meets the kindness cap: after max(count, meter + 5)
 * problems (the design's 40) the flourish washes all ten arms, frees her and completes the finale
 * all the same, taking nothing away.
 *
 * Named checks come first; the golden hash and trajectory are change detectors checked last. Arm
 * skills that share items (S3's packs share items between word and sentence skills) still ask
 * each arm's items through its own skill.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import { FRIEND_STAGES, dayNumber } from '../../src/rules/contract';
import type { BattleView, ContentData, GameView, ProfileState } from '../../src/rules/contract';
import { itemIndex } from '../../src/rules/learning/index-cache';
import {
  ICE_SEA_LESSON,
  KRAKATICE,
  KRAKATICE_ARM_SKILLS,
  KRAKATICE_LEVEL,
  LEDANA,
  LEDANA_ARM_SKILLS,
  LEDANA_LEVEL,
  finalePack,
} from '../fixtures/rules/finale-pack';
import { PERFECT, Player, trajectoryDigest } from './support';
import type { Recorded, Style } from './support';

vi.setConfig({ testTimeout: 300_000 });

/**
 * Pinned literals (docs/testing.md, "When a golden moves"), captured from the first green run of
 * this trace (seed `golden-finales`, the finale fixture on the lagoon fixture 0.1.0); re-pinned
 * when the Krakatice's battle count became the design's 40 (the contract allowed 30 before).
 */
const GOLDEN_HASH = '65c4e9180da5809d';
const GOLDEN_TRAJECTORY = 'be8a19c3a1fdddce';

const SEED = 'golden-finales';
const EGG = 'krab-tvrdak';
/** The lagoon, Ledové moře and Ledana on the first day; the deep and the Krakatice on the next. */
const DAYS = ['2026-11-02', '2026-11-03'] as const;
const LAGOON = [
  'sunny-lagoon.1',
  'sunny-lagoon.2',
  'sunny-lagoon.3',
  'sunny-lagoon.4',
  'sunny-lagoon.5',
  'sunny-lagoon.6',
  'sunny-lagoon.monster',
];
const CAVES = ['moon-caves.1', 'moon-caves.monster'];
const LEDANA_BEAT = `beat.${LEDANA}-freed`;
const FINALE_BEAT = 'beat.finale';
/** The fixture's album stickers: Ledana freed (monster-freed) and the finale (finale). */
const LEDANA_STICKER = 'sticker.ledana-melted';
const FINALE_STICKER = 'sticker.ten-arms';

/** Misses every answer. */
const NEVER: Style = { right: () => false, elapsedMs: () => 3000, clumsy: false };

/** A finale as the design describes it (§3.7, §3.12, §7.2, §7.3), its numbers written by hand. */
interface Finale {
  name: string;
  monster: string;
  region: string;
  /** What one arm is called (Ledana's are icicles). */
  arm: string;
  arms: number;
  meter: number;
  /** Right answers that wash one arm. */
  perArm: number;
  /** The fixture's skill for each arm, in the authored order. */
  armSkills: readonly string[];
  /** The day the main trace frees it. */
  day: string;
}

const LEDANA_FINALE: Finale = {
  name: 'Ledana',
  monster: LEDANA,
  region: 'ice-sea',
  arm: 'icicle',
  arms: 6,
  meter: 18,
  perArm: 3,
  armSkills: LEDANA_ARM_SKILLS,
  day: DAYS[0],
};

const KRAKATICE_FINALE: Finale = {
  name: 'the Krakatice',
  monster: KRAKATICE,
  region: 'kraken-abyss',
  arm: 'arm',
  arms: 10,
  meter: 30,
  perArm: 3,
  armSkills: KRAKATICE_ARM_SKILLS,
  day: DAYS[1],
};

// ------------------------------------------------------------------------------ playing a battle

/** How a problem looks: a word with gaps, a sentence with gaps, a mistake to hunt, or other. */
type Shape = 'word' | 'sentence' | 'mistake' | 'other';

/** One answer step of a battle: what was on screen, and the battle view after the answer. */
interface BattleStep {
  /** The problem's number in the round, its item and shape, and the step answered. */
  problem: number;
  item: string;
  shape: Shape;
  step: number;
  reask: boolean;
  /** Arms clean while the step was on screen: the arm (counted from 0) being washed. */
  arm: number;
  right: boolean;
  after: BattleView;
}

/** A monster level played through: its battle step by step, and the game around it. */
interface Fight {
  level: string;
  /** Events from the level's start until its beats are read. */
  events: Recorded[];
  /** The battle view as the battle started. */
  start: BattleView | null;
  steps: BattleStep[];
  /** The finished battle's view and the problems it asked. */
  end: BattleView | null;
  problems: number;
  /** The game just before the level, and right after it with its beats read. */
  before: GameView;
  after: GameView;
}

function battleOf(view: GameView): BattleView | null {
  return view.round?.type === 'problems' ? view.round.battle : null;
}

/** Play a monster level: its battle step by step in the player's style, then its beats. */
async function fight(player: Player, level: string): Promise<Fight> {
  const before = player.view();
  const from = player.events.length;
  await player.act({ type: 'startLevel', level });
  await player.settleStory();
  const start = battleOf(player.view());
  const steps: BattleStep[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const round = player.view().round;
    if (round?.type !== 'problems' || round.status !== 'active') break;
    if (!round.problem || !round.battle) break;
    const { index, item, step, reask, problem } = round.problem;
    const arm = round.battle.armsWashed;
    if (!(await player.answer())) break;
    steps.push({
      problem: index,
      item,
      shape:
        problem.kind === 'mistake'
          ? 'mistake'
          : problem.kind !== 'gaps'
            ? 'other'
            : problem.sentence === null
              ? 'word'
              : 'sentence',
      step,
      reask,
      arm,
      right: player.served.at(-1)?.right === true,
      after: battleOf(player.view())!,
    });
  }
  const finished = player.view().round;
  const end = battleOf(player.view());
  const problems = finished?.type === 'problems' ? finished.progress.answered : 0;
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  const events = player.events.slice(from);
  return { level, events, start, steps, end, problems, before, after: player.view() };
}

/** A battle's events in order as short tokens: answers, washes, arms, jokes, its end, freeing. */
function battleTape(events: readonly Recorded[]): string[] {
  return events.flatMap((e) => {
    const data = e.data as Record<string, unknown>;
    switch (e.type) {
      case 'round.started':
        return [`start:${String(data.activity)}`];
      case 'answer.correct':
        return ['right'];
      case 'answer.incorrect':
        return ['miss'];
      case 'ink.washed':
        return [`wash:${String(data.washed)}`];
      case 'arm.washed':
        return [`arm:${String(data.arm)}`];
      case 'monster.joked':
        return [`joke:${String(data.joke)}`];
      case 'round.completed':
        return ['done'];
      case 'monster.freed':
        return [`freed:${String(data.monster)}`];
      default:
        return [];
    }
  });
}

// ------------------------------------------------------------------------------ the scenarios

/** A finale as one child played it: its first battle, a later replay, the game at the end. */
interface Played {
  player: Player;
  fight: Fight;
  replay: Fight;
  final: GameView;
}

interface Observation {
  player: Player;
  ledana: Fight;
  krakatice: Fight;
  /** Ledana's level, then the Krakatice's, replayed after the finale. */
  replays: [Fight, Fight];
  /** The save of the last commit before the Krakatice's level started. */
  beforeKrakatice: RuntimeSnapshot;
  final: GameView;
}

const ledanaPlayed = (o: Observation): Played => ({
  player: o.player,
  fight: o.ledana,
  replay: o.replays[0],
  final: o.final,
});

const krakaticePlayed = (o: Observation): Played => ({
  player: o.player,
  fight: o.krakatice,
  replay: o.replays[1],
  final: o.final,
});

async function play(
  pack: ContentPack<ContentData> = finalePack(),
  seed = SEED,
): Promise<Observation> {
  const player = new Player(PERFECT, seed, pearlSeaAdapter, pack);
  const save: { last: RuntimeSnapshot | null } = { last: null };
  player.host.subscribeCommits((commit) => {
    save.last = commit.snapshot;
  });
  await player.begin(EGG, DAYS[0]);
  for (const level of [...LAGOON, ICE_SEA_LESSON]) await player.playLevel(level);
  const ledana = await fight(player, LEDANA_LEVEL);
  await player.act({ type: 'startSession', day: DAYS[1] });
  await player.settleStory();
  for (const level of CAVES) await player.playLevel(level);
  const beforeKrakatice = save.last!;
  const krakatice = await fight(player, KRAKATICE_LEVEL);
  const replays: [Fight, Fight] = [
    await fight(player, LEDANA_LEVEL),
    await fight(player, KRAKATICE_LEVEL),
  ];
  return { player, ledana, krakatice, replays, beforeKrakatice, final: player.view() };
}

interface Capped {
  player: Player;
  /** The child's state as the save was restored. */
  before: ProfileState;
  fight: Fight;
}

/** The same child, from the save before the Krakatice, missing every answer. */
async function capped(save: RuntimeSnapshot): Promise<Capped> {
  const player = new Player(NEVER, SEED, pearlSeaAdapter, finalePack());
  await player.restore(save);
  const before = JSON.parse(JSON.stringify(player.state())) as ProfileState;
  return { player, before, fight: await fight(player, KRAKATICE_LEVEL) };
}

/**
 * The short way to a finale, for the mutation checks and the suspected bugs: on the first day a
 * 3rd grader whose grown-ups opened `region` ahead plays its monster level, then replays it. The
 * battle is the main trace's battle, without the journey before it.
 */
async function ahead(
  pack: ContentPack<ContentData>,
  region: string,
  level: string,
): Promise<Played> {
  const player = new Player(PERFECT, SEED, pearlSeaAdapter, pack);
  await player.begin(EGG, DAYS[0]);
  await player.act({ type: 'setSetting', setting: { key: 'unlockAhead', value: [region] } });
  const first = await fight(player, level);
  const replay = await fight(player, level);
  return { player, fight: first, replay, final: player.view() };
}

// ------------------------------------------------------------------------------ named checks

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const ofType = (events: readonly Recorded[], type: string): Recorded[] =>
  events.filter((e) => e.type === type);
const beatPlays = (events: readonly Recorded[], beat: string): number =>
  ofType(events, 'story.advanced').filter((e) => (e.data as { beat: string }).beat === beat).length;
const glowing = (view: GameView): string | null =>
  view.hub.regions.flatMap((r) => r.levels).find((l) => l.glowing)?.id ?? null;
const freedEvents = (events: readonly Recorded[], monster: string): Recorded[] =>
  ofType(events, 'monster.freed').filter(
    (e) => (e.data as { monster: string }).monster === monster,
  );
/** Whether the album of `view` shows `sticker` as earned. */
const earned = (view: GameView, sticker: string): boolean =>
  view.album.pages.some((page) => page.stickers.some((s) => s.id === sticker && s.earned));

/** The names of the checks every finale's battle passes. */
function battleNames(f: Finale) {
  return {
    shown: `${f.name}: the map and the battle show ${f.arms} ${f.arm}s, none clean as it starts`,
    washed: `${f.name}: every right answer washed one blot, 1 to ${f.meter}`,
    armEvents: `${f.name}: an ${f.arm} came clean right after every third blot, in order (arm.washed)`,
    armView: `${f.name}: the battle view counts the clean ${f.arm}s after every answer`,
    order: `${f.name}: ${f.arm} k served only the battle’s k-th skill, never another or a review`,
    three: `${f.name}: three right answers to three problems of its skill washed each ${f.arm}`,
    jokes: `${f.name}: jokes at the start, after every 5th blot and when freed, going round the list`,
    freed: `${f.name}: freed once, on ${f.day}: monster.freed, the map and the gallery`,
  };
}

/**
 * The jokes the design asks of a battle washed clean by right answers (§7.1): one at the start,
 * one after every 5th blot while ink is left, one when freed, going round the monster's list.
 */
function designedJokes(
  jokes: readonly string[],
  meter: number,
): { after: number[]; told: string[] } {
  const after: number[] = [];
  for (let blot = 5; blot < meter; blot += 5) after.push(blot);
  return { after, told: range(0, after.length + 1).map((n) => jokes[n % jokes.length]!) };
}

/** The design's promises for a finale's battle washed clean by right answers. */
function battleChecks(p: Player, f: Finale, fought: Fight): Record<string, boolean> {
  const names = battleNames(f);
  const tape = battleTape(fought.events);
  const index = itemIndex(p.data);
  const skillItems = f.armSkills.map((skill) => new Set(index.get(skill) ?? []));
  const monster = p.data.monsters.find((m) => m.id === f.monster);
  const jokes = designedJokes(monster?.jokes ?? [], f.meter);
  const told = tape.filter((t) => t.startsWith('joke:')).map((t) => t.slice('joke:'.length));
  // The token after `token`, not counting the arm it may have washed.
  const next = (token: string) =>
    tape.slice(tape.indexOf(token) + 1).find((t) => !t.startsWith('arm:'));
  const problems = fought.steps.filter((s) => s.step === 0);
  const region = (view: GameView) => view.hub.regions.find((r) => r.id === f.region);
  const freed = freedEvents(p.events, f.monster);
  const state = p.state();
  const { start, end } = fought;
  return {
    [names.shown]:
      region(fought.before)?.monster?.arms === f.arms &&
      start !== null &&
      start.monster === f.monster &&
      start.arms === f.arms &&
      start.armsWashed === 0 &&
      start.washed === 0 &&
      start.target === f.meter,
    [names.washed]:
      fought.steps.length > 0 &&
      fought.steps.every((s) => s.right) &&
      same(
        tape.filter((t) => t.startsWith('wash:')),
        range(1, f.meter).map((blot) => `wash:${blot}`),
      ) &&
      tape.every((t, i) => t !== 'right' || tape[i + 1]?.startsWith('wash:') === true),
    [names.armEvents]:
      same(
        ofType(fought.events, 'arm.washed').map((e) => e.data),
        range(1, f.arms).map((arm) => ({ monster: f.monster, arm, arms: f.arms })),
      ) &&
      range(1, f.arms).every((k) => tape[tape.indexOf(`wash:${k * f.perArm}`) + 1] === `arm:${k}`),
    [names.armView]:
      fought.steps.every(
        (s) => s.after.armsWashed === (s.after.washed - (s.after.washed % f.perArm)) / f.perArm,
      ) &&
      end !== null &&
      end.washed === f.meter &&
      end.armsWashed === f.arms,
    [names.order]:
      problems.length > 0 &&
      problems.every((s) =>
        skillItems.every((items, arm) => items.has(s.item) === (arm === s.arm)),
      ) &&
      range(0, f.arms - 1).every((arm) => problems.some((s) => s.arm === arm)),
    [names.three]: range(0, f.arms - 1).every((arm) => {
      const steps = fought.steps.filter((s) => s.arm === arm);
      return steps.length === f.perArm && steps.every((s) => s.right && s.step === 0);
    }),
    [names.jokes]:
      same(told, jokes.told) &&
      tape[0] === 'start:battle' &&
      tape[1] === `joke:${jokes.told[0]}` &&
      jokes.after.every((blot, i) => next(`wash:${blot}`) === `joke:${jokes.told[i + 1]}`) &&
      tape.indexOf(`freed:${f.monster}`) > tape.indexOf('done') &&
      tape.at(-1) === `joke:${jokes.told.at(-1)}` &&
      end?.jokeKey === jokes.told.at(-1) &&
      told.every((joke, i) => i === 0 || joke !== told[i - 1]),
    [names.freed]:
      freed.length === 1 &&
      fought.events.includes(freed[0]!) &&
      state.monsters[f.monster]?.freedDay === dayNumber(f.day) &&
      region(fought.after)?.monster?.freed === true &&
      same(
        fought.after.gallery.monsters
          .filter((m) => m.id === f.monster)
          .map((m) => [m.freed, m.day]),
        [[true, f.day]],
      ),
  };
}

const LEDANA_NAMES = {
  grade: 'freeing Ledana completed the 3rd grade, once: grade.completed { grade: 3 }',
  certificate: 'the hub lists the 3rd grade’s certificate from Ledana’s freeing on, not before',
  beat: 'Ledana’s freed beat played once (3. třída hotová!)',
  album: 'the album shows Ledana’s sticker from her freeing on',
  deep: 'the deep opened with Ledana: Měsíční jeskyně was locked before her, open after',
  replay: 'replaying Ledana’s battle later completes nothing again',
};

/** Ledana, the 3rd grade's finale (design §7.3, §9.1, §9.3). */
function ledanaChecks(l: Played, f: Finale = LEDANA_FINALE): Record<string, boolean> {
  const p = l.player;
  const fought = l.fight;
  const state = p.state();
  const caves = (view: GameView) => view.hub.regions.find((r) => r.id === 'moon-caves');
  return {
    ...battleChecks(p, f, fought),
    [LEDANA_NAMES.grade]:
      same(p.data_('grade.completed'), [{ grade: 3 }]) &&
      ofType(fought.events, 'grade.completed').length === 1,
    [LEDANA_NAMES.certificate]:
      same(fought.before.hub.certificates, []) &&
      same(fought.after.hub.certificates, [3]) &&
      same(l.final.hub.certificates, [3]),
    [LEDANA_NAMES.beat]:
      beatPlays(p.events, LEDANA_BEAT) === 1 &&
      beatPlays(fought.events, LEDANA_BEAT) === 1 &&
      state.story.done.includes(LEDANA_BEAT),
    [LEDANA_NAMES.album]:
      !earned(fought.before, LEDANA_STICKER) &&
      earned(fought.after, LEDANA_STICKER) &&
      state.stickers[LEDANA_STICKER]?.day === dayNumber(f.day),
    [LEDANA_NAMES.deep]:
      caves(fought.before)?.unlocked === false &&
      caves(fought.before)?.levels.find((v) => v.id === 'moon-caves.1')?.status === 'locked' &&
      ofType(fought.events, 'region.unlocked').some(
        (e) => (e.data as { region: string }).region === 'moon-caves',
      ) &&
      caves(fought.after)?.unlocked === true &&
      caves(fought.after)?.levels.find((v) => v.id === 'moon-caves.1')?.status === 'open',
    [LEDANA_NAMES.replay]:
      l.replay.level === LEDANA_LEVEL &&
      l.replay.end?.washed === f.meter &&
      ofType(l.replay.events, 'level.completed').some(
        (e) => (e.data as { firstTime: boolean }).firstTime === false,
      ) &&
      !l.replay.events.some((e) =>
        [
          'monster.freed',
          'grade.completed',
          'region.unlocked',
          'story.advanced',
          'finale.completed',
        ].includes(e.type),
      ),
  };
}

const KRAKATICE_NAMES = {
  finale: 'freeing the Krakatice completed the finale, once: finale.completed',
  day: 'the finale’s day is kept: state.finale.day is the day she was freed',
  beat: 'beat.finale played once',
  album: 'the album shows the finale’s sticker from the finale on',
  replay: 'replaying the Krakatice later completes nothing again',
};

/** The Krakatice Inkoustová, the grand finale (design §7.2, §9.3). */
function krakaticeChecks(k: Played, f: Finale = KRAKATICE_FINALE): Record<string, boolean> {
  const p = k.player;
  const fought = k.fight;
  const state = p.state();
  return {
    ...battleChecks(p, f, fought),
    [KRAKATICE_NAMES.finale]:
      p.count('finale.completed') === 1 && ofType(fought.events, 'finale.completed').length === 1,
    [KRAKATICE_NAMES.day]:
      state.finale.day !== null &&
      state.finale.day === dayNumber(f.day) &&
      state.finale.day === state.monsters[f.monster]?.freedDay,
    [KRAKATICE_NAMES.beat]:
      beatPlays(p.events, FINALE_BEAT) === 1 &&
      beatPlays(fought.events, FINALE_BEAT) === 1 &&
      state.story.done.includes(FINALE_BEAT),
    [KRAKATICE_NAMES.album]:
      !earned(fought.before, FINALE_STICKER) &&
      earned(fought.after, FINALE_STICKER) &&
      state.stickers[FINALE_STICKER]?.day === dayNumber(f.day),
    [KRAKATICE_NAMES.replay]:
      k.replay.level === KRAKATICE_LEVEL &&
      k.replay.end?.washed === f.meter &&
      ofType(k.replay.events, 'level.completed').some(
        (e) => (e.data as { firstTime: boolean }).firstTime === false,
      ) &&
      !k.replay.events.some((e) =>
        ['monster.freed', 'grade.completed', 'story.advanced', 'finale.completed'].includes(e.type),
      ),
  };
}

/** The journey around the finales: no rejected step, the sea opening region by region. */
function journeyChecks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const revisionOf = (events: Recorded[]) => events[0]?.revision ?? -1;
  const unlocked = (region: string) =>
    ofType(p.events, 'region.unlocked').filter(
      (e) => (e.data as { region: string }).region === region,
    );
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'the sea opened region by region: Ledové moře with Muréna, the deep with Ledana, the abyss with Humr':
      same(
        p.data_('region.unlocked').map((e) => (e as { region: string }).region),
        ['ice-sea', 'moon-caves', 'kraken-abyss'],
      ) &&
      [
        ['murena-mumla', 'ice-sea'],
        [LEDANA, 'moon-caves'],
        ['humr-nuzkar', 'kraken-abyss'],
      ].every(
        ([monster, region]) =>
          revisionOf(unlocked(region!)) === revisionOf(freedEvents(p.events, monster!)),
      ),
    'Měsíční jeskyně 1 glowed next once Ledana was free':
      glowing(o.ledana.after) === 'moon-caves.1',
    'once the Krakatice is free every level is complete, none glows, the certificate stays':
      p.data.levels.every((level) => (state.levels[level.id]?.stars ?? 0) >= 1) &&
      glowing(o.krakatice.after) === null &&
      same(o.krakatice.after.hub.certificates, [3]),
    'the child is back at the hub': o.final.round === null && o.final.screen === 'hub',
  };
}

const checks = (o: Observation): Record<string, boolean> => ({
  ...journeyChecks(o),
  ...ledanaChecks(ledanaPlayed(o)),
  ...krakaticeChecks(krakaticePlayed(o)),
});

const failedOf = (results: Record<string, boolean>): string[] =>
  Object.entries(results)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

const CAP_NAMES = {
  cap: 'a child who misses every answer gets max(count, meter + 5) problems, then the battle ends',
  forty: 'the cap: the Krakatice’s battle asks the design’s 40 problems at most (design §3.12)',
};

/** The kindness cap at the finale (design §7.1, docs/learning.md §7). */
function capChecks(c: Capped): Record<string, boolean> {
  const p = c.player;
  const f = c.fight;
  const state = p.state();
  const count = p.data.levels.find((l) => l.id === KRAKATICE_LEVEL)!.activities[0]!.count;
  const cap = Math.max(count, KRAKATICE_FINALE.meter + 5);
  const first = new Set(itemIndex(p.data).get(KRAKATICE_ARM_SKILLS[0]!) ?? []);
  const jokes = p.data.monsters.find((m) => m.id === KRAKATICE)!.jokes;
  const stage = (friend: string, of: ProfileState) =>
    FRIEND_STAGES.indexOf(of.friends[friend]?.stage ?? 'egg');
  return {
    'the cap: every step was accepted at the expected logical turn': p.failures.length === 0,
    [CAP_NAMES.cap]: f.problems === cap && f.steps.length === cap && f.steps.every((s) => !s.right),
    [CAP_NAMES.forty]: count === 40 && f.problems === 40,
    'the cap: a miss washed nothing, no blot and no arm, until the flourish':
      ofType(f.events, 'ink.washed').length === 0 &&
      ofType(f.events, 'arm.washed').length === 0 &&
      f.steps.slice(0, -1).every((s) => s.after.washed === 0 && s.after.armsWashed === 0),
    'the cap: the flourish washed all ten arms clean':
      f.end !== null &&
      f.end.washed === KRAKATICE_FINALE.meter &&
      f.end.target === KRAKATICE_FINALE.meter &&
      f.end.arms === KRAKATICE_FINALE.arms &&
      f.end.armsWashed === KRAKATICE_FINALE.arms,
    'the cap: stuck on the first arm, the child was asked only its skill, re-asks included':
      f.steps.some((s) => s.reask) && f.steps.every((s) => s.arm === 0 && first.has(s.item)),
    'the cap: the Krakatice was freed and the finale completed all the same':
      freedEvents(f.events, KRAKATICE).length === 1 &&
      ofType(f.events, 'finale.completed').length === 1 &&
      beatPlays(f.events, FINALE_BEAT) === 1 &&
      state.finale.day === dayNumber(DAYS[1]),
    'the cap: she joked at the start and once more when freed': same(
      ofType(f.events, 'monster.joked').map((e) => (e.data as { joke: string }).joke),
      [jokes[0], jokes[1 % jokes.length]],
    ),
    'the cap: nothing was taken away (more coins, no friend smaller, stickers and stars kept)':
      state.coins > c.before.coins &&
      Object.keys(c.before.friends).every(
        (friend) => stage(friend, state) >= stage(friend, c.before),
      ) &&
      Object.keys(c.before.stickers).every((sticker) => state.stickers[sticker] !== undefined) &&
      Object.entries(c.before.levels).every(
        ([level, progress]) => (state.levels[level]?.stars ?? 0) >= progress.stars,
      ),
  };
}

// ------------------------------------------------------------------------------ the tests

describe('golden trace: the 3rd grade’s finale and the grand finale', () => {
  let main: Promise<Observation> | undefined;
  let cap: Promise<Capped> | undefined;
  const scenario = () => (main ??= play());
  const capScenario = () => (cap ??= scenario().then((o) => capped(o.beforeKrakatice)));
  afterAll(async () => {
    await (await cap)?.player.dispose();
    await (await main)?.player.dispose();
  });

  it('frees Ledana and the Krakatice with every named capability intact', async () => {
    const observation = await scenario();
    const failed = failedOf(checks(observation));
    if (failed.length > 0) {
      for (const fought of [observation.ledana, observation.krakatice]) {
        console.log(battleTape(fought.events).join(' '));
      }
    }
    expect(failed, observation.player.failures.join('; ')).toEqual([]);
  });

  it('caps the finale for a child who misses every answer, and frees her all the same', async () => {
    const observation = await capScenario();
    const failed = failedOf(capChecks(observation));
    expect(failed, observation.player.failures.join('; ')).toEqual([]);
  });

  it('matches the pinned golden hash and trajectory', async () => {
    const observation = await scenario();
    expect(observation.player.host.hash(), 'final state hash (GOLDEN_HASH)').toBe(GOLDEN_HASH);
    expect(
      trajectoryDigest(observation.player.hashes),
      'commit trajectory (GOLDEN_TRAJECTORY)',
    ).toBe(GOLDEN_TRAJECTORY);
  });
});

describe('mutation checks: the named checks fail when a capability is missing', () => {
  // The pack mutations take the short way to each finale (`ahead`): the same battle, without the
  // journey before it, so they check the finale's own named checks.
  const ledanaAhead = (pack: ContentPack<ContentData>) => ahead(pack, 'ice-sea', LEDANA_LEVEL);
  const krakaticeAhead = (pack: ContentPack<ContentData>) =>
    ahead(pack, 'kraken-abyss', KRAKATICE_LEVEL);
  /** The Krakatice freed on the first day, the short way. */
  const SOONER: Finale = { ...KRAKATICE_FINALE, day: DAYS[0] };

  it('the short way to the finales passes every finale check', async () => {
    const [ledana, krakatice] = await Promise.all([
      ledanaAhead(finalePack()),
      krakaticeAhead(finalePack()),
    ]);
    expect(failedOf(ledanaChecks(ledana))).toEqual([]);
    expect(failedOf(krakaticeChecks(krakatice, SOONER))).toEqual([]);
    await Promise.all([ledana.player.dispose(), krakatice.player.dispose()]);
  });

  it('without `gradeFinale`, Ledana completes no grade and the certificate checks fail', async () => {
    const played = await ledanaAhead(
      finalePack((data) => {
        delete data.monsters.find((m) => m.id === LEDANA)!.gradeFinale;
      }),
    );
    const failed = failedOf(ledanaChecks(played));
    expect(failed).toContain(LEDANA_NAMES.grade);
    expect(failed).toContain(LEDANA_NAMES.certificate);
    expect(failed).not.toContain(battleNames(LEDANA_FINALE).shown);
    expect(failed).not.toContain(battleNames(LEDANA_FINALE).freed);
    expect(failed).not.toContain(LEDANA_NAMES.beat);
    expect(failed).not.toContain(LEDANA_NAMES.deep);
    await played.player.dispose();
  });

  it('with Měsíční jeskyně opening after Muréna rather than Ledana, the deep check fails', async () => {
    const played = await ledanaAhead(
      finalePack((data) => {
        data.regions.find((r) => r.id === 'moon-caves')!.unlock = {
          after: ['sunny-lagoon.monster'],
        };
      }),
    );
    const failed = failedOf(ledanaChecks(played));
    expect(failed).toContain(LEDANA_NAMES.deep);
    expect(failed).not.toContain(LEDANA_NAMES.grade);
    expect(failed).not.toContain(LEDANA_NAMES.certificate);
    await played.player.dispose();
  });

  it('a one-armed Krakatice fails the arm checks, not the finale', async () => {
    const played = await krakaticeAhead(
      finalePack((data) => {
        data.monsters.find((m) => m.id === KRAKATICE)!.arms = 1;
      }),
    );
    const failed = failedOf(krakaticeChecks(played, SOONER));
    const names = battleNames(SOONER);
    for (const name of [names.shown, names.armEvents, names.armView, names.order, names.three]) {
      expect(failed).toContain(name);
    }
    expect(failed).not.toContain(names.washed);
    expect(failed).not.toContain(names.freed);
    expect(failed).not.toContain(KRAKATICE_NAMES.finale);
    expect(failed).not.toContain(KRAKATICE_NAMES.beat);
    await played.player.dispose();
  });

  it('the Krakatice’s arm skills in another order fail the arm-order check', async () => {
    const played = await krakaticeAhead(
      finalePack((data) => {
        data.levels.find((l) => l.id === KRAKATICE_LEVEL)!.activities[0]!.skills.reverse();
      }),
    );
    const failed = failedOf(krakaticeChecks(played, SOONER));
    const names = battleNames(SOONER);
    expect(failed).toContain(names.order);
    expect(failed).not.toContain(names.shown);
    expect(failed).not.toContain(names.armEvents);
    expect(failed).not.toContain(names.three);
    await played.player.dispose();
  });

  it('a Krakatice that is not the finale fails the finale checks, not the battle’s', async () => {
    const played = await krakaticeAhead(
      finalePack((data) => {
        delete data.monsters.find((m) => m.id === KRAKATICE)!.finale;
      }),
    );
    const failed = failedOf(krakaticeChecks(played, SOONER));
    const names = battleNames(SOONER);
    for (const name of [
      KRAKATICE_NAMES.finale,
      KRAKATICE_NAMES.day,
      KRAKATICE_NAMES.beat,
      KRAKATICE_NAMES.album,
    ]) {
      expect(failed).toContain(name);
    }
    expect(failed).not.toContain(names.armEvents);
    expect(failed).not.toContain(names.order);
    expect(failed).not.toContain(names.freed);
    await played.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await play(finalePack(), `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});

/** Ten arm skills that share items in pairs: a word skill beside a sentence or mistake skill. */
const SHARED_ARM_SKILLS = [
  'sk.lagoon.capitals',
  'sk.lagoon.capitals.m',
  'sk.lagoon.hard',
  'sk.lagoon.hard-soft.s',
  'sk.lagoon.u',
  'sk.lagoon.u-paired.s',
  'sk.lagoon.soft',
  'sk.lagoon.paired',
  'sk.lagoon.bepeveme',
  'sk.caves.bjevje',
];

/** The shape a skill's problems take (none of these word skills' points is ambiguous bare). */
const SHAPES: Record<string, Shape> = {
  'spell.word': 'word',
  'spell.sentence': 'sentence',
  'spell.mistake': 'mistake',
};

describe('arm skills that share items (S3’s packs share items between word and sentence skills)', () => {
  let shared: Promise<Played> | undefined;
  const scenario = () =>
    (shared ??= ahead(
      finalePack((data) => {
        data.levels.find((l) => l.id === KRAKATICE_LEVEL)!.activities[0]!.skills = [
          ...SHARED_ARM_SKILLS,
        ];
      }),
      'kraken-abyss',
      KRAKATICE_LEVEL,
    ));
  afterAll(async () => (await shared)?.player.dispose());

  it('play through: every step accepted, all ten arms washed, the Krakatice freed', async () => {
    const { player, fight: fought } = await scenario();
    expect(player.failures).toEqual([]);
    expect(fought.end).toMatchObject({ washed: 30, armsWashed: 10 });
    expect(freedEvents(fought.events, KRAKATICE)).toHaveLength(1);
  });

  it('arm k still serves only problems made by the battle’s k-th skill', async () => {
    const { player, fight: fought } = await scenario();
    const strays = fought.steps
      .filter((s) => s.step === 0)
      .filter((s) => {
        const skill = player.data.skills.find((k) => k.id === SHARED_ARM_SKILLS[s.arm]);
        return skill === undefined || s.shape !== SHAPES[skill.generator];
      })
      .map((s) => `${s.item} as a ${s.shape} on arm ${s.arm + 1} (${SHARED_ARM_SKILLS[s.arm]})`);
    expect(strays).toEqual([]);
  });
});
