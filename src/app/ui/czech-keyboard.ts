/**
 * The Czech on-screen keyboard for typed answers (docs/design.md §5.2): a big answer field and
 * the keys a Czech child knows, in the Czech QWERTZ layout with a row of every letter with a
 * diacritic (á č ď é ě í ň ó ř š ť ú ů ý ž), a Shift for capitals (names, the starts of
 * sentences), a space for words written apart, Backspace and OK.
 *
 * The field takes a physical keyboard too (Czech dead keys included). It asks the device not to
 * open its own keyboard (`inputmode="none"`), so a tablet shows only this one; keys insert at
 * the caret and stay out of the Tab order (a screen reader reaches them by touch), so typing on
 * either goes on in the field. Enter is OK.
 */
import { h } from './dom';
import { icon } from './icons';
import type { UiKit } from './kit';

export const CZECH_KEY_ROWS: readonly (readonly string[])[] = [
  ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'],
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['y', 'x', 'c', 'v', 'b', 'n', 'm'],
];

/** The longest answer the field takes (a word written apart, a name). */
export const MAX_TYPED_LENGTH = 40;

export interface CzechKeyboardOptions {
  /** Accessible name of the answer field. */
  readonly label: string;
  readonly okLabel: string;
  readonly backspaceLabel: string;
  readonly shiftLabel: string;
  readonly spaceLabel: string;
  onSubmit(text: string): void | Promise<void>;
}

export interface CzechKeyboardView {
  readonly element: HTMLElement;
  readonly field: HTMLInputElement;
  value(): string;
  setDisabled(disabled: boolean): void;
  clear(): void;
  focus(): void;
}

export function createCzechKeyboard(kit: UiKit, options: CzechKeyboardOptions): CzechKeyboardView {
  let shifted = false;
  let disabled = false;
  const field = h('input', {
    className: 'ps-typed__field',
    testId: 'typed-field',
    attributes: {
      type: 'text',
      lang: 'cs',
      inputmode: 'none',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'done',
      maxlength: String(MAX_TYPED_LENGTH),
      'aria-label': options.label,
    },
  });

  const insert = (text: string): void => {
    if (disabled) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const next = (field.value.slice(0, start) + text + field.value.slice(end)).slice(
      0,
      MAX_TYPED_LENGTH,
    );
    field.value = next;
    const caret = Math.min(start + text.length, next.length);
    field.setSelectionRange(caret, caret);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const erase = (): void => {
    if (disabled) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    if (start !== end) {
      field.value = field.value.slice(0, start) + field.value.slice(end);
      field.setSelectionRange(start, start);
    } else if (start > 0) {
      const before = [...field.value.slice(0, start)];
      before.pop();
      const kept = before.join('');
      field.value = kept + field.value.slice(start);
      field.setSelectionRange(kept.length, kept.length);
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const submit = (): void => {
    if (disabled) return;
    const text = field.value;
    if (text.trim() === '') {
      kit.cue('ui.blocked');
      return;
    }
    kit.cue('ui.keypad');
    void Promise.resolve(options.onSubmit(text)).catch(kit.onError);
  };

  /** A key that never takes focus, so typing goes on in the field. */
  const key = (
    label: Node | string,
    className: string,
    testId: string,
    press: () => void,
    ariaLabel?: string,
  ): HTMLButtonElement => {
    const button = h(
      'button',
      {
        className: `ps-key ${className}`,
        testId,
        attributes: {
          type: 'button',
          tabindex: '-1',
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        },
      },
      label,
    );
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      if (disabled) return;
      kit.cue('ui.keypad');
      press();
      field.focus({ preventScroll: true });
    });
    return button;
  };

  const letterKeys: HTMLButtonElement[] = [];
  const rows = CZECH_KEY_ROWS.map((row, index) =>
    h(
      'div',
      { className: `ps-typed__row${index === 0 ? ' ps-typed__row--accents' : ''}` },
      ...row.map((letter) => {
        const button = key(letter, 'ps-key--letter', `key-${letter}`, () =>
          insert(shifted ? letter.toUpperCase() : letter),
        );
        button.dataset['letter'] = letter;
        letterKeys.push(button);
        return button;
      }),
    ),
  );
  const shift = key(
    icon('forward'),
    'ps-key--shift',
    'key-shift',
    () => {
      shifted = !shifted;
      shift.setAttribute('aria-pressed', String(shifted));
      for (const button of letterKeys) {
        const letter = button.dataset['letter'] ?? '';
        button.textContent = shifted ? letter.toUpperCase() : letter;
      }
    },
    options.shiftLabel,
  );
  shift.setAttribute('aria-pressed', 'false');
  const space = key(options.spaceLabel, 'ps-key--space', 'key-space', () => insert(' '));
  const backspace = key(
    icon('backspace'),
    'ps-key--backspace',
    'key-backspace',
    erase,
    options.backspaceLabel,
  );
  const ok = h(
    'button',
    { className: 'ps-key ps-key--ok', testId: 'typed-ok', attributes: { type: 'button' } },
    icon('check'),
    h('span', { text: options.okLabel }),
  );
  ok.addEventListener('click', submit);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });

  const element = h(
    'div',
    { className: 'ps-typed', testId: 'typed', attributes: { lang: 'cs' } },
    h('div', { className: 'ps-typed__entry' }, field, ok),
    h(
      'div',
      { className: 'ps-typed__keys', attributes: { role: 'group', 'aria-label': options.label } },
      ...rows,
      h('div', { className: 'ps-typed__row ps-typed__row--tools' }, shift, space, backspace),
    ),
  );

  return {
    element,
    field,
    value: () => field.value,
    setDisabled(next) {
      disabled = next;
      field.readOnly = next;
      ok.disabled = next;
    },
    clear() {
      field.value = '';
    },
    focus() {
      field.focus({ preventScroll: true });
    },
  };
}
