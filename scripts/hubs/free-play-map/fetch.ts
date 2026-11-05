/**
 * FETCH — free-play-map hub: for each free course, look up the land manager
 * (type + name) from the USGS PAD-US v3.0 "Manager Type" layer via the ArcGIS
 * REST API point-in-polygon query. A course whose point falls outside every
 * PAD-US polygon is recorded as "not on protected land".
 *
 * PAD-US is public domain (USGS). 749 free-course points → 749 point queries.
 * No API key required.
 *
 * Run: node scripts/hubs/free-play-map/fetch.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CITY_SLUGS } from '../cities.ts';
import { readCourses } from '../lib-courses.ts';

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'free-play-map.land.json');

const ARCGIS_URL =
  'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Manager_Type/FeatureServer/0/query';

// PAD-US "Manager Type" (Agency Type domain) codes → friendly label.
const MANAGER_TYPE: Record<string, string> = {
  FED: 'Federal',
  TRIB: 'Tribal',
  STAT: 'State',
  STATE: 'State',
  LOC: 'Local',
  PRIV: 'Private',
  NGO: 'Non-profit',
  UNK: 'Unknown',
  TER: 'Territorial',
  DIST: 'Special district',
};

interface LandResult {
  slug: string;
  name: string;
  citySlug: string;
  lat: number;
  lng: number;
  managerType: string;
  managerName: string | null;
  unitName: string | null;
}

async function lookup(course: { slug: string; name: string; citySlug: string; lat: number; lng: number }): Promise<LandResult> {
  const url =
    `${ARCGIS_URL}?geometry=${course.lng},${course.lat}` +
    `&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&inSR=4326` +
    `&outFields=Mang_Type,Mang_Name,Unit_Nm&returnGeometry=false&f=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PAD-US HTTP ${res.status} for ${course.slug}`);
  const data = (await res.json()) as { features?: { attributes: Record<string, unknown> }[] };
  const feat = data.features?.[0];
  const attrs = feat?.attributes ?? {};
  const code = String(attrs.Mang_Type ?? '');
  const managerType = MANAGER_TYPE[code] ?? (code || 'not on protected land');
  return {
    slug: course.slug,
    name: course.name,
    citySlug: course.citySlug,
    lat: course.lat,
    lng: course.lng,
    managerType,
    managerName: attrs.Mang_Name ? String(attrs.Mang_Name) : null,
    unitName: attrs.Unit_Nm ? String(attrs.Unit_Nm) : null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const courses = readCourses();
  const free = courses.filter(
    (c) => c.isFree && c.lat != null && c.lng != null && CITY_SLUGS.includes(c.citySlug),
  );
  console.log(`  looking up land manager for ${free.length} free courses…`);

  const results: LandResult[] = [];
  for (let i = 0; i < free.length; i++) {
    const c = free[i];
    try {
      results.push(await lookup({ slug: c.slug, name: c.name, citySlug: c.citySlug, lat: c.lat!, lng: c.lng! }));
    } catch (err) {
      // One failed lookup should not abort the whole run; mark it unknown.
      results.push({
        slug: c.slug,
        name: c.name,
        citySlug: c.citySlug,
        lat: c.lat!,
        lng: c.lng!,
        managerType: 'Unknown',
        managerName: null,
        unitName: null,
      });
    }
    if (i % 50 === 0) console.log(`    ${i}/${free.length}`);
    await sleep(120); // gentle rate limit
  }

  const payload = {
    name: 'Free course land managers (PAD-US)',
    source: 'USGS PAD-US v3.0 Manager Type layer (ArcGIS REST)',
    sourceUrl: 'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Manager_Type/FeatureServer/0',
    datasetVersion: '3.0',
    license: 'USGS PAD-US (public domain)',
    pulledAt: new Date().toISOString().slice(0, 10),
    courses: results,
  };

  mkdirSync(join(ROOT, 'src', 'data', 'hubs'), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✓ wrote ${OUT_FILE} (${results.length} free courses, pulled ${payload.pulledAt})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
