/**
 * Build-time state outline maps.
 *
 * Uses the U.S. Census TopoJSON shipped by `us-atlas`, decoded with
 * `topojson-client`, to render an accurate state silhouette as an SVG path
 * and to project course lat/lng pins onto it. This runs entirely server-side
 * during the Astro build, so nothing here is shipped to the browser.
 */

import { feature } from 'topojson-client';
import statesTopoJson from 'us-atlas/states-10m.json';

/* eslint-disable @typescript-eslint/no-explicit-any */
const topology: any = statesTopoJson;
const stateCollection: any = feature(topology, topology.objects.states);

const byName = new Map<string, any>();
for (const f of stateCollection.features) {
  if (f?.properties?.name) byName.set(f.properties.name, f);
}

export interface StatePin {
  lat: number;
  lng: number;
}

export interface StateMapResult {
  /** SVG path `d` for the state outline (y already flipped for SVG space). */
  pathD: string;
  /** `viewBox` in (lng, -lat) space covering the state and every pin. */
  viewBox: string;
  /** Pin radius expressed in the same degree-space units as the viewBox. */
  pinRadius: number;
  /** Outline stroke width in the same degree-space units. */
  strokeWidth: number;
}

/** Convert a GeoJSON coordinate ring into an SVG subpath (latitude flipped). */
function ringToD(ring: number[][]): string {
  return ring
    .map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${lng.toFixed(5)} ${(-lat).toFixed(5)}`)
    .join(' ') + ' Z';
}

function geometryToPath(geometry: any): string {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring: number[][]) => ringToD(ring)).join(' ');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((poly: number[][][]) => poly.map((ring: number[][]) => ringToD(ring)).join(' '))
      .join(' ');
  }
  return '';
}

/**
 * Build the render data for one state's outline map. `points` are the course
 * locations to pin; the viewBox is expanded to include them so no pin falls
 * outside the drawn area.
 */
export function buildStateMap(stateName: string, points: StatePin[]): StateMapResult | null {
  const feat = byName.get(stateName);
  if (!feat) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const scanRing = (ring: number[][]) => {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };

  const geom = feat.geometry;
  const polys =
    geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) {
    for (const ring of poly) scanRing(ring);
  }

  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  const width = maxLng - minLng;
  const height = maxLat - minLat;
  const scale = Math.min(width, height) || 1;

  return {
    pathD: geometryToPath(geom),
    // y = -lat keeps north at the top of an SVG canvas.
    viewBox: `${minLng} ${-maxLat} ${width} ${height}`,
    pinRadius: scale * 0.022,
    strokeWidth: scale * 0.004,
  };
}

/** Project a lat/lng into the same (lng, -lat) space used by the viewBox. */
export function projectPoint(lat: number, lng: number): { x: number; y: number } {
  return { x: lng, y: -lat };
}
