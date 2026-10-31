/**
 * A UI kit for DOM tests (happy-dom): the real keyboard stack, announcer and toaster, with
 * sound cues and errors recorded instead of played or shown.
 */
import { vi } from 'vitest';
import { createTranslator } from '../../../../src/app/i18n/messages';
import { createAnnouncer } from '../../../../src/app/ui/announcer';
import { createKeyboard } from '../../../../src/app/ui/keyboard';
import type { UiKit } from '../../../../src/app/ui/kit';
import { createToaster } from '../../../../src/app/ui/toast';

export function testKit(): UiKit & { errors: unknown[]; dispose(): void } {
  document.body.replaceChildren();
  const announcer = createAnnouncer();
  const toasts = createToaster(announcer);
  const keyboard = createKeyboard(document);
  const fx = document.createElement('div');
  const dialogs = document.createElement('div');
  document.body.append(announcer.element, toasts.element, fx, dialogs);
  const errors: unknown[] = [];
  return {
    t: createTranslator(),
    keyboard,
    announcer,
    toasts,
    fx,
    dialogs,
    baseUrl: 'http://localhost:4331/pearl-sea/',
    cue: vi.fn(),
    onError: (error: unknown) => errors.push(error),
    errors,
    dispose: () => keyboard.dispose(),
  };
}

export function press(key: string, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** Let promise callbacks scheduled by components run. */
export async function settle(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve();
}
