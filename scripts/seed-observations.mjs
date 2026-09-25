#!/usr/bin/env node
/**
 * Seed the Course Trust Data Layer from the hand-edited course files
 * (docs/HANDOFF-data-layer.md §8 Phase 1).
 *
 * Reads every file in `src/content/courses/`, writes:
 *   - one `courses` row per file (id = code)
 *   - one `sources` row (`content_file`, trust 0.8)
 *   - one `observations` row per tracked field (section 5), observed_at = lastVerified
 *
 * Idempotent: observation ids are deterministic (a hash of course|field|source|
 * observed_at|value), and every insert uses `INSERT OR IGNORE`, so re-running
 * adds no duplicates. A changed value produces a NEW observation (append-only
 * correction), never an UPDATE.
 *
 * Usage:
 *   node scripts/seed-observations.mjs           # write to D1 (needs .env creds)
 *   node scripts/seed-observations.mjs --dry-run # print what WOULD be written
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { d1Query } from './lib/d1.mjs';

const COURSES_DIR = fileURLToPath(new URL('../src/content/courses/', import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE_ID = 'content_file';
const SOURCE_TRUST = 0.8;

// Must match worker/src/fields.ts (kept inline here because .mjs can't import TS).
const AMENITY_KEYS = [
  'restrooms', 'parking', 'water', 'lighting', 'proShop',
  'dogFriendly', 'cartFriendly', 'handicapAccessible', 'camping',
];

function readCourses() {
  return readdirSync(COURSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const slug = f.replace(/\.json$/, '');
      const data = JSON.parse(readFileSync(`${COURSES_DIR}${f}`, 'utf8'));
      return { slug, data };
    });
}

/** Deterministic observation id so re-seeding is a no-op. */
function observationId(courseId, field, observedAt, value) {
  const h = createHash('sha256')
    .update([courseId, field, SOURCE_ID, observedAt, value].join('|'))
    .digest('hex')
    .slice(0, 16);
  return `obs_${h}`;
}

/** Turn one course file's tracked fields into observation rows. */
function courseObservations(course) {
  const d = course.data;
  const rows = [];
  const push = (field, value) =>
    rows.push({
      id: observationId(d.code, field, d.lastVerified, JSON.stringify(value)),
      course_id: d.code,
      field,
      value: JSON.stringify(value),
      source_id: SOURCE_ID,
      observed_at: d.lastVerified,
    });

  push('holes', d.holes);
  push('par', d.par);
  push('totalFeet', d.totalFeet);
  push('isFree', d.isFree);
  push('greenFee', d.greenFee);
  push('isWooded', d.isWooded === true);
  push('location.lat', d.location.lat);
  push('location.lng', d.location.lng);

  for (const key of AMENITY_KEYS) {
    push(`amenities.${key}`, d.amenities?.[key] === true);
  }

  if (Array.isArray(d.holeData)) {
    for (const hole of d.holeData) {
      if (typeof hole.number === 'number' || (typeof hole.number === 'string' && /^\d+[A-Za-z]?$/.test(hole.number))) {
        push(`holeData.${hole.number}.par`, hole.par);
        push(`holeData.${hole.number}.distance`, hole.distance);
      }
    }
  }

  return rows;
}

async function chunkInsert(table, columns, rows) {
  const placeholders = `(${columns.map(() => '?').join(',')})`;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = placeholders;
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES ${slice.map(() => values).join(',')}`;
    const params = slice.flatMap((r) => columns.map((c) => r[c]));
    await d1Query(sql, params);
  }
}

const courses = readCourses();

const courseRows = courses.map((c) => ({
  id: c.data.code,
  slug: c.slug,
  name: c.data.name,
  lat: c.data.location.lat,
  lng: c.data.location.lng,
}));

const observationRows = courses.flatMap(courseObservations);

if (DRY_RUN) {
  console.log(`DRY RUN — no writes.`);
  console.log(`  courses:      ${courseRows.length} rows (source ${SOURCE_ID}, trust ${SOURCE_TRUST})`);
  console.log(`  observations: ${observationRows.length} rows across ${courses.length} files`);
  console.log(`  idempotent:   deterministic ids + INSERT OR IGNORE`);
  process.exit(0);
}

await d1Query(
  `INSERT OR IGNORE INTO sources (id, type, url, trust) VALUES (?, ?, NULL, ?)`,
  [SOURCE_ID, SOURCE_ID, SOURCE_TRUST],
);

await chunkInsert('courses', ['id', 'slug', 'name', 'lat', 'lng'], courseRows);
await chunkInsert(
  'observations',
  ['id', 'course_id', 'field', 'value', 'source_id', 'observed_at'],
  observationRows,
);

console.log(`Seeded ${courseRows.length} courses and ${observationRows.length} observations.`);
