/**
 * Shared {{cpm:...}} token resolver for the courses-per-100k data hub.
 *
 * Used by both the mdast-stats plugin (hub position block, rendered as plain
 * paragraphs) and the mdast-datashows plugin (the :::datashows boxes in cluster
 * posts). Lets owner copy reference course counts, population, and per-capita
 * rates without hardcoding a number that can drift as the directory grows.
 *
 * Forms:
 *   {{cpm:rate}}            courses per 100k (of the context city)
 *   {{cpm:courseCount}}     {{cpm:freeCount}}   {{cpm:paidCount}}
 *   {{cpm:population}}      {{cpm:freePct}}     (free share %, integer)
 *   {{cpm:chicago:rate}}    another city's value (explicit slug)
 *   {{cpm:maxRate}}         {{cpm:minRate}}     cross-city aggregates
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface CpmCity {
  slug: string;
  name: string;
  stateSlug: string;
  msaName: string;
  cbsaCode: string;
  population: number;
  courseCount: number;
  coursesPer100k: number;
  freeCount: number;
}

interface CpmFile {
  pulledAt: string;
  cities: CpmCity[];
}

let cpmCache: CpmFile | null = null;
function loadCpm(): CpmFile {
  if (!cpmCache) {
    cpmCache = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'data', 'hubs', 'courses-per-100k.json'), 'utf8'),
    ) as CpmFile;
  }
  return cpmCache;
}

function fieldOf(city: CpmCity, field: string): string {
  switch (field) {
    case 'rate':
      return String(city.coursesPer100k);
    case 'courseCount':
      return String(city.courseCount);
    case 'freeCount':
      return String(city.freeCount);
    case 'paidCount':
      return String(city.courseCount - city.freeCount);
    case 'population':
      return String(city.population);
    case 'freePct':
      return String(Math.round((city.freeCount / city.courseCount) * 100));
    default:
      throw new Error(`cpm: unknown field "${field}"`);
  }
}

export function resolveCpmTokens(text: string, citySlug?: string): string {
  if (!text.includes('{{cpm:')) return text;
  const hub = loadCpm();
  const bySlug = new Map(hub.cities.map((c) => [c.slug, c]));
  return text.replace(/\{\{\s*cpm:([a-zA-Z0-9-]+)(?::([a-zA-Z0-9-]+))?\s*\}\}/g, (match, a, b) => {
    // a = field (or city when b present); b = field (explicit city form)
    if (b) {
      const city = bySlug.get(a);
      if (!city) throw new Error(`cpm: unknown city "${a}" in "${match}"`);
      return fieldOf(city, b);
    }
    // Single-part: aggregate, or context-city field.
    switch (a) {
      case 'maxRate':
        return String(Math.max(...hub.cities.map((c) => c.coursesPer100k)));
      case 'minRate':
        return String(Math.min(...hub.cities.map((c) => c.coursesPer100k)));
      case 'cityCount':
        return String(hub.cities.length);
      default: {
        if (!citySlug) throw new Error(`cpm: token "${match}" needs a city (no context city)`);
        const city = bySlug.get(citySlug);
        if (!city) throw new Error(`cpm: unknown context city "${citySlug}"`);
        return fieldOf(city, a);
      }
    }
  });
}
