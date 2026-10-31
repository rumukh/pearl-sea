/**
 * The in-memory screen stack: explicit Back, a root that cannot be popped, bounded depth.
 */
import { describe, expect, it } from 'vitest';
import { createScreenStack, MAX_DEPTH } from '../../../src/app/router/stack';

describe('screen stack', () => {
  it('pushes, replaces and goes back to the previous entry', () => {
    const stack = createScreenStack('title');
    stack.push('profiles');
    stack.push('grotto');
    expect(stack.entries()).toEqual(['title', 'profiles', 'grotto']);
    expect(stack.previous()).toBe('profiles');
    stack.replace('round');
    expect(stack.current()).toBe('round');
    expect(stack.back()).toBe('profiles');
    expect(stack.depth()).toBe(2);
  });

  it('never pops the root', () => {
    const stack = createScreenStack('title');
    expect(stack.previous()).toBeUndefined();
    expect(stack.back()).toBeUndefined();
    expect(stack.entries()).toEqual(['title']);
  });

  it('pops back to the nearest matching entry, or changes nothing', () => {
    const stack = createScreenStack('title');
    for (const entry of ['grotto', 'map', 'level', 'round']) stack.push(entry);
    expect(stack.popTo((entry) => entry === 'unknown')).toBeUndefined();
    expect(stack.depth()).toBe(5);
    expect(stack.popTo((entry) => entry === 'grotto')).toBe('grotto');
    expect(stack.entries()).toEqual(['title', 'grotto']);
  });

  it('resets to a single entry', () => {
    const stack = createScreenStack('title');
    stack.push('profiles');
    stack.push('grotto');
    stack.reset('recovery');
    expect(stack.entries()).toEqual(['recovery']);
    expect(stack.back()).toBeUndefined();
  });

  it('keeps the root and drops the oldest entries above it beyond the maximum depth', () => {
    const stack = createScreenStack('root');
    for (let index = 1; index <= MAX_DEPTH + 5; index++) stack.push(`screen-${index}`);
    expect(stack.depth()).toBe(MAX_DEPTH);
    expect(stack.entries()[0]).toBe('root');
    expect(stack.current()).toBe(`screen-${MAX_DEPTH + 5}`);
  });
});
