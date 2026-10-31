/**
 * Chunky buttons over the SDK's `createActionButton`: native click is the only activation path
 * (pointer, Enter and Space alike), and a press cannot run twice while its command is busy.
 */
import { createActionButton } from '@aegis/browser/ui';
import { h } from './dom';
import { icon } from './icons';
import type { IconName } from './icons';

export type ButtonVariant = 'primary' | 'sun' | 'paper' | 'coral' | 'accent';
export type ButtonSize = 'normal' | 'big' | 'small';

export interface ButtonOptions {
  label: string;
  onPress(): void | Promise<void>;
  onError(error: unknown): void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Show only the icon; the label stays as the accessible name. */
  iconOnly?: boolean;
  /**
   * A tool beside an answer (Read aloud, Show me): pressing it with a pointer leaves keyboard
   * focus where it was, so Enter still sends the answer being typed.
   */
  keepsFocus?: boolean;
  testId?: string;
}

export function candyButton(options: ButtonOptions): HTMLButtonElement {
  const button = createActionButton({
    document,
    label: options.label,
    command: options.onPress,
    onError: options.onError,
  });
  const classes = ['ps-button'];
  if (options.variant && options.variant !== 'primary') {
    classes.push(`ps-button--${options.variant}`);
  }
  if (options.size && options.size !== 'normal') classes.push(`ps-button--${options.size}`);
  if (options.iconOnly) classes.push('ps-button--icon');
  button.className = classes.join(' ');
  if (options.icon) {
    button.replaceChildren(
      icon(options.icon),
      h('span', {
        className: options.iconOnly ? 'ps-visually-hidden' : '',
        text: options.label,
      }),
    );
  } else {
    button.replaceChildren(h('span', { text: options.label }));
  }
  if (options.testId) button.dataset['testid'] = options.testId;
  if (options.keepsFocus) button.addEventListener('mousedown', (event) => event.preventDefault());
  return button;
}

/** A quiet text action for secondary grown-up choices. */
export function linkButton(options: Omit<ButtonOptions, 'variant' | 'size'>): HTMLButtonElement {
  const button = createActionButton({
    document,
    label: options.label,
    command: options.onPress,
    onError: options.onError,
  });
  button.className = 'ps-link-button';
  if (options.icon) button.replaceChildren(icon(options.icon), h('span', { text: options.label }));
  if (options.testId) button.dataset['testid'] = options.testId;
  return button;
}
