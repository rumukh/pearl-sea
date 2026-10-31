// @vitest-environment happy-dom
/**
 * The number pad in the DOM: the physical keyboard and the on-screen keys drive the same state,
 * its words come from the caller (the grown-ups' language), text fields keep their own typing,
 * and a key never takes focus from a click.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeypad, KEYPAD_LAYOUT } from '../../../../src/app/ui/keypad';
import type { KeypadLabels } from '../../../../src/app/ui/keypad';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => kit?.dispose());

const LABELS: KeypadLabels = {
  pad: 'Number pad',
  backspace: 'Delete a digit',
  ok: 'OK',
  spoken: (value) => `Answer: ${value}`,
};

function field(element: HTMLElement): string {
  return element.querySelector('.ps-answer__field')?.textContent ?? '';
}

describe('number pad', () => {
  it('types the same answer from physical keys and on-screen keys', async () => {
    kit = testKit();
    const answers: number[] = [];
    const keypad = createKeypad(kit, {
      labels: LABELS,
      onSubmit: (answer) => void answers.push(answer),
    });
    document.body.append(keypad.element);

    press('5');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-6"]')!.click();
    expect(field(keypad.element)).toBe('56');
    press('Backspace');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-backspace"]')!.click();
    expect(field(keypad.element)).toBe('');

    press('4');
    press('2');
    press('Enter');
    await settle();
    expect(answers).toEqual([42]);
    expect(kit.cue).toHaveBeenCalledWith('ui.keypad');
    keypad.dispose();
  });

  it('speaks with the caller’s words and lays its keys out phone-style', () => {
    kit = testKit();
    const keypad = createKeypad(kit, { labels: LABELS, onSubmit: vi.fn() });
    document.body.append(keypad.element);
    expect(keypad.element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Number pad',
    );
    expect(
      keypad.element.querySelector('[data-testid="keypad-backspace"]')?.getAttribute('aria-label'),
    ).toBe('Delete a digit');
    press('7');
    expect(keypad.element.querySelector('.ps-visually-hidden')?.textContent).toBe('Answer: 7');
    const keys = [...keypad.element.querySelectorAll('.ps-keypad button')].map(
      (key) => key.getAttribute('data-testid')?.replace('keypad-', '') ?? '',
    );
    expect(keys).toEqual(KEYPAD_LAYOUT);
    keypad.dispose();
  });

  it('ignores keys typed into a text field and keys while disabled', () => {
    kit = testKit();
    const keypad = createKeypad(kit, { labels: LABELS, onSubmit: vi.fn() });
    const input = document.createElement('input');
    document.body.append(keypad.element, input);
    press('8', input);
    expect(field(keypad.element)).toBe('');
    keypad.setDisabled(true);
    press('8');
    expect(field(keypad.element)).toBe('');
    keypad.setDisabled(false);
    press('8');
    expect(field(keypad.element)).toBe('8');
    keypad.dispose();
    press('9');
    expect(field(keypad.element)).toBe('8');
  });

  it('leaves Enter on a focused key to the browser, so one press is one action', async () => {
    kit = testKit();
    const onSubmit = vi.fn();
    const keypad = createKeypad(kit, { labels: LABELS, onSubmit });
    document.body.append(keypad.element);
    press('3');
    const ok = keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-ok"]')!;
    const event = press('Enter', ok);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    keypad.dispose();
  });

  it('does not take focus when a key is clicked, so Enter on the keyboard still submits', () => {
    kit = testKit();
    const keypad = createKeypad(kit, { labels: LABELS, onSubmit: vi.fn() });
    document.body.append(keypad.element);
    const key = keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-0"]')!;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    key.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    keypad.dispose();
  });
});
