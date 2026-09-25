/**
 * Course Trust Data Layer Worker — docs/HANDOFF-data-layer.md.
 *
 * Phase 2 scope:
 *  - Nightly `scheduled` handler runs the pure resolver and writes
 *    `course_snapshot` rows to D1.
 *  - `POST /api/reports` is a Phase 4 concern; the route is stubbed here.
 */

import { resolve, type Observation, type Source } from './resolve';

export interface Env {
  DB: D1Database;
}

interface D1ObservationRow {
  id: string;
  course_id: string;
  field: string;
  value: string;
  source_id: string;
  observed_at: string;
  ingested_at: string;
  locked: number;
}

interface D1SourceRow {
  id: string;
  type: string;
  url: string | null;
  trust: number;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const [obsRes, srcRes] = await Promise.all([
      env.DB.prepare('SELECT * FROM observations').all<D1ObservationRow>(),
      env.DB.prepare('SELECT * FROM sources').all<D1SourceRow>(),
    ]);

    const observations: Observation[] = obsRes.results.map((r) => ({
      id: r.id,
      course_id: r.course_id,
      field: r.field,
      value: r.value,
      source_id: r.source_id,
      observed_at: r.observed_at,
      ingested_at: r.ingested_at,
      locked: r.locked,
    }));

    const sources: Source[] = srcRes.results.map((r) => ({
      id: r.id,
      type: r.type,
      url: r.url,
      trust: r.trust,
    }));

    const snapshots = resolve(observations, sources, new Date());

    const upsert = snapshots.map((s) =>
      env.DB.prepare(
        `INSERT INTO course_snapshot (
          course_id, status, holes_playable, last_verified, freshness_days,
          fields_json, conflicts_json, rubric_json, rating_recent, rating_alltime,
          ratings_to_reviews, disc_loss_risk, flags_json, changelog_json, built_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(course_id) DO UPDATE SET
          status = excluded.status,
          holes_playable = excluded.holes_playable,
          last_verified = excluded.last_verified,
          freshness_days = excluded.freshness_days,
          fields_json = excluded.fields_json,
          conflicts_json = excluded.conflicts_json,
          rubric_json = excluded.rubric_json,
          rating_recent = excluded.rating_recent,
          rating_alltime = excluded.rating_alltime,
          ratings_to_reviews = excluded.ratings_to_reviews,
          disc_loss_risk = excluded.disc_loss_risk,
          flags_json = excluded.flags_json,
          changelog_json = excluded.changelog_json,
          built_at = excluded.built_at`,
      ).bind(
        s.code,
        s.status,
        s.holesPlayable,
        s.lastVerified,
        s.freshnessDays,
        JSON.stringify(s.fields),
        JSON.stringify(s.conflicts),
        s.rubric === null ? null : JSON.stringify(s.rubric),
        s.ratingRecent,
        s.ratingAllTime,
        s.ratingsToReviews,
        s.discLossRisk,
        JSON.stringify(s.flags),
        JSON.stringify(s.changelog),
        s.builtAt,
      ),
    );

    // D1 supports batching up to 50 statements; chunk defensively.
    const BATCH_SIZE = 50;
    for (let i = 0; i < upsert.length; i += BATCH_SIZE) {
      await env.DB.batch(upsert.slice(i, i + BATCH_SIZE));
    }
  },

  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/reports') {
      // Phase 4: validate against the field registry + Turnstile + rate limit.
      return Response.json({ ok: false, error: 'reports are not enabled yet' }, { status: 501 });
    }
    return Response.json({ ok: true }, { status: 200 });
  },
};
