/**
 * Summaries, named balance checks and the markdown report of learner simulations. Pure functions
 * over `SimulationReport`s (driver.ts), shared by the Vitest checks (test/sim/*.test.ts) and
 * `scripts/simulate.mjs`. The targets are docs/testing.md §4's, agreed with the coordinator before
 * they are pinned; docs/balance-report.md records the measured values and the reasons.
 */
import type { FriendStage } from '../../src/rules/contract';
import type { DayReport, SimulationReport } from './driver';
import type { LearnerName } from './learners';

export interface Spread {
  min: number;
  median: number;
  max: number;
}

/** Min, median (the lower of two middles) and max of integers (zeros for an empty list). */
export function spread(values: readonly number[]): Spread {
  if (values.length === 0) return { min: 0, median: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0]!,
    median: sorted[(sorted.length - 1 - ((sorted.length - 1) % 2)) / 2]!,
    max: sorted[sorted.length - 1]!,
  };
}

/** `part` of `whole` in whole percent, rounded down (0 when `whole` is 0). */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : (part * 100 - ((part * 100) % whole)) / whole;
}

export const sessionsOf = (report: SimulationReport): DayReport[] =>
  report.days.filter((day) => day.played);

const STAGES: readonly FriendStage[] = ['egg', 'baby', 'grown', 'crowned'];

/**
 * The first day a friend was at `stage` or later (a friend can pass two stages in one step, and the
 * report then holds both), or `null`.
 */
export function stageReached(
  report: SimulationReport,
  friend: string,
  stage: FriendStage,
): number | null {
  const stages = report.stages[friend] ?? {};
  const days = STAGES.slice(STAGES.indexOf(stage))
    .map((s) => stages[s])
    .filter((at): at is number => at !== undefined);
  return days.length > 0 ? Math.min(...days) : null;
}

/** When each friend could grow up (its monster freed) and when it did, in days. */
export interface Growth {
  friend: string;
  egg: number | null;
  baby: number | null;
  /** The day its monster was freed (the day it arrived when it has none). */
  ready: number | null;
  grown: number | null;
  crowned: number | null;
  /** Days from `ready` to `grown`, or `null`. */
  wait: number | null;
}

export function growth(report: SimulationReport): Growth[] {
  return report.content.friends
    .filter((f) => report.stages[f.id] !== undefined)
    .map((f) => {
      const egg = report.stages[f.id]?.egg ?? null;
      // Monsters are freed only by playing (the placement check never places a monster level).
      const monster = f.monster === null ? egg : (report.monsterDays[f.monster] ?? null);
      const ready = monster === null || egg === null ? null : Math.max(monster, egg);
      const grown = stageReached(report, f.id, 'grown');
      return {
        friend: f.id,
        egg,
        baby: stageReached(report, f.id, 'baby'),
        ready,
        grown,
        crowned: stageReached(report, f.id, 'crowned'),
        wait: ready !== null && grown !== null ? Math.max(0, grown - ready) : null,
      };
    });
}

export interface Summary {
  learner: string;
  days: number;
  sessions: number;
  answers: number;
  successPct: number;
  fastPct: number;
  /** Success per session, in percent. */
  success: Spread;
  /** Answers and success (percent) by the round's activity, over the run. */
  byActivity: Record<string, { answers: number; successPct: number }>;
  answersPerSession: Spread;
  /** Board rounds a session (their time is not in the answers' budget). */
  boardRoundsPerSession: Spread;
  /** Minutes of answering a session (thinking, reading and typing; boards and feedback not counted). */
  minutesPerSession: Spread;
  coinsPerSession: Spread;
  coinsByReason: Record<string, number>;
  stickers: number;
  goalSessions: number;
  chestSessions: number;
  ambushes: number;
  levelsCompleted: number;
  /** Day index of the last first-time level completion. */
  lastNewLevelDay: number | null;
  monsterDays: Record<string, number>;
  finaleDay: number | null;
  growth: Growth[];
  mastery: SimulationReport['mastery'];
  problemOnly: SimulationReport['problemOnly'];
  /** Days the most overdue known item (box 2+) had waited when a session began, over all sessions. */
  maxOverdue: number;
  /** Known items (box 2+) due when a session began, over the last 10 sessions. */
  dueLate: Spread;
  overdueAtEnd: { item: string; days: number }[];
  firstPurchaseDay: number | null;
  cosmeticsOwned: number;
  coinsLeft: number;
  failures: string[];
  commits: number;
}

export function summarise(report: SimulationReport): Summary {
  const sessions = sessionsOf(report);
  const answers = sessions.reduce((sum, d) => sum + d.answers, 0);
  const correct = sessions.reduce((sum, d) => sum + d.correct, 0);
  const fast = sessions.reduce((sum, d) => sum + d.fast, 0);
  const coinsByReason: Record<string, number> = {};
  for (const day of sessions) {
    for (const [reason, amount] of Object.entries(day.coinsBy)) {
      coinsByReason[reason] = (coinsByReason[reason] ?? 0) + amount;
    }
  }
  const newLevelDays = sessions.filter((d) => d.levels.length > 0).map((d) => d.index);
  const activities: Record<string, { answers: number; correct: number }> = {};
  for (const day of sessions) {
    for (const [activity, counts] of Object.entries(day.byActivity)) {
      const total = (activities[activity] ??= { answers: 0, correct: 0 });
      total.answers += counts.answers;
      total.correct += counts.correct;
    }
  }
  return {
    learner: report.learner,
    days: report.daysSimulated,
    sessions: sessions.length,
    answers,
    successPct: percent(correct, answers),
    fastPct: percent(fast, correct),
    success: spread(successRates(report)),
    byActivity: Object.fromEntries(
      Object.entries(activities)
        .sort((a, b) => b[1].answers - a[1].answers)
        .map(([activity, c]) => [
          activity,
          { answers: c.answers, successPct: percent(c.correct, c.answers) },
        ]),
    ),
    answersPerSession: spread(sessions.map((d) => d.answers)),
    boardRoundsPerSession: spread(sessions.map((d) => d.boardRounds)),
    minutesPerSession: spread(sessions.map((d) => (d.answerMs - (d.answerMs % 60_000)) / 60_000)),
    coinsPerSession: spread(sessions.map((d) => d.coins)),
    coinsByReason,
    stickers: sessions.reduce((sum, d) => sum + d.stickers.length, 0),
    goalSessions: sessions.filter((d) => d.goalReached).length,
    chestSessions: sessions.filter((d) => d.chestOpened).length,
    ambushes: sessions.reduce((sum, d) => sum + d.ambushes, 0),
    levelsCompleted: Object.keys(report.levelDays).length,
    lastNewLevelDay: newLevelDays.length > 0 ? newLevelDays[newLevelDays.length - 1]! : null,
    monsterDays: report.monsterDays,
    finaleDay: report.finaleDay,
    growth: growth(report),
    mastery: report.mastery,
    problemOnly: report.problemOnly,
    maxOverdue: Math.max(0, ...sessions.map((d) => d.maxOverdueAtStart)),
    dueLate: spread(sessions.slice(-10).map((d) => d.dueAtStart)),
    overdueAtEnd: report.overdue,
    firstPurchaseDay: sessions.find((d) => d.bought.length > 0)?.index ?? null,
    cosmeticsOwned: sessions.at(-1)?.cosmeticsOwned ?? 0,
    coinsLeft: report.coins,
    failures: report.failures,
    commits: report.days.reduce((sum, d) => sum + d.commits, 0),
  };
}

export interface CheckResult {
  learner: LearnerName;
  id: string;
  /** The check's name with what was measured: reads as a finding when it fails. */
  name: string;
  ok: boolean;
}

interface Check {
  id: string;
  learners: readonly LearnerName[];
  evaluate(report: SimulationReport): { ok: boolean; name: string };
}

/**
 * Balance targets, each from docs/design.md, docs/plan.md or the simulation brief (docs/testing.md
 * §4). They are fixed before measuring and never moved to make a run pass.
 */
export const TARGETS = {
  /**
   * Success per session of the average child: within `low`-`high` % in `sessionsShare` % of its
   * sessions and at the median, over its first `weeks` weeks (the coordinator's brief: 70-90 %,
   * as Dragon Valley measured; docs/plan.md §4 names 70-85 % for the rounds' control).
   */
  success: { low: 70, high: 90, sessionsShare: 75, weeks: 12 },
  /** The struggling child's median success per session: at least `floor` (Dragon Valley's). */
  strugglingSuccess: { floor: 60 },
  /** Coins per session, median, for the average child (design §7.1: a session earns 50-80). */
  coins: { low: 50, high: 80 },
  /** Days a known item (box 2+) may wait past its review day: the interval plus a grace. */
  graceDays: 7,
  /** An egg hatches within this many sessions of the child receiving it. */
  hatchSessions: 5,
  /** Weeks over which the average, struggling and slow children see progress every week. */
  progressWeeks: 12,
  /**
   * The struggling child's steady path (Dragon Valley's): a new level every week with play while
   * levels remain; the monster of every region whose lessons it finished freed (lessons finished in
   * the last `monsterGraceDays` days may still have it ahead); at least `floorShare` % of the levels
   * within `floorDays` days (scaled down for a shorter run).
   */
  steadyPath: { floorShare: 75, floorDays: 84, monsterGraceDays: 7 },
  /** The perfect child reaches the finale within this many days of daily play. */
  perfectFinaleDays: 28,
  /** Every child buys its first cosmetic in its first week. */
  firstWeekDays: 7,
  /**
   * Check (a), the time to `grown` (design §6.5's open point): the average child grows each friend
   * within `days` days of its monster being freed (of the friend hatching, if later); friends whose
   * monster was freed in the run's last `days` days may still be growing.
   */
  grownUp: { days: 21 },
} as const;

const ALL: readonly LearnerName[] = ['perfect', 'average', 'struggling', 'slow'];

/** Sessions played from day `from` to day `to` (inclusive). */
function sessionsBetween(report: SimulationReport, from: number, to: number): number {
  return report.days.filter((d) => d.played && d.index >= from && d.index <= to).length;
}

/** Success (whole percent) of each session with answers, within the run's first `days` days. */
function successRates(report: SimulationReport, days = Infinity): number[] {
  return sessionsOf(report)
    .filter((d) => d.answers > 0 && d.index < days)
    .map((d) => percent(d.correct, d.answers));
}

/**
 * The day a level was first completed: its completion event, or day 0 for a level the placement
 * check completed (one star, no event); `null` when it was never completed.
 */
export function completionDay(report: SimulationReport, level: string): number | null {
  const day = report.levelDays[level];
  if (day !== undefined) return day;
  return (report.stars[level] ?? 0) >= 1 ? 0 : null;
}

export const CHECKS: readonly Check[] = [
  {
    id: 'accepted',
    learners: ALL,
    evaluate: (r) => ({
      ok: r.failures.length === 0,
      name: `every step of the simulation was accepted (${r.failures.length} rejected${r.failures.length ? `: ${r.failures.slice(0, 3).join(', ')}` : ''})`,
    }),
  },
  {
    id: 'first-hatch',
    learners: ALL,
    evaluate: (r) => {
      const hatched = r.days[0]?.hatched ?? [];
      return {
        ok: hatched.length > 0,
        name: `the first egg hatched in the first session (design §4.1; hatched: ${hatched.join(', ') || 'none'})`,
      };
    },
  },
  {
    id: 'success-band',
    learners: ['average'],
    evaluate: (r) => {
      const { low, high, sessionsShare, weeks } = TARGETS.success;
      const band = (rates: readonly number[]) => {
        const inside = rates.filter((rate) => rate >= low && rate <= high).length;
        return {
          inside,
          sessions: rates.length,
          share: percent(inside, rates.length),
          median: spread(rates).median,
        };
      };
      const judged = band(successRates(r, weeks * 7));
      const all = band(successRates(r));
      const longer = all.sessions > judged.sessions;
      return {
        ok: judged.share >= sessionsShare && judged.median >= low && judged.median <= high,
        name:
          `success per session within ${low}-${high} % in ${judged.inside} of ${judged.sessions} sessions` +
          `${longer ? ` of the first ${weeks} weeks` : ''} (${judged.share} %, target ${sessionsShare} %), median ${judged.median} %` +
          (longer
            ? ` (the whole run, as measured: ${all.inside} of ${all.sessions} sessions, ${all.share} %, median ${all.median} %)`
            : ''),
      };
    },
  },
  {
    id: 'success-floor',
    learners: ['struggling'],
    evaluate: (r) => {
      const { floor } = TARGETS.strugglingSuccess;
      const { low, high } = TARGETS.success;
      const rates = successRates(r);
      const inside = rates.filter((rate) => rate >= low && rate <= high).length;
      const median = spread(rates).median;
      return {
        ok: median >= floor,
        name: `median success per session ${median} %, at least ${floor} % (${inside} of ${rates.length} sessions within ${low}-${high} %)`,
      };
    },
  },
  {
    id: 'rewarded',
    learners: ALL,
    evaluate: (r) => {
      const sessions = sessionsOf(r);
      const paid = sessions.filter((d) => d.coins > 0).length;
      return {
        ok: paid === sessions.length,
        name: `earned coins in ${paid} of ${sessions.length} sessions (fewest ${spread(sessions.map((d) => d.coins)).min})`,
      };
    },
  },
  {
    id: 'progress-weekly',
    learners: ['average', 'struggling', 'slow'],
    evaluate: (r) => {
      const weeks: { start: number; moved: boolean }[] = [];
      for (let start = 0; start < r.days.length; start += 7) {
        const week = r.days.slice(start, start + 7).filter((d) => d.played);
        if (week.length === 0) continue;
        weeks.push({
          start,
          moved: week.some(
            (d) =>
              d.levels.length + d.hatched.length + d.grew.length + d.stickers.length + d.pearls > 0,
          ),
        });
      }
      const { progressWeeks } = TARGETS;
      const judged = weeks.filter((w) => w.start < progressWeeks * 7);
      const moved = judged.filter((w) => w.moved).length;
      const later =
        weeks.length > judged.length
          ? ` of the first ${progressWeeks} (the whole run, as measured: ${weeks.filter((w) => w.moved).length} of ${weeks.length})`
          : '';
      return {
        ok: moved === judged.length,
        name: `saw progress (a level, a hatch, growth, a sticker or a pearl turned silver or gold) in ${moved} of ${judged.length} weeks${later}`,
      };
    },
  },
  {
    id: 'chest',
    learners: ALL,
    evaluate: (r) => {
      const goal = sessionsOf(r).filter((d) => d.goalReached);
      const opened = goal.filter((d) => d.chestOpened).length;
      return {
        ok: opened === goal.length,
        name: `opened the treasure chest in ${opened} of the ${goal.length} sessions that reached the daily goal (design §4.2)`,
      };
    },
  },
  {
    id: 'hatch-pace',
    learners: ALL,
    evaluate: (r) => {
      const last = r.days.length - 1;
      const waits = Object.entries(r.eggDays).map(([friend, day]) => {
        const hatched = stageReached(r, friend, 'baby');
        const end = hatched ?? last;
        return { friend, sessions: sessionsBetween(r, day, end), hatched: hatched !== null };
      });
      // An egg received in the run's last sessions may still be warming: late only past the limit.
      const late = waits.filter((w) => w.sessions > TARGETS.hatchSessions);
      const longest = Math.max(0, ...waits.map((w) => w.sessions));
      return {
        ok: late.length === 0,
        name: `hatched every egg within ${TARGETS.hatchSessions} sessions of receiving it (${waits.length} eggs, longest ${longest} sessions${late.length ? `; late: ${late.map((w) => `${w.friend} ${w.hatched ? w.sessions : 'not yet'}`).join(', ')}` : ''})`,
      };
    },
  },
  {
    id: 'no-dead-end',
    learners: ['perfect', 'average', 'slow'],
    evaluate: (r) => {
      const done = r.content.levels.filter((level) => completionDay(r, level) !== null);
      const freed = r.content.monsters.filter((level) => completionDay(r, level) !== null);
      const last = Math.max(0, ...Object.values(r.levelDays));
      return {
        ok: done.length === r.content.levels.length,
        name: `completed ${done.length} of ${r.content.levels.length} levels and freed ${freed.length} of ${r.content.monsters.length} monsters within ${r.daysSimulated} days (the last on day ${last})`,
      };
    },
  },
  {
    id: 'steady-path',
    learners: ['struggling'],
    evaluate: (r) => {
      const { floorShare, floorDays, monsterGraceDays } = TARGETS.steadyPath;
      const total = r.content.levels.length;
      const doneBefore = (end: number) =>
        r.content.levels.filter((level) => {
          const at = completionDay(r, level);
          return at !== null && at < end;
        }).length;
      const weeks: { start: number; newLevel: boolean }[] = [];
      for (let start = 0; start < r.daysSimulated; start += 7) {
        const days = r.days.slice(start, start + 7);
        if (!days.some((d) => d.played) || doneBefore(start) >= total) continue;
        weeks.push({ start, newLevel: days.some((d) => d.levels.length > 0) });
      }
      const stalled = weeks.filter((w) => !w.newLevel).map((w) => w.start);
      const lastDay = r.daysSimulated - 1;
      const finished = r.content.regions.filter(
        (region) =>
          region.monster !== null &&
          region.lessons.every((level) => {
            const at = completionDay(r, level);
            return at !== null && at <= lastDay - monsterGraceDays;
          }),
      );
      const freed = finished.filter((region) => completionDay(r, region.monster!) !== null);
      const cutoff = Math.min(floorDays, r.daysSimulated);
      const needed = Math.ceil((total * floorShare * cutoff) / (100 * floorDays));
      const byCutoff = Math.min(doneBefore(cutoff), total);
      return {
        ok:
          stalled.length === 0 &&
          freed.length === finished.length &&
          byCutoff >= Math.min(needed, total),
        name: `kept moving: a new level in ${weeks.length - stalled.length} of ${weeks.length} weeks with play while levels remained${stalled.length > 0 ? ` (none in the weeks from day ${stalled.join(', ')})` : ''}; freed the monsters of ${freed.length} of ${finished.length} finished regions; ${byCutoff} of ${total} levels within ${cutoff} days (at least ${Math.min(needed, total)})`,
      };
    },
  },
  {
    id: 'no-starving',
    learners: ['average', 'struggling', 'slow'],
    evaluate: (r) => {
      const worst = sessionsOf(r).reduce(
        (max, d) =>
          d.maxOverdueAtStart > max.days
            ? { days: d.maxOverdueAtStart, items: d.overdueAtStart, day: d.index }
            : max,
        { days: 0, items: [] as string[], day: 0 },
      );
      return {
        ok: worst.days <= TARGETS.graceDays,
        name: `no known item (box 2+) waited more than ${TARGETS.graceDays} days past its review day (the longest: ${worst.days} days${worst.items.length ? `, ${worst.items[0]} on day ${worst.day}` : ''})`,
      };
    },
  },
  {
    id: 'coins-pace',
    learners: ['average'],
    evaluate: (r) => {
      const { low, high } = TARGETS.coins;
      const median = spread(sessionsOf(r).map((d) => d.coins)).median;
      return {
        ok: median >= low && median <= high,
        name: `earned a median of ${median} coins per session (design §7.1: ${low}-${high})`,
      };
    },
  },
  {
    id: 'starter-week',
    learners: ALL,
    evaluate: (r) => {
      const first = r.days.find((d) => d.played && d.bought.length > 0);
      return {
        ok: first !== undefined && first.index < TARGETS.firstWeekDays,
        name: `bought a first cosmetic within ${TARGETS.firstWeekDays} days (on day ${first?.index ?? 'never'})`,
      };
    },
  },
  {
    id: 'fluency',
    learners: ['slow'],
    evaluate: (r) => {
      const { items, silver, gold, goldItems } = r.problemOnly;
      return {
        ok: gold === 0 && silver > 0,
        name: `brought ${silver} of ${items} items it answers only in problems to silver and none to gold without quick answers (gold ${gold}${goldItems.length ? `: ${goldItems.join(', ')}` : ''}; boards credit at the first check, design §5.9)`,
      };
    },
  },
  {
    id: 'perfect-pace',
    learners: ['perfect'],
    evaluate: (r) => ({
      ok:
        r.content.finale === null ||
        (r.finaleDay !== null && r.finaleDay < TARGETS.perfectFinaleDays),
      name:
        r.content.finale === null
          ? 'the pack has no finale yet (Krakatice Inkoustová)'
          : `reached the finale within ${TARGETS.perfectFinaleDays} days of daily play (day ${r.finaleDay ?? 'never'})`,
    }),
  },
  {
    id: 'grown-up',
    learners: ['average'],
    evaluate: (r) => {
      const { days } = TARGETS.grownUp;
      const last = r.daysSimulated - 1;
      const judged = growth(r).filter((g) => g.ready !== null && g.ready <= last - days);
      const late = judged.filter((g) => g.wait === null || g.wait > days);
      const waits = judged.map((g) => g.wait ?? last - g.ready!);
      return {
        ok: late.length === 0,
        name: `grew ${judged.length - late.length} of ${judged.length} friends within ${days} days of freeing their monster (waits ${spread(waits).min} / ${spread(waits).median} / ${spread(waits).max} days${late.length ? `; late: ${late.map((g) => `${g.friend} ${g.wait ?? 'not yet'}`).join(', ')}` : ''})`,
      };
    },
  },
];

/** The named balance checks of every report (each check for the learners it applies to). */
export function runChecks(reports: readonly SimulationReport[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const check of CHECKS) {
    for (const report of reports.filter((r) => check.learners.includes(r.learner))) {
      const { ok, name } = check.evaluate(report);
      results.push({
        learner: report.learner,
        id: check.id,
        name: `${report.learner}: ${name}`,
        ok,
      });
    }
  }
  return results;
}

/** The markdown report of a set of simulations. */
export function markdown(
  summaries: readonly Summary[],
  checks: readonly CheckResult[],
  run: { days: number; seed: string; revision: string; balance?: string },
): string {
  const s3 = (s: Spread) => `${s.min} / ${s.median} / ${s.max}`;
  const lines = [
    `# Learner simulation: ${run.days} days, seed "${run.seed}", content ${run.revision}${run.balance ? `, balance ${run.balance}` : ''}`,
    '',
    'Spreads are min / median / max over the sessions played.',
    '',
    '## Play and learning',
    '',
    '| Learner | Sessions | Answers per session | Board rounds per session | Answering minutes | Success | Success per session | Quick | Levels (last new on day) | Monsters freed | Finale | Pearls cloudy / bronze / silver / gold | Due at start, last 10 sessions | Longest overdue (days) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of summaries) {
    const m = s.mastery;
    lines.push(
      `| ${s.learner} | ${s.sessions} | ${s3(s.answersPerSession)} | ${s3(s.boardRoundsPerSession)} | ${s3(s.minutesPerSession)} | ${s.successPct} % | ${s3(s.success)} % | ${s.fastPct} % | ${s.levelsCompleted} (${s.lastNewLevelDay ?? '-'}) | ${Object.keys(s.monsterDays).length} | ${s.finaleDay ?? '-'} | ${m.cloudy} / ${m.bronze} / ${m.silver} / ${m.gold} | ${s3(s.dueLate)} | ${s.maxOverdue} |`,
    );
  }
  lines.push(
    '',
    '## Success by activity (answers, success)',
    '',
    '| Learner | Activities |',
    '| --- | --- |',
  );
  for (const s of summaries) {
    const activities = Object.entries(s.byActivity)
      .map(([activity, a]) => `${activity} ${a.answers} (${a.successPct} %)`)
      .join('; ');
    lines.push(`| ${s.learner} | ${activities} |`);
  }
  lines.push(
    '',
    '## Sea friends (day hatched / day its monster was freed / day grown / day crowned)',
    '',
    '| Learner | Friends |',
    '| --- | --- |',
  );
  for (const s of summaries) {
    const friends = s.growth
      .map(
        (g) =>
          `${g.friend} ${g.baby ?? '-'}/${g.ready ?? '-'}/${g.grown ?? '-'}/${g.crowned ?? '-'}`,
      )
      .join('; ');
    lines.push(`| ${s.learner} | ${friends} |`);
  }
  lines.push(
    '',
    '## Rewards',
    '',
    '| Learner | Coins per session | Coins by source (total) | Daily goal | Chests | Stickers | Inkoustíci | First purchase (day) | Cosmetics owned |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const s of summaries) {
    const sources = Object.entries(s.coinsByReason)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, amount]) => `${reason} ${amount}`)
      .join(', ');
    lines.push(
      `| ${s.learner} | ${s3(s.coinsPerSession)} | ${sources} | ${s.goalSessions} of ${s.sessions} | ${s.chestSessions} | ${s.stickers} | ${s.ambushes} | ${s.firstPurchaseDay ?? 'never'} | ${s.cosmeticsOwned} |`,
    );
  }
  lines.push('', '## Checks', '');
  for (const check of checks) lines.push(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.name}`);
  lines.push('');
  return lines.join('\n');
}
