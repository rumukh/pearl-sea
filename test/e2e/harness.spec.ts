/**
 * The harness proves itself (docs/testing.md §2.4, "mutation-check"): each guard, the
 * accessibility audit, the layout checks and the pexeso player is shown a planted fault and must
 * report it. A check that cannot see a console message, a foreign request, a nameless button, a
 * cut-off control or a word broken in two would let every other spec pass vacuously.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import type { FindingKind, Guard } from './support/guard';
import { audit } from './support/a11y';
import {
  AUDIO_MANIFEST,
  audioLog,
  audioProbe,
  hasWebAudio,
  soundOf,
  startedSounds,
} from './support/audio';
import type { ManifestSound } from './support/audio';
import { layoutProblems } from './support/layout';
import { ready, resize } from './support/screens';

function seen(guard: Guard, kind: FindingKind, pattern: RegExp): boolean {
  return guard.all().some((finding) => finding.kind === kind && pattern.test(finding.detail));
}

async function expectSeen(guard: Guard, kind: FindingKind, pattern: RegExp): Promise<void> {
  await expect
    .poll(() => seen(guard, kind, pattern), { message: `the guard saw a ${kind} ${pattern}` })
    .toBe(true);
  guard.allow(kind, pattern, 'provoked on purpose by the guard self-test');
}

async function boot(page: Page): Promise<void> {
  await page.goto('./');
  await ready(page, 'title');
}

test.describe('the guard sees every kind of finding', () => {
  test('console messages of every level, from the game page', async ({ page, guard }) => {
    await boot(page);
    await page.evaluate(() => {
      console.info('qa-info');
      console.warn('qa-warning');
      console.error('qa-error');
    });
    await expectSeen(guard, 'console', /^info: qa-info/);
    await expectSeen(guard, 'console', /^warning: qa-warning/);
    await expectSeen(guard, 'console', /^error: qa-error/);
  });

  test('an uncaught error and an unhandled rejection reach the error screen, and the guard', async ({
    page,
    guard,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('qa-thrown');
      });
    });
    await expect(page.getByTestId('screen-error')).toBeVisible();
    await expectSeen(guard, 'page-error', /the game showed its error screen \(.+\)/);
    await boot(page);
    await page.evaluate(() => {
      void Promise.reject(new Error('qa-rejected'));
    });
    await expect(page.getByTestId('screen-error')).toBeVisible();
    await expect
      .poll(() => guard.all().filter((finding) => /error screen/.test(finding.detail)).length)
      .toBe(2);
    // Engines that still report what the shell handled report these two, and nothing else.
    guard.allow('page-error', /qa-thrown|qa-rejected/, 'provoked on purpose above');
  });

  test('outbound links, embeds, window.open and beacons, as they are added', async ({
    page,
    guard,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = 'https://example.com/qa-outbound';
      document.body.append(link);
      const mail = document.createElement('a');
      document.body.append(mail);
      mail.setAttribute('href', 'mailto:qa@example.com');
      const frame = document.createElement('iframe');
      document.body.append(frame);
      window.open('https://example.com/qa-popup');
      navigator.sendBeacon('./qa-beacon');
    });
    await expectSeen(guard, 'outbound', /<a href="https:\/\/example\.com\/qa-outbound">/);
    await expectSeen(guard, 'outbound', /<a href="mailto:qa@example\.com">/);
    await expectSeen(guard, 'outbound', /<iframe> embed/);
    await expectSeen(guard, 'window-open', /qa-popup/);
    await expectSeen(guard, 'network-api', /sendBeacon .*qa-beacon/);
  });

  test('a CSP violation and a 404 on the game page', async ({ page, guard }) => {
    await boot(page);
    await page.evaluate(() => {
      const image = new Image();
      image.src = 'https://example.com/qa-blocked.png';
      document.body.append(image);
      void fetch('./qa-missing.json').catch(() => undefined);
    });
    await expectSeen(guard, 'csp', /img-src blocked https:\/\/example\.com\/qa-blocked\.png/);
    await expectSeen(guard, 'outbound', /qa-blocked\.png/);
    await expectSeen(guard, 'failed-request', /qa-missing\.json \(404\)/);
    // Engines also log the refusal and the 404 to the console, and Chromium reports the refused
    // image as a request to another origin that failed with "csp".
    const provoked = 'provoked on purpose above';
    guard.allow('console', /qa-blocked\.png|qa-missing\.json|404/, provoked);
    guard.allow('foreign-request', /qa-blocked\.png/, provoked);
    guard.allow('failed-request', /qa-blocked\.png|qa-missing\.json/, provoked);
  });

  test('a request to another origin', async ({ page, guard }) => {
    // The game's CSP stops cross-origin requests before they start, so this uses a page
    // without it; the request is answered locally and never reaches a network.
    await page.context().route('http://qa-foreign.test/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    );
    await page.setContent('<img src="http://qa-foreign.test/qa-foreign.svg">');
    await expectSeen(guard, 'foreign-request', /GET http:\/\/qa-foreign\.test\/qa-foreign\.svg/);
  });
});

test.describe('the accessibility audit and the layout checks see planted faults', () => {
  test('a nameless button is a WCAG violation', async ({ page }, testInfo) => {
    await boot(page);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.setAttribute('data-testid', 'qa-nameless');
      document.querySelector('main')?.append(button);
    });
    const outcome = await audit(page, testInfo, 'planted nameless button');
    expect(
      outcome.blocking.some((line) => line.startsWith('button-name (critical)')),
      outcome.blocking.join('\n'),
    ).toBe(true);
  });

  test('a small control, sideways scrolling, a cut-off control and a broken word are reported', async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      // Planted after the game's own screen, so they change nothing on it.
      const small = document.createElement('button');
      small.textContent = 'x';
      small.setAttribute('data-testid', 'qa-small');
      small.style.cssText = 'min-height:0;min-width:0;width:30px;height:30px;padding:0';
      const wide = document.createElement('div');
      wide.style.cssText = 'width:3000px;height:4px';
      const frame = document.createElement('div');
      frame.style.cssText = 'width:60px;height:60px;overflow:hidden';
      const clipped = document.createElement('button');
      clipped.textContent = 'cut off';
      clipped.setAttribute('data-testid', 'qa-clipped');
      clipped.style.cssText = 'margin-left:40px;width:120px;height:60px';
      frame.append(clipped);
      const narrow = document.createElement('p');
      narrow.setAttribute('data-testid', 'qa-narrow');
      narrow.style.cssText = 'width:2.5em;overflow-wrap:anywhere';
      narrow.textContent = 'Krakatice';
      document.body.append(small, wide, frame, narrow);
    });
    const problems = await layoutProblems(page);
    const has = (pattern: RegExp): boolean => problems.some((problem) => pattern.test(problem));
    expect(has(/<button qa-small> "x" is 30×30px, under 48px/), problems.join('\n')).toBe(true);
    expect(has(/^the page scrolls sideways/), problems.join('\n')).toBe(true);
    expect(has(/<button qa-clipped> "cut off" is cut off by/), problems.join('\n')).toBe(true);
    expect(has(/the word "Krakatice" breaks as "Kr.* \/ .*"/), problems.join('\n')).toBe(true);
  });

  test('a clean title has no layout problems (the checks do not cry wolf)', async ({ page }) => {
    await boot(page);
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('a resized page is measured at its new size, its 100dvh floors caught up', async ({
    page,
  }) => {
    // Measured as soon as the window reports a new size, the page's `100dvh` floors mostly keep
    // the old window's height for a moment, in every engine; resize() waits until they follow.
    await boot(page);
    for (const [width, height] of [
      [1024, 768],
      [1440, 900],
      [390, 844],
      [1280, 800],
      [1024, 768],
    ] as const) {
      await resize(page, width, height);
      const floors = await page.evaluate(() =>
        ['body', '#app'].map((selector) =>
          parseFloat(getComputedStyle(document.querySelector(selector)!).minHeight),
        ),
      );
      expect(floors, `the 100dvh floors at ${width} × ${height}`).toEqual([height, height]);
    }
  });
});

test.describe('the audio probe sees what the page plays', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(audioProbe);
  });

  test('a context, a decoded mono buffer, a loop started and stopped', async ({ page }) => {
    await boot(page);
    test.skip(
      !(await hasWebAudio(page)),
      'This engine has no Web Audio (Playwright’s WebKit on Windows).',
    );
    // Silence of a length no manifest sound has, so the probe cannot take it for one of them.
    const seconds = [0.25, 1.1, 2.2].find((length) => soundOf(length).startsWith('unknown'));
    if (seconds === undefined) throw new Error('every planted length is a manifest sound’s');
    const planted = Math.round(seconds * 48_000);
    await page.evaluate(async (samples) => {
      // The silence as a 48 kHz mono 16-bit WAV, made here.
      const bytes = new DataView(new ArrayBuffer(44 + samples * 2));
      const tag = (at: number, text: string): void => {
        for (let index = 0; index < 4; index++) bytes.setUint8(at + index, text.charCodeAt(index));
      };
      tag(0, 'RIFF');
      bytes.setUint32(4, 36 + samples * 2, true);
      tag(8, 'WAVE');
      tag(12, 'fmt ');
      bytes.setUint32(16, 16, true);
      bytes.setUint16(20, 1, true);
      bytes.setUint16(22, 1, true);
      bytes.setUint32(24, 48_000, true);
      bytes.setUint32(28, 96_000, true);
      bytes.setUint16(32, 2, true);
      bytes.setUint16(34, 16, true);
      tag(36, 'data');
      bytes.setUint32(40, samples * 2, true);
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(bytes.buffer);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(context.destination);
      source.start();
      source.stop();
      await context.close();
    }, planted);
    const log = await audioLog(page);
    expect(log.contexts, 'the context the page made').toBe(1);
    expect(
      log.decoded.map((buffer) => [Math.round(buffer.duration * 100) / 100, buffer.channels]),
    ).toEqual([[seconds, 1]]);
    expect(log.started.map((played) => played.loop)).toEqual([true]);
    expect(log.stopped).toHaveLength(1);
    expect(soundOf(log.started[0]!.duration), 'no manifest sound is this long').toBe(
      `unknown (${seconds.toFixed(2)} s)`,
    );
  });
});

/** The two manifest sounds closest in length (with the effects, several are equally long). */
function closestInLength(sounds: readonly ManifestSound[]): [ManifestSound, ManifestSound] {
  let best: [ManifestSound, ManifestSound] | undefined;
  for (const [index, first] of sounds.entries()) {
    for (const second of sounds.slice(index + 1)) {
      const gap = Math.abs(first.durationSeconds - second.durationSeconds);
      if (!best || gap < Math.abs(best[0].durationSeconds - best[1].durationSeconds)) {
        best = [first, second];
      }
    }
  }
  if (!best) throw new Error('the audio manifest has fewer than two sounds');
  return best;
}

test.describe('the audio probe names a sound by its file', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(audioProbe);
  });

  test('the two sounds closest in length are told apart by their files', async ({ page }) => {
    await boot(page);
    test.skip(
      !(await hasWebAudio(page)),
      'This engine has no Web Audio (Playwright’s WebKit on Windows).',
    );
    const pair = closestInLength(AUDIO_MANIFEST.sounds);
    await page.evaluate(
      async (sources) => {
        const context = new AudioContext();
        for (const src of sources) {
          const data = await (await fetch(src)).arrayBuffer();
          const source = context.createBufferSource();
          source.buffer = await context.decodeAudioData(data);
          source.connect(context.destination);
          source.start();
          source.stop();
        }
        await context.close();
      },
      pair.map((sound) => sound.src),
    );
    const log = await audioLog(page);
    expect(
      log.decoded.map((buffer) => buffer.encoded),
      'the decoded files’ sizes',
    ).toEqual(pair.map((sound) => sound.bytes));
    expect(await startedSounds(page), 'each sound named by its file').toEqual(
      pair.map((sound) => sound.id),
    );
    if (Math.abs(pair[0].durationSeconds - pair[1].durationSeconds) < 0.05) {
      expect(soundOf(pair[0].durationSeconds), 'a length two sounds share names neither').toMatch(
        /^one of /,
      );
    }
  });
});
