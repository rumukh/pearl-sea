/**
 * What the suite knows is wrong, and tolerates on purpose.
 *
 * - KNOWN_ISSUES: guard findings that are not the game's doing (engine noise), by engine.
 * - DEFECTS: product defects found by this suite and sent to their owner (docs/qa/defects.md).
 *   A test states the behaviour it wants and wraps that one assertion in `unlessKnown(...)`:
 *   while the defect reproduces, the test records it as an annotation and carries on; once the
 *   fix lands the assertion simply passes and the report says the marker can go. Nothing here
 *   hides a failure that is not listed.
 *
 * Accessibility findings that are tracked defects live in `a11y.ts` (KNOWN_AXE), layout findings
 * in KNOWN_LAYOUT below. The scheme is Dragon Valley's (its test/e2e/support/known-issues.ts).
 */
import type { TestInfo } from '@playwright/test';
import type { FindingKind } from './guard';

export type Engine = 'chromium' | 'firefox' | 'webkit';

export interface KnownIssue {
  readonly id: string;
  readonly engines: readonly Engine[];
  readonly kind: FindingKind;
  readonly pattern: RegExp;
  readonly reason: string;
}

export const KNOWN_ISSUES: readonly KnownIssue[] = [
  {
    id: 'firefox-bounce-tracking',
    engines: ['firefox'],
    kind: 'console',
    pattern: /has been classified as a bounce tracker/,
    reason:
      'Firefox’s bounce-tracking protection warns about the test server (127.0.0.1), whose pages a test opens and stores to without a person’s tap first; the game writes nothing to the console',
  },
];

export function knownIssuesFor(browserName: string): KnownIssue[] {
  return KNOWN_ISSUES.filter((issue) => (issue.engines as readonly string[]).includes(browserName));
}

/** The sessions that own the game's parts (docs/plan.md §8), and the SDK upstream. */
export type Owner = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'SDK';
export type Severity = 'blocker' | 'major' | 'minor';

export interface Defect {
  readonly owner: Owner;
  readonly severity: Severity;
  readonly title: string;
  /** Only these engines show it; on the others its assertions stay strict. */
  readonly engines?: readonly Engine[];
  /**
   * It shows only under some timings (everywhere, or on these engines), so a passing check there
   * is not taken for a fix.
   */
  readonly intermittent?: boolean | readonly Engine[];
}

/**
 * Open defects (docs/qa/defects.md has each one's repro and owner). Fixed ones leave this list
 * once their fix is verified on every engine; the assertions that pinned them stay in the specs
 * as plain regression checks.
 */
export const DEFECTS = {
  'PS-QA-01': {
    owner: 'S4',
    severity: 'major',
    title:
      'Ulita slov: the cut points between letters are 19-43 px wide, under the 48 px touch target',
  },
  'PS-QA-04': {
    owner: 'S4',
    severity: 'major',
    title:
      'The grotto does not fit a landscape tablet: at 1280 × 800 its places (map, U Mrože, gallery …) start below the fold; at 1024 × 768 it falls to one column 1,400-1,570 px tall',
  },
  'PS-QA-05': {
    owner: 'S4',
    severity: 'major',
    title:
      'Rounds, boards and results need scrolling on a landscape tablet: at 1024 × 768 a miss puts Dál 250 px below the fold and an Inkoustík pushes the letter pad down (up to 1,090 px); a picked Slovní rodinka is 844 px at 1280 × 800',
  },
  'PS-QA-06': {
    owner: 'S4',
    severity: 'major',
    title:
      'Pexeso never says what makes a pair (a word and its plural, its family, its opposite …); the other boards say what to do',
  },
  'PS-QA-07': {
    owner: 'S4',
    severity: 'minor',
    title: 'On the title, the focus ring around Hrát cuts through the tagline’s last line',
  },
  'PS-QA-08': {
    owner: 'S4',
    severity: 'minor',
    title:
      'At 200 % text on a phone, rounds scroll sideways (Nápověda sticks out of the screen) and U Mrože’s greeting does not wrap',
  },
  'PS-QA-09': {
    owner: 'S4',
    severity: 'major',
    title:
      'With less motion (the device’s or the child’s Méně pohybu), a fish dragged onto a net often swims back to the pool; tapping works',
    intermittent: true,
  },
} as const satisfies Record<string, Defect>;

export type DefectId = keyof typeof DEFECTS;

export interface KnownLayout {
  readonly defect: DefectId;
  /** Where the problem shows: matched against "<stop or state> (<viewport>)". */
  readonly where: RegExp;
  /** The problem line from support/layout.ts. */
  readonly problem: RegExp;
}

export const KNOWN_LAYOUT: readonly KnownLayout[] = [
  { defect: 'PS-QA-01', where: /word-shell/, problem: /^<button cut-\d+> .* under 48px$/ },
  {
    defect: 'PS-QA-04',
    where: /^\d\d-(grotto-[a-z-]+|chest) \((small )?tablet landscape\)$/,
    problem: /^the page is \d+ px tall in the \d+ px window$/,
  },
  {
    defect: 'PS-QA-05',
    where: /^\d\d-(?!grotto|chest)[a-z-]+ \((small )?tablet landscape\)$/,
    problem: /^the page is \d+ px tall in the \d+ px window$/,
  },
  {
    defect: 'PS-QA-08',
    where: /^text-200\/\d\d-[a-z-]+ \(phone portrait\)$/,
    problem:
      /^(the page scrolls sideways: .*|<button round-hint> "Nápověda" sticks out of the 390px viewport .*)$/,
  },
];

/** The engine a test runs on: its project's browser (Edge and Chrome channels are Chromium). */
export function engineOf(testInfo: TestInfo): string {
  const use = testInfo.project.use;
  return use.browserName ?? use.defaultBrowserType ?? 'chromium';
}

/** Whether `id` can show on this test's engine (an engine-specific defect stays strict elsewhere). */
export function defectApplies(testInfo: TestInfo, id: DefectId): boolean {
  const engines: readonly string[] | undefined = (DEFECTS[id] as Defect).engines;
  return engines === undefined || engines.includes(engineOf(testInfo));
}

/** Whether a defect shows only under some timings on this test's engine. */
function intermittentHere(testInfo: TestInfo, defect: Defect): boolean {
  const { intermittent } = defect;
  return typeof intermittent === 'object'
    ? (intermittent as readonly string[]).includes(engineOf(testInfo))
    : intermittent === true;
}

/** Split layout problems into unknown ones (failures) and known defects (annotated). */
export function knownLayout(
  testInfo: TestInfo,
  where: string,
  problems: readonly string[],
): string[] {
  const unknown: string[] = [];
  for (const problem of problems) {
    const known = KNOWN_LAYOUT.find(
      (entry) =>
        entry.where.test(where) &&
        entry.problem.test(problem) &&
        defectApplies(testInfo, entry.defect),
    );
    if (!known) {
      unknown.push(problem);
      continue;
    }
    const defect: Defect = DEFECTS[known.defect];
    testInfo.annotations.push({
      type: 'known defect',
      description: `${known.defect} (${defect.severity}, ${defect.owner}) on ${where}: ${problem}`,
    });
  }
  return unknown;
}

/**
 * Run `assertion` (the behaviour the game should have). If it fails and `id` is a listed
 * defect, record that the defect still reproduces instead of failing; if it passes, record
 * that the marker can be removed. A defect listed for some engines only fails as usual on the
 * others.
 */
export async function unlessKnown(
  testInfo: TestInfo,
  id: DefectId,
  assertion: () => Promise<void>,
): Promise<void> {
  const defect: Defect = DEFECTS[id];
  if (!defectApplies(testInfo, id)) {
    await assertion();
    return;
  }
  try {
    await assertion();
    testInfo.annotations.push(
      intermittentHere(testInfo, defect)
        ? {
            type: 'defect not seen this time',
            description: `${id} did not show in this run (it shows only under some timings): ${defect.title}`,
          }
        : {
            type: 'defect fixed?',
            description: `${id} did not reproduce; remove its marker if it is fixed: ${defect.title}`,
          },
    );
  } catch {
    testInfo.annotations.push({
      type: 'known defect',
      description: `${id} (${defect.severity}, ${defect.owner}): ${defect.title}`,
    });
  }
}
