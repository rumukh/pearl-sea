/**
 * Tabs that show one part of a long collection at a time (the sticker album's pages, the shop's
 * shelves, the grown-ups' area), so no screen grows into a page dozens of screens tall at 200 %
 * text.
 *
 * Each tab is a toggle button (`aria-pressed`) in a labelled group; Left and Right move between
 * them, and optional arrow buttons turn the pages in order (around the end). Icon tabs keep their
 * name as the accessible label.
 */
import { h } from './dom';
import { icon } from './icons';
import type { UiKit } from './kit';

export interface Tab<T extends string> {
  readonly id: T;
  readonly name: string;
  /** A picture for the tab; with `iconOnly`, the name is only its accessible label. */
  readonly art?: () => Node;
  /** A short mark beside the name or picture, such as a check for a finished page. */
  readonly done?: boolean;
}

export interface TabsOptions<T extends string> {
  readonly label: string;
  readonly tabs: readonly Tab<T>[];
  readonly current: T;
  readonly testIdPrefix: string;
  readonly iconOnly?: boolean;
  /** Labels of the arrow buttons that turn to the previous and the next tab. */
  readonly arrows?: { readonly previous: string; readonly next: string };
  onChange(id: T): void;
}

export interface TabsView<T extends string> {
  readonly element: HTMLElement;
  current(): T;
  select(id: T): void;
}

/** The tab `delta` steps from `current`, around the ends. */
export function stepTab<T>(ids: readonly T[], current: T, delta: number): T {
  const index = Math.max(0, ids.indexOf(current));
  return ids[(((index + delta) % ids.length) + ids.length) % ids.length]!;
}

export function createTabs<T extends string>(kit: UiKit, options: TabsOptions<T>): TabsView<T> {
  let current = options.current;
  const ids = options.tabs.map((tab) => tab.id);
  const buttons = new Map<T, HTMLButtonElement>();
  const list = h('div', {
    className: `ps-segmented ps-tabs__list${options.iconOnly ? ' ps-tabs__list--icons' : ''}`,
    attributes: { role: 'group', 'aria-label': options.label },
  });

  const select = (id: T): void => {
    if (id === current || !buttons.has(id)) return;
    current = id;
    for (const [tabId, button] of buttons) {
      button.setAttribute('aria-pressed', String(tabId === current));
    }
    kit.cue('ui.tap');
    options.onChange(id);
  };
  const step = (delta: number): void => {
    const next = stepTab(ids, current, delta);
    select(next);
    buttons.get(next)?.focus();
  };

  for (const tab of options.tabs) {
    const button = h(
      'button',
      {
        className: 'ps-segment ps-tabs__tab',
        testId: `${options.testIdPrefix}-tab-${tab.id}`,
        dataset: { done: String(tab.done === true) },
        attributes: {
          type: 'button',
          'aria-pressed': String(tab.id === current),
          ...(options.iconOnly ? { 'aria-label': tab.name } : {}),
        },
      },
      tab.art ? tab.art() : null,
      options.iconOnly ? null : h('span', { text: tab.name }),
      tab.done ? icon('check', 'ps-icon ps-tabs__done') : null,
    );
    button.addEventListener('click', () => select(tab.id));
    buttons.set(tab.id, button);
    list.append(button);
  }
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  });

  const arrow = (label: string, name: 'back' | 'forward', delta: number): HTMLElement => {
    const button = h(
      'button',
      {
        className: 'ps-button ps-button--paper ps-button--icon ps-tabs__arrow',
        testId: `${options.testIdPrefix}-${delta < 0 ? 'previous' : 'next'}`,
        attributes: { type: 'button', 'aria-label': label },
      },
      icon(name),
    );
    button.addEventListener('click', () => step(delta));
    return button;
  };

  const element = h(
    'nav',
    {
      className: options.arrows ? 'ps-tabs ps-tabs--arrows' : 'ps-tabs',
      attributes: { 'aria-label': options.label },
    },
    options.arrows ? arrow(options.arrows.previous, 'back', -1) : null,
    list,
    options.arrows ? arrow(options.arrows.next, 'forward', 1) : null,
  );
  return { element, current: () => current, select };
}
