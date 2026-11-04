# Data Hubs P1 — Remaining Three Hubs + Closeout (Step 3–4)

Three more hubs, built to the same pattern as the playable-months pilot:
committed source data → deterministic build script → committed hub JSON (+ public
copy) → static hub page → `/data/` index card → sitemap entry. All three read
the course directory directly; none call an external API at site build time.

## 1. Courses per 100,000

- **Page:** `/data/courses-per-100k/`
- **Metric:** `course count ÷ (2020 Census MSA population ÷ 100,000)`, one decimal.
- **Data:** course counts from `src/content/courses`; population from the 2020
  U.S. Census (April 1, 2020) MSA totals committed in `scripts/hubs/cities.ts`.
  Source: U.S. Census Bureau decennial census (public domain). No API token.
- **Build:** `node scripts/hubs/courses-per-100k/build.ts`
  → `src/data/hubs/courses-per-100k.json` + `public/data/courses-per-100k.json`.
- **Owner TODO:** confirm MSA (metro) population is the right denominator vs
  city-proper or combined statistical area. MSA is the current choice because
  the 15 hubs are metro areas (Dallas–Fort Worth, Minneapolis–St. Paul).

## 2. Terrain Index

- **Page:** `/data/terrain-index/`
- **Metric:** per-metro mean of the directory's 1–5 `difficultyRating`, whose
  rubric (docs/admin-workflow.md) already scores length, woods, elevation, and
  hazards — i.e. terrain. Wooded share and average course length shown alongside.
- **Data:** `src/content/courses` only. No external source.
- **Build:** `node scripts/hubs/terrain-index/build.ts`
  → `src/data/hubs/terrain-index.json` + public copy.
- **Owner TODO / v2:** a direct elevation version (USGS point elevations at each
  course lat/lng → per-metro relief) would be sharper than the rubric proxy.
  Deferred — the rubric is complete for all 834 courses, whereas raw elevation
  text is only present on 79.

## 3. Free-to-Play Map

- **Page:** `/data/free-play-map/`
- **Metric:** free vs pay-to-play counts + free share per metro, plus a
  `freeCourses` array of every free course's slug/name/lat/lng (the map payload).
- **Data:** `src/content/courses` (`isFree`, `greenFee`, `location`) only.
- **Build:** `node scripts/hubs/free-play-map/build.ts`
  → `src/data/hubs/free-play-map.json` + public copy.
- **Owner TODO:** decide whether to render the `freeCourses` points on an actual
  interactive map (the finder already maps courses) or keep the static table.

## Shared files

- `scripts/hubs/cities.ts` — the 15 metro slugs + 2020 Census MSA population
  (single source of truth; reused by courses-per-100k).
- `scripts/hubs/lib-courses.ts` — course reader + per-city aggregator.

## Step 4 closeout

- **`npm run hubs:refresh:all`** (`scripts/hubs/refresh-all.ts`) runs the
  playable-months fetch+build (network) then the three build-only hubs. Run
  yearly (or after any course batch) — same-day reruns are deterministic; only
  the `pulledAt`/`nextRefresh` date fields move.

### Refresh schedule

| Hub | Source | Refresh cadence | Network? |
|---|---|---|---|
| playable-months | NOAA 1991–2020 normals | yearly | yes |
| courses-per-100k | 2020 Census (static) + directory | after course batches | no |
| terrain-index | directory only | after course batches | no |
| free-play-map | directory only | after course batches | no |

### Google Search Console checklist (post-deploy)

1. Submit `/sitemap.xml` in GSC and confirm the four `/data/*` URLs are indexed
   (no "Crawled - currently not indexed" for the hub pages).
2. Inspect each hub URL: title, canonical (`https://www.findfrolf.com/.../`),
   and Dataset JSON-LD present under "Enhancements".
3. Request indexing for the four hub pages after the first deploy.
4. In a later quarter, check whether hub tables get cited (see
   `docs/ai-share-of-voice.md`) — that is the success signal for this work.

## Owner copy

The three new hub pages ship with methodology but no "Our take" owner position
block (owner voice is intentionally left to the owner, same as the pilot).
Add `src/content/hubs/{slug}-position.md` + a position section when copy is ready.
