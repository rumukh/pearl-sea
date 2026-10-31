// @vitest-environment happy-dom
/**
 * Small pieces of the UI kit: tabs turn with the arrows and around the ends, meters and the coin
 * counter say their value in words (Czech plural forms), stars differ in shape as well as colour,
 * toasts reach screen readers, every icon is a decorative SVG, and a rebuilt panel keeps the
 * keyboard on the control that had it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, replaceKeepingFocus } from '../../../../src/app/ui/dom';
import { ICON_NAMES, icon, starIcon } from '../../../../src/app/ui/icons';
import { createCoinCounter, createMeter, createStars } from '../../../../src/app/ui/meters';
import { createTabs, stepTab } from '../../../../src/app/ui/tabs';
import { settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => {
  vi.useRealTimers();
  kit?.dispose();
});

const NBSP = '\u00a0';

describe('tabs', () => {
  it('step around the ends', () => {
    const ids = ['settings', 'data', 'offline', 'about'];
    expect(stepTab(ids, 'about', 1)).toBe('settings');
    expect(stepTab(ids, 'settings', -1)).toBe('about');
    expect(stepTab(ids, 'data', 2)).toBe('about');
  });

  it('press one tab at a time, by tap or by the arrow keys', () => {
    kit = testKit();
    const chosen: string[] = [];
    const tabs = createTabs(kit, {
      label: 'Stránky alba',
      tabs: [
        { id: 'lagoon', name: 'Laguna' },
        { id: 'reef', name: 'Útes', done: true },
        { id: 'kelp', name: 'Les' },
      ],
      current: 'lagoon',
      testIdPrefix: 'album',
      arrows: { previous: 'Předchozí', next: 'Další' },
      onChange: (id) => chosen.push(id),
    });
    document.body.append(tabs.element);
    const tab = (id: string) =>
      tabs.element.querySelector<HTMLButtonElement>(`[data-testid="album-tab-${id}"]`)!;
    tab('kelp').click();
    expect(tab('kelp').getAttribute('aria-pressed')).toBe('true');
    expect(tab('lagoon').getAttribute('aria-pressed')).toBe('false');
    tab('kelp').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(tabs.current()).toBe('lagoon');
    tabs.element.querySelector<HTMLButtonElement>('[data-testid="album-previous"]')!.click();
    expect(chosen).toEqual(['kelp', 'lagoon', 'kelp']);
    expect(tab('reef').querySelector('.ps-tabs__done')).not.toBeNull();
    expect(kit.cue).toHaveBeenCalledWith('ui.tap');
  });
});

describe('meters, stars and coins', () => {
  it('say a meter’s value in words as well as in its fill', () => {
    const meter = createMeter({
      label: 'Inkoust',
      max: 10,
      value: 4,
      valueText: (value, max) => `${value} z ${max}`,
    });
    expect(meter.element.getAttribute('role')).toBe('meter');
    expect(meter.element.getAttribute('aria-valuetext')).toBe('4 z 10');
    meter.update(12);
    expect(meter.element.getAttribute('aria-valuenow'), 'clamped to the maximum').toBe('10');
  });

  it('draw earned stars filled and missing ones as outlines', () => {
    const stars = createStars(2, '2 hvězdy ze 3');
    expect(stars.element.getAttribute('aria-label')).toBe('2 hvězdy ze 3');
    const shapes = [...stars.element.querySelectorAll('svg')].map((star) =>
      star.classList.contains('ps-star--earned') ? 'earned' : 'empty',
    );
    expect(shapes).toEqual(['earned', 'earned', 'empty']);
    expect(starIcon(false).getAttribute('aria-hidden')).toBe('true');
  });

  it('name the coins in Czech plural forms and announce what was earned', async () => {
    vi.useFakeTimers();
    kit = testKit();
    const coins = createCoinCounter(kit, 1);
    document.body.append(coins.element);
    expect(coins.element.getAttribute('aria-label')).toBe('1 mince');
    coins.set(4);
    expect(coins.element.getAttribute('aria-label')).toBe('4 mince');
    await coins.gain(1);
    expect(coins.value()).toBe(5);
    expect(coins.element.getAttribute('aria-label')).toBe('5 mincí');
    vi.advanceTimersByTime(100);
    await settle();
    expect(document.querySelector('[data-testid="announcer-polite"]')?.textContent).toBe(
      `Máš o${NBSP}1 minci víc!`,
    );
  });
});

describe('toasts', () => {
  it('show a message and say it to screen readers once', () => {
    vi.useFakeTimers();
    kit = testKit();
    kit.toasts.show('Uloženo.', { tone: 'success' });
    expect(document.querySelector('[data-testid="toast"]')?.textContent).toBe('Uloženo.');
    expect(document.querySelector('[data-testid="toasts"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    vi.advanceTimersByTime(100);
    expect(document.querySelector('[data-testid="announcer-polite"]')?.textContent).toBe(
      'Uloženo.',
    );
  });
});

describe('icons', () => {
  it('are decorative SVGs on one 24-unit grid that draw in the colour of their control', () => {
    for (const name of ICON_NAMES) {
      const node = icon(name);
      expect(node.getAttribute('viewBox'), name).toBe('0 0 24 24');
      expect(node.getAttribute('aria-hidden'), name).toBe('true');
      expect(node.getAttribute('focusable'), name).toBe('false');
      const paths = [...node.querySelectorAll('path')];
      expect(paths.length, name).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.getAttribute('stroke'), name).toBe('currentColor');
        expect(path.getAttribute('d'), name).toMatch(/^M[\d.]/);
      }
    }
  });
});

describe('a rebuilt panel', () => {
  const controls = (): HTMLElement[] => [
    h('button', { testId: 'setting-a', text: 'A' }),
    h('input', { testId: 'setting-b', attributes: { type: 'checkbox' } }),
  ];

  it('keeps the keyboard on the control that had it', () => {
    const panel = h('section', {}, ...controls());
    const outside = h('button', { testId: 'outside', text: 'Zpět' });
    document.body.append(outside, panel);
    try {
      panel.querySelector<HTMLElement>('[data-testid="setting-b"]')!.focus();
      const old = document.activeElement;
      replaceKeepingFocus(panel, ...controls());
      expect(document.activeElement).not.toBe(old);
      expect(document.activeElement?.getAttribute('data-testid')).toBe('setting-b');

      outside.focus();
      replaceKeepingFocus(panel, ...controls());
      expect(document.activeElement, 'focus elsewhere stays where it is').toBe(outside);

      panel.querySelector<HTMLElement>('[data-testid="setting-a"]')!.focus();
      replaceKeepingFocus(panel, h('p', { text: 'Žádné děti.' }));
      expect(panel.textContent).toBe('Žádné děti.');
      expect(panel.contains(document.activeElement)).toBe(false);
    } finally {
      outside.remove();
      panel.remove();
    }
  });
});
