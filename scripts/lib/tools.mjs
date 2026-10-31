// @ts-check
/** Shared helpers for the Node tooling scripts. Cross-platform: no shell, no POSIX-only paths. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @param {string} path */
export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** True when the module at `url` is the script Node was started with. */
export function isMain(/** @type {string} */ url) {
  return process.argv[1] !== undefined && fileURLToPath(url) === resolve(process.argv[1]);
}

/**
 * Absolute paths of the JavaScript entry points of locally installed tools. Invoking them through
 * `process.execPath` avoids `.cmd` shims and shells on Windows, so exit codes arrive unaltered.
 */
export const tools = {
  tsc: join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  eslint: join(repositoryRoot, 'node_modules', 'eslint', 'bin', 'eslint.js'),
  prettier: join(repositoryRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs'),
  vitest: join(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs'),
  playwright: join(repositoryRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
};

/**
 * Run a Node script synchronously with inherited output.
 * @param {string[]} args
 * @param {{ cwd?: string; env?: NodeJS.ProcessEnv }} [options]
 * @returns {number} exit status (1 when the process could not be started or was killed)
 */
export function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd ?? repositoryRoot,
    stdio: 'inherit',
    env: options.env ?? process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}
