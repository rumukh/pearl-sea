import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import {
  PACK,
  fourthGraderPlaced,
  leaveScreen,
  levelsPlayed,
  playRound,
  throughStory,
} from './support/game';
import { enterGrownUps, openLevel, seedFamily, CHILD } from './support/tour';
import { ready } from './support/screens';
import type { RuntimeSnapshot } from '@aegis/runtime';

test.use({ reducedMotion: 'reduce' });

const OUT = 'docs/qa/screens/full-sea';
const REGIONS = [...new Set(PACK.data.levels.map((level) => level.region))];
const QA_EVIDENCE = process.env.QA_EVIDENCE === '1';

function lessons(region: string): string[] {
  return PACK.data.levels
    .filter((level) => level.region === region && level.kind !== 'monster')
    .sort((a, b) => a.order - b.order)
    .map((level) => level.id);
}

function monster(region: string): string {
  const level = PACK.data.levels.find(
    (candidate) => candidate.region === region && candidate.kind === 'monster',
  );
  if (!level) throw new Error(`no monster level for ${region}`);
  return level.id;
}

function grade3Before(regionIndex: number): string[] {
  return PACK.data.levels
    .filter(
      (level) =>
        REGIONS.indexOf(level.region) < regionIndex || level.region === REGIONS[regionIndex],
    )
    .filter((level) => (level.region === REGIONS[regionIndex] ? level.kind !== 'monster' : true))
    .sort((a, b) => {
      const regionOrder = REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region);
      return regionOrder || a.order - b.order;
    })
    .map((level) => level.id);
}

async function shot(page: Parameters<typeof seedFamily>[0], name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function captureRegion(
  page: Page,
  region: string,
  beforeSnapshot: RuntimeSnapshot,
  afterSnapshot: RuntimeSnapshot,
  size: 'ipad-landscape' | 'phone-200',
): Promise<void> {
  await seedFamily(page, beforeSnapshot);
  if (size === 'phone-200') {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGrownUps(page);
    await page.getByTestId('setting-text-200').click();
    await page.getByTestId('grownups-close').click();
    await ready(page, 'title');
  }
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  await throughStory(page);
  await page.getByTestId('place-map').click();
  await ready(page, 'map');
  await shot(page, `${region}-${size}-map`);
  await page.getByTestId(`region-${region}`).click();
  await ready(page, 'region');
  await shot(page, `${region}-${size}-region`);
  await page.getByTestId(`level-${lessons(region)[0]}`).click();
  await ready(page, 'level');
  await shot(page, `${region}-${size}-level`);

  if (size === 'phone-200') return;

  const battlePage = await page.context().newPage();
  try {
    await battlePage.setViewportSize({ width: 1180, height: 820 });
    await seedFamily(battlePage, afterSnapshot);
    await battlePage.getByTestId('title-play').click();
    await battlePage.getByTestId(`diver-${CHILD}`).click();
    await throughStory(battlePage);
    await openLevel(battlePage, monster(region));
    await leaveScreen(battlePage, 'screen-level', () =>
      battlePage.getByTestId('level-start').click(),
    );
    await throughStory(battlePage);
    await expect(battlePage.getByTestId('screen-round')).toHaveAttribute('data-activity', 'battle');
    await shot(battlePage, `${region}-${size}-battle`);
    await playRound(battlePage, CHILD);
    await throughStory(battlePage);
    await expect(battlePage.getByTestId('moment-freed')).toBeVisible();
    await shot(battlePage, `${region}-${size}-freed`);
  } finally {
    await battlePage.close();
  }
}

test.describe('QA evidence', () => {
  test.skip(!QA_EVIDENCE, 'one-off evidence capture; run with QA_EVIDENCE=1');

  test('full sea visual evidence', async ({ page }) => {
    test.setTimeout(1_200_000);
    await mkdir(OUT, { recursive: true });
    for (let index = 1; index < REGIONS.length; index++) {
      const region = REGIONS[index]!;
      const before =
        index < 7
          ? await levelsPlayed(
              PACK.data.levels
                .filter((level) => REGIONS.indexOf(level.region) < index)
                .sort(
                  (a, b) =>
                    REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.order - b.order,
                )
                .map((level) => level.id),
              `qa-before-${region}`,
            )
          : await fourthGraderPlaced({ region, levels: [] });
      const after =
        index < 7
          ? await levelsPlayed(grade3Before(index), `qa-region-${region}`)
          : await fourthGraderPlaced({ region, levels: lessons(region) });
      await page.setViewportSize({ width: 1180, height: 820 });
      await captureRegion(page, region, before, after, 'ipad-landscape');
      await page.setViewportSize({ width: 390, height: 844 });
      await captureRegion(page, region, before, after, 'phone-200');
    }
  });
});
