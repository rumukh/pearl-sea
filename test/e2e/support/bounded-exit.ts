/**
 * A bounded way out for a browser run that has finished (PS-QA-21). PR #22's Chromium job reported
 * "15 passed" and wrote its JSON report, and then the Playwright runner never exited: the job sat
 * until the step's 15-minute timeout and ended red. Playwright's own exit guard is armed only
 * after its reporters' `onExit` and a flush of stdout and stderr, so a hang there is unbounded.
 *
 * Once the run has reported, the QA reporter (which reports first on CI) arms this bound: if the
 * process is still alive after the grace, it exits with the run's own status, so a green run stays
 * green and a red one red. The timer is unref'd, so a runner that exits on its own never waits for
 * it. A runner blocked in a synchronous call cannot be helped from inside; the step's
 * `timeout-minutes` stays the last guard.
 */
import type { FullResult } from '@playwright/test/reporter';

/** Playwright's own exit code for a run's status (its CLI exits 0, 130 or 1). */
export function exitCodeFor(status: FullResult['status']): number {
  return status === 'passed' ? 0 : status === 'interrupted' ? 130 : 1;
}

/** How long a finished run may take to exit: `PS_E2E_EXIT_GRACE_MS`, or two minutes. */
export function exitGraceMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env['PS_E2E_EXIT_GRACE_MS']);
  return Number.isFinite(value) && value > 0 ? value : 120_000;
}

/**
 * Exit with the run's status if the process is still alive `graceMs` from now. `status` is read
 * when the bound fires, so a verdict reached after arming it (the QA audit) still counts.
 */
export function boundExit(
  status: () => FullResult['status'],
  graceMs: number,
  exit: (code: number) => void = (code) => process.exit(code),
  log: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => {
    const final = status();
    log(
      `The run reported "${final}" ${Math.round(graceMs / 1000)} s ago and Playwright has not exited; ` +
        'exiting with that status (test/e2e/support/bounded-exit.ts, PS-QA-21).',
    );
    exit(exitCodeFor(final));
  }, graceMs);
  timer.unref();
  return timer;
}
