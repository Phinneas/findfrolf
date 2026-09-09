#!/usr/bin/env node
/** Generate branded city-name SVG badges for city guides + the "by city" grid. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/images');

const CITIES = [
  ['austin', 'Austin'],
  ['denver', 'Denver'],
  ['portland', 'Portland'],
  ['chicago', 'Chicago'],
  ['seattle', 'Seattle'],
  ['charlotte', 'Charlotte'],
  ['houston', 'Houston'],
  ['phoenix', 'Phoenix'],
  ['nashville', 'Nashville'],
  ['raleigh', 'Raleigh'],
  ['dallas-fort-worth', 'Dallas-Fort Worth'],
  ['kansas-city', 'Kansas City'],
  ['atlanta', 'Atlanta'],
  ['cincinnati', 'Cincinnati'],
  ['minneapolis-st-paul', 'Minneapolis-St. Paul'],
];

const FOREST = '#21402f';
const FOREST_DEEP = '#15281d';
const SUN = '#edb441';
const CLAY = '#d35a35';
const CREAM = '#ffffff';

function fontSize(name) {
  const n = name.length;
  if (n > 18) return 64;
  if (n > 14) return 76;
  if (n > 10) return 92;
  if (n > 7) return 112;
  return 128;
}

function svg(name) {
  const size = fontSize(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${name} disc golf">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${FOREST}"/>
      <stop offset="1" stop-color="${FOREST_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <g fill="none" stroke="${SUN}" stroke-opacity="0.15">
    <circle cx="600" cy="600" r="500" stroke-width="3"/>
    <circle cx="600" cy="600" r="390" stroke-width="3"/>
    <circle cx="600" cy="600" r="280" stroke-width="3"/>
  </g>
  <text x="600" y="300" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="10" fill="${SUN}">DISC GOLF</text>
  <rect x="545" y="340" width="110" height="9" fill="${CLAY}"/>
  <text x="600" y="700" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="600" fill="${CREAM}">${name}</text>
</svg>
`;
}

for (const [slug, name] of CITIES) {
  writeFileSync(join(OUT, `city-${slug}.svg`), svg(name) + '\n');
}
console.log(`wrote ${CITIES.length} city badges to public/images/`);
