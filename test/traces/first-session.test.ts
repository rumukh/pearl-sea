/**
 * Golden traces: a 3rd grader's first session, once for each of the three lagoon eggs.
 *
 * On 2026-11-02 the child skips the prologue, reads Osmička's first-egg beat, chooses an egg and
 * plays Slunná laguna 1 (design §4.1): two alphabet necklaces (checking the first one too early,
 * which leaves it editable), the consonant nets (one fish in a wrong net first, which swims back),
 * then ten Krmení problems by choice, the second one deliberately wrong and re-asked. The chosen egg
 * hatches in this first lesson, the first stickers and coins arrive, the child buys the captain's
 * hat at U Mrože and puts it on the new friend, and the map makes the next lesson glow.
 *
 * Named checks come first and say what broke; the golden hashes and trajectories are change
 * detectors checked last. Answers come from the harness's independent oracle.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { success } from '@aegis/runtime';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import type { AnswerValue, GameView } from '../../src/rules/contract';
import { LAGOON_EGGS } from '../fixtures/rules/packs';
import { PERFECT, Player, rightNet, trajectoryDigest } from './support';
import type { Adapter } from './support';

// Whole sessions are replayed one commit at a time: give them room on a busy machine.
vi.setConfig({ testTimeout: 300_000 });

/**
 * Golden final-state hashes and commit trajectories, one per egg. Captured once from the first
 * green run of this scenario (Windows, Node 24, the pinned Aegis SDK, the rules' lagoon fixture)
 * and pinned as literals. Re-pin only for a deliberate rules or fixture change, with the reason
 * and the old and new values in the commit message (docs/testing.md, "When a golden moves").
 */
const GOLDEN: Record<string, { state: string; trajectory: string }> = {
  'krab-tvrdak': { state: '13a006d7f7486e4a', trajectory: '1c6cf50d9c98b444' },
  'meduzka-mekulka': { state: 'fd794d395fab67e0', trajectory: 'b79ec55ba6c2329d' },
  'zelva-obojka': { state: '819507a19c048d70', trajectory: '5567d451ce70d5f0' },
};

const SEED = 'golden-first-session';
const DAY = '2026-11-02';
/** The second Krmení answer is wrong (the boards' moves are not answers). */
const FEEDING_MISS = 2;
const HAT = 'hat-captain';
const HAT_PRICE = 20;

interface Observation {
  egg: string;
  player: Player;
  nextAfterEgg: GameView['hub']['next'] | null;
  feeding: { item: string; index: number; reask: boolean; input: string }[];
  /** The necklace after the early check, and the nets after the wrong haul. */
  necklaceKeptAfterEarlyCheck: boolean;
  wrongFishSwamBack: boolean;
  final: GameView;
}

async function playFirstSession(egg: string, adapter: Adapter = pearlSeaAdapter, seed = SEED) {
  const player = new Player({ ...PERFECT, right: (n) => n !== FEEDING_MISS }, seed, adapter);
  const observation: Observation = {
    egg,
    player,
    nextAfterEgg: null,
    feeding: [],
    necklaceKeptAfterEarlyCheck: false,
    wrongFishSwamBack: false,
    final: player.view(),
  };
  const ok =
    (await player.act({ type: 'startSession', day: DAY })) &&
    (await player.choose(null)) &&
    (await settle(player)) &&
    (await player.act({ type: 'chooseFirstFriend', friend: egg }));
  if (ok) {
    observation.nextAfterEgg = player.view().hub.next;
    await player.act({ type: 'startLevel', level: 'sunny-lagoon.1' });
    await player.settleStory();
    // The first necklace: an early check leaves the pearls where they are, to be moved.
    const before = necklace(player.view());
    await player.move({ type: 'submit' });
    const after = necklace(player.view());
    observation.necklaceKeptAfterEarlyCheck =
      before !== null && after !== null && after.submitted && after.pearls === before.pearls;
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    observation.wrongFishSwamBack = await haulOneWrongFish(player);
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 2 } });
    for (let guard = 0; guard < 30; guard++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
      const { item, index, reask, input } = round.problem;
      observation.feeding.push({ item, index, reask, input });
      if (!(await player.answer())) break;
    }
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
    await player.act({ type: 'buy', item: HAT });
    await player.act({ type: 'equip', friend: egg, slot: 'head', item: HAT });
  }
  observation.final = player.view();
  return observation;
}

/** Read through the first-egg beat (it cannot be skipped). */
async function settle(player: Player): Promise<boolean> {
  await player.settleStory();
  return player.view().story === null;
}

function necklace(view: GameView) {
  const round = view.round;
  if (round?.type !== 'minigame' || round.current.kind !== 'pearl-necklace') return null;
  return {
    pearls: round.current.pearls.map((p) => p.id).join(','),
    submitted: round.current.submitted,
  };
}

/** Put the first fish in a wrong net and haul: it must swim back out, marked, to be placed again. */
async function haulOneWrongFish(player: Player): Promise<boolean> {
  const round = player.view().round;
  if (round?.type !== 'minigame' || round.current.kind !== 'fishing-nets') return false;
  const board = round.current;
  const fish = board.fish[0]!;
  const wrong = (rightNet(player.data, board, fish) + 1) % board.nets.length;
  await player.move({ type: 'net', fish: fish.id, net: wrong });
  await player.move({ type: 'submit' });
  const now = player.view().round;
  if (now?.type !== 'minigame' || now.current.kind !== 'fishing-nets') return false;
  const swum = now.current.fish.find((f) => f.id === fish.id)!;
  return swum.wrong && swum.net === null && now.status === 'active';
}

/** Named checks: each names a capability, so a failure reads as a bug report. */
function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const activities = p.data_('round.started').map((e) => (e as { activity: string }).activity);
  const missed = o.feeding[FEEDING_MISS - 1];
  const reask = o.feeding.find((f) => f.reask);
  const coins = p.data_('coins.earned') as { amount: number; reason: string }[];
  const earned = coins.reduce((sum, e) => sum + e.amount, 0);
  const stars = coins.filter((e) => e.reason === 'stars');
  const friend = o.final.friends.find((f) => f.id === o.egg);
  const answers = o.feeding.length;
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'the session started exactly once, on a new day':
      JSON.stringify(p.data_('session.started')) === `[{"day":"${DAY}","newDay":true}]`,
    'the chosen egg was the only egg received':
      JSON.stringify(p.data_('egg.received')) === JSON.stringify([{ friend: o.egg }]),
    'Slunná laguna 1 was the next step after the egg':
      o.nextAfterEgg?.kind === 'level' && o.nextAfterEgg.level === 'sunny-lagoon.1',
    'the level played two necklaces and the nets, then Krmení':
      JSON.stringify(activities) === '["pearl-necklace","fishing-nets","feeding"]' &&
      p.count('minigame.completed') === 3,
    'an early necklace check left the pearls to be moved': o.necklaceKeptAfterEarlyCheck,
    'a fish in a wrong net swam back to be placed again': o.wrongFishSwamBack,
    'Krmení asked ten problems by choice, one of them the re-ask':
      answers === 10 &&
      o.feeding.every((f) => f.input === 'choice') &&
      o.feeding.filter((f) => f.reask).length === 1,
    'each answer cost exactly one logical turn': p.turn === answers,
    'the missed item came back three problems later as a re-ask':
      missed !== undefined &&
      reask !== undefined &&
      reask.item === missed.item &&
      reask.index === missed.index + 3,
    'no item was served three times in one Krmení': o.feeding.every(
      (f) => o.feeding.filter((g) => g.item === f.item).length <= 2,
    ),
    'the chosen egg hatched in the first lesson':
      JSON.stringify(p.data_('friend.hatched')) === JSON.stringify([{ friend: o.egg }]) &&
      friend?.stage === 'baby',
    'nine of ten right earned two stars on the first try':
      JSON.stringify(p.data_('level.completed')) ===
      '[{"level":"sunny-lagoon.1","stars":2,"firstTime":true}]',
    'the star coins were 2 and 4':
      JSON.stringify(stars) === '[{"amount":2,"reason":"stars"},{"amount":4,"reason":"stars"}]',
    'the wallet is everything earned minus the hat': o.final.coins === earned - HAT_PRICE,
    'the first stickers were earned': [
      'sticker.first-baby',
      'sticker.lagoon-steps',
      'sticker.first-outfit',
    ].every((id) => state.stickers[id] !== undefined),
    'the new friend wears the captain hat': friend?.outfit.head === HAT,
    'no monster and no Inkoustík showed up yet':
      p.count('monster.joked') === 0 && p.count('inkoustik.ambushed') === 0,
    'the map makes the next lesson glow':
      o.final.hub.regions.find((r) => r.id === 'sunny-lagoon')?.levels.find((l) => l.glowing)
        ?.id === 'sunny-lagoon.2',
    'the child is back at the hub': o.final.screen === 'hub' && o.final.round === null,
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

for (const egg of LAGOON_EGGS) {
  describe(`golden trace: first session with the ${egg} egg`, () => {
    // The scenario runs once; both tests read the same observation.
    let main: ReturnType<typeof playFirstSession> | undefined;
    const scenario = () => (main ??= playFirstSession(egg));
    afterAll(async () => (await main)?.player.dispose());

    it('plays the first session with every named capability intact', async () => {
      const observation = await scenario();
      expect(failedChecks(observation), observation.player.failures.join('; ')).toEqual([]);
    });

    it('matches the pinned golden hash and trajectory', async () => {
      const observation = await scenario();
      expect(observation.player.host.hash(), 'final state hash (GOLDEN hash)').toBe(
        GOLDEN[egg]!.state,
      );
      expect(
        trajectoryDigest(observation.player.hashes),
        'commit trajectory (GOLDEN trajectory)',
      ).toBe(GOLDEN[egg]!.trajectory);
    });
  });
}

/** An answer no Czech gap, pick or option ever expects. */
function spoil(value: AnswerValue): AnswerValue {
  switch (value.kind) {
    case 'text':
      return { kind: 'text', value: value.value === 'q' ? 'w' : 'q' };
    case 'option':
      return { kind: 'option', value: 'x' };
    case 'pick':
      return { kind: 'pick', index: 31 };
  }
}

describe('mutation checks: the named checks fail when a capability breaks', () => {
  const egg = LAGOON_EGGS[0]!;

  it('answers that cost no turns never let the re-ask come back', async () => {
    const free: Adapter = {
      ...pearlSeaAdapter,
      resolve(action, read) {
        const plan = pearlSeaAdapter.resolve(action, read);
        return plan.ok ? success({ ...plan.value, turns: 0 }) : plan;
      },
    };
    const observation = await playFirstSession(egg, free);
    const failed = failedChecks(observation);
    expect(failed).toContain('the missed item came back three problems later as a re-ask');
    expect(failed).toContain('each answer cost exactly one logical turn');
    await observation.player.dispose();
  });

  it('grading every answer as wrong breaks hatching, stars and the re-ask count', async () => {
    const harsh: Adapter = {
      ...pearlSeaAdapter,
      commands: pearlSeaAdapter.commands.map((rule) =>
        rule.id === 'answer'
          ? ({
              ...rule,
              start(context: never, pending: { payload: unknown }) {
                const action = pending.payload as { value: AnswerValue };
                rule.start!(context, {
                  ...(pending as object),
                  payload: { ...(pending.payload as object), value: spoil(action.value) },
                } as never);
              },
            } as never)
          : rule,
      ),
    };
    const observation = await playFirstSession(egg, harsh);
    const failed = failedChecks(observation);
    expect(failed).toContain('the chosen egg hatched in the first lesson');
    expect(failed).toContain('nine of ten right earned two stars on the first try');
    expect(failed).toContain('Krmení asked ten problems by choice, one of them the re-ask');
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playFirstSession(egg, pearlSeaAdapter, `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN[egg]!.state);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN[egg]!.trajectory);
    await reseeded.player.dispose();
  });
});
