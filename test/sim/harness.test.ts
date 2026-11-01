/**
 * The learner simulation plays the real rules (driver.ts): short runs on the game's pack, as the
 * Vitest gate can afford (the long runs are `node scripts/simulate.mjs`, docs/balance-report.md).
 */
import { describe, expect, it, vi } from 'vitest';
import { realPack } from '../fixtures/rules/packs';
import { overdueKnown, simulate } from './driver';
import type { GrowthVariant } from './growth';
import { runChecks } from './report';

vi.setConfig({ testTimeout: 300_000 });

const pack = realPack();

/** The shipped growth rules, as a variant: it must give exactly the game's own stage days. */
const SHIPPED: GrowthVariant = {
  id: 'shipped',
  gates: pack.data.balance.growth.map((gate) => ({
    stage: gate.stage,
    share: gate.share,
    mastery: gate.mastery,
    monster: gate.monster,
  })),
};

describe('the learner simulation', () => {
  it('plays a perfect first session: every answer right, coins, the first hatch, the chest', async () => {
    const report = await simulate('perfect', { pack, days: 1 });
    const first = report.days[0]!;
    expect(report.failures).toEqual([]);
    expect(first.answers).toBeGreaterThanOrEqual(30);
    expect(first.correct).toBe(first.answers);
    expect(first.hatched.length).toBeGreaterThan(0);
    expect(first.coins).toBeGreaterThan(0);
    expect(first.goalReached && first.chestOpened).toBe(true);
    expect(first.levels.length).toBeGreaterThan(0);
  });

  it('plays a struggling week without a rejected step, with misses, coins and the shipped growth', async () => {
    const report = await simulate('struggling', { pack, days: 7, growthVariants: [SHIPPED] });
    const sessions = report.days.filter((d) => d.played);
    expect(report.failures).toEqual([]);
    expect(sessions.length).toBe(4);
    expect(sessions.every((d) => d.coins > 0)).toBe(true);
    expect(sessions.some((d) => d.correct < d.answers)).toBe(true);
    // Growth never feeds back into play: the shipped rules as a variant give the game's own days.
    expect(report.growthVariants['shipped']).toEqual(report.stages);
    const failed = runChecks([report]).filter((c) => !c.ok && c.id === 'accepted');
    expect(failed).toEqual([]);
  });

  it('gives the same run for the same seed', async () => {
    const run = () => simulate('average', { pack, days: 2, seed: 'repeat' });
    const [a, b] = [await run(), await run()];
    expect(b.days).toEqual(a.days);
    expect(b.stages).toEqual(a.stages);
  });
});

describe('the known items the no-starving check watches', () => {
  it('counts items in box 2+ past their review day, most overdue first', () => {
    const items = {
      a: { box: 2, due: 10 },
      b: { box: 1, due: 5 },
      c: { box: 4, due: 8 },
      d: { box: 3, due: 12 },
    };
    expect(overdueKnown(items, 11)).toEqual([
      { item: 'c', days: 3 },
      { item: 'a', days: 1 },
    ]);
  });
});
