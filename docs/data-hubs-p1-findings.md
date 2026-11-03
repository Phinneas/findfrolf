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
  → **OWNER TODO:** confirm whether `/events/` and `/map/` pages should be
  built; only then add them to `sitemap.xml.ts`.

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
  → **OWNER TODO:** confirm June 1, 2025 is the true publication date for both
  posts — the identical round-number date on two unrelated posts looks
  placeholder-ish.
- **Chicago:** `pubDate: "2026-08-12"` (displays Aug 11 in US timezones — same
  bug) with `updatedDate: "2026-05-15"` — updated **earlier** than published,
  violating the invariant. The true update date is unknown, so the stale
  `updatedDate` was removed rather than guessed.
  → **OWNER TODO:** set Chicago's real `updatedDate` if the post was
  meaningfully revised after publication.
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
  → **OWNER TODO:** editorial decision — extend the list or retitle the post.
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
→ **OWNER TODO:** decide whether city JSON counts should also be derived.

## Broken sentence (fixed with TODO, name not invented)

`Hole 17 is the longest at Mt.` — sentence trails off; the missing course
name could not be verified from course data, so the sentence was minimally
repaired to reference the entry it follows (Mt. Airy Forest) and flagged:

- `src/content/blog/most-challenging-wooded-disc-golf-courses.md:99`
- `src/content/blog/best-disc-golf-course-in-every-state.md:123`

→ **OWNER TODO:** supply the intended fact (e.g. hole 17 distance at
Mt. Airy Forest) to complete the sentence properly.

## PDGA rules penalty lines — DO NOT EDIT (owner review)

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

## Gear conflict — DO NOT resolve (both quotes)

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

## Owner TODO summary

1. Confirm `/events/` and `/map/` pages should be built; only then add to
   sitemap.
2. Confirm true publication dates for the Portland guide and the free how-to
   (frontmatter says 2025-06-01 for both).
3. Provide Chicago's real `updatedDate` if the post was revised after
   2026-08-12.
4. Every-state post lists 15 courses but claims one per state (23) — extend
   or retitle.
5. Supply the intended "Hole 17" fact to complete the truncated sentence in
   the two posts listed above.
6. Review the PDGA rules penalty lines listed above (not edited).
7. Decide whether city JSON hardcoded counts should also be derived from
   course data.
8. Resolve the 1-disc vs 3-disc gear guidance conflict (not touched).
