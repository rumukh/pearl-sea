/**
 * Accessibility checks: axe-core on the page as it is, and what a keyboard user experiences
 * (where focus goes, whether it can be seen).
 *
 * Any violation of a WCAG 2.0, 2.1 or 2.2 level A or AA rule fails the test, whatever axe calls
 * its impact (the game's specs have held every screen to that since the slice). axe's
 * best-practice rules are advice: they are attached to the report and listed in the QA summary
 * (docs/qa/accessibility.md collects them). A violation that is a tracked defect is listed in
 * KNOWN_AXE with its defect ID (support/known-issues.ts): it is reported as a known defect
 * instead of failing, on the engines the defect lists. Remove the entry when the fix lands.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';
import { DEFECTS, defectApplies, engineOf } from './known-issues';
import type { Defect, DefectId } from './known-issues';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const AXE_TAGS = [...WCAG_TAGS, 'best-practice'];

export interface KnownAxe {
  readonly defect: DefectId;
  /** The axe rule id. */
  readonly rule: string;
  /** Matched against the node's axe target (a CSS selector). */
  readonly target: RegExp;
}

export const KNOWN_AXE: readonly KnownAxe[] = [];

export interface AxeOutcome {
  /** WCAG A/AA violations that are not known defects: each must be fixed. */
  readonly blocking: string[];
  /** Best-practice findings (tracked defects are annotated as known defects instead). */
  readonly advisory: string[];
}

/** Run axe on the page and attach the full result as `axe-<state>.json`. */
export async function audit(page: Page, testInfo: TestInfo, state: string): Promise<AxeOutcome> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const engine = engineOf(testInfo);
  const blocking: string[] = [];
  const advisory: string[] = [];
  for (const violation of results.violations) {
    const wcag = violation.tags.some((tag) => WCAG_TAGS.includes(tag));
    for (const node of violation.nodes) {
      const target = node.target.map(String).join(' ');
      const line = `${violation.id} (${violation.impact ?? 'unknown'}) at ${target}: ${violation.help}`;
      const known = KNOWN_AXE.find(
        (entry) =>
          entry.rule === violation.id &&
          entry.target.test(target) &&
          defectApplies(testInfo, entry.defect),
      );
      if (known) {
        const defect: Defect = DEFECTS[known.defect];
        testInfo.annotations.push({
          type: 'known defect',
          description: `${known.defect} (${defect.severity}, ${defect.owner}) on ${state}: ${line}`,
        });
      } else if (wcag) {
        blocking.push(line);
      } else advisory.push(line);
    }
  }
  await testInfo.attach(`axe-${state.replace(/[^\w.-]+/g, '-')}.json`, {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        state,
        url: results.url,
        engine,
        violations: results.violations,
        incomplete: results.incomplete.map((item) => ({
          id: item.id,
          impact: item.impact,
          help: item.help,
          nodes: item.nodes.map((node) => node.target.map(String).join(' ')),
        })),
        passes: results.passes.length,
      },
      null,
      2,
    ),
  });
  for (const line of advisory) {
    testInfo.annotations.push({ type: 'axe advisory', description: `${state}: ${line}` });
  }
  return { blocking, advisory };
}

/** Fail softly (a walk goes on to the next screen) on any WCAG A or AA violation. */
export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  state: string,
): Promise<void> {
  const outcome = await audit(page, testInfo, state);
  expect.soft(outcome.blocking, `WCAG A or AA violations on ${state}`).toEqual([]);
}

// ---- Keyboard ------------------------------------------------------------------------------

export interface FocusStop {
  /** The focused element's test ID, or the nearest one around it. */
  readonly id: string | null;
  readonly tag: string;
  readonly name: string;
  /**
   * A focus indicator by computed style: an outline or ring on the element (or its label), or
   * only on the label for a visually hidden radio or checkbox. `focusPixels` checks the pixels.
   */
  readonly ring: boolean;
  /** The focus indicator's box is inside the viewport. */
  readonly onScreen: boolean;
  readonly inDialog: boolean;
  /** Focus is on the page itself (body), as when it moves to the browser's own controls. */
  readonly page: boolean;
}

export async function focusStop(page: Page): Promise<FocusStop> {
  return page.evaluate(() => {
    const element = document.activeElement;
    // Focus that left the page (to the browser's own controls) shows as the body in Chromium
    // and WebKit, and as a page without focus in Firefox.
    if (!(element instanceof HTMLElement) || element === document.body || !document.hasFocus()) {
      return {
        id: null,
        tag: 'body',
        name: '',
        ring: false,
        onScreen: false,
        inDialog: false,
        page: true,
      };
    }
    const hasRing = (style: CSSStyleDeclaration): boolean =>
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
      (style.boxShadow !== '' && style.boxShadow !== 'none');
    // A visually hidden radio or checkbox shows its focus on the label around it; its own
    // outline cannot be seen, so only the label's counts.
    const label = element.closest('label');
    const hidden =
      element.getBoundingClientRect().width <= 2 || getComputedStyle(element).opacity === '0';
    const indicator = hidden && label ? label : element;
    const ring =
      element.matches(':focus-visible') &&
      (hasRing(getComputedStyle(indicator)) ||
        (!hidden && label !== null && hasRing(getComputedStyle(label))));
    const box = indicator.getBoundingClientRect();
    const onScreen =
      box.width > 0 &&
      box.height > 0 &&
      box.right > 0 &&
      box.bottom > 0 &&
      box.left < innerWidth &&
      box.top < innerHeight;
    const holder = element.closest('[data-testid]');
    return {
      id: element.getAttribute('data-testid') ?? holder?.getAttribute('data-testid') ?? null,
      tag: element.localName,
      name: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60),
      ring,
      onScreen,
      inDialog: element.closest('dialog[open]') !== null,
      page: false,
    };
  });
}

/**
 * Press Tab (or Shift+Tab) from where focus is now until focus leaves the page (the end of the
 * document) or comes back to a control already visited; the controls in the order reached.
 */
export async function tabPass(page: Page, backwards = false, limit = 60): Promise<FocusStop[]> {
  const start = await focusStop(page);
  const stops: FocusStop[] = [];
  const same = (a: FocusStop, b: FocusStop): boolean => a.id === b.id && a.tag === b.tag;
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    const stop = await focusStop(page);
    if (stop.page) {
      // Focus went to the browser's own controls; take the window back for what follows.
      await page.bringToFront();
      break;
    }
    if (same(stop, start) || stops.some((seen) => same(seen, stop))) break;
    stops.push(stop);
  }
  return stops;
}

/** At least this many CSS pixels must change for a focus indicator to count as seen. */
export const SEEN_PIXELS = 100;

/** Pixels (one per CSS pixel) that differ clearly between two screenshots of the same clip. */
async function changedPixels(page: Page, before: Buffer, after: Buffer): Promise<number> {
  // The page decodes the pictures itself; nothing is fetched or attached to its document.
  return page.evaluate(
    async ([first, second]) => {
      const decode = async (base64: string): Promise<Uint8ClampedArray> => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2d canvas');
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [a, b] = await Promise.all([decode(first), decode(second)]);
      if (a.length !== b.length) return Number.POSITIVE_INFINITY;
      let changed = 0;
      for (let index = 0; index < a.length; index += 4) {
        let difference = 0;
        for (let channel = 0; channel < 3; channel++) {
          difference += Math.abs(a[index + channel]! - b[index + channel]!);
        }
        // Anti-aliasing never differs between two shots of the same state; a ring does, a lot.
        if (difference > 48) changed += 1;
      }
      return changed;
    },
    [before.toString('base64'), after.toString('base64')] as const,
  );
}

/**
 * The focus indicator as a person sees it: how many pixels around the focused control change
 * when focus leaves it by `leave` (a key press, as a keyboard user would). Computed styles can
 * promise a ring that art covers or a later rule takes away; pixels cannot. It throws rather
 * than answer 0 when it cannot look (nothing focused, nothing on screen, or the control itself
 * moved), so "not seen" is always a measurement.
 */
export async function focusPixels(page: Page, leave: () => Promise<void>): Promise<number> {
  const handle = await page.evaluateHandle(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;
    const label = element.closest('label');
    const hidden =
      element.getBoundingClientRect().width <= 2 || getComputedStyle(element).opacity === '0';
    return hidden && label ? label : element;
  });
  const indicator = handle.asElement();
  if (!indicator) {
    await handle.dispose();
    throw new Error('nothing on the page has focus, so no focus indicator can be seen');
  }
  const clipOf = (): Promise<{ x: number; y: number; width: number; height: number }> =>
    indicator.evaluate((node) => {
      const box = node.getBoundingClientRect();
      // Room for an outline and its offset, and no more: a neighbour's ring stays out of it.
      const room = 10;
      const x = Math.max(0, Math.floor(box.left - room));
      const y = Math.max(0, Math.floor(box.top - room));
      return {
        x,
        y,
        width: Math.min(innerWidth, Math.ceil(box.right + room)) - x,
        height: Math.min(innerHeight, Math.ceil(box.bottom + room)) - y,
      };
    });
  const shot = (clip: { x: number; y: number; width: number; height: number }): Promise<Buffer> =>
    page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'css' });
  try {
    await indicator.scrollIntoViewIfNeeded();
    const before = await clipOf();
    if (before.width <= 0 || before.height <= 0) {
      throw new Error(
        'the focused control is not on screen, so its focus indicator cannot be seen',
      );
    }
    const focused = await shot(before);
    await leave();
    const after = await clipOf();
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error(
        `the focused control moved when focus left it (${JSON.stringify(before)} to ${JSON.stringify(after)}), so its focus indicator cannot be compared`,
      );
    }
    return await changedPixels(page, focused, await shot(after));
  } finally {
    await handle.dispose();
  }
}
