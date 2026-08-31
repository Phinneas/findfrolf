# Top-50 Hole-by-Hole Data Plan

Why: hole-by-hole data is the structured depth that earns AI Overview citations (SE Ranking audit: UDisc 47.6%, PDGA 42.4% AI share of voice largely from data depth). It is FindFrolf's differentiation — but only if the data is REAL.

## 0. The fabrication rule (applies to everything in this task)

**Never generate hole data from memory or by pattern. If no source is available, leave `holeData: []` and `signatureHoleDescription: null` and note the course as "needs on-site/scorecard" in `docs/top-50-candidates.md`.** Empty is honest; invented is worse than nothing.

As of this writing, the fabricated hole data in `zilker-park.json`, `mary-moore-searight.json`, and `diavolo.json` has been purged (their par sums didn't match their pars — my check script caught Zilker 59 vs 56, Diavolo 60 vs 62). They get refilled only with sourced data.

## 1. Scope (reconciled: 15 cities, 64 courses)

The task card says "top 5–8 per city in each of the **10** MVP cities," but the MVP is now **15 cities**, and the working list in `docs/top-50-candidates.md` came out to **64 courses**. Decision:

- **Keep all 64** — the candidate list IS the priority list (supersedes the card's "top 50"; ~3–8 per city, marquee markets deeper). No trim; the weakest sourcing cases just go later in the queue.
- Per-city counts: Austin 8, Denver 4, Portland 4, Chicago 4, Seattle 4, Charlotte 5, Houston 4, Phoenix 4, Nashville 3, Raleigh 4, DFW 5, KC 3, Atlanta 4, Cincinnati 3, MSP 5.
- Per-city hole-by-hole depth beyond these 64 is a follow-on batch; the plan/tooling scales to it.

## 2. Ranking metric (step 1)

Priority proxy, in order: (1) UDisc review count, (2) UDisc play count/rounds, (3) PDGA community rating, (4) editorial "best of" lists. **Never invent counts** — unverified numbers are marked "verify on UDisc."

## 3. What to collect per hole (schema-backed)

Per the `holeSchema` in `src/content.config.ts`: `number`, `par`, `distance`, `character`, `difficultyPct`, `isSignature`.

| Task-card item | Where it goes |
|---|---|
| par | `hole.par` |
| distance (primary tee) | `hole.distance` |
| alternate tee distances | noted inside `hole.character` text (schema has one distance field) |
| basket type | course-level `basketType` (schema has no per-hole basket field) |
| main hazard | inside `hole.character` (OB / water / trees / elevation) |
| ideal line (1 sentence) | `hole.character` — hazard + line in one sentence |
| difficulty feel | `hole.difficultyPct` (0–100, consistent with course `difficultyRating`) |
| signature hole | `isSignature: true` on exactly one hole + `signatureHoleDescription` (2–3 sentences) |

## 4. Sourcing hierarchy (per hole facts: par, distance)

Empirical findings from the sourcing tests (verified this session):

- **UDisc JSON-LD (`ratingCount`, `ratingValue`)** — clean, fetchable, and now complete for all 64 candidates. Used for ratings/review counts and ranking. **Does NOT contain per-hole data.**
- **UDisc hole tables** — rendered client-side only (obfuscated serialization in the page); transcription is manual (browser task), not extractable.
- **Disc Golf Course Review (dgcoursereview.com)** — the `/holes` tab is **server-rendered** with full per-hole tables (verified: Roy G "Hole #1, 635 ft(4), 720 ft(4)"; Zilker 933/holes; Circle C 542/holes; MetCenter 11397/holes), but the site sits behind a Cloudflare challenge that blocks curl AND headless-shell from this environment. Usable only from a normal browser (fast manual transcription, best secondary source for Austin).

**Working result (Batch 0 proof):** Benbrook Ranch entered end-to-end from its official City of Leander PDF scorecard (`src/content/courses/benbrook-ranch.json`) — par 61, 6,952 ft, PDGA length-distribution cross-check (7/4/7) matches exactly, UDisc rating 4.5/1,309, PDGA course photo (policy-compliant), check-script clean except the designed rubric-judgment notice (difficulty 3 = objective 2 + documented OB/water bump).
- **PDGA course pages** — summary facts only (total length, hole-length distribution, tee/basket types, first-tee GPS, designer); the per-hole "Layouts" tab is JS-loaded and not accessible via simple fetch.

So the working hierarchy for per-hole par/distance is:

1. **Official PDF scorecard / course website** — best per-hole source when it exists; static and fetchable. This is the fast path.
2. **UDisc layout page, transcribed manually** — par/distance per hole for the primary layout; cite UDisc in the tracking row.
3. **On-site research** — Austin priority courses (the QA city), and any course flagged "needs on-site."

**Primary-tee rule:** use the most-played tee position; note alternates in `character` (e.g. "short 265 ft / long 340 ft").

## 5. Editorial rules (hazard + ideal line + signature hole)

- The 1-sentence `character` per hole is ORIGINAL copy: name real features (tree species, OB road, creek, mando), describe the ideal line ("hyzer around the oak, park it under the basket"). Never invent distances; never copy UDisc/PDGA descriptions.
- `difficultyPct` should track the course's overall `difficultyRating` (Hard courses run 60–95; Easy courses 15–45).
- **Signature hole:** the most memorable/photographed hole (course photo galleries, tournament recaps, local consensus). 2–3 sentences in Find Frolf voice; set `isSignature: true` on that hole only.

## 6. Verification gates (run after every batch)

`npm run check:courses` must pass with **zero holeData warnings**:
- `par` === sum of `hole.par` for the entered layout
- sum of `hole.distance` within tolerance of `totalFeet` (the check script warns at ±15% / under 40%)
- exactly one `isSignature` per course with a non-null `signatureHoleDescription`
- `lastVerified` bumped to today; `parSource` set (`map`/`udisc`/`pdga`/`estimated`)

## 7. Batch plan

- **Batch 0 (done):** purge fabricated hole data from existing entries; write this plan; build candidate list.
- **Batch 1:** Austin marquee courses from `docs/top-50-candidates.md` (Roy G. Guerrero, Circle C, MetCenter, Benbrook Ranch, Old Settlers, Flying Armadillo, Harvey Penick, Wong Way Woods) — Austin sources are closest to on-site verification.
- **Batches 2+:** remaining top-50 by city, in candidate-list order; one city at a time; `npm run check:courses` after each batch.

## 8. Open questions

- **Mary Moore Searight spec conflict:** repo says `totalFeet: 7800 / par 60`; PDGA page (searight-park, nid 25330) says **5,157 ft, 13 holes under 300 ft, 3 at 300–400 ft, 2 over 400 ft**. One of them is wrong. Resolve against UDisc/on-site before entering its hole data (par + courseLength + difficulty cascade from this).
- **Diavolo (Apex NC)** is not in the 15-city list — it stays a test/backfill entry; its hole data is included only if it makes the top-50 via the Triangle.
