/**
 * FETCH — courses-per-100k hub: pull MSA population from the U.S. Census
 * Bureau Data API (2024 ACS 5-year, variable B01003_001E total population)
 * for the 15 hub metros, keyed by their OMB CBSA code.
 *
 * Replaces the previously hardcoded 2020 decennial numbers. The Census API key
 * is read from CENSUS_API_KEY in .env (gitignored).
 *
 * Run: node scripts/hubs/courses-per-100k/fetch.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES } from '../cities.ts';

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'courses-per-100k.population.json');

const CENSUS_DATASET = 'acs/acs5';
const CENSUS_YEAR = '2024';
const CENSUS_VAR = 'B01003_001E';
const GEO = 'metropolitan statistical area/micropolitan statistical area';

function readEnvKey(): string {
  const env = readFileSync(join(ROOT, '.env'), 'utf8');
  const m = env.match(/^CENSUS_API_KEY=(.+)$/m);
  if (!m || !m[1].trim()) {
    throw new Error('CENSUS_API_KEY not set in .env — add it (api.census.gov/data/key_signup.html).');
  }
  return m[1].trim();
}

async function main(): Promise<void> {
  const key = readEnvKey();
  const url =
    `https://api.census.gov/data/${CENSUS_YEAR}/${CENSUS_DATASET}` +
    `?get=NAME,${CENSUS_VAR}&for=${encodeURIComponent(GEO)}:*&key=${key}`;

  console.log(`  fetching ${CENSUS_YEAR} ${CENSUS_DATASET} (${CENSUS_VAR}) for all CBSAs…`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Census API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const rows = (await res.json()) as [string, string, string][];
  const byCode = new Map(rows.slice(1).map(([name, pop, code]) => [code, { name, population: parseInt(pop, 10) }]));

  const cities = HUB_CITIES.map((city) => {
    const hit = byCode.get(city.cbsaCode);
    if (!hit) throw new Error(`Census API returned no row for CBSA ${city.cbsaCode} (${city.name}).`);
    return {
      slug: city.slug,
      name: city.name,
      stateSlug: city.stateSlug,
      msaName: hit.name,
      cbsaCode: city.cbsaCode,
      population: hit.population,
    };
  });

  const payload = {
    name: 'Metro population (Census API)',
    source: 'U.S. Census Bureau Data API — American Community Survey 5-year estimates',
    sourceUrl: 'https://api.census.gov/data/2024/acs/acs5',
    datasetVersion: `${CENSUS_YEAR} ${CENSUS_DATASET} (${CENSUS_VAR})`,
    variable: CENSUS_VAR,
    license: 'U.S. Census Bureau data (public domain)',
    attribution: 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.',
    pulledAt: new Date().toISOString().slice(0, 10),
    cities,
  };

  mkdirSync(join(ROOT, 'src', 'data', 'hubs'), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✓ wrote ${OUT_FILE} (${cities.length} metros, pulled ${payload.pulledAt})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
