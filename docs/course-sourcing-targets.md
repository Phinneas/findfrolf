# FindFrolf — MVP City List & Course Targets

Version 1.1 · Replaces "FindFrolf_MVP_City_List.docx" (that file is not in the repo — this is the canonical list)

> **Counting pass complete (Aug 2026):** the per-city targets are now verified against the PDGA directory. Real counts are in `docs/metro-course-counts.md`; the table below reflects them. Aggregate: **~806 PDGA-listed courses** across the 15 metros. The UDisc cross-check is also done (Scrapling, Sep 2026) — see `docs/udisc-cross-check.md`; UDisc lists ~784 across the same metros, and ~69 high-confidence UDisc-only courses (schools/churches/private/putter courses) were entered as base entries. The original "810" estimate was close — but the *allocation* was wrong in places (Chicago and MSP were underestimated; DFW and Portland overestimated).

## The decision: metro scope for every city

Every city in the MVP list is scoped as its **metro region**, not its city limits. This matches how UDisc counts courses, how the existing city pages are already written (Austin: "47 courses across the greater Austin metro, including Round Rock, Cedar Park, and Pflugerville"), and how players actually choose courses ("near me").

**Why this matters:** the task card's "~750 courses" target only holds at metro scope. City-limits counting gives roughly 450; metro counting gives roughly 800. The four "depth-flag" cities in the task card (Nashville, Raleigh, Minneapolis, Cincinnati — listed at ~10–12 each) were counted at city limits. At metro scope all four have publishable depth — and [Minneapolis–St. Paul is a top-3 US disc golf metro](https://d385qv01ouyelq.cloudfront.net/blog/post/top-10-disc-golf-cities-usa-2-minneapolisst-paul-minnesota) ([Charlotte is #4](https://udisc.com/blog/post/top-10-disc-golf-cities-usa-3-charlotte-north-carolina)), so capping the Twin Cities at 12 would badly undersell it.

## Per-city targets

Counts are metro-region estimates (UDisc/PDGA-informed). **Confirm each city's exact count with a [PDGA course-directory search](https://www.pdga.com/course-directory/advanced/search) across its metro counties during the first data-entry pass**, then update the Target column.

| City | Scope | Target | Depth |
|------|-------|--------|-------|
| Austin, TX | Austin–Round Rock MSA | 52 | ✓ counting pass DONE — 48 on PDGA + ~4 UDisc-only (see `docs/austin-course-list.md`; city-page copy says 47 — revise to the final count when entry completes) |
| Denver, CO | Denver–Aurora–Boulder metro | 55 | ✓ |
| Portland, OR | Portland metro (incl. Vancouver, WA) | 55 | ✓ |
| Chicago, IL | Chicago metro | 65 | ✓ |
| Seattle, WA | Seattle–Tacoma metro | 45 | ✓ |
| Charlotte, NC | Charlotte metro (UDisc top-10 city) | 50 | ✓ |
| Houston, TX | Houston metro | 88 | ✓ (existing city-page claim) |
| Phoenix, AZ | Phoenix–Mesa–Scottsdale metro | 45 | ✓ |
| Nashville, TN | Nashville–Murfreesboro metro | 25 | ✓ — depth flag RESOLVED (city limits were ~12) |
| Raleigh, NC | Raleigh–Durham–Cary (the Triangle) | 35 | ✓ — depth flag RESOLVED |
| Dallas–Fort Worth, TX | DFW metro | 110 | ✓ (existing city-page claim) |
| Kansas City, MO/KS | KC bi-state metro | 45 | ✓ |
| Atlanta, GA | Atlanta–Sandy Springs metro | 55 | ✓ |
| Cincinnati, OH | Cincinnati metro (incl. Northern KY) | 25 | ✓ — depth flag RESOLVED |
| Minneapolis–St. Paul, MN | Twin Cities metro | 60 | ✓ — depth flag RESOLVED (UDisc #3 city) |
| **Total** | | **~805** | |

**The 750 target:** metro supply ≈ 805. Publish the top ~750 — skip courses with fewer than 6 holes, closed/abandoned layouts, and private-only courses — or raise the target to match the verified metro counts. The number is set by the city boundaries, not the other way around.

## Publish rules

- **City page launch floor:** a city page goes live when ≥10 of its courses are live and ≥3 are **Ready** per `npm run check:courses`. Austin is the QA city and ships first regardless.
- **Sequencing:** Austin first (QA pass), then the rest in the order of the table above.
- **Counting pass:** when a city is started, the first task is the PDGA directory search that locks its real count and produces the per-city course list. Update the Target column with the verified number.

## Progress

`npm run check:courses` prints per-city progress against these targets, e.g.:

```
Austin       2/47   course(s) — 0 ready / 2 review / 0 draft
```
