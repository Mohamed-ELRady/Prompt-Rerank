/**
 * Enforces the SDD §8 bundle budget: the always-loaded content watcher must
 * stay tiny. Run after `pnpm build`; exits non-zero on violation.
 */
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const BUDGETS = [{ file: '.output/chrome-mv3/content-scripts/content.js', maxGzipKb: 50 }];

let failed = false;
for (const { file, maxGzipKb } of BUDGETS) {
  const gzipKb = gzipSync(await readFile(file)).length / 1024;
  const status = gzipKb <= maxGzipKb ? 'OK' : 'OVER BUDGET';
  console.log(`${status}  ${file}: ${gzipKb.toFixed(1)} kB gzip (budget ${String(maxGzipKb)} kB)`);
  if (gzipKb > maxGzipKb) {
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
