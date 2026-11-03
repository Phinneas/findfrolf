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

export const datashowsPlugin = defineMdastPlugin({
  name: 'findfrolf-datashows',
  containerDirective(node, ctx) {
    if (node.name !== 'datashows') return;
    const attrs = node.attributes ?? {};
    const hubName = attrs.hub ?? 'playable-months';
    if (hubName !== 'playable-months') {
      throw new Error(`datashows: unknown hub '${hubName}' — failing the build rather than guessing.`);
    }
    const hub = loadHub();
    const citySlug = attrs.city;
    const city = hub.cities.find((c) => c.slug === citySlug);
    if (!city) {
      throw new Error(
        `datashows: unknown city '${citySlug}' — valid: ${hub.cities.map((c) => c.slug).join(', ')}`,
      );
    }

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
    const paragraphs = (copy || 'TODO: owner copy (100–200 words).')
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, ' ')}</p>`)
      .join('');

    const html =
      `<aside class="ds-box" data-hub="${escapeHtml(hubName)}">` +
      `<div class="ds-head">What the data shows</div>` +
      miniStrip(city) +
      `<div class="ds-copy">${paragraphs}</div>` +
      `<a class="ds-link" href="/data/playable-months/">Explore the Playable Months by City data hub →</a>` +
      `</aside>`;

    ctx.replaceNode(node as never, { rawHtml: html });
  },
});
