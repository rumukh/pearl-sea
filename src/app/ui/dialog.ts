/**
 * Modal dialogs on the native <dialog> element, opened through the SDK's `openDialog` (modal
 * focus, focus restore on close). While a dialog is open, its keyboard layer blocks the screen
 * underneath; Escape cancels with the dialog's dismiss value. A dialog for grown-ups carries the
 * language of the grown-ups' area (`lang`), so a screen reader pronounces it right.
 */
import { assertChildSafeView, openDialog } from '@aegis/browser/ui';
import { h } from './dom';
import { candyButton } from './button';
import type { ButtonVariant } from './button';
import type { UiKit } from './kit';

export interface DialogHandle<T> {
  readonly element: HTMLDialogElement;
  readonly result: Promise<T>;
  close(value: T): void;
}

export interface ModalOptions<T> {
  /** Accessible name of the dialog; also its visible heading unless `heading` is false. */
  label: string;
  heading?: boolean;
  tone?: 'default' | 'warning';
  testId?: string;
  /** The dialog's language when it differs from the page's (`en` in an English grown-ups' area). */
  lang?: string;
  dismissValue: T;
  build(body: HTMLElement, close: (value: T) => void): void;
  /** The element to focus first; defaults to the first button in the dialog. */
  initialFocus?(): HTMLElement | null;
}

export function openModal<T>(kit: UiKit, options: ModalOptions<T>): DialogHandle<T> {
  const dialog = h('dialog', {
    className: 'ps-dialog',
    testId: options.testId ?? 'dialog',
    dataset: { tone: options.tone ?? 'default' },
    attributes: {
      'aria-label': options.label,
      ...(options.lang ? { lang: options.lang } : {}),
    },
  });
  const body = h('div', { className: 'ps-dialog__body' });
  if (options.heading !== false) body.append(h('h2', { text: options.label }));
  let settle: (value: T) => void = () => undefined;
  const result = new Promise<T>((resolve) => {
    settle = resolve;
  });
  let done = false;
  const releaseKeys = kit.keyboard.push(() => 'block');
  const finish = (value: T): void => {
    if (done) return;
    done = true;
    releaseKeys();
    if (dialog.open) dialog.close();
    dialog.remove();
    settle(value);
  };
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(options.dismissValue);
  });
  dialog.addEventListener('close', () => finish(options.dismissValue));
  options.build(body, finish);
  dialog.append(body);
  assertChildSafeView(dialog, kit.baseUrl);
  kit.dialogs.append(dialog);
  const initial = options.initialFocus?.() ?? dialog.querySelector<HTMLElement>('button');
  openDialog(dialog, initial ?? undefined);
  return { element: dialog, result, close: finish };
}

export interface ConfirmOptions {
  heading: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ButtonVariant;
  tone?: 'default' | 'warning';
  testId?: string;
  lang?: string;
}

/** A yes/no question; resolves true only for the confirming button. */
export function confirmDialog(kit: UiKit, options: ConfirmOptions): Promise<boolean> {
  return openModal(kit, {
    label: options.heading,
    tone: options.tone ?? 'default',
    testId: options.testId ?? 'confirm-dialog',
    ...(options.lang ? { lang: options.lang } : {}),
    dismissValue: false,
    build(body, close) {
      const cancel = candyButton({
        label: options.cancelLabel,
        variant: 'paper',
        onPress: () => close(false),
        onError: kit.onError,
        testId: 'confirm-cancel',
      });
      const confirm = candyButton({
        label: options.confirmLabel,
        variant: options.confirmVariant ?? 'coral',
        onPress: () => close(true),
        onError: kit.onError,
        testId: 'confirm-ok',
      });
      body.append(
        h('p', { text: options.body }),
        h('div', { className: 'ps-dialog__actions' }, cancel, confirm),
      );
    },
    initialFocus: () => null,
  }).result;
}
