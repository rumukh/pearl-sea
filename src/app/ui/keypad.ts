/**
 * The big on-screen number pad (phone layout: 1-2-3 on top) with physical keyboard parity. The
 * grown-ups' gate answers its two-digit multiplication on it, so its words come from the caller
 * (the grown-ups' language), not from the children's catalog.
 */
import { h } from './dom';
import { icon } from './icons';
import { animate } from './motion';
import { createKeypadState, keyToInput, reduceKeypad } from './keypad-state';
import type { KeypadInput, KeypadState } from './keypad-state';
import type { UiKit } from './kit';

export interface KeypadLabels {
  /** The group of keys. */
  readonly pad: string;
  readonly backspace: string;
  readonly ok: string;
  /** What a screen reader hears as the answer changes, e.g. "Odpověď: 42". */
  spoken(value: string): string;
}

export interface KeypadOptions {
  readonly labels: KeypadLabels;
  readonly maxDigits?: number;
  onSubmit(answer: number): void | Promise<void>;
  readonly testIdPrefix?: string;
}

export interface KeypadView {
  readonly element: HTMLElement;
  state(): KeypadState;
  reset(): void;
  setDisabled(disabled: boolean): void;
  dispose(): void;
}

export const KEYPAD_LAYOUT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', '0', 'ok'];

export function createKeypad(kit: UiKit, options: KeypadOptions): KeypadView {
  const prefix = options.testIdPrefix ?? 'keypad';
  const { labels } = options;
  let state = createKeypadState(options.maxDigits);
  let disabled = false;
  let busy = false;

  const field = h('span', {
    className: 'ps-answer__field',
    testId: `${prefix}-field`,
    attributes: { 'aria-hidden': 'true' },
  });
  const spoken = h('span', { className: 'ps-visually-hidden' });
  const display = h(
    'div',
    {
      className: 'ps-answer',
      testId: `${prefix}-display`,
      attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },
    },
    spoken,
    field,
  );

  const keys = new Map<string, HTMLButtonElement>();
  const pad = h('div', {
    className: 'ps-keypad',
    attributes: { role: 'group', 'aria-label': labels.pad },
  });
  for (const key of KEYPAD_LAYOUT) {
    const button = h('button', {
      className: 'ps-key' + (key === 'ok' ? ' ps-key--ok' : ''),
      testId: `${prefix}-${key}`,
      attributes: { type: 'button' },
    });
    if (key === 'backspace') {
      button.append(icon('backspace'));
      button.setAttribute('aria-label', labels.backspace);
    } else if (key === 'ok') {
      button.textContent = labels.ok;
    } else {
      button.textContent = key;
    }
    button.addEventListener('click', () => {
      if (key === 'backspace') apply({ type: 'backspace' });
      else if (key === 'ok') apply({ type: 'submit' });
      else apply({ type: 'digit', digit: Number(key) });
    });
    // Like a calculator: tapping a key does not take focus, so the physical keyboard keeps
    // working (Enter submits instead of pressing the last clicked key again).
    button.addEventListener('mousedown', (event) => event.preventDefault());
    keys.set(key, button);
    pad.append(button);
  }

  const element = h('div', { className: 'ps-stack ps-keypad-wrap', testId: prefix }, display, pad);

  const render = (): void => {
    field.textContent = state.value;
    field.dataset['empty'] = String(state.value === '');
    spoken.textContent = labels.spoken(state.value || '?');
    for (const button of keys.values()) button.disabled = disabled || busy;
  };

  const nudge = (): void => {
    animate(
      display,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  };

  const flash = (input: KeypadInput): void => {
    const key =
      input.type === 'digit'
        ? String(input.digit)
        : input.type === 'backspace'
          ? 'backspace'
          : input.type === 'submit'
            ? 'ok'
            : undefined;
    const button = key ? keys.get(key) : undefined;
    if (!button) return;
    button.dataset['flash'] = 'true';
    setTimeout(() => delete button.dataset['flash'], 120);
  };

  function apply(input: KeypadInput): void {
    if (disabled || busy) return;
    const step = reduceKeypad(state, input);
    state = step.state;
    if (step.rejected) nudge();
    if (input.type === 'digit' || input.type === 'backspace') kit.cue('ui.keypad');
    render();
    if (step.answer !== undefined) {
      const answer = step.answer;
      busy = true;
      render();
      Promise.resolve()
        .then(() => options.onSubmit(answer))
        .catch(kit.onError)
        .finally(() => {
          busy = false;
          render();
        });
    }
  }

  const release = kit.keyboard.push((event) => {
    if (disabled || !element.isConnected) return 'pass';
    const input = keyToInput(event.key);
    if (!input) return 'pass';
    if (event.repeat && input.type === 'submit') return 'handled';
    flash(input);
    apply(input);
    return 'handled';
  });

  render();
  return {
    element,
    state: () => state,
    reset() {
      state = createKeypadState(options.maxDigits);
      render();
    },
    setDisabled(value) {
      disabled = value;
      render();
    },
    dispose() {
      release();
    },
  };
}
