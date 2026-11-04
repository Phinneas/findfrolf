/**
 * Content re-audit inventory (Step 2, mechanical half).
 *
 * Extracts OBJECTIVE content-quality signals for every blog post so the owner
 * can apply their 12-point rubric and compute the delta vs the Oct 2 baseline.
 * This script deliberately does NOT score — it only reports measurable facts,
 * because the rubric is the owner's and inventing it would not map to their
 * "21 Commodity, 2 Mixed, avg 2.8/12".
 *
 * Outputs a markdown table to stdout (redirect into docs/data-hubs-p1-audit.md).
 *
 * Run: node scripts/audit-content.ts > docs/data-hubs-p1-audit.md
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOG_DIR = join(process.cwd(), 'src', 'content', 'blog');

function parseFrontmatter(src: string): Record<string, unknown> | null {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const body = m[1];
  // YAML-ish: pull title, pubDate, updatedDate, tags, faqItems count.
  const out: Record<string, unknown> = {};
  const title = body.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (title) out.title = title[1];
  const pub = body.match(/^pubDate:\s*["']?(.+?)["']?\s*$/m);
  if (pub) out.pubDate = pub[1];
  const upd = body.match(/^updatedDate:\s*["']?(.+?)["']?\s*$/m);
  if (upd) out.updatedDate = upd[1];
  return out;
}

function bodyOf(src: string): string {
  const m = src.match(/^---\n[\s\S]*?\n---\n/);
  return m ? src.slice(m[0].length) : src;
}

const rows: Record<string, string | number | boolean>[] = [];
const posts = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).sort();
for (const f of posts) {
  const src = readFileSync(join(BLOG_DIR, f), 'utf8');
  const fm = parseFrontmatter(src);
  const body = bodyOf(src);
  const slug = f.replace(/\.md$/, '');
  const words = body.trim().split(/\s+/).length;
  const faqCount = (body.match(/question:/g) || []).length + (src.match(/"question"/g) || []).length;
  const hasTable = /\|.*\|/.test(body);
  const hasStatsToken = /{{stats:/.test(body) || /{{stats:/.test(src);
  const hasDatashows = /:::datashows/.test(body);
  const hasHubRef = /\/data\/[a-z-]/.test(body);
  const internalLinks = (body.match(/\]\(\/(?:blog|courses|cities|data|finder)\//g) || []).length;
  const courseNames = (body.match(/\[[^\]]+\]\(\/(?:[a-z]{2})\/[a-z-]+\//g) || []).length;
  const hasSpecificFact = /\d+\s*(holes|courses|feet|states|meters)/.test(body);
  rows.push({
    slug,
    title: (fm?.title as string) || slug,
    pubDate: (fm?.pubDate as string) || '',
    updated: (fm?.updatedDate as string) || '',
    words,
    faqCount,
    hasTable,
    hasStatsToken,
    hasDatashows,
    hasHubRef,
    internalLinks,
    courseNames,
    hasSpecificFact,
  });
}

// Markdown table
console.log('# Content Audit Inventory (Step 2 — current state)\n');
console.log(`Generated ${new Date().toISOString().slice(0, 10)}. ${rows.length} posts.\n`);
console.log(
  'Objective signals only. Scoring against the owner 12-point rubric is done ' +
  'separately — this table is the raw material for that pass, and for the ' +
  'before/after delta vs the Oct 2 baseline (still to be supplied).\n',
);
console.log(
  '| Post | Words | FAQ | Table | Live stats | Datashows | Hub link | Int links | Course links | Specific facts |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.slug} | ${r.words} | ${r.faqCount} | ${r.hasTable ? '✓' : '—'} | ${r.hasStatsToken ? '✓' : '—'} | ${r.hasDatashows ? '✓' : '—'} | ${r.hasHubRef ? '✓' : '—'} | ${r.internalLinks} | ${r.courseNames} | ${r.hasSpecificFact ? '✓' : '—'} |`,
  );
}
console.log('\n## Notes\n');
console.log('- "Live stats" = post uses `{{stats:...}}` tokens (resolved at build time).');
console.log('- "Datashows" = post renders a `:::datashows` hub box.');
console.log('- "Hub link" = post links into a `/data/*` hub page.');
console.log('- "Specific facts" = post contains concrete numbers (holes/courses/feet/states).');
console.log('- FAQ count and word count are body+frontmatter where applicable.');
