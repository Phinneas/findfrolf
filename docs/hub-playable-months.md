# Data Hub: Playable Months by City

Pilot hub for the **Technique & Conditions** cluster. NOAA 1991-2020 monthly
climate normals + civil dusk → per-city monthly playability status.

## Cluster posts (wired in Step 3)

- `disc-golf-throwing-technique` — /blog/disc-golf-throwing-technique/
- `disc-golf-in-the-wind` — /blog/disc-golf-in-the-wind/
- `how-to-read-a-disc-golf-course` — /blog/how-to-read-a-disc-golf-course/
- `glow-disc-golf` — /blog/glow-disc-golf/

## Pipeline

- Fetch: `scripts/hubs/playable-months/fetch.ts` →
  `src/data/hubs/playable-months.climate.json` (raw layer, committed)
- Build: `scripts/hubs/playable-months/build.ts` →
  `src/data/hubs/playable-months.json` (final, committed — the only file
  pages read; no external API calls at site build time)
- Rule: `scripts/hubs/playable-months/rule.ts` (v1.0 — owner-tunable;
  bump `RULE_VERSION` on change)
- Refresh: `npm run hubs:refresh` (fetch + build). Same-day reruns are
  deterministic (identical JSON); `pulledAt` is the only day-volatile field.
  The GHCN station inventory is cached uncommitted under
  `scripts/hubs/playable-months/.cache/`.

**Next yearly refresh: 2027-11-03** (pulled_at 2026-11-03 + 1 year).

## Sources

- Climate: NOAA NCEI U.S. Climate Normals 1991-2020, monthly
  (`normals-monthly-1991-2020`) via the NCEI Access Data Service.
  **Public domain, no API token required.**
  https://www.ncei.noaa.gov/access/services/data/v1
- Data types (verified against the live response 2026-11-03):
  `MLY-TMAX-NORMAL`, `MLY-TMIN-NORMAL`, `MLY-PRCP-NORMAL`,
  `MLY-PRCP-AVGNDS-GE010HI` (avg days with precip ≥ 0.10 in)
- Station metadata: GHCN-daily station inventory (public domain).
  https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt
- Dusk: `suncalc` (npm), civil dusk for the 15th of each month, rendered in
  the city's IANA time zone.
- City centers: mean of each city's course coordinates in
  `src/content/courses` (the city collection has no lat/lng). Used only for
  station distance and dusk — station microclimate caveat below.

## Station per city (selected 2026-11-03)

Selection rule: nearest USW (WBAN/airport, first-order) station with
complete monthly normals for all four data types within 75 km; fall back to
any US station with complete normals. Never hand-picked or invented.

| City | Station | Name | Distance from metro centroid |
|---|---|---|---|
| Austin | USW00013958 | AUSTIN-CAMP MABRY | 3.1 km |
| Denver | USW00023062 | DENVER-STAPLETON | 17.5 km |
| Portland | USW00024229 | PORTLAND INTL AP | 7.4 km |
| Chicago | USW00014819 | CHICAGO MIDWAY AP | 7.0 km |
| Seattle | USW00024234 | SEATTLE BOEING FLD | 3.0 km |
| Charlotte | USW00013881 | CHARLOTTE DOUGLAS AP | 11.7 km |
| Houston | USW00012960 | HOUSTON INTERCONTINENTAL AP | 19.0 km |
| Phoenix | USW00023183 | PHOENIX AP | 5.3 km |
| Nashville | USW00013897 | NASHVILLE INTL AP | 1.4 km |
| Raleigh | USW00013722 | RALEIGH AP | 8.2 km |
| Dallas–Fort Worth | USW00013960 | DALLAS FAA AP | 8.5 km |
| Kansas City | USW00013988 | KANSAS CITY DWTN AP | 6.6 km |
| Atlanta | USW00053863 | ATLANTA DEKALB PEACHTREE AP | 12.9 km |
| Cincinnati | USW00093812 | CINCINNATI MUNI AP LUNKEN FLD | 9.5 km |
| Minneapolis–St. Paul | USW00014922 | MINNEAPOLIS-ST PAUL INTL AP | 17.9 km |

## Wind — NOT in v1 (`wind: null` per month)

Candidates for v2 (monthly mean wind speed by station). None ingested yet.

1. **NOAA NCEI Global Summary of the Month (GSOM)** — `AWND` (average
   monthly wind speed) per station, same stations as above. Public domain.
   https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/gov.noaa.ncdc:C00947/html
2. **Open-Meteo Historical Weather API** (ERA5 reanalysis, gridded monthly
   wind speed at each city center). CC BY 4.0 (attribution required).
   https://open-meteo.com/en/docs/historical-weather-api
3. **Iowa Environmental Mesonet (IEM) ASOS/AWOS** monthly wind summaries per
   airport station. Free to use with attribution to IEM/Iowa State.
   https://mesonet.agron.iastate.edu/request/download.phtml

## Known limits

- Station ≠ course microclimate (e.g. Stapleton vs. foothill courses).
- Normals are 30-year averages, not forecasts.
- No wind yet (v1); gusts matter more than monthly means for play.
- Playable rule is editorial (rule.ts), not a NOAA definition.

## Implementation notes (Steps 2–4)

- Hub page: `/data/playable-months/` (+ `/data/` index). Heatmap is a static,
  semantic HTML table enhanced by a vanilla-JS island (sort + detail panel);
  city lookup is the second island. Methodology and the station table are
  static HTML. Dataset JSON-LD in `<head>`.
- Distribution: `public/data/playable-months.json` (served at
  `/data/playable-months.json`) is written by `build.ts` alongside the
  `src/data` copy — a static file, because vite's JSON plugin chokes on any
  route path containing `.json`. Both copies are committed and regenerated
  together.
- `<DataShows />` contract: blog posts are plain `.md` (no MDX in this
  site), so the reusable box is implemented as a container directive —
  `:::datashows{hub="playable-months" city="<slug>"}` — rendered at build
  time by `src/lib/mdast-datashows.ts`. Unknown hub or city fails the build.
  The directive body is the copy slot; the placeholder body is
  `TODO: owner copy (100–200 words).`
- `npm run hubs:refresh` = Step 4 (fetch + build; see Pipeline above).
- Not run here: Lighthouse a11y audit (no Chrome in this environment). The
  heatmap uses native buttons with per-cell `aria-label`s, a table caption,
  a live region for the detail panel, and a scrollable region with
  `tabindex="0"` — run Lighthouse before shipping to confirm ≥ 95.

## Owner TODOs

1. ~~Write the owner position block~~ — done 2026-11-03 (adapted by owner from the SoundDip draft, domain terms rewritten, all data claims preserved).
2. ~~Write copy for each datashows slot~~ — done 2026-11-03 (same adaptation; [N] values filled from the committed JSON: Austin 12, Chicago 7, Denver 7, MSP 7).
3. Confirm the rule thresholds in `scripts/hubs/playable-months/rule.ts` (50°F / 28°F / ≤10 rain days).
4. Pick a v2 wind source from the candidates above.
5. Confirm the metro-centroid method for city centers (mean of course coordinates) is acceptable.
