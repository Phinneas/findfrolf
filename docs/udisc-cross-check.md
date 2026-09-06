# UDisc Cross-Check (gap-fill)

Generated 2026-09-04 · **updated 2026-09-06** after the full metro sweep was
entered into the directory.

> **Full entry pass complete (2026-09-06):** all 784 UDisc-swept metro courses
> were entered as base entries (656 more on top of the initial 65), bringing the
> directory to **786 courses** — essentially full UDisc metro coverage. Each is
> sourced from UDisc (JSON-LD + layout grid), `parSource: udisc`, placeholder
> photos, no hole-by-hole data. Re-verify and enrich before publish.

## Method

1. Pulled UDisc's authoritative marker list (`udisc.com/api/courses/all-map-markers.csv`,
   21,646 courses) with Scrapling's HTTP `Fetcher`.
2. Swept UDisc's `/courses` directory at grid points covering each metro (Scrapling
   `DynamicFetcher`, server-rendered cards) and deduped courses by slug.
3. Filtered each metro's courses by its municipality list (`scripts/metros.json` —
   the same list the PDGA counting pass uses), matching on the card's "City, State" field.
   This is name-consistent with the PDGA pass (both use vendor-attributed municipality).

Nominatim reverse-geocoding was attempted first but blocked all requests (HTTP 403),
so municipality matching uses UDisc's own city field instead — same approach as the
PDGA side, which makes the comparison *more* consistent, not less.

## Per-metro counts (PDGA vs UDisc)

| Metro | PDGA | UDisc | Δ |
|---|---:|---:|---:|
| Chicago | 106 | 76 | −30 |
| Houston | 83 | 80 | −3 |
| Minneapolis-St. Paul | 80 | 60 | −20 |
| Dallas-Fort Worth | 76 | 86 | +10 |
| Charlotte | 59 | 55 | −4 |
| Denver | 56 | 52 | −4 |
| Austin | 51 | 52 | +1 |
| Atlanta | 46 | 50 | +4 |
| Kansas City | 44 | 42 | −2 |
| Seattle | 42 | 51 | +9 |
| Portland | 38 | 36 | −2 |
| Phoenix | 38 | 41 | +3 |
| Raleigh-Durham | 30 | 37 | +7 |
| Nashville | 29 | 44 | +15 |
| Cincinnati | 28 | 22 | −6 |
| **Total** | **806** | **784** | **−22** |

The two directories largely overlap (784 vs 806). The deltas are a mix of:

- **Real UDisc-only courses** (not PDGA-listed): new, private, school, church,
  putter/mini, and apartment/business courses.
- **Name-aliasing**: the same course listed under different names in the two
  directories (e.g. UDisc "Papago (aka Moeur Park)" vs PDGA "Moeur Park").
- **Boundary differences**: Chicago (−30) and Minneapolis-St. Paul (−20) are
  boundary-edge metros where the PDGA municipality list reaches farther than
  UDisc's city attribution (or vice versa). Nashville (+15) and Dallas-Fort Worth
  (+10) lean the other way.

## UDisc-only identification

Name-matching UDisc↔PDGA is unreliable (community vs formal names). The raw
name-unmatched set is 303 courses, split into:

- **69 high-confidence UDisc-only** — clearly non-PDGA types: schools (27),
  churches (14), private/invite-only (7), putter/mini (10), apartment/business (11).
  These were entered as base course entries (see below).
- **234 for review** — parks/memorials/other, a mix of PDGA name-aliases and
  genuine new courses. Deferred to avoid creating duplicate entries; see
  `udisc_only_review.json`.

### Base entries created

High-confidence UDisc-only courses were entered as `src/content/courses/*.json`
base entries: name, city, state, coordinates, hole count, par, total feet, rating
(from the course's UDisc JSON-LD + layout grid), `parSource: udisc`,
`verified: false`, no hole-by-hole data. Placeholder photos. See
`udisc_skipped.json` for any that couldn't be sourced (missing par/feet/coords).

## Notes

- `parSource` is set to `udisc` on these entries; they are auto-generated base
  entries (not human-reviewed) and should be re-verified and enriched with hole
  data before publish.
- The `scripts/` pipeline: `udisc_fetch_markers.py`, `udisc_sweep_all.py`,
  `udisc_diff.py`, `udisc_make_entries.py` (all in `.venv`, Scrapling).
- To regenerate: re-run the sweep, diff, and entry scripts in that order.
