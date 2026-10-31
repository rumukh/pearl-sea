/**
 * The grown-ups' gate: press and hold for two seconds, then answer a two-digit by two-digit
 * multiplication on the number pad. A wrong answer just asks a new question; there is no
 * lockout and no penalty. The question is made by the shell, not the game rules, and a 3rd or
 * 4th grader cannot answer it at a glance.
 */
export const HOLD_MS = 2000;

export interface GateQuestion {
  readonly a: number;
  readonly b: number;
  readonly answer: number;
}

function usable(value: number): boolean {
  return value >= 12 && value <= 99 && value % 10 !== 0 && value % 11 !== 0;
}

/**
 * A question with both factors two-digit, neither a multiple of 10 nor a repeated digit (too
 * easy to do at a glance), the factors different, and not the same as `previous`.
 */
export function createGateQuestion(random: () => number, previous?: GateQuestion): GateQuestion {
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = 12 + Math.floor(random() * 88);
    const b = 12 + Math.floor(random() * 88);
    if (!usable(a) || !usable(b) || a === b) continue;
    if (previous && previous.a === a && previous.b === b) continue;
    return { a, b, answer: a * b };
  }
  const fallback = previous?.a === 23 && previous.b === 47 ? { a: 37, b: 64 } : { a: 23, b: 47 };
  return { ...fallback, answer: fallback.a * fallback.b };
}

/** Press-and-hold progress from timestamps, independent of how frames are scheduled. */
export interface HoldTracker {
  start(now: number): void;
  cancel(): void;
  /** 0-1; 0 when not holding. */
  progress(now: number): number;
  holding(): boolean;
}

export function createHoldTracker(durationMs: number = HOLD_MS): HoldTracker {
  let startedAt: number | null = null;
  return {
    start(now) {
      startedAt ??= now;
    },
    cancel() {
      startedAt = null;
    },
    progress(now) {
      if (startedAt === null) return 0;
      return Math.min(1, Math.max(0, (now - startedAt) / durationMs));
    },
    holding: () => startedAt !== null,
  };
}
