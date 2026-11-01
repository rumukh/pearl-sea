// @ts-check
/**
 * Learner simulation:
 *
 *   node scripts/simulate.mjs [--days 84] [--learners perfect,average,struggling,slow]
 *                             [--seed simulation] [--out out/simulation] [--check]
 *                             [--pack content/pearl-sea.content.json] [--grade 3] [--egg <friend>]
 *                             [--balance partial-balance.json] [--growth variants.json] [--reuse]
 *                             [--answers]
 *
 * Deterministic synthetic learners (test/sim/learners.ts) play the real rules headlessly through
 * the runtime host, one simulated day after another (test/sim/driver.ts). Each learner runs in its
 * own process. The script writes `<out>/<learner>.json` (the full day-by-day report) and
 * `<out>/report.md` (summaries and the named balance checks of test/sim/report.ts), and prints the
 * markdown. With `--check` it exits 1 when a named check fails. `--pack` plays another pack file
 * (a content preview); `--balance` merges a partial balance block into the pack first (an
 * experiment; the pack is validated after); `--growth` follows other growth rules alongside the
 * shipped ones (a JSON array of test/sim/growth.ts variants; each report's `growthVariants` gives
 * every friend's stage days under each); `--reuse` re-reads the reports of an earlier run;
 * `--answers` also writes `<out>/<learner>.answers.jsonl`, every answer with its activity, input,
 * box, days overdue, the child's recall and the outcome (test/sim/driver.ts `AnswerRecord`).
 *
 * A simulated day costs a few hundred commits, so a long run takes minutes; the Vitest gate runs
 * only short simulations (test/sim/*.test.ts). docs/balance-report.md records the long runs.
 *
 * The TypeScript is bundled with esbuild into a temporary module, so this runs on plain Node.
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain, repositoryRoot } from './lib/tools.mjs';

export const LEARNER_NAMES = ['perfect', 'average', 'struggling', 'slow'];

/** @param {string} root */
async function loadSimulation(root) {
  const directory = mkdtempSync(join(tmpdir(), 'pearl-sea-simulate-'));
  try {
    const file = join(directory, 'simulate.mjs');
    await build({
      absWorkingDir: root,
      stdin: {
        contents: `export { simulate } from './test/sim/driver.ts';
export { summarise, runChecks, markdown } from './test/sim/report.ts';
export { contentRegistration } from './src/rules/contract/index.ts';
export { parseContentJson, requireValue } from '@aegis/runtime';`,
        resolveDir: root,
        loader: 'ts',
      },
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      logLevel: 'warning',
    });
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** @param {string[]} args @param {string} name @param {string} fallback */
function option(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined
    ? /** @type {string} */ (args[index + 1])
    : fallback;
}

/**
 * `patch` merged into `base`: objects key by key, anything else (numbers, arrays) replaced.
 * @param {any} base @param {any} patch @returns {any}
 */
export function merge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) out[key] = merge(base?.[key], value);
  return out;
}

/**
 * The pack a run plays: `packPath` with the partial balance block of `balancePath` merged in,
 * validated by the contract.
 * @param {any} sim @param {string} packPath @param {string} balancePath
 */
function loadPack(sim, packPath, balancePath) {
  const json = JSON.parse(readFileSync(packPath, 'utf8'));
  if (balancePath) {
    json.data.balance = merge(json.data.balance, JSON.parse(readFileSync(balancePath, 'utf8')));
  }
  return sim.requireValue(
    sim.parseContentJson(JSON.stringify(json), sim.contentRegistration, 'pearl-sea.content.json'),
  );
}

/**
 * Simulate one learner in this process and write its report.
 * @param {string} learner
 * @param {{ days: number, seed: string, out: string, pack: string, balance: string,
 *   growth: string, grade: number | undefined, egg: string | undefined, answers: boolean }} run
 */
async function runWorker(learner, run) {
  const sim = await loadSimulation(repositoryRoot);
  const started = process.hrtime.bigint();
  const pack = loadPack(sim, run.pack, run.balance);
  /** @type {string[]} */
  const answers = [];
  const report = await sim.simulate(learner, {
    seed: run.seed,
    days: run.days,
    pack,
    ...(run.grade === undefined ? {} : { grade: run.grade }),
    ...(run.egg === undefined ? {} : { egg: run.egg }),
    ...(run.growth ? { growthVariants: JSON.parse(readFileSync(run.growth, 'utf8')) } : {}),
    ...(run.answers
      ? { onAnswer: (/** @type {unknown} */ answer) => answers.push(JSON.stringify(answer)) }
      : {}),
    onDay: (
      /** @type {{ index: number; played: boolean; answers: number; commits: number }} */ day,
    ) => {
      const seconds = Number((process.hrtime.bigint() - started) / 1_000_000_000n);
      process.stderr.write(
        `${learner} day ${day.index + 1}/${run.days}${day.played ? `: ${day.answers} answers, ${day.commits} commits` : ' (off)'} [${seconds}s]\n`,
      );
    },
  });
  writeFileSync(join(run.out, `${learner}.json`), JSON.stringify(report, null, 2) + '\n');
  if (run.answers) {
    writeFileSync(join(run.out, `${learner}.answers.jsonl`), answers.join('\n') + '\n');
  }
}

/** @param {string[]} args */
function spawnWorker(args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done(undefined) : fail(new Error(`worker exited ${code}`)),
    );
  });
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const path = (/** @type {string} */ name) => {
    const value = option(args, name, '');
    return value ? resolve(value) : '';
  };
  const grade = option(args, 'grade', '');
  const egg = option(args, 'egg', '');
  const run = {
    days: Number(option(args, 'days', '84')),
    seed: option(args, 'seed', 'simulation'),
    out: resolve(repositoryRoot, option(args, 'out', join('out', 'simulation'))),
    pack: path('pack') || join(repositoryRoot, 'content', 'pearl-sea.content.json'),
    balance: path('balance'),
    growth: path('growth'),
    grade: grade ? Number(grade) : undefined,
    egg: egg || undefined,
    answers: args.includes('--answers'),
  };
  mkdirSync(run.out, { recursive: true });
  const worker = option(args, 'worker', '');
  if (worker) {
    await runWorker(worker, run);
    process.exit(0);
  }
  const learners = option(args, 'learners', LEARNER_NAMES.join(',')).split(',');
  for (const learner of learners) {
    if (!LEARNER_NAMES.includes(learner)) throw new Error(`Unknown learner ${learner}.`);
  }
  if (!args.includes('--reuse')) {
    const forwarded = args.filter((_, i) => {
      const flag = args[i - 1];
      return !(args[i] === '--learners' || flag === '--learners' || args[i] === '--check');
    });
    const runs = await Promise.allSettled(
      learners.map((learner) => spawnWorker(['--worker', learner, ...forwarded])),
    );
    const crashed = runs.filter((outcome) => outcome.status === 'rejected');
    if (crashed.length > 0) throw new Error(`${crashed.length} simulation worker(s) failed.`);
  }
  const sim = await loadSimulation(repositoryRoot);
  const reports = learners.map((learner) =>
    JSON.parse(readFileSync(join(run.out, `${learner}.json`), 'utf8')),
  );
  const checks = sim.runChecks(reports);
  const text = sim.markdown(reports.map(sim.summarise), checks, {
    days: run.days,
    seed: run.seed,
    revision: reports[0]?.content.revision ?? '?',
    ...(run.balance ? { balance: relative(repositoryRoot, run.balance).split(sep).join('/') } : {}),
  });
  writeFileSync(join(run.out, 'report.md'), text);
  process.stdout.write(text);
  const failed = checks.filter((/** @type {{ ok: boolean }} */ c) => !c.ok);
  if (args.includes('--check') && failed.length > 0) {
    process.stderr.write(`${failed.length} balance check(s) failed.\n`);
    process.exit(1);
  }
}
