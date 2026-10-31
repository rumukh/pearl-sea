// @vitest-environment happy-dom
/**
 * The Czech on-screen keyboard: every key a Czech child knows (a row of letters with
 * diacritics, QWERTZ, Shift for capitals, space, Backspace, OK); keys insert at the caret and
 * never take focus, so typing goes on in the field with either keyboard; Enter is OK; an empty
 * answer is not sent; nothing works while the answer is being checked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCzechKeyboard,
  CZECH_KEY_ROWS,
  MAX_TYPED_LENGTH,
} from '../../../../src/app/ui/czech-keyboard';
import { settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => kit?.dispose());

function setup() {
  kit = testKit();
  const onSubmit = vi.fn();
  const keyboard = createCzechKeyboard(kit, {
    label: 'Napiš slovo',
    okLabel: 'Hotovo',
    backspaceLabel: 'Smazat',
    shiftLabel: 'Velká písmena',
    spaceLabel: 'mezera',
    onSubmit,
  });
  document.body.append(keyboard.element);
  const key = (id: string) =>
    keyboard.element.querySelector<HTMLButtonElement>(`[data-testid="key-${id}"]`)!;
  const ok = keyboard.element.querySelector<HTMLButtonElement>('[data-testid="typed-ok"]')!;
  return { keyboard, onSubmit, key, ok };
}

describe('the Czech keyboard', () => {
  it('has every letter with a diacritic and the whole QWERTZ alphabet', () => {
    const letters = CZECH_KEY_ROWS.flat();
    expect(CZECH_KEY_ROWS[0]).toEqual([
      ...['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'],
    ]);
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') expect(letters).toContain(letter);
    expect(new Set(letters).size).toBe(letters.length);
    const { keyboard } = setup();
    expect(keyboard.element.querySelectorAll('.ps-key--letter')).toHaveLength(letters.length);
  });

  it('types at the caret and keeps the keys out of the Tab order', () => {
    const { keyboard, key } = setup();
    keyboard.focus();
    for (const letter of ['m', 'l', 'n']) key(letter).click();
    expect(keyboard.value()).toBe('mln');
    keyboard.field.setSelectionRange(2, 2);
    key('ý').click();
    expect(keyboard.value()).toBe('mlýn');
    expect(document.activeElement).toBe(keyboard.field);
    expect(key('a').getAttribute('tabindex')).toBe('-1');
    expect(keyboard.field.getAttribute('inputmode')).toBe('none');
    expect(keyboard.field.getAttribute('lang')).toBe('cs');
    expect(kit.cue).toHaveBeenCalledWith('ui.keypad');
  });

  it('writes capitals with Shift, a space for words apart, and erases whole letters', () => {
    const { keyboard, key } = setup();
    const shift = key('shift');
    expect(shift.getAttribute('aria-pressed')).toBe('false');
    shift.click();
    expect(shift.getAttribute('aria-pressed')).toBe('true');
    expect(key('ř').textContent).toBe('Ř');
    key('ř').click();
    shift.click();
    for (const letter of ['e', 'k', 'a']) key(letter).click();
    key('space').click();
    key('ů').click();
    expect(keyboard.value()).toBe('Řeka ů');
    key('backspace').click();
    key('backspace').click();
    expect(keyboard.value()).toBe('Řeka');
    keyboard.field.setSelectionRange(0, 2);
    key('backspace').click();
    expect(keyboard.value()).toBe('ka');
  });

  it('sends the answer with OK or Enter, but never an empty one', async () => {
    const { keyboard, key, ok, onSubmit } = setup();
    ok.click();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(kit.cue).toHaveBeenCalledWith('ui.blocked');
    key('space').click();
    ok.click();
    expect(onSubmit).not.toHaveBeenCalled();
    keyboard.clear();
    for (const letter of ['b', 'y', 't']) key(letter).click();
    ok.click();
    keyboard.field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await settle();
    expect(onSubmit.mock.calls).toEqual([['byt'], ['byt']]);
  });

  it('takes no letters and sends nothing while the answer is being checked', () => {
    const { keyboard, key, ok, onSubmit } = setup();
    key('a').click();
    keyboard.setDisabled(true);
    key('b').click();
    key('backspace').click();
    ok.click();
    expect(keyboard.value()).toBe('a');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(keyboard.field.readOnly).toBe(true);
    expect(ok.disabled).toBe(true);
    keyboard.setDisabled(false);
    key('b').click();
    expect(keyboard.value()).toBe('ab');
  });

  it('stops at the longest answer the field takes', () => {
    const { keyboard, key } = setup();
    for (let index = 0; index < MAX_TYPED_LENGTH + 5; index++) key('a').click();
    expect(keyboard.value()).toHaveLength(MAX_TYPED_LENGTH);
  });
});
