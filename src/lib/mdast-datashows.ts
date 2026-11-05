/**
 * Markdown plugin (Sätteri mdast pipeline): renders the reusable
 * "What the data shows" box inside .md posts via a container directive:
 *
 *   :::datashows{hub="playable-months" city="chicago"}
 *   Owner copy goes here (100–200 words).
 *   :::
 *
 * Blog posts are plain .md (no MDX in this site), so the `<DataShows />`
 * contract is implemented as a directive + build-time renderer instead of an
 * Astro component. The figure is computed from the COMMITTED hub dataset
 * (src/data/hubs/playable-months.json) at site build time — never from an
 * external API.
 *
 * The directive's body becomes the copy slot, extracted from the source and
 * rendered as plain paragraphs (copy is prose — no inline markdown).
 */

import { defineMdastPlugin } from 'satteri';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCpmTokens } from './hub-tokens';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_COLOR: Record<string, string> = {
  playable: '#3d6b4f',
  marginal: '#d9a441',
  'off-season': '#d8d3c3',
};

interface HubMonth {
  month: number;
  status: 'playable' | 'marginal' | 'off-season';
  duskLocal: string;
  daylightAfter5pmMin: number;
  tmaxF: number;
  tminF: number;
  rainDays: number;
}
interface HubCity {
  slug: string;
  name: string;
  playableMonthCount: number;
  months: HubMonth[];
}
interface HubFile {
  name: string;
  pulledAt: string;
  cities: HubCity[];
}

let hubCache: HubFile | null = null;
function loadHub(): HubFile {
  if (!hubCache) {
    hubCache = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'data', 'hubs', 'playable-months.json'), 'utf8'),
    ) as HubFile;
  }
  return hubCache;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 24h "HH:MM" -> 12h "H:MM a.m./p.m." (matches owner prose, e.g. "9:39 p.m."). */
const to12Hour = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Resolve {{pm:...}} tokens inside the copy against the committed hub data, so
 * owner prose never hardcodes a climate figure that can drift with the rule.
 *
 * Forms (city defaults to the box's `city` attribute):
 *   {{pm:playableMonths}}                       city playable-month count
 *   {{pm:tminF:1}}  {{pm:rainDays:7}}            city month value (1..12)
 *   {{pm:dusk12:6}}                              city dusk in 12h "9:39 p.m."
 *   {{pm:chicago:dusk12:12}}                     another city's value
 *   {{pm:janBelowFreezingCount}}  {{pm:cityCount}}   cross-city aggregates
 */
function resolvePmTokens(copy: string, city: HubCity, hub: HubFile): string {
  const cityBySlug = new Map(hub.cities.map((c) => [c.slug, c]));
  const monthOf = (c: HubCity, month: number): HubMonth => {
    const m = c.months.find((x) => x.month === month);
    if (!m) throw new Error(`datashows: city ${c.slug} has no month ${month}`);
    return m;
  };
  return copy.replace(
    /\{\{\s*pm:([a-zA-Z0-9-]+)(?::([a-zA-Z0-9-]+))?(?::([0-9]{1,2}))?\s*\}\}/g,
    (match, a: string, b?: string, c?: string) => {
      let target = city;
      let field = '';
      let month: number | undefined;
      if (cityBySlug.has(a)) {
        target = cityBySlug.get(a)!;
        field = b ?? '';
        month = c ? parseInt(c, 10) : undefined;
      } else if (b && /^\d{1,2}$/.test(b)) {
        field = a;
        month = parseInt(b, 10);
      } else {
        field = a;
        month = c ? parseInt(c, 10) : undefined;
      }
      switch (field) {
        case 'playableMonths':
          return String(target.playableMonthCount);
        case 'cityCount':
          return String(hub.cities.length);
        case 'janBelowFreezingCount':
          return String(hub.cities.filter((cc) => monthOf(cc, 1).tminF < 32).length);
        case 'tminF':
          return String(monthOf(target, month!).tminF);
        case 'tmaxF':
          return String(monthOf(target, month!).tmaxF);
        case 'rainDays':
          return String(monthOf(target, month!).rainDays);
        case 'duskLocal':
          return monthOf(target, month!).duskLocal;
        case 'dusk12':
          return to12Hour(monthOf(target, month!).duskLocal);
        default:
          throw new Error(`datashows: unknown pm token "${match}"`);
      }
    },
  );
}

function miniStrip(city: HubCity): string {
  const cells = city.months
    .map((m) => {
      const label = `${MONTHS_SHORT[m.month - 1]}: ${m.status}`;
      return (
        `<span class="ds-cell" style="background:${STATUS_COLOR[m.status]}" ` +
        `title="${escapeHtml(label)}">${MONTHS_SHORT[m.month - 1]}</span>`
      );
    })
    .join('');
  return (
    `<div class="ds-figure" role="img" aria-label="${escapeHtml(city.name)} has ${city.playableMonthCount} playable months. ` +
    `Month by month: ${city.months.map((m) => `${MONTHS_SHORT[m.month - 1]} ${m.status}`).join(', ')}.">` +
    `<div class="ds-strip">${cells}</div>` +
    `<div class="ds-count">${city.playableMonthCount} playable months in ${escapeHtml(city.name)}</div></div>`
  );
}

interface CpmCity {
  slug: string;
  name: string;
  population: number;
  courseCount: number;
  coursesPer100k: number;
  freeCount: number;
}
interface CpmFile {
  cities: CpmCity[];
}

let cpmCache: CpmFile | null = null;
function loadCpmHub(): CpmFile {
  if (!cpmCache) {
    cpmCache = JSON.parse(
      readFileSync(join(process.cwd(), 'src', 'data', 'hubs', 'courses-per-100k.json'), 'utf8'),
    ) as CpmFile;
  }
  return cpmCache;
}

function rateFigure(city: CpmCity): string {
  const freePct = Math.round((city.freeCount / city.courseCount) * 100);
  return (
    `<div class="ds-figure" role="img" aria-label="${escapeHtml(city.name)} has ${city.coursesPer100k} courses per 100,000 residents: ` +
    `${city.courseCount} courses, ${city.freeCount} free (${freePct}%), ${city.population.toLocaleString()} residents.">` +
    `<div class="ds-count">${city.coursesPer100k} courses per 100,000 residents in ${escapeHtml(city.name)}</div>` +
    `<div class="ds-sub">${city.courseCount} courses · ${city.freeCount} free (${freePct}%) · ${city.population.toLocaleString()} residents</div></div>`
  );
}

export const datashowsPlugin = defineMdastPlugin({
  name: 'findfrolf-datashows',
  containerDirective(node, ctx) {
    if (node.name !== 'datashows') return;
    const attrs = node.attributes ?? {};
    const hubName = attrs.hub ?? 'playable-months';
    const citySlug = attrs.city;

    // Copy slot: the directive body's raw source, split into paragraphs.
    // Owner-authored content (committed to the repo), rendered RAW so links
    // and inline HTML in the copy work — never escaped. Keep it prose-only.
    let copy = '';
    const children = (node.children ?? []) as { position?: { start: { offset?: number }; end: { offset?: number } } }[];
    if (children.length > 0) {
      const first = children[0].position;
      const last = children[children.length - 1].position;
      if (first?.start.offset != null && last?.end.offset != null) {
        copy = ctx.source.slice(first.start.offset, last.end.offset).trim();
      }
    }

    const paragraphsOf = (s: string) =>
      (s || 'TODO: owner copy (100–200 words).').split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, ' ')}</p>`).join('');

    let figureHtml: string;
    let linkHtml: string;

    if (hubName === 'playable-months') {
      const hub = loadHub();
      const city = hub.cities.find((c) => c.slug === citySlug);
      if (!city) throw new Error(`datashows: unknown city '${citySlug}' — valid: ${hub.cities.map((c) => c.slug).join(', ')}`);
      copy = resolvePmTokens(copy, city, hub);
      figureHtml = miniStrip(city);
      linkHtml = `<a class="ds-link" href="/data/playable-months/">Explore the Playable Months by City data hub →</a>`;
    } else if (hubName === 'courses-per-100k') {
      const hub = loadCpmHub();
      const city = hub.cities.find((c) => c.slug === citySlug);
      if (!city) throw new Error(`datashows: unknown city '${citySlug}' — valid: ${hub.cities.map((c) => c.slug).join(', ')}`);
      copy = resolveCpmTokens(copy, citySlug);
      figureHtml = rateFigure(city);
      linkHtml = `<a class="ds-link" href="/data/courses-per-100k/">Explore the Courses per 100,000 data hub →</a>`;
    } else {
      throw new Error(`datashows: unknown hub '${hubName}' — failing the build rather than guessing.`);
    }

    const html =
      `<aside class="ds-box" data-hub="${escapeHtml(hubName)}">` +
      `<div class="ds-head">What the data shows</div>` +
      figureHtml +
      `<div class="ds-copy">${paragraphsOf(copy)}</div>` +
      linkHtml +
      `</aside>`;

    ctx.replaceNode(node as never, { rawHtml: html });
  },
});
