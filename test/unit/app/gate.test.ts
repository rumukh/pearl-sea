/**
 * The grown-ups' gate: two-digit by two-digit questions that are never trivial, and the
 * press-and-hold timing, driven by an explicit clock.
 */
import { createPrng } from '@aegis/core';
import { describe, expect, it } from 'vitest';
import { createGateQuestion, createHoldTracker, HOLD_MS } from '../../../src/app/grownups/gate';
import type { GateQuestion } from '../../../src/app/grownups/gate';

describe('gate questions', () => {
  it('always ask two different two-digit factors, never round or repeated-digit numbers', () => {
    const random = createPrng('gate-test');
    let previous: GateQuestion | undefined;
    for (let index = 0; index < 2000; index++) {
      const question = createGateQuestion(() => random.nextFloat(), previous);
      for (const factor of [question.a, question.b]) {
        expect(factor).toBeGreaterThanOrEqual(12);
        expect(factor).toBeLessThanOrEqual(99);
        expect(factor % 10).not.toBe(0);
        expect(factor % 11).not.toBe(0);
      }
      expect(question.a).not.toBe(question.b);
      expect(question.answer).toBe(question.a * question.b);
      if (previous) expect([question.a, question.b]).not.toEqual([previous.a, previous.b]);
      previous = question;
    }
  });

  it('falls back to a valid, different question when the random source is stuck', () => {
    const stuck = (): number => 0;
    const first = createGateQuestion(stuck);
    expect(first).toEqual({ a: 23, b: 47, answer: 1081 });
    const second = createGateQuestion(stuck, first);
    expect(second.a * second.b).toBe(second.answer);
    expect([second.a, second.b]).not.toEqual([23, 47]);
  });
});

describe('press and hold', () => {
  it('reports progress from the first press and completes after the hold time', () => {
    const hold = createHoldTracker();
    expect(HOLD_MS).toBe(2000);
    expect(hold.holding()).toBe(false);
    expect(hold.progress(500)).toBe(0);
    hold.start(1000);
    hold.start(1500);
    expect(hold.holding()).toBe(true);
    expect(hold.progress(1000 + HOLD_MS / 2)).toBeCloseTo(0.5);
    expect(hold.progress(1000 + HOLD_MS)).toBe(1);
    expect(hold.progress(1000 + HOLD_MS * 3)).toBe(1);
  });

  it('starts over when released early', () => {
    const hold = createHoldTracker(2000);
    hold.start(0);
    hold.cancel();
    expect(hold.holding()).toBe(false);
    expect(hold.progress(1900)).toBe(0);
    hold.start(2000);
    expect(hold.progress(3000)).toBeCloseTo(0.5);
  });
});
