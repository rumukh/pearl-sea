/**
 * The grown-ups' "Pokrok" tab for one child, from the rules' `GrownUpsView` (contract views.ts):
 * an overview (days practised, answers, monsters freed, the grade), the last days of practice,
 * how far the child is in each goal of the 3rd and 4th grade, the hardest words with printable
 * flashcards, and diplomas to print for freed monsters and whole grades.
 *
 * Reading progress never starts a session or counts play time (`App.withGame`). The words around
 * speak the grown-ups' language; printed pages are Czech.
 */
import { picture } from '../art/picture';
import type { GrownUpTranslate, Language } from '../i18n/messages';
import { czechDate } from '../i18n/typography';
import { localDay } from '../persistence/day';
import type { Diver } from '../persistence/family';
import { certificateJob, flashcardJob } from '../print/documents';
import type { PrintJob } from '../print/documents';
import { gradeDiploma, hardestCards, monsterDiploma } from '../print/printables';
import { fileSlug } from '../screens/common';
import type { App } from '../shell/app';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { createMeter } from '../ui/meters';
import { ART, GRADES, GUIDE_ID } from '../../rules/contract';

/** How many practised days the tab lists, newest first. */
export const RECENT_DAYS = 14;

/** A date for the grown-ups: Czech `31. 10. 2026`, or ISO `2026-10-31` in English. */
export function grownUpDate(day: string, language: Language): string {
  return language === 'cs' ? czechDate(day) : day;
}

function section(title: string, testId: string, ...children: (Node | null)[]): HTMLElement {
  return h(
    'section',
    { className: 'ps-card ps-grownups__section', testId },
    h('h2', { text: title }),
    ...children,
  );
}

function row(testId: string | null, ...children: (Node | null)[]): HTMLElement {
  return h('li', { className: 'ps-grownups__row', ...(testId ? { testId } : {}) }, ...children);
}

/** The tab's sections for `diver`, or a note while the shell has no game. */
export async function progressSections(
  app: App,
  g: GrownUpTranslate,
  diver: Diver,
): Promise<HTMLElement[]> {
  const content = app.content();
  if (!content) {
    return [
      section(
        g('grownups.tab.progress'),
        'progress-no-game',
        h('p', { text: g('grownups.progress.noGame') }),
      ),
    ];
  }
  const view = await app.withGame(diver.id, async (game) => game.view());
  const text = app.grownUpText(g.language);
  const progress = view.grownUps;
  // Printed pages are Czech, whatever the grown-ups' language.
  const t = app.kit.t;
  const czech = content.text;

  const print = async (make: () => PrintJob, title: string, art?: string): Promise<void> => {
    let job: PrintJob;
    try {
      job = make();
    } catch {
      app.kit.toasts.show(g('grownups.progress.printFailed'), { tone: 'warning' });
      return;
    }
    await app.router.push(
      app.screens.print({
        job,
        title,
        ...(art ? { art: (cell) => (cell.id === 'heading' ? picture(app.art, art) : null) } : {}),
      }),
    );
  };

  const freed = view.gallery.monsters.filter((monster) => monster.freed);
  const overview = section(
    g('grownups.progress.overview'),
    'progress-overview',
    h(
      'ul',
      { className: 'ps-grownups__list' },
      row(
        'progress-days',
        h('span', { text: g.plural('grownups.progress.days', progress.daysPracticed) }),
      ),
      row(
        'progress-answers',
        h('span', { text: g.plural('grownups.progress.answers', progress.answers) }),
      ),
      row(
        'progress-freed',
        h('span', {
          text: g('grownups.progress.freed', {
            freed: freed.length,
            total: view.gallery.monsters.length,
          }),
        }),
      ),
      row(
        'progress-grade',
        h('span', { text: g('grownups.progress.grade', { grade: view.settings.grade }) }),
      ),
    ),
  );

  const recent = progress.trend.slice(-RECENT_DAYS).reverse();
  const days = section(
    g('grownups.progress.recent'),
    'progress-recent',
    recent.length === 0
      ? h('p', { text: g('grownups.progress.recentNone') })
      : h(
          'ul',
          { className: 'ps-grownups__list' },
          ...recent.map((day) =>
            row(
              `progress-day-${day.day}`,
              createMeter({
                label: grownUpDate(day.day, g.language),
                max: Math.max(1, day.answers),
                value: day.correct,
                valueText: (value) =>
                  g('grownups.progress.dayValue', { correct: value, answers: day.answers }),
              }).element,
            ),
          ),
        ),
  );

  const goals = GRADES.flatMap((grade) => {
    const objectives = progress.objectives.filter(
      (objective) => objective.grade === grade && objective.items > 0,
    );
    if (objectives.length === 0) return [];
    return [
      section(
        g('grownups.progress.goals', { grade }),
        `progress-goals-${grade}`,
        h(
          'ul',
          { className: 'ps-grownups__list' },
          ...objectives.map((objective) =>
            h(
              'li',
              {
                className: 'ps-grownups__row ps-grownups__row--stack',
                testId: `goal-${objective.objective}`,
              },
              createMeter({
                label: text(objective.titleKey),
                max: objective.items,
                value: objective.mastered,
                valueText: (value, max) =>
                  g('grownups.progress.goalValue', { mastered: value, items: max }),
              }).element,
              objective.accuracy > 0
                ? h('span', {
                    className: 'ps-note',
                    text: g('grownups.progress.goalAccuracy', { accuracy: objective.accuracy }),
                  })
                : null,
            ),
          ),
        ),
        h('p', { className: 'ps-note', text: g('grownups.progress.goalsNote') }),
      ),
    ];
  });

  // What the child gets wrong most; items always answered right are not "hard".
  const missed = progress.hardest.filter((entry) => entry.accuracy < 100);
  const cards = hardestCards(missed);
  const hardest = section(
    g('grownups.progress.hardest'),
    'progress-hardest',
    missed.length === 0
      ? h('p', { text: g('grownups.progress.hardestNone') })
      : h(
          'ul',
          { className: 'ps-grownups__list' },
          ...missed.map((entry) =>
            row(
              `hardest-${entry.item}`,
              h('span', {
                className: 'ps-grownups__word',
                text: entry.text,
                attributes: { lang: 'cs' },
              }),
              h('span', {
                className: 'ps-note',
                text: g('grownups.progress.hardestValue', { accuracy: entry.accuracy }),
              }),
            ),
          ),
        ),
    cards.length > 0
      ? candyButton({
          label: g('grownups.progress.cards'),
          icon: 'print',
          variant: 'paper',
          testId: 'print-cards',
          onPress: () =>
            print(
              () =>
                flashcardJob(
                  t('print.cardsTitle', { name: diver.name }),
                  cards,
                  `karticky-${fileSlug(diver.name)}`,
                ),
              g('grownups.progress.cardsTitle', { name: diver.name }),
            ),
          onError: app.kit.onError,
        })
      : null,
  );

  const diplomaButtons = [
    ...freed.flatMap((monster) =>
      monster.day === null
        ? []
        : [
            candyButton({
              label: g('grownups.progress.diplomaMonster', { name: text(monster.nameKey) }),
              icon: 'print',
              variant: 'paper',
              size: 'small',
              testId: `diploma-${monster.id}`,
              onPress: () =>
                print(
                  () =>
                    certificateJob(
                      t('diploma.heading'),
                      monsterDiploma(t, diver.name, {
                        id: monster.id,
                        name: czech(monster.nameKey),
                        day: monster.day!,
                      }),
                      `diplom-${fileSlug(diver.name)}-${monster.id}`,
                    ),
                  g('grownups.progress.diplomaMonster', { name: text(monster.nameKey) }),
                  ART.monster(monster.id, 'freed'),
                ),
              onError: app.kit.onError,
            }),
          ],
    ),
    ...view.hub.certificates.map((grade) =>
      candyButton({
        label: g('grownups.progress.diplomaGrade', { grade }),
        icon: 'print',
        variant: 'paper',
        size: 'small',
        testId: `diploma-grade-${grade}`,
        onPress: () =>
          print(
            () =>
              certificateJob(
                t('diploma.heading'),
                gradeDiploma(t, diver.name, grade, localDay()),
                `diplom-${fileSlug(diver.name)}-trida-${grade}`,
              ),
            g('grownups.progress.diplomaGrade', { grade }),
            ART.character(GUIDE_ID),
          ),
        onError: app.kit.onError,
      }),
    ),
  ];
  const diplomas = section(
    g('grownups.progress.diplomas'),
    'progress-diplomas',
    diplomaButtons.length === 0
      ? h('p', { text: g('grownups.progress.diplomasNone') })
      : h('div', { className: 'ps-row' }, ...diplomaButtons),
  );

  return [overview, days, ...goals, hardest, diplomas];
}
