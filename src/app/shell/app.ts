/**
 * The application shell: the persistent chrome around screens (live regions, toasts, dialog
 * host, effects layer), the shared services, the active child's game session, and the error
 * boundary that turns any failure into a calm screen instead of console noise.
 *
 * Children see Czech, addressed as the child playing (`setAddress`); the grown-ups' area speaks
 * the language the family chose (`grownUps()`). Presentation preferences (text size, less
 * motion, volumes) are applied to the whole page.
 *
 * One child plays at a time. Opening a child (`openDiver`) loads their preferences, day record
 * and game session, addresses the messages to them, applies their presentation preferences,
 * binds the visibility pause, routes live commit events to sounds and keeps them briefly for the
 * screens that celebrate them. Closing undoes all of it. Without rules and content (`useContent`
 * at boot) no child's game opens.
 */
import { IndexedDbSaveStorage } from '@aegis/browser/indexeddb';
import type { SaveStorage } from '@aegis/browser/save';
import {
  applyPresentationPreferences,
  bindVisibilityPause,
  CHILD_SAFE_PRESET,
} from '@aegis/browser/ui';
import type { ArtLibrary } from '../art/library';
import { createGameAudio } from '../audio/game-audio';
import type { GameAudio } from '../audio/game-audio';
import { eventCueContext } from '../audio/sound-map';
import type { AudioMap } from '../audio/sound-map';
import { createContentText, createGrownUpContentText } from '../content/text';
import type { ContentCatalogs, ContentText } from '../content/text';
import {
  CommandRejectedError,
  createCommandController,
  StaleCommandError,
} from '../controller/commands';
import type { CommandController, Dispatch } from '../controller/commands';
import type { PearlSeaGame, PearlSeaSession } from '../game/definition';
import { createPlayClock } from '../game/timer';
import type { PlayClock } from '../game/timer';
import { createOfflineInstaller } from '../grownups/offline';
import type { OfflineInstaller } from '../grownups/offline';
import { createGrownUpTranslator, createTranslator, CS_UI, hasMessage } from '../i18n/messages';
import type { GrownUpTranslate, Language } from '../i18n/messages';
import { DayStore } from '../persistence/day';
import { findDiver } from '../persistence/family';
import type { Diver } from '../persistence/family';
import { openGameSession } from '../persistence/game-session';
import { DEFAULT_PREFERENCES } from '../persistence/preferences';
import type { ChildPreferences } from '../persistence/preferences';
import { gameRecords } from '../persistence/profile-data';
import type { ProfileData } from '../persistence/profile-data';
import { RecoveryRequired } from '../persistence/recovery';
import { FamilyStore, PreferencesStore } from '../persistence/stores';
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
import { profileSeed, SAVE_DATABASE } from '../../rules/contract';
import type { FormOfAddress, GameAction, GameEvent } from '../../rules/contract';

/** Shown when nothing else can be: the catalog may be what failed, so these are built in. */
export const STARTUP_FAILURE = {
  heading: 'Hra se nespustila',
  body: 'Zkus to prosím znovu. Když to nepůjde, zavolej dospělého.',
  retry: 'Zkusit znovu',
} as const;

/** Live events kept for screens; older ones fall off (they only drive one-shot celebrations). */
const MAX_INBOX = 64;

/**
 * Events whose sounds belong to a celebration screen, which cues them in time with its picture
 * (the hatch fanfare lands when the egg cracks, the victory sting when the ink washes off),
 * instead of when the answer is committed.
 */
const CELEBRATION_SOUNDS: ReadonlySet<string> = new Set([
  'friend.hatched',
  'monster.freed',
  'grade.completed',
]);

/** The router key of a child's play screen. */
export function playKey(diverId: string): string {
  return `play:${diverId}`;
}

export interface AppEnvironment {
  /** Deployment base path, e.g. `/pearl-sea/`. */
  readonly base: string;
  /** Absolute base URL. */
  readonly baseUrl: string;
  /** The offline revision this build pins. */
  readonly revision: string;
}

/**
 * Live game events since a screen last took them, oldest first. Events are one-shots: a restore
 * empties the inbox, and screens rebuild from the view.
 */
export interface EventInbox {
  take(types?: readonly string[]): GameEvent[];
}

export interface ActiveDiver {
  readonly diver: Diver;
  readonly game: PearlSeaSession;
  readonly commands: CommandController<GameAction>;
  readonly preferences: PreferencesStore;
  /** How the child's day began, for the diary card at goodbye. */
  readonly day: DayStore;
  readonly events: EventInbox;
  /** Time played in this page (hidden time excluded), for the grown-ups' time limit. */
  readonly clock: PlayClock;
  /** True once the child's time limit (if any) is used up. */
  timeIsUp(): boolean;
}

/** The game and its strings, set once at boot (`useContent`). */
export interface GameContent {
  readonly game: PearlSeaGame;
  readonly catalogs: ContentCatalogs;
  /** Content strings for the child, addressed to the child playing. */
  readonly text: ContentText;
}

export type GrownUpsTab = 'settings' | 'progress' | 'data' | 'offline' | 'about';
export const GROWN_UPS_TABS: readonly GrownUpsTab[] = [
  'settings',
  'progress',
  'data',
  'offline',
  'about',
];

export interface Screens {
  title(): ScreenEntry;
  /** The children on this device: choose who plays, or add one. */
  divers(): ScreenEntry;
  /** The editor of a new child (`null`) or of a child on this device. */
  editor(diverId: string | null): ScreenEntry;
  /** The game: whatever the view requires now (story, round, results), else the grotto. */
  play(diverId: string): ScreenEntry;
  /** The sea map: the shallows or the deep, with the regions. */
  map(diverId: string): ScreenEntry;
  /** A region's scene with its level nodes. */
  region(diverId: string, regionId: string): ScreenEntry;
  /** A level's intro. */
  level(diverId: string, levelId: string): ScreenEntry;
  /** U Mrože, the shop. */
  shop(diverId: string): ScreenEntry;
  /** The sea friends, the wardrobe and the grotto's decorations. */
  friends(diverId: string): ScreenEntry;
  /** The friends' gallery of freed monsters. */
  gallery(diverId: string): ScreenEntry;
  album(diverId: string): ScreenEntry;
  /** The Great Shell (Velká lastura). */
  shell(diverId: string): ScreenEntry;
  /** Goodbye, with the diary card of the child's day. */
  goodbye(diverId: string): ScreenEntry;
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
  /** S5's art by art ID (placeholders for what is not published yet). */
  readonly art: ArtLibrary;
  /** Backups and erasing of a child's stored records. */
  readonly profiles: ProfileData;
  screens: Screens;
  /** The game and its content strings, or null while the shell has no rules or content. */
  content(): GameContent | null;
  useContent(game: PearlSeaGame, catalogs: ContentCatalogs): void;
  /** Content strings for the grown-ups' area, in its language. */
  grownUpText(language?: Language): ContentText;
  active(): ActiveDiver | null;
  /** Open a child's game (closing any other); throws `RecoveryRequired`. */
  openDiver(diverId: string): Promise<ActiveDiver>;
  closeDiver(): Promise<void>;
  /**
   * A child's game for the grown-ups' area, without making the child the one playing: the open
   * game when it is that child's, else the save opened for `use` and closed after it. No session
   * starts, no play time counts and the page keeps its presentation. Calls take turns, and a
   * child opened for play waits for them.
   */
  withGame<T>(
    diverId: string,
    use: (game: PearlSeaSession, dispatch: Dispatch<GameAction>) => Promise<T>,
  ): Promise<T>;
  /** Show what the game needs next: back to the child's play screen, rebuilt from the view. */
  continueGame(diverId: string): Promise<void>;
  /** The grown-ups' messages, in the language the family chose for their area. */
  grownUps(language?: Language): GrownUpTranslate;
  /** Address the children's messages to a boy, a girl, or neutrally (nobody playing). */
  setAddress(address: FormOfAddress): void;
  /** Apply a child's presentation preferences, or the defaults with null. */
  applyPresentation(preferences: ChildPreferences | null): void;
  /**
   * Read Czech text aloud with a child's voice settings (the active child's by default), if a
   * local Czech voice exists and read-aloud is on.
   */
  speak(text: string, preferences?: ChildPreferences): boolean;
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
  readonly art: ArtLibrary;
  readonly storage?: SaveStorage;
}

export function createApp(options: AppOptions): App {
  const { env, root, bootStatus } = options;
  let address: FormOfAddress = 'neutral';
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

  let content: GameContent | null = null;
  const requireContent = (): GameContent => {
    if (!content) throw new Error('The game content is not loaded.');
    return content;
  };

  type OpenDiver = ActiveDiver & { release(): Promise<void> };
  const clocks = new Map<string, PlayClock>();
  let active: OpenDiver | null = null;
  let opening: Promise<OpenDiver> | null = null;

  const closeDiver = async (): Promise<void> => {
    const closing = active;
    active = null;
    if (!closing) return;
    await closing.release();
    address = 'neutral';
    applyPresentation(null);
  };

  const openDiver = async (diverId: string): Promise<ActiveDiver> => {
    // A save the grown-ups' area has open is closed before the child plays on it.
    await borrowing;
    if (active?.diver.id === diverId) return active;
    if (opening) await opening.catch(() => undefined);
    if (active?.diver.id === diverId) return active;
    await closeDiver();
    const diver = findDiver(family.state(), diverId);
    if (!diver) throw new Error('That child is not on this device.');
    // A child's game starts clean: what the grown-ups' area or another child was told stays there.
    app.kit.toasts.clear();
    const task = (async (): Promise<OpenDiver> => {
      const preferences = new PreferencesStore(storage, diver.id);
      await preferences.open();
      const day = new DayStore(storage, diver.id);
      await day.open();
      const game = await openGameSession(storage, requireContent().game, {
        id: diver.id,
        seed: profileSeed(diver.id),
      });
      const commands = createCommandController(
        game.host,
        (error) => app.reportError(error),
        (listener) => game.subscribe((change) => listener(change.reason)),
      );
      // One clock per child and page, so closing and reopening a child keeps counting.
      const clock = clocks.get(diver.id) ?? createPlayClock();
      clocks.set(diver.id, clock);
      clock.resume();
      const unbindVisibility = bindVisibilityPause(
        document,
        (reason) => {
          game.host.pause(reason);
          clock.pause();
          audio.pause();
          stopSpeech();
        },
        (reason) => {
          audio.resume();
          clock.resume();
          void commands.resume(reason).catch((error) => app.reportError(error));
        },
      );
      const inbox: GameEvent[] = [];
      const events: EventInbox = {
        take(types) {
          const wanted = (event: GameEvent): boolean => !types || types.includes(event.type);
          const taken = inbox.filter(wanted);
          for (let index = inbox.length - 1; index >= 0; index--) {
            if (wanted(inbox[index]!)) inbox.splice(index, 1);
          }
          return taken;
        },
      };
      // Everything the shell does with a commit hangs off the session's one host listener.
      const unsubscribeChanges = game.subscribe((change) => {
        if (change.reason === 'restore') {
          audio.clear();
          stopSpeech();
          inbox.length = 0;
          // The play screen shows what the restored game needs, never what it showed before.
          if (router.currentKey() === playKey(diver.id)) void router.refresh();
          return;
        }
        // A new round starts a new results story: what came before it (the first egg chosen in
        // the story, an earlier round's sticker) is not celebrated again at this round's end.
        if (change.events.some((event) => event.type === 'round.started')) inbox.length = 0;
        for (const event of change.events) {
          if (!CELEBRATION_SOUNDS.has(event.type))
            audio.cue(event.type, eventCueContext(event.data));
          inbox.push(event as unknown as GameEvent);
          if (inbox.length > MAX_INBOX) inbox.shift();
        }
      });
      const unsubscribePreferences = preferences.subscribe((value) => applyPresentation(value));
      address = diver.address;
      applyPresentation(preferences.current());
      return {
        diver,
        game,
        commands,
        preferences,
        day,
        events,
        clock,
        timeIsUp() {
          const limit = preferences.current().timeLimit;
          return limit !== null && clock.elapsed() >= limit * 60_000;
        },
        async release() {
          clock.pause();
          unsubscribePreferences();
          unsubscribeChanges();
          unbindVisibility();
          commands.dispose();
          audio.clear();
          stopSpeech();
          await game.close();
        },
      };
    })();
    opening = task;
    try {
      const opened = await task;
      active = opened;
      return opened;
    } finally {
      if (opening === task) opening = null;
    }
  };

  let borrowing: Promise<unknown> = Promise.resolve();
  const withGame = <T>(
    diverId: string,
    use: (game: PearlSeaSession, dispatch: Dispatch<GameAction>) => Promise<T>,
  ): Promise<T> => {
    const run = borrowing.then(async (): Promise<T> => {
      if (opening) await opening.catch(() => undefined);
      if (active?.diver.id === diverId) return use(active.game, active.commands.capture());
      const diver = findDiver(family.state(), diverId);
      if (!diver) throw new Error('That child is not on this device.');
      const game = await openGameSession(storage, requireContent().game, {
        id: diver.id,
        seed: profileSeed(diver.id),
      });
      const commands = createCommandController(
        game.host,
        (error) => app.reportError(error),
        (listener) => game.subscribe((change) => listener(change.reason)),
      );
      try {
        return await use(game, commands.capture());
      } finally {
        commands.dispose();
        await game.close();
      }
    });
    borrowing = run.catch(() => undefined);
    return run;
  };

  const reportError = (error: unknown): void => {
    if (error instanceof RecoveryRequired) {
      void closeDiver()
        .catch(() => undefined)
        .then(() => router.reset(app.screens.recovery(error)));
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
    void closeDiver()
      .catch(() => undefined)
      .then(() => router.reset(app.screens.error(error)));
  };

  const grownUpTexts = new Map<Language, ContentText>();
  const app: App = {
    env,
    kit,
    router,
    storage,
    family,
    audio,
    speech,
    offline,
    art: options.art,
    get profiles(): ProfileData {
      return {
        storage,
        games: content ? gameRecords(content.game) : null,
        closeIfOpen: async (profileId) => {
          if (active?.diver.id === profileId) await closeDiver();
        },
      };
    },
    screens: undefined as unknown as Screens,
    content: () => content,
    useContent(game, catalogs) {
      content = { game, catalogs, text: createContentText(catalogs, () => address) };
      grownUpTexts.clear();
    },
    grownUpText(language) {
      const chosen = language ?? family.state().grownUpsLanguage;
      let text = grownUpTexts.get(chosen);
      if (!text) {
        text = createGrownUpContentText(requireContent().catalogs, chosen);
        grownUpTexts.set(chosen, text);
      }
      return text;
    },
    active: () => active,
    openDiver,
    closeDiver,
    withGame,
    async continueGame(diverId) {
      if (!(await router.backTo(playKey(diverId)))) await router.push(app.screens.play(diverId));
    },
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
      const current = preferences ?? active?.preferences.current();
      if (!current?.readAloud || !speech.available()) return false;
      const own = ++utterance;
      const started = speech.speak(text, {
        voice: current.voice,
        volume: current.presentation.volumes.narration,
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
