/**
 * BUILD — terrain-index hub: per-city terrain challenge for disc golf, from
 * the course directory's own terrain signals (difficultyRating, wooded flag,
 * foliage, total feet). No external API calls.
 *
 * The primary signal is the directory's 1–5 difficultyRating, whose rubric
 * (docs/admin-workflow.md) already scores length, woods, elevation, and
 * hazards — i.e. terrain. Supplementary signals (wooded %, avg length) are
 * included for transparency. A USGS-elevation version is a documented v2
 * option (see docs/hub-terrain-index.md).
 *
 * Deterministic. Pages read ONLY src/data/hubs/terrain-index.json.
 *
 * Run: node scripts/hubs/terrain-index/build.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES, CITY_SLUGS } from '../cities.ts';
import { readCourses, aggregateByCity } from '../lib-courses.ts';

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'terrain-index.json');
const PUBLIC_OUT_FILE = join(ROOT, 'public', 'data', 'terrain-index.json');

const pulledAt = new Date().toISOString().slice(0, 10);
const nextRefresh = `${parseInt(pulledAt.slice(0, 4), 10) + 1}${pulledAt.slice(4)}`;

const SOURCE = 'FindFrolf course directory (difficultyRating rubric, wooded flag, foliage, total feet)';
const SOURCE_URL = 'https://www.findfrolf.com/courses/';
const LICENSE = 'FindFrolf course data';

const courses = readCourses();
const agg = aggregateByCity(courses, CITY_SLUGS);

const cities = HUB_CITIES.map((city) => {
  const a = agg.get(city.slug);
  if (!a) throw new Error(`no course data for city ${city.slug}`);
  const woodedPct = a.courseCount ? (a.woodedCount / a.courseCount) * 100 : 0;
  return {
    slug: city.slug,
    name: city.name,
    stateSlug: city.stateSlug,
    courseCount: a.courseCount,
    avgDifficultyRating: Math.round(a.avgDifficulty * 100) / 100,
    woodedCount: a.woodedCount,
    woodedPct: Math.round(woodedPct * 10) / 10,
    avgTotalFeet: a.avgTotalFeet,
  };
}).sort((x, y) => y.avgDifficultyRating - x.avgDifficultyRating);

const payload = {
  name: 'Disc Golf Terrain Index by City',
  description:
    'Per-city terrain challenge for disc golf, from the directory difficultyRating rubric (length, woods, elevation, hazards) plus wooded share and average course length.',
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  datasetVersion: '1.0',
  license: LICENSE,
  pulledAt,
  nextRefresh,
  cities,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });
writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ wrote ${OUT_FILE}`);
console.log(`✓ wrote ${PUBLIC_OUT_FILE}`);
console.log(`  ${cities.length} cities, pulled ${pulledAt}`);
