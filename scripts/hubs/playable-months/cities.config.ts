/**
 * Playable Months hub — city configuration.
 *
 * The 15 MVP cities (Technique & Conditions cluster pilot). City center
 * coordinates are NOT stored here: they are derived at fetch time as the
 * mean of the city's course coordinates in src/content/courses (documented
 * in docs/hub-playable-months.md). Timezones are IANA names, used to render
 * civil dusk in local time.
 */

export interface HubCity {
  slug: string;
  name: string;
  stateSlug: string;
  timeZone: string;
}

export const HUB_CITIES: HubCity[] = [
  { slug: 'austin', name: 'Austin', stateSlug: 'tx', timeZone: 'America/Chicago' },
  { slug: 'denver', name: 'Denver', stateSlug: 'co', timeZone: 'America/Denver' },
  { slug: 'portland', name: 'Portland', stateSlug: 'or', timeZone: 'America/Los_Angeles' },
  { slug: 'chicago', name: 'Chicago', stateSlug: 'il', timeZone: 'America/Chicago' },
  { slug: 'seattle', name: 'Seattle', stateSlug: 'wa', timeZone: 'America/Los_Angeles' },
  { slug: 'charlotte', name: 'Charlotte', stateSlug: 'nc', timeZone: 'America/New_York' },
  { slug: 'houston', name: 'Houston', stateSlug: 'tx', timeZone: 'America/Chicago' },
  { slug: 'phoenix', name: 'Phoenix', stateSlug: 'az', timeZone: 'America/Phoenix' },
  { slug: 'nashville', name: 'Nashville', stateSlug: 'tn', timeZone: 'America/Chicago' },
  { slug: 'raleigh', name: 'Raleigh', stateSlug: 'nc', timeZone: 'America/New_York' },
  { slug: 'dallas-fort-worth', name: 'Dallas–Fort Worth', stateSlug: 'tx', timeZone: 'America/Chicago' },
  { slug: 'kansas-city', name: 'Kansas City', stateSlug: 'mo', timeZone: 'America/Chicago' },
  { slug: 'atlanta', name: 'Atlanta', stateSlug: 'ga', timeZone: 'America/New_York' },
  { slug: 'cincinnati', name: 'Cincinnati', stateSlug: 'oh', timeZone: 'America/New_York' },
  { slug: 'minneapolis-st-paul', name: 'Minneapolis–St. Paul', stateSlug: 'mn', timeZone: 'America/Chicago' },
];
