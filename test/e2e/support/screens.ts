/**
 * Waiting for screens and checking them: the shell's readiness signal, the end of every fade,
 * axe's WCAG 2.1 A and AA rules, and the grown-ups' gate.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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
