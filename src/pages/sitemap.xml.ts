import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAllCourses, getAllCities, courseUrl, cityUrl, getContentTier } from '../lib/data';
import playableMonths from '../data/hubs/playable-months.json';

const SITE = 'https://www.findfrolf.com';

function url(loc: string, priority: number, lastmod?: string, changefreq = 'weekly') {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  // Enforce a trailing slash so sitemap URLs match the served (directory)
  // URLs and never 308-redirect.
  const normalized = loc.endsWith('/') ? loc : `${loc}/`;
  return `  <url>\n    <loc>${SITE}${normalized}</loc>${lm}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
}

export const GET: APIRoute = async () => {
  const [courses, cities, posts] = await Promise.all([
    getAllCourses(),
    getAllCities(),
    getCollection('blog'),
  ]);

  const urls: string[] = [];

  // Homepage + finder (priority 1.0)
  urls.push(url('/', 1.0, undefined, 'daily'));
  urls.push(url('/finder', 1.0, undefined, 'daily'));

  // Top-level directory + evergreen pages
  urls.push(url('/courses', 0.6, undefined, 'weekly'));
  urls.push(url('/cities', 0.6, undefined, 'weekly'));
  urls.push(url('/blog', 0.6, undefined, 'weekly'));
  urls.push(url('/data', 0.6, undefined, 'monthly'));
  urls.push(url('/data/playable-months', 0.7, playableMonths.pulledAt, 'yearly'));
  urls.push(url('/data/courses-per-100k', 0.7, undefined, 'yearly'));
  // Phase 3 hubs /data/terrain-index and /data/free-play-map are still GATED
  // (OWNER DECISION D3, Step F) — noindexed + hidden on /data/, so they are
  // intentionally NOT listed here. Re-add when the owner ships.
  urls.push(url('/about', 0.5, undefined, 'monthly'));
  urls.push(url('/privacy', 0.3, undefined, 'yearly'));
  urls.push(url('/terms', 0.3, undefined, 'yearly'));
  urls.push(url('/contact', 0.3, undefined, 'yearly'));
  urls.push(url('/disclosure', 0.3, undefined, 'yearly'));

  // NOTE: /events/ and /map/ are intentionally absent. They 301 to /finder/ and
  // /cities/ via public/_redirects. Sitemap URLs must return 200 directly (scripts/check-sitemap.ts
  // enforces this). Add them here only once the pages ship.
  // See docs/data-hubs-p1-findings.md (owner TODO #1).

  // State directory pages are noindexed until each has real editorial
  // content (AdSense remediation §4.2), so they are intentionally NOT listed.
  // Re-add them here once a state has a real editorial intro.

  // City directory pages (priority 0.9)
  for (const city of cities) {
    urls.push(url(cityUrl(city), 0.9, undefined, 'weekly'));
  }

  // Course pages (priority 0.8) — only ENRICHED courses are indexable.
  // Thin courses are noindexed and excluded here (AdSense remediation §4.1/§4.7).
  for (const course of courses) {
    if (getContentTier(course) !== 'enriched') continue;
    const lastmod = course.data.lastVerified || undefined;
    urls.push(url(courseUrl(course), 0.8, lastmod, 'weekly'));
  }

  // Blog posts (priority 0.7)
  for (const post of posts) {
    const lastmod = post.data.updatedDate ?? post.data.pubDate;
    urls.push(url(`/blog/${post.id}`, 0.7, lastmod, 'monthly'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
