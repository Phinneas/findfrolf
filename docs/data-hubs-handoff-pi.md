# Data Hubs: Handoff Plan for Pi

Owner: Buzz. Written 2026-11-04. Source of truth for tasks: Asana project
"FindFrolf - Disc Golf Directory", section "P5 Content & SEO", tasks prefixed
"Data Hubs". This doc maps each Asana task to its current state and the work left.

## Bottom line

- Phase 1 (site fixes) is done in code. Some of it is not deployed yet.
- Phase 2 pilot hub (/data/playable-months/) is live. It needs a heat rule
  change, a copy swap, and the re-audit.
- Three more hubs (Phase 3) are built and committed but NOT deployed. They went
  ahead before the Phase 2 re-audit gate. Owner decides whether they ship.
- Phase 4 (refresh + Search Console checks) is documented but not scheduled.

Do the work in the order below. Stop at every OWNER DECISION and ask.

## House rules (apply to every change)

- No em dashes in any user-facing copy. No semicolons in copy.
- No first-person experience lines ("when I played...").
- Do not change UDisc ratings. Do not merge posts.
- Course pages stay noindexed and out of the sitemap unless
  `getContentTier(course) === 'enriched'`. This is intentional (AdSense
  thin-content). Do not "fix" it.
- State pages stay noindexed and out of the sitemap.
- Every sitemap URL must return 200 directly. Run `npm run check:sitemap`.
- Hub numbers in post copy must come from `{{stats:...}}` tokens or the
  `:::datashows` box, never typed-in literals.
- Commit per step. `npm run build` must pass before every commit.

## Current state (verified 2026-11-04 on the live site and repo)

Live and correct:
- Non-www 301s to www (zone-level Cloudflare rule). One canonical per page.
- robots.txt points to https://www.findfrolf.com/sitemap.xml.
- Sitemap: 52 URLs, all www, trailing slash, all 200.
- Blog index shows all 25 posts. Chicago date fixed. "Mt. Airy Forest" sentence fixed.
- /data/playable-months/ live: heatmap, lookup, methodology, station table,
  Dataset JSON-LD, raw JSON at /data/playable-months.json, links to 4 posts.
- All 4 cluster posts have the "What the data shows" box linking the hub.

In the repo, not deployed:
- 7 commits ahead of origin/main (56fc096 .. d37e7d9). Includes the 3 extra hubs.
- Uncommitted working-tree edits (made 2026-11-04):
  - public/_redirects: /map and /map/ 301 to /finder/. /events and /events/ 301 to /cities/.
  - src/pages/sitemap.xml.ts: comment updated to match.
  - best-disc-golf-courses-portland-or.md: title now "Best Disc Golf Courses in
    Portland, OR" (removed "| FindFrolf", which doubled with the layout's
    " - Find Frolf" suffix). pubDate 2026-09-24, updatedDate 2026-11-04.
  - free-disc-golf-how-to-find-public-courses.md: pubDate and updatedDate 2026-09-24.
    (2026-09-24 is when git first added both files. The old 2025-06-01 was wrong.)
  These were NOT build-tested. node_modules on the owner's Mac could not run in
  the Linux sandbox.

## Step A. Ship the pending fixes (no owner input needed, except A3)

A1. `npm run build`, then `npm run check:sitemap`. Fix anything that fails.
A2. Commit the 4 working-tree files: "fix: /map and /events redirects, real
    post dates, dedupe Portland title brand".
A3. OWNER DECISION D3 (below) before deploying, because `npm run deploy` ships
    the 3 extra hubs too. If the owner has not answered, gate them:
    remove their 3 sitemap lines, add `noindex, follow` to the 3 hub pages,
    and hide their cards on /data/. Keep the code and JSON.
A4. Deploy. Verify live:
    - curl -I https://www.findfrolf.com/map/ gives 301 to /finder/
    - curl -I https://www.findfrolf.com/events/ gives 301 to /cities/
    - No "2025" on /blog/best-disc-golf-courses-portland-or/ or
      /blog/free-disc-golf-how-to-find-public-courses/
    - Portland <title> contains "Find Frolf" once.
A5. Push to origin/main.

Asana tasks this closes (owner marks complete after A4 passes):
- Data Hubs P1: Make www the canonical host (1219118435686380)
- Data Hubs P1: Fix the sitemap (1219118435543639). Note: /events and /map
  are redirects, not sitemap entries, because neither page exists.
- Data Hubs P1: Fix the blog index and post dates (1219118304186516)
- Data Hubs P1: Correct stale counts and content errors (1219118435695084),
  except the gear conflict (Step D).
- Data Hubs P1: Open questions (1219118389890983). Pilot = Technique and conditions.

## Step B. Heat limit for the playable-months rule (OWNER DECISION D1)

Today the rule has no upper temperature limit. Every summer month in Phoenix,
Austin, Houston and Dallas counts as playable. The owner picks a cap.

Months each cap would flag (NOAA normal daily high, from playable-months.json):

| Cap | Months flagged |
|---|---|
| 100F | Phoenix Jun-Sep (100.4 to 106.5F) |
| 95F | Phoenix Jun-Sep. Austin Jul-Aug. Dallas Jul-Aug |
| 90F | Phoenix May-Sep. Austin, Houston, Dallas Jun-Sep. Nashville Jul-Aug. Denver, Charlotte, Raleigh, Kansas City Jul |

Notes for the owner:
- Normals have no humidity. Houston peaks at 94.9F but feels hotter. NWS heat
  index bands: 90-103F "extreme caution", 103F and up "danger". Adding humidity
  means pulling dew point normals for the same stations.
- With the current logic ("marginal = fails exactly one condition"), a hot
  month only drops to marginal. A separate off-season heat tier (example: 90F
  marginal, 100F off-season) needs a rule change, not just a new threshold.

Once decided:
B1. Edit scripts/hubs/playable-months/rule.ts. Bump to v1.1.
B2. `npm run hubs:refresh`. Commit the regenerated JSON.
B3. Update the methodology text on the hub so it prints the new rule
    (it renders from rule.ts, so confirm it updates).
B4. Grep post bodies and the position file for hardcoded counts that the new
    rule changes (example: the throwing-technique box says "12 of 12 months"
    for Austin in prose). Replace with tokens or flag for the owner.
B5. Optional, only if the owner picks a humidity option: add dew point normals
    to fetch.ts and compute heat index. Same stations.

## Step C. Copy swap (owner writes, Pi inserts)

The owner is rewriting this copy in another writing tool. It waits on Step B,
because the numbers change.
- src/content/hubs/playable-months-position.md (hub "Our take" block)
- The 100 to 200 word body inside the :::datashows box in:
  disc-golf-throwing-technique, disc-golf-in-the-wind,
  how-to-read-a-disc-golf-course, glow-disc-golf
C1. Paste the owner's text in. Do not edit wording.
C2. Check: no em dashes, no semicolons, no first-person experience lines,
    every number comes from a token or the box figure.
C3. Build, commit, deploy.

Asana: Data Hubs P2: Update the pilot cluster posts (1219118435693952).
Asana: Data Hubs P2: Build the pilot hub (1219118389925859) closes after C3.

## Step D. Gear posts: one disc vs three (decided, picks pending)

Decided message: start with one disc. Three makes the game more fun as you
advance. The free how-to FAQ already says this.

D1. choosing-first-disc-golf-disc: keep the one-disc message. Name the disc
    type to buy first. Add a closing line linking to the beginners post as the
    next step.
D2. disc-golf-discs-for-beginners: change the opener and the H2 "The Short
    Answer: Three Discs" from "you need three" to "start with one, three is the
    upgrade." Keep the putter / mid / driver breakdown. Link back to D1.
D3. Leave product picks and affiliate links unchanged. Owner is reviewing
    affiliates. Add `<!-- TODO: owner affiliate picks -->` where picks go.
D4. Send the outline diff to the owner before writing the full copy.

## Step E. Re-audit the pilot cluster (gate for Phase 3)

Asana: Data Hubs P2: Re-audit the pilot cluster against baseline (1219118464693806).

Baseline Oct 2, 2026, hand-scored: 21 Commodity, 2 Mixed (Austin, Denver at 5),
average 2.8 of 12. Experience row 0 of 69. Own data 8 of 69.

E1. After Step C deploys, run `npm run audit:content > docs/data-hubs-p1-audit.md`
    (objective signals only, it does not score).
E2. Scoring uses the owner's 12-point rubric through the commodity-audit
    Worker, per the Asana task, so scores compare with the baseline. Pi does
    not invent scores. Hand the inventory to the owner or run the Worker if the
    owner provides access.
E3. Report: before vs after per post for the 4 cluster posts, plus the site
    average. Targets: hub 9 or higher, cluster posts 5 or higher.
E4. Phase 3 goes ahead only if scores rise. Owner decides.

## Step F. Phase 3 hubs (OWNER DECISION D3)

Already built in commit 190a7d2: /data/courses-per-100k/,
/data/terrain-index/, /data/free-play-map/. They differ from the Asana specs:

| Hub | Asana spec | What was built |
|---|---|---|
| Courses per 100k (1219118304266663) | Directory counts + Census API | 2020 decennial MSA population, hardcoded in scripts/hubs/cities.ts. No API |
| Terrain index (1219118304199236) | Measured canopy % and elevation range per course (USGS, USFS, OSM) | Mean of the directory's 1-5 difficultyRating per metro. No external data |
| Free-play map (1219118435542226) | Fee field + USGS PAD-US land owner | Fee field only. No land-owner layer. Table, no map |

None of the 3 has an owner position block or datashows boxes in its cluster posts.

Owner decides: ship as built, upgrade to spec, or hold until Step E passes.
If upgrading:
F1. Terrain: USGS elevation (public domain) at each course lat/lng. Canopy
    waits on the license check (F4).
F2. Free-play: join PAD-US land ownership (public domain) by course point.
F3. Courses per 100k: add the Census notice to the methodology section.
    Owner confirms MSA vs city-proper as the denominator.
F4. Asana: Confirm PDGA terms and USFS canopy license (1219118464446109).
    Owner or Pi reads both pages and records the result in this doc. No canopy
    data and no gear hub until confirmed.
F5. Per hub: add the position file placeholder, datashows boxes in its
    cluster posts, and sitemap entry. Same copy rules as Step C.

Wind for playable-months (v2): candidates are listed in
docs/hub-playable-months.md. Owner picks one. Ingest only after the license check.

## Step G. Phase 4: refresh and Search Console

G1. Asana: Schedule data refresh and re-audits (1219118304187755).
    `npm run hubs:refresh:all` yearly (next: 2027-11-03) and after each course
    batch. Re-run Step E after each refresh.
G2. Asana: Search Console checks at 30, 60, 90 days per hub (1219118435686394).
    Pull GSC data through Treg (the owner's GSC connection), not the free GSC
    MCP connector.
    Baseline Jul 4 to Oct 1, 2026: 1 click, 136 impressions site-wide. Blog: 23
    impressions across 8 posts.
    Pilot hub went live 2026-11-03, so checks are due 2026-12-03, 2027-01-02
    and 2027-02-01. Phase 3 hubs: 30/60/90 days from their deploy date.
    Per check: impressions, clicks, average position for the hub URL and each
    cluster post. Also confirm the Dataset enhancement shows in URL Inspection.

## Owner decisions, in one place

- D1. Heat cap for the playable rule (Step B). Blocks B, C, E.
- D2. Affiliate picks for the gear posts (Step D3).
- D3. Ship, upgrade or hold the 3 Phase 3 hubs (Step A3, Step F). Blocks deploy.
- D4. Wind source for playable-months v2.
- D5. MSA vs city-proper population denominator.
- D6. Rewritten copy for the hub position + 4 boxes (Step C).
