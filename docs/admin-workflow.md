# Find Frolf — Admin Data Entry Workflow

Version 1.0 · July 2026

## Overview

This workflow defines how course data moves from source to published page. Every person entering course data follows the same process to ensure consistency across 500+ courses.

---

## Step 1: Source

Before entering any data, identify and document the source(s):

| Source | Priority | What to get |
|--------|----------|-------------|
| PDGA Course Directory | 1 (primary) | Course ID, hole count, par, year established, designer, tee/basket type, GPS, photos |
| UDisc course page | 2 (supplement) | Player rating, review count, difficulty, amenities, photos |
| Course/park website | 3 (supplement) | Hours, green fee, website URL, rules, layout map |
| Google Maps / Street View | 4 (verification) | Address, GPS coordinates, parking, nearby context |
| On-site visit or local player | 5 (enrichment) | Editorial description, local tips, signature hole, photos |

**Rule:** GPS coordinates and address must come from or be verified against Google Maps. Ratings and review counts must come from UDisc or a verified source.

**City scope:** every MVP city is scoped as its **metro region** (not city limits) — see `docs/course-sourcing-targets.md` for per-city targets and the boundary decision.

---

## Step 2: Data Entry

### Where to enter data

**Option B — JSON file (use this for the MVP data push)**

Sanity Studio is not set up yet (there is no `sanity/` project in the repo), so every course for the MVP push is entered as a JSON file:

1. Create `src/content/courses/{slug}.json`
2. Use an existing course file as a template (e.g. `roper-park-west.json` or `mary-moore-searight.json`)
3. Fill in all required fields (see below) plus the Difficulty Rubric, Par Rule, and Photo Sourcing Policy in this document
4. Run `npm run check:courses` — it prints the same progress table the old tracking spreadsheet tried to hold (Course | City | Status | Missing | Warnings), but derived from the data itself so it can never drift out of sync. Fix anything it flags.
5. Run `npx astro build` to validate

**Option A — Sanity Studio (deferred, not for this sprint)**

When Sanity is eventually set up (`sanity/` project + schemas in `sanity/schema-types/course.ts` and `city.ts`), the Studio can replace JSON entry for multi-editor workflows. Until then, Option B above is the single source of truth.

### Field entry order (recommended)

Fill fields in this order to minimize back-and-forth:

1. **Identity:** name, code, city, state, citySlug, stateSlug, area
2. **Location:** address, lat, lng (look up on Google Maps, copy coordinates)
3. **Specs:** holes, par, totalFeet, courseLength, difficulty, difficultyRating
4. **Cost:** isFree, greenFee
5. **External:** pdgaCourseId, pdgaTier, websiteUrl
6. **Photos:** photos array (min 1, include alt text), heroImage, thumbnail
7. **Ratings:** rating, reviewCount (from UDisc)
8. **Tags:** tags array
9. **Amenities:** amenities object (all 9 booleans)
10. **Metadata:** yearEstablished, courseDesigner, teeType, basketType, elevation, foliage
11. **Editorial:** aboutParagraphs (write 2-3 paragraphs in Find Frolf voice)
12. **Verification:** lastVerified (today's date)

### Difficulty Rubric (apply to every course)

Every course gets one difficulty rating, 1–5, from the same objective rubric so ratings stay consistent across all 750+ courses:

| Factor | Points | How to check |
|--------|--------|--------------|
| Base | +1 | Every course starts at 1 |
| Full-size course | +1 | `holes` ≥ 18 |
| Long course | +1 | `totalFeet` ≥ 7000 (longest layout) |
| Wooded / dense | +1 | `foliage` = "Dense" or "Wooded", or the majority of holes play in trees |
| Heavy OB / water carry (optional) | +1 | Multiple water carries, island greens, or punishing OB — **human judgment call; document why** |

Clamp the total to 1–5, then:

| Score | `difficultyRating` | `difficulty` |
|-------|--------------------|--------------|
| 1–2 | 2 | Easy |
| 3 | 3 | Moderate |
| 4 | 4 | Hard |
| 5 | 5 | Very Hard |

Rules:
- `difficultyRating` MUST equal the rubric score and `difficulty` MUST match the mapping above.
- If a course legitimately deviates, note the reason in the file — `npm run check:courses` flags anything 2+ points off the objective score for review.
- Reference entries: Zilker 2/Easy ✓, Mary Moore Searight 4/Hard ✓, Roper Park West 3/Moderate ✓, Diavolo 4/Hard + 1 OB/water = 5/Very Hard (verify against the course).

### Par Rule (one par per course)

1. **Preferred:** total par of the PDGA primary layout (the main tee set most people play).
2. If PDGA lacks it: total par of the UDisc primary layout.
3. If neither: the par printed on the course map / scorecard at the park.
4. If no published par exists, **estimate**: sum per-hole pars where par 3 ≤ 300 ft, par 4 = 301–450 ft, par 5 > 450 ft. When hole distances are unknown, use `3 × holes + 1` per 10 holes for courses over 6,500 ft.

Record where the par came from in the `parSource` field:

| `parSource` | Meaning |
|-------------|---------|
| `pdga` | PDGA primary layout |
| `udisc` | UDisc primary layout |
| `map` | Course map / on-site scorecard |
| `estimated` | Estimated per the formula above — **schedule re-verification** |

`npm run check:courses` warns when `holeData` pars don't sum to `par` (common while hole-by-hole data is still a draft) and when `parSource` is missing.

### Photo Sourcing Policy (copyright-safe photos only)

"At least 1 photo" is a publish gate, so every photo must be one we have the right to use:

**Allowed sources**
1. Own photos or community-submitted photos (best)
2. Course / park official website or city parks department (credit when asked)
3. Wikimedia Commons under CC-BY / CC-BY-SA / CC0 / public domain — **record photographer + license in the caption**, e.g. "Photo: Jane Doe, CC BY 4.0"
4. Flickr via the CC search filter (CC-BY or CC0) — same attribution rule
5. PDGA course directory photos (community-submitted) — credit the photographer when identifiable; don't hotlink in bulk

**Forbidden sources**
- UDisc course photos (copyrighted, hotlink-protected)
- Google Images / general web search results (no license)
- Manufacturer marketing photos (Innova, Discraft, MVP, etc.) — **existing entries using `innovadiscs.com` URLs are flagged by `npm run check:courses` and must be replaced before publish**
- Any photo without a recorded license or attribution trail

**Fallback rule (launch standard)**
Per-course photo gathering is not practical at this scale, so the neutral FindFrolf placeholder (`/images/course-placeholder.svg`) is the **standard photo for launch** — it is publish-acceptable. Upgrade a course's photo when a real one becomes available through community submissions, club partnerships, or on-site visits; the check script notes placeholder photos as informational, not blocking. **Never** substitute a wrong or likely-copyrighted photo just to tick the field — that rule is absolute.

Photos are stored as `photos[].url`, `photos[].alt`, and `photos[].caption` — put attribution in the caption when the license requires it.

### Enriched fields (top-50 only)

After the required fields are done, add enriched fields for top-50 courses:
- `holeData` — real hole-by-hole data only, entered from the sourcing hierarchy below. `number` accepts integer hole numbers **or variant labels** like `"6A"` for alternate holes (courses with alternate baskets/tees on a hole, e.g. The Canyons). Leave `[]` until real data exists.
- `signatureHoleDescription` — 2-3 sentences about the signature hole
- `localTips` — weather notes, best times, what to bring
- `reviews` — real player reviews only. Leave `[]` until genuine, sourced reviews exist — never fabricate reviews or mark them `verified` without proof
- `tournaments` — upcoming events
- `nearbyCourseSlugs` — look up 2-3 nearby course slugs

---

## Step 3: QA Checklist

Before marking a course as publish-ready, verify each item:

### Required Fields Check
- [ ] `name` matches the name on the course signage
- [ ] `code` follows the `XX-####` format and doesn't duplicate an existing code
- [ ] `city` and `state` are full names (not abbreviations)
- [ ] `citySlug` and `stateSlug` are lowercase with hyphens
- [ ] `location.address` is a complete street address
- [ ] `location.lat` and `location.lng` are accurate to 4+ decimal places (verify on Google Maps)
- [ ] `holes` matches the actual hole count (not the original count if redesigned)
- [ ] `par` is the correct total par
- [ ] `totalFeet` is the total length of the longest layout
- [ ] `courseLength` matches: short (<5000ft), medium (5000-7000ft), long (>7000ft)
- [ ] `difficulty` and `difficultyRating` are consistent (Easy=1-2, Moderate=3, Hard=4, Very Hard=5)
- [ ] `isFree` and `greenFee` are consistent
- [ ] `pdgaCourseId` is the numeric ID from the PDGA URL (or null if not on PDGA)
- [ ] `photos` has at least 1 entry with `url`, `alt`, and optional `caption`
- [ ] `heroImage` and `thumbnail` match `photos[0].url`
- [ ] `rating` is 0-5 with one decimal place
- [ ] `reviewCount` is a positive integer
- [ ] `tags` has at least 2 tags
- [ ] `amenities` — all 9 booleans filled in based on verified info, not guesses
- [ ] `lastVerified` is today's date (ISO format: YYYY-MM-DD)
- [ ] `aboutParagraphs` has at least 1 paragraph of genuine editorial content (not copied from UDisc)
- [ ] `difficultyRating` equals the rubric score and `difficulty` matches the mapping (see Difficulty Rubric)
- [ ] `parSource` is set (see Par Rule) — `estimated` entries get re-verified before launch
- [ ] Photo license/attribution recorded per the Photo Sourcing Policy (no manufacturer, UDisc, or license-less photos)

### Voice Check
- [ ] First paragraph uses the Find Frolf voice: honest, warm, specific
- [ ] No corporate language ("world-class", "seamless", "revolutionary")
- [ ] Mentions something specific about the course (a hole, a tree, a hazard)
- [ ] Beginner-friendly note if applicable

### Technical Check
- [ ] Run `npx astro build` — no errors
- [ ] Visit the generated page — no broken images or missing data
- [ ] Schema markup is valid (build passing = schema valid)

---

## Step 4: Publish

### Publishing via Sanity
1. In Sanity Studio, change the document status from "Draft" to "Published"
2. The Sanity GROQ query in the Astro build will pick it up on next deploy
3. Run `npx astro build && wrangler pages deploy dist --project-name=findfrolf --commit-dirty --branch=main`

### Publishing via JSON files
0. Run `npm run check:courses` — the course must report **Ready** (all warnings resolved)
1. Ensure the JSON file passes `npx astro build` with no errors
2. Commit the file to git
3. Run `wrangler pages deploy dist --project-name=findfrolf --commit-dirty --branch=main`

### "Publish-Ready" Definition
A course is publish-ready when ALL of the following are true:
1. **All required fields populated** — no nulls in required fields
2. **At least 1 photo** — with descriptive alt text
3. **`lastVerified` within 6 months** — data is fresh
4. **GPS coordinates accurate** — verified on Google Maps
5. **Editorial content** — at least 1 genuine paragraph in Find Frolf voice
6. **Build passes** — `npx astro build` completes with no errors

---

## Re-Verification Schedule

| Course Tier | Re-verify Frequency |
|-------------|-------------------|
| Top-50 (enriched) | Every 3 months |
| All other published | Every 6 months |
| Unverified/published > 1 year | Flag for re-verification |

To re-verify: update `lastVerified` to today's date after confirming the data is still accurate. If anything has changed (redesign, new holes, closed), update the relevant fields. If the par was estimated (`parSource: "estimated"`), re-check it against a published source (PDGA or UDisc) and update `parSource`.

---

## Test Entry: Roper Park (Lincoln, NE)

A test entry has been created at `src/content/courses/roper-park-west.json` using real PDGA data for Max E. Roper Interstate Park - West in Lincoln, NE. This entry validates:

- All required fields populated
- PDGA course ID present (`25145`)
- GPS coordinates from PDGA directory (40.8493, -96.714917)
- Amenities booleans populated from PDGA listing
- `lastVerified` set to `2026-07-08`
- Photos array with alt text
- Empty enriched fields (holeData, reviews, etc.) — this is a standard course, not top-50

To verify it works: `npx astro build` — the Roper Park page generates at `/ne/lincoln/roper-park-west`.
