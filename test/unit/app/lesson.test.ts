// @vitest-environment happy-dom
/**
 * Osmička's lesson, "Jak na to?" (screens/lesson.ts): what a level's lesson shows, a monster
 * level's gathered from its region's lessons, and what read-aloud says of it.
 */
import { describe, expect, it } from 'vitest';
import { createContentText } from '../../../src/app/content/text';
import { lessonLines, lessonSections, spokenLesson } from '../../../src/app/screens/lesson';

const text = createContentText({
  cs: {
    'level.reef.1': 'Obojetné souhlásky',
    'level.reef.2': 'Vyjmenovaná slova po B',
    'level.reef.3': 'Slova příbuzná po B',
    'level.reef.monster': 'Žralok Žrout',
    'level.bay.1': 'Všechna vyjmenovaná slova',
    'lesson.reef.1.1': 'Obojetné souhlásky jsou b, f, l, m, p, s, v, z.',
    'lesson.reef.1.2': 'Po nich píšeme většinou i/í.',
    'lesson.reef.1.4': 'Tento řádek po mezeře nikdo neuvidí.',
    'lesson.reef.2.1': 'Vyjmenovaná slova po B: být, bydlit, obyvatel.',
    'lesson.bay.1.1': 'Všechna slova najednou.',
  },
  en: {},
});

/** The levels as the pack lists them, out of their order on purpose. */
const LEVELS = [
  { id: 'reef.monster', region: 'reef', order: 4, kind: 'monster', titleKey: 'level.reef.monster' },
  { id: 'reef.2', region: 'reef', order: 2, kind: 'lesson', titleKey: 'level.reef.2' },
  { id: 'bay.1', region: 'bay', order: 1, kind: 'lesson', titleKey: 'level.bay.1' },
  { id: 'reef.3', region: 'reef', order: 3, kind: 'lesson', titleKey: 'level.reef.3' },
  { id: 'reef.1', region: 'reef', order: 1, kind: 'lesson', titleKey: 'level.reef.1' },
] as const;

describe('Osmička’s lesson', () => {
  it('shows a lesson level’s lines in order, up to the first one missing', () => {
    expect(lessonLines(text, 'reef.1')).toEqual([
      'Obojetné souhlásky jsou b, f, l, m, p, s, v, z.',
      'Po nich píšeme většinou i/í.',
    ]);
    expect(lessonSections(LEVELS, text, 'reef.2')).toEqual([
      {
        level: 'reef.2',
        titleKey: 'level.reef.2',
        lines: ['Vyjmenovaná slova po B: být, bydlit, obyvatel.'],
      },
    ]);
  });

  it('gathers a monster level’s lesson from its region’s lessons, in the levels’ order', () => {
    const sections = lessonSections(LEVELS, text, 'reef.monster');
    // reef.3 has no lesson lines, and bay.1 is another region's.
    expect(sections.map((section) => section.level)).toEqual(['reef.1', 'reef.2']);
    expect(sections.map((section) => section.titleKey)).toEqual(['level.reef.1', 'level.reef.2']);
  });

  it('has nothing to show for a level without a lesson or a level the pack lacks', () => {
    expect(lessonSections(LEVELS, text, 'reef.3')).toEqual([]);
    expect(lessonSections(LEVELS, text, 'kelp.1')).toEqual([]);
  });

  it('is read aloud as a teacher reads it: no "krát", no arrows, choices with "nebo"', () => {
    const spoken = spokenLesson(
      [
        {
          level: 'lagoon.2',
          titleKey: 'level.reef.1',
          lines: [
            'Délka mění význam: pila × píla.',
            'Řekni jiný tvar: hrad → hrady.',
            '1. pád: kdo? co? – ryba',
            'Předponu vy-/vý- píšeme vždy s y/ý: vý|let.',
          ],
        },
      ],
      (key) => text(key),
    ).replace(/\u00a0/g, ' ');
    expect(spoken).toBe(
      'Obojetné souhlásky. Délka mění význam: pila, píla. Řekni jiný tvar: hrad, hrady. ' +
        '1. pád: kdo? co? – ryba. Předponu vy- nebo vý- píšeme vždy s y nebo ý: výlet.',
    );
  });
});
