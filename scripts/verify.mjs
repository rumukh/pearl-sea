// @ts-check
/**
 * The one local and CI gate:
 *
 *   npm run verify                      run every step (all steps run; any failure fails the gate)
 *   node scripts/verify.mjs --only typecheck      run the steps whose id starts with "typecheck"
 *   node scripts/verify.mjs --audit .verify-report.json   re-check a finished run's record
 *
 * Every tool is started directly with `process.execPath` (no shell, no npm `&&` chain), so each
 * exit code is observed by this process. The run is recorded step by step in .verify-report.json,
 * and the Vitest JSON report is audited: every test file on disk must have run, nothing may be
 * skipped, and at least one test must have passed. The CI workflow audits the record again in a
 * separate step, outside npm, so a lost exit code cannot turn a failed gate green.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isMain, repositoryRoot, runNode, tools } from './lib/tools.mjs';
import { listFiles } from './lib/site.mjs';

const REPORT_FORMAT = 'pearl-sea-verify/1';
const REPORT = join(repositoryRoot, '.verify-report.json');
const VITEST_REPORT = join(repositoryRoot, '.vitest-report.json');

/**
 * @typedef {{ id: string; label: string; args: string[]; audit?: () => string[] }} Step
 * @typedef {{ id: string; label: string; status: 'passed' | 'failed'; exitCode: number; problems: string[]; seconds: number }} StepResult
 */

/** @type {Step[]} */
export const STEPS = [
  {
    id: 'build',
    label: 'Build the static site (dist-site)',
    args: ['scripts/build.mjs', '--clean', '--out', 'dist-site'],
  },
  {
    id: 'typecheck:rules',
    label: 'Typecheck rules (ES2022 only: no DOM, no Node)',
    args: [tools.tsc, '-p', 'src/rules/tsconfig.json', '--pretty', 'false'],
  },
  {
    id: 'typecheck:app',
    label: 'Typecheck browser shell (DOM)',
    args: [tools.tsc, '-p', 'src/app/tsconfig.json', '--pretty', 'false'],
  },
  {
    id: 'typecheck:worker',
    label: 'Typecheck offline worker (WebWorker)',
    args: [tools.tsc, '-p', 'src/app/tsconfig.worker.json', '--pretty', 'false'],
  },
  {
    id: 'typecheck:tests',
    label: 'Typecheck tests, configs and @ts-check scripts',
    args: [tools.tsc, '-p', 'test/tsconfig.json', '--pretty', 'false'],
  },
  {
    id: 'lint',
    label: 'Lint (determinism, dependency boundaries, golden-hash rules)',
    args: [tools.eslint, '.', '--max-warnings', '0'],
  },
  {
    id: 'format',
    label: 'Format check (Prettier)',
    args: [tools.prettier, '--check', '.', '--log-level', 'warn'],
  },
  {
    id: 'content',
    label: 'Validate catalogs, typography, font coverage, content pack and curriculum coverage',
    args: ['scripts/validate-content.mjs', '--strict-coverage'],
  },
  {
    id: 'lexicon',
    label: 'Check the Czech word bank (spelling points, families, forms, sentences)',
    args: ['scripts/lexicon/check.mjs'],
  },
  {
    id: 'audio',
    label:
      'Check the audio pack (manifest up to date, mono 48 kHz Vorbis, effects encoded from their recipes, whole-frame loops, budget)',
    args: ['scripts/audio/manifest.mjs', '--check'],
  },
  {
    id: 'art',
    label: 'Check the art catalog (up to date, every file measured, IDs and anchors, budget)',
    args: ['scripts/art/catalog.mjs', '--check'],
  },
  {
    id: 'test',
    label: 'Unit, trace and tooling tests (Vitest)',
    args: [
      tools.vitest,
      'run',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${relative(repositoryRoot, VITEST_REPORT)}`,
    ],
    audit: auditVitest,
  },
  {
    id: 'lockfile',
    label: 'Lockfile resolves from registry.npmjs.org',
    args: ['scripts/canonicalise-lockfile.mjs'],
  },
];

/** Problems with the Vitest JSON report: absent, failing, skipping, or not covering every file. */
export function auditVitest() {
  if (!existsSync(VITEST_REPORT)) return ['Vitest wrote no JSON report.'];
  /** @type {{ success?: boolean; numTotalTests?: number; numPassedTests?: number; numFailedTests?: number; numPendingTests?: number; numTodoTests?: number; testResults?: { name: string; status: string }[] }} */
  const report = JSON.parse(readFileSync(VITEST_REPORT, 'utf8'));
  const problems = [];
  if (report.success !== true) problems.push('Vitest reported success: false.');
  if (!report.numPassedTests)
    problems.push('No test passed: a gate that ran nothing is not green.');
  if (report.numFailedTests) problems.push(`${report.numFailedTests} test(s) failed.`);
  if (report.numPendingTests || report.numTodoTests) {
    problems.push(
      `${(report.numPendingTests ?? 0) + (report.numTodoTests ?? 0)} test(s) were skipped or todo.`,
    );
  }
  if (report.numPassedTests !== report.numTotalTests) {
    problems.push(`${report.numPassedTests} of ${report.numTotalTests} tests passed.`);
  }
  const ran = new Set(
    (report.testResults ?? []).map((result) =>
      relative(repositoryRoot, result.name).split(sep).join('/'),
    ),
  );
  const onDisk = listFiles(join(repositoryRoot, 'test'))
    .filter((path) => path.endsWith('.test.ts') && !path.startsWith('e2e/'))
    .map((path) => `test/${path}`);
  const missing = onDisk.filter((path) => !ran.has(path));
  if (missing.length) problems.push(`Test files that never ran: ${missing.join(', ')}`);
  for (const result of report.testResults ?? []) {
    if (result.status !== 'passed') problems.push(`${result.name}: ${result.status}`);
  }
  return problems;
}

/** @param {StepResult[]} results */
function writeReport(results) {
  writeFileSync(
    REPORT,
    JSON.stringify({ format: REPORT_FORMAT, expected: STEPS.map((s) => s.id), results }, null, 2) +
      '\n',
  );
}

/** @param {string | undefined} only */
export function runVerify(only) {
  const steps = STEPS.filter((step) => !only || step.id.startsWith(only));
  if (steps.length === 0) throw new Error(`No verify step matches "${only}".`);
  rmSync(REPORT, { force: true });
  rmSync(VITEST_REPORT, { force: true });
  /** @type {StepResult[]} */
  const results = [];
  for (const step of steps) {
    console.log(`\n=== ${step.id}: ${step.label}`);
    const started = process.hrtime.bigint();
    const exitCode = runNode(step.args);
    const problems = exitCode === 0 && step.audit ? step.audit() : [];
    for (const problem of problems) console.error(`  ${problem}`);
    results.push({
      id: step.id,
      label: step.label,
      status: exitCode === 0 && problems.length === 0 ? 'passed' : 'failed',
      exitCode,
      problems,
      seconds: Number((process.hrtime.bigint() - started) / 1_000_000n) / 1000,
    });
    if (!only) writeReport(results);
  }
  console.log('\n=== summary');
  for (const result of results) {
    console.log(
      `${result.status === 'passed' ? 'PASS' : 'FAIL'}  ${result.id.padEnd(18)} ${result.seconds.toFixed(1).padStart(6)}s  ${result.label}`,
    );
  }
  const failed = results.filter((result) => result.status !== 'passed');
  console.log(failed.length ? `\n${failed.length} step(s) failed.` : '\nAll steps passed.');
  return failed.length === 0;
}

/** @param {string} path */
export function auditReport(path) {
  if (!existsSync(path)) return [`${path} does not exist: verify did not run to completion.`];
  const report = JSON.parse(readFileSync(path, 'utf8'));
  const problems = [];
  if (report.format !== REPORT_FORMAT) problems.push(`${path} is not a ${REPORT_FORMAT} record.`);
  /** @type {StepResult[]} */
  const results = report.results ?? [];
  for (const id of STEPS.map((step) => step.id)) {
    const result = results.find((candidate) => candidate.id === id);
    if (!result) problems.push(`Step ${id} never ran.`);
    else if (result.status !== 'passed' || result.exitCode !== 0) {
      problems.push(`Step ${id} failed (exit ${result.exitCode}). ${result.problems.join(' ')}`);
    }
  }
  return [...problems, ...auditVitest()];
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--audit') {
    const problems = auditReport(join(repositoryRoot, args[1] ?? '.verify-report.json'));
    for (const problem of problems) console.error(problem);
    console.log(problems.length ? 'Verify audit FAILED.' : 'Verify audit passed.');
    process.exit(problems.length ? 1 : 0);
  }
  const only = args[0] === '--only' ? args[1] : undefined;
  if (args.length && args[0] !== '--only') {
    console.error(`Unknown option: ${args[0]}`);
    process.exit(2);
  }
  process.exit(runVerify(only) ? 0 : 1);
}
