/**
 * The screen router: mounts one screen at a time into the stage, with an explicit in-memory
 * stack (no browser history), focus moved to the new screen's heading, announcements and
 * speech cleared at every change, and an error boundary.
 *
 * Each screen is built from an entry; Back rebuilds the previous entry from scratch rather
 * than reviving stale DOM. A navigation that is overtaken by a newer one is discarded (and its
 * screen disposed) before it can mount, so double taps cannot interleave screens.
 * Every candidate tree passes `assertChildSafeView` (no outbound links, no embeds) first.
 *
 * A screen declares its language: Czech for children, the grown-ups' choice in their area. The
 * page's `lang` follows the screen, so dialogs, toasts and screen readers follow it too.
 */
import { assertChildSafeView, replaceProjection } from '@aegis/browser/ui';
import { applyRegion } from '../design/tokens';
import type { Language } from '../i18n/messages';
import type { UiKit } from '../ui/kit';
import { createScreenStack } from './stack';
import type { ScreenStack } from './stack';

/** The page behind a screen: the open sea, the grown-ups' sandy desk, or the dark deep. */
export type Field = 'sea' | 'desk' | 'abyss';

export interface Screen {
  readonly element: HTMLElement;
  /** Document title part; the router appends the game name. */
  readonly title: string;
  readonly field?: Field;
  /** Region accent for the screen (design/palette.ts `regions`), or none. */
  readonly region?: string | null;
  /** Music state for the screen (`title`, `grotto`, `map`, `round`, …), null for silence. */
  readonly music?: string | null;
  /** The screen's language; Czech unless it is the grown-ups' area in English. */
  readonly lang?: Language;
  /** The element focused after mounting; defaults to the screen's first heading. */
  focusTarget?(): HTMLElement | null;
  /** Escape on this screen (for example: pause). True when handled. */
  onEscape?(): boolean;
  /** Runs once the screen is in the document. */
  mounted?(): void;
  /** Runs once when the screen leaves: release keys, timers and subscriptions. */
  dispose?(): void;
}

export interface ScreenContext {
  /** Aborted when a newer navigation overtakes this one before it mounts. */
  readonly signal: AbortSignal;
  /** Whether Back will lead somewhere once this screen is shown. */
  readonly canGoBack: boolean;
}

export interface ScreenEntry {
  readonly key: string;
  build(context: ScreenContext): Screen | Promise<Screen>;
}

export interface Router {
  push(entry: ScreenEntry): Promise<void>;
  replace(entry: ScreenEntry): Promise<void>;
  reset(entry: ScreenEntry): Promise<void>;
  back(): Promise<void>;
  /** Rebuild the current screen in place (after a preference change). */
  refresh(): Promise<void>;
  /**
   * Return to the nearest screen with this key, rebuilding it (everything above it is dropped).
   * Resolves false, changing nothing, when no such screen is on the stack.
   */
  backTo(key: string): Promise<boolean>;
  canGoBack(): boolean;
  currentKey(): string | undefined;
  dispose(): void;
}

export interface RouterOptions {
  readonly stage: HTMLElement;
  readonly kit: UiKit;
  readonly appName: string;
  /** Stop speech and one-shot sounds that belong to the leaving screen. */
  onLeave(): void;
  /** A screen is in place (music, navigation sound); `moved` for push and back. */
  onMount?(screen: Screen, moved: boolean): void;
  /** The error boundary: a screen that explains a failure and offers a way on. */
  fallback(error: unknown): ScreenEntry;
  /** Shown when even the error boundary fails: two calm lines, no buttons. */
  readonly lastResort: { readonly heading: string; readonly body: string };
}

type Mode = 'push' | 'replace' | 'reset' | 'back' | 'refresh' | 'backTo';

/**
 * Longest wait for a new screen's pictures (its painted background) before it replaces the old
 * screen anyway. Meanwhile the old screen stays in view, so a change of screen never shows an
 * empty sea while a big picture is still being decoded.
 */
export const PICTURE_WAIT_MS = 320;

async function picturesReady(element: HTMLElement, timeoutMs: number): Promise<void> {
  const images = [...element.querySelectorAll('img')].filter(
    (image) => typeof image.decode === 'function',
  );
  if (images.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(images.map((image) => image.decode().catch(() => undefined))),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

export function createRouter(options: RouterOptions): Router {
  const { stage, kit } = options;
  let stack: ScreenStack<ScreenEntry> | undefined;
  let current: Screen | undefined;
  let serial = 0;
  let controller: AbortController | undefined;

  const safely = (work: () => void): void => {
    try {
      work();
    } catch (error) {
      kit.onError(error);
    }
  };

  const mount = (screen: Screen, moved = false): void => {
    const previous = current;
    current = screen;
    if (previous?.dispose) safely(() => previous.dispose!());
    screen.element.classList.add('ps-screen', `ps-field-${screen.field ?? 'sea'}`);
    assertChildSafeView(screen.element, kit.baseUrl);
    document.documentElement.lang = screen.lang ?? 'cs';
    replaceProjection(stage, () => screen.element, {
      stopAudio: options.onLeave,
      clearAnnouncements: () => kit.announcer.clear(),
      cancelInput: () => undefined,
      focus: () => {
        const target = screen.focusTarget?.() ?? screen.element.querySelector<HTMLElement>('h1');
        // Only a heading or a container needs tabindex -1 to take focus; a control keeps its
        // place in the Tab order.
        if (target && !target.hasAttribute('tabindex') && target.tabIndex < 0) {
          target.tabIndex = -1;
        }
        return target ?? undefined;
      },
    });
    applyRegion(screen.element, screen.region ?? null);
    document.title =
      screen.title === options.appName ? options.appName : `${screen.title} · ${options.appName}`;
    screen.element.dataset['entering'] = 'true';
    setTimeout(() => delete screen.element.dataset['entering'], 400);
    stage.removeAttribute('aria-busy');
    if (options.onMount) safely(() => options.onMount!(screen, moved));
    if (screen.mounted) safely(() => screen.mounted!());
  };

  const navigate = async (mode: Mode, entry?: ScreenEntry): Promise<void> => {
    const entries = stack?.entries() ?? [];
    const targetIndex = mode === 'backTo' && entry ? entries.lastIndexOf(entry) : -1;
    const token = ++serial;
    controller?.abort();
    const ownController = new AbortController();
    controller = ownController;
    const target =
      mode === 'back'
        ? stack?.previous()
        : mode === 'refresh'
          ? stack?.current()
          : mode === 'backTo'
            ? entries[targetIndex]
            : entry;
    if (!target) return;
    const depth = stack?.depth() ?? 0;
    const canGoBack =
      mode === 'push'
        ? depth >= 1
        : mode === 'back'
          ? depth - 1 > 1
          : mode === 'reset'
            ? false
            : mode === 'backTo'
              ? targetIndex > 0
              : depth > 1;
    stage.setAttribute('aria-busy', 'true');
    let screen: Screen;
    try {
      screen = await target.build({ signal: ownController.signal, canGoBack });
    } catch (error) {
      if (token !== serial) return;
      showFallback(error);
      return;
    }
    if (token !== serial) {
      if (screen.dispose) safely(() => screen.dispose!());
      return;
    }
    await picturesReady(screen.element, PICTURE_WAIT_MS);
    if (token !== serial) {
      if (screen.dispose) safely(() => screen.dispose!());
      return;
    }
    if (!stack) stack = createScreenStack(target);
    else if (mode === 'push') stack.push(target);
    else if (mode === 'replace') stack.replace(target);
    else if (mode === 'reset') stack.reset(target);
    else if (mode === 'back') stack.back();
    else if (mode === 'backTo') stack.popTo((candidate) => candidate === target);
    const moved =
      mode === 'push' || mode === 'back' || (mode === 'backTo' && targetIndex < depth - 1);
    try {
      mount(screen, moved);
    } catch (error) {
      showFallback(error);
    }
  };

  const showFallback = (error: unknown): void => {
    const entry = options.fallback(error);
    try {
      const screen = entry.build({ signal: new AbortController().signal, canGoBack: false });
      if (screen instanceof Promise) {
        throw new Error('The fallback screen must build synchronously.');
      }
      if (!stack) stack = createScreenStack(entry);
      else stack.reset(entry);
      mount(screen);
    } catch {
      stage.removeAttribute('aria-busy');
      const heading = document.createElement('h1');
      heading.textContent = options.lastResort.heading;
      const body = document.createElement('p');
      body.textContent = options.lastResort.body;
      stage.replaceChildren(heading, body);
    }
  };

  const release = kit.keyboard.push((event) => {
    if (event.key !== 'Escape' || !current?.onEscape) return 'pass';
    return current.onEscape() ? 'handled' : 'pass';
  });

  return {
    push: (entry) => navigate('push', entry),
    replace: (entry) => navigate('replace', entry),
    reset: (entry) => navigate('reset', entry),
    back: () => navigate('back'),
    refresh: () => navigate('refresh'),
    async backTo(key) {
      const entry = [...(stack?.entries() ?? [])]
        .reverse()
        .find((candidate) => candidate.key === key);
      if (!entry) return false;
      await navigate('backTo', entry);
      return true;
    },
    canGoBack: () => (stack?.depth() ?? 0) > 1,
    currentKey: () => stack?.current().key,
    dispose() {
      release();
      controller?.abort();
      if (current?.dispose) safely(() => current!.dispose!());
      current = undefined;
    },
  };
}
