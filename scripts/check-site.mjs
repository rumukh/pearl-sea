// @ts-check
/**
 * Check a built site before it is uploaded or served:
 *
 *   node scripts/check-site.mjs dist-site --base /pearl-sea/
 *
 * Re-reads every file and proves the offline resource graph (see scripts/lib/site.mjs). With
 * --base, also proves the artifact was built for that deployment path.
 */
import { resolve } from 'node:path';
import { isMain } from './lib/tools.mjs';
import { verifySite } from './lib/site.mjs';

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  /** @type {string | undefined} */
  let directory;
  /** @type {string | undefined} */
  let expectedBase;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') expectedBase = args[++i];
    else if (directory === undefined) directory = args[i];
    else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }
  try {
    const result = verifySite(resolve(directory ?? 'dist-site'));
    if (expectedBase !== undefined && result.base !== expectedBase) {
      throw new Error(`Built for base ${result.base}, expected ${expectedBase}.`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Site check failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
