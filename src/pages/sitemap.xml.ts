import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAllCourses, getAllCities, courseUrl, cityUrl } from '../lib/data';

const SITE = 'https://findfrolf.com';

function url(loc: string, priority: number, lastmod?: string, changefreq = 'weekly') {
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  return `  <url>\n    <loc>${SITE}${loc}</loc>${lm}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
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

  // State directory pages (priority 0.9 — same tier as city directory pages)
  const stateSlugs = new Set<string>();
  for (const c of courses) stateSlugs.add(c.data.stateSlug);
  for (const city of cities) stateSlugs.add(city.data.stateSlug);
  for (const stateSlug of stateSlugs) {
    urls.push(url(`/${stateSlug}`, 0.9, undefined, 'weekly'));
  }

  // City directory pages (priority 0.9)
  for (const city of cities) {
    urls.push(url(cityUrl(city), 0.9, undefined, 'weekly'));
  }

  // Course pages (priority 0.8) — use lastVerified as lastmod when present
  for (const course of courses) {
    const lastmod = course.data.lastVerified || undefined;
    urls.push(url(courseUrl(course), 0.8, lastmod, 'weekly'));
  }

  // Blog posts (priority 0.7) — use updatedDate or pubDate as lastmod
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
