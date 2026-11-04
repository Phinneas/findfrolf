/**
 * BUILD — courses-per-100k hub: course count per 100,000 residents for the
 * 15 hub metros. Course counts come from src/content/courses; population is
 * the 2020 Census MSA total (committed in scripts/hubs/cities.ts — public
 * Census Bureau data, no API token). No external API calls at build time.
 *
 * Deterministic: same course directory + same population table => identical
 * output. Pages read ONLY the committed JSON (src/data/hubs/courses-per-100k.json).
 *
 * Run: node scripts/hubs/courses-per-100k/build.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES, CITY_SLUGS } from '../cities.ts';
import { readCourses, aggregateByCity } from '../lib-courses.ts';

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'courses-per-100k.json');
const PUBLIC_OUT_FILE = join(ROOT, 'public', 'data', 'courses-per-100k.json');

const pulledAt = new Date().toISOString().slice(0, 10);
const nextRefresh = `${parseInt(pulledAt.slice(0, 4), 10) + 1}${pulledAt.slice(4)}`;

const SOURCE_URL = 'https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html';
const LICENSE = 'U.S. Census Bureau 2020 decennial census (public domain)';

const courses = readCourses();
const agg = aggregateByCity(courses, CITY_SLUGS);

const cities = HUB_CITIES.map((city) => {
  const a = agg.get(city.slug);
  if (!a) throw new Error(`no course data for city ${city.slug}`);
  const per100k = a.courseCount / (city.population2020 / 100_000);
  return {
    slug: city.slug,
    name: city.name,
    stateSlug: city.stateSlug,
    msaName: city.msaName,
    population2020: city.population2020,
    courseCount: a.courseCount,
    coursesPer100k: Math.round(per100k * 10) / 10,
    freeCount: a.freeCount,
  };
});

const payload = {
  name: 'Disc Golf Courses per 100,000 Residents by City',
  description:
    'Course supply per 100,000 residents for 15 US metros, from FindFrolf course data and 2020 Census metropolitan population.',
  source: 'U.S. Census Bureau 2020 decennial census (MSA population) + FindFrolf course directory',
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
console.log(`  ${cities.length} cities, pulled ${pulledAt}, next refresh ${nextRefresh}`);
