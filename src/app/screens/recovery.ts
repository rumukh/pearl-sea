/**
 * Recovery and error screens, in the dark deep so they never look like ordinary play.
 *
 * Recovery: a stored record could not be opened. Nothing was changed. A grown-up can save the
 * stored bytes to a file, go back to the previous copy, load a backup (game saves and
 * preferences), erase the record after confirming, or try again. Every replacement is validated
 * like a fresh load. The screen speaks the grown-ups' language; when the family record itself
 * is what cannot be read, that language is unknown, so the screen offers the switch itself.
 *
 * Error: something unexpected went wrong. The child is told their pearls are safe and can go
 * back to the start; a short code helps a grown-up report it.
 */
import { LANGUAGES } from '../i18n/messages';
import type { Language } from '../i18n/messages';
import { BACKUP_MAX_BYTES, readBackup, rebind } from '../persistence/backup';
import { findDiver } from '../persistence/family';
import { errorCode, RecoveryRequired } from '../persistence/recovery';
import { candyButton, linkButton } from '../ui/button';
import { confirmDialog } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { downloadText, pickTextFile } from './common';

export function recoveryScreen(app: App, problem: RecoveryRequired): ScreenEntry {
  // The family record holds the grown-ups' language; while it cannot be read, Czech until switched.
  let chosen: Language | null = problem.kind === 'family' ? 'cs' : null;
  const entry: ScreenEntry = {
    key: `recovery:${problem.kind}:${problem.profileId}`,
    build() {
      const g = app.grownUps(chosen ?? undefined);
      const name = findDiver(app.family.state(), problem.profileId)?.name ?? problem.profileId;
      const status = h('p', {
        className: 'ps-recovery__status',
        testId: 'recovery-status',
        attributes: { role: 'status' },
      });
      const afterChange = async (): Promise<void> => {
        if (problem.kind === 'family') await app.family.open();
        await app.router.reset(app.screens.title());
      };
      const action = (
        label: string,
        testId: string,
        work: () => Promise<void>,
        variant: 'paper' | 'coral' | 'sun' = 'paper',
      ): HTMLElement =>
        candyButton({
          label,
          testId,
          variant,
          onPress: async () => {
            try {
              await work();
            } catch {
              status.textContent = g('grownups.recovery.failed');
            }
          },
          onError: app.kit.onError,
        });

      const actions: HTMLElement[] = [];
      const original = problem.actions.original;
      if (original !== undefined) {
        actions.push(
          action(g('grownups.recovery.export'), 'recovery-export', async () => {
            downloadText(`pearl-sea-${problem.kind}-${problem.profileId}-stored.json`, original);
          }),
        );
      }
      if (problem.actions.available) {
        const previous = problem.actions.previous;
        if (previous !== undefined) {
          actions.push(
            action(g('grownups.recovery.previous'), 'recovery-previous', async () => {
              await problem.actions.replace(previous);
              await afterChange();
            }),
          );
        }
        if (problem.kind === 'game' || problem.kind === 'preferences') {
          actions.push(
            action(g('grownups.recovery.import'), 'recovery-import', async () => {
              const text = await pickTextFile(BACKUP_MAX_BYTES);
              if (text === null) return;
              const backup = readBackup(text);
              const envelope = problem.kind === 'game' ? backup.game : backup.preferences;
              if (envelope === null) throw new Error('The backup has no such record.');
              await problem.actions.replace(rebind(envelope, problem.profileId));
              await afterChange();
            }),
          );
        }
        actions.push(
          action(
            g('grownups.recovery.reset'),
            'recovery-reset',
            async () => {
              const sure = await confirmDialog(app.kit, {
                heading: g('grownups.recovery.resetTitle'),
                body: g('grownups.recovery.resetBody'),
                confirmLabel: g('grownups.recovery.resetConfirm'),
                cancelLabel: g('grownups.common.cancel'),
                tone: 'warning',
                lang: g.language,
              });
              if (!sure) return;
              await problem.actions.reset();
              await afterChange();
            },
            'coral',
          ),
        );
      }
      actions.push(action(g('grownups.recovery.retry'), 'recovery-retry', afterChange, 'sun'));

      const message =
        problem.kind === 'family'
          ? g('grownups.recovery.family')
          : problem.kind === 'game'
            ? g('grownups.recovery.game', { name })
            : g('grownups.recovery.preferences', { name });
      const languages =
        chosen === null
          ? null
          : h(
              'div',
              {
                className: 'ps-segmented ps-recovery__languages',
                attributes: { role: 'group', 'aria-label': g('grownups.language.label') },
              },
              ...LANGUAGES.map((language) => {
                const button = h('button', {
                  className: 'ps-segment',
                  text: g(`grownups.language.${language}`),
                  testId: `recovery-language-${language}`,
                  attributes: {
                    type: 'button',
                    lang: language,
                    'aria-pressed': String(language === chosen),
                  },
                });
                button.addEventListener('click', () => {
                  chosen = language;
                  void app.router.refresh().catch(app.kit.onError);
                });
                return button;
              }),
            );
      const element = h(
        'main',
        { className: 'ps-recovery', testId: 'screen-recovery', dataset: { kind: problem.kind } },
        h(
          'div',
          { className: 'ps-card ps-recovery__card' },
          languages,
          h('span', { className: 'ps-recovery__icon' }, icon('shield')),
          h('h1', { text: g('grownups.recovery.heading') }),
          h('p', { text: message }),
          problem.code === 'content-unavailable'
            ? h('p', { testId: 'recovery-content', text: g('grownups.recovery.content') })
            : null,
          h('p', {
            text: problem.actions.available
              ? g('grownups.recovery.unchanged')
              : g('grownups.recovery.unavailable'),
          }),
          h('p', {
            className: 'ps-note',
            testId: 'recovery-code',
            text: g('grownups.recovery.code', { code: problem.code }),
          }),
          status,
          h('div', { className: 'ps-recovery__actions' }, ...actions),
          problem.kind === 'family'
            ? null
            : linkButton({
                label: g('grownups.recovery.back'),
                icon: 'back',
                testId: 'recovery-back',
                onPress: () => app.router.reset(app.screens.title()),
                onError: app.kit.onError,
              }),
        ),
      );
      return {
        element,
        title: g('grownups.recovery.heading'),
        field: 'abyss',
        region: null,
        lang: g.language,
      };
    },
  };
  return entry;
}

export function errorScreen(app: App, error: unknown): ScreenEntry {
  if (error instanceof RecoveryRequired) return recoveryScreen(app, error);
  return {
    key: 'error',
    build() {
      const t = app.kit.t;
      const restart = candyButton({
        label: t('error.restart'),
        icon: 'home',
        variant: 'sun',
        size: 'big',
        testId: 'error-restart',
        onPress: async () => {
          await app.family.open();
          await app.router.reset(app.screens.title());
        },
        onError: (failure) => {
          if (failure instanceof RecoveryRequired) {
            void app.router.reset(recoveryScreen(app, failure));
          }
        },
      });
      const element = h(
        'main',
        { className: 'ps-recovery ps-error', testId: 'screen-error' },
        h(
          'div',
          { className: 'ps-card ps-recovery__card' },
          h('h1', { text: t('error.heading') }),
          h('p', { text: t('error.body') }),
          h('p', {
            className: 'ps-note',
            testId: 'error-code',
            text: t('error.code', { code: errorCode(error) }),
          }),
          restart,
        ),
      );
      return {
        element,
        title: t('error.heading'),
        field: 'abyss',
        region: null,
        focusTarget: () => restart,
      };
    },
  };
}
