/**
 * The services every screen and component shares, created once by the app shell.
 */
import type { CueContext } from '../audio/sound-map';
import type { Translate } from '../i18n/messages';
import type { Announcer } from './announcer';
import type { Keyboard } from './keyboard';
import type { Toaster } from './toast';

export interface UiKit {
  /** Czech, for children: it addresses the child playing now (i18n/messages.ts). */
  readonly t: Translate;
  readonly keyboard: Keyboard;
  readonly announcer: Announcer;
  readonly toasts: Toaster;
  /** Fixed overlay for flying coins, bubbles and confetti. */
  readonly fx: HTMLElement;
  /** Where dialogs are mounted (outside the replaceable screen). */
  readonly dialogs: HTMLElement;
  /** The deployment base, for child-safe link checks and asset URLs. */
  readonly baseUrl: string;
  /** Play the sound mapped to a UI or game event; silent when audio is unavailable. */
  cue(event: string, context?: CueContext): void;
  /** Report an unexpected failure from an event handler or a button. */
  onError(error: unknown): void;
}
