# FindFrolf: Course Trust Data Layer (Handoff Spec)

**For:** the coding model implementing this (DeepSeek)
**Owner:** Buzz
**Date:** 2026-09-24
**Repo:** `~/CascadeProjects/findfrolf`

## 1. Goal

Build a backend data layer that can prove every course fact is current. Research on players found these top complaints:

1. Driving to dead courses, or courses with missing baskets.
2. Inflated ratings and old reviews.
3. Wrong map and distance data.
4. Corrections that get overwritten.

The fix is to store sourced, dated **observations** and compute a **trust snapshot** for each course from them. The site reads the snapshot at build time.

## 2. Current state (read before coding)

- **Astro 7** + **Tailwind 4** (`@tailwindcss/vite`). Static build. Node >= 22.12.
- Content collections live in `src/content.config.ts` (Zod schemas, `glob` loader):
  - `courses`: **836 files**, one per course, at `src/content/courses/{slug}.json`
  - `cities`: 15 files
  - `blog`: Markdown
- Course schema is documented in `docs/data-model.md`. The rules for entering course data are in `docs/admin-workflow.md`, covering the Difficulty Rubric, the Par Rule, and publish-ready rules. **Read both first.**
- Relevant existing fields: `code` (e.g. `TX-1140`, stable ID), `slug`, `location{address,lat,lng}`, `holes`, `par`, `parSource`, `totalFeet`, `isFree`, `greenFee`, `pdgaCourseId`, `rating`, `reviewCount`, `amenities{...}`, `lastVerified` (ISO string), `holeData[{number,par,distance,...}]`, `tournaments[]`, `isBeginnerFriendly`, `isWooded`, `isOpen`.
- Course page: `src/pages/[state]/[city]/[course].astro`. Components live in `src/components/course/`.
- Data helpers: `src/lib/data.ts`.
- CI: `.github/workflows/check.yml` runs `npm run check:courses` (`scripts/check-courses.mjs`) and `npm run build`.
- Existing sourcing scripts are in `scripts/` (PDGA, UDisc, geocoding).
- Ignore `absent-apogee/` (scratch copy, excluded in vite config).
- The working tree has uncommitted changes. Branch from the current state. Do not reset or stash the owner's work.

**Hard rule:** course files in `src/content/courses/` are hand-edited. **The new system must never write to them.** Trust data goes in a new, separate collection.

## 3. Architecture

```
Importers / Monitors / Player reports
            |
            v
   D1: observations (append-only, sourced, dated)
            |
   Resolver (Worker cron, nightly)
            |
            v
   D1: course_snapshot (derived)
            |
   scripts/export-trust.mjs  (runs before `astro build`)
            |
            v
   src/content/trust/{slug}.json   (new collection, generated)
            |
   Course and city pages read `courses` + `trust`
```

- Database: Cloudflare D1. Migrations with `wrangler d1 migrations`. Worker code goes in `worker/`.
- Worker: runs the nightly resolver and handles `POST /api/reports`.
- Language: TypeScript for the Worker. `.mjs` for scripts, to match the existing `scripts/`. Plain SQL, no ORM.

## 4. Schema (migration 0001)

```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,            -- existing `code`, e.g. TX-1140
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  lat REAL, lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('content_file','pdga','udisc','osm','parks_dept','review','user_report','monitor','onsite')),
  url TEXT,
  trust REAL NOT NULL CHECK (trust BETWEEN 0 AND 1)
);

CREATE TABLE observations (
  id TEXT PRIMARY KEY,            -- ULID
  course_id TEXT NOT NULL REFERENCES courses(id),
  field TEXT NOT NULL,            -- see field registry, section 5
  value TEXT NOT NULL,            -- JSON-encoded
  source_id TEXT NOT NULL REFERENCES sources(id),
  observed_at TEXT NOT NULL,      -- when it was true on the ground
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  locked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_obs_course_field ON observations(course_id, field, observed_at DESC);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  field TEXT NOT NULL,
  claimed_value TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE course_snapshot (
  course_id TEXT PRIMARY KEY REFERENCES courses(id),
  status TEXT NOT NULL,           -- active | partial | unplayable | removed | unverified
  holes_playable INTEGER,
  last_verified TEXT,
  freshness_days INTEGER,
  fields_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL,
  rubric_json TEXT,
  rating_recent REAL,
  rating_alltime REAL,
  ratings_to_reviews REAL,
  flags_json TEXT NOT NULL,
  changelog_json TEXT NOT NULL,
  built_at TEXT NOT NULL
);
```

Observations are **append-only**. Never UPDATE or DELETE them. Corrections are new rows.

## 5. Field registry

Field names match `src/content.config.ts` where one already exists. Put the registry in `worker/src/fields.ts` and validate every observation write against it.

| field | value type | maps to existing |
|---|---|---|
| status | enum: active, partial, unplayable, removed | new |
| holes_playable | int | new |
| holes, par, totalFeet | int | same names |
| holeData.{number}.distance | int (feet) | `holeData[].distance`. `number` may be `"6A"` |
| holeData.{number}.par | int | `holeData[].par` |
| isFree, greenFee | bool, string | same names |
| amenities.{key} | bool | same keys (restrooms, dogFriendly, handicapAccessible...) |
| signage | enum: good, poor, none | new |
| nav_notes | string | new |
| water_holes | int | new, powers the water-hazard filter |
| rough_density | enum: low, medium, high | new, feeds disc-loss risk |
| kid_friendly | enum: yes, no, unknown | new |
| closure | {from, to, reason} | new |
| crossing_fairways | bool | new, safety flag |
| rating_event | {stars, date, has_text} | aggregates to rating |
| review_signal | {keyword, date, source_url} | from review scanner |

## 6. Resolver rules

Implement as a pure function, `resolve(observations, sources, now) => Snapshot`, in `worker/src/resolve.ts`. Unit test it without D1.

For each field:

1. **Locked wins.** Use the newest locked observation.
2. **Otherwise:** `weight = source.trust * exp(-age_days / 180)`. Highest weight wins.
3. **Conflict:** if the top two distinct values both have weight >= 0.3 and were observed within 90 days of each other, add the field to `conflicts` and set flag `needs_review`.

Course-level:

- **status:**
  - A locked `status` observation wins.
  - Else if 2+ `review_signal` observations in the last 180 days match `missing basket|baskets gone|defunct|abandoned|unplayable|removed|overgrown`, set `unplayable` and add `needs_review`. Never set `removed` automatically.
  - Else if `holes_playable < holes`, set `partial`.
  - Else if `freshness_days > 180`, set `unverified`. This matches the 6-month publish-ready rule in `docs/data-model.md`.
  - Else `active`.
- **last_verified:** newest `observed_at` from source types `content_file`, `onsite`, `parks_dept`, `monitor`, or an accepted `user_report`.
- **rating_recent:** mean of `rating_event.stars` in the last 365 days. Null if fewer than 5 events.
- **ratings_to_reviews:** all rating events divided by events with text. Flag `thin_reviews` if > 10.
- **disc_loss_risk:** low, medium, or high, from `water_holes` + `rough_density` + `isWooded`.
- **changelog:** the last 20 changes in a resolved value, with date and source type.

## 7. Export contract (`scripts/export-trust.mjs`)

- Reads `course_snapshot` from D1 over the HTTP API. Account ID, database ID, and token come from `.env`. Add the keys to `.env.example`.
- Writes one file per course: `src/content/trust/{slug}.json`.
- Add a `trust` collection to `src/content.config.ts` with this Zod schema:

```ts
{
  code: z.string(),
  status: z.enum(['active','partial','unplayable','removed','unverified']),
  holesPlayable: z.number().nullable(),
  lastVerified: z.string().nullable(),
  freshnessDays: z.number().nullable(),
  ratingRecent: z.number().nullable(),
  ratingAllTime: z.number().nullable(),
  ratingsToReviews: z.number().nullable(),
  rubric: z.object({ design: z.number(), upkeep: z.number(), signage: z.number(), safety: z.number(), beginnerFit: z.number() }).nullable(),
  discLossRisk: z.enum(['low','medium','high']).nullable(),
  flags: z.array(z.string()),
  conflicts: z.array(z.string()),
  changelog: z.array(z.object({ date: z.string(), field: z.string(), from: z.string().nullable(), to: z.string(), sourceType: z.string() })),
}
```

- Add `getTrust(slug)` to `src/lib/data.ts`. If a course has no trust file, pages must still render. Treat it as `unverified`.
- Add `"prebuild": "node scripts/export-trust.mjs"`. If D1 is unreachable in CI, fail loudly. Locally, allow `SKIP_TRUST_EXPORT=1`.

## 8. Phases and acceptance criteria

**Phase 1: Schema and seed**
- Migration 0001 applies cleanly.
- `scripts/seed-observations.mjs` reads all 836 files in `src/content/courses/`. It writes one `courses` row per file and turns the tracked fields (section 5) into observations. Source type is `content_file`, trust 0.8, and `observed_at` = the file's `lastVerified`.
- Done when the courses row count equals the file count. The script must be idempotent: re-running it adds no duplicates.

**Phase 2: Resolver and export**
- Write vitest tests for `resolve()` covering: locked wins, recency decay, conflict detection, every status branch, `rating_recent` null under 5 events, and the "hole 6A" style numbers.
- The Worker cron writes `course_snapshot`.
- The export writes `src/content/trust/`.
- Done when `npm run check:courses` and `npm run build` pass, and course pages look identical to before. No UI changes yet.

**Phase 3: Page UI**
- Course page: status pill, a "Last verified {date}" badge, recent vs. all-time rating, a closure banner, disc-loss risk, safety flags, and a change log section. Build new components in `src/components/course/` and style them with the existing Tailwind tokens (e.g. `text-sage`, `text-clay`, `font-display`).
- `removed` status: the page gets `noindex` and a "This course was removed" notice. It is also excluded from `sitemap.xml.ts` and the city listings.
- City pages and `finder.astro`: filters for status, beginner fit, water holes, and amenities.
- Update `check-courses.mjs` to warn on `unverified` and `needs_review`.

**Phase 4: Player reports**
- Worker `POST /api/reports` with Cloudflare Turnstile. Validate the field against the registry. Rate-limit by IP.
- "Report a problem" form on each course page.
- Accepting a report inserts a `locked = 1` observation with source `user_report`.
- Done when an accepted report survives a re-seed of the same field.

**Phase 5: Importers**
- OSM via Overpass (`leisure=disc_golf_course`): matches courses by distance plus name, writes lat/lng observations.
- Adapt the existing `scripts/` PDGA and UDisc tooling so it writes observations instead of editing course files. **Confirm with Buzz before running any UDisc importer** (see section 10).
- Review keyword scanner: writes `review_signal` observations.
- Importers only write observations. They never write to the snapshot or to course files.

## 9. Constraints

- Never write to `src/content/courses/*.json`.
- Never UPDATE or DELETE observations.
- Only the resolver writes to `course_snapshot`.
- No visual changes outside Phase 3. Use the existing Tailwind tokens. No new CSS framework.
- Keep secrets in `.env`, `.dev.vars`, and Worker secrets. Never commit them.
- One PR per phase, with test output and `check:courses` output in the description.
- Leave `absent-apogee/` and the root-level `udisc_*` artifacts alone.

## 10. Open questions for Buzz (don't guess)

1. **Rubric scores:** entered by hand only, or can player reports suggest them? Note: `docs/admin-workflow.md` already has a Difficulty Rubric.
2. **Report moderation:** raw SQL for now, or a protected admin route?
3. **Cloudflare:** which D1 database name and account?
4. **UDisc as an automated importer:** the admin workflow lists UDisc as source priority 2, and scraping scripts already exist. Should the new importers pull from UDisc automatically, or stay manual? (UDisc's terms of service may restrict scraping.)
5. **D1 vs. git-stored observations:** with ~836 courses, observations could live in the repo as JSON instead of D1. That is simpler, reviewable in git, and needs no Worker for the resolver. Player reports would still need a Worker. Which one?
