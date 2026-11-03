/**
 * Date helpers for frontmatter date strings ("YYYY-MM-DD").
 *
 * `new Date("2025-06-01")` parses as UTC midnight, so rendering it with the
 * server's local timezone displays the PREVIOUS day in US timezones
 * ("May 31, 2025"). All display formatting therefore pins `timeZone: 'UTC'`
 * so the rendered date always matches the authored frontmatter value.
 */

/** Parse a frontmatter date string for sorting/comparison (UTC-safe). */
export function parsePostDate(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** "Jun 1, 2025" */
export function formatPostDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "June 1, 2025" */
export function formatPostDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
