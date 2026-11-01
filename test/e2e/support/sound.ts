/**
 * The game's sound as the browser tests see it. Chromium always has an audio output, headless
 * included, so there the first tap must make the sound `ready`. Other engines may have none
 * here (Playwright's WebKit on Windows has no `AudioContext`), and then the sound stays
 * `blocked`: silent, retried at the next tap. Never `unavailable` (a pack the sound service
 * refused) or `silent` (no sound pack at all).
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type SoundAfterTap = 'ready' | 'blocked';

/** The status every sound file the page asks for is answered with, by path. */
export function soundFiles(page: Page): Map<string, number> {
  const files = new Map<string, number>();
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.includes('/assets/audio/') && !path.endsWith('.json')) {
      files.set(path, response.status());
    }
  });
  return files;
}

/** The answer to the sound file whose path ends so, once the page has asked for it. */
export async function fetchedSound(files: Map<string, number>, file: string): Promise<void> {
  await expect
    .poll(() => [...files].find(([path]) => path.endsWith(file))?.[1], {
      message: `${file} is fetched`,
    })
    .toBe(200);
}

/** Right after the first tap: what became of the sound. */
export async function soundAfterFirstTap(page: Page, browserName: string): Promise<SoundAfterTap> {
  const status = page.getByTestId('boot-status');
  await expect(status, 'the first tap starts the sound').toHaveAttribute(
    'data-audio',
    browserName === 'chromium' ? 'ready' : /^(ready|blocked)$/,
  );
  return (await status.getAttribute('data-audio')) === 'ready' ? 'ready' : 'blocked';
}
