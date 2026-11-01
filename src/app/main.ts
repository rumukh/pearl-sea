/**
 * Boot. Readiness is real: the boot status turns "ready" only after the family record was read
 * (or found unreadable, which shows the recovery screen), the game's content pack and strings
 * were validated (with rules on main), the reading font loaded (or its short wait ran out), and
 * the first screen is mounted and painted. The audio manifest and the art catalog are read first
 * (a missing or broken one means a silent game or placeholder art, never a failed boot); the
 * title's painting then loads alongside the content, so the title never shows without it. Nothing
 * is exposed on `window`, the console gets a line only when the browser's sound service refuses
 * the sound pack (see `audio/game-audio.ts`), and uncaught errors land on the error screen.
 *
 * The hidden `boot-status` element is the readiness signal for tests and tools: `data-state`
 * (`loading`, `ready`, `failed`), `data-screen` (the current screen), `data-font`, `data-base`
 * (the deployment base), `data-content` (the content pack's revision, once there is one) and
 * `data-audio` (the game audio's status).
 */
import { applyPresentationPreferences } from '@aegis/browser/ui';
import { requireValue, schema } from '@aegis/runtime';
import { loadArtLibrary, preloadPictures } from './art/library';
import { loadAudioMap } from './audio/manifest';
import { createHistoryLoader } from './content/history';
import { loadContentPack } from './content/load';
import { loadContentCatalogs } from './content/text';
import { loadFonts } from './design/fonts';
import { applyTokens } from './design/tokens';
import { pearlSeaGame } from './game/definition';
import { RULES } from './game/rules';
import { DEFAULT_PRESENTATION } from './persistence/preferences';
import { RecoveryRequired } from './persistence/recovery';
import type { ScreenEntry } from './router/router';
import { createScreens } from './screens';
import { createApp, STARTUP_FAILURE } from './shell/app';
import type { AppEnvironment } from './shell/app';
import { afterPaint, h } from './ui/dom';
import { ART } from '../rules/contract';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/game.css';

const basePath = schema.string({
  minLength: 1,
  maxLength: 200,
  pattern: /^\/(?:[A-Za-z0-9_-]+\/)*$/,
});

function readEnvironment(): AppEnvironment {
  const base = document.querySelector<HTMLMetaElement>('meta[name="ps-base"]')?.content;
  const revision = document.querySelector<HTMLMetaElement>(
    'meta[name="ps-offline-revision"]',
  )?.content;
  if (base === undefined || !revision) throw new Error('The page shell is incomplete.');
  const valid = requireValue(basePath.parse(base, 'ps-base'));
  return { base: valid, baseUrl: new URL(valid, location.origin).href, revision };
}

function createBootStatus(): HTMLElement {
  const status = h('div', { testId: 'boot-status', dataset: { state: 'loading' } });
  status.hidden = true;
  document.body.append(status);
  return status;
}

/** Without a working shell there is no router; show one calm line and a retry. */
function showStartupFailure(root: HTMLElement, status: HTMLElement): void {
  const retry = h('button', {
    className: 'ps-button ps-button--sun',
    text: STARTUP_FAILURE.retry,
    testId: 'startup-retry',
    attributes: { type: 'button' },
  });
  retry.addEventListener('click', () => location.reload());
  root.replaceChildren(
    h(
      'main',
      { className: 'ps-screen ps-field-abyss ps-recovery', testId: 'startup-failure' },
      h(
        'div',
        { className: 'ps-card ps-recovery__card' },
        h('h1', { text: STARTUP_FAILURE.heading }),
        h('p', { text: STARTUP_FAILURE.body }),
        retry,
      ),
    ),
  );
  root.removeAttribute('aria-busy');
  status.dataset['state'] = 'failed';
}

/** The game's content pack and the strings it uses, checked against each other. */
async function loadGameContent(baseUrl: string) {
  const pack = await loadContentPack(baseUrl);
  return { pack, catalogs: await loadContentCatalogs(baseUrl, pack.data) };
}

async function boot(root: HTMLElement, status: HTMLElement): Promise<void> {
  applyTokens(document.documentElement);
  applyPresentationPreferences(document.documentElement, DEFAULT_PRESENTATION);
  let env: AppEnvironment;
  try {
    env = readEnvironment();
  } catch {
    showStartupFailure(root, status);
    return;
  }
  const fonts = loadFonts(env.baseUrl);
  const [audioMap, art] = await Promise.all([
    loadAudioMap(env.baseUrl),
    loadArtLibrary(env.baseUrl),
  ]);
  // The title's painting loads while the content does, so the first screen is there with it.
  void preloadPictures(art, [ART.scene('title')]);
  const app = createApp({ env, root, bootStatus: status, audioMap, art });
  app.screens = createScreens(app);
  // With rules, the game's content (the pack and its strings) loads while the family record
  // opens: on a slow device both take seconds. A failure waits for its turn below (a handler is
  // attached at once, so it never counts as an unhandled rejection).
  const content = RULES ? loadGameContent(env.baseUrl) : null;
  content?.catch(() => undefined);
  let first: ScreenEntry;
  try {
    await app.family.open();
    if (RULES && content) {
      const { pack, catalogs } = await content;
      app.useContent(
        pearlSeaGame(RULES, pack, [], createHistoryLoader(env.baseUrl, pack)),
        catalogs,
      );
      status.dataset['content'] = pack.revision;
    }
    first = app.screens.title();
  } catch (error) {
    // An unreadable family record asks a grown-up; nothing is replaced by itself.
    first =
      error instanceof RecoveryRequired ? app.screens.recovery(error) : app.screens.error(error);
  }
  status.dataset['font'] = await fonts;
  await app.router.reset(first);
  await afterPaint();
  status.dataset['base'] = env.base;
  app.setBootState('ready');
}

const status = createBootStatus();
const root = document.querySelector<HTMLElement>('#app');
if (root) {
  void boot(root, status).catch(() => showStartupFailure(root, status));
}
