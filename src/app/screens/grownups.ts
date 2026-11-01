/**
 * The grown-ups' area, behind the gate, in Czech or English (the family's choice): the language
 * switch, reading aloud and each child's settings (the game's grade, daily goal, dolphin race and
 * the placement check again; read-aloud, voice, volumes, text size, less motion, time limit), each
 * child's progress with printable flashcards and diplomas (grownups/progress.ts), backups and
 * erasing, storage persistence, offline installation and updates, and what the game does and does
 * not do.
 *
 * It is an operating surface: calm, plain and complete. Nothing here plays sounds, and no
 * child's game is played while it is shown: a child's save is only read or changed in passing
 * (`App.withGame`), which starts no session and counts no play time.
 */
import { assertChildSafeView } from '@aegis/browser/ui';
import { CommandRejectedError } from '../controller/commands';
import type { Dispatch } from '../controller/commands';
import { requestGrade } from '../game/grade';
import type { GradeRefusal } from '../game/grade';
import { shortRevision } from '../grownups/about';
import type { OfflineState } from '../grownups/offline';
import { progressSections } from '../grownups/progress';
import { LANGUAGES } from '../i18n/messages';
import type { GrownUpKey, GrownUpTranslate } from '../i18n/messages';
import { BACKUP_MAX_BYTES, readBackup } from '../persistence/backup';
import { localDay } from '../persistence/day';
import { findDiver } from '../persistence/family';
import type { Diver } from '../persistence/family';
import { TEXT_SCALES, TIME_LIMITS } from '../persistence/preferences';
import type { PreferencesDraft } from '../persistence/preferences';
import { eraseProgress, exportDiver, importDiver } from '../persistence/profile-data';
import { RecoveryRequired } from '../persistence/recovery';
import { formatBytes, requestPersistence, storageReport } from '../persistence/storage';
import { PreferencesStore } from '../persistence/stores';
import { candyButton, linkButton } from '../ui/button';
import { confirmDialog } from '../ui/dialog';
import { h, replaceKeepingFocus } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import { GROWN_UPS_TABS } from '../shell/app';
import type { App, GrownUpsTab } from '../shell/app';
import { GRADES } from '../../rules/contract';
import type { GameAction, GameView, Grade, SettingChange } from '../../rules/contract';
import { diverBadge, downloadText, fileSlug, pickTextFile, topBar } from './common';

/** Daily goals offered to grown-ups, in right answers (the game's own goal is kept too). */
export const DAILY_GOALS = [10, 20, 30, 40, 50] as const;

export function grownUpsScreen(
  app: App,
  initialTab: GrownUpsTab = 'settings',
  diverId?: string,
): ScreenEntry {
  // Kept by the entry, so coming back from the print preview finds the same tab and child.
  let tab: GrownUpsTab = initialTab;
  let selected: string | undefined = diverId;
  // One store per child while the area lives, so each change to a child's settings takes its
  // turn after the one before, even when the panel was rebuilt in between.
  const preferenceStores = new Map<string, PreferencesStore>();
  const preferencesOf = (id: string): PreferencesStore => {
    const known = preferenceStores.get(id);
    if (known) return known;
    const store = new PreferencesStore(app.storage, id);
    preferenceStores.set(id, store);
    return store;
  };
  return {
    key: 'grownups',
    async build(context) {
      const g: GrownUpTranslate = app.grownUps();
      if (!selected || !findDiver(app.family.state(), selected)) {
        selected = app.family.state().profiles[0]?.id;
      }
      let disposed = false;
      const panel = h('section', { className: 'ps-grownups__panel', testId: 'grownups-panel' });
      const toastSaved = (): void =>
        app.kit.toasts.show(g('grownups.settings.saved'), { tone: 'success', durationMs: 1800 });

      /** A row of toggle buttons, one pressed. */
      const segmented = <T extends string>(
        label: string,
        values: readonly T[],
        current: T,
        text: (value: T) => string,
        testId: (value: T) => string,
        choose: (value: T) => void | Promise<void>,
        lang?: (value: T) => string,
      ): HTMLElement => {
        const group = h('div', {
          className: 'ps-segmented',
          attributes: { role: 'group', 'aria-label': label },
        });
        for (const value of values) {
          const button = h('button', {
            className: 'ps-segment',
            text: text(value),
            testId: testId(value),
            attributes: {
              type: 'button',
              'aria-pressed': String(value === current),
              ...(lang ? { lang: lang(value) } : {}),
            },
          });
          button.addEventListener('click', () => {
            void Promise.resolve(choose(value)).catch(app.kit.onError);
          });
          group.append(button);
        }
        return group;
      };

      const tabBar = h('nav', {
        className: 'ps-grownups__tabs',
        attributes: { 'aria-label': g('grownups.heading') },
      });
      const renderTabs = (): void => {
        replaceKeepingFocus(
          tabBar,
          segmented(
            g('grownups.heading'),
            GROWN_UPS_TABS,
            tab,
            (value) => g(`grownups.tab.${value}`),
            (value) => `grownups-tab-${value}`,
            async (value) => {
              tab = value;
              renderTabs();
              await render();
            },
          ),
        );
      };

      const section = (
        title: string,
        testId: string | null,
        ...children: (Node | null)[]
      ): HTMLElement =>
        h(
          'section',
          { className: 'ps-card ps-grownups__section', ...(testId ? { testId } : {}) },
          h('h2', { text: title }),
          ...children,
        );

      const field = (label: string, control: Node, hint?: string): HTMLElement =>
        h(
          'div',
          { className: 'ps-field' },
          h('span', { className: 'ps-field__label', text: label }),
          control,
          hint ? h('span', { className: 'ps-field__hint', text: hint }) : null,
        );

      const diverPicker = (label: GrownUpKey = 'grownups.settings.for'): HTMLElement | null => {
        const divers = app.family.state().profiles;
        if (divers.length < 2) return null;
        return field(
          g(label),
          segmented(
            g(label),
            divers.map((diver) => diver.id),
            selected ?? '',
            (id) => findDiver(app.family.state(), id)?.name ?? id,
            (id) => `grownups-diver-${id}`,
            async (id) => {
              selected = id;
              await render();
            },
          ),
        );
      };

      // ---- Settings -----------------------------------------------------------------------
      const languageSection = (): HTMLElement =>
        section(
          g('grownups.language.heading'),
          'grownups-language',
          h('p', { text: g('grownups.language.note') }),
          segmented(
            g('grownups.language.label'),
            LANGUAGES,
            g.language,
            (language) => g(`grownups.language.${language}`),
            (language) => `grownups-language-${language}`,
            async (language) => {
              try {
                await app.family.setGrownUpsLanguage(language);
              } catch {
                app.kit.toasts.show(g('grownups.settings.failed'), { tone: 'warning' });
                return;
              }
              await app.router.refresh();
              app.kit.toasts.show(app.grownUps()('grownups.settings.saved'), {
                tone: 'success',
                durationMs: 1800,
              });
            },
            (language) => language,
          ),
        );

      const voiceSection = (): HTMLElement =>
        section(
          g('grownups.voice.heading'),
          'grownups-voice',
          app.speech.available()
            ? h('p', { testId: 'voice-available', text: g('grownups.voice.available') })
            : h('p', { testId: 'voice-none', text: g('grownups.voice.none') }),
          app.speech.available() ? null : h('p', { text: g('grownups.voice.howTo') }),
        );

      // ---- A child's game: grade, daily goal, the dolphin race ------------------------------
      const gameSettings = async (diver: Diver): Promise<HTMLElement | null> => {
        if (!app.content()) return null;
        const settings = await app.withGame(diver.id, async (game) => game.view().settings);
        /** Change the game's settings; the game may keep its grade and say why. */
        const changeGame = async (
          change: (view: GameView, dispatch: Dispatch<GameAction>) => Promise<GradeRefusal | null>,
        ): Promise<void> => {
          try {
            const refused = await app.withGame(diver.id, (game, dispatch) =>
              change(game.view(), dispatch),
            );
            if (refused) {
              app.kit.toasts.show(
                g(
                  refused === 'not-served'
                    ? 'grownups.game.gradeNotServed'
                    : 'grownups.game.gradeBusy',
                ),
                { tone: 'warning' },
              );
            } else {
              toastSaved();
            }
          } catch (error) {
            if (error instanceof RecoveryRequired) {
              app.reportError(error);
              return;
            }
            app.kit.toasts.show(g('grownups.settings.failed'), { tone: 'warning' });
          }
          await render();
        };
        const setting =
          (next: SettingChange) =>
          async (_view: GameView, dispatch: Dispatch<GameAction>): Promise<null> => {
            await dispatch({ type: 'setSetting', setting: next });
            return null;
          };
        const goals = [...new Set([...DAILY_GOALS, settings.dailyGoal])].sort((a, b) => a - b);
        const race = h('input', {
          testId: 'setting-race',
          attributes: { type: 'checkbox', role: 'switch' },
        });
        race.checked = settings.race;
        race.addEventListener('change', () => {
          void changeGame(setting({ key: 'race', value: race.checked })).catch(app.kit.onError);
        });
        return h(
          'div',
          { className: 'ps-stack', testId: 'grownups-game-settings' },
          h('h3', { text: g('grownups.game.heading') }),
          field(
            g('grownups.game.grade'),
            segmented(
              g('grownups.game.grade'),
              GRADES.map(String),
              String(settings.grade),
              (value) => g('grownups.game.gradeValue', { grade: value }),
              (value) => `setting-grade-${value}`,
              (value) =>
                changeGame((view, dispatch) =>
                  requestGrade(view, dispatch, Number(value) as Grade),
                ),
            ),
            g('grownups.game.gradeNote'),
          ),
          field(
            g('grownups.game.dailyGoal'),
            segmented(
              g('grownups.game.dailyGoal'),
              goals.map(String),
              String(settings.dailyGoal),
              (value) => value,
              (value) => `setting-goal-${value}`,
              (value) => changeGame(setting({ key: 'dailyGoal', value: Number(value) })),
            ),
          ),
          h(
            'label',
            { className: 'ps-switch' },
            h('span', { text: g('grownups.game.race') }),
            race,
          ),
          placementRerun(diver, settings.grade),
        );
      };

      /**
       * The placement check again (design §5.16), for a grade that has one: it starts the next
       * time the child plays. A round or a story under way keeps it for later.
       */
      const placementRerun = (diver: Diver, grade: Grade): HTMLElement | null => {
        const steps = app.content()?.game.content.data.placement.steps ?? [];
        if (!steps.some((step) => (step.grades as readonly number[]).includes(grade))) return null;
        return field(
          g('grownups.game.placement'),
          candyButton({
            label: g('grownups.game.placementRun'),
            icon: 'retry',
            variant: 'paper',
            size: 'small',
            testId: 'setting-placement',
            onPress: async () => {
              try {
                await app.withGame(diver.id, (_game, dispatch) =>
                  dispatch({ type: 'startActivity', activity: { kind: 'placement' } }),
                );
              } catch (error) {
                if (error instanceof RecoveryRequired) {
                  app.reportError(error);
                  return;
                }
                if (error instanceof CommandRejectedError && !error.accepted) {
                  app.kit.toasts.show(g('grownups.game.placementBusy'), { tone: 'warning' });
                  return;
                }
                throw error;
              }
              app.kit.toasts.show(g('grownups.game.placementStarted'), { tone: 'success' });
            },
            onError: app.kit.onError,
          }),
          g('grownups.game.placementNote'),
        );
      };

      const childSettings = async (diver: Diver): Promise<HTMLElement> => {
        const store = preferencesOf(diver.id);
        try {
          await store.open();
        } catch (error) {
          if (error instanceof RecoveryRequired) app.reportError(error);
          throw error;
        }
        const change = async (edit: (draft: PreferencesDraft) => void): Promise<void> => {
          try {
            await store.change(edit);
            toastSaved();
          } catch {
            app.kit.toasts.show(g('grownups.settings.failed'), { tone: 'warning' });
          }
          await render();
        };
        const prefs = store.current();
        const switchRow = (
          label: string,
          checked: boolean,
          testId: string,
          edit: (draft: PreferencesDraft, value: boolean) => void,
        ): HTMLElement => {
          const input = h('input', { testId, attributes: { type: 'checkbox', role: 'switch' } });
          input.checked = checked;
          input.addEventListener('change', () => {
            const value = input.checked;
            void change((draft) => edit(draft, value)).catch(app.kit.onError);
          });
          return h('label', { className: 'ps-switch' }, h('span', { text: label }), input);
        };
        const volumeRow = (
          label: string,
          value: number,
          testId: string,
          bus: 'music' | 'effects',
        ): HTMLElement => {
          const percent = Math.round(value * 100);
          const input = h('input', {
            className: 'ps-range',
            testId,
            attributes: {
              type: 'range',
              min: '0',
              max: '100',
              step: '10',
              'aria-valuetext': g('grownups.settings.percent', { percent }),
            },
          });
          input.value = String(percent);
          input.addEventListener('change', () => {
            const next = Number(input.value) / 100;
            void change((draft) => {
              draft.presentation = {
                ...draft.presentation,
                volumes: { ...draft.presentation.volumes, [bus]: next },
              };
            }).catch(app.kit.onError);
          });
          return h(
            'label',
            { className: 'ps-field' },
            h(
              'span',
              { className: 'ps-field__label ps-row' },
              h('span', { text: label }),
              h('span', { text: g('grownups.settings.percent', { percent }) }),
            ),
            input,
          );
        };

        let voiceControl: HTMLElement | null = null;
        const voices = app.speech.voices();
        if (app.speech.available()) {
          const selectId = `ps-voice-${diver.id}`;
          const select = h('select', {
            className: 'ps-select',
            testId: 'setting-voice',
            attributes: { id: selectId },
          });
          select.append(
            h('option', {
              text: g('grownups.settings.voiceDefault', { name: voices[0]?.name ?? '' }),
              attributes: { value: '' },
            }),
            ...voices.map((voice) =>
              h('option', {
                text: `${voice.name} (${voice.lang})`,
                attributes: { value: voice.uri },
              }),
            ),
          );
          select.value = prefs.voice ?? '';
          select.addEventListener('change', () => {
            const value = select.value === '' ? null : select.value;
            void change((draft) => {
              draft.voice = value;
            }).catch(app.kit.onError);
          });
          voiceControl = h(
            'div',
            { className: 'ps-field' },
            h('label', {
              className: 'ps-field__label',
              text: g('grownups.settings.voice'),
              attributes: { for: selectId },
            }),
            h(
              'div',
              { className: 'ps-row' },
              select,
              candyButton({
                label: g('grownups.settings.voiceTest'),
                icon: 'speaker',
                variant: 'paper',
                size: 'small',
                testId: 'setting-voice-test',
                onPress: () => {
                  app.speech.speak(app.kit.t('speech.sample'), {
                    voice: store.current().voice,
                    volume: store.current().presentation.volumes.narration,
                  });
                },
                onError: app.kit.onError,
              }),
            ),
          );
        }

        return h(
          'div',
          { className: 'ps-stack', testId: 'grownups-child-settings' },
          diverPicker(),
          h('div', { className: 'ps-grownups__diver' }, diverBadge(diver)),
          await gameSettings(diver),
          switchRow(
            g('grownups.settings.readAloud'),
            prefs.readAloud,
            'setting-read-aloud',
            (draft, value) => {
              draft.readAloud = value;
            },
          ),
          switchRow(
            g('grownups.settings.autoRead'),
            prefs.autoRead,
            'setting-auto-read',
            (draft, value) => {
              draft.autoRead = value;
            },
          ),
          voiceControl,
          volumeRow(
            g('grownups.settings.music'),
            prefs.presentation.volumes.music,
            'setting-music',
            'music',
          ),
          volumeRow(
            g('grownups.settings.effects'),
            prefs.presentation.volumes.effects,
            'setting-effects',
            'effects',
          ),
          field(
            g('grownups.settings.textSize'),
            segmented(
              g('grownups.settings.textSize'),
              TEXT_SCALES.map(String),
              String(prefs.presentation.textScale),
              (value) =>
                g('grownups.settings.percent', { percent: Math.round(Number(value) * 100) }),
              (value) => `setting-text-${Math.round(Number(value) * 100)}`,
              (value) =>
                change((draft) => {
                  draft.presentation = { ...draft.presentation, textScale: Number(value) };
                }),
            ),
          ),
          switchRow(
            g('grownups.settings.reducedMotion'),
            prefs.presentation.reducedMotion,
            'setting-reduced-motion',
            (draft, value) => {
              draft.presentation = { ...draft.presentation, reducedMotion: value };
            },
          ),
          field(
            g('grownups.settings.timeLimit'),
            segmented(
              g('grownups.settings.timeLimit'),
              ['off', ...TIME_LIMITS.map(String)],
              prefs.timeLimit === null ? 'off' : String(prefs.timeLimit),
              (value) =>
                value === 'off'
                  ? g('grownups.settings.timeLimitOff')
                  : g.plural('grownups.settings.minutes', Number(value)),
              (value) => `setting-time-${value}`,
              (value) =>
                change((draft) => {
                  draft.timeLimit = value === 'off' ? null : Number(value);
                }),
            ),
          ),
        );
      };

      const settingsPanel = async (): Promise<HTMLElement> => {
        const diver = selected ? findDiver(app.family.state(), selected) : undefined;
        return h(
          'div',
          { className: 'ps-stack' },
          languageSection(),
          voiceSection(),
          section(
            g('grownups.settings.children'),
            'grownups-children',
            diver
              ? await childSettings(diver)
              : h('p', { testId: 'settings-none', text: g('grownups.settings.none') }),
          ),
        );
      };

      // ---- Progress -----------------------------------------------------------------------
      const progressPanel = async (): Promise<HTMLElement> => {
        const diver = selected ? findDiver(app.family.state(), selected) : undefined;
        if (!diver) {
          return section(
            g('grownups.tab.progress'),
            'grownups-progress',
            h('p', { testId: 'progress-none', text: g('grownups.progress.none') }),
          );
        }
        return h(
          'div',
          { className: 'ps-stack', testId: 'grownups-progress' },
          diverPicker('grownups.progress.for'),
          h('div', { className: 'ps-grownups__diver' }, diverBadge(diver)),
          ...(await progressSections(app, g, diver)),
        );
      };

      // ---- Data ---------------------------------------------------------------------------
      const dataPanel = async (): Promise<HTMLElement> => {
        const divers = app.family.state().profiles;
        const rows = divers.map((diver) =>
          h(
            'li',
            { className: 'ps-grownups__row ps-grownups__row--stack' },
            diverBadge(diver),
            h(
              'span',
              { className: 'ps-row' },
              candyButton({
                label: g('grownups.data.export'),
                icon: 'download',
                variant: 'paper',
                size: 'small',
                testId: `backup-export-${diver.id}`,
                onPress: async () => {
                  try {
                    const text = await exportDiver(app.profiles, diver);
                    downloadText(`pearl-sea-${fileSlug(diver.name)}-${localDay()}.json`, text);
                    app.kit.toasts.show(g('grownups.data.exported', { name: diver.name }), {
                      tone: 'success',
                    });
                  } catch {
                    app.kit.toasts.show(g('grownups.data.exportFailed', { name: diver.name }), {
                      tone: 'warning',
                    });
                  }
                },
                onError: app.kit.onError,
              }),
              candyButton({
                label: g('grownups.data.import'),
                icon: 'upload',
                variant: 'paper',
                size: 'small',
                testId: `backup-import-${diver.id}`,
                onPress: async () => {
                  try {
                    const text = await pickTextFile(BACKUP_MAX_BYTES);
                    if (text === null) return;
                    const backup = readBackup(text);
                    const sure = await confirmDialog(app.kit, {
                      heading: g('grownups.data.importConfirmTitle', { name: diver.name }),
                      body: g('grownups.data.importConfirmBody'),
                      confirmLabel: g('grownups.data.importConfirm'),
                      cancelLabel: g('grownups.common.cancel'),
                      tone: 'warning',
                      lang: g.language,
                    });
                    if (!sure) return;
                    await importDiver(app.profiles, diver, backup);
                    app.kit.toasts.show(g('grownups.data.imported', { name: diver.name }), {
                      tone: 'success',
                    });
                  } catch {
                    app.kit.toasts.show(g('grownups.data.importFailed'), { tone: 'warning' });
                  }
                  await render();
                },
                onError: app.kit.onError,
              }),
              linkButton({
                label: g('grownups.data.reset'),
                icon: 'trash',
                testId: `progress-reset-${diver.id}`,
                onPress: async () => {
                  const sure = await confirmDialog(app.kit, {
                    heading: g('grownups.data.resetTitle', { name: diver.name }),
                    body: g('grownups.data.resetBody'),
                    confirmLabel: g('grownups.data.resetConfirm'),
                    cancelLabel: g('grownups.common.cancel'),
                    tone: 'warning',
                    lang: g.language,
                  });
                  if (!sure) return;
                  try {
                    await eraseProgress(app.profiles, diver.id);
                    app.kit.toasts.show(g('grownups.data.resetDone', { name: diver.name }), {
                      tone: 'success',
                    });
                  } catch {
                    app.kit.toasts.show(g('grownups.data.failed'), { tone: 'warning' });
                  }
                },
                onError: app.kit.onError,
              }),
            ),
          ),
        );
        const report = await storageReport();
        const storageText =
          report.persisted === true
            ? g('grownups.data.persisted')
            : report.persisted === false
              ? g('grownups.data.notPersisted')
              : g('grownups.data.persistUnknown');
        return h(
          'div',
          { className: 'ps-stack' },
          section(
            g('grownups.data.backupHeading'),
            null,
            h('p', { text: g('grownups.data.backupIntro') }),
            divers.length
              ? h('ul', { className: 'ps-grownups__list', testId: 'grownups-data' }, ...rows)
              : h('p', { testId: 'data-none', text: g('grownups.data.none') }),
          ),
          section(
            g('grownups.data.storageHeading'),
            null,
            h('p', {
              testId: 'storage-status',
              text: storageText,
              dataset: { persisted: String(report.persisted) },
            }),
            report.usageBytes !== null
              ? h('p', {
                  className: 'ps-note',
                  text: g('grownups.data.usage', {
                    size: formatBytes(report.usageBytes, g.language),
                  }),
                })
              : null,
            report.persisted === true
              ? null
              : candyButton({
                  label: g('grownups.data.persist'),
                  icon: 'shield',
                  variant: 'paper',
                  size: 'small',
                  testId: 'storage-persist',
                  onPress: async () => {
                    await requestPersistence();
                    await render();
                  },
                  onError: app.kit.onError,
                }),
          ),
        );
      };

      // ---- Offline ------------------------------------------------------------------------
      const OFFLINE_TEXT: Record<
        Exclude<OfflineState['kind'], 'installing' | 'failed'>,
        GrownUpKey
      > = {
        ready: 'grownups.offline.ready',
        missing: 'grownups.offline.missing',
        unavailable: 'grownups.offline.unavailable',
        'up-to-date': 'grownups.offline.upToDate',
        'update-ready': 'grownups.offline.updateReady',
      };
      const offlinePanel = async (): Promise<HTMLElement> => {
        const status = h('p', {
          className: 'ps-offline-status',
          testId: 'offline-status',
          attributes: { 'aria-live': 'polite' },
        });
        const show = (state: OfflineState): void => {
          status.dataset['state'] = state.kind;
          status.textContent =
            state.kind === 'installing'
              ? g('grownups.offline.installing', {
                  completed: state.completed,
                  total: state.total,
                })
              : state.kind === 'failed'
                ? g('grownups.offline.failed', { code: state.code })
                : g(OFFLINE_TEXT[state.kind]);
        };
        const initial = await app.offline.inspect();
        show(initial);
        const install = candyButton({
          label: g('grownups.offline.install'),
          icon: 'download',
          testId: 'offline-install',
          onPress: async () => {
            const result = await app.offline.install(show);
            show(result);
            install.hidden = result.kind === 'ready' || result.kind === 'update-ready';
            await requestPersistence();
          },
          onError: app.kit.onError,
        });
        install.hidden = initial.kind === 'ready';
        return section(
          g('grownups.offline.heading'),
          null,
          h('p', { text: g('grownups.offline.intro') }),
          status,
          app.offline.supported()
            ? h(
                'div',
                { className: 'ps-row' },
                install,
                candyButton({
                  label: g('grownups.offline.check'),
                  icon: 'retry',
                  variant: 'paper',
                  testId: 'offline-update',
                  onPress: async () => show(await app.offline.checkForUpdate(show)),
                  onError: app.kit.onError,
                }),
              )
            : null,
        );
      };

      // ---- About --------------------------------------------------------------------------
      const aboutPanel = (): HTMLElement =>
        section(
          g('grownups.tab.about'),
          null,
          h('p', {
            testId: 'about-version',
            text: g('grownups.about.version', { revision: shortRevision(app.env.revision) }),
            // The whole revision for support, as in index.html and resource-graph.json.
            attributes: { title: app.env.revision },
            dataset: { revision: app.env.revision },
          }),
          h('p', { text: g('grownups.about.privacy') }),
          h('p', { text: g('grownups.about.font') }),
          h('a', {
            className: 'ps-link-button',
            text: g('grownups.about.licenses'),
            testId: 'about-licenses',
            attributes: {
              href: new URL('licenses.txt', app.env.baseUrl).href,
              target: '_blank',
              rel: 'noopener',
            },
          }),
        );

      let renders = 0;
      const render = async (): Promise<void> => {
        if (disposed) return;
        const token = ++renders;
        let content: HTMLElement;
        try {
          content =
            tab === 'settings'
              ? await settingsPanel()
              : tab === 'progress'
                ? await progressPanel()
                : tab === 'data'
                  ? await dataPanel()
                  : tab === 'offline'
                    ? await offlinePanel()
                    : aboutPanel();
        } catch (error) {
          if (!(error instanceof RecoveryRequired)) app.kit.onError(error);
          return;
        }
        // Only the newest render is shown: an older one can finish later, with older settings.
        if (disposed || token !== renders) return;
        assertChildSafeView(content, app.kit.baseUrl);
        panel.dataset['tab'] = tab;
        replaceKeepingFocus(panel, content);
      };

      renderTabs();
      await render();
      const heading = h('h1', { text: g('grownups.heading') });
      const element = h(
        'main',
        { className: 'ps-grownups', testId: 'screen-grownups' },
        topBar({
          back: context.canGoBack
            ? {
                label: g('grownups.close'),
                testId: 'grownups-close',
                onPress: () => app.router.back(),
              }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        tabBar,
        panel,
      );
      const unsubscribeFamily = app.family.subscribe(() => {
        if (tab === 'data') void render();
      });
      const unsubscribeVoices = app.speech.subscribe(() => {
        if (tab === 'settings') void render();
      });
      return {
        element,
        title: g('grownups.heading'),
        field: 'desk',
        region: null,
        lang: g.language,
        dispose() {
          disposed = true;
          unsubscribeFamily();
          unsubscribeVoices();
        },
      };
    },
  };
}
