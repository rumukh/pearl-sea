/**
 * Boot of the foundations shell. It reads the deployment base and offline revision from the page,
 * loads the reading font and the Czech UI catalog, and shows the title screen. Readiness is real:
 * the boot status turns "ready" only after the catalog was loaded and validated, the font loaded
 * (or its short wait ran out), and the title screen is mounted and painted. Nothing is exposed on
 * `window`, nothing is written to the console, and no browser storage is touched.
 *
 * S4 (app) replaces this with the full shell ported from Dragon Valley: router, family profiles,
 * saves, the grown-ups' area and offline installation.
 */
import { requireValue, schema } from '@aegis/runtime';
import { loadFonts } from './design/fonts';
import type { FontStatus } from './design/fonts';
import { loadCatalog, text } from './i18n/catalog';
import type { Catalog } from './i18n/catalog';
import { keepOneLetterWordsWithNext } from './i18n/typography';
import './styles/base.css';
import './styles/title.css';

const basePath = schema.string({
  minLength: 1,
  maxLength: 200,
  pattern: /^\/(?:[A-Za-z0-9_-]+\/)*$/,
});

/** Shown when nothing else can be: the catalog may be what failed, so these strings are built in. */
const STARTUP_FAILURE = {
  heading: 'Hra se nespustila',
  body: 'Zkus to prosím znovu. Když to nepůjde, zavolej dospělého.',
  retry: 'Zkusit znovu',
} as const;

interface Environment {
  readonly base: string;
  readonly baseUrl: string;
  readonly revision: string;
}

function readEnvironment(): Environment {
  const base = document.querySelector<HTMLMetaElement>('meta[name="ps-base"]')?.content;
  const revision = document.querySelector<HTMLMetaElement>(
    'meta[name="ps-offline-revision"]',
  )?.content;
  if (base === undefined || !revision) throw new Error('The page shell is incomplete.');
  const valid = requireValue(basePath.parse(base, 'ps-base'));
  return { base: valid, baseUrl: new URL(valid, location.origin).href, revision };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { className?: string; text?: string; testId?: string; hidden?: boolean } = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = keepOneLetterWordsWithNext(options.text);
  if (options.testId) node.dataset['testid'] = options.testId;
  if (options.hidden) node.hidden = true;
  node.append(...children);
  return node;
}

/** One frame after the next paint, so "ready" means the screen is really on the glass. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function bootStatus(): HTMLElement {
  const status = element('div', { testId: 'boot-status', hidden: true });
  status.dataset['state'] = 'loading';
  document.body.append(status);
  return status;
}

function titleScreen(catalog: Catalog): HTMLElement {
  const pearls = element(
    'ul',
    { className: 'ps-title__pearls' },
    ...['i', 'í', 'y', 'ý'].map((letter) => element('li', { className: 'ps-pearl', text: letter })),
  );
  pearls.setAttribute('aria-hidden', 'true');
  const bubbles = element(
    'div',
    { className: 'ps-title__bubbles' },
    ...Array.from({ length: 12 }, () => element('span', { className: 'ps-bubble' })),
  );
  bubbles.setAttribute('aria-hidden', 'true');
  return element(
    'main',
    { className: 'ps-screen ps-title', testId: 'title-screen' },
    bubbles,
    element(
      'div',
      { className: 'ps-title__card' },
      element('h1', { className: 'ps-title__name', text: text(catalog, 'app.title') }),
      element('p', { className: 'ps-title__subtitle', text: text(catalog, 'title.subtitle') }),
      pearls,
      element('p', { className: 'ps-title__tagline', text: text(catalog, 'title.tagline') }),
      element('p', { className: 'ps-title__soon', text: text(catalog, 'title.soon') }),
    ),
  );
}

function startupFailure(root: HTMLElement): void {
  const retry = element('button', {
    className: 'ps-button',
    text: STARTUP_FAILURE.retry,
    testId: 'startup-retry',
  });
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  root.replaceChildren(
    element(
      'main',
      { className: 'ps-screen ps-failure', testId: 'startup-failure' },
      element(
        'div',
        { className: 'ps-title__card' },
        element('h1', { text: STARTUP_FAILURE.heading }),
        element('p', { text: STARTUP_FAILURE.body }),
        retry,
      ),
    ),
  );
  root.removeAttribute('aria-busy');
}

async function boot(status: HTMLElement): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) return;
  let env: Environment;
  try {
    env = readEnvironment();
  } catch {
    startupFailure(root);
    status.dataset['state'] = 'failed';
    return;
  }
  const fonts: Promise<FontStatus> = loadFonts(env.baseUrl);
  let catalog: Catalog;
  try {
    catalog = await loadCatalog(env.baseUrl, 'cs');
  } catch {
    await fonts;
    startupFailure(root);
    status.dataset['state'] = 'failed';
    return;
  }
  const font = await fonts;
  root.replaceChildren(titleScreen(catalog));
  root.removeAttribute('aria-busy');
  await afterPaint();
  status.dataset['font'] = font;
  status.dataset['screen'] = 'title';
  status.dataset['base'] = env.base;
  status.dataset['state'] = 'ready';
}

const status = bootStatus();
void boot(status).catch(() => {
  const root = document.querySelector<HTMLElement>('#app');
  if (root) startupFailure(root);
  status.dataset['state'] = 'failed';
});
