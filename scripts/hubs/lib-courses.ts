/**
 * Shared course-reading helper for the remaining hubs (courses-per-100k,
 * terrain-index, free-play-map). Reads src/content/courses/*.json directly
 * (not via astro:content) so it also works inside plain node build scripts.
 *
 * Aggregates are deterministic: same course directory => same output.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const COURSES_DIR = join(ROOT, 'src', 'content', 'courses');

export interface CourseRecord {
  slug: string;
  citySlug: string;
  stateSlug: string;
  name: string;
  isFree: boolean;
  isWooded: boolean;
  difficultyRating: number | undefined;
  totalFeet: number | undefined;
  foliage: string | undefined;
  elevation: string | undefined;
  lat: number | undefined;
  lng: number | undefined;
}

export interface CityAggregate {
  slug: string;
  courseCount: number;
  freeCount: number;
  paidCount: number;
  woodedCount: number;
  avgDifficulty: number;
  avgTotalFeet: number;
  lat: number | undefined;
  lng: number | undefined;
}

export function readCourses(): CourseRecord[] {
  const out: CourseRecord[] = [];
  for (const f of readdirSync(COURSES_DIR)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(readFileSync(join(COURSES_DIR, f), 'utf8'));
    out.push({
      slug: f.replace(/\.json$/, ''),
      citySlug: d.citySlug,
      stateSlug: d.stateSlug,
      name: d.name,
      isFree: d.isFree === true,
      isWooded: d.isWooded === true,
      difficultyRating: typeof d.difficultyRating === 'number' ? d.difficultyRating : undefined,
      totalFeet: typeof d.totalFeet === 'number' ? d.totalFeet : undefined,
      foliage: d.foliage,
      elevation: d.elevation,
      lat: d.location?.lat,
      lng: d.location?.lng,
    });
  }
  return out;
}

export function aggregateByCity(
  courses: CourseRecord[],
  citySlugs: string[],
): Map<string, CityAggregate> {
  const map = new Map<string, CityAggregate>();
  for (const slug of citySlugs) {
    const city = courses.filter((c) => c.citySlug === slug);
    const withDiff = city.filter((c) => c.difficultyRating != null);
    const withFeet = city.filter((c) => c.totalFeet != null);
    const withCoords = city.filter((c) => c.lat != null && c.lng != null);
    map.set(slug, {
      slug,
      courseCount: city.length,
      freeCount: city.filter((c) => c.isFree).length,
      paidCount: city.filter((c) => !c.isFree).length,
      woodedCount: city.filter((c) => c.isWooded).length,
      avgDifficulty: withDiff.length
        ? withDiff.reduce((s, c) => s + (c.difficultyRating as number), 0) / withDiff.length
        : 0,
      avgTotalFeet: withFeet.length
        ? Math.round(withFeet.reduce((s, c) => s + (c.totalFeet as number), 0) / withFeet.length)
        : 0,
      lat: withCoords.length ? withCoords.reduce((s, c) => s + (c.lat as number), 0) / withCoords.length : undefined,
      lng: withCoords.length ? withCoords.reduce((s, c) => s + (c.lng as number), 0) / withCoords.length : undefined,
    });
  }
  return map;
}
