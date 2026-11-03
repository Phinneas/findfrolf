/**
 * Step 1a — FETCH: pull NOAA NCEI 1991-2020 monthly climate normals for the
 * 15 hub cities and write the raw climate layer to
 * src/data/hubs/playable-months.climate.json.
 *
 * - No API token required (NCEI Access Data Service, public domain).
 * - Station per city: nearest US station with COMPLETE monthly normals for
 *   all four data types (verified field names in lib.ts). Never invented:
 *   any API failure aborts the run with a non-zero exit.
 * - The GHCN station inventory is cached (uncommitted) for same-day reruns.
 *
 * Run: node scripts/hubs/playable-months/fetch.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_CITIES } from './cities.config.ts';
import {
  GHCN_STATIONS_URL,
  cityCenter,
  completeNormals,
  fetchMonthlyNormals,
  nearestStations,
  parseStationInventory,
} from './lib.ts';

const ROOT = process.cwd();
const CACHE_DIR = join(ROOT, 'scripts', 'hubs', 'playable-months', '.cache');
const STATIONS_CACHE = join(CACHE_DIR, 'ghcnd-stations.txt');
const COURSES_DIR = join(ROOT, 'src', 'content', 'courses');
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'playable-months.climate.json');

const SEARCH_KM = 75;
const CANDIDATES_PER_CITY = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function stationInventory(): Promise<string> {
  if (existsSync(STATIONS_CACHE)) {
    console.log('  station inventory: using cache');
    return readFileSync(STATIONS_CACHE, 'utf8');
  }
  console.log(`  station inventory: downloading ${GHCN_STATIONS_URL}`);
  const res = await fetch(GHCN_STATIONS_URL);
  if (!res.ok) throw new Error(`Station inventory download failed: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(STATIONS_CACHE, text);
  return text;
}

async function main(): Promise<void> {
  const pulledAt = new Date().toISOString().slice(0, 10);
  const inventory = parseStationInventory(await stationInventory());
  console.log(`  parsed ${inventory.length} US stations`);

  const cities = [];
  for (const city of HUB_CITIES) {
    const center = cityCenter(COURSES_DIR, city.slug);
    // Prefer USW (WBAN — airport/first-order) stations, per the brief's
    // "primary airport station"; fall back to any US station with complete
    // normals within the search radius. Filter BEFORE slicing so close COOP
    // stations can't crowd out the airport stations.
    const withinRange = nearestStations(inventory, center, SEARCH_KM, Number.MAX_SAFE_INTEGER);
    const usw = withinRange.filter((s) => s.id.startsWith('USW')).slice(0, CANDIDATES_PER_CITY);
    const candidates = usw.length > 0 ? usw : withinRange.slice(0, CANDIDATES_PER_CITY);
    if (candidates.length === 0) {
      throw new Error(`No US stations within ${SEARCH_KM} km of ${city.slug} — stop and report, do not guess.`);
    }

    const rows = await fetchMonthlyNormals(candidates.map((c) => c.id));
    const complete = completeNormals(rows);
    const pick = candidates.find((c) => complete.has(c.id));
    if (!pick) {
      throw new Error(
        `No station with complete monthly normals for ${city.slug} ` +
          `(tried ${candidates.map((c) => c.id).join(', ')}) — stop and report.`,
      );
    }

    console.log(
      `  ${city.slug.padEnd(20)} ${pick.id}  ${pick.name}  ${pick.distanceKm.toFixed(1)} km from metro centroid`,
    );
    cities.push({
      slug: city.slug,
      name: city.name,
      stateSlug: city.stateSlug,
      timeZone: city.timeZone,
      center: {
        lat: round4(center.lat),
        lng: round4(center.lng),
        method: 'mean of course coordinates in src/content/courses',
      },
      station: {
        id: pick.id,
        name: pick.name,
        lat: pick.lat,
        lng: pick.lng,
        distanceKm: round1(pick.distanceKm),
      },
      months: complete.get(pick.id),
    });
    await sleep(500); // be gentle with the public API
  }

  const payload = {
    source: 'NOAA NCEI U.S. Climate Normals 1991-2020, monthly (normals-monthly-1991-2020), NCEI Access Data Service',
    sourceUrl: 'https://www.ncei.noaa.gov/access/services/data/v1',
    stationInventoryUrl: GHCN_STATIONS_URL,
    datasetVersion: '1991-2020',
    license: 'NOAA data is public domain',
    pulledAt,
    cities,
  };

  mkdirSync(join(ROOT, 'src', 'data', 'hubs'), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`\n✓ wrote ${OUT_FILE} (${cities.length} cities, pulled_at ${pulledAt})`);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

await main();
