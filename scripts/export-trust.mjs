#!/usr/bin/env node
/**
 * Export `course_snapshot` from D1 into the `trust` content collection
 * (docs/HANDOFF-data-layer.md §7).
 *
 * Reads D1 over the HTTP API, writes one `src/content/trust/{slug}.json` per
 * snapshot, then prunes any trust file whose course no longer has a snapshot.
 *
 * This is intentionally a STANDALONE step (not a hard `prebuild` dependency):
 * the generated JSON is committed to git, so `astro build` stays deterministic
 * and offline-safe. Set SKIP_TRUST_EXPORT=1 to bypass it (local/CI safety valve).
 */

import { readdirSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { d1Query } from './lib/d1.mjs';

const TRUST_DIR = fileURLToPath(new URL('../src/content/trust/', import.meta.url));

if (process.env.SKIP_TRUST_EXPORT === '1') {
  console.log('SKIP_TRUST_EXPORT=1 — skipping trust export.');
  process.exit(0);
}

const rows = await d1Query(`
  SELECT s.*, c.slug
  FROM course_snapshot s
  JOIN courses c ON c.id = s.course_id
`);

mkdirSync(TRUST_DIR, { recursive: true });

const seenSlugs = new Set();
for (const r of rows) {
  const trust = {
    code: r.course_id,
    status: r.status,
    holesPlayable: r.holes_playable ?? null,
    lastVerified: r.last_verified ?? null,
    freshnessDays: r.freshness_days ?? null,
    ratingRecent: r.rating_recent ?? null,
    ratingAllTime: r.rating_alltime ?? null,
    ratingsToReviews: r.ratings_to_reviews ?? null,
    rubric: r.rubric_json ? JSON.parse(r.rubric_json) : null,
    discLossRisk: r.disc_loss_risk ?? null,
    flags: JSON.parse(r.flags_json ?? '[]'),
    conflicts: JSON.parse(r.conflicts_json ?? '[]'),
    changelog: JSON.parse(r.changelog_json ?? '[]'),
  };
  const slug = r.slug;
  seenSlugs.add(slug);
  writeFileSync(`${TRUST_DIR}${slug}.json`, JSON.stringify(trust, null, 2) + '\n');
}

// Prune trust files that no longer correspond to a snapshot.
for (const f of readdirSync(TRUST_DIR)) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/\.json$/, '');
  if (!seenSlugs.has(slug)) unlinkSync(`${TRUST_DIR}${f}`);
}

console.log(`Exported ${rows.length} trust snapshots to src/content/trust/.`);
