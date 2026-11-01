/**
 * Waiting for screens and checking them: the shell's readiness signal, the end of every fade,
 * axe's WCAG rules, the grown-ups' gate, and the screens for human review.
 *
 * At every stop of a walk (support/tour.ts) the page is shown at the review sizes: tablet
 * landscape 1280 × 800 and 1024 × 768 (the family tablet), desktop 1440 × 900 and phone portrait
 * 390 × 844. At each size it is photographed (full page, animations settled) and its layout is
 * checked (support/layout.ts); axe runs at the large tablet and the phone (the small tablet and
 * the desktop share the large tablet's landscape layout).
 *
 * Screenshots are evidence for people, not pixel gates (fonts differ by OS). They are written to
 * `out/qa-screens/<project>/<size>/<stop>.png` with a contact sheet per walk
 * (`out/qa-screens/<project>/<walk>.html`). With `PS_QA_DOCS=1` the large-tablet pictures are
 * also written small (WebP, 800 px wide) to `docs/qa/screens/`, and the QA reporter rewrites
 * `docs/qa/screens.md` from the walks at the end of the run (`writeScreensDoc`).
 */
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';
import { expectAccessible } from './a11y';
import { knownLayout } from './known-issues';
import { layoutProblems } from './layout';

// ------------------------------------------------------------------------------ readiness

/**
 * Readiness waits longer than `expect`'s 10 s: Firefox's first IndexedDB open in a new context
 * takes seconds on a busy machine.
 */
export async function ready(page: Page, screen: string): Promise<void> {
  const status = page.getByTestId('boot-status');
  await expect(status, 'the shell reports ready').toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
  await expect(status).toHaveAttribute('data-screen', screen);
}

/**
 * Wait until nothing on the page is still fading: axe would measure half-faded colours. The
 * router marks a new screen `data-entering` for its first moments; a toast leaving fades out.
 */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('[data-entering]')).toHaveCount(0);
  await page.evaluate(async () => {
    const running = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined));
    await Promise.race([Promise.all(running), new Promise((resolve) => setTimeout(resolve, 2000))]);
  });
}

export async function noViolations(page: Page, what: string): Promise<void> {
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} | ` +
        violation.nodes
          .map((node) => `${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
          .join(' | '),
    ),
    `axe violations: ${what}`,
  ).toEqual([]);
}

/** Through the gate from the title screen: hold the lock from the keyboard, then answer. */
export async function enterGrownUps(page: Page): Promise<void> {
  await page.getByTestId('title-grownups').click();
  const hold = page.getByTestId('gate-hold');
  await expect(hold).toBeFocused();
  await page.keyboard.down(' ');
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible();
  await page.keyboard.up(' ');
  const a = Number(await question.getAttribute('data-a'));
  const b = Number(await question.getAttribute('data-b'));
  await page.keyboard.type(String(a * b));
  await page.keyboard.press('Enter');
  await ready(page, 'grownups');
}

// ------------------------------------------------------------------------------ review sizes

export interface Viewport {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly axe: boolean;
  /** A landscape tablet: the child's play screens must fit it without scrolling. */
  readonly tablet: boolean;
}

/** The first size is the one the docs show (docs/qa/screens.md). */
export const VIEWPORTS: readonly Viewport[] = [
  { id: 'tablet', label: 'tablet landscape', width: 1280, height: 800, axe: true, tablet: true },
  {
    id: 'tablet-small',
    label: 'small tablet landscape',
    width: 1024,
    height: 768,
    axe: false,
    tablet: true,
  },
  { id: 'desktop', label: 'desktop', width: 1440, height: 900, axe: false, tablet: false },
  { id: 'phone', label: 'phone portrait', width: 390, height: 844, axe: true, tablet: false },
];

/** A stop of a walk: a stable file name (`NN-what-it-shows`) and what it shows. */
export interface Stop {
  readonly name: string;
  readonly description: string;
  /**
   * A screen the child plays on (the grotto, a round, a board, results, a story beat): on a
   * landscape tablet everything on it must be in sight without scrolling, as Dragon Valley's
   * playtest asked. Lists such as the shop, the album or the grown-ups' area may scroll.
   */
  readonly play?: boolean;
}

/** A walk, its title and its stops, for the contact sheets and docs/qa/screens.md. */
export interface WalkRecord {
  readonly walk: string;
  readonly title: string;
  readonly summary: string;
  readonly set: string | null;
  readonly stops: readonly (Stop & { readonly heights: Record<string, number> })[];
}

function repositoryRoot(testInfo: TestInfo): string {
  return testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
}

export function screensRoot(testInfo: TestInfo): string {
  return join(repositoryRoot(testInfo), 'out', 'qa-screens', testInfo.project.name);
}

/** Whether this run writes the review pictures and docs/qa/screens.md (`PS_QA_DOCS=1`). */
export function writingDocs(): boolean {
  return process.env['PS_QA_DOCS'] === '1';
}

export const DOCS_FOLDER = join('docs', 'qa');
export const DOCS_PICTURES = join(DOCS_FOLDER, 'screens');
/** Pictures in the docs are this wide (the tablet's 1280 px scaled down), and WebP. */
export const DOCS_WIDTH = 800;
const DOCS_QUALITY = 0.72;

/** Fonts loaded and two frames painted (or half a second, if frames are not being painted). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2000))]);
    await Promise.race([
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  });
}

/**
 * Resize the window and wait until the page lays out at the new size. Every engine carries a
 * resize into the page's `dvh` styles a moment late (up to 0.4 s here; S4 found it in
 * fit.spec.ts): measured at once, a screen with a `100dvh` floor is as tall as the window before.
 * A canary sized `100dvh`, made before the resize, goes stale with them, so the page has caught
 * up once it measures the new height. A size that never settles is measured as it is.
 */
export async function resize(page: Page, width: number, height: number): Promise<void> {
  await page.evaluate(() => {
    const canary = document.createElement('div');
    canary.id = 'ps-qa-dvh-canary';
    canary.setAttribute('aria-hidden', 'true');
    canary.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none';
    document.body.append(canary);
    void canary.getBoundingClientRect().height;
  });
  await page.setViewportSize({ width, height });
  await page
    .waitForFunction(
      ([w, h]) => {
        const canary = document.getElementById('ps-qa-dvh-canary');
        return (
          innerWidth === w &&
          innerHeight === h &&
          canary !== null &&
          Math.abs(canary.getBoundingClientRect().height - h) < 1
        );
      },
      [width, height] as const,
      { timeout: 2_000, polling: 50 },
    )
    .catch(() => undefined);
  await page.evaluate(() => document.getElementById('ps-qa-dvh-canary')?.remove());
}

export interface CheckOptions {
  readonly screenshots: boolean;
  readonly axe: boolean;
  readonly layout: boolean;
  /** The sizes to check at; all review sizes by default. */
  readonly viewports?: readonly Viewport[];
  /** A sub-folder for this set of screenshots (for example `text-200`). */
  readonly set?: string;
}

/**
 * Photograph and check the current page at every size; ends at the first size. Returns each
 * size's page height in CSS px.
 */
export async function checkStop(
  page: Page,
  testInfo: TestInfo,
  stop: Stop,
  options: CheckOptions,
): Promise<Record<string, number>> {
  const viewports = options.viewports ?? VIEWPORTS;
  const heights: Record<string, number> = {};
  await settled(page);
  // With less motion nothing may keep moving (a pulse, a glow, a bobbing friend): WCAG 2.2.2.
  const looping = await page.evaluate(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === 'running' &&
              animation.effect?.getComputedTiming().endTime === Infinity,
          )
          .map((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            const id = target?.closest('[data-testid]')?.getAttribute('data-testid');
            const name = (animation as CSSAnimation).animationName ?? animation.id;
            return `${name || 'an animation'} on <${target?.localName ?? '?'}${id ? ` ${id}` : ''}>`;
          })
      : [],
  );
  expect.soft(looping, `animations that keep running with less motion on ${stop.name}`).toEqual([]);
  for (const viewport of [...viewports.slice(1), viewports[0]!]) {
    await resize(page, viewport.width, viewport.height);
    await settle(page);
    const where = `${options.set ? `${options.set}/` : ''}${stop.name} (${viewport.label})`;
    heights[viewport.id] = await page.evaluate(() => document.documentElement.scrollHeight);
    if (options.screenshots) {
      const folder = options.set ? join(screensRoot(testInfo), options.set) : screensRoot(testInfo);
      const path = join(folder, viewport.id, `${stop.name}.png`);
      mkdirSync(dirname(path), { recursive: true });
      const picture = await photograph(page, testInfo, path, where);
      if (writingDocs() && viewport === viewports[0] && !options.set) {
        await writeDocsPicture(page, testInfo, picture, stop.name);
      }
    }
    if (options.layout) {
      const found = await layoutProblems(page);
      if (stop.play && viewport.tablet && heights[viewport.id]! > viewport.height + 1) {
        found.push(
          `the page is ${heights[viewport.id]} px tall in the ${viewport.height} px window`,
        );
      }
      const problems = knownLayout(testInfo, where, found);
      expect.soft(problems, `layout problems on ${where}`).toEqual([]);
    }
    if (options.axe && viewport.axe) await expectAccessible(page, testInfo, where);
  }
  return heights;
}

/**
 * The tallest page photographed whole, in CSS px: a taller page is photographed from the top,
 * and its true height is recorded as a finding (a `tall page` annotation, listed in the QA
 * summary) instead of failing the walk.
 */
export const MAX_SHOT_HEIGHT = 8_000;

/** A full-page screenshot, cut at MAX_SHOT_HEIGHT; returns the PNG. */
export async function photograph(
  page: Page,
  testInfo: TestInfo,
  path: string,
  where: string,
): Promise<Buffer> {
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  const shot = { path, fullPage: true, animations: 'disabled', caret: 'hide' } as const;
  if (height <= MAX_SHOT_HEIGHT) return page.screenshot(shot);
  testInfo.annotations.push({
    type: 'tall page',
    description: `${where} is ${height} px tall; its screenshot keeps the top ${MAX_SHOT_HEIGHT} px`,
  });
  return page.screenshot({ ...shot, clip: { x: 0, y: 0, width, height: MAX_SHOT_HEIGHT } });
}

/**
 * Scale a PNG down to DOCS_WIDTH and encode it as WebP, in the page (the browser has the codecs;
 * nothing is fetched or attached to the document), into docs/qa/screens/<stop>.webp.
 */
async function writeDocsPicture(
  page: Page,
  testInfo: TestInfo,
  png: Buffer,
  name: string,
): Promise<void> {
  const base64 = await page.evaluate(
    async ([data, width, quality]) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const source = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const height = Math.round((source.height * width) / source.width);
      const bitmap = await createImageBitmap(source, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high',
      });
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      if (blob.type !== 'image/webp') throw new Error(`this browser encodes ${blob.type}`);
      const out = new Uint8Array(await blob.arrayBuffer());
      let text = '';
      for (let at = 0; at < out.length; at += 0x8000) {
        text += String.fromCharCode(...out.subarray(at, at + 0x8000));
      }
      return btoa(text);
    },
    [png.toString('base64'), DOCS_WIDTH, DOCS_QUALITY] as const,
  );
  const folder = join(repositoryRoot(testInfo), DOCS_PICTURES);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${name}.webp`), Buffer.from(base64, 'base64'));
}

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A contact sheet (plain HTML, relative image paths, nothing external) for one walk. */
export function writeContactSheet(
  testInfo: TestInfo,
  record: WalkRecord,
  viewports: readonly Viewport[] = VIEWPORTS,
): void {
  const root = screensRoot(testInfo);
  const prefix = record.set ? `${record.set}/` : '';
  mkdirSync(root, { recursive: true });
  const rows = record.stops
    .map(
      (stop) =>
        `<tr><th>${escape(stop.name)}<br><small>${escape(stop.description)}</small></th>` +
        viewports
          .map(
            (viewport) =>
              `<td><img loading="lazy" src="${prefix}${viewport.id}/${stop.name}.png" alt="${escape(stop.description)} (${viewport.label})"></td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Perlové moře screens: ${escape(record.walk)} (${escape(testInfo.project.name)})</title>
<style>body{font-family:system-ui,sans-serif;margin:16px}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;vertical-align:top}th{text-align:left;width:14em}img{max-width:420px;max-height:640px}</style>
</head><body><h1>${escape(record.title)}: ${escape(testInfo.project.name)}</h1>
<table><thead><tr><th>Stop</th>${viewports.map((v) => `<th>${v.label} ${v.width}×${v.height}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></body></html>
`;
  const name = `${record.set ? `${record.set}-` : ''}${record.walk}`;
  writeFileSync(join(root, `${name}.html`), html);
  writeFileSync(join(root, `${name}.json`), JSON.stringify(record, null, 2) + '\n');
}

/** The walks docs/qa/screens.md shows, in order. */
export const WALK_ORDER = [
  'first-dive',
  'the-lagoon',
  'the-monster',
  'the-fourth-grade',
  'grown-ups',
  'when-things-go-wrong',
] as const;

/**
 * Rewrite docs/qa/screens.md from the walks this run recorded for `project` (the QA reporter
 * calls it at the end of a `PS_QA_DOCS=1` run). Returns false when a walk is missing, so a
 * partial run never replaces the document.
 */
export function writeScreensDoc(root: string, project: string): boolean {
  const folder = join(root, 'out', 'qa-screens', project);
  let files: string[];
  try {
    files = readdirSync(folder);
  } catch {
    return false;
  }
  const walks = new Map<string, WalkRecord>();
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const record = JSON.parse(readFileSync(join(folder, file), 'utf8')) as WalkRecord;
    if (record.set === null) walks.set(record.walk, record);
  }
  if (WALK_ORDER.some((walk) => !walks.has(walk))) return false;
  const tablet = VIEWPORTS[0]!;
  const lines: string[] = [
    '# Screens for human review',
    '',
    '<!-- Generated by `PS_QA_DOCS=1 npm run test:e2e -- screens.spec.ts` (test/e2e/support/screens.ts); do not edit by hand. -->',
    '',
    `Every screen and state of the Slunná laguna slice, photographed at tablet size (${tablet.width} × ${tablet.height}, the family tablet in landscape) by \`test/e2e/screens.spec.ts\`, so the look can be reviewed without running anything. The pictures are scaled down to ${DOCS_WIDTH} px wide; a page taller than the window is shown whole, with its height noted. Shapes labelled "DEV <id>" stand for art S5 has not painted yet.`,
    '',
    'At every stop the same run checks four sizes (tablet 1280 × 800 and 1024 × 768, desktop 1440 × 900, phone 390 × 844): no WCAG 2.2 A or AA violation (axe, at the large tablet and the phone), no sideways scrolling, nothing cut off, every control at least 48 × 48 px and no word broken in the middle. Every run of `screens.spec.ts` also writes full-size pictures at all four sizes, with a contact sheet per walk, to `out/qa-screens/<project>/`.',
    '',
    `Taken in ${project}, with reduced motion so nothing is caught mid-animation.`,
    '',
  ];
  for (const walk of WALK_ORDER) {
    const record = walks.get(walk)!;
    lines.push(`## ${record.title}`, '', record.summary, '');
    for (const stop of record.stops) {
      const height = stop.heights[tablet.id] ?? tablet.height;
      const scrolls = height > tablet.height + 1 ? ` (the page is ${height} px tall)` : '';
      lines.push(
        `### ${stop.name}`,
        '',
        `${stop.description}${scrolls}`,
        '',
        `![${stop.description}](screens/${stop.name}.webp)`,
        '',
      );
    }
  }
  lines.push(
    '## Reviewing',
    '',
    'Look for anything cut off or overlapping, text that is hard to read on its background, a control that looks disabled when it is not, Czech that reads oddly, and whether each screen feels like an undersea storybook rather than a form. Report findings to the coordinator with the stop name.',
    '',
  );
  writeFileSync(join(root, DOCS_FOLDER, 'screens.md'), lines.join('\n'));
  return true;
}
