// @vitest-environment happy-dom
/**
 * The router: an explicit in-memory stack, focus on each new screen's heading, disposal of the
 * screen that leaves, the page language following the screen, an error boundary, child-safe
 * checks, and overtaken navigations dropped.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter } from '../../../../src/app/router/router';
import type { Screen, ScreenEntry } from '../../../../src/app/router/router';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => kit?.dispose());

function screen(name: string, extra: Partial<Screen> = {}): Screen {
  const element = document.createElement('main');
  element.dataset['testid'] = name;
  const heading = document.createElement('h1');
  heading.textContent = name;
  element.append(heading);
  return { element, title: name, ...extra };
}

function entry(name: string, extra: Partial<Screen> = {}, log?: string[]): ScreenEntry {
  return {
    key: name,
    build(context) {
      log?.push(`build ${name} back=${context.canGoBack}`);
      return screen(name, {
        dispose: () => log?.push(`dispose ${name}`),
        ...extra,
      });
    },
  };
}

function setup() {
  kit = testKit();
  const stage = document.createElement('div');
  document.body.append(stage);
  const onLeave = vi.fn();
  const router = createRouter({
    stage,
    kit,
    appName: 'Perlové moře',
    onLeave,
    fallback: (error) => entry(`error:${(error as Error).message}`),
    lastResort: { heading: 'Hra se nespustila', body: 'Zkus to prosím znovu.' },
  });
  return { stage, router, onLeave };
}

describe('router', () => {
  it('pushes and goes back through an explicit stack, disposing what leaves', async () => {
    const { stage, router, onLeave } = setup();
    const log: string[] = [];
    await router.reset(entry('title', {}, log));
    await router.push(entry('grownups', {}, log));
    expect(stage.querySelector('main')?.dataset['testid']).toBe('grownups');
    expect(router.canGoBack()).toBe(true);
    expect(document.title).toBe('grownups · Perlové moře');
    await router.back();
    expect(stage.querySelector('main')?.dataset['testid']).toBe('title');
    expect(router.canGoBack()).toBe(false);
    await router.back();
    expect(router.currentKey()).toBe('title');
    expect(log).toEqual([
      'build title back=false',
      'build grownups back=true',
      'dispose title',
      'build title back=false',
      'dispose grownups',
    ]);
    expect(onLeave).toHaveBeenCalledTimes(3);
    router.dispose();
  });

  it('moves focus to the new screen heading and marks the screen and its field', async () => {
    const { router } = setup();
    await router.reset(entry('title'));
    const heading = document.querySelector('h1')!;
    expect(document.activeElement).toBe(heading);
    expect(heading.tabIndex).toBe(-1);
    const main = document.querySelector('main')!;
    expect(main.classList.contains('ps-screen')).toBe(true);
    expect(main.classList.contains('ps-field-sea')).toBe(true);
    router.dispose();
  });

  it('sets the page language from the screen: Czech for children, English when chosen', async () => {
    const { router } = setup();
    await router.reset(entry('title'));
    expect(document.documentElement.lang).toBe('cs');
    await router.push(entry('grownups', { lang: 'en', field: 'desk' }));
    expect(document.documentElement.lang).toBe('en');
    await router.back();
    expect(document.documentElement.lang).toBe('cs');
    router.dispose();
  });

  it('gives a screen its region accent, or the sea teal outside any region', async () => {
    const { router } = setup();
    await router.reset(entry('map', { region: 'coral-reef' }));
    const main = document.querySelector('main')!;
    expect(main.dataset['region']).toBe('coral-reef');
    expect(main.style.getPropertyValue('--ps-accent')).toBe('#ff7f6b');
    await router.reset(entry('grownups', { region: null }));
    const next = document.querySelector('main')!;
    expect(next.dataset['region']).toBeUndefined();
    expect(next.style.getPropertyValue('--ps-accent')).toBe('#0a6e80');
    router.dispose();
  });

  it('returns to a screen further down the stack, rebuilt, or changes nothing', async () => {
    const { stage, router } = setup();
    const log: string[] = [];
    await router.reset(entry('title', {}, log));
    await router.push(entry('grotto', {}, log));
    await router.push(entry('map', {}, log));
    expect(await router.backTo('nowhere')).toBe(false);
    expect(router.currentKey()).toBe('map');
    expect(await router.backTo('grotto')).toBe(true);
    expect(stage.querySelector('main')?.dataset['testid']).toBe('grotto');
    expect(router.canGoBack()).toBe(true);
    expect(log.filter((line) => line.startsWith('build grotto'))).toHaveLength(2);
    router.dispose();
  });

  it('shows the error boundary when a screen fails to build', async () => {
    const { stage, router } = setup();
    await router.reset(entry('title'));
    await router.push({
      key: 'broken',
      build() {
        throw new Error('boom');
      },
    });
    expect(stage.querySelector('main')?.dataset['testid']).toBe('error:boom');
    expect(router.canGoBack()).toBe(false);
    router.dispose();
  });

  it('shows two calm lines when even the error boundary fails', async () => {
    kit = testKit();
    const stage = document.createElement('div');
    document.body.append(stage);
    const router = createRouter({
      stage,
      kit,
      appName: 'Perlové moře',
      onLeave: () => undefined,
      fallback: () => ({
        key: 'error',
        build() {
          throw new Error('the error screen broke too');
        },
      }),
      lastResort: { heading: 'Hra se nespustila', body: 'Zkus to prosím znovu.' },
    });
    await router.reset({
      key: 'broken',
      build() {
        throw new Error('boom');
      },
    });
    expect(stage.querySelector('h1')?.textContent).toBe('Hra se nespustila');
    expect(stage.querySelector('p')?.textContent).toBe('Zkus to prosím znovu.');
    router.dispose();
  });

  it('refuses to mount a screen with an outbound link', async () => {
    const { stage, router } = setup();
    const outbound = screen('outbound');
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    outbound.element.append(link);
    await router.reset({ key: 'outbound', build: () => outbound });
    expect(stage.querySelector('main')?.dataset['testid']).toMatch(/^error:/);
    router.dispose();
  });

  it('drops a slow navigation overtaken by a newer one', async () => {
    const { stage, router } = setup();
    const log: string[] = [];
    let finish: () => void = () => undefined;
    const slow: ScreenEntry = {
      key: 'slow',
      async build() {
        await new Promise<void>((resolve) => (finish = resolve));
        return screen('slow', { dispose: () => log.push('dispose slow') });
      },
    };
    const first = router.reset(slow);
    await router.reset(entry('fast'));
    finish();
    await first;
    await settle();
    expect(stage.querySelector('main')?.dataset['testid']).toBe('fast');
    expect(log).toEqual(['dispose slow']);
    router.dispose();
  });

  it('gives Escape to the current screen', async () => {
    const { router } = setup();
    const onEscape = vi.fn(() => true);
    await router.reset(entry('round', { onEscape }));
    const event = press('Escape');
    expect(onEscape).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    router.dispose();
  });
});
