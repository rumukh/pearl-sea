/**
 * Big choice tiles. Touch or click picks a tile; on a keyboard the arrows move between tiles
 * (one tab stop, roving focus), Enter or Space picks the focused tile, and with `typeSelect`
 * typing focuses the tile whose label matches what was typed: a letter on a Czech keyboard
 * ("y", "ý"), or digits ("1", "12").
 */
import { h } from './dom';
import { badgeIcon } from './icons';
import type { UiKit } from './kit';

export interface TileChoice {
  readonly id: string;
  readonly label: string;
  readonly ariaLabel?: string;
}

export type TileState = 'correct' | 'miss' | null;

export interface TilesOptions {
  label: string;
  choices: readonly TileChoice[];
  onChoose(choice: TileChoice): void | Promise<void>;
  /** Let typed letters and digits select the tile with that label. */
  typeSelect?: boolean;
  /** The labels are single letters or signs, drawn bigger than words. */
  glyphs?: boolean;
  testIdPrefix?: string;
}

export interface TilesView {
  readonly element: HTMLElement;
  setState(id: string, state: TileState): void;
  setDisabled(disabled: boolean): void;
  /** Take one choice out of play (a missed answer), keeping its state badge. */
  block(id: string): void;
  focus(): void;
  dispose(): void;
}

function fold(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

/**
 * Which label the typed text picks: the exact match, if any (letter case aside, accents kept:
 * "y" is not "ý"), and whether a longer label could still be reached by typing more.
 */
export function matchTyped(
  typed: string,
  labels: readonly string[],
): { index: number | null; partial: boolean } {
  if (typed === '') return { index: null, partial: false };
  const wanted = fold(typed);
  const folded = labels.map(fold);
  const exact = folded.indexOf(wanted);
  const partial = folded.some((label) => label.length > wanted.length && label.startsWith(wanted));
  return { index: exact >= 0 ? exact : null, partial };
}

/**
 * Type-ahead over tile labels: a key extends what was typed while that can still match a
 * label, otherwise it starts again from this key. Returns the new typed text and the tile to
 * select, if any.
 */
export function typeAhead(
  typed: string,
  key: string,
  labels: readonly string[],
): { typed: string; index: number | null } {
  let next = typed + key;
  let match = matchTyped(next, labels);
  if (match.index === null && !match.partial) {
    next = key;
    match = matchTyped(next, labels);
  }
  return { typed: match.index !== null || match.partial ? next : '', index: match.index };
}

export const TYPE_RESET_MS = 1500;

/** A key that types a character (a letter with or without accents, or a digit). */
function typesCharacter(key: string): boolean {
  return [...key].length === 1 && /^[\p{L}\p{N}]$/u.test(key);
}

export function createTiles(kit: UiKit, options: TilesOptions): TilesView {
  const prefix = options.testIdPrefix ?? 'choice';
  let disabled = false;
  let busy = false;
  let typed = '';
  let typedTimer: ReturnType<typeof setTimeout> | undefined;
  let current = 0;
  const blocked = new Set<number>();

  const tiles = options.choices.map((choice, index) => {
    const tile = h(
      'button',
      {
        className: 'ps-tile',
        testId: `${prefix}-${choice.id}`,
        attributes: {
          type: 'button',
          tabindex: index === 0 ? '0' : '-1',
          'aria-pressed': 'false',
          ...(choice.ariaLabel ? { 'aria-label': choice.ariaLabel } : {}),
        },
      },
      options.glyphs
        ? h('span', { className: 'ps-tile__glyph', text: choice.label })
        : choice.label,
    );
    tile.addEventListener('click', () => choose(index));
    tile.addEventListener('focus', () => setCurrent(index, false));
    return tile;
  });
  const element = h(
    'div',
    {
      className: 'ps-tiles',
      testId: `${prefix}s`,
      attributes: { role: 'group', 'aria-label': options.label },
    },
    ...tiles,
  );

  /** The next playable tile from `from` in direction `delta`, wrapping around. */
  function step(from: number, delta: number): number {
    for (let offset = 1; offset <= tiles.length; offset++) {
      const index = (((from + delta * offset) % tiles.length) + tiles.length) % tiles.length;
      if (!blocked.has(index)) return index;
    }
    return from;
  }

  function setCurrent(index: number, focus: boolean): void {
    current = (index + tiles.length) % tiles.length;
    tiles.forEach((tile, position) => {
      tile.tabIndex = position === current ? 0 : -1;
    });
    if (focus) tiles[current]?.focus();
  }

  function select(index: number): void {
    tiles.forEach((tile, position) =>
      tile.setAttribute('aria-pressed', String(position === index)),
    );
    setCurrent(index, true);
  }

  function choose(index: number): void {
    if (disabled || busy || blocked.has(index)) return;
    const choice = options.choices[index];
    if (!choice) return;
    select(index);
    busy = true;
    sync();
    Promise.resolve()
      .then(() => options.onChoose(choice))
      .catch(kit.onError)
      .finally(() => {
        busy = false;
        sync();
      });
  }

  function sync(): void {
    tiles.forEach((tile, index) => {
      tile.disabled =
        disabled || blocked.has(index) || (busy && tile.getAttribute('aria-pressed') !== 'true');
    });
  }

  const release = kit.keyboard.push((event) => {
    if (disabled || busy || !element.isConnected) return 'pass';
    const key = event.key;
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      setCurrent(element.contains(document.activeElement) ? step(current, 1) : current, true);
      return 'handled';
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      setCurrent(element.contains(document.activeElement) ? step(current, -1) : current, true);
      return 'handled';
    }
    if (key === 'Home' || key === 'End') {
      setCurrent(key === 'Home' ? step(-1, 1) : step(tiles.length, -1), true);
      return 'handled';
    }
    if (key === 'Enter') {
      const selected = tiles.findIndex((tile) => tile.getAttribute('aria-pressed') === 'true');
      if (selected >= 0) {
        choose(selected);
        return 'handled';
      }
      return 'pass';
    }
    if (options.typeSelect && typesCharacter(key)) {
      const typedStep = typeAhead(
        typed,
        key,
        options.choices.map((choice) => choice.label),
      );
      typed = typedStep.typed;
      if (typedStep.index !== null && !blocked.has(typedStep.index)) select(typedStep.index);
      clearTimeout(typedTimer);
      typedTimer = setTimeout(() => {
        typed = '';
      }, TYPE_RESET_MS);
      return 'handled';
    }
    return 'pass';
  });

  return {
    element,
    setState(id, state) {
      const index = options.choices.findIndex((choice) => choice.id === id);
      const tile = tiles[index];
      if (!tile) return;
      tile.querySelector('.ps-badge')?.remove();
      if (state === null) {
        delete tile.dataset['state'];
        return;
      }
      tile.dataset['state'] = state;
      tile.append(
        h(
          'span',
          { className: 'ps-badge', attributes: { 'aria-hidden': 'true' } },
          badgeIcon(state === 'correct' ? 'correct' : 'almost'),
        ),
      );
    },
    setDisabled(value) {
      disabled = value;
      sync();
    },
    block(id) {
      const index = options.choices.findIndex((choice) => choice.id === id);
      if (index < 0) return;
      blocked.add(index);
      tiles[index]?.setAttribute('aria-pressed', 'false');
      if (current === index) setCurrent(step(index, 1), false);
      sync();
    },
    focus() {
      setCurrent(current, true);
    },
    dispose() {
      clearTimeout(typedTimer);
      release();
    },
  };
}
