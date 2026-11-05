/**
 * BUILD — free-play-map hub: free vs pay-to-play distribution for the 15 hub
 * metros, plus the land manager (type + name) for every free course (from the
 * committed PAD-US layer written by fetch.ts) and the coordinates for the map.
 * No external API calls at build time.
 *
 * Deterministic. Pages read ONLY src/data/hubs/free-play-map.json.
 *
 * Run: node scripts/hubs/free-play-map/build.ts
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES, CITY_SLUGS } from '../cities.ts';
import { readCourses, aggregateByCity } from '../lib-courses.ts';

const ROOT = process.cwd();
const LAND_FILE = join(ROOT, 'src', 'data', 'hubs', 'free-play-map.land.json');
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'free-play-map.json');
const PUBLIC_OUT_FILE = join(ROOT, 'public', 'data', 'free-play-map.json');

interface LandCourse {
  slug: string;
  managerType: string;
  managerName: string | null;
  unitName: string | null;
}

const land = JSON.parse(readFileSync(LAND_FILE, 'utf8')) as {
  source: string;
  sourceUrl: string;
  datasetVersion: string;
  license: string;
  pulledAt: string;
  courses: LandCourse[];
};
const landBySlug = new Map(land.courses.map((c) => [c.slug, c]));

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

// Free-course points for map rendering, joined with the PAD-US land manager.
const freePoints = courses
  .filter((c) => c.isFree && c.lat != null && c.lng != null && CITY_SLUGS.includes(c.citySlug))
  .map((c) => {
    const l = landBySlug.get(c.slug);
    return {
      slug: c.slug,
      name: c.name,
      citySlug: c.citySlug,
      lat: Math.round(c.lat! * 1000) / 1000,
      lng: Math.round(c.lng! * 1000) / 1000,
      managerType: l?.managerType ?? 'Unknown',
      managerName: l?.managerName ?? null,
      unitName: l?.unitName ?? null,
    };
  });

// Land-manager distribution across all free courses (sorted by count).
const managerCounts: Record<string, number> = {};
for (const p of freePoints) managerCounts[p.managerType] = (managerCounts[p.managerType] || 0) + 1;
const managerTypes = Object.entries(managerCounts)
  .map(([type, count]) => ({ type, count, pct: Math.round((count / freePoints.length) * 1000) / 10 }))
  .sort((a, b) => b.count - a.count);

const payload = {
  name: 'Free-to-Play Disc Golf Map by City',
  description:
    'Free vs pay-to-play course distribution for 15 US metros, a point map of every free course, and the land manager for each (USGS PAD-US).',
  source: `${land.source} + FindFrolf course directory`,
  sourceUrl: land.sourceUrl,
  datasetVersion: '1.1',
  license: land.license,
  pulledAt: land.pulledAt,
  cities,
  managerTypes,
  freeCourses: freePoints,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });
writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ wrote ${OUT_FILE}`);
console.log(`✓ wrote ${PUBLIC_OUT_FILE}`);
console.log(`  ${cities.length} cities, ${freePoints.length} free course points, ${managerTypes.length} manager types`);
