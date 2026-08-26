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

---

## Step 2: Data Entry

### Where to enter data

**Option A — Sanity Studio (recommended for 500+ courses)**
1. Run `cd sanity && npm install && npm run dev`
2. Open the Studio at `http://localhost:3333`
3. Click "Create new" → "Course"
4. Fill in all required fields (see below)
5. Save as draft

**Option B — JSON file (for small batches or testing)**
1. Create `src/content/courses/{slug}.json`
2. Use an existing course file as template (e.g. `roper-park-west.json`)
3. Fill in all required fields
4. Run `npx astro build` to validate

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

### Enriched fields (top-50 only)

After the required fields are done, add enriched fields for top-50 courses:
- `holeData` — enter hole-by-hole from the course layout map or on-site scorecard
- `signatureHoleDescription` — 2-3 sentences about the signature hole
- `localTips` — weather notes, best times, what to bring
- `reviews` — 3 verified reviews
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

To re-verify: update `lastVerified` to today's date after confirming the data is still accurate. If anything has changed (redesign, new holes, closed), update the relevant fields.

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
