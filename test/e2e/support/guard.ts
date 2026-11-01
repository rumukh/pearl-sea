/**
 * The global guards every end-to-end test runs under (docs/testing.md §5, "Guards").
 *
 * Perlové moře is a child-safe, offline game: it writes nothing to the console, never throws an
 * unhandled error, loads only its own same-origin files, never links out and never phones home.
 * The guard watches a whole browser context (every page, and service-worker traffic where the
 * engine reports it) and records anything that breaks one of those promises:
 *
 * - `console`: any console message from a page, of any level (the shell writes none);
 * - `page-error`: an uncaught exception or unhandled rejection, or the game's own error screen
 *   (the shell catches what nothing else did and shows it instead);
 * - `foreign-request`: a request to any origin but the game's;
 * - `failed-request`: a request that failed or was answered 4xx/5xx (a request the browser
 *   cancels, because its page moved on or the game no longer needs it, is only noted);
 * - `outbound`: an element whose URL attribute leaves the origin (links, forms, media, embeds,
 *   `mailto:`/`tel:`/`javascript:` URLs), seen by a MutationObserver from the first parsed node;
 * - `window-open`, `network-api` (`sendBeacon`, `WebSocket`, `EventSource`, `RTCPeerConnection`),
 *   `csp` (a Content-Security-Policy violation) and `navigation` (the page left the origin).
 *
 * A test that provokes a finding on purpose declares it with `guard.allow(kind, pattern, reason)`;
 * engine noise that is not the game's fault is declared once in `known-issues.ts`. The guard is
 * Dragon Valley's (its test/e2e/support/guard.ts), under this game's names.
 */
import { expect } from '@playwright/test';
import type { BrowserContext, ConsoleMessage, Page, TestInfo } from '@playwright/test';

export const FINDING_KINDS = [
  'console',
  'page-error',
  'foreign-request',
  'failed-request',
  'outbound',
  'window-open',
  'network-api',
  'csp',
  'navigation',
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  readonly kind: FindingKind;
  readonly detail: string;
}

export interface Allowance {
  readonly kind: FindingKind;
  readonly pattern: RegExp;
  readonly reason: string;
}

const LABELS: Record<FindingKind, string> = {
  console: 'console messages (the game writes none)',
  'page-error': 'uncaught page errors or rejections, or the game’s error screen',
  'foreign-request': 'requests to another origin',
  'failed-request': 'failed or 4xx/5xx requests',
  outbound: 'outbound links or URLs in the page',
  'window-open': 'window.open calls',
  'network-api': 'beacons, sockets or peer connections',
  csp: 'Content-Security-Policy violations',
  navigation: 'navigations away from the game',
};

/** Error texts engines use for a request cancelled by its own page (navigation, reload, close). */
const CANCELLED = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled|canceled|aborted/i;
/** The browser's own pages, such as Edge's downloads hub, opened in the context by the browser. */
const BROWSER_PAGE = /^(edge|chrome|devtools):/i;

export function isWebUrl(url: string): boolean {
  return /^(https?|wss?):/i.test(url);
}

export class Guard {
  private readonly found: Finding[] = [];
  private readonly noted: string[] = [];
  private readonly allowances: Allowance[] = [];
  private open = true;

  private readonly origins: Set<string>;

  constructor(readonly origin: string) {
    this.origins = new Set([origin]);
  }

  /** Another origin that serves this same game (a private server a test starts and stops). */
  addOrigin(origin: string): void {
    this.origins.add(origin);
  }

  /** True for web URLs outside the game's own origin(s). */
  isForeign(url: string): boolean {
    return isWebUrl(url) && !this.origins.has(new URL(url).origin);
  }

  record(kind: FindingKind, detail: string): void {
    if (this.open) this.found.push({ kind, detail });
  }

  /** Something worth knowing that is not a failure (a request the page itself cancelled). */
  note(detail: string): void {
    if (this.open) this.noted.push(detail);
  }

  notes(): readonly string[] {
    return this.noted;
  }

  /** Tolerate findings this test provokes on purpose. The reason is kept in the report. */
  allow(kind: FindingKind, pattern: RegExp, reason: string): void {
    this.allowances.push({ kind, pattern, reason });
  }

  all(): readonly Finding[] {
    return this.found;
  }

  allowed(finding: Finding): Allowance | undefined {
    return this.allowances.find(
      (allowance) => allowance.kind === finding.kind && allowance.pattern.test(finding.detail),
    );
  }

  unexpected(): Finding[] {
    return this.found.filter((finding) => !this.allowed(finding));
  }

  /** Assert that nothing unexpected happened so far, one named list per kind of finding. */
  expectClean(when = 'during the test'): void {
    const unexpected = this.unexpected();
    for (const kind of FINDING_KINDS) {
      const details = unexpected.filter((finding) => finding.kind === kind).map((f) => f.detail);
      expect.soft(details, `${LABELS[kind]} ${when}`).toEqual([]);
    }
  }

  close(): void {
    this.open = false;
  }

  async attachReport(testInfo: TestInfo): Promise<void> {
    const report = {
      origins: [...this.origins],
      findings: this.found.map((finding) => ({
        ...finding,
        allowedBecause: this.allowed(finding)?.reason ?? null,
      })),
      allowances: this.allowances.map((allowance) => ({
        kind: allowance.kind,
        pattern: String(allowance.pattern),
        reason: allowance.reason,
      })),
      notes: this.noted,
    };
    await testInfo.attach('qa-guard.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  }
}

function describeConsole(message: ConsoleMessage): string {
  const where = message.location();
  const at = where.url ? ` @ ${where.url}:${where.lineNumber}` : '';
  return `${message.type()}: ${message.text()}${at}`;
}

/**
 * Runs in every page before any of the game's scripts. It must be self-contained (Playwright
 * serialises it) and reports through the `__psQaReport` binding.
 */
function pageGuard(): void {
  const scope = window as unknown as {
    __psQaReport?: (kind: string, detail: string) => Promise<void>;
  };
  const marker = Symbol.for('pearl-sea.qa.guard');
  const flags = window as unknown as Record<symbol, boolean>;
  if (flags[marker]) return;
  flags[marker] = true;
  const report = (kind: string, detail: string): void => {
    try {
      void scope.__psQaReport?.(kind, detail)?.catch(() => undefined);
    } catch {
      // The binding is gone while the page closes.
    }
  };
  const origin = location.origin;
  const URL_ATTRIBUTES = [
    'href',
    'xlink:href',
    'src',
    'srcset',
    'action',
    'formaction',
    'poster',
    'data',
    'background',
    'cite',
    'longdesc',
    'ping',
    'manifest',
    'codebase',
  ];
  const EMBEDS = ['iframe', 'frame', 'embed', 'object', 'portal'];
  const leaves = (raw: string): boolean => {
    const value = raw.trim();
    if (value === '' || value.startsWith('#')) return false;
    let url: URL;
    try {
      url = new URL(value, document.baseURI);
    } catch {
      return true;
    }
    if (url.protocol === 'data:' || url.protocol === 'about:') return false;
    if (url.protocol === 'blob:') return url.origin !== origin;
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin !== origin;
    return true;
  };
  const candidates = (attribute: string, value: string): string[] => {
    if (attribute === 'srcset') {
      return value.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '');
    }
    if (attribute === 'ping') return value.split(/\s+/);
    return [value];
  };
  const check = (element: Element): void => {
    for (const attribute of URL_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      for (const candidate of candidates(attribute, value)) {
        if (leaves(candidate)) {
          report('outbound', `<${element.localName} ${attribute}="${candidate}">`);
        }
      }
    }
    if (EMBEDS.includes(element.localName)) report('outbound', `<${element.localName}> embed`);
  };
  const scan = (node: Node): void => {
    if (!(node instanceof Element)) return;
    check(node);
    for (const element of node.querySelectorAll('*')) check(element);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') check(record.target as Element);
      else for (const node of record.addedNodes) scan(node);
    }
    // The shell catches what nothing else did and shows its error screen ("Něco se pokazilo"),
    // so an error the game handled that way never reaches the browser's own error events.
    const screen = document.querySelector('[data-testid="screen-error"]:not([data-qa-seen])');
    if (screen) {
      screen.setAttribute('data-qa-seen', '');
      const code = screen.querySelector('[data-testid="error-code"]')?.textContent ?? '';
      report('page-error', `the game showed its error screen (${code.trim()})`);
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: URL_ATTRIBUTES,
  });
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      if (document.documentElement) scan(document.documentElement);
    },
    { once: true },
  );
  document.addEventListener(
    'securitypolicyviolation',
    (event) => report('csp', `${event.violatedDirective} blocked ${event.blockedURI}`),
    true,
  );
  window.open = (url?: string | URL) => {
    report('window-open', String(url ?? ''));
    return null;
  };
  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon = (url: string | URL) => {
      report('network-api', `sendBeacon ${String(url)}`);
      return false;
    };
  }
  const globals = window as unknown as Record<string, unknown>;
  for (const name of ['WebSocket', 'EventSource', 'RTCPeerConnection']) {
    const Original = globals[name];
    if (typeof Original !== 'function') continue;
    globals[name] = new Proxy(Original, {
      construct(target, args) {
        report('network-api', `${name} ${String(args[0] ?? '')}`);
        return Reflect.construct(target, args) as object;
      },
    });
  }
}

/**
 * Watch `context` (pages that exist now and every later one) and report into `guard`.
 *
 * A request the browser cancels (because its page navigated, reloaded or closed, or because the
 * game's audio service dropped a sound it no longer needs) is not a failure; it is kept as a
 * note in the report.
 */
export async function watchContext(context: BrowserContext, guard: Guard): Promise<void> {
  const watchPage = (page: Page): void => {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      if (guard.isForeign(url)) guard.record('navigation', url);
    });
  };
  context.pages().forEach(watchPage);
  context.on('page', watchPage);
  context.on('console', (message) => {
    // The browser's own pages (Edge opens edge://downloads-hub after a download) are not the
    // game: what they write is noted, never a finding.
    const source = message.page()?.url() ?? message.location().url;
    if (BROWSER_PAGE.test(source)) guard.note(`browser page: ${describeConsole(message)}`);
    else guard.record('console', describeConsole(message));
  });
  context.on('weberror', (error) => guard.record('page-error', String(error.error())));
  context.on('request', (request) => {
    const url = request.url();
    if (guard.isForeign(url)) {
      guard.record('foreign-request', `${request.method()} ${url}`);
    }
  });
  context.on('requestfailed', (request) => {
    const text = request.failure()?.errorText ?? 'failed';
    const detail = `${request.method()} ${request.url()} (${text})`;
    if (CANCELLED.test(text)) guard.note(`cancelled: ${detail}`);
    else guard.record('failed-request', detail);
  });
  context.on('response', (response) => {
    if (response.status() >= 400) {
      guard.record(
        'failed-request',
        `${response.request().method()} ${response.url()} (${response.status()})`,
      );
    }
  });
  await context.exposeBinding('__psQaReport', (_source, kind: unknown, detail: unknown) => {
    const known = FINDING_KINDS.find((candidate) => candidate === kind);
    guard.record(known ?? 'page-error', String(detail));
  });
  await context.addInitScript(pageGuard);
}
