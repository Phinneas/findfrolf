/**
 * Refresh ALL data hubs (Step 4 closeout).
 *
 * - playable-months: fetch (NOAA NCEI, network) + build (suncalc + rule).
 * - courses-per-100k / terrain-index / free-play-map: build only — they read
 *   the committed course directory + 2020 Census population table (no network).
 *
 * Usage: node scripts/hubs/refresh-all.ts   (or: npm run hubs:refresh:all)
 */

import { execFileSync } from 'node:child_process';

const NODE = process.execPath;

function run(script: string): void {
  console.log(`\n==> ${script}`);
  execFileSync(NODE, [script], { stdio: 'inherit' });
}

run('scripts/hubs/playable-months/fetch.ts');
run('scripts/hubs/playable-months/build.ts');
run('scripts/hubs/courses-per-100k/build.ts');
run('scripts/hubs/terrain-index/build.ts');
run('scripts/hubs/free-play-map/build.ts');

console.log('\n✓ all hubs refreshed');
