// @vitest-environment happy-dom
/**
 * Choice tiles: one tab stop with arrow keys between tiles, typed letters (i í y ý) and digits
 * that pick the matching tile, Enter to choose, and a missed tile taken out of play while
 * keeping its "?" badge.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiles, matchTyped, typeAhead } from '../../../../src/app/ui/tiles';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => {
  vi.useRealTimers();
  kit?.dispose();
});

const letters = ['i', 'í', 'y', 'ý'].map((label) => ({ id: label, label }));
const numbers = [12, 15, 21].map((value) => ({ id: String(value), label: String(value) }));

describe('typed choices', () => {
  it('match a label exactly, accents kept, letter case aside, or wait for more', () => {
    const labels = letters.map((choice) => choice.label);
    expect(matchTyped('y', labels)).toEqual({ index: 2, partial: false });
    expect(matchTyped('ý', labels)).toEqual({ index: 3, partial: false });
    expect(matchTyped('Y', labels)).toEqual({ index: 2, partial: false });
    expect(matchTyped('Ý', labels)).toEqual({ index: 3, partial: false });
    expect(matchTyped('e', labels)).toEqual({ index: null, partial: false });
    const words = ['být', 'bít', 'byt'];
    expect(matchTyped('b', words)).toEqual({ index: null, partial: true });
    expect(typeAhead('b', 'y', words)).toEqual({ typed: 'by', index: null });
    expect(typeAhead('by', 't', words)).toEqual({ typed: 'byt', index: 2 });
    const digits = numbers.map((choice) => choice.label);
    expect(typeAhead('1', '5', digits)).toEqual({ typed: '15', index: 1 });
    expect(typeAhead('15', '2', digits)).toEqual({ typed: '2', index: null });
    expect(typeAhead('', '9', digits)).toEqual({ typed: '', index: null });
  });
});

describe('choice tiles', () => {
  it('pick a letter tile from the keyboard, then choose it with Enter', async () => {
    kit = testKit();
    const onChoose = vi.fn();
    const tiles = createTiles(kit, {
      label: 'Doplň písmeno',
      choices: letters,
      typeSelect: true,
      glyphs: true,
      onChoose,
    });
    document.body.append(tiles.element);
    press('ý');
    const long = tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-ý"]')!;
    expect(long.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(long);
    expect(long.querySelector('.ps-tile__glyph')?.textContent).toBe('ý');
    press('Enter');
    await settle();
    expect(onChoose).toHaveBeenCalledWith(letters[3]);
    tiles.dispose();
  });

  it('forget typed digits after a pause', () => {
    vi.useFakeTimers();
    kit = testKit();
    const tiles = createTiles(kit, {
      label: 'Odpovědi',
      choices: numbers,
      typeSelect: true,
      onChoose: vi.fn(),
    });
    document.body.append(tiles.element);
    press('2');
    vi.advanceTimersByTime(2000);
    press('1');
    const twelve = tiles.element.querySelector('[data-testid="choice-12"]')!;
    const twentyOne = tiles.element.querySelector('[data-testid="choice-21"]')!;
    expect(twentyOne.getAttribute('aria-pressed')).toBe('false');
    expect(twelve.getAttribute('aria-pressed')).toBe('false');
    tiles.dispose();
  });

  it('ignore typed letters unless asked to select by typing', () => {
    kit = testKit();
    const tiles = createTiles(kit, { label: 'Doplň', choices: letters, onChoose: vi.fn() });
    document.body.append(tiles.element);
    const event = press('y');
    expect(event.defaultPrevented).toBe(false);
    expect(tiles.element.querySelector('[aria-pressed="true"]')).toBeNull();
    tiles.dispose();
  });

  it('move focus with the arrows, one tab stop for the group, skipping a missed tile', () => {
    kit = testKit();
    const tiles = createTiles(kit, { label: 'Odpovědi', choices: numbers, onChoose: vi.fn() });
    document.body.append(tiles.element);
    const buttons = [...tiles.element.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    buttons[0]!.focus();
    press('ArrowRight', buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);
    tiles.setState('21', 'miss');
    tiles.block('21');
    press('ArrowRight', buttons[1]);
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[2]!.disabled).toBe(true);
    expect(buttons[2]!.dataset['state']).toBe('miss');
    expect(buttons[2]!.querySelector('.ps-badge svg.ps-badge-art--almost')).not.toBeNull();
    press('End', buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);
    tiles.dispose();
  });

  it('choose only once while the answer is being checked', async () => {
    kit = testKit();
    let release: () => void = () => undefined;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const tiles = createTiles(kit, { label: 'Odpovědi', choices: numbers, onChoose });
    document.body.append(tiles.element);
    const twelve = tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-12"]')!;
    twelve.click();
    twelve.click();
    tiles.element.querySelector<HTMLButtonElement>('[data-testid="choice-15"]')!.click();
    await settle();
    expect(onChoose).toHaveBeenCalledTimes(1);
    release();
    await settle();
    tiles.setState('12', 'correct');
    expect(twelve.dataset['state']).toBe('correct');
    expect(twelve.querySelector('.ps-badge svg.ps-badge-art--correct')).not.toBeNull();
    tiles.dispose();
  });
});
