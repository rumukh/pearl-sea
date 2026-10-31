/**
 * The number pad's state machine, shared by the on-screen keys and the physical keyboard.
 */
import { describe, expect, it } from 'vitest';
import { createKeypadState, keyToInput, reduceKeypad } from '../../../src/app/ui/keypad-state';
import type { KeypadInput, KeypadState, KeypadStep } from '../../../src/app/ui/keypad-state';

function run(state: KeypadState, inputs: KeypadInput[]): { state: KeypadState; last: KeypadStep } {
  let current = state;
  let last: KeypadStep = { state };
  for (const input of inputs) {
    last = reduceKeypad(current, input);
    current = last.state;
  }
  return { state: current, last };
}

const digits = (text: string): KeypadInput[] =>
  [...text].map((digit) => ({ type: 'digit', digit: Number(digit) }));

describe('number pad', () => {
  it('types digits and submits the number', () => {
    const { state, last } = run(createKeypadState(), [...digits('1081'), { type: 'submit' }]);
    expect(state.value).toBe('1081');
    expect(last.answer).toBe(1081);
  });

  it('refuses digits beyond the maximum and reports it', () => {
    const { state, last } = run(createKeypadState(2), digits('123'));
    expect(state.value).toBe('12');
    expect(last.rejected).toBe('full');
  });

  it('replaces a lone zero instead of stacking leading zeros', () => {
    expect(run(createKeypadState(), digits('05')).state.value).toBe('5');
    expect(run(createKeypadState(), digits('00')).state.value).toBe('0');
    const zero = run(createKeypadState(), [...digits('0'), { type: 'submit' }]);
    expect(zero.last.answer).toBe(0);
  });

  it('deletes with backspace and gently refuses an empty submit', () => {
    const typed = run(createKeypadState(), [...digits('42'), { type: 'backspace' }]);
    expect(typed.state.value).toBe('4');
    const empty = run(createKeypadState(), [{ type: 'backspace' }, { type: 'submit' }]);
    expect(empty.last.rejected).toBe('empty');
    expect(empty.last.answer).toBeUndefined();
  });

  it('clears back to the initial state', () => {
    const { state } = run(createKeypadState(), [...digits('99'), { type: 'clear' }]);
    expect(state).toEqual(createKeypadState());
  });

  it('rejects impossible digits and maximums', () => {
    expect(() => reduceKeypad(createKeypadState(), { type: 'digit', digit: 10 })).toThrow();
    expect(() => createKeypadState(0)).toThrow();
    expect(() => createKeypadState(8)).toThrow();
  });

  it('maps digits, deletion and Enter from the physical keyboard, and nothing else', () => {
    expect(keyToInput('7')).toEqual({ type: 'digit', digit: 7 });
    expect(keyToInput('Backspace')).toEqual({ type: 'backspace' });
    expect(keyToInput('Delete')).toEqual({ type: 'backspace' });
    expect(keyToInput('Enter')).toEqual({ type: 'submit' });
    for (const key of ['Tab', 'a', 'ý', ' ', 'ArrowRight']) expect(keyToInput(key)).toBeNull();
  });
});
