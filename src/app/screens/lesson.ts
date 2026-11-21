/**
 * Osmička's lesson, "Jak na to?" (docs/design.md §5.3): the new material of a level, explained
 * for a child who has not met it at school yet, before or while the level is played. A lesson
 * level's lesson is its lines in the content catalog (`lessonKey`, docs/contract.md §7.4); a
 * monster level shows its region's lessons in order, each under its level's title, since its
 * battle asks the whole region.
 *
 * The lesson opens from the level's intro and from every round and board of the level, never from
 * Svačinka, the race or the placement check, and lies over the game: nothing pauses. The reading
 * counts in the step's response time, so a step answered after a long read is slow and its item
 * keeps its box rather than being promoted as if recalled. Unlike a hint, a lesson may name the
 * words its level asks: it teaches, the child chose to read it, and the next retrieval comes in a
 * later round.
 */
import { picture } from '../art/picture';
import type { ContentText } from '../content/text';
import type { ChildPreferences } from '../persistence/preferences';
import type { App } from '../shell/app';
import { candyButton } from '../ui/button';
import type { ButtonSize } from '../ui/button';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { ART, GUIDE_ID, lessonKey } from '../../rules/contract';
import type { Level } from '../../rules/contract';
import { speakerButton } from './speaker';

/** The levels a lesson is gathered from: the pack's, read only. */
type LevelRecord = Pick<Level, 'id' | 'region' | 'order' | 'kind' | 'titleKey'>;

export interface LessonSection {
  /** The lesson level whose lines these are. */
  readonly level: string;
  readonly titleKey: string;
  readonly lines: readonly string[];
}

/** A lesson level's lines in order: `lesson.<level>.1`, `.2`, … up to the first one missing. */
export function lessonLines(text: ContentText, level: string): string[] {
  const lines: string[] = [];
  for (let line = 1; text.has(lessonKey(level, line)); line++) {
    lines.push(text(lessonKey(level, line)));
  }
  return lines;
}

/**
 * What "Jak na to?" shows for a level: a lesson level's own lesson, or for a monster level the
 * lessons of its region's lesson levels in their order. Empty when there is nothing to show.
 */
export function lessonSections(
  levels: readonly LevelRecord[],
  text: ContentText,
  levelId: string,
): LessonSection[] {
  const level = levels.find((candidate) => candidate.id === levelId);
  if (!level) return [];
  const taught =
    level.kind === 'monster'
      ? levels
          .filter((candidate) => candidate.region === level.region && candidate.kind === 'lesson')
          .sort((a, b) => a.order - b.order)
      : [level];
  return taught
    .map((lesson) => ({
      level: lesson.id,
      titleKey: lesson.titleKey,
      lines: lessonLines(text, lesson.id),
    }))
    .filter((section) => section.lines.length > 0);
}

/** A line as a voice should say it: a sentence that ends in a stop. */
function spokenLine(line: string): string {
  return /[.!?…]$/.test(line) ? line : `${line}.`;
}

/**
 * The lesson as read-aloud says it. The signs the lines show are said as a teacher would read
 * them: a contrast (_pila × píla_) and a derivation (_hrad → hrady_) as a pause, never "krát"
 * or "šipka"; letter choices (_y/ý_) with "nebo"; a word cut into its parts (_vý|let_) whole.
 */
export function spokenLesson(
  sections: readonly LessonSection[],
  title: (key: string) => string,
): string {
  return sections
    .flatMap((section) => [title(section.titleKey), ...section.lines])
    .map(spokenLine)
    .join(' ')
    .replace(/\s*[×→]\s*/g, ', ')
    .replace(/\|/g, '')
    .replace(/\//g, ' nebo ');
}

/** Show Osmička's lesson over the screen; resolves once the child closes it. */
export async function openLesson(
  app: App,
  preferences: ChildPreferences,
  sections: readonly LessonSection[],
): Promise<void> {
  const t = app.kit.t;
  const text = app.content()!.text;
  const reading = h(
    'div',
    {
      className: 'ps-lesson__text',
      testId: 'lesson-text',
      // A long lesson scrolls here, so the keyboard can reach and scroll it too.
      attributes: { role: 'region', 'aria-label': t('lesson.text'), tabindex: '0' },
    },
    ...sections.map((section) =>
      h(
        'section',
        { className: 'ps-lesson__section', dataset: { level: section.level } },
        h('h3', { text: text(section.titleKey) }),
        ...section.lines.map((line) => h('p', { text: line })),
      ),
    ),
  );
  await openModal<void>(app.kit, {
    label: t('lesson.heading'),
    heading: false,
    className: 'ps-dialog--lesson',
    testId: 'lesson-dialog',
    dismissValue: undefined,
    build(body, close) {
      body.append(
        h(
          'div',
          { className: 'ps-lesson__head' },
          h(
            'div',
            { className: 'ps-lesson__guide' },
            picture(app.art, ART.character(GUIDE_ID), { motion: 'greet' }),
          ),
          h('h2', { text: t('lesson.heading') }),
        ),
        reading,
        h(
          'div',
          { className: 'ps-dialog__actions' },
          ...speakerButton(
            app,
            preferences,
            () => spokenLesson(sections, (key) => text(key)),
            'lesson-read',
          ),
          candyButton({
            label: t('lesson.close'),
            icon: 'check',
            variant: 'sun',
            testId: 'lesson-close',
            onPress: () => close(undefined),
            onError: app.kit.onError,
          }),
        ),
      );
    },
    initialFocus: () => reading,
  }).result;
  app.stopSpeaking();
}

/**
 * The "Jak na to?" button for a level, or nothing when the level has no lesson to show. It opens
 * Osmička's lesson with the child's read-aloud settings as they are at the tap.
 */
export function lessonButton(
  app: App,
  options: {
    readonly levels: readonly LevelRecord[];
    readonly level: string;
    readonly preferences: () => ChildPreferences;
    readonly testId: string;
    readonly size?: ButtonSize;
  },
): HTMLButtonElement[] {
  const sections = lessonSections(options.levels, app.content()!.text, options.level);
  if (sections.length === 0) return [];
  return [
    candyButton({
      label: app.kit.t('lesson.open'),
      icon: 'book',
      variant: 'paper',
      ...(options.size ? { size: options.size } : {}),
      testId: options.testId,
      onPress: () => openLesson(app, options.preferences(), sections),
      onError: app.kit.onError,
    }),
  ];
}
