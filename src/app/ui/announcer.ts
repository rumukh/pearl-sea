/**
 * Screen-reader announcements through two persistent live regions (polite and assertive) that
 * live outside the replaceable screen, so a screen change never drops a pending message.
 * Repeating the same words is announced again: the region is emptied first. Messages that come
 * close together are queued, each written after the one before has had its turn, so none is
 * lost.
 */
import { h } from './dom';

/** The empty moment before a message is written, so the same words are heard again. */
export const ANNOUNCE_DELAY_MS = 40;
/** How long a message stays alone in its region before the next queued one is written. */
export const ANNOUNCE_HOLD_MS = 250;

export interface Announcer {
  readonly element: HTMLElement;
  announce(text: string, priority?: 'polite' | 'assertive'): void;
  clear(): void;
}

interface Channel {
  readonly region: HTMLElement;
  readonly queue: string[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

export function createAnnouncer(): Announcer {
  const polite = h('div', {
    className: 'ps-visually-hidden',
    testId: 'announcer-polite',
    attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  const assertive = h('div', {
    className: 'ps-visually-hidden',
    testId: 'announcer-assertive',
    attributes: { 'aria-live': 'assertive', 'aria-atomic': 'true' },
  });
  const element = h('div', { className: 'ps-announcer' }, polite, assertive);
  const channels: Record<'polite' | 'assertive', Channel> = {
    polite: { region: polite, queue: [], timer: undefined },
    assertive: { region: assertive, queue: [], timer: undefined },
  };

  /** Write the next queued message, then give it its moment before the one after. */
  const next = (channel: Channel): void => {
    const text = channel.queue.shift();
    if (text === undefined) {
      channel.timer = undefined;
      return;
    }
    channel.region.textContent = '';
    channel.timer = setTimeout(() => {
      channel.region.textContent = text;
      channel.timer = setTimeout(() => next(channel), ANNOUNCE_HOLD_MS);
    }, ANNOUNCE_DELAY_MS);
  };

  return {
    element,
    announce(text, priority = 'polite') {
      const channel = channels[priority];
      channel.queue.push(text);
      if (channel.timer === undefined) next(channel);
    },
    clear() {
      for (const channel of Object.values(channels)) {
        clearTimeout(channel.timer);
        channel.timer = undefined;
        channel.queue.length = 0;
        channel.region.textContent = '';
      }
    },
  };
}
