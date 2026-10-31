/**
 * Progress meters (the ink meter of a monster, a friend's growth), stars and the coin counter:
 * each states its value in words as well as in shape and colour, so no reading depends on colour
 * alone. Counts are said in Czech plural forms ("1 mince", "3 mince", "5 mincí").
 */
import { h } from './dom';
import { coinIcon, starIcon } from './icons';
import { animate, EASE_OUT, finished, prefersReducedMotion } from './motion';
import type { UiKit } from './kit';

export interface MeterView {
  readonly element: HTMLElement;
  update(value: number): void;
}

export function createMeter(options: {
  label: string;
  max: number;
  value: number;
  valueText(value: number, max: number): string;
  testId?: string;
  /** Show only the value; the label stays for assistive technology. */
  compact?: boolean;
}): MeterView {
  const fill = h('span', { className: 'ps-meter__fill' });
  const valueLabel = h('span', { className: 'ps-meter__value' });
  const track = h(
    'span',
    { className: 'ps-meter__track', attributes: { 'aria-hidden': 'true' } },
    fill,
  );
  const element = h(
    'div',
    {
      className: 'ps-meter',
      ...(options.testId ? { testId: options.testId } : {}),
      attributes: {
        role: 'meter',
        'aria-label': options.label,
        'aria-valuemin': '0',
        'aria-valuemax': String(options.max),
      },
    },
    h(
      'span',
      { className: 'ps-meter__label' },
      h('span', {
        ...(options.compact ? { className: 'ps-visually-hidden' } : {}),
        text: options.label,
      }),
      valueLabel,
    ),
    track,
  );
  const update = (value: number): void => {
    const clamped = Math.min(Math.max(value, 0), options.max);
    const text = options.valueText(clamped, options.max);
    element.setAttribute('aria-valuenow', String(clamped));
    element.setAttribute('aria-valuetext', text);
    element.dataset['value'] = String(clamped);
    valueLabel.textContent = text;
    fill.style.setProperty('--value', String(options.max === 0 ? 0 : clamped / options.max));
  };
  update(options.value);
  return { element, update };
}

export interface StarsView {
  readonly element: HTMLElement;
  /** Pop the earned stars in one by one (instant with reduced motion). */
  reveal(): Promise<void>;
}

/** Up to three stars: earned ones filled gold, missing ones an outline, so shape differs too. */
export function createStars(earned: number, label: string, testId = 'stars'): StarsView {
  const stars = [0, 1, 2].map((index) => {
    const star = starIcon(index < earned);
    star.dataset['earned'] = String(index < earned);
    return star;
  });
  const element = h(
    'div',
    {
      className: 'ps-stars',
      testId,
      dataset: { earned: String(earned) },
      attributes: { role: 'img', 'aria-label': label },
    },
    ...stars,
  );
  return {
    element,
    async reveal() {
      for (const [index, star] of stars.entries()) {
        if (index >= earned) break;
        await finished(
          animate(
            star,
            [
              { transform: 'scale(0.2) rotate(-30deg)', opacity: 0 },
              { transform: 'scale(1.18) rotate(6deg)', opacity: 1, offset: 0.6 },
              { transform: 'scale(1) rotate(0deg)', opacity: 1 },
            ],
            { duration: 420, easing: EASE_OUT, fill: 'backwards' },
          ),
        );
      }
    },
  };
}

export interface CoinCounterView {
  readonly element: HTMLElement;
  value(): number;
  /** Set without celebration (restore, first render). */
  set(value: number): void;
  /** Fly coins from `from` to the counter, then count up. */
  gain(amount: number, from?: Element): Promise<void>;
}

export function createCoinCounter(kit: UiKit, initial: number): CoinCounterView {
  let current = initial;
  const number = h('span', { className: 'ps-coins__value', text: String(initial) });
  const element = h(
    'div',
    {
      className: 'ps-coins',
      testId: 'coins',
      dataset: { value: String(initial) },
      attributes: { role: 'img' },
    },
    coinIcon(),
    number,
  );
  const show = (value: number): void => {
    current = value;
    number.textContent = String(value);
    element.dataset['value'] = String(value);
    element.setAttribute('aria-label', kit.t.plural('coins.label', value));
  };
  show(initial);

  const fly = async (from: Element, index: number): Promise<void> => {
    const start = from.getBoundingClientRect();
    const end = element.getBoundingClientRect();
    const coin = coinIcon('ps-coin ps-flying-coin');
    kit.fx.append(coin);
    const x0 = start.left + start.width / 2 - 14;
    const y0 = start.top + start.height / 2 - 14;
    const x1 = end.left + 10;
    const y1 = end.top + end.height / 2 - 14;
    const lift = Math.min(160, Math.abs(y1 - y0) / 2 + 60);
    await finished(
      animate(
        coin,
        [
          { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
          {
            transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - lift}px) scale(1.2)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 0.9 },
        ],
        { duration: 620, delay: index * 90, easing: EASE_OUT, fill: 'both' },
      ),
    );
    coin.remove();
  };

  return {
    element,
    value: () => current,
    set: show,
    async gain(amount, from) {
      if (amount <= 0) return;
      const target = current + amount;
      // Said when earned, not when the last coin lands: by then the round may have moved on.
      kit.announcer.announce(kit.t.plural('coins.earned', amount));
      if (from && !prefersReducedMotion()) {
        await Promise.all(
          Array.from({ length: Math.min(amount, 5) }, (_, index) => fly(from, index)),
        );
      }
      show(target);
      animate(
        number,
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.35)', offset: 0.4 },
          { transform: 'scale(1)' },
        ],
        { duration: 380, easing: EASE_OUT },
      );
    },
  };
}
