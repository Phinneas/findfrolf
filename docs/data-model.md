# Find Frolf — Course Data Model

Version 1.0 · July 2026

## CMS Choice: Sanity

**Why Sanity over Contentful or others:**
- Best structured-content modeling for 500+ documents with nested objects and arrays
- Real-time collaborative editing (multiple editors can work simultaneously)
- Free tier covers up to 100K documents and 10 users — sufficient for 500+ courses
- GROQ query language is more flexible than Contentful's REST API for filtering
- Portable Text for rich editorial fields (aboutParagraphs can be upgraded later)
- Astro integration via `@sanity/client` is straightforward

**Schema location:** `sanity/schema-types/course.ts` and `sanity/schema-types/city.ts`
**Astro validation:** `src/content.config.ts` (Zod schema mirrors the Sanity schema)

---

## Required Fields (every course must have these to publish)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `name` | string | "Mary Moore Searight" | Full course name |
| `code` | string (regex `^[A-Z]{2}-\d+$`) | "TX-1140" | Internal code: state abbrev + sequential number |
| `slug` | string (auto from name) | "mary-moore-searight" | URL slug, auto-generated |
| `city` | string | "Austin" | Full city name |
| `state` | string | "Texas" | Full state name |
| `citySlug` | string | "austin" | Lowercase, hyphenated |
| `stateSlug` | string (regex `^[a-z]{2}$`) | "tx" | 2-letter lowercase |
| `area` | string | "South Austin" | Neighborhood or sub-region |
| `location.address` | string | "9000 S 1st St, Austin, TX 78748" | Full street address |
| `location.lat` | number (-90 to 90) | 30.1526 | GPS latitude |
| `location.lng` | number (-180 to 180) | -97.7858 | GPS longitude |
| `holes` | number (1-36) | 18 | Total hole count |
| `par` | number | 60 | Total par for the course |
| `totalFeet` | number | 7800 | Total length in feet (longest layout) |
| `courseLength` | enum: short/medium/long | "long" | short <5000ft, medium 5000-7000ft, long >7000ft |
| `difficulty` | enum: Easy/Moderate/Hard/Very Hard | "Hard" | Descriptive label |
| `difficultyRating` | number (1-5) | 4 | 1=Very Easy, 5=Very Hard |
| `isFree` | boolean | true | Free to play? |
| `greenFee` | string | "$0" | Display string for cost |
| `pdgaCourseId` | string or null | "25145" | Numeric ID from PDGA directory URL |
| `websiteUrl` | string (URL) or null | null | Official course/park website |
| `photos` | array (min 1) | [{url, alt, caption}] | At least 1 photo required |
| `heroImage` | string (URL) | "https://..." | Primary hero photo (should match photos[0].url) |
| `thumbnail` | string (URL) | "https://..." | Small image for listings |
| `rating` | number (0-5) | 4.8 | Average player rating |
| `reviewCount` | number | 2104 | Total review count |
| `tags` | array of strings | ["Wooded", "Technical"] | Filterable tags |
| `amenities` | object (see below) | {...} | Structured amenity booleans |
| `lastVerified` | date (ISO) | "2026-07-08" | When data was last checked on-site |
| `aboutParagraphs` | array of text (min 1) | [...] | Editorial description, first gets drop cap |

### Amenities Object

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `restrooms` | boolean | false | Restrooms available on-site |
| `parking` | boolean | true | Parking available |
| `water` | boolean | false | Drinking water available |
| `lighting` | boolean | false | Lit for night play |
| `proShop` | boolean | false | Pro shop on-site |
| `dogFriendly` | boolean | false | Dogs allowed |
| `cartFriendly` | boolean | false | Cart accessible |
| `handicapAccessible` | boolean | false | Wheelchair accessible |
| `camping` | boolean | false | Camping available at or near course |

---

## Optional Metadata Fields (populate when known)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `yearEstablished` | number or null | 1990 | Year course was installed |
| `courseDesigner` | string or null | "John Doe" | Designer name(s) |
| `teeType` | string or null | "Concrete" | Tee surface type |
| `basketType` | string or null | "DISCatcher Pro" | Basket manufacturer/model |
| `elevation` | string or null | "Rolling" | Elevation description |
| `foliage` | string or null | "Dense" | Foliage density description |
| `pdgaTier` | string or null | "B" | Highest PDGA tier hosted |

---

## Enriched Fields (top-50 courses only)

These fields are optional for standard course pages but required for the top-50 ranked courses to provide the full editorial experience.

| Field | Type | Notes |
|-------|------|-------|
| `holeData` | array of hole objects | Hole-by-hole: number, par, distance, character, difficultyPct, isSignature |
| `layoutMapUrl` | string (URL) or null | Course layout map image |
| `signatureHoleDescription` | text or null | Detailed description of the signature hole |
| `localTips` | text or null | Free-text local knowledge (weather, best times, what to bring) |
| `reviews` | array of review objects | Verified player reviews |
| `tournaments` | array of tournament objects | Upcoming tournaments at this course |
| `nearbyCourseSlugs` | array of strings | Slugs of nearby courses for cross-linking |

### Hole Data Object

| Field | Type | Notes |
|-------|------|-------|
| `number` | number | Hole number (1-18+) |
| `par` | number | Par for this hole |
| `distance` | number | Distance in feet |
| `character` | string | Description of the hole layout |
| `difficultyPct` | number (0-100) | Difficulty bar fill percentage |
| `isSignature` | boolean | Is this the signature hole? |

---

## Derived Flags (for quick filtering)

| Field | Type | Default | Notes |
|-------|------|--------|-------|
| `isBeginnerFriendly` | boolean | false | Should also be in tags |
| `isWooded` | boolean | false | Should also be in tags |
| `isOpen` | boolean | false | Open layout (vs wooded) |

---

## Legacy Display Text (optional)

The `facts` object provides human-readable labels for the sidebar facts panel. When not provided, the UI falls back to the structured `amenities` booleans.

| Field | Example | Notes |
|-------|---------|-------|
| `facts.parking` | "Free lot" | Display label |
| `facts.restrooms` | "Yes" | Display label |
| `facts.proShop` | "No on-site" | Display label |
| `facts.dogs` | "Leashed OK" | Display label |
| `facts.baskets` | "DISCatcher Pro" | Display label |
| `facts.lighting` | "None" | Display label |
| `facts.hours` | "Dawn-dusk" | Display label |

---

## "Publish-Ready" Definition

A course is publish-ready when ALL of the following are true:
1. Every required field is populated (no nulls in required fields)
2. At least 1 photo with alt text
3. `lastVerified` date is within the last 6 months
4. GPS coordinates are accurate to 4 decimal places
5. `aboutParagraphs` has at least 1 paragraph of genuine editorial content
6. Schema markup validates (run `npx astro build` with no errors)
