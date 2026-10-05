#!/usr/bin/env node
// Batch audit of the Phase 2 enrichment tranche. READ-ONLY: reports each
// course's §4.7 tier verdict and what's still missing, doubling as the
// re-index checklist.
//
// NOTE: the §4.7 logic below MUST stay in sync with getContentTier() in
// src/lib/data.ts. If you change the bar there, change it here too.
//
// Usage:
//   node scripts/enrich-all.mjs              # audit the full 15-course tranche
//   node scripts/enrich-all.mjs <slug...>    # audit specific slugs
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Priority order (one per live city guide; mary-moore-searight first as the
// pipeline proof-of-concept). Mirrors docs/tranche-15.md.
const TRANCHE = [
  'mary-moore-searight',
  'the-canyons',
  'blue-ribbon-pines',
  'seatac',
  'buffalo-ridge',
  'birds-nest',
  'idlewild',
  'diavolo',
  'seven-oaks',
  'tc-jester',
  'z-boaz',
  'little-mulberry',
  'milo-mciver-riverbend',
  'nevin-nightmare',
  'bad-rock-creek',
];

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : TRANCHE;

function tier(course) {
  const missing = [];
  const hasRealPhoto = (course.photos ?? []).some((p) => !p.url.endsWith('.svg'));
  const hasHoleData = (course.holeData ?? []).length > 0;
  const hasReview = (course.reviews ?? []).some(
    (r) => (r.name ?? '').trim() !== '' && (r.text ?? '').trim() !== '',
  );
  const hasLocalTips =
    typeof course.localTips === 'string' && course.localTips.trim().length >= 80;
  const feeKnown =
    course.isFree === true ||
    (typeof course.greenFee === 'string' &&
      course.greenFee.trim() !== '' &&
      !/unknown/i.test(course.greenFee));

  if (!hasRealPhoto) missing.push('photo');
  if (!hasHoleData) missing.push('holeData');
  if (!hasReview) missing.push('review');
  if (!hasLocalTips) missing.push('localTips');
  if (!feeKnown) missing.push('fee');
  return { pass: missing.length === 0, missing };
}

let passed = 0;
let failed = 0;
const missingTally = {};

console.log('FindFrolf tranche audit — §4.7 re-index checklist');
console.log('─'.repeat(72));

for (const slug of slugs) {
  const file = resolve('src/content/courses', `${slug}.json`);
  if (!existsSync(file)) {
    console.log(`?  MISSING FILE  ${slug}`);
    failed += 1;
    continue;
  }
  const course = JSON.parse(readFileSync(file, 'utf8'));
  const { pass, missing } = tier(course);
  if (pass) {
    passed += 1;
    console.log(`✓  ENRICHED      ${slug}  (${course.name})`);
  } else {
    failed += 1;
    console.log(`✗  thin          ${slug}  (${course.name}) — missing: ${missing.join(', ')}`);
    for (const m of missing) missingTally[m] = (missingTally[m] ?? 0) + 1;
  }
}

console.log('─'.repeat(72));
console.log(`Result: ${passed} enriched / ${failed} thin (of ${slugs.length})`);
if (Object.keys(missingTally).length) {
  console.log('Missing-item tally:');
  for (const [k, v] of Object.entries(missingTally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}
