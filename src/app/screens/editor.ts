/**
 * Create or change a child's profile: a name, one of eight diver pictures, how the game should
 * address them (_Jsi kluk, nebo holka?_: kluk, holka or _Nechci říct_, docs/design.md §10.2) and,
 * for a new child, the class they are in (3. or 4. třída; 3 until someone chooses). The class
 * waits on the family record until the play screen hands it to the new game save. Removing a
 * child is behind the grown-ups' gate and a confirmation, and erases that child's saved data.
 */
import { picture } from '../art/picture';
import { openGrownUpsGate } from '../grownups/gate-dialog';
import type { MessageKey } from '../i18n/messages';
import { findDiver, MAX_NAME_LENGTH } from '../persistence/family';
import type { FamilyProblem } from '../persistence/family';
import { eraseDiverData } from '../persistence/profile-data';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { candyButton, linkButton } from '../ui/button';
import { confirmDialog } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { ART, DEFAULT_GRADE, DIVER_AVATARS, FORMS_OF_ADDRESS, GRADES } from '../../rules/contract';
import type { DiverAvatar, FormOfAddress, Grade } from '../../rules/contract';
import { topBar } from './common';

const PROBLEM_KEYS: Record<FamilyProblem, MessageKey> = {
  empty: 'editor.problem.empty',
  long: 'editor.problem.long',
  chars: 'editor.problem.chars',
  taken: 'editor.problem.taken',
  full: 'editor.problem.full',
  missing: 'editor.problem.missing',
  avatar: 'editor.problem.avatar',
  address: 'editor.problem.address',
  grade: 'editor.problem.grade',
};

export const GRADE_LABEL_KEYS: Readonly<Record<Grade, MessageKey>> = {
  3: 'grade.3',
  4: 'grade.4',
};

const ADDRESS_KEYS: Readonly<Record<FormOfAddress, MessageKey>> = {
  boy: 'editor.addressBoy',
  girl: 'editor.addressGirl',
  neutral: 'editor.addressNeutral',
};

/** A group of radio buttons; the choice is read with `chosen()`. */
function radioGroup<T extends string | number>(
  name: string,
  values: readonly T[],
  initial: T | null,
  render: (value: T, input: HTMLInputElement) => HTMLElement,
  onChange: (value: T) => void,
): HTMLElement[] {
  return values.map((value) => {
    const input = h('input', {
      className: 'ps-choice__input',
      attributes: { type: 'radio', name, value: String(value) },
    });
    input.checked = value === initial;
    input.addEventListener('change', () => {
      if (input.checked) onChange(value);
    });
    return render(value, input);
  });
}

export function editorScreen(app: App, diverId: string | null): ScreenEntry {
  return {
    key: diverId ? `editor:${diverId}` : 'editor:new',
    build(context) {
      const t = app.kit.t;
      const existing = diverId ? findDiver(app.family.state(), diverId) : undefined;
      if (diverId && !existing) throw new Error('That child is not on this device.');
      const heading = h('h1', {
        text: t(existing ? 'editor.editHeading' : 'editor.createHeading'),
      });

      const nameInput = h('input', {
        className: 'ps-input ps-input--name',
        testId: 'diver-name',
        attributes: {
          id: 'ps-diver-name',
          type: 'text',
          maxlength: String(MAX_NAME_LENGTH + 10),
          autocomplete: 'off',
          autocapitalize: 'words',
          spellcheck: 'false',
          enterkeyhint: 'done',
          lang: 'cs',
          'aria-describedby': 'ps-diver-name-hint ps-diver-problem',
        },
      });
      nameInput.value = existing?.name ?? '';
      const problem = h('p', {
        className: 'ps-error-text',
        testId: 'diver-problem',
        attributes: { id: 'ps-diver-problem', 'aria-live': 'polite' },
      });
      const showProblem = (key: MessageKey | null): void => {
        problem.replaceChildren(...(key ? [icon('warning'), h('span', { text: t(key) })] : []));
        nameInput.setAttribute(
          'aria-invalid',
          String(
            key !== null &&
              [
                'editor.problem.empty',
                'editor.problem.long',
                'editor.problem.chars',
                'editor.problem.taken',
              ].includes(key),
          ),
        );
      };

      let avatar: DiverAvatar | null = existing?.avatar ?? null;
      const avatars = radioGroup(
        'ps-avatar',
        DIVER_AVATARS,
        avatar,
        (value, input) =>
          h(
            'label',
            { className: 'ps-choice ps-choice--avatar', testId: `avatar-${value}` },
            input,
            picture(app.art, ART.avatar(value), { className: 'ps-avatar' }),
            h('span', {
              className: 'ps-visually-hidden',
              text: t('editor.avatarName', { number: DIVER_AVATARS.indexOf(value) + 1 }),
            }),
          ),
        (value) => {
          avatar = value;
        },
      );

      let address: FormOfAddress = existing?.address ?? 'neutral';
      const addresses = radioGroup(
        'ps-address',
        FORMS_OF_ADDRESS,
        existing ? address : null,
        (value, input) =>
          h(
            'label',
            { className: 'ps-choice ps-choice--word', testId: `address-${value}` },
            input,
            h('span', { className: 'ps-choice__label', text: t(ADDRESS_KEYS[value]) }),
          ),
        (value) => {
          address = value;
        },
      );

      let grade: Grade = DEFAULT_GRADE;
      const grades = radioGroup(
        'ps-grade',
        GRADES,
        grade,
        (value, input) =>
          h(
            'label',
            { className: 'ps-choice ps-choice--grade', testId: `grade-${value}` },
            input,
            h('span', { className: 'ps-choice__number', text: String(value) }),
            h('span', { className: 'ps-choice__label', text: t(GRADE_LABEL_KEYS[value]) }),
          ),
        (value) => {
          grade = value;
          // The editor has no child yet, so it reads the class aloud with the device's voice.
          if (app.speech.available()) app.speech.speak(t(GRADE_LABEL_KEYS[value]), { voice: null });
        },
      );

      const fieldset = (
        legend: string,
        className: string,
        testId: string,
        choices: readonly HTMLElement[],
      ): HTMLElement => {
        const set = h(
          'fieldset',
          { className: `ps-picker ${className}`, testId },
          h('legend', { className: 'ps-field__label', text: legend }),
          h('div', { className: 'ps-picker__grid' }, ...choices),
        );
        // WebKit does not match :focus-visible on a radio an arrow key moved to, so the picker
        // notes keyboard use itself and the focused choice shows its ring for that too.
        set.addEventListener('keydown', () => {
          set.dataset['keys'] = 'true';
        });
        set.addEventListener('pointerdown', () => {
          delete set.dataset['keys'];
        });
        return set;
      };

      const submit = async (): Promise<void> => {
        if (!avatar) {
          showProblem('editor.problem.avatar');
          return;
        }
        let result;
        try {
          result = existing
            ? await app.family.update(existing.id, { name: nameInput.value, avatar, address })
            : await app.family.add({ name: nameInput.value, avatar, address, grade });
        } catch {
          showProblem('editor.problem.save');
          return;
        }
        if (!result.ok) {
          showProblem(PROBLEM_KEYS[result.problem]);
          if (['empty', 'long', 'chars', 'taken'].includes(result.problem)) nameInput.focus();
          return;
        }
        showProblem(null);
        if (existing) await app.router.back();
        else await app.router.replace(app.screens.play(result.value.id));
      };

      const save = candyButton({
        label: t(existing ? 'editor.save' : 'editor.create'),
        icon: existing ? 'check' : 'play',
        variant: 'sun',
        size: 'big',
        testId: 'diver-save',
        onPress: submit,
        onError: app.kit.onError,
      });
      const form = h(
        'form',
        { className: 'ps-card ps-editor__card', attributes: { novalidate: '' } },
        h(
          'div',
          { className: 'ps-field' },
          h('label', {
            className: 'ps-field__label',
            text: t('editor.nameLabel'),
            attributes: { for: 'ps-diver-name' },
          }),
          nameInput,
          h('span', {
            className: 'ps-field__hint',
            text: t.plural('editor.nameHint', MAX_NAME_LENGTH),
            attributes: { id: 'ps-diver-name-hint' },
          }),
        ),
        fieldset(t('editor.avatarLabel'), 'ps-picker--avatars', 'diver-avatar', avatars),
        fieldset(t('editor.addressLabel'), 'ps-picker--words', 'diver-address', addresses),
        existing
          ? null
          : fieldset(t('editor.gradeLabel'), 'ps-picker--grades', 'diver-grade', grades),
        problem,
        h('div', { className: 'ps-row ps-row--end' }, save),
      );
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        save.click();
      });

      const remove =
        existing &&
        linkButton({
          label: t('editor.remove'),
          icon: 'trash',
          testId: 'diver-remove',
          onPress: async () => {
            const g = app.grownUps();
            if (!(await openGrownUpsGate(app.kit, g))) return;
            const sure = await confirmDialog(app.kit, {
              heading: g('grownups.divers.removeTitle', { name: existing.name }),
              body: g('grownups.divers.removeBody'),
              confirmLabel: g('grownups.divers.removeConfirm'),
              cancelLabel: g('grownups.common.cancel'),
              tone: 'warning',
              lang: g.language,
            });
            if (!sure) return;
            if (app.active()?.diver.id === existing.id) await app.closeDiver();
            const result = await app.family.remove(existing.id, () =>
              eraseDiverData(app.profiles, existing.id),
            );
            if (result.ok) {
              app.kit.toasts.show(g('grownups.divers.removed', { name: existing.name }));
              await app.router.reset(app.screens.divers());
            }
          },
          onError: app.kit.onError,
        });

      const element = h(
        'main',
        { className: 'ps-editor', testId: 'screen-editor' },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        form,
        remove ? h('div', { className: 'ps-row ps-row--center' }, remove) : null,
      );
      return {
        element,
        title: heading.textContent ?? '',
        field: 'sea',
        region: null,
        music: 'grotto',
        focusTarget: () => nameInput,
      };
    },
  };
}
