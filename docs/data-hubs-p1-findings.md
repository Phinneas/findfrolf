# Data Hubs P1 — Findings (Step 0)

Inspection date: 2026-11-03. Repo state: `main` @ 213f4b1, clean working tree.

## Host / adapter / redirects

- **Host: Cloudflare Pages.** Evidence: `package.json` deploy script
  `wrangler pages deploy dist --project-name=findfrolf`, `public/_redirects`,
  and `worker/wrangler.toml` (a separate Workers + D1 "trust" pipeline,
  deferred per `docs/HANDOFF-data-layer.md` — not part of site serving).
- **Redirects live in `public/_redirects`** (Cloudflare Pages native format).
  Already present before this phase:
  - `https://findfrolf.com/* https://www.findfrolf.com/:splat 301` — apex → www,
    path preserved via `:splat`; Cloudflare Pages preserves query strings on
    splat redirects automatically.
  - `/tx/dallas-fort-worth/veterans/ → /tx/dallas-fort-worth/veterans-park-J93i/ 301`
    (course dedupe, unrelated to this phase).
- `astro.config.mjs` already had `site: 'https://www.findfrolf.com'` and
  `trailingSlash: 'always'` before this phase (locked decision per commit
  8052d5b).

## Sitemap

- **Custom endpoint** `src/pages/sitemap.xml.ts` — `@astrojs/sitemap` is NOT
  installed.
- Already forces `https://www.findfrolf.com` + trailing slash on every URL,
  so no sitemap URL should 308/301.
- Exclusions already in place and correct: noindexed state directory pages
  (AdSense remediation §4.2) and non-enriched ("thin", noindexed) course pages
  (§4.1/§4.7). No 404 or draft URLs are emitted.
- `/disclosure/` was already included.
- **`/events/` and `/map/` do not exist** — there is no `events.astro` or
  `map.astro` (or equivalent route) anywhere in `src/pages/`. They cannot be
  added to the sitemap without failing the "every URL returns 200" rule, and
  creating the pages would be a new feature (out of scope for Phase 1).
  → **RESOLVED (2026-11-03):** do not build; they stay out of the sitemap.
  See "Owner TODO summary — RESOLVED" #1.

## Blog content collection

- Files: `src/content/blog/*.md` (23 files), glob loader in
  `src/content.config.ts`.
- Frontmatter fields: `title`, `description`, `pubDate` (string),
  `updatedDate` (optional string), `author`, `heroImage`, `tags`, `faqItems`.
  **There is no `draft` field** in the schema and no draft filtering anywhere.
- Index (`src/pages/blog/index.astro`): `getCollection('blog')` sorted by
  `pubDate` descending, **no filters** — every post in the collection renders.

## Why the live index showed 19 of 23

- **Not reproducible at HEAD.** `astro build` on 213f4b1 renders all 23 posts
  into `dist/blog/index.html` and builds all 23 post pages.
- The four posts (Chicago, Portland, most-scenic, free-how-to) were created in
  commit **f7daa03 (2026-09-24, "search and city pages routing fix")**.
- Root cause on the live site: **deploy lag** — the live deployment predates
  the commit that added the four posts. No draft flag, bad date, filter, or
  slug issue exists in the code. Fix = deploy current `main`.

## Dates

- **"May 31, 2025" root cause:** `new Date("2025-06-01")` parses as UTC
  midnight; rendered via `toLocaleDateString` in a US timezone it displays the
  previous day. Both the Portland guide and the free how-to carry
  `pubDate: "2025-06-01"` (and `updatedDate: "2025-06-01"`), so the correct
  displayed date is **June 1, 2025**.
  → **RESOLVED (2026-11-03):** kept as 2025-06-01, documented. See
  "Owner TODO summary — RESOLVED" #2.
- **Chicago:** `pubDate: "2026-08-12"` (displays Aug 11 in US timezones — same
  bug) with `updatedDate: "2026-05-15"` — updated **earlier** than published,
  violating the invariant. The true update date is unknown, so the stale
  `updatedDate` was removed rather than guessed.
  → **RESOLVED (2026-11-03):** removal confirmed; no updatedDate unless the
  post is meaningfully revised. See Resolutions #3.
- Fixes applied (Task 3): UTC-safe date formatting helper, index sorted by
  `updatedDate ?? pubDate`, and a build-time check that throws when
  `updatedDate < pubDate`.
- Portland title had "(2025)" removed: now
  `Best Disc Golf Courses in Portland, OR | FindFrolf`.

## Course / state counts (computed from `src/content/courses`, 834 JSON files)

| Metric | Value |
|---|---|
| Total courses | 834 |
| Total states | 23 |
| Total cities | 15 |
| Free courses | 765 |
| Denver (citySlug `denver`) | 57 |
| Chicago (`chicago`) | 79 |
| Portland (`portland`) | 39 |
| Austin (`austin`) | 51 |

### Hardcoded literals found in posts (replaced in Task 4)

The brief's exact literals ("65 courses we've verified", "13 states",
"4 verified courses") no longer exist verbatim — the current equivalents:

- `best-beginner-friendly-disc-golf-courses.md:23` — "ranked by player rating
  from the **836** courses we've mapped" (actual: **834** — stale).
- `best-free-disc-golf-courses.md:11` (FAQ) — "**765** of the **834** courses
  we publish are free" (matches today's data; converted to computed values so
  it stays correct).
- `best-disc-golf-course-in-every-state.md:3,11` — "each of the **23 states**
  in our directory" / "**23 states** covered so far" (matches data; converted).
  Editorial note: the post body lists only **15** courses, not one per state.
  → **RESOLVED (2026-11-03):** retitled to "15 States We Cover"; see
  Resolutions #4.
- `best-disc-golf-courses-denver.md:11,32,34` — "around **55** courses"
  (×2) and "the **4** courses we've actually mapped" / "We've published **4**
  mapped courses so far" (actual Denver count: **57** — stale).
- `best-disc-golf-courses-austin.md:32` — "roughly **30** courses … our
  directory tracks **51**" (51 matches; converted to computed value).

Out of scope but flagged: city JSONs also carry hardcoded counts in FAQ
answers (`minneapolis-st-paul.json` 65, `charlotte.json` 56,
`dallas-fort-worth.json` 88, `portland.json` 39, `houston.json` 84,
`chicago.json` 79, `cincinnati.json` 22, `raleigh.json` 42, `seattle.json` 53,
`nashville.json` 43, `kansas-city.json` 45, `phoenix.json` 43,
`atlanta.json` 52, `denver.json` 57, `austin.json` 51) and `nearbyCities`
`courseCount` strings. Task 4 scope was posts only.
→ **RESOLVED (2026-11-03):** derived via {{stats:...}} tokens; see
Resolutions #7.

## Broken sentence (fixed with TODO, name not invented)

`Hole 17 is the longest at Mt.` — sentence trails off; the missing course
name could not be verified from course data, so the sentence was minimally
repaired to reference the entry it follows (Mt. Airy Forest) and flagged:

- `src/content/blog/most-challenging-wooded-disc-golf-courses.md:99`
- `src/content/blog/best-disc-golf-course-in-every-state.md:123`

→ **RESOLVED (2026-11-03):** verified against mt-airy.json (510 ft, par 4);
sentences already match the course JSON. See Resolutions #5.

## PDGA rules penalty lines — REVIEWED 2026-11-03 (see Resolutions #6)

All in `src/content/blog/disc-golf-rules-explained.md`:

- L9 (FAQ): "You receive a one-throw penalty stroke and must throw your next
  shot from the last in-bounds lie (where your disc last crossed the OB line
  going out), or from a designated drop zone if one is marked."
- L11 (FAQ): "Missing a mando adds a one-stroke penalty, and you throw again
  from the tee or a drop zone."
- L15 (FAQ): "The first offense is a warning; subsequent violations add a
  one-stroke penalty."
- L31: "If your tee shot goes OB, you re-tee with a one-stroke penalty (or use
  the drop zone if marked)"
- L44: "…landing there adds a one-stroke penalty."
- L46: "**Penalty:** One stroke added to your score"
- L54: "**Penalty for missing:** One stroke, and you re-throw from the tee or
  designated drop zone"
- L59–61: casual relief "without penalty" lines.
- L67+: the `| Violation | Penalty |` table.

## Chicago suburban picks without course pages — DO NOT create

The post's six suburban picks (`best-disc-golf-courses-chicago.md` §"The Best
Disc Golf Courses in the Chicago Suburbs"):

1. Westside Park — Joliet — **no course page**
2. The Hill at Phillips Park — Aurora — **no course page**
3. LeRoy Oakes Forest Preserve — St. Charles — **no course page**
4. Busse Woods — Elk Grove Village — **no course page**
5. Lippold Park — Crystal Lake — course page **exists** (`il/chicago`)
6. Anna Page Park — Rockford — **no course page**

(Also noted: Big Marsh Park has no course page; Jackson Park and Marquette
Park do.)

## Portland picks without course pages — DO NOT create

Of the six picks in `best-disc-golf-courses-portland-or.md`:

- Gateway Green — **no course page**
- Wilsonville Memorial Park — **no course page**
- Stub Stewart (Buxton) — **no course page**

(Pier Park, Dabney State Park, and Milo McIver have pages.)

## Gear conflict — RESOLVED 2026-11-03, harmonized (see Resolutions #8)

- `free-disc-golf-how-to-find-public-courses.md` (FAQ):
  "**Three discs** is the classic starter kit: a driver, a midrange, and a
  putter. Anywhere from $25–$40 gets you fully equipped for years of free
  rounds."
- `choosing-first-disc-golf-disc.md` (L18):
  "Here's the truth: **you only need one disc** to start, and picking it is
  simpler than you think." (FAQ L15: "No. You only need one disc to play.")

## robots.txt

- Before this phase: `Sitemap: https://findfrolf.com/sitemap.xml` (non-www).
  Fixed in Task 1 to `https://www.findfrolf.com/sitemap.xml`.

## Owner TODO summary — RESOLVED (2026-11-03 closeout)

1. `/events/` and `/map/` — **DECISION RECORDED: do not build.** The routes
   stay out of `sitemap.xml.ts` (guard comment in place there). If the pages
   are ever built, add them to the sitemap then.
2. Portland guide / free how-to `pubDate: 2025-06-01` — **KEPT, documented.**
   Both posts display June 1, 2025. Date is identical on both posts but no
   evidence contradicts it; accepted as-is.
3. Chicago `updatedDate` removal — **CONFIRMED STANDS.** Frontmatter has
   `pubDate: 2026-08-12` only; no updatedDate. Set a real one if the post is
   meaningfully revised.
4. Every-state post (15 picks vs 23 states) — **RESOLVED by retitle.**
   Title is now "The Best Disc Golf Course in 15 States We Cover";
   description/FAQ count claims now say 15 (the curated editorial count of
   picks in the post — deliberately a literal, not a stats token). The
   generator bug behind the confusion (`13 states` hardcode) is fixed in
   `scripts/generate-listicles.mjs` — it now emits a `{{stats:totalStates}}`
   token (resolved at build time), so the generated one-per-state list can
   never drift from the directory.
   Note: raw generator output is NOT publishable (ranks purely by rating →
   surfaces schoolyard/invite-only courses, empty signature lines); the
   committed posts are curated. Regeneration is a scaffold, not a publish step.
5. Hole 17 sentence — **RESOLVED, verified against data.**
   `src/content/courses/mt-airy.json` `signatureHoleDescription`: "Hole 17 is
   the longest at Mt. Airy at 510 feet — a par 4…". Both posts
   (`most-challenging-wooded-disc-golf-courses.md`, `best-disc-golf-course-in-every-state.md`)
   read "Hole 17 is the longest at Mt. Airy Forest — 510 feet, par 4, and the
   course's signature hole." — consistent with the course JSON. Done.
6. PDGA rules penalty lines — **REVIEWED against current Official Rules;
   three corrections made** (all in `disc-golf-rules-explained.md`, citations
   in HTML/YAML comments inline):
   - OB next-lie options were stated incompletely/incorrectly ("must throw …
     from the last in-bounds lie … on the line of play"). Fixed to the
     806.02.D options: previous lie, OR within 1 m of last in-bounds point,
     OR drop zone. (FAQ answer + OB section bullet + summary table.)
   - Missed-mando next lie said "re-throw from the tee or a drop zone" —
     wrong per 804.01.C: next lie is the mando's drop zone, else the previous
     lie (the tee only when the missed throw was a tee shot). Fixed in FAQ,
     body bullet, and summary table.
   - Excessive-time row said "+1 stroke" — per 802.03.B the first violation
     is a warning. Fixed to "Warning first, then +1 stroke".
   Verified correct and left unchanged: tee-shot re-tee option (806.02.D.1,
   QA-OB-2), courtesy warning-then-penalty (812.C), casual relief without
   penalty (806.03), foot fault +1 stroke when called and confirmed
   (802.07.C, 801.02.E). Post `updatedDate: 2026-11-03` added.
7. City JSON hardcoded counts — **RESOLVED with computed values.** Templating
   allowed it: `src/lib/stats.ts` gained `freeCoursesByCity` /
   `paidCoursesByCity` and tokens `{{stats:freeCity:<slug>}}` /
   `{{stats:paidCity:<slug>}}`; `[city].astro` and `index.astro` now run
   `interpolateStats()` over FAQ answers, `nearbyCities` courseCount strings,
   and ledes. All 15 city JSONs tokenized. Two were already stale and are now
   self-healing: atlanta (claimed 52, actual 51) and dallas-fort-worth
   (claimed 88, actual 87).
8. Gear conflict (1 disc vs 3) — **RESOLVED, harmonized.** Both posts now
   agree: you can start with one disc; the classic full kit is driver,
   midrange, putter. `free-disc-golf-how-to-find-public-courses.md` (FAQ +
   body) now reads "You can start with a single disc — the classic full
   starter kit is three…"; `choosing-first-disc-golf-disc.md` intro now says
   the full kit "can come later".
