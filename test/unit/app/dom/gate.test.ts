// @vitest-environment happy-dom
/**
 * The grown-ups' gate as a dialog: holding the lock for two seconds (here from the keyboard)
 * shows a two-digit multiplication in the grown-ups' language; a wrong answer only brings a new
 * question; the right one opens the gate; letting go early or cancelling keeps it shut.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_MS } from '../../../../src/app/grownups/gate';
import { openGrownUpsGate } from '../../../../src/app/grownups/gate-dialog';
import { createGrownUpTranslator } from '../../../../src/app/i18n/messages';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => {
  vi.useRealTimers();
  kit?.dispose();
});

function open(language: 'cs' | 'en') {
  vi.useFakeTimers();
  kit = testKit();
  let clock = 1000;
  const randoms = [0.25, 0.5, 0.75, 0.3, 0.6, 0.9];
  let draw = 0;
  const result = openGrownUpsGate(kit, createGrownUpTranslator(language), {
    random: () => randoms[draw++ % randoms.length]!,
    now: () => clock,
  });
  const dialog = kit.dialogs.querySelector<HTMLDialogElement>('[data-testid="grownups-gate"]')!;
  const hold = dialog.querySelector<HTMLButtonElement>('[data-testid="gate-hold"]')!;
  const key = (type: 'keydown' | 'keyup', name = ' ') =>
    hold.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true }));
  const wait = (milliseconds: number) => {
    clock += milliseconds;
    vi.advanceTimersByTime(milliseconds);
  };
  const question = () => dialog.querySelector<HTMLElement>('[data-testid="gate-question"]');
  const answer = () => Number(question()!.dataset['a']) * Number(question()!.dataset['b']);
  const type = (digits: string) => {
    for (const digit of digits) press(digit);
    press('Enter');
  };
  let settled: boolean | undefined;
  void result.then((value) => (settled = value));
  return { dialog, hold, key, wait, question, answer, type, result, settled: () => settled };
}

describe('the grown-ups’ gate', () => {
  it('asks its question only after the lock is held for two seconds', async () => {
    const gate = open('cs');
    expect(gate.dialog.getAttribute('lang')).toBe('cs');
    expect(gate.dialog.textContent).toContain('Podržte zámek dvě sekundy.');
    gate.key('keydown');
    expect(gate.hold.dataset['state']).toBe('holding');
    gate.wait(HOLD_MS / 2);
    gate.key('keyup');
    expect(gate.hold.dataset['state'], 'let go early: it empties again').toBe('idle');
    expect(gate.question()).toBeNull();
    gate.key('keydown');
    gate.wait(HOLD_MS + 30);
    expect(gate.question()?.textContent).toMatch(/^Kolik je \d\d × \d\d\?$/);
    expect(kit.cue).toHaveBeenCalledWith('ui.navigate');
    gate.type(String(gate.answer()));
    await settle();
    expect(gate.settled()).toBe(true);
    await expect(gate.result).resolves.toBe(true);
  });

  it('answers a wrong number with a new question and no lockout, in English when chosen', async () => {
    const gate = open('en');
    expect(gate.dialog.getAttribute('lang')).toBe('en');
    gate.key('keydown');
    gate.wait(HOLD_MS + 30);
    const first = gate.question()!.textContent;
    expect(first).toMatch(/^What is \d\d × \d\d\?$/);
    gate.type(String(gate.answer() + 1));
    await settle();
    expect(gate.settled()).toBeUndefined();
    expect(gate.question()!.textContent).not.toBe(first);
    expect(gate.dialog.querySelector('[data-testid="gate-note"]')?.textContent).toBe(
      'That is not right. Here is another one.',
    );
    gate.type(String(gate.answer()));
    await settle();
    expect(gate.settled()).toBe(true);
  });

  it('stays shut when cancelled', async () => {
    const gate = open('cs');
    gate.dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(gate.settled()).toBe(false);
    expect(kit.dialogs.querySelector('dialog')).toBeNull();
  });
});
