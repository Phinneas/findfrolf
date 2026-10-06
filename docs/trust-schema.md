# FindFrolf: Trust Collection Schema (Phase 3)

**For:** the operator (Buzz) + enrichment workflow
**Owner:** Buzz
**Date:** 2026-10-05
**Repo:** `~/CascadeProjects/findfrolf`

## 1. Goal

Prove a course is verified with a real, dated trust signal — **who** verified it,
**when**, **how**, and **where the rating came from** — instead of an unearned
"verified" claim. This is the trust half of the AdSense "low value content" fix
(E-E-A-T).

## 2. Mode: lean git-stored (decision)

Trust files are **hand-authored** in `src/content/trust/{slug}.json`, one per
course, as real rounds happen — same pattern as the course JSONs, reviewable in
git. The D1/Worker/cron pipeline (`docs/HANDOFF-data-layer.md`) is deferred; it
can be adopted later if the site scales or needs player reports.

## 3. Schema

Defined in `src/content.config.ts` (`trust` collection). Full field list:

| field | type | meaning |
|---|---|---|
| `code` | string | stable course ID (e.g. `TX-1140`) |
| `status` | enum | `active` \| `partial` \| `unplayable` \| `removed` \| `unverified` |
| `holesPlayable` | number? | playable hole count (null = unknown) |
| `lastVerified` | string? | ISO date of the latest genuine verification |
| `freshnessDays` | number? | days since `lastVerified` |
| **`verifiedBy`** | `{ name, role }?` | **reviewer** — the named human source |
| **`methodology`** | enum? | **how** it was verified |
| **`ratingSource`** | enum? | **where** the rating came from |
| `ratingRecent` | number? | recent mean rating (null if <5 events) |
| `ratingAllTime` | number? | all-time mean rating |
| `ratingsToReviews` | number? | ratings ÷ reviews-with-text |
| `discLossRisk` | enum? | `low` \| `medium` \| `high` |
| `flags` | string[] | e.g. `["fresh", "needs_review"]` |
| `conflicts` | string[] | fields with conflicting observations |
| `changelog` | `{date, field, from, to, sourceType}[]` | last 20 changes |

### 3.1 The three verification fields (new in Phase 3)

**`verifiedBy`** — who verified:

```json
{ "name": "Chester B.", "role": "site owner" }
```

`role` is free text (owner, local player, club member, pro…), defaulting to
`"local player"`.

**`methodology`** — how:

- `onsite-round` — a real played round (the POC case)
- `player-report` — a recruited player's account, not the owner's round
- `cross-check` — data cross-checked against PDGA + UDisc, no on-ground round
- `sourced-data` — imported from a source without verification

**`ratingSource`** — where the rating came from (locked decision #4: ratings
must be source-attributed):

- `udisc` — rating pulled from UDisc
- `pdga` — rating pulled from PDGA
- `findfrolf-verified` — our own verified rounds (future)
- `none` — no rating

## 4. Concrete example (`mary-moore-searight` after the POC round)

```json
{
  "code": "TX-1140",
  "status": "active",
  "holesPlayable": 18,
  "lastVerified": "2026-10-12",
  "freshnessDays": 0,
  "verifiedBy": { "name": "Chester B.", "role": "site owner" },
  "methodology": "onsite-round",
  "ratingSource": "udisc",
  "ratingRecent": 4.8,
  "ratingAllTime": 4.8,
  "ratingsToReviews": null,
  "discLossRisk": "low",
  "flags": [],
  "conflicts": [],
  "changelog": [
    { "date": "2026-10-12", "field": "lastVerified", "from": null, "to": "2026-10-12", "sourceType": "onsite" }
  ]
}
```

## 5. How it ties to the POC

- `verifiedBy.name` = the review's `name` (the same named source that satisfies §4.7)
- `lastVerified` = the review's `date_played`
- `methodology = "onsite-round"` for a played round
- `ratingSource = "udisc"` (matches the "Ratings from UDisc" attribution already shipped)

## 6. What was dropped

`rubric` (always `null` in the D1 resolver) is removed from the lean schema. Add
it back only if rubric scores are actually entered. The D1 resolver
(`worker/src/resolve.ts`) still emits `rubric` — reconcile it before adopting
that pipeline.

## 7. Reading it

`getTrust(slug)` in `src/lib/data.ts` returns the snapshot, or `undefined` when
no file exists (treat as `unverified`). No UI consumes it yet — Phase 3 UI
(status pill, "Last verified {date}", rating source) is a later step.
