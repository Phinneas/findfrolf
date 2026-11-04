/**
 * Shared city list for the data hubs (all four hubs use the same 15 MVP
 * metros). Population figures are the 2020 U.S. Census (April 1, 2020)
 * metropolitan statistical area (MSA) totals, per the U.S. Census Bureau
 * (2020 decennial census), as tabulated in the Census Bureau's MSA
 * population list. Source URL is recorded in each hub's dataset.
 *
 * NOTE: `isWooded` / `difficultyRating` are per-course; the metro centroid is
 * derived at build time as the mean of each city's course coordinates (same
 * method as the playable-months hub).
 */

export interface HubCity {
  slug: string;
  name: string;
  stateSlug: string;
  msaName: string;
  /** 2020 Census MSA population (April 1, 2020). */
  population2020: number;
}

export const HUB_CITIES: HubCity[] = [
  { slug: 'austin', name: 'Austin', stateSlug: 'tx', msaName: 'Austin–Round Rock–San Marcos, TX MSA', population2020: 2_283_371 },
  { slug: 'denver', name: 'Denver', stateSlug: 'co', msaName: 'Denver–Aurora–Centennial, CO MSA', population2020: 2_963_821 },
  { slug: 'portland', name: 'Portland', stateSlug: 'or', msaName: 'Portland–Vancouver–Hillsboro, OR-WA MSA', population2020: 2_512_859 },
  { slug: 'chicago', name: 'Chicago', stateSlug: 'il', msaName: 'Chicago–Naperville–Elgin, IL-IN MSA', population2020: 9_449_351 },
  { slug: 'seattle', name: 'Seattle', stateSlug: 'wa', msaName: 'Seattle–Tacoma–Bellevue, WA MSA', population2020: 4_018_762 },
  { slug: 'charlotte', name: 'Charlotte', stateSlug: 'nc', msaName: 'Charlotte–Concord–Gastonia, NC-SC MSA', population2020: 2_660_329 },
  { slug: 'houston', name: 'Houston', stateSlug: 'tx', msaName: 'Houston–Pasadena–The Woodlands, TX MSA', population2020: 7_149_642 },
  { slug: 'phoenix', name: 'Phoenix', stateSlug: 'az', msaName: 'Phoenix–Mesa–Chandler, AZ MSA', population2020: 4_845_832 },
  { slug: 'nashville', name: 'Nashville', stateSlug: 'tn', msaName: 'Nashville-Davidson–Murfreesboro–Franklin, TN MSA', population2020: 2_014_444 },
  { slug: 'raleigh', name: 'Raleigh', stateSlug: 'nc', msaName: 'Raleigh–Cary, NC MSA', population2020: 1_413_982 },
  { slug: 'dallas-fort-worth', name: 'Dallas–Fort Worth', stateSlug: 'tx', msaName: 'Dallas–Fort Worth–Arlington, TX MSA', population2020: 7_637_387 },
  { slug: 'kansas-city', name: 'Kansas City', stateSlug: 'mo', msaName: 'Kansas City, MO-KS MSA', population2020: 2_192_035 },
  { slug: 'atlanta', name: 'Atlanta', stateSlug: 'ga', msaName: 'Atlanta–Sandy Springs–Roswell, GA MSA', population2020: 6_104_803 },
  { slug: 'cincinnati', name: 'Cincinnati', stateSlug: 'oh', msaName: 'Cincinnati, OH-KY-IN MSA', population2020: 2_249_797 },
  { slug: 'minneapolis-st-paul', name: 'Minneapolis–St. Paul', stateSlug: 'mn', msaName: 'Minneapolis–St. Paul–Bloomington, MN-WI MSA', population2020: 3_690_261 },
];

export const CITY_SLUGS = HUB_CITIES.map((c) => c.slug);
