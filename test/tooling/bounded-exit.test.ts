/**
 * The bound on a finished browser run's exit (test/e2e/support/bounded-exit.ts, PS-QA-21): once a
 * run has reported, a runner that hangs on its way out exits with the run's own status.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundExit, exitCodeFor, exitGraceMs } from '../e2e/support/bounded-exit';

describe('the bounded exit of a finished browser run', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exits with the code Playwright gives each status', () => {
    expect(exitCodeFor('passed')).toBe(0);
    expect(exitCodeFor('failed')).toBe(1);
    expect(exitCodeFor('timedout')).toBe(1);
    expect(exitCodeFor('interrupted')).toBe(130);
  });

  it('exits only once the grace has passed, with the verdict as it is then', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const log = vi.fn();
    let status: 'passed' | 'failed' = 'passed';
    boundExit(() => status, 120_000, exit, log);
    vi.advanceTimersByTime(119_999);
    expect(exit).not.toHaveBeenCalled();
    // The QA audit fails the run after the bound was armed: the exit says so.
    status = 'failed';
    vi.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('reported "failed" 120 s ago'));
  });

  it('a green run that hangs on its way out still exits green', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    boundExit(() => 'passed', 5_000, exit, vi.fn());
    vi.advanceTimersByTime(5_000);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('never keeps alive a runner that exits on its own', () => {
    const timer = boundExit(() => 'passed', 120_000, vi.fn(), vi.fn());
    expect(timer.hasRef()).toBe(false);
    clearTimeout(timer);
  });

  it('takes its grace from PS_E2E_EXIT_GRACE_MS, or two minutes', () => {
    expect(exitGraceMs({})).toBe(120_000);
    expect(exitGraceMs({ PS_E2E_EXIT_GRACE_MS: '5000' })).toBe(5_000);
    expect(exitGraceMs({ PS_E2E_EXIT_GRACE_MS: 'soon' })).toBe(120_000);
    expect(exitGraceMs({ PS_E2E_EXIT_GRACE_MS: '0' })).toBe(120_000);
  });
});
