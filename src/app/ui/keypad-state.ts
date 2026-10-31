/**
 * The number keypad as a pure state machine, shared by the on-screen keys and the physical
 * keyboard so both behave identically. The grown-ups' gate answers its question on it.
 *
 * - Leading zeros never pile up: typing into a field that holds just `0` replaces it.
 * - Submitting nothing is gently refused (a shake), never judged.
 */
export interface KeypadState {
  readonly value: string;
  readonly maxDigits: number;
}

export type KeypadInput =
  | { readonly type: 'digit'; readonly digit: number }
  | { readonly type: 'backspace' }
  | { readonly type: 'clear' }
  | { readonly type: 'submit' };

export interface KeypadStep {
  readonly state: KeypadState;
  /** Present only when the input completed an answer. */
  readonly answer?: number;
  /** Why an input did nothing, for a gentle cue (a shake, a sound). */
  readonly rejected?: 'empty' | 'full';
}

export const DEFAULT_MAX_DIGITS = 4;

export function createKeypadState(maxDigits = DEFAULT_MAX_DIGITS): KeypadState {
  if (!Number.isInteger(maxDigits) || maxDigits < 1 || maxDigits > 7) {
    throw new RangeError('maxDigits must be an integer from 1 to 7.');
  }
  return { value: '', maxDigits };
}

export function reduceKeypad(state: KeypadState, input: KeypadInput): KeypadStep {
  const current = state.value;
  switch (input.type) {
    case 'digit': {
      if (!Number.isInteger(input.digit) || input.digit < 0 || input.digit > 9) {
        throw new RangeError('A keypad digit is 0-9.');
      }
      if (current === '0') return { state: { ...state, value: String(input.digit) } };
      if (current.length >= state.maxDigits) return { state, rejected: 'full' };
      return { state: { ...state, value: current + String(input.digit) } };
    }
    case 'backspace':
      if (current.length > 0) return { state: { ...state, value: current.slice(0, -1) } };
      return { state, rejected: 'empty' };
    case 'clear':
      return { state: createKeypadState(state.maxDigits) };
    case 'submit':
      if (current === '') return { state, rejected: 'empty' };
      return { state, answer: Number(current) };
  }
}

/**
 * The keypad input for a physical key, or null when the key is not the keypad's. Numpad digits
 * arrive as `event.key` digits too; Tab stays with the browser for focus navigation.
 */
export function keyToInput(key: string): KeypadInput | null {
  if (key.length === 1 && key >= '0' && key <= '9') return { type: 'digit', digit: Number(key) };
  if (key === 'Backspace' || key === 'Delete') return { type: 'backspace' };
  if (key === 'Enter') return { type: 'submit' };
  return null;
}
