/**
 * Time on the child's side, which the rules never read themselves:
 *
 * - `ResponseTimer`: response time for one problem, from the moment it is shown to the moment
 *   the answer is sent, without the time the game was paused or hidden (docs/design.md §6.2),
 *   capped at the contract's `MAX_ELAPSED_MS`. It becomes `answer.elapsedMs`.
 * - `PlayClock`: time played since a child's game was opened in this page, without hidden or
 *   paused time: the measure behind the grown-ups' optional time limit.
 */
import { MAX_ELAPSED_MS } from '../../rules/contract';

export interface ResponseTimer {
  /** Start timing a new problem (running, unless the game is paused right now). */
  start(): void;
  pause(): void;
  resume(): void;
  /** Whole milliseconds of play since `start`, excluding pauses, at most `MAX_ELAPSED_MS`. */
  elapsed(): number;
}

export function createResponseTimer(now: () => number = () => performance.now()): ResponseTimer {
  let started = now();
  let pausedTotal = 0;
  let pausedAt: number | null = null;
  return {
    start() {
      started = now();
      pausedTotal = 0;
      if (pausedAt !== null) pausedAt = started;
    },
    pause() {
      if (pausedAt === null) pausedAt = now();
    },
    resume() {
      if (pausedAt === null) return;
      pausedTotal += now() - pausedAt;
      pausedAt = null;
    },
    elapsed() {
      const end = pausedAt ?? now();
      const value = Math.round(end - started - pausedTotal);
      return Math.min(MAX_ELAPSED_MS, Math.max(0, value));
    },
  };
}

export interface PlayClock {
  pause(): void;
  resume(): void;
  /** Whole milliseconds played. */
  elapsed(): number;
}

export function createPlayClock(now: () => number = () => performance.now()): PlayClock {
  let total = 0;
  let since: number | null = now();
  return {
    pause() {
      if (since === null) return;
      total += now() - since;
      since = null;
    },
    resume() {
      if (since === null) since = now();
    },
    elapsed() {
      return Math.round(total + (since === null ? 0 : now() - since));
    },
  };
}
