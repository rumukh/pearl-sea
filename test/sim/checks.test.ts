/**
 * The named balance checks judge simulation reports correctly: each passes a report that meets its
 * target and fails, naming what it measured, one that misses it. Synthetic reports keep these tests
 * instant; the long runs that feed the checks are `node scripts/simulate.mjs --check`.
 */
import { describe, expect, it } from 'vitest';
import type { DayReport, SimulationReport } from './driver';
import type { LearnerName } from './learners';
import { TARGETS, growth, markdown, percent, runChecks, spread, summarise } from './report';

function day(index: number, patch: Partial<DayReport> = {}): DayReport {
  return {
    index,
    day: `2026-11-${String(2 + index).padStart(2, '0')}`,
    played: true,
    answers: 40,
    correct: 32,
    fast: 20,
    answerMs: 300_000,
    coins: 60,
    coinsBy: { answer: 32, quest: 28 },
    stickers: index === 10 ? ['sticker-murena'] : [],
    eggs: index === 0 ? ['krab'] : [],
    hatched: index === 0 ? ['krab'] : [],
    grew: [],
    levels: index === 0 ? ['a.1'] : index === 3 ? ['a.monster'] : [],
    monsters: index === 3 ? ['murena'] : [],
    pearls: 0,
    boardRounds: 1,
    bought: index % 4 === 0 ? [`cosmetic-${index}`] : [],
    cosmeticsOwned: 2,
    quests: 2,
    goalReached: true,
    chestOpened: true,
    ambushes: 1,
    dueAtStart: 10,
    maxOverdueAtStart: 2,
    overdueAtStart: ['spell:ryba:1:2'],
    commits: 100,
    byActivity: { feeding: { answers: 30, correct: 24 }, snack: { answers: 10, correct: 8 } },
    ...patch,
  };
}

/** A report of a learner that meets every target, for 14 days. */
function report(learner: LearnerName, patch: Partial<SimulationReport> = {}): SimulationReport {
  const days = Array.from({ length: 14 }, (_, i) => day(i));
  return {
    learner,
    seed: 'test',
    daysSimulated: days.length,
    content: {
      revision: '1.0.0',
      levels: ['a.1', 'a.monster'],
      monsters: ['a.monster'],
      regions: [{ id: 'a', lessons: ['a.1'], monster: 'a.monster' }],
      friends: [{ id: 'krab', monster: 'murena' }],
      cosmetics: 6,
      finale: null,
    },
    days,
    failures: [],
    stages: { krab: { egg: 0, baby: 0, grown: 8 } },
    finalStages: { krab: 'grown' },
    friends: {},
    stars: { 'a.1': 3, 'a.monster': 3 },
    levelDays: { 'a.1': 0, 'a.monster': 3 },
    monsterDays: { murena: 3 },
    eggDays: { krab: 0 },
    finaleDay: null,
    coins: 800,
    stickers: 10,
    overdue: [],
    mastery: { cloudy: 10, bronze: 20, silver: 30, gold: 5 },
    problemOnly: { items: 40, silver: 20, gold: 0, goldItems: [] },
    growthVariants: {},
    ...patch,
  };
}

const check = (r: SimulationReport, id: string) => {
  const found = runChecks([r]).find((c) => c.id === id);
  if (!found) throw new Error(`no check ${id} for ${r.learner}`);
  return found;
};

const withDays = (r: SimulationReport, change: (d: DayReport) => Partial<DayReport>) => ({
  ...r,
  days: r.days.map((d) => ({ ...d, ...change(d) })),
});

describe('summaries', () => {
  it('computes medians and percentages with integer arithmetic', () => {
    expect(spread([5, 1, 3])).toEqual({ min: 1, median: 3, max: 5 });
    expect(spread([4, 1, 3, 2])).toEqual({ min: 1, median: 2, max: 4 });
    expect(spread([])).toEqual({ min: 0, median: 0, max: 0 });
    expect(percent(2, 3)).toBe(66);
    expect(percent(1, 0)).toBe(0);
    const s = summarise(report('average'));
    expect(s.sessions).toBe(14);
    expect(s.successPct).toBe(80);
    expect(s.coinsPerSession.median).toBe(60);
    expect(s.minutesPerSession.median).toBe(5);
    expect(s.byActivity).toEqual({
      feeding: { answers: 420, successPct: 80 },
      snack: { answers: 140, successPct: 80 },
    });
  });

  it('times a friend’s growth from the day its monster was freed (or it arrived, if later)', () => {
    expect(growth(report('average'))).toEqual([
      { friend: 'krab', egg: 0, baby: 0, ready: 3, grown: 8, crowned: null, wait: 5 },
    ]);
    const late = report('average', { eggDays: { krab: 5 }, stages: { krab: { egg: 5 } } });
    expect(growth(late)[0]).toMatchObject({ ready: 5, grown: null, wait: null });
  });

  it('renders every check in the markdown report', () => {
    const r = report('average');
    const text = markdown([summarise(r)], runChecks([r]), {
      days: 14,
      seed: 'test',
      revision: '1.0.0',
    });
    expect(text.split('\n')[0]).toBe('# Learner simulation: 14 days, seed "test", content 1.0.0');
    expect(text).toContain('| average | 14 |');
    expect(text).toContain('krab 0/3/8/-');
    for (const c of runChecks([r])) expect(text).toContain(`PASS ${c.name}`);
  });
});

describe('the balance checks pass a report that meets every target', () => {
  for (const learner of ['perfect', 'average', 'struggling', 'slow'] as const) {
    it(learner, () => {
      const failed = runChecks([report(learner)]).filter((c) => !c.ok);
      expect(failed.map((c) => c.name)).toEqual([]);
    });
  }
});

describe('the balance checks fail, by name, a report that misses a target', () => {
  it('a rejected step', () => {
    const c = check(report('average', { failures: ['answer: no-problem'] }), 'accepted');
    expect(c.ok).toBe(false);
    expect(c.name).toContain('1 rejected: answer: no-problem');
  });

  it('no hatch in the first session', () => {
    const r = withDays(report('average'), (d) => (d.index === 0 ? { hatched: [] } : {}));
    expect(check(r, 'first-hatch')).toMatchObject({ ok: false });
    expect(check(r, 'first-hatch').name).toContain('hatched: none');
  });

  it('success outside the band in too many sessions, or a median outside it', () => {
    const { low, high } = TARGETS.success;
    const outside = withDays(report('average'), (d) => (d.index % 2 ? { correct: 39 } : {}));
    expect(check(outside, 'success-band').ok).toBe(false);
    const high95 = withDays(report('average'), () => ({ correct: 38 }));
    expect(check(high95, 'success-band').ok).toBe(false);
    expect(check(high95, 'success-band').name).toContain(`within ${low}-${high} %`);
    expect(check(high95, 'success-band').name).toContain('median 95 %');
  });

  it('the band over the first 12 weeks; a longer run reports the whole run as measured', () => {
    const days = Array.from({ length: 100 }, (_, i) =>
      day(i, { correct: i < 84 ? 32 : 39, levels: [], hatched: i === 0 ? ['krab'] : [] }),
    );
    const c = check(report('average', { days, daysSimulated: 100 }), 'success-band');
    expect(c.ok).toBe(true);
    expect(c.name).toContain('of the first 12 weeks');
    expect(c.name).toContain('the whole run, as measured');
  });

  it('a struggling child under 60 % success; at 60 % it passes', () => {
    const low = withDays(report('struggling'), () => ({ correct: 23 }));
    expect(check(low, 'success-floor')).toMatchObject({ ok: false });
    expect(check(low, 'success-floor').name).toContain('median success per session 57 %');
    const sixty = withDays(report('struggling'), () => ({ correct: 24 }));
    expect(check(sixty, 'success-floor').ok).toBe(true);
  });

  it('a session without coins', () => {
    const r = withDays(report('average'), (d) => (d.index === 5 ? { coins: 0 } : {}));
    expect(check(r, 'rewarded')).toMatchObject({ ok: false });
    expect(check(r, 'rewarded').name).toContain('in 13 of 14 sessions');
  });

  it('a week without any progress', () => {
    const r = withDays(report('slow'), (d) =>
      d.index >= 7 ? { levels: [], hatched: [], grew: [], stickers: [], pearls: 0 } : {},
    );
    expect(check(r, 'progress-weekly')).toMatchObject({ ok: false });
    expect(check(r, 'progress-weekly').name).toContain('in 1 of 2 weeks');
    // A pearl turned silver or gold is progress the child sees in the Great Shell.
    const shone = withDays(r, (d) => (d.index === 9 ? { pearls: 2 } : {}));
    expect(check(shone, 'progress-weekly').ok).toBe(true);
  });

  it('a goal reached without the chest', () => {
    const r = withDays(report('average'), (d) => (d.index === 2 ? { chestOpened: false } : {}));
    expect(check(r, 'chest')).toMatchObject({ ok: false });
  });

  it('an egg that waits too long to hatch, or never hatches past the limit', () => {
    const late = report('average', {
      eggDays: { krab: 0, medusa: 0 },
      stages: { krab: { egg: 0, baby: 0 }, medusa: { egg: 0, baby: 9 } },
    });
    expect(check(late, 'hatch-pace')).toMatchObject({ ok: false });
    expect(check(late, 'hatch-pace').name).toContain('medusa 10');
    const never = report('average', {
      eggDays: { krab: 0, medusa: 2 },
      stages: { krab: { egg: 0, baby: 0 }, medusa: { egg: 2 } },
    });
    expect(check(never, 'hatch-pace').name).toContain('medusa not yet');
    // An egg received in the last sessions of a run may still be warming.
    const fresh = report('average', {
      eggDays: { krab: 0, medusa: 12 },
      stages: { krab: { egg: 0, baby: 0 }, medusa: { egg: 12 } },
    });
    expect(check(fresh, 'hatch-pace').ok).toBe(true);
  });

  it('a level never completed, a monster never freed', () => {
    const r = report('average', {
      levelDays: { 'a.1': 0 },
      stars: { 'a.1': 3 },
      monsterDays: {},
    });
    expect(check(r, 'no-dead-end')).toMatchObject({ ok: false });
    expect(check(r, 'no-dead-end').name).toContain('completed 1 of 2 levels and freed 0 of 1');
  });

  it("a struggling child that stalls, leaves a finished region's monster, or falls short", () => {
    const content = {
      ...report('struggling').content,
      levels: ['a.1', 'a.2', 'a.monster'],
      regions: [{ id: 'a', lessons: ['a.1', 'a.2'], monster: 'a.monster' }],
    };
    const stalled = report('struggling', {
      content,
      levelDays: { 'a.1': 0 },
      stars: { 'a.1': 1 },
    });
    const steady = check(
      withDays(stalled, () => ({ levels: [] })),
      'steady-path',
    );
    expect(steady.ok).toBe(false);
    expect(steady.name).toContain('none in the weeks from day 0, 7');
    const leftMonster = report('struggling', {
      content,
      levelDays: { 'a.1': 0, 'a.2': 1 },
      stars: { 'a.1': 1, 'a.2': 1 },
    });
    expect(check(leftMonster, 'steady-path').name).toContain(
      'freed the monsters of 0 of 1 finished regions',
    );
  });

  it('a known item that starves', () => {
    const r = withDays(report('average'), (d) =>
      d.index === 9
        ? { maxOverdueAtStart: TARGETS.graceDays + 1, overdueAtStart: ['abc:racek:8'] }
        : {},
    );
    expect(check(r, 'no-starving')).toMatchObject({ ok: false });
    expect(check(r, 'no-starving').name).toContain('the longest: 8 days, abc:racek:8 on day 9');
  });

  it('coins per session outside the design range', () => {
    const r = withDays(report('average'), () => ({ coins: 97 }));
    expect(check(r, 'coins-pace')).toMatchObject({ ok: false });
    expect(check(r, 'coins-pace').name).toContain('a median of 97 coins');
  });

  it('no cosmetic bought in the first week', () => {
    const r = withDays(report('average'), (d) => (d.index < 9 ? { bought: [] } : {}));
    expect(check(r, 'starter-week')).toMatchObject({ ok: false });
    expect(check(r, 'starter-week').name).toContain('on day 12');
  });

  it('a slow child with gold on items only problems ask, or no silver at all', () => {
    const gold = report('slow', {
      problemOnly: { items: 40, silver: 20, gold: 1, goldItems: ['spell:ryba:1'] },
    });
    expect(check(gold, 'fluency')).toMatchObject({ ok: false });
    expect(check(gold, 'fluency').name).toContain('gold 1: spell:ryba:1');
    const none = report('slow', { problemOnly: { items: 40, silver: 0, gold: 0, goldItems: [] } });
    expect(check(none, 'fluency').ok).toBe(false);
  });

  it('a perfect child that reaches the finale late; a pack without a finale passes', () => {
    expect(check(report('perfect'), 'perfect-pace')).toMatchObject({ ok: true });
    expect(check(report('perfect'), 'perfect-pace').name).toContain('no finale yet');
    const content = { ...report('perfect').content, finale: 'abyss.monster' };
    expect(check(report('perfect', { content, finaleDay: 20 }), 'perfect-pace').ok).toBe(true);
    const late = report('perfect', { content, finaleDay: TARGETS.perfectFinaleDays });
    expect(check(late, 'perfect-pace')).toMatchObject({ ok: false });
    expect(check(report('perfect', { content }), 'perfect-pace').name).toContain('day never');
  });

  it('a friend that grows up too long after its monster is freed', () => {
    const days = Array.from({ length: 42 }, (_, i) => day(i));
    const late = report('average', {
      days,
      daysSimulated: 42,
      stages: { krab: { egg: 0, baby: 0, grown: 3 + TARGETS.grownUp.days + 1 } },
    });
    expect(check(late, 'grown-up')).toMatchObject({ ok: false });
    expect(check(late, 'grown-up').name).toContain(`late: krab ${TARGETS.grownUp.days + 1}`);
    const never = report('average', {
      days,
      daysSimulated: 42,
      stages: { krab: { egg: 0, baby: 0 } },
    });
    expect(check(never, 'grown-up').name).toContain('late: krab not yet');
    // A monster freed in the run's last weeks: the friend may still be growing.
    const recent = report('average', { stages: { krab: { egg: 0, baby: 0 } } });
    expect(check(recent, 'grown-up').ok).toBe(true);
  });
});
