/**
 * The application shell: the persistent chrome around screens (live regions, toasts, dialog
 * host, effects layer), the shared services, and the error boundary that turns any failure into
 * a calm screen instead of console noise.
 *
 * Children see Czech, addressed as the child playing (`setAddress`); the grown-ups' area speaks
 * the language the family chose (`grownUps()`). Presentation preferences (text size, less
 * motion, volumes) are applied to the whole page. The game screens add the active child's game
 * session on top of this shell (docs/app.md §16).
 */
import { IndexedDbSaveStorage } from '@aegis/browser/indexeddb';
import type { SaveStorage } from '@aegis/browser/save';
import { applyPresentationPreferences, CHILD_SAFE_PRESET } from '@aegis/browser/ui';
import { createGameAudio } from '../audio/game-audio';
import type { GameAudio } from '../audio/game-audio';
import type { AudioMap } from '../audio/sound-map';
import { CommandRejectedError, StaleCommandError } from '../controller/commands';
import { createOfflineInstaller } from '../grownups/offline';
import type { OfflineInstaller } from '../grownups/offline';
import { createGrownUpTranslator, createTranslator, CS_UI, hasMessage } from '../i18n/messages';
import type { Address, GrownUpTranslate, Language } from '../i18n/messages';
import { DEFAULT_PREFERENCES } from '../persistence/preferences';
import type { ChildPreferences } from '../persistence/preferences';
import type { ProfileData } from '../persistence/profile-data';
import { RecoveryRequired } from '../persistence/recovery';
import { FamilyStore } from '../persistence/stores';
import { createRouter } from '../router/router';
import type { Router, ScreenEntry } from '../router/router';
import type { PrintRequest } from '../screens/print';
import { speechAliases } from '../speech/aliases';
import { createReadAloud } from '../speech/read-aloud';
import type { ReadAloud } from '../speech/read-aloud';
import { createAnnouncer } from '../ui/announcer';
import { h } from '../ui/dom';
import { createKeyboard } from '../ui/keyboard';
import type { UiKit } from '../ui/kit';
import { createToaster } from '../ui/toast';
import { SAVE_DATABASE } from '../../rules/contract';

/** Shown when nothing else can be: the catalog may be what failed, so these are built in. */
export const STARTUP_FAILURE = {
  heading: 'Hra se nespustila',
  body: 'Zkus to prosím znovu. Když to nepůjde, zavolej dospělého.',
  retry: 'Zkusit znovu',
} as const;

export interface AppEnvironment {
  /** Deployment base path, e.g. `/pearl-sea/`. */
  readonly base: string;
  /** Absolute base URL. */
  readonly baseUrl: string;
  /** The offline revision this build pins. */
  readonly revision: string;
}

export type GrownUpsTab = 'settings' | 'data' | 'offline' | 'about';
export const GROWN_UPS_TABS: readonly GrownUpsTab[] = ['settings', 'data', 'offline', 'about'];

export interface Screens {
  title(): ScreenEntry;
  /** The grown-ups' area, behind the gate. */
  grownUps(tab?: GrownUpsTab, diverId?: string): ScreenEntry;
  /** The print preview of a printable from the grown-ups' area. */
  print(request: PrintRequest): ScreenEntry;
  recovery(problem: RecoveryRequired): ScreenEntry;
  error(error: unknown): ScreenEntry;
}

export interface App {
  readonly env: AppEnvironment;
  readonly kit: UiKit;
  readonly router: Router;
  readonly storage: SaveStorage;
  readonly family: FamilyStore;
  readonly audio: GameAudio;
  readonly speech: ReadAloud;
  readonly offline: OfflineInstaller;
  /** Backups and erasing of a child's stored records. */
  readonly profiles: ProfileData;
  screens: Screens;
  /** The grown-ups' messages, in the language the family chose for their area. */
  grownUps(language?: Language): GrownUpTranslate;
  /** Address the children's messages to a boy, a girl, or neutrally (nobody playing). */
  setAddress(address: Address): void;
  /** Apply a child's presentation preferences, or the defaults with null. */
  applyPresentation(preferences: ChildPreferences | null): void;
  /** Read Czech text aloud with a child's voice settings, if a local Czech voice exists. */
  speak(text: string, preferences: ChildPreferences): boolean;
  /** Stop reading aloud (and bring the music back up). */
  stopSpeaking(): void;
  reportError(error: unknown): void;
  /** Mark the boot status element (tests rely on it). */
  setBootState(state: 'loading' | 'ready' | 'failed'): void;
}

export interface AppOptions {
  readonly env: AppEnvironment;
  readonly root: HTMLElement;
  /** The hidden readiness signal for tests and tools (`data-state`, `data-screen`). */
  readonly bootStatus: HTMLElement;
  readonly audioMap: AudioMap;
  readonly storage?: SaveStorage;
}

export function createApp(options: AppOptions): App {
  const { env, root, bootStatus } = options;
  let address: Address = 'neutral';
  const t = createTranslator({ address: () => address });
  const announcer = createAnnouncer();
  const toasts = createToaster(announcer);
  const keyboard = createKeyboard(document);
  const stage = h('div', { className: 'ps-stage', testId: 'stage' });
  const fx = h('div', { className: 'ps-fx-layer', attributes: { 'aria-hidden': 'true' } });
  const dialogs = h('div', { className: 'ps-dialogs' });
  // The static splash stays on stage until the first screen replaces it.
  const splash = root.querySelector('.ps-splash');
  if (splash) stage.append(splash);
  root.replaceChildren(stage, toasts.element, fx, dialogs, announcer.element);

  const audio = createGameAudio({ baseUrl: env.baseUrl, map: options.audioMap });
  const speech = createReadAloud(undefined, speechAliases(CS_UI));
  const storage = options.storage ?? new IndexedDbSaveStorage(SAVE_DATABASE);
  const family = new FamilyStore(storage);
  const offline = createOfflineInstaller({ baseUrl: env.baseUrl, revision: env.revision });
  const grownUpTranslators = new Map<Language, GrownUpTranslate>();

  const kit: UiKit = {
    t,
    keyboard,
    announcer,
    toasts,
    fx,
    dialogs,
    baseUrl: env.baseUrl,
    cue: (event, context) => audio.cue(event, context),
    onError: (error) => app.reportError(error),
  };

  // Music is lowered while the device reads aloud; the token ignores the end of a replaced line.
  let utterance = 0;
  const stopSpeech = (): void => {
    utterance += 1;
    speech.cancel();
    audio.duck(false);
  };

  const router = createRouter({
    stage,
    kit,
    appName: t('app.title'),
    lastResort: { heading: STARTUP_FAILURE.heading, body: STARTUP_FAILURE.body },
    onLeave() {
      stopSpeech();
      fx.replaceChildren();
      // Called just before the next screen is inserted: at a new text size the stage is already
      // transparent, with its style flushed, when that screen's first frame is drawn.
      if (rescaled !== null) hideStage();
    },
    onMount(screen, moved) {
      bootStatus.dataset['screen'] = (router.currentKey() ?? '').split(':')[0] ?? '';
      audio.setMusic(screen.music ?? null);
      if (moved) audio.cue('ui.navigate');
      if (rescaled !== null) revealAtScale(screen.element, rescaled);
      rescaled = null;
    },
    fallback: (error) => app.screens.error(error),
  });

  /** A text size the next screen must be drawn at before anyone sees it. */
  let rescaled: number | null = null;
  let revealing = 0;
  /**
   * WebKit can apply the `data-restyling` rule a frame late, the very frame a new screen is drawn
   * at the old size, so the stage is also made transparent inline and its style read back at once.
   * A stage nothing reveals within a moment is shown again whatever happens.
   */
  const hideStage = (): void => {
    const own = ++revealing;
    stage.dataset['restyling'] = 'true';
    stage.style.opacity = '0';
    void getComputedStyle(stage).opacity;
    setTimeout(() => {
      if (own === revealing) showStage();
    }, 600);
  };
  const showStage = (): void => {
    delete stage.dataset['restyling'];
    stage.style.removeProperty('opacity');
  };
  /**
   * After a change of text size the next screen stays transparent until it is styled at the new
   * size: an engine can draw a newly mounted screen against the root's old size for a few frames
   * (WebKit, sometimes Chromium), so a reader at 200 % would see small text flash. The stage is
   * transparent, not hidden, so focus and screen readers are not disturbed; at most 400 ms. A
   * screen already at its size when it is mounted is shown at once.
   */
  const revealAtScale = (element: HTMLElement, scale: number): void => {
    const own = ++revealing;
    const expected = CHILD_SAFE_PRESET.readingPixels * scale;
    const started = performance.now();
    const ready = (): boolean =>
      Math.abs(parseFloat(getComputedStyle(element).fontSize) - expected) < 0.5;
    if (ready()) {
      showStage();
      return;
    }
    stage.dataset['restyling'] = 'true';
    stage.style.opacity = '0';
    const check = (): void => {
      if (own !== revealing) return;
      if (!element.isConnected || ready() || performance.now() - started > 400) {
        showStage();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };

  const applyPresentation = (preferences: ChildPreferences | null): void => {
    const chosen = preferences ?? DEFAULT_PREFERENCES;
    const html = document.documentElement;
    // The page starts at the default size, so opening a child at that size changes nothing.
    const drawn = html.dataset['textScale'] ?? String(DEFAULT_PREFERENCES.presentation.textScale);
    if (drawn !== String(chosen.presentation.textScale)) {
      rescaled = chosen.presentation.textScale;
    }
    // The SDK also sets `lang` from the preferences; the router sets it per screen after this.
    const lang = html.lang;
    applyPresentationPreferences(html, chosen.presentation);
    if (lang) html.lang = lang;
    // The SDK sets only the --aegis-text-scale property, and an engine can keep the root's old
    // font size for a while after that. The root's own font size, set here directly, is restyled
    // at once, so the next screen's very first frame is already at the child's size; the
    // attribute names the scale for styles and tests.
    html.dataset['textScale'] = String(chosen.presentation.textScale);
    html.style.fontSize = `${CHILD_SAFE_PRESET.readingPixels * chosen.presentation.textScale}px`;
    audio.setVolumes(chosen.presentation.volumes);
  };

  const reportError = (error: unknown): void => {
    if (error instanceof RecoveryRequired) {
      void router.reset(app.screens.recovery(error));
      return;
    }
    if (error instanceof StaleCommandError) {
      toasts.show(t('toast.stale'));
      return;
    }
    if (error instanceof CommandRejectedError) {
      if (error.accepted) return;
      const code = error.error.code;
      audio.cue('ui.blocked');
      if (code === 'paused') toasts.show(t('toast.paused'));
      else if (code !== 'checkpoint-blocked' && code !== 'busy') {
        // Rule refusals have child-friendly lines by code; diagnostics never reach the screen.
        const key = `error.${code}`;
        toasts.show(hasMessage(key) ? t(key) : t('toast.failed'), { tone: 'warning' });
      }
      return;
    }
    void router.reset(app.screens.error(error));
  };

  const app: App = {
    env,
    kit,
    router,
    storage,
    family,
    audio,
    speech,
    offline,
    profiles: { storage, games: null, closeIfOpen: async () => undefined },
    screens: undefined as unknown as Screens,
    grownUps(language) {
      const chosen = language ?? family.state().grownUpsLanguage;
      let translator = grownUpTranslators.get(chosen);
      if (!translator) {
        translator = createGrownUpTranslator(chosen);
        grownUpTranslators.set(chosen, translator);
      }
      return translator;
    },
    setAddress(next) {
      address = next;
    },
    applyPresentation,
    speak(text, preferences) {
      if (!preferences.readAloud || !speech.available()) return false;
      const own = ++utterance;
      const started = speech.speak(text, {
        voice: preferences.voice,
        volume: preferences.presentation.volumes.narration,
        onEnd: () => {
          if (own === utterance) audio.duck(false);
        },
      });
      if (started) audio.duck(true);
      return started;
    },
    stopSpeaking: stopSpeech,
    reportError,
    setBootState(state) {
      bootStatus.dataset['state'] = state;
      if (state === 'ready') root.removeAttribute('aria-busy');
    },
  };

  // The first trusted gesture anywhere unlocks audio.
  const unlock = (): void => {
    if (audio.status() === 'locked' || audio.status() === 'blocked') audio.unlock();
  };
  root.addEventListener('pointerdown', unlock, { capture: true });
  root.addEventListener('keydown', unlock, { capture: true });

  window.addEventListener('error', (event) => {
    event.preventDefault();
    reportError(event.error ?? new Error('Uncaught page error'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    reportError(event.reason);
  });

  return app;
}
