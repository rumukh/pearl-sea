/**
 * Golden trace: the Slunná laguna slice end to end, then the first Inkoustíci.
 *
 * On 2026-11-02 a 3rd grader chooses Krab's egg and plays the whole lagoon in one go (lessons 1-6
 * and Muréna Mumla's battle), answering mostly right with a slip now and then. The trace checks
 * the slice's promises (design §3.1, §4.1, §7.1, §7.4): every lesson completes, the other two
 * eggs float back as lesson 3 starts and every lagoon friend hatches; the battle washes one blot
 * per right answer and never refills on a miss, splashes a harmless blot every 4 answers, tells a
 * joke at the start, after the 5th and 10th right answer and when freed (cycling, never the same
 * joke twice in a row), and frees Muréna, which opens the deep, the race and the Inkoustíci. Then
 * the child opens the treasure chest and plays Měsíční jeskyně 1, where an Inkoustík ambushes a
 * Krmení problem (never before the third problem, at most one a round) and a right answer splashes
 * it away for a bonus coin; on 2026-11-03 Svačinka feeds the hungry friends.
 *
 * Named checks come first; the golden hash and trajectory are change detectors checked last.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import type { ContentData, GameView } from '../../src/rules/contract';
import type { ContentPack } from '@aegis/runtime';
import { lagoonPack, lagoonPackWith } from '../fixtures/rules/packs';
import { Player, trajectoryDigest } from './support';
import type { Recorded, Served, Style } from './support';

vi.setConfig({ testTimeout: 300_000 });

/**
 * Pinned literals (docs/testing.md, "When a golden moves"). The trajectory was re-pinned when Lov
 * chyb's punctuation moved from its tokens into `marks` (d2aa58e91b187117 before; folding the marks
 * back into the tokens gives it again), and when hints took their examples from other families
 * (0462676a1ecfe3a4 before; with every hint neutralized, the old and the new rules both give
 * b29b6dec9c9b7473); both when the state version became 2 (3e39d1b03b1f527c and 64b802a933949722
 * before; with STATE_VERSION 1 they come back).
 */
const GOLDEN_HASH = '7842bc5461a7b7df';
const GOLDEN_TRAJECTORY = 'cad636562d32ac3b';

const SEED = 'slice-b';
const LESSONS = [
  'sunny-lagoon.1',
  'sunny-lagoon.2',
  'sunny-lagoon.3',
  'sunny-lagoon.4',
  'sunny-lagoon.5',
  'sunny-lagoon.6',
];
const MONSTER = 'sunny-lagoon.monster';
const MURENA = 'murena-mumla';
const EGGS = ['krab-tvrdak', 'meduzka-mekulka', 'zelva-obojka'];

/** Mostly right, one slip in nine, sometimes slow. */
const CHILD: Style = {
  right: (n) => n % 9 !== 4,
  elapsedMs: (n) => (n % 4 === 0 ? 4000 : 1800),
  clumsy: false,
};

interface Observation {
  player: Player;
  /** Events of the battle round, from its start to the level's end. */
  battle: Recorded[];
  meter: number;
  jokes: string[];
  afterMurena: GameView;
  /** Events from the chest on. */
  later: Recorded[];
  /** The Krmení steps of Měsíční jeskyně 1. */
  caves: Served[];
  final: GameView;
}

async function play(pack: ContentPack<ContentData> = lagoonPack(), seed = SEED) {
  const player = new Player(CHILD, seed, pearlSeaAdapter, pack);
  await player.act({ type: 'startSession', day: '2026-11-02' });
  await player.choose(null);
  await player.settleStory();
  await player.act({ type: 'chooseFirstFriend', friend: EGGS[0]! });
  for (const level of LESSONS) await player.playLevel(level);
  const battleStart = player.events.length;
  await player.playLevel(MONSTER);
  const battle = player.events.slice(battleStart);
  const afterMurena = player.view();
  const laterStart = player.events.length;
  await player.act({ type: 'openChest' });
  const cavesStart = player.served.length;
  await player.playLevel('moon-caves.1');
  const caves = player.served.slice(cavesStart).filter((s) => s.activity === 'feeding');
  await player.act({ type: 'startSession', day: '2026-11-03' });
  await player.settleStory();
  const next = player.view().hub.next;
  if (next.kind === 'snack') {
    await player.act({ type: 'startActivity', activity: { kind: 'snack', friend: next.friend } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
  }
  const monster = pack.data.monsters.find((m) => m.id === MURENA)!;
  return {
    player,
    battle,
    meter: monster.meter,
    jokes: [...monster.jokes],
    afterMurena,
    later: player.events.slice(laterStart),
    caves,
    final: player.view(),
  } satisfies Observation;
}

/** The events of the battle in order, as short tokens: answers, washes, splashes, jokes. */
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
      case 'ink.splashed':
        return ['splash'];
      case 'monster.joked':
        return [`joke:${String(data.joke)}`];
      case 'round.completed':
        return ['done'];
      case 'monster.freed':
        return ['freed'];
      default:
        return [];
    }
  });
}

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const tape = battleTape(o.battle);
  const answers = tape.filter((t) => t === 'right' || t === 'miss');
  const washes = tape.filter((t) => t.startsWith('wash:'));
  const jokes = tape.filter((t) => t.startsWith('joke:')).map((t) => t.slice('joke:'.length));
  const at = (token: string) => tape.indexOf(token);
  // After each right answer comes its wash; a miss is followed by no wash.
  const washAfterEachRight = tape.every((token, i) =>
    token === 'right'
      ? tape[i + 1]?.startsWith('wash:') === true || washes.length >= o.meter
      : token === 'miss'
        ? tape[i + 1]?.startsWith('wash:') !== true
        : true,
  );
  // A splash follows every 4th answer of the battle.
  let answered = 0;
  const splashesInPlace = tape.every((token, i) => {
    if (token !== 'right' && token !== 'miss') return true;
    answered += 1;
    const rest = tape.slice(i + 1);
    const nextAnswer = rest.findIndex((t) => t === 'right' || t === 'miss');
    const window = nextAnswer === -1 ? rest : rest.slice(0, nextAnswer);
    return window.includes('splash') === (answered % 4 === 0);
  });
  const ambushed = p.served.filter((s) => s.ambush !== null);
  const splashed = p.data_('inkoustik.splashed') as { inkoustik: string; coins: number }[];
  const rounds = new Map<string, number>();
  for (const s of ambushed) rounds.set(s.round, (rounds.get(s.round) ?? 0) + 1);
  const beforeMurena = p.events.slice(0, p.events.length - o.later.length - o.battle.length);
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'every lagoon lesson and the battle completed': [...LESSONS, MONSTER].every(
      (level) => (state.levels[level]?.stars ?? 0) >= 1,
    ),
    'the other two eggs floated back as lesson 3 started, and all three hatched':
      JSON.stringify(
        (p.data_('egg.received') as { friend: string }[]).slice(0, 3).map((e) => e.friend),
      ) === JSON.stringify(EGGS) &&
      EGGS.every((egg) => state.friends[egg] !== undefined && state.friends[egg]!.stage !== 'egg'),
    'the battle started with a joke, before any answer':
      tape[0] === 'start:battle' && tape[1] === `joke:${o.jokes[0]}`,
    'every right answer washed one blot and no miss refilled or washed':
      washAfterEachRight &&
      JSON.stringify(washes) ===
        JSON.stringify(Array.from({ length: o.meter }, (_, i) => `wash:${i + 1}`)),
    'the monster joked right after the 5th and the 10th blot, and when freed':
      jokes.length === 4 &&
      tape[at('wash:5') + 1] === `joke:${jokes[1]}` &&
      tape[at('wash:10') + 1] === `joke:${jokes[2]}` &&
      tape.lastIndexOf(`joke:${jokes[3]}`) > at('done'),
    'the jokes cycle through the list and never repeat back to back':
      JSON.stringify(jokes) ===
        JSON.stringify([0, 1, 2, 3].map((i) => o.jokes[i % o.jokes.length])) &&
      jokes.every((joke, i) => i === 0 || joke !== jokes[i - 1]),
    'a harmless blot splashed after every 4th answer': splashesInPlace && answers.length >= 4,
    'the battle stayed within its kindness cap': answers.length <= o.meter + 5,
    'Muréna was freed: the gallery, her sticker and the deep opened':
      tape.includes('freed') &&
      state.monsters[MURENA] !== undefined &&
      state.stickers['sticker.murena-sings'] !== undefined &&
      p.data_('region.unlocked').some((e) => (e as { region: string }).region === 'moon-caves'),
    'the race opened with Muréna': o.afterMurena.hub.race.available,
    'no Inkoustík came before Muréna was freed, nor in a battle':
      !beforeMurena.some((e) => e.type === 'inkoustik.ambushed') &&
      !o.battle.some((e) => e.type === 'inkoustik.ambushed'),
    'an Inkoustík ambushed a cave Krmení problem from the third on': o.caves.some(
      (s) => s.ambush !== null && s.index >= 3 && !s.reask && !s.teach,
    ),
    'at most one Inkoustík a round, never on a re-ask or a taught problem':
      [...rounds.values()].every((n) => n === 1) && ambushed.every((s) => !s.reask && !s.teach),
    'a right answer splashed an Inkoustík away for one bonus coin; a miss let it swim off':
      splashed.length === ambushed.filter((s) => s.right).length &&
      splashed.length > 0 &&
      splashed.every((s) => s.coins === 1) &&
      state.splashed === splashed.length &&
      state.stickers['sticker.splash'] !== undefined,
    'Svačinka fed the hungry friends the next day': p.served.some((s) => s.activity === 'snack'),
    'the child is back at the hub': o.final.round === null && o.final.screen === 'hub',
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: Slunná laguna end to end, then the first Inkoustíci', () => {
  let main: Promise<Observation> | undefined;
  const scenario = () => (main ??= play());
  afterAll(async () => (await main)?.player.dispose());

  it('plays the slice with every named capability intact', async () => {
    const observation = await scenario();
    const failed = failedChecks(observation);
    if (failed.length > 0) console.log(battleTape(observation.battle).join(' '));
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
  it('with no Inkoustík chance the ambush checks fail', async () => {
    const calm = lagoonPackWith((data) => {
      data.balance.ambush.chance = 0;
    });
    const observation = await play(calm);
    const failed = failedChecks(observation);
    expect(failed).toContain('an Inkoustík ambushed a cave Krmení problem from the third on');
    expect(failed).not.toContain('Muréna was freed: the gallery, her sticker and the deep opened');
    await observation.player.dispose();
  });

  it('a monster with one joke breaks the cycling check', async () => {
    const dull = lagoonPackWith((data) => {
      data.monsters.find((m) => m.id === MURENA)!.jokes.splice(1);
    });
    const observation = await play(dull);
    expect(failedChecks(observation)).toContain(
      'the jokes cycle through the list and never repeat back to back',
    );
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await play(lagoonPack(), `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
