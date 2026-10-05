import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAllCourses, getAllCities, courseUrl, cityUrl, getContentTier } from '../lib/data';

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
  urls.push(url('/about', 0.5, undefined, 'monthly'));
  urls.push(url('/privacy', 0.3, undefined, 'yearly'));
  urls.push(url('/terms', 0.3, undefined, 'yearly'));
  urls.push(url('/contact', 0.3, undefined, 'yearly'));
  urls.push(url('/disclosure', 0.3, undefined, 'yearly'));

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
