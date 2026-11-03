/**
 * Step 1b — BUILD: combine the fetched climate layer
 * (src/data/hubs/playable-months.climate.json) with civil dusk (suncalc)
 * and the playable-month rule (rule.ts) into the committed hub dataset
 * src/data/hubs/playable-months.json.
 *
 * Deterministic: same climate layer + same pulled date => identical output.
 * Pages read ONLY this file — no external API calls at site build time.
 *
 * Run: node scripts/hubs/playable-months/build.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as SunCalc from 'suncalc';
import { RULE, RULE_VERSION, classifyMonth, type MonthStatus } from './rule.ts';

const ROOT = process.cwd();
const CLIMATE_FILE = join(ROOT, 'src', 'data', 'hubs', 'playable-months.climate.json');
const OUT_FILE = join(ROOT, 'src', 'data', 'hubs', 'playable-months.json');

interface ClimateMonth {
  month: number;
  tmaxF: number;
  tminF: number;
  prcpIn: number;
  rainDays: number;
}

interface ClimateCity {
  slug: string;
  name: string;
  stateSlug: string;
  timeZone: string;
  center: { lat: number; lng: number; method: string };
  station: { id: string; name: string; lat: number; lng: number; distanceKm: number };
  months: ClimateMonth[];
}

const climate = JSON.parse(readFileSync(CLIMATE_FILE, 'utf8')) as {
  source: string;
  sourceUrl: string;
  stationInventoryUrl: string;
  datasetVersion: string;
  license: string;
  pulledAt: string;
  cities: ClimateCity[];
};

/** Civil dusk local time ("HH:MM", 24h) for the 15th of the month. */
function localDusk(year: number, month: number, lat: number, lng: number, timeZone: string): string {
  const date = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  const dusk: Date = SunCalc.getTimes(date, lat, lng).dusk;
  if (Number.isNaN(dusk.getTime())) {
    throw new Error(`suncalc returned no dusk for ${lat},${lng} month ${month} — stop and report.`);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(dusk);
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const year = parseInt(climate.pulledAt.slice(0, 4), 10);
const nextRefresh = `${parseInt(climate.pulledAt.slice(0, 4), 10) + 1}${climate.pulledAt.slice(4)}`;

const cities = climate.cities.map((city) => {
  const months = city.months.map((m) => {
    const duskLocal = localDusk(year, m.month, city.center.lat, city.center.lng, city.timeZone);
    const status: MonthStatus = classifyMonth(m, RULE);
    return {
      month: m.month,
      tmaxF: m.tmaxF,
      tminF: m.tminF,
      prcpIn: m.prcpIn,
      rainDays: m.rainDays,
      duskLocal,
      daylightAfter5pmMin: Math.max(0, toMinutes(duskLocal) - 17 * 60),
      wind: null, // v1: not ingested — see docs/hub-playable-months.md (wind source candidates)
      status,
    };
  });
  return {
    slug: city.slug,
    name: city.name,
    stateSlug: city.stateSlug,
    timeZone: city.timeZone,
    center: city.center,
    station: city.station,
    source: climate.source,
    datasetVersion: climate.datasetVersion,
    pulledAt: climate.pulledAt,
    ruleVersion: RULE_VERSION,
    playableMonthCount: months.filter((m) => m.status === 'playable').length,
    months,
  };
});

const payload = {
  name: 'Playable Months by City',
  description:
    'Monthly disc-golf playability for 15 US cities from NOAA 1991-2020 climate normals (temperature, precipitation, rain days) plus civil dusk.',
  source: climate.source,
  sourceUrl: climate.sourceUrl,
  datasetVersion: climate.datasetVersion,
  license: climate.license,
  pulledAt: climate.pulledAt,
  nextRefresh,
  ruleVersion: RULE_VERSION,
  rule: {
    tmaxMinF: RULE.tmaxMinF,
    tminMinF: RULE.tminMinF,
    rainDaysMax: RULE.rainDaysMax,
    playable: `normal max >= ${RULE.tmaxMinF}F AND normal min >= ${RULE.tminMinF}F AND rain days (>= 0.10 in) <= ${RULE.rainDaysMax}`,
    marginal: 'fails exactly one condition',
    offSeason: 'fails two or more conditions',
  },
  cities,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ wrote ${OUT_FILE}`);
console.log(`  ${cities.length} cities × 12 months, rule v${RULE_VERSION}, pulled ${climate.pulledAt}, next refresh ${nextRefresh}`);
