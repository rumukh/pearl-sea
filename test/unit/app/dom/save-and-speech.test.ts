// @vitest-environment happy-dom
/**
 * The save status pill and the read-aloud button, as the game screens will mount them: "Uloženo"
 * only for acknowledged writes, "Neuloženo" with Retry that retries the failed write (never the
 * action), a reopen after another window wrote first, trouble said once to screen readers; and a
 * read-aloud button that exists only when the child wants it and the device has a Czech voice.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveIndicator } from '../../../../src/app/persistence/save-status';
import { DEFAULT_PREFERENCES, withPreferences } from '../../../../src/app/persistence/preferences';
import { createSaveStatus } from '../../../../src/app/screens/common';
import { speakerButton } from '../../../../src/app/screens/speaker';
import type { App } from '../../../../src/app/shell/app';
import { settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => {
  vi.useRealTimers();
  kit?.dispose();
});

function indicatorSource() {
  let listener: (indicator: SaveIndicator) => void = () => undefined;
  return {
    subscribeIndicator(next: (indicator: SaveIndicator) => void) {
      listener = next;
      next({ kind: 'none' });
      return () => undefined;
    },
    show: (indicator: SaveIndicator) => listener(indicator),
  };
}

describe('the save status', () => {
  it('says saved only when told so, and offers Retry for the exact failed write', async () => {
    vi.useFakeTimers();
    kit = testKit();
    const source = indicatorSource();
    const commands = { retry: vi.fn(async () => undefined) };
    const reopen = vi.fn(async () => undefined);
    const status = createSaveStatus(kit, source, commands, reopen);
    document.body.append(status.element);
    expect(status.element.dataset['state']).toBe('none');

    source.show({ kind: 'saving' });
    expect(status.element.textContent).toBe('Ukládám…');
    source.show({ kind: 'saved' });
    expect(status.element.textContent).toBe('Uloženo');

    source.show({ kind: 'failed', code: 'storage' });
    expect(status.element.dataset['state']).toBe('failed');
    expect(status.element.textContent).toContain('Neuloženo');
    status.element.querySelector<HTMLButtonElement>('[data-testid="save-retry"]')!.click();
    await settle();
    expect(commands.retry).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(100);
    expect(document.querySelector('[data-testid="announcer-assertive"]')?.textContent).toBe(
      'Neuloženo',
    );

    source.show({ kind: 'conflict' });
    expect(status.element.textContent).toContain('Hra je otevřená jinde');
    expect(status.element.querySelector('[data-testid="save-retry"]')).toBeNull();
    status.element.querySelector<HTMLButtonElement>('[data-testid="save-reopen"]')!.click();
    await settle();
    expect(reopen).toHaveBeenCalledOnce();

    source.show({ kind: 'unavailable' });
    expect(status.element.textContent).toBe('Tady se nedá ukládat');
    status.dispose();
  });
});

describe('the read-aloud button', () => {
  function fakeApp(available: boolean) {
    kit = testKit();
    const speak = vi.fn(() => true);
    const app = {
      kit,
      speech: { available: () => available },
      speak,
    } as unknown as App;
    return { app, speak };
  }

  it('reads what the screen shows now with the child’s own settings', async () => {
    const { app, speak } = fakeApp(true);
    let line = 'Doplň i, nebo y.';
    const [button] = speakerButton(app, DEFAULT_PREFERENCES, () => line);
    expect(button).toBeDefined();
    expect(button!.textContent).toBe('Přečíst nahlas');
    line = 'Ml_n se točí.';
    button!.click();
    await settle();
    expect(speak).toHaveBeenCalledWith('Ml_n se točí.', DEFAULT_PREFERENCES);
  });

  it('is not there when the device has no Czech voice or the child turned it off', () => {
    expect(speakerButton(fakeApp(false).app, DEFAULT_PREFERENCES, () => 'Ahoj')).toEqual([]);
    const off = withPreferences(DEFAULT_PREFERENCES, (draft) => {
      draft.readAloud = false;
    });
    expect(speakerButton(fakeApp(true).app, off, () => 'Ahoj')).toEqual([]);
  });
});
