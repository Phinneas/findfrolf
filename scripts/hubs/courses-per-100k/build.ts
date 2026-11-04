/**
 * BUILD — courses-per-100k hub: course count per 100,000 residents for the
 * 15 hub metros. Course counts come from src/content/courses; population comes
 * from the committed raw layer (src/data/hubs/courses-per-100k.population.json)
 * that scripts/hubs/courses-per-100k/fetch.ts pulled from the Census Data API.
 * No external API calls at build time.
 *
 * Deterministic: same course directory + same population layer => identical
 * output. Pages read ONLY the committed JSON (src/data/hubs/courses-per-100k.json).
 *
 * Run: node scripts/hubs/courses-per-100k/build.ts
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CITY_SLUGS } from '../cities.ts';
import { readCourses, aggregateByCity } from '../lib-courses.ts';

const ROOT = process.cwd();
const POP_FILE = join(ROOT, 'src', 'data', 'hubs', 'courses-per-100k.population.json');
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'courses-per-100k.json');
const PUBLIC_OUT_FILE = join(ROOT, 'public', 'data', 'courses-per-100k.json');

interface PopCity {
  slug: string;
  name: string;
  stateSlug: string;
  msaName: string;
  cbsaCode: string;
  population: number;
}

const pop = JSON.parse(readFileSync(POP_FILE, 'utf8')) as {
  source: string;
  sourceUrl: string;
  datasetVersion: string;
  variable: string;
  license: string;
  attribution: string;
  pulledAt: string;
  cities: PopCity[];
};

const courses = readCourses();
const agg = aggregateByCity(courses, CITY_SLUGS);

const cities = pop.cities.map((city) => {
  const a = agg.get(city.slug);
  if (!a) throw new Error(`no course data for city ${city.slug}`);
  const per100k = a.courseCount / (city.population / 100_000);
  return {
    slug: city.slug,
    name: city.name,
    stateSlug: city.stateSlug,
    msaName: city.msaName,
    cbsaCode: city.cbsaCode,
    population: city.population,
    courseCount: a.courseCount,
    coursesPer100k: Math.round(per100k * 10) / 10,
    freeCount: a.freeCount,
  };
});

const nextRefresh = `${parseInt(pop.pulledAt.slice(0, 4), 10) + 1}${pop.pulledAt.slice(4)}`;

const payload = {
  name: 'Disc Golf Courses per 100,000 Residents by City',
  description:
    'Course supply per 100,000 residents for 15 US metros, from FindFrolf course data and U.S. Census Bureau ACS 5-year metropolitan population.',
  source: pop.source,
  sourceUrl: pop.sourceUrl,
  datasetVersion: pop.datasetVersion,
  variable: pop.variable,
  license: pop.license,
  attribution: pop.attribution,
  pulledAt: pop.pulledAt,
  nextRefresh,
  cities,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });
writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ wrote ${OUT_FILE}`);
console.log(`✓ wrote ${PUBLIC_OUT_FILE}`);
console.log(`  ${cities.length} cities, ${pop.datasetVersion}, pulled ${pop.pulledAt}`);
