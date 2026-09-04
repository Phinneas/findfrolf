#!/usr/bin/env node
/**
 * FindFrolf course data check + progress tracker.
 *
 * Prints the table the tracking spreadsheet was meant to hold — but derived
 * from the course data itself, so it can never drift out of sync:
 *
 *   Course | City | Status | Missing | Warnings
 *
 * Status:  Draft  = missing required fields (blocks publish)
 *          Review = all required fields present, but QA warnings open
 *          Ready  = all required fields present, no open warnings
 *
 * Also enforces the Difficulty Rubric, Par Rule, and Photo Sourcing Policy
 * from docs/admin-workflow.md.
 *
 * Usage:
 *   npm run check:courses           table + summary (exits 1 if any Draft)
 *   npm run check:courses -- --csv  same table as CSV, ready to paste into a
 *                                   spreadsheet if you still want one
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COURSES_DIR = fileURLToPath(new URL('../src/content/courses/', import.meta.url));

const CSV = process.argv.includes('--csv');

const DIFFICULTY_MAP = { Easy: [1, 2], Moderate: [3], Hard: [4], 'Very Hard': [5] };
// Hosts that violate the Photo Sourcing Policy (manufacturer marketing photos,
// fake avatars) — flagged so they get replaced before publish.
const UNSAFE_PHOTO_HOSTS = ['innovadiscs.com', 'pravatar.cc'];
const MAX_LAST_VERIFIED_AGE_DAYS = 183;

// Per-city metro-scope targets from the PDGA counting pass (docs/metro-course-counts.md).
// Verified Aug 2026; the UDisc-only gap-fill cross-check is done via Scrapling
// (docs/udisc-cross-check.md) — those base entries are additive to these PDGA targets.
const TARGETS = {
  Austin: 51,
  Denver: 56,
  Portland: 38,
  Chicago: 106,
  Seattle: 42,
  Charlotte: 59,
  Houston: 83,
  Phoenix: 38,
  Nashville: 29,
  Raleigh: 30,
  'Dallas–Fort Worth': 76,
  'Kansas City': 44,
  Atlanta: 46,
  Cincinnati: 28,
  'Minneapolis–St. Paul': 80,
};

function readCourses() {
  return readdirSync(COURSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = readFileSync(`${COURSES_DIR}${f}`, 'utf8');
      return { file: f, slug: f.replace(/\.json$/, ''), data: JSON.parse(raw) };
    })
    .sort((a, b) => a.data.city.localeCompare(b.data.city) || a.data.name.localeCompare(b.data.name));
}

function missingRequired(c) {
  const d = c.data;
  const missing = [];
  let total = 0;
  const need = (label, ok) => {
    total += 1;
    if (!ok) missing.push(label);
  };

  need('name', typeof d.name === 'string' && d.name.trim());
  need('code (XX-####)', typeof d.code === 'string' && /^[A-Z]{2}-\d+$/.test(d.code));
  need('city', typeof d.city === 'string' && d.city.trim());
  need('state', typeof d.state === 'string' && d.state.trim());
  need('citySlug', typeof d.citySlug === 'string' && d.citySlug.trim());
  need('stateSlug', typeof d.stateSlug === 'string' && /^[a-z]{2}$/.test(d.stateSlug));
  need('area', typeof d.area === 'string' && d.area.trim());

  need('location.address', d.location && typeof d.location.address === 'string' && d.location.address.trim());
  need('location.lat', d.location && Number.isFinite(d.location.lat) && d.location.lat >= -90 && d.location.lat <= 90);
  need('location.lng', d.location && Number.isFinite(d.location.lng) && d.location.lng >= -180 && d.location.lng <= 180);

  need('holes', Number.isInteger(d.holes) && d.holes >= 1 && d.holes <= 36);
  need('par', Number.isFinite(d.par) && d.par >= 1);
  need('totalFeet', Number.isFinite(d.totalFeet) && d.totalFeet >= 0);
  need('courseLength', ['short', 'medium', 'long'].includes(d.courseLength));
  need('difficulty', ['Easy', 'Moderate', 'Hard', 'Very Hard'].includes(d.difficulty));
  need('difficultyRating (1-5)', Number.isInteger(d.difficultyRating) && d.difficultyRating >= 1 && d.difficultyRating <= 5);

  need('isFree', typeof d.isFree === 'boolean');
  need('greenFee', typeof d.greenFee === 'string' && d.greenFee.trim());

  need(
    'photos (≥1)',
    Array.isArray(d.photos) &&
      d.photos.length >= 1 &&
      d.photos.every((p) => p && typeof p.url === 'string' && p.url && typeof p.alt === 'string' && p.alt),
  );
  need('heroImage', typeof d.heroImage === 'string' && d.heroImage);
  need('thumbnail', typeof d.thumbnail === 'string' && d.thumbnail);

  need('rating (0-5)', Number.isFinite(d.rating) && d.rating >= 0 && d.rating <= 5);
  need('reviewCount', Number.isFinite(d.reviewCount) && d.reviewCount >= 0);

  need('tags (≥2)', Array.isArray(d.tags) && d.tags.length >= 2);
  need('lastVerified', typeof d.lastVerified === 'string' && !Number.isNaN(Date.parse(d.lastVerified)));
  need(
    'aboutParagraphs (≥1)',
    Array.isArray(d.aboutParagraphs) && d.aboutParagraphs.length >= 1 && d.aboutParagraphs.some((p) => typeof p === 'string' && p.trim()),
  );

  return { missing, total };
}

function lengthOk(courseLength, totalFeet) {
  if (courseLength === 'short') return totalFeet < 5000;
  if (courseLength === 'medium') return totalFeet >= 5000 && totalFeet <= 7000;
  if (courseLength === 'long') return totalFeet > 7000;
  return false;
}

// Objective part of the Difficulty Rubric from docs/admin-workflow.md.
// The +1 for heavy OB / water carry is a human judgment call, so it is not
// computed here — a 1-point gap is reported as an info warning instead.
function rubricScore(d) {
  let s = 1;
  if (d.holes >= 18) s += 1;
  if (d.totalFeet >= 7000) s += 1;
  if ((typeof d.foliage === 'string' && /dense|wooded/i.test(d.foliage)) || d.isWooded === true) s += 1;
  return Math.max(1, Math.min(5, s));
}

function warnings(c) {
  const d = c.data;
  const list = [];
  // w(msg, block): block=true warnings gate publish (Review status);
  // block=false are informational QA items (placeholder photos, documented
  // difficulty bumps) that don't stop a course being Ready.
  const w = (msg, block = false) => list.push({ msg, block });

  if (d.photos && d.photos.length) {
    const host = (d.photos[0].url || '')
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .toLowerCase()
      .replace(/^www\./, '');
    if (UNSAFE_PHOTO_HOSTS.includes(host)) {
      w(`photo host '${host}' not allowed by Photo Sourcing Policy — replace before publish`, true);
    }
    if ((d.photos[0].url || '').includes('course-placeholder')) {
      w('placeholder photo — acceptable per Photo Sourcing Policy; upgrade when a real photo becomes available');
    }
    if (d.heroImage && d.photos[0].url !== d.heroImage) {
      w('heroImage differs from photos[0].url');
    }
  }

  const ageDays = (Date.now() - Date.parse(d.lastVerified)) / 86400000;
  if (ageDays > MAX_LAST_VERIFIED_AGE_DAYS) {
    w(`lastVerified is ${Math.round(ageDays)} days old (max ${MAX_LAST_VERIFIED_AGE_DAYS})`, true);
  }

  if (!lengthOk(d.courseLength, d.totalFeet)) {
    w(`courseLength '${d.courseLength}' doesn't match totalFeet ${d.totalFeet}`, true);
  }

  const allowed = DIFFICULTY_MAP[d.difficulty];
  if (allowed && !allowed.includes(d.difficultyRating)) {
    w(`difficulty '${d.difficulty}' doesn't match difficultyRating ${d.difficultyRating}`, true);
  }

  const score = rubricScore(d);
  const diff = Math.abs(score - d.difficultyRating);
  if (diff >= 2) w(`difficultyRating ${d.difficultyRating} is off the rubric score ${score} by ${diff} — recheck`, true);
  else if (diff === 1) w(`difficultyRating ${d.difficultyRating} vs rubric score ${score} — +1 documented bump (QA confirm)`);

  if (d.location && Number.isFinite(d.location.lat) && Number.isFinite(d.location.lng)) {
    const dec = (n) => (String(n).split('.')[1] || '').length;
    if (dec(d.location.lat) < 4 || dec(d.location.lng) < 4) {
      w('GPS coordinates need 4+ decimal places (publish gate)', true);
    }
  }

  if (Array.isArray(d.holeData) && d.holeData.length) {
    const sum = d.holeData.reduce((s, h) => s + (h.par || 0), 0);
    if (sum !== d.par) w(`holeData pars sum to ${sum}, but par is ${d.par}`, true);
    const distSum = d.holeData.reduce((s, h) => s + (h.distance || 0), 0);
    if (d.totalFeet > 0 && (distSum > d.totalFeet * 1.15 || distSum < d.totalFeet * 0.4)) {
      w(`holeData distances sum to ${Math.round(distSum)}ft vs totalFeet ${d.totalFeet} — layout mismatch`, true);
    }
    const sig = d.holeData.filter((h) => h.isSignature === true);
    if (sig.length !== 1 || !d.signatureHoleDescription) {
      w('need exactly one isSignature hole AND a signatureHoleDescription', true);
    }
  }

  if (!d.parSource) w('parSource not set (Par Rule: pdga / udisc / map / estimated)', true);

  if (Array.isArray(d.reviews) && d.reviews.length) {
    if (d.reviews.some((r) => r && typeof r.avatar === 'string' && r.avatar.includes('pravatar.cc'))) {
      w('reviews use placeholder avatars (pravatar.cc) — remove or replace with real reviews', true);
    }
  }

  return list;
}

const courses = readCourses();
const rows = courses.map((c) => {
  const { missing, total } = missingRequired(c);
  const warns = warnings(c);
  const status = missing.length ? 'Draft' : warns.some((w) => w.block) ? 'Review' : 'Ready';
  return { ...c, missing, total, warns, status };
});

const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

if (CSV) {
  console.log('Course,City,Status,Fields Complete,Missing,Warnings');
  for (const r of rows) {
    const clean = (s) => s.replace(/,/g, '|');
    console.log(
      [
        clean(r.data.name),
        clean(r.data.city),
        r.status,
        `${r.total - r.missing.length}/${r.total}`,
        clean(r.missing.join('; ') || '-'),
        clean(r.warns.map((w) => w.msg).join('; ') || '-'),
      ].join(','),
    );
  }
} else {
  console.log('Course | City | Status | Missing | Warnings');
  console.log('-'.repeat(130));
  for (const r of rows) {
    console.log(
      `${trunc(r.data.name, 34).padEnd(35)}| ${r.data.city.padEnd(10)}| ${r.status.padEnd(7)}| ${trunc(r.missing.join(', ') || '-', 42).padEnd(43)}| ${trunc(r.warns.map((w) => w.msg).join('; ') || '-', 34)}`,
    );
  }
}

const byCity = new Map();
for (const r of rows) {
  if (!byCity.has(r.data.city)) byCity.set(r.data.city, { ready: 0, review: 0, draft: 0, total: 0 });
  const s = byCity.get(r.data.city);
  s[r.status.toLowerCase()] += 1;
  s.total += 1;
}

console.log('');
console.log('Progress by city (vs docs/course-sourcing-targets.md):');
for (const [city, s] of [...byCity.entries()].sort((a, b) => b[1].total - a[1].total)) {
  const target = TARGETS[city];
  const progress = target ? `${s.total}/${target}` : String(s.total);
  console.log(`  ${city.padEnd(18)} ${progress.padEnd(7)} course(s) — ${s.ready} ready / ${s.review} review / ${s.draft} draft`);
}
const totals = rows.reduce((acc, r) => {
  acc[r.status.toLowerCase()] += 1;
  return acc;
}, { ready: 0, review: 0, draft: 0 });
const targetSum = Object.values(TARGETS).reduce((a, b) => a + b, 0);
console.log(`\n${rows.length} course(s) total — ${totals.ready} Ready / ${totals.review} Review / ${totals.draft} Draft (target ${targetSum})`);

const drafts = rows.filter((r) => r.status === 'Draft').length;
if (drafts > 0) {
  console.error(`\n${drafts} course(s) are Draft (missing required fields) — fix before publish.`);
  process.exit(1);
}
