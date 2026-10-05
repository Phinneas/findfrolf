# FindFrolf: Phase 2 Enrichment Tranche (15 Courses)

**For:** the operator (Buzz) + enrichment workflow
**Owner:** Buzz
**Date:** 2026-10-05
**Repo:** `~/CascadeProjects/findfrolf`

## 1. Goal

Re-index the first 15 course pages by clearing the §4.7 enrichment bar — one
real photo + one written review per course — with one course per live city
guide (feeds §4.10: no bare course pages).

## 2. Why these 15

- One course per live city guide.
- Drawn from the 64 courses that already carry `holeData` + `localTips` + a
  known fee, so the **only** remaining §4.7 gaps are **photo + review**.
- Ranked richest-first. `mary-moore-searight` leads because it already has 3
  tournaments and a nearby-course link — one photo + one review makes it both
  re-indexed and the most complete page on the site.

## 3. The tranche (priority order)

| # | City | Course | `--slug` | ★ | Holes | Beyond photo+review |
|---|------|--------|----------|---|-------|----------------------|
| 1 | Austin | Mary Moore Searight | `mary-moore-searight` | 4.8 | 18 | layoutMapUrl, courseDesigner |
| 2 | Chicago | The Canyons at Dellwood Park | `the-canyons` | 4.8 | 27 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 3 | Minneapolis–St. Paul | Blue Ribbon Pines | `blue-ribbon-pines` | 4.8 | 27 | tournaments, layoutMapUrl, nearby |
| 4 | Seattle | SeaTac DGC | `seatac` | 4.3 | 27 | tournaments, layoutMapUrl, nearby |
| 5 | Phoenix | Buffalo Ridge Park | `buffalo-ridge` | 4.2 | 27 | tournaments, layoutMapUrl, nearby |
| 6 | Denver | Bird's Nest Disc Park | `birds-nest` | 4.1 | 27 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 7 | Cincinnati | Idlewild | `idlewild` | 4.8 | 24 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 8 | Raleigh–Durham | Diavolo at New Hope | `diavolo` | 4.8 | 22 | tournaments, layoutMapUrl, nearby |
| 9 | Nashville | Seven Oaks Park | `seven-oaks` | 4.5 | 21 | tournaments, layoutMapUrl, nearby |
| 10 | Houston | T.C. Jester Park | `tc-jester` | 4.3 | 21 | tournaments, layoutMapUrl, nearby |
| 11 | Dallas–Fort Worth | Z Boaz Park | `z-boaz` | 4.5 | 19 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 12 | Atlanta | Little Mulberry Park | `little-mulberry` | 4.7 | 18 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 13 | Portland | Milo McIver (Riverbend East) | `milo-mciver-riverbend` | 4.7 | 18 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 14 | Charlotte | Nevin Park (Nightmare) | `nevin-nightmare` | 4.6 | 18 | tournaments, layoutMapUrl, nearby, courseDesigner |
| 15 | Kansas City | Bad Rock Creek | `bad-rock-creek` | 4.6 | 18 | tournaments, layoutMapUrl, nearby, courseDesigner |

## 4. §4.7 re-index gate

A course re-indexes (under the §6 rule) only when it clears **all** of:

- ≥1 real photo (`photos[]` non-SVG)
- non-empty `holeData`
- ≥1 written review (named source + text)
- course-specific `localTips` (≥80 chars)
- known green fee or confirmed free

All 15 already have holeData, localTips, and fee. **Photo + review are the
only blockers.**

## 5. Completeness polish (optional — not re-index blockers)

- `layoutMapUrl` — missing on **all 15**
- `tournaments` — missing on 14/15 (only `mary-moore-searight` has any)
- `nearbyCourseSlugs` — missing on 14/15
- `courseDesigner` — missing on ~10/15

## 6. Workflow

1. Shoot per the photo checklist; save to `public/images/courses/{slug}-1.jpg`.
2. Run
   `npm run enrich:course -- --slug <slug> --photo ... --review-* ...`.
3. Verify with `npm run enrich:all` (or `node scripts/enrich-all.mjs`).

## 7. Pacing

Opportunistic only — enrich as real rounds/photos happen. Never fabricate
reviews to hit a schedule.
