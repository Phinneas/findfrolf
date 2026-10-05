#!/usr/bin/env node
// Enrich a course: wire a real photo and/or a written review into its JSON,
// then report whether it now clears the §4.7 enrichment bar (and will
// re-index under the §6 rule).
//
// Usage:
//   node scripts/enrich-course.mjs --slug <slug> \
//     [--photo <path> --alt <text>] \
//     [--review-name <name> --review-date <YYYY-MM-DD> --review-stars <1-5>]
//     [--review-verified] [--review-text <text>]
//
// Example:
//   node scripts/enrich-course.mjs --slug zilker-park \
//     --photo /images/courses/zilker-park-1.jpg \
//     --alt "Zilker Park disc golf - hole 10 tee, Austin, Texas" \
//     --review-name "Chester B." --review-date 2026-10-12 --review-stars 4 \
//     --review-verified \
//     --review-text "The 367-foot 10th plays fully exposed to the lake wind; it humbles a calm putter shot. It gets crowded on weekends, so go early. Great for a first round or a relaxed afternoon."
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(name);

const slug = flag('--slug');
if (!slug) {
  console.error(
    'Usage: node scripts/enrich-course.mjs --slug <slug> [--photo <path> --alt <text>] [--review-name <name> --review-date <YYYY-MM-DD> --review-stars <1-5>] [--review-verified] [--review-text <text>]',
  );
  process.exit(1);
}

const file = resolve('src/content/courses', `${slug}.json`);
if (!existsSync(file)) {
  console.error(`Course not found: ${file}`);
  process.exit(1);
}

const course = JSON.parse(readFileSync(file, 'utf8'));

// ---- photo ----
const photo = flag('--photo');
const alt = flag('--alt') ?? '';
if (photo) {
  // photos[] drives the §4.7 check; heroImage/thumbnail are what actually
  // render (hero, cards, finder). Keep all three in sync.
  course.photos = [{ url: photo, alt }];
  course.heroImage = photo;
  course.thumbnail = photo;
}

// ---- review ----
const rname = flag('--review-name');
const rdate = flag('--review-date');
const rstars = flag('--review-stars');
const rtext = flag('--review-text');
const rverified = has('--review-verified');

if (rname || rdate || rstars || rtext) {
  const stars = Number(rstars);
  if (!rname || !rdate || !rtext || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    console.error(
      'Review requires --review-name, --review-date (YYYY-MM-DD), --review-stars (1-5), and --review-text. --review-verified is optional.',
    );
    process.exit(1);
  }
  course.reviews = course.reviews ?? [];
  course.reviews.push({
    name: rname,
    avatar: '',
    verified: rverified,
    stars,
    date: rdate,
    text: rtext,
  });
}

writeFileSync(file, `${JSON.stringify(course, null, 2)}\n`);

// ---- report the §4.7 tier ----
const hasRealPhoto = (course.photos ?? []).some((p) => !p.url.endsWith('.svg'));
const hasHoleData = (course.holeData ?? []).length > 0;
const hasReview = (course.reviews ?? []).some((r) => r.name?.trim() && r.text?.trim());
const hasLocalTips =
  typeof course.localTips === 'string' && course.localTips.trim().length >= 80;
const feeKnown =
  course.isFree === true ||
  (typeof course.greenFee === 'string' && course.greenFee.trim() !== '' && !/unknown/i.test(course.greenFee));

const missing = [];
if (!hasRealPhoto) missing.push('photo');
if (!hasHoleData) missing.push('holeData');
if (!hasReview) missing.push('review');
if (!hasLocalTips) missing.push('localTips');
if (!feeKnown) missing.push('fee');

console.log(`\n${course.name} (${slug})`);
console.log(
  `  tier: ${missing.length === 0 ? 'ENRICHED — clears §4.7, will re-index' : 'thin'}`,
);
if (missing.length) console.log(`  still missing: ${missing.join(', ')}`);
