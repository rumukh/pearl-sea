/**
 * Every screen of the Slunná laguna slice, in every engine: photographed at the review sizes for
 * human review (docs/qa/screens.md), checked with axe (no WCAG 2.2 A or AA violation) and checked
 * for layout (no sideways scrolling, nothing cut off, every control at least 48 px, no word
 * broken in the middle). Each walk is its own test, so they run side by side.
 *
 * `PS_QA_DOCS=1 npm run test:e2e -- screens.spec.ts` also writes the tablet pictures, small, to
 * docs/qa/screens/ and rewrites docs/qa/screens.md (the QA reporter assembles it at the end).
 */
import type { Page, TestInfo } from '@playwright/test';
import { test } from './support/fixtures';
import { checkStop, writeContactSheet } from './support/screens';
import type { Stop, WalkRecord } from './support/screens';
import { installSpeech, TYPICAL_VOICES } from './support/speech';
import {
  firstDiveWalk,
  fourthGradeWalk,
  grownUpsWalk,
  lagoonWalk,
  largeTextWalk,
  monsterWalk,
  troubleWalk,
} from './support/tour';
import type { Visit } from './support/tour';

const everything = { screenshots: true, axe: true, layout: true };

test.use({ reducedMotion: 'reduce' });

// The same voices everywhere, so read-aloud buttons and the grown-ups' voice list look the same
// in every engine.
test.beforeEach(async ({ context }) => {
  await installSpeech(context, TYPICAL_VOICES);
});

interface Walk {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly walk: (page: Page, visit: Visit) => Promise<void>;
}

const WALKS: readonly Walk[] = [
  {
    id: 'first-dive',
    title: 'The first dive',
    summary:
      'A new family makes its first diver (a 3rd grader), hears the prologue, chooses Krab Tvrďák’s egg and plays the whole first lesson of Slunná laguna, with a check too early, a hint, a miss and a pause, up to the egg hatching (`firstDiveWalk` in test/e2e/support/tour.ts).',
    walk: firstDiveWalk,
  },
  {
    id: 'the-lagoon',
    title: 'The lagoon',
    summary:
      'A diver who played four lessons comes back another day: the map, a lesson’s intro, the letter pad, Pexeso, Inkoustová věta, Lov chyb, today’s goal and the treasure chest, U Mrože, dressing a friend, the album, the Great Shell and goodbye (`lagoonWalk`).',
    walk: lagoonWalk,
  },
  {
    id: 'the-monster',
    title: 'Muréna Mumla',
    summary:
      'A diver who played every lesson of the lagoon battles Muréna Mumla, wipes her ink blots, frees her, finds her in the friends’ gallery and meets an Inkoustík ambush (`monsterWalk`).',
    walk: monsterWalk,
  },
  {
    id: 'the-fourth-grade',
    title: 'A 4th grader',
    summary:
      'A new 4th grader takes the placement check (missing every answer, so they start at the 4th grade’s beginning) and plays Slovní rodinka and Ulita slov in Kořínek’s first lesson of Měsíční jeskyně (`fourthGradeWalk`).',
    walk: fourthGradeWalk,
  },
  {
    id: 'grown-ups',
    title: 'The grown-ups’ area',
    summary:
      'The gate, then every tab for a family whose diver freed Muréna: settings, progress with flashcards and a diploma to print, backups, offline play, about, the area in English, and changing a diver (`grownUpsWalk`).',
    walk: grownUpsWalk,
  },
  {
    id: 'when-things-go-wrong',
    title: 'When things go wrong',
    summary:
      'A family record that cannot be read: the recovery screen and its confirmation (`troubleWalk`).',
    walk: troubleWalk,
  },
];

async function walkAndCheck(page: Page, testInfo: TestInfo, walk: Walk): Promise<void> {
  const stops: (Stop & { heights: Record<string, number> })[] = [];
  await walk.walk(page, async (stop) => {
    const heights = await checkStop(page, testInfo, stop, everything);
    stops.push({ ...stop, heights });
  });
  const record: WalkRecord = {
    walk: walk.id,
    title: walk.title,
    summary: walk.summary,
    set: null,
    stops,
  };
  writeContactSheet(testInfo, record);
}

for (const walk of WALKS) {
  test(`screens: ${walk.title}`, async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    await walkAndCheck(page, testInfo, walk);
  });
}

test('screens: 200 % text (reflow)', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const stops: (Stop & { heights: Record<string, number> })[] = [];
  await largeTextWalk(page, async (stop) => {
    const heights = await checkStop(page, testInfo, stop, { ...everything, set: 'text-200' });
    stops.push({ ...stop, heights });
  });
  writeContactSheet(testInfo, {
    walk: 'large-text',
    title: '200 % text',
    summary: 'A diver at Velikost písma 200 % (`largeTextWalk`).',
    set: 'text-200',
    stops,
  });
});
