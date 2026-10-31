/**
 * Pieces shared by screens: the top bar, the save status pill, a child's name badge, file
 * download and upload for grown-ups, and safe file names.
 */
import type { CommandController } from '../controller/commands';
import type { Diver } from '../persistence/family';
import type { SaveIndicator } from '../persistence/save-status';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { IconName } from '../ui/icons';
import type { UiKit } from '../ui/kit';

export function topBar(options: {
  readonly back?: { readonly label: string; onPress(): void | Promise<void>; testId?: string };
  readonly title?: HTMLElement;
  readonly tools?: readonly Node[];
  readonly onError: (error: unknown) => void;
}): HTMLElement {
  const bar = h('header', { className: 'ps-topbar' });
  if (options.back) {
    bar.append(
      candyButton({
        label: options.back.label,
        icon: 'back',
        variant: 'paper',
        size: 'small',
        testId: options.back.testId ?? 'back',
        onPress: options.back.onPress,
        onError: options.onError,
      }),
    );
  }
  bar.append(h('div', { className: 'ps-topbar__title' }, options.title ?? null));
  bar.append(h('div', { className: 'ps-topbar__tools' }, ...(options.tools ?? [])));
  return bar;
}

const SAVE_ICONS: Partial<Record<SaveIndicator['kind'], IconName>> = {
  saved: 'check',
  failed: 'warning',
  conflict: 'warning',
  unavailable: 'warning',
};

/** What the save status pill needs from a child's open game. */
export interface SaveStatusSource {
  subscribeIndicator(listener: (indicator: SaveIndicator) => void): () => void;
}

/**
 * The visible save status of a child's game: "Uloženo" only for acknowledged writes,
 * "Neuloženo" with Retry (the exact failed write, never the action again), or a reopen when
 * another window wrote first.
 */
export function createSaveStatus(
  kit: UiKit,
  game: SaveStatusSource,
  commands: Pick<CommandController<unknown>, 'retry'>,
  reopen: () => Promise<void>,
): { readonly element: HTMLElement; dispose(): void } {
  const t = kit.t;
  const element = h('div', {
    className: 'ps-save',
    testId: 'save-status',
    dataset: { state: 'none' },
  });
  let previous: SaveIndicator['kind'] = 'none';
  const render = (indicator: SaveIndicator): void => {
    element.dataset['state'] = indicator.kind;
    const glyph = SAVE_ICONS[indicator.kind];
    const children: Node[] = [];
    if (indicator.kind === 'saving') {
      children.push(
        h(
          'span',
          { className: 'ps-save__dots', attributes: { 'aria-hidden': 'true' } },
          h('i'),
          h('i'),
          h('i'),
        ),
      );
    } else if (glyph) {
      children.push(icon(glyph));
    }
    const label =
      indicator.kind === 'saved'
        ? t('save.saved')
        : indicator.kind === 'saving'
          ? t('save.saving')
          : indicator.kind === 'failed'
            ? t('save.failed')
            : indicator.kind === 'conflict'
              ? t('save.conflict')
              : indicator.kind === 'unavailable'
                ? t('save.unavailable')
                : '';
    children.push(h('span', { text: label }));
    if (indicator.kind === 'failed') {
      children.push(
        candyButton({
          label: t('save.retry'),
          icon: 'retry',
          variant: 'coral',
          size: 'small',
          testId: 'save-retry',
          onPress: () => commands.retry(),
          onError: kit.onError,
        }),
      );
    }
    if (indicator.kind === 'conflict') {
      children.push(
        candyButton({
          label: t('save.reopen'),
          icon: 'retry',
          variant: 'coral',
          size: 'small',
          testId: 'save-reopen',
          onPress: reopen,
          onError: kit.onError,
        }),
      );
    }
    element.replaceChildren(...children);
    const trouble = ['failed', 'conflict', 'unavailable'];
    if (trouble.includes(indicator.kind) && !trouble.includes(previous)) {
      kit.announcer.announce(label, 'assertive');
    }
    previous = indicator.kind;
  };
  const unsubscribe = game.subscribeIndicator(render);
  return { element, dispose: unsubscribe };
}

/**
 * A child's name with a round initial. S5's painted diver pictures take the initial's place with
 * the profile screens.
 */
export function diverBadge(diver: Diver): HTMLElement {
  const initial = [...diver.name][0] ?? '?';
  return h(
    'span',
    { className: 'ps-diver-badge', dataset: { avatar: diver.avatar } },
    h('span', {
      className: 'ps-diver-badge__initial',
      text: initial,
      attributes: { 'aria-hidden': 'true' },
    }),
    h('span', { className: 'ps-diver-badge__name', text: diver.name }),
  );
}

/** Offer `text` as a file download without putting a link into the page. */
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for one local file and read it as text (bounded by `maxBytes`). Call from a tap. */
export function pickTextFile(maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.className = 'ps-visually-hidden';
    input.tabIndex = -1;
    const done = (): void => input.remove();
    input.addEventListener('change', () => {
      done();
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > maxBytes) {
        reject(new RangeError('The file is too large.'));
        return;
      }
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => {
      done();
      resolve(null);
    });
    document.body.append(input);
    input.click();
  });
}

/** A file-name-safe form of a name: "Šárka Nová" is `sarka-nova`. */
export function fileSlug(name: string, fallback = 'potapec'): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}
