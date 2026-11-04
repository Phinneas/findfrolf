/**
 * BUILD — free-play-map hub: free-to-play vs pay-to-play course distribution
 * for the 15 hub metros, plus the coordinates of every free course (the
 * "map" payload). Derived entirely from src/content/courses (isFree + location).
 * No external API calls.
 *
 * Deterministic. Pages read ONLY src/data/hubs/free-play-map.json.
 *
 * Run: node scripts/hubs/free-play-map/build.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES, CITY_SLUGS } from '../cities.ts';
import { readCourses, aggregateByCity } from '../lib-courses.ts';

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'free-play-map.json');
const PUBLIC_OUT_FILE = join(ROOT, 'public', 'data', 'free-play-map.json');

const pulledAt = new Date().toISOString().slice(0, 10);
const nextRefresh = `${parseInt(pulledAt.slice(0, 4), 10) + 1}${pulledAt.slice(4)}`;

const SOURCE = 'FindFrolf course directory (isFree flag, greenFee, location)';
const SOURCE_URL = 'https://www.findfrolf.com/courses/';
const LICENSE = 'FindFrolf course data';

const courses = readCourses();
const agg = aggregateByCity(courses, CITY_SLUGS);

const cities = HUB_CITIES.map((city) => {
  const a = agg.get(city.slug);
  if (!a) throw new Error(`no course data for city ${city.slug}`);
  const freePct = a.courseCount ? (a.freeCount / a.courseCount) * 100 : 0;
  return {
    slug: city.slug,
    name: city.name,
    stateSlug: city.stateSlug,
    courseCount: a.courseCount,
    freeCount: a.freeCount,
    paidCount: a.paidCount,
    freePct: Math.round(freePct * 10) / 10,
    center: a.lat != null && a.lng != null ? { lat: Math.round(a.lat * 1000) / 1000, lng: Math.round(a.lng * 1000) / 1000 } : null,
  };
}).sort((x, y) => y.freeCount - x.freeCount);

// Free-course point payload for map rendering (one point per free course).
const freePoints = courses
  .filter((c) => c.isFree && c.lat != null && c.lng != null && CITY_SLUGS.includes(c.citySlug))
  .map((c) => ({
    slug: c.slug,
    name: c.name,
    citySlug: c.citySlug,
    lat: Math.round(c.lat * 1000) / 1000,
    lng: Math.round(c.lng * 1000) / 1000,
  }));

const payload = {
  name: 'Free-to-Play Disc Golf Map by City',
  description:
    'Free vs pay-to-play course distribution for 15 US metros, plus a point map of every free course, from FindFrolf course data.',
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  datasetVersion: '1.0',
  license: LICENSE,
  pulledAt,
  nextRefresh,
  cities,
  freeCourses: freePoints,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });
writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ wrote ${OUT_FILE}`);
console.log(`✓ wrote ${PUBLIC_OUT_FILE}`);
console.log(`  ${cities.length} cities, ${freePoints.length} free course points, pulled ${pulledAt}`);
