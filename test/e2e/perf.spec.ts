/**
 * Performance budgets (docs/qa/performance.md): what a child's device downloads, how soon the
 * first screen is ready and can be tapped on a slow connection and a slow processor, how fast an
 * answer gets its feedback, and how long the page is ever too busy to respond.
 *
 * - Sizes, read from the site this run builds and serves: the script and style sheet (as built
 *   and gzipped), and the offline pack, every file "Nainstalovat" copies (the resource graph).
 *   S5's tests hold the audio to its own budget; the rest of the pack is budgeted here.
 * - The first screen: a first visit (no cache) until the title is ready (mounted and painted, so
 *   Hrát can be tapped), on fast 4G and on slow 4G, each with a processor four times slower, timed
 *   inside the page; what it downloaded first; and the long tasks (over 50 ms) on the way.
 *   Chromium only: the throttling is the Chrome DevTools Protocol's. The test server does not
 *   compress, so these are upper bounds: GitHub Pages sends text gzipped.
 * - Feedback: from the answer's tap to the praise, over seven answers, processor four times
 *   slower; and the long tasks while a round is played.
 *
 * Every measurement is recorded in the QA summary ("Performance"). Timings are held to their
 * budgets only when the browser has the machine nearly to itself (at most two workers, as in CI).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { Page, TestInfo } from '@playwright/test';
import { test as base } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerStep,
  levelsPlayed,
  problemOnScreen,
  give,
  rightAnswer,
  movedOn,
  throughStory,
} from './support/game';
import { siteFolder } from './support/site';
import { CHILD, goAdventuring, seedFamily } from './support/tour';

const KB = 1_000;
const MB = 1_000_000;

/** Upper bounds, in bytes; today's values are in docs/qa/performance.md. */
const SIZE_BUDGETS = {
  script: { built: 650 * KB, gzipped: 210 * KB },
  style: { built: 100 * KB, gzipped: 20 * KB },
  /** The offline pack without its audio: the slice with its painted art still landing. */
  packWithoutAudio: 6 * MB,
  pack: 8.5 * MB,
  /** What a first visit downloads before the title, uncompressed and gzipped as Pages sends it. */
  firstScreen: 2.4 * MB,
  firstScreenGzipped: 600 * KB,
};

interface Profile {
  readonly name: string;
  readonly latencyMs: number;
  readonly downKbps: number;
  readonly upKbps: number;
  /** The title must be ready within this time, first visit, timed from the navigation. */
  readonly readyMs: number;
  /** Something must be painted within this time. */
  readonly paintMs: number;
}

/** Lighthouse's mobile network profiles, with its four times slower processor. */
const PROFILES: readonly Profile[] = [
  {
    name: 'fast 4G',
    latencyMs: 40,
    downKbps: 9_000,
    upKbps: 9_000,
    readyMs: 5_000,
    paintMs: 1_500,
  },
  {
    name: 'slow 4G',
    latencyMs: 150,
    downKbps: 1_600,
    upKbps: 750,
    readyMs: 16_000,
    paintMs: 3_000,
  },
];
const CPU_SLOWDOWN = 4;
/** Cold visits per profile; the best one is held to the budget (noise only slows a visit down). */
const VISITS = 3;
const ANSWERS = 7;
const FEEDBACK_BUDGET_MS = 500;
/** The longest the page may be busy at once while a round is played (processor ×4). */
const LONGEST_TASK_IN_PLAY_MS = 400;
const THROTTLING_ONLY_IN_CHROMIUM =
  'Network and processor throttling use the Chrome DevTools Protocol, which only Chromium has.';
const JUDGED_UP_TO_WORKERS = 2;

function judgeTimings(testInfo: TestInfo): { judged: boolean; note: string } {
  const workers = testInfo.config.workers;
  return workers <= JUDGED_UP_TO_WORKERS
    ? { judged: true, note: '' }
    : { judged: false, note: ` (not judged: ${workers} workers share the machine)` };
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Resource {
  readonly src: string;
  readonly bytes: number;
  readonly kind: string;
}

function built(file: string): Buffer {
  return readFileSync(join(root, siteFolder(), file));
}

function record(testInfo: TestInfo, description: string): void {
  testInfo.annotations.push({ type: 'performance', description });
}

const kb = (bytes: number): string => `${(bytes / KB).toFixed(0)} KB`;

base('the script, the style sheet and the offline pack stay within their budgets', () => {
  const testInfo = base.info();
  for (const [file, budget] of [
    ['app.js', SIZE_BUDGETS.script],
    ['app.css', SIZE_BUDGETS.style],
  ] as const) {
    const bytes = built(file);
    const gzipped = gzipSync(bytes, { level: 9 }).length;
    record(
      testInfo,
      `${file}: ${kb(bytes.length)} built (budget ${kb(budget.built)}), ${kb(gzipped)} gzipped (budget ${kb(budget.gzipped)})`,
    );
    expect(bytes.length, `${file} as built`).toBeLessThanOrEqual(budget.built);
    expect(gzipped, `${file} gzipped`).toBeLessThanOrEqual(budget.gzipped);
  }
  const graph = JSON.parse(built('resource-graph.json').toString('utf8')) as {
    resources: Resource[];
  };
  const total = (resources: readonly Resource[]): number =>
    resources.reduce((sum, resource) => sum + resource.bytes, 0);
  const pack = total(graph.resources);
  const withoutAudio = total(graph.resources.filter((resource) => resource.kind !== 'audio'));
  record(
    testInfo,
    `offline pack: ${graph.resources.length} files, ${kb(pack)} (budget ${kb(SIZE_BUDGETS.pack)}), ${kb(withoutAudio)} without audio (budget ${kb(SIZE_BUDGETS.packWithoutAudio)})`,
  );
  expect(withoutAudio, 'the offline pack without its audio').toBeLessThanOrEqual(
    SIZE_BUDGETS.packWithoutAudio,
  );
  expect(pack, 'the whole offline pack').toBeLessThanOrEqual(SIZE_BUDGETS.pack);
});

/** Runs in the page before the game: notes the first screen and every long task. */
function firstScreenProbe(): void {
  const tasks: number[] = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // An engine without long-task timing reports none.
  }
  Object.defineProperty(window, '__psQaLongTasks', { value: tasks });
  const note = (): void => {
    const status = document.querySelector('[data-testid="boot-status"]');
    if (status?.getAttribute('data-state') !== 'ready' || '__psQaFirstScreen' in window) return;
    const entries = [
      ...performance.getEntriesByType('navigation'),
      ...performance.getEntriesByType('resource'),
    ] as PerformanceResourceTiming[];
    Object.defineProperty(window, '__psQaFirstScreen', {
      value: {
        readyMs: performance.now(),
        paintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1,
        bytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
        files: entries.map((entry) => new URL(entry.name).pathname),
        screen: status.getAttribute('data-screen'),
        longTasks: tasks.slice(),
      },
      configurable: true,
    });
  };
  new MutationObserver(note).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
  });
}

interface FirstScreen {
  readonly readyMs: number;
  readonly paintMs: number;
  readonly bytes: number;
  readonly files: string[];
  readonly screen: string | null;
  readonly longTasks: number[];
}

/** What the first visit's files weigh gzipped, as GitHub Pages sends text. */
function gzippedFirstVisit(files: readonly string[]): number {
  const base = '/pearl-sea/';
  let total = 0;
  for (const file of new Set(files)) {
    if (!file.startsWith(base)) continue;
    const leaf = file.slice(base.length) || 'index.html';
    const bytes = built(leaf);
    total += /\.(woff2|webp|png|ogg|gz)$/.test(leaf) ? bytes.length : gzipSync(bytes).length;
  }
  return total;
}

for (const profile of PROFILES) {
  test(`a first visit shows the title within ${profile.readyMs / 1_000} s on ${profile.name} with a slower processor`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== 'chromium', THROTTLING_ONLY_IN_CHROMIUM);
    test.slow();
    await page.addInitScript(firstScreenProbe);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latencyMs,
      downloadThroughput: (profile.downKbps * 1_000) / 8,
      uploadThroughput: (profile.upKbps * 1_000) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    const visits: FirstScreen[] = [];
    for (let visit = 0; visit < VISITS; visit++) {
      await page.goto('./');
      const handle = await page.waitForFunction(
        () => (window as { __psQaFirstScreen?: unknown }).__psQaFirstScreen,
        undefined,
        { timeout: 90_000 },
      );
      visits.push((await handle.jsonValue()) as FirstScreen);
    }
    const best = visits.reduce((a, b) => (b.readyMs < a.readyMs ? b : a));
    const gzipped = gzippedFirstVisit(best.files);
    const longest = Math.max(0, ...best.longTasks);
    const { judged, note } = judgeTimings(testInfo);
    record(
      testInfo,
      `first visit on ${profile.name}, processor ×${CPU_SLOWDOWN}: ${best.screen} ready to tap in ${Math.round(best.readyMs)} ms (budget ${profile.readyMs}), first paint ${Math.round(best.paintMs)} ms (budget ${profile.paintMs}), ${kb(best.bytes)} downloaded uncompressed (budget ${kb(SIZE_BUDGETS.firstScreen)}), ${kb(gzipped)} as Pages sends it (budget ${kb(SIZE_BUDGETS.firstScreenGzipped)}), longest task ${Math.round(longest)} ms; visits ${visits.map((v) => Math.round(v.readyMs)).join(', ')} ms${note}`,
    );
    expect(best.screen, 'a first visit opens on the title').toBe('title');
    expect(best.paintMs, 'something is painted early').toBeGreaterThan(0);
    expect(best.bytes, 'what a first visit downloads before its first screen').toBeLessThanOrEqual(
      SIZE_BUDGETS.firstScreen,
    );
    expect(gzipped, 'what a first visit downloads, gzipped').toBeLessThanOrEqual(
      SIZE_BUDGETS.firstScreenGzipped,
    );
    if (judged) {
      expect(best.readyMs, `the title is ready within ${profile.readyMs} ms`).toBeLessThanOrEqual(
        profile.readyMs,
      );
      expect(best.paintMs, `first paint within ${profile.paintMs} ms`).toBeLessThanOrEqual(
        profile.paintMs,
      );
    }
  });
}

/** Runs before an answer: resolves with the time from the tap to the feedback (or -1). */
function armFeedbackTimer(): void {
  const node = document.querySelector('[data-testid="feedback"]');
  const scope = window as unknown as { __psQaFeedbackDelay?: Promise<number> };
  scope.__psQaFeedbackDelay = new Promise<number>((resolve) => {
    if (!node) {
      resolve(-1);
      return;
    }
    let sent = -1;
    const onTap = (): void => {
      if (sent < 0) sent = performance.now();
    };
    const done = (delay: number): void => {
      observer.disconnect();
      window.removeEventListener('pointerdown', onTap, true);
      clearTimeout(timer);
      resolve(delay);
    };
    const observer = new MutationObserver(() => {
      const kind = node.getAttribute('data-kind');
      if (sent >= 0 && kind && kind !== 'none') done(performance.now() - sent);
    });
    const timer = setTimeout(() => done(-1), 20_000);
    window.addEventListener('pointerdown', onTap, true);
    observer.observe(node, { attributes: true, attributeFilter: ['data-kind'] });
  });
}

async function playedOn(page: Page): Promise<void> {
  await seedFamily(page, await levelsPlayed(['sunny-lagoon.1'], 'e2e-perf'));
  await page.getByTestId('title-play').click();
  await page.getByTestId(`diver-${CHILD}`).click();
  expect(await throughStory(page)).toBe('screen-hub');
  expect(await goAdventuring(page)).toBe('screen-round');
}

test(`feedback follows an answer within ${FEEDBACK_BUDGET_MS} ms with a slower processor, and the page stays responsive`, async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', THROTTLING_ONLY_IN_CHROMIUM);
  test.slow();
  await page.addInitScript(firstScreenProbe);
  await playedOn(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  const before = await page.evaluate(
    () => (window as unknown as { __psQaLongTasks: number[] }).__psQaLongTasks.length,
  );
  const delays: number[] = [];
  for (let answer = 0; answer < ANSWERS; answer++) {
    const asked = await problemOnScreen(page, CHILD);
    await page.evaluate(armFeedbackTimer);
    await give(page, asked, rightAnswer(asked));
    delays.push(
      await page.evaluate(
        () => (window as unknown as { __psQaFeedbackDelay: Promise<number> }).__psQaFeedbackDelay,
      ),
    );
    await movedOn(page, asked);
  }
  await answerStep(page, CHILD);
  const tasks = await page.evaluate(
    (from) => (window as unknown as { __psQaLongTasks: number[] }).__psQaLongTasks.slice(from),
    before,
  );
  expect(Math.min(...delays), 'every answer was timed to its feedback').toBeGreaterThanOrEqual(0);
  const sorted = [...delays].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const longest = Math.max(0, ...tasks);
  const { judged, note } = judgeTimings(testInfo);
  record(
    testInfo,
    `feedback after a tap, processor ×${CPU_SLOWDOWN}: median ${Math.round(median)} ms (budget ${FEEDBACK_BUDGET_MS}), slowest ${Math.round(sorted.at(-1)!)} ms; answers ${delays.map(Math.round).join(', ')} ms; ${tasks.length} long tasks while playing, the longest ${Math.round(longest)} ms (budget ${LONGEST_TASK_IN_PLAY_MS})${note}`,
  );
  if (judged) {
    expect(median, `feedback within ${FEEDBACK_BUDGET_MS} ms of the tap`).toBeLessThanOrEqual(
      FEEDBACK_BUDGET_MS,
    );
    expect(longest, 'the page is never busy for long while a round is played').toBeLessThanOrEqual(
      LONGEST_TASK_IN_PLAY_MS,
    );
  }
});
