/**
 * Observation field registry — docs/HANDOFF-data-layer.md §5.
 *
 * Every observation write (seed script, importers, accepted player reports)
 * must validate its field + value against this registry before inserting, so
 * a typo'd field name or a wrong value type can never enter the D1 store.
 */

export const STATUS_VALUES = ['active', 'partial', 'unplayable', 'removed'] as const;
export type StatusValue = (typeof STATUS_VALUES)[number];

export const SIGNAGE_VALUES = ['good', 'poor', 'none'] as const;
export const ROUGH_DENSITY_VALUES = ['low', 'medium', 'high'] as const;
export const KID_FRIENDLY_VALUES = ['yes', 'no', 'unknown'] as const;

/** Amenity keys — must match `amenitiesSchema` in `src/content.config.ts`. */
export const AMENITY_KEYS = [
  'restrooms',
  'parking',
  'water',
  'lighting',
  'proShop',
  'dogFriendly',
  'cartFriendly',
  'handicapAccessible',
  'camping',
] as const;

/** Source types — must match the CHECK constraint in migration 0001. */
export const SOURCE_TYPES = [
  'content_file',
  'pdga',
  'udisc',
  'osm',
  'parks_dept',
  'review',
  'user_report',
  'monitor',
  'onsite',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type FieldValue = unknown;

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNonNegativeInt = (v: unknown): v is number => isInt(v) && v >= 0;
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate a (field, value) pair. Returns a human-readable error string when
 * the pair is invalid, or `null` when it is valid.
 */
export function validateObservation(field: string, value: unknown): string | null {
  const fail = (reason: string) => `invalid observation "${field}": ${reason}`;

  switch (field) {
    case 'status':
      return STATUS_VALUES.includes(value as StatusValue) ? null : fail('expected active|partial|unplayable|removed');

    case 'holes_playable':
    case 'water_holes':
      return isNonNegativeInt(value) ? null : fail('expected a non-negative integer');

    case 'holes':
      return isInt(value) && value >= 1 && value <= 36 ? null : fail('expected an integer 1–36');
    case 'par':
    case 'totalFeet':
      return isInt(value) && value >= 0 ? null : fail('expected a non-negative integer');

    case 'isFree':
    case 'crossing_fairways':
    case 'isWooded':
      return typeof value === 'boolean' ? null : fail('expected a boolean');

    case 'greenFee':
    case 'nav_notes':
      return typeof value === 'string' ? null : fail('expected a string');

    case 'signage':
      return SIGNAGE_VALUES.includes(value as (typeof SIGNAGE_VALUES)[number]) ? null : fail('expected good|poor|none');

    case 'rough_density':
      return ROUGH_DENSITY_VALUES.includes(value as (typeof ROUGH_DENSITY_VALUES)[number])
        ? null
        : fail('expected low|medium|high');

    case 'kid_friendly':
      return KID_FRIENDLY_VALUES.includes(value as (typeof KID_FRIENDLY_VALUES)[number])
        ? null
        : fail('expected yes|no|unknown');

    case 'location.lat':
      return typeof value === 'number' && value >= -90 && value <= 90 ? null : fail('expected -90..90');
    case 'location.lng':
      return typeof value === 'number' && value >= -180 && value <= 180 ? null : fail('expected -180..180');

    case 'closure': {
      if (!isPlainObject(value)) return fail('expected {from, to, reason}');
      const o = value;
      return typeof o.from === 'string' && typeof o.to === 'string' && typeof o.reason === 'string'
        ? null
        : fail('closure must have string from/to/reason');
    }

    case 'rating_event': {
      if (!isPlainObject(value)) return fail('expected {stars, date, has_text}');
      const o = value;
      return typeof o.stars === 'number' && o.stars >= 0 && o.stars <= 5 && typeof o.date === 'string' && typeof o.has_text === 'boolean'
        ? null
        : fail('rating_event must have stars (0–5), date (string), has_text (boolean)');
    }

    case 'review_signal': {
      if (!isPlainObject(value)) return fail('expected {keyword, date, source_url}');
      const o = value;
      return typeof o.keyword === 'string' && typeof o.date === 'string' && typeof o.source_url === 'string'
        ? null
        : fail('review_signal must have keyword/date/source_url (strings)');
    }

    default:
      break;
  }

  // amenities.{key} -> boolean
  if (field.startsWith('amenities.')) {
    const key = field.slice('amenities.'.length);
    if (!(AMENITY_KEYS as readonly string[]).includes(key)) return fail(`unknown amenity key "${key}"`);
    return typeof value === 'boolean' ? null : fail('expected a boolean');
  }

  // holeData.{number}.distance | holeData.{number}.par -> int (number may be "6A")
  const holeMatch = /^holeData\.(\d+[A-Za-z]?)\.(distance|par)$/.exec(field);
  if (holeMatch) {
    return isInt(value) && value >= 0 ? null : fail('expected a non-negative integer (feet or par)');
  }

  return fail('unknown field');
}

/** True when `field` is a per-hole field that must be grouped by hole number. */
export function isHoleField(field: string): boolean {
  return /^holeData\.\d+[A-Za-z]?\.(distance|par)$/.test(field);
}
