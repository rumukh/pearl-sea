/**
 * Golden trace: a 4th grader's first sessions (design §4.1, §9.2; the coordinator's check b).
 *
 * The grown-ups set the 4th grade; on 2026-11-02 the child skips the prologue, chooses Želva's
 * egg and takes Ukaž, co umíš, answering everything right: Slunná laguna 2-6 are placed (never
 * lesson 1 or the monster) and the other lagoon eggs arrive. The adventure then goes to the deep:
 * Měsíční jeskyně 1, where Kořínek's egg arrives with the welcome and **hatches in this first
 * session**, while the chosen lagoon egg stays an egg. On the next days the child follows the
 * daily adventure (Svačinka, a board, the chest): Svačinka's first tastes serve the chosen egg's
 * items first, the day's board (the placed lessons' nets, whose letters the child never met)
 * threads her letters first, and the chosen lagoon egg **hatches in a later session**, before the
 * other lagoon eggs (a step that hatches several eggs hatches the child's own first).
 *
 * Named checks come first; the golden hash and trajectory are change detectors checked last.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import { isMinigameKind } from '../../src/rules/contract';
import type { GameView } from '../../src/rules/contract';
import { itemIndex, itemsOf } from '../../src/rules/learning/index-cache';
import { PERFECT, Player, trajectoryDigest } from './support';
import type { Adapter } from './support';

vi.setConfig({ testTimeout: 300_000 });

/** Pinned literals (docs/testing.md, "When a golden moves"). */
const GOLDEN_HASH = '1cdbe9207ad8b207';
const GOLDEN_TRAJECTORY = '7f5244ab2c0888bb';

const SEED = 'golden-fourth-grader';
const EGG = 'zelva-obojka';
const KORINEK = 'rak-korinek';
const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];

interface Session {
  day: string;
  steps: string[];
  hatched: string[];
  /** Per Svačinka round: the items it served, in order, and whether each was a first taste. */
  snacks: { item: string; taste: boolean }[][];
}

interface Observation {
  player: Player;
  nextAfterEgg: GameView['hub']['next'] | null;
  nextAfterPlacement: GameView['hub']['next'] | null;
  placementInputs: string[];
  sessions: Session[];
  /** The day and round activity of each hatch. */
  hatches: { friend: string; day: string; activity: string | null }[];
  stageAfterFirstSession: Record<string, string>;
  final: GameView;
}

async function play(
  adapter: Adapter = pearlSeaAdapter,
  seed = SEED,
  options: { snacks: boolean } = { snacks: true },
): Promise<Observation> {
  const player = new Player(PERFECT, seed, adapter);
  const o: Observation = {
    player,
    nextAfterEgg: null,
    nextAfterPlacement: null,
    placementInputs: [],
    sessions: [],
    hatches: [],
    stageAfterFirstSession: {},
    final: player.view(),
  };
  let day = DAYS[0]!;
  let hatchedBefore = 0;
  const noteHatches = () => {
    const hatched = player.data_('friend.hatched') as { friend: string }[];
    const round = player.view().round;
    for (const { friend } of hatched.slice(hatchedBefore)) {
      o.hatches.push({ friend, day, activity: round?.activity ?? null });
    }
    hatchedBefore = hatched.length;
  };
  await player.act({ type: 'setSetting', setting: { key: 'grade', value: 4 } });
  await player.act({ type: 'startSession', day });
  await player.choose(null);
  await player.settleStory();
  await player.act({ type: 'chooseFirstFriend', friend: EGG });
  o.nextAfterEgg = player.view().hub.next;
  await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
  for (let guard = 0; guard < 30; guard++) {
    const round = player.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
    o.placementInputs.push(round.problem.input);
    if (!(await player.answer())) break;
    noteHatches();
  }
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  o.nextAfterPlacement = player.view().hub.next;
  for (const [n, today] of DAYS.entries()) {
    day = today;
    if (n > 0) {
      await player.act({ type: 'startSession', day });
      await player.settleStory();
    }
    o.sessions.push(await followAdventure(player, day, noteHatches, options.snacks));
    if (n === 0) {
      for (const friend of player.view().friends)
        o.stageAfterFirstSession[friend.id] = friend.stage;
    }
  }
  o.final = player.view();
  return o;
}

/** Follow the daily adventure's big button until it offers free play. */
async function followAdventure(
  player: Player,
  day: string,
  noteHatches: () => void,
  snacks: boolean,
): Promise<Session> {
  const session: Session = { day, steps: [], hatched: [], snacks: [] };
  const before = player.count('friend.hatched');
  for (let guard = 0; guard < 12; guard++) {
    const next = player.view().hub.next;
    session.steps.push(next.kind === 'level' ? `level:${next.level}` : next.kind);
    if (next.kind === 'snack' && !snacks) break;
    if (next.kind === 'snack') {
      await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: next.friend } });
      const served: { item: string; taste: boolean }[] = [];
      for (let step = 0; step < 40; step++) {
        const round = player.view().round;
        if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
        const item = round.problem.item;
        if (round.problem.step === 0) {
          served.push({ item, taste: player.state().items[item] === undefined });
        }
        if (!(await player.answer())) break;
        noteHatches();
      }
      session.snacks.push(served);
      await player.act({ type: 'endRound', reason: 'done' });
      await player.settleStory();
    } else if (next.kind === 'level') {
      await player.act({ type: 'startLevel', level: next.level });
      await player.settleStory();
      for (let activity = 0; activity < 10; activity++) {
        for (let step = 0; step < 300; step++) {
          const round = player.view().round;
          if (round === null || round.status !== 'active') break;
          if (round.type === 'problems') {
            if (!(await player.answer())) break;
          } else await player.playBoard();
          noteHatches();
        }
        if (player.view().round === null) break;
        await player.act({ type: 'endRound', reason: 'done' });
        await player.settleStory();
        const run = player.view().run;
        if (run === null || run.result !== null) break;
        await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
        await player.settleStory();
      }
    } else if (next.kind === 'minigame') {
      await player.act({ type: 'startLevel', level: next.level, activity: next.activity });
      await player.playRound();
      noteHatches();
      await player.act({ type: 'endRound', reason: 'done' });
    } else if (next.kind === 'chest') {
      await player.act({ type: 'openChest' });
    } else break;
  }
  const hatched = player.data_('friend.hatched') as { friend: string }[];
  session.hatched = hatched.slice(before).map((h) => h.friend);
  return session;
}

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const placed = (p.data_('placement.completed')[0] as { placed: string[] } | undefined)?.placed;
  const first = o.sessions[0]!;
  const eggHatch = o.hatches.find((h) => h.friend === EGG);
  const lagoonHatches = o.hatches.filter((h) =>
    ['krab-tvrdak', 'meduzka-mekulka', 'zelva-obojka'].includes(h.friend),
  );
  const eggItems = new Set(
    itemsOf(p.data.friends.find((f) => f.id === EGG)!.skills, itemIndex(p.data)),
  );
  const tastesBeforeHatch = o.sessions
    .filter((s) => eggHatch !== undefined && s.day <= eggHatch.day)
    .flatMap((s) => s.snacks.flat())
    .filter((served) => served.taste);
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'the placement check came right after the egg': o.nextAfterEgg?.kind === 'placement',
    'the placement check asked on the letter pad at least': o.placementInputs.every(
      (input) => input === 'letters' || input === 'typed',
    ),
    'the placement placed Slunná laguna 2-6, never lesson 1 or the monster':
      JSON.stringify(placed) ===
        JSON.stringify([
          'sunny-lagoon.2',
          'sunny-lagoon.3',
          'sunny-lagoon.4',
          'sunny-lagoon.5',
          'sunny-lagoon.6',
        ]) &&
      state.levels['sunny-lagoon.1'] === undefined &&
      state.levels['sunny-lagoon.monster'] === undefined,
    'the placed lessons gave the other lagoon eggs': ['krab-tvrdak', 'meduzka-mekulka'].every(
      (friend) => state.friends[friend] !== undefined,
    ),
    'the deep came next: Měsíční jeskyně 1':
      o.nextAfterPlacement?.kind === 'level' && o.nextAfterPlacement.level === 'moon-caves.1',
    "Kořínek's egg came with the deep and hatched in the first session":
      first.steps.includes('level:moon-caves.1') &&
      o.hatches.some((h) => h.friend === KORINEK && h.day === DAYS[0]),
    'the chosen lagoon egg did not hatch in the first session':
      o.stageAfterFirstSession[EGG] === 'egg' && !first.hatched.includes(EGG),
    'the chosen lagoon egg hatched in a later session, after Svačinka’s first tastes':
      eggHatch !== undefined &&
      eggHatch.day > DAYS[0]! &&
      eggHatch.activity !== null &&
      (eggHatch.activity === 'snack' || isMinigameKind(eggHatch.activity)) &&
      tastesBeforeHatch.length > 0,
    'the chosen lagoon egg hatched before the other lagoon eggs': lagoonHatches[0]?.friend === EGG,
    "Svačinka's first tastes served the chosen egg's items before the others'":
      tastesBeforeHatch.length > 0 &&
      tastesBeforeHatch.every((served) => eggItems.has(served.item)),
    'Kořínek is a baby and every friend the child owns has hatched by the last day':
      o.final.friends.every((f) => f.stage !== 'egg'),
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: a 4th grader’s first sessions', () => {
  let main: Promise<Observation> | undefined;
  const scenario = () => (main ??= play());
  afterAll(async () => (await main)?.player.dispose());

  it('hatches Kořínek in the first session and the chosen lagoon egg later', async () => {
    const observation = await scenario();
    expect(failedChecks(observation), observation.player.failures.join('; ')).toEqual([]);
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
  it('without Svačinka the chosen lagoon egg does not hatch', async () => {
    const observation = await play(pearlSeaAdapter, SEED, { snacks: false });
    const failed = failedChecks(observation);
    expect(failed).toContain(
      'the chosen lagoon egg hatched in a later session, after Svačinka’s first tastes',
    );
    expect(failed).not.toContain(
      "Kořínek's egg came with the deep and hatched in the first session",
    );
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await play(pearlSeaAdapter, `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
