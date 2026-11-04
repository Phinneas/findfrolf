/**
 * Site-wide course statistics, computed from the course data at build time.
 *
 * Blog posts and pages must reference these values (or the
 * {{stats:...}} tokens, see `interpolateStats` and
 * `src/lib/remark-stats.ts`) instead of hardcoded counts, so numbers can
 * never drift away from the actual directory.
 *
 * Reads the JSON files directly (not via `astro:content`) so it also works
 * inside the remark pipeline, where the content-layer virtual module is not
 * available. Computed once per build process.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolved from the project root (astro build/dev always runs with cwd at the
// project root). Do NOT resolve from import.meta.url — this module is bundled
// into dist/.prerender at build time, where relative paths would break.
const COURSES_DIR = join(process.cwd(), 'src', 'content', 'courses');

interface CourseStatsRecord {
  citySlug: string;
  stateSlug: string;
  isFree: boolean;
}

function* walkJson(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJson(full);
    } else if (entry.name.endsWith('.json')) {
      yield full;
    }
  }
}

function loadCourses(): CourseStatsRecord[] {
  const records: CourseStatsRecord[] = [];
  for (const file of walkJson(COURSES_DIR)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    records.push({
      citySlug: data.citySlug,
      stateSlug: data.stateSlug,
      isFree: data.isFree === true,
    });
  }
  return records;
}

const courses = loadCourses();

/** Total published courses in the directory. */
export const totalCourses = courses.length;

/** Total states with at least one published course. */
export const totalStates = new Set(courses.map((c) => c.stateSlug)).size;

/** Courses that are free to play. */
export const freeCourses = courses.filter((c) => c.isFree).length;

/** Courses published for a city hub, e.g. coursesByCity('denver'). */
export function coursesByCity(citySlug: string): number {
  return courses.filter((c) => c.citySlug === citySlug).length;
}

/** Free-to-play courses published for a city hub. */
export function freeCoursesByCity(citySlug: string): number {
  return courses.filter((c) => c.citySlug === citySlug && c.isFree).length;
}

/** Pay-to-play courses published for a city hub. */
export function paidCoursesByCity(citySlug: string): number {
  return coursesByCity(citySlug) - freeCoursesByCity(citySlug);
}

/* ------------------------------------------------------------------ */
/*  Token interpolation                                                */
/*                                                                     */
/*  Body text of .md posts is handled by the remark plugin             */
/*  (src/lib/remark-stats.ts). Frontmatter strings (description,       */
/*  faqItems, …) never pass through remark, so templates rendering     */
/*  them call interpolateStats() directly.                             */
/*                                                                     */
/*  Supported tokens:                                                  */
/*    {{stats:totalCourses}}  {{stats:totalStates}}                    */
/*    {{stats:freeCourses}}   {{stats:city:<citySlug>}}                */
/*    {{stats:freeCity:<citySlug>}}  {{stats:paidCity:<citySlug>}}     */
/*                                                                     */
/*  Both the colon form ({{stats:city:denver}}) and the dot form       */
/*  ({{stats:city.denver}}) work everywhere. .md post bodies are       */
/*  resolved at the block level from the raw source (see               */
/*  src/lib/mdast-stats.ts), so remark-directive splitting does not    */
/*  affect them.                                                       */
/* ------------------------------------------------------------------ */

const STATS_TOKEN = /\{\{\s*stats:([a-zA-Z]+)(?:[.:]([a-z0-9-]+))?\s*\}\}/g;

export function interpolateStats(text: string): string {
  return text.replace(STATS_TOKEN, (match, key: string, arg?: string) => {
    switch (key) {
      case 'totalCourses':
        return String(totalCourses);
      case 'totalStates':
        return String(totalStates);
      case 'freeCourses':
        return String(freeCourses);
      case 'city':
      case 'freeCity':
      case 'paidCity':
        if (!arg) {
          throw new Error(
            `stats token "${key}" requires a citySlug (e.g. {{stats:${key}:denver}}): ${match}`,
          );
        }
        return String(
          key === 'city'
            ? coursesByCity(arg)
            : key === 'freeCity'
              ? freeCoursesByCity(arg)
              : paidCoursesByCity(arg),
        );
      default:
        throw new Error(`Unknown stats token: ${match}`);
    }
  });
}
