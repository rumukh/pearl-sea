/**
 * Saves shared by the rules' unit tests: a child who played part of the lagoon fixture, made
 * once per test file and restored into fresh players (so each test plays on from the same point
 * in its own style).
 */
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import type { ContentData } from '../../../src/rules/contract';
import { PERFECT, Player } from '../../traces/support';
import type { Style } from '../../traces/support';

export const LAGOON_LESSONS = [
  'sunny-lagoon.1',
  'sunny-lagoon.2',
  'sunny-lagoon.3',
  'sunny-lagoon.4',
  'sunny-lagoon.5',
  'sunny-lagoon.6',
];

/** Play `levels` with a perfect 3rd grader who chose `egg`, and return the last commit's save. */
export async function saveAfter(
  levels: readonly string[],
  options: { egg?: string; pack?: ContentPack<ContentData>; seed?: string } = {},
): Promise<RuntimeSnapshot> {
  const player = new Player(PERFECT, options.seed ?? 'unit', undefined, options.pack);
  let snapshot: RuntimeSnapshot | null = null;
  player.host.subscribeCommits((commit) => {
    snapshot = commit.snapshot;
  });
  await player.begin(options.egg ?? 'krab-tvrdak');
  for (const level of levels) await player.playLevel(level);
  if (player.failures.length > 0) throw new Error(`save failed: ${player.failures.join('; ')}`);
  await player.dispose();
  return snapshot!;
}

/** A fresh player of `style` going on from `save`. */
export async function playerFrom(
  save: RuntimeSnapshot,
  style: Style = PERFECT,
  options: { pack?: ContentPack<ContentData>; seed?: string } = {},
): Promise<Player> {
  const player = new Player(style, options.seed ?? 'unit', undefined, options.pack);
  if (!(await player.restore(save))) throw new Error(player.failures.join('; '));
  return player;
}
