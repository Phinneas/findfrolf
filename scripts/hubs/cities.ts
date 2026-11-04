/**
 * Shared city list for the data hubs (all four hubs use the same 15 MVP
 * metros). Each city maps to its U.S. OMB core-based statistical area (CBSA)
 * code, used by the courses-per-100k fetch to pull population live from the
 * U.S. Census Bureau Data API. Population figures are NOT hardcoded here —
 * they are fetched and committed as a separate raw layer (see
 * scripts/hubs/courses-per-100k/fetch.ts).
 */

export interface HubCity {
  slug: string;
  name: string;
  stateSlug: string;
  msaName: string;
  /** OMB metropolitan statistical area CBSA code (FIPS). */
  cbsaCode: string;
}

export const HUB_CITIES: HubCity[] = [
  { slug: 'austin', name: 'Austin', stateSlug: 'tx', msaName: 'Austin-Round Rock-San Marcos, TX Metro Area', cbsaCode: '12420' },
  { slug: 'denver', name: 'Denver', stateSlug: 'co', msaName: 'Denver-Aurora-Centennial, CO Metro Area', cbsaCode: '19740' },
  { slug: 'portland', name: 'Portland', stateSlug: 'or', msaName: 'Portland-Vancouver-Hillsboro, OR-WA Metro Area', cbsaCode: '38900' },
  { slug: 'chicago', name: 'Chicago', stateSlug: 'il', msaName: 'Chicago-Naperville-Elgin, IL-IN Metro Area', cbsaCode: '16980' },
  { slug: 'seattle', name: 'Seattle', stateSlug: 'wa', msaName: 'Seattle-Tacoma-Bellevue, WA Metro Area', cbsaCode: '42660' },
  { slug: 'charlotte', name: 'Charlotte', stateSlug: 'nc', msaName: 'Charlotte-Concord-Gastonia, NC-SC Metro Area', cbsaCode: '16740' },
  { slug: 'houston', name: 'Houston', stateSlug: 'tx', msaName: 'Houston-Pasadena-The Woodlands, TX Metro Area', cbsaCode: '26420' },
  { slug: 'phoenix', name: 'Phoenix', stateSlug: 'az', msaName: 'Phoenix-Mesa-Chandler, AZ Metro Area', cbsaCode: '38060' },
  { slug: 'nashville', name: 'Nashville', stateSlug: 'tn', msaName: 'Nashville-Davidson--Murfreesboro--Franklin, TN Metro Area', cbsaCode: '34980' },
  { slug: 'raleigh', name: 'Raleigh', stateSlug: 'nc', msaName: 'Raleigh-Cary, NC Metro Area', cbsaCode: '39580' },
  { slug: 'dallas-fort-worth', name: 'Dallas–Fort Worth', stateSlug: 'tx', msaName: 'Dallas-Fort Worth-Arlington, TX Metro Area', cbsaCode: '19100' },
  { slug: 'kansas-city', name: 'Kansas City', stateSlug: 'mo', msaName: 'Kansas City, MO-KS Metro Area', cbsaCode: '28140' },
  { slug: 'atlanta', name: 'Atlanta', stateSlug: 'ga', msaName: 'Atlanta-Sandy Springs-Roswell, GA Metro Area', cbsaCode: '12060' },
  { slug: 'cincinnati', name: 'Cincinnati', stateSlug: 'oh', msaName: 'Cincinnati, OH-KY-IN Metro Area', cbsaCode: '17140' },
  { slug: 'minneapolis-st-paul', name: 'Minneapolis–St. Paul', stateSlug: 'mn', msaName: 'Minneapolis-St. Paul-Bloomington, MN-WI Metro Area', cbsaCode: '33460' },
];

export const CITY_SLUGS = HUB_CITIES.map((c) => c.slug);
