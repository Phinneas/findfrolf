/**
 * Shared helpers for the Playable Months pipeline: geography, city centers
 * (derived from course data), GHCN station metadata, and the NOAA NCEI
 * Access Data Service client (no API token required).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const NCEI_DATA_URL = 'https://www.ncei.noaa.gov/access/services/data/v1';
export const GHCN_STATIONS_URL = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt';
export const DATASET = 'normals-monthly-1991-2020';

/** Verified against the live API response on 2026-11-03 — do not guess. */
export const DATA_TYPES = {
  tmax: 'MLY-TMAX-NORMAL',
  tmin: 'MLY-TMIN-NORMAL',
  prcp: 'MLY-PRCP-NORMAL',
  rainDays: 'MLY-PRCP-AVGNDS-GE010HI',
} as const;

/* ------------------------------------------------------------------ */

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ------------------------------------------------------------------ */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * City center = mean of the city's course coordinates. The city content
 * collection carries no lat/lng of its own; the mean of mapped courses is a
 * defensible metro centroid for "distance to climate station" purposes.
 */
export function cityCenter(coursesDir: string, citySlug: string): LatLng {
  const lats: number[] = [];
  const lngs: number[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) {
        const d = JSON.parse(readFileSync(full, 'utf8'));
        if (d.citySlug === citySlug) {
          lats.push(d.location.lat);
          lngs.push(d.location.lng);
        }
      }
    }
  };
  walk(coursesDir);
  if (lats.length === 0) throw new Error(`No courses found for city '${citySlug}' — cannot derive center`);
  return {
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
  };
}

/* ------------------------------------------------------------------ */

export interface StationMeta {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

/** Parse the fixed-width GHCN-daily station inventory (public domain). */
export function parseStationInventory(text: string): StationMeta[] {
  const out: StationMeta[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 70) continue;
    const id = line.slice(0, 11).trim();
    if (!id.startsWith('US')) continue; // US cities only
    out.push({
      id,
      lat: parseFloat(line.slice(12, 20)),
      lng: parseFloat(line.slice(21, 30)),
      name: line.slice(41, 71).trim(),
    });
  }
  return out;
}

export function nearestStations(stations: StationMeta[], center: LatLng, limitKm: number, limit: number) {
  return stations
    .map((s) => ({ ...s, distanceKm: haversineKm(center.lat, center.lng, s.lat, s.lng) }))
    .filter((s) => s.distanceKm <= limitKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */

export interface NormalsRow {
  STATION: string;
  DATE: string;
  [key: string]: string;
}

/** One NCEI request for several stations and the four monthly data types. */
export async function fetchMonthlyNormals(stationIds: string[]): Promise<NormalsRow[]> {
  const params = new URLSearchParams({
    dataset: DATASET,
    dataTypes: Object.values(DATA_TYPES).join(','),
    stations: stationIds.join(','),
    format: 'json',
    units: 'standard',
  });
  const url = `${NCEI_DATA_URL}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    // DO NOT invent data — stop and report (see phase brief).
    throw new Error(`NCEI request failed: HTTP ${res.status} for stations ${stationIds.join(',')}`);
  }
  const body = (await res.json()) as NormalsRow[];
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error(`NCEI returned no rows for stations ${stationIds.join(',')}`);
  }
  return body;
}

/**
 * Rows → per-station monthly climate, or null when any month/field is
 * missing or flagged (NCEI uses attributes in trailing columns; empty means
 * incomplete normals).
 */
export function completeNormals(rows: NormalsRow[]): Map<
  string,
  { month: number; tmaxF: number; tminF: number; prcpIn: number; rainDays: number }[]
> {
  const byStation = new Map<string, NormalsRow[]>();
  for (const row of rows) {
    const list = byStation.get(row.STATION) ?? [];
    list.push(row);
    byStation.set(row.STATION, list);
  }
  const out = new Map<string, { month: number; tmaxF: number; tminF: number; prcpIn: number; rainDays: number }[]>();
  for (const [station, list] of byStation) {
    if (list.length !== 12) continue;
    const months = list
      .map((row) => {
        const vals = [row[DATA_TYPES.tmax], row[DATA_TYPES.tmin], row[DATA_TYPES.prcp], row[DATA_TYPES.rainDays]];
        if (vals.some((v) => v === undefined || v === null || String(v).trim() === '')) return null;
        return {
          month: parseInt(row.DATE, 10),
          tmaxF: parseFloat(row[DATA_TYPES.tmax]),
          tminF: parseFloat(row[DATA_TYPES.tmin]),
          prcpIn: parseFloat(row[DATA_TYPES.prcp]),
          rainDays: parseFloat(row[DATA_TYPES.rainDays]),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.month - b.month);
    if (months.length === 12) out.set(station, months);
  }
  return out;
}
