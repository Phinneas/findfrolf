/**
 * Pure trust resolver — docs/HANDOFF-data-layer.md §6.
 *
 * `resolve()` is deliberately free of any D1 / Cloudflare dependency so it can
 * be unit-tested in isolation. It takes raw observations + sources and returns
 * one trust snapshot per course. The Worker and the export script both consume
 * this same function, guaranteeing they can never disagree.
 */

export type Status = 'active' | 'partial' | 'unplayable' | 'removed' | 'unverified';
export type DiscLossRisk = 'low' | 'medium' | 'high';

export interface Observation {
  id: string;
  course_id: string;
  field: string;
  /** JSON-encoded value, per the D1 schema. */
  value: string;
  source_id: string;
  /** ISO date/time — when it was true on the ground. */
  observed_at: string;
  ingested_at?: string;
  /** 0/1 (D1) or boolean; a locked observation always wins its field. */
  locked?: number | boolean;
}

export interface Source {
  id: string;
  type: string;
  url?: string | null;
  trust: number; // 0..1
}

export interface ChangelogEntry {
  date: string;
  field: string;
  from: string | null;
  to: string;
  sourceType: string;
}

export interface Snapshot {
  code: string;
  status: Status;
  holesPlayable: number | null;
  lastVerified: string | null;
  freshnessDays: number | null;
  ratingRecent: number | null;
  ratingAllTime: number | null;
  ratingsToReviews: number | null;
  rubric: null;
  discLossRisk: DiscLossRisk | null;
  flags: string[];
  conflicts: string[];
  changelog: ChangelogEntry[];
  /** Resolved field values (parsed), keyed by registry field name. */
  fields: Record<string, unknown>;
  builtAt: string;
}

const DAY_MS = 86_400_000;
const DECAY_DAYS = 180;
const CONFLICT_MIN_WEIGHT = 0.3;
const CONFLICT_WINDOW_DAYS = 90;
const FRESHNESS_LIMIT_DAYS = 180;
const RATING_WINDOW_DAYS = 365;
const RATING_MIN_EVENTS = 5;
const THIN_REVIEWS_RATIO = 10;

/** Source types that count as a fresh, trusted "last verified" signal. */
const VERIFIED_SOURCE_TYPES = new Set(['content_file', 'onsite', 'parks_dept', 'monitor']);

const UNPLAYABLE_RE =
  /missing basket|baskets gone|defunct|abandoned|unplayable|removed|overgrown/i;

/** Parse a JSON-encoded observation value; fall back to the raw string. */
function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Serialize a value for a changelog `from`/`to` string. */
function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function toIsoMs(s: string): number {
  return Date.parse(s);
}

interface WeightedObs {
  obs: Observation;
  value: unknown;
  source: Source;
  weight: number;
  ageDays: number;
}

/**
 * Resolve every course present in `observations` into a trust snapshot.
 * Observations are grouped by `course_id`; a course with no observations is
 * skipped (the caller decides how to represent it, e.g. `unverified`).
 */
export function resolve(
  observations: Observation[],
  sources: Source[],
  now: Date | string = new Date(),
): Snapshot[] {
  const nowMs = typeof now === 'string' ? toIsoMs(now) : now.getTime();
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const byCourse = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byCourse.get(o.course_id) ?? [];
    list.push(o);
    byCourse.set(o.course_id, list);
  }

  const snapshots: Snapshot[] = [];
  for (const [courseId, courseObs] of byCourse) {
    snapshots.push(resolveCourse(courseId, courseObs, sourceById, nowMs));
  }
  snapshots.sort((a, b) => a.code.localeCompare(b.code));
  return snapshots;
}

export function resolveCourse(
  courseId: string,
  observations: Observation[],
  sourceById: Map<string, Source>,
  nowMs: number,
): Snapshot {
  const byField = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = byField.get(o.field) ?? [];
    list.push(o);
    byField.set(o.field, list);
  }

  const fields: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const flags: string[] = [];
  const changelog: ChangelogEntry[] = [];

  // Resolve each field, collecting its changelog entries along the way.
  for (const [field, obsList] of byField) {
    const { value, conflict, changes } = resolveField(field, obsList, sourceById, nowMs);
    if (value !== undefined) fields[field] = value;
    if (conflict) conflicts.push(field);
    changelog.push(...changes);
  }

  if (conflicts.length > 0 && !flags.includes('needs_review')) flags.push('needs_review');

  // ── Course-level derived values ──
  const holes = asInt(fields['holes']);
  const holesPlayable = asInt(fields['holes_playable']);

  const lastVerified = computeLastVerified(observations, sourceById);
  const freshnessDays = lastVerified ? Math.round((nowMs - toIsoMs(lastVerified)) / DAY_MS) : null;

  const rating = computeRatings(observations, nowMs);
  if (rating.ratingsToReviews !== null && rating.ratingsToReviews > THIN_REVIEWS_RATIO) {
    flags.push('thin_reviews');
  }

  const status = resolveStatus({
    fields,
    observations,
    nowMs,
    holes,
    holesPlayable,
    freshnessDays,
    flags,
  });

  const discLossRisk = computeDiscLossRisk(fields);

  // Sort changelog newest-first, keep the last 20 changes.
  const sortedChangelog = changelog
    .sort((a, b) => toIsoMs(b.date) - toIsoMs(a.date))
    .slice(0, 20);

  return {
    code: courseId,
    status,
    holesPlayable,
    lastVerified,
    freshnessDays,
    ratingRecent: rating.ratingRecent,
    ratingAllTime: rating.ratingAllTime,
    ratingsToReviews: rating.ratingsToReviews,
    rubric: null, // hand-entered only (open question #1); not yet part of the registry
    discLossRisk,
    flags: dedupe(flags),
    conflicts,
    changelog: sortedChangelog,
    fields,
    builtAt: new Date(nowMs).toISOString(),
  };
}

interface FieldResolution {
  value: unknown;
  conflict: boolean;
  changes: ChangelogEntry[];
}

/**
 * Resolve a single field's value.
 *  1. Locked wins — newest locked observation.
 *  2. Otherwise highest `trust * exp(-age/180)` weight wins.
 *  3. Conflict when the top two distinct values both weigh >= 0.3 and were
 *     observed within 90 days of each other.
 */
function resolveField(
  field: string,
  observations: Observation[],
  sourceById: Map<string, Source>,
  nowMs: number,
): FieldResolution {
  const changes = buildChangelog(field, observations, sourceById);

  // 1. Locked wins (newest locked observation).
  const locked = observations
    .filter((o) => Boolean(o.locked))
    .sort((a, b) => toIsoMs(b.observed_at) - toIsoMs(a.observed_at))[0];
  if (locked) {
    return { value: parseValue(locked.value), conflict: false, changes };
  }

  // 2. Weighted resolution.
  const weighted: WeightedObs[] = observations.map((obs) => {
    const source = sourceById.get(obs.source_id);
    const trust = source?.trust ?? 0;
    const ageDays = Math.max(0, (nowMs - toIsoMs(obs.observed_at)) / DAY_MS);
    const weight = trust * Math.exp(-ageDays / DECAY_DAYS);
    return { obs, value: parseValue(obs.value), source: source ?? { id: obs.source_id, type: 'unknown', trust: 0 }, weight, ageDays };
  });

  const best = weighted.reduce<WeightedObs | undefined>(
    (acc, w) => (!acc || w.weight > acc.weight ? w : acc),
    undefined,
  );
  if (!best) return { value: undefined, conflict: false, changes };

  // 3. Conflict detection across distinct values.
  const byValue = new Map<string, WeightedObs>();
  for (const w of weighted) {
    const key = stringifyValue(w.value);
    const existing = byValue.get(key);
    if (!existing || w.weight > existing.weight) byValue.set(key, w);
  }
  const topTwo = [...byValue.values()].sort((a, b) => b.weight - a.weight).slice(0, 2);
  const conflict =
    topTwo.length === 2 &&
    topTwo[0].weight >= CONFLICT_MIN_WEIGHT &&
    topTwo[1].weight >= CONFLICT_MIN_WEIGHT &&
    Math.abs(toIsoMs(topTwo[0].obs.observed_at) - toIsoMs(topTwo[1].obs.observed_at)) <=
      CONFLICT_WINDOW_DAYS * DAY_MS;

  return { value: best.value, conflict, changes };
}

/** Build a chronological changelog for one field's value transitions. */
function buildChangelog(field: string, observations: Observation[], sourceById: Map<string, Source>): ChangelogEntry[] {
  const sorted = [...observations].sort((a, b) => toIsoMs(a.observed_at) - toIsoMs(b.observed_at));
  const changes: ChangelogEntry[] = [];
  let current: unknown;
  let currentKey: string | null = null;

  for (const o of sorted) {
    const value = parseValue(o.value);
    const key = stringifyValue(value);
    if (currentKey === null || key !== currentKey) {
      changes.push({
        date: o.observed_at,
        field,
        from: currentKey === null ? null : stringifyValue(current),
        to: key,
        sourceType: sourceById.get(o.source_id)?.type ?? 'unknown',
      });
      current = value;
      currentKey = key;
    }
  }

  return changes;
}

function computeLastVerified(
  observations: Observation[],
  sourceById: Map<string, Source>,
): string | null {
  let newest: string | null = null;
  for (const o of observations) {
    const source = sourceById.get(o.source_id);
    const type = source?.type ?? '';
    // "accepted user_report" — in Phase 2, an accepted report is a locked
    // observation; treat locked user_report as verified, otherwise skip it.
    const countsAsVerified =
      VERIFIED_SOURCE_TYPES.has(type) || (type === 'user_report' && Boolean(o.locked));
    if (!countsAsVerified) continue;
    if (newest === null || toIsoMs(o.observed_at) > toIsoMs(newest)) newest = o.observed_at;
  }
  return newest;
}

interface StatusInput {
  fields: Record<string, unknown>;
  observations: Observation[];
  nowMs: number;
  holes: number | null;
  holesPlayable: number | null;
  freshnessDays: number | null;
  flags: string[];
}

function resolveStatus(input: StatusInput): Status {
  const { fields, observations, nowMs, holes, holesPlayable, freshnessDays, flags } = input;

  // 1. A locked status observation always wins (this is the only path to `removed`).
  const lockedStatus = observations
    .filter((o) => o.field === 'status' && Boolean(o.locked))
    .sort((a, b) => toIsoMs(b.observed_at) - toIsoMs(a.observed_at))[0];
  if (lockedStatus) {
    const v = parseValue(lockedStatus.value);
    if (v === 'active' || v === 'partial' || v === 'unplayable' || v === 'removed') return v;
  }

  // 2. Review signals → unplayable (never auto-`removed`).
  const recentSignals = observations.filter((o) => {
    if (o.field !== 'review_signal') return false;
    const ageDays = (nowMs - toIsoMs(o.observed_at)) / DAY_MS;
    if (ageDays < 0 || ageDays > 180) return false;
    const v = parseValue(o.value) as { keyword?: unknown };
    const keyword = typeof v?.keyword === 'string' ? v.keyword : '';
    return UNPLAYABLE_RE.test(keyword);
  });
  if (recentSignals.length >= 2) {
    if (!flags.includes('needs_review')) flags.push('needs_review');
    return 'unplayable';
  }

  // 3. Missing baskets / partial layout.
  if (holesPlayable !== null && holes !== null && holesPlayable < holes) {
    return 'partial';
  }

  // 4. Stale (or never verified).
  if (freshnessDays === null || freshnessDays > FRESHNESS_LIMIT_DAYS) {
    return 'unverified';
  }

  return 'active';
}

interface RatingResult {
  ratingRecent: number | null;
  ratingAllTime: number | null;
  ratingsToReviews: number | null;
}

function computeRatings(observations: Observation[], nowMs: number): RatingResult {
  const events: { stars: number; hasText: boolean; atMs: number }[] = [];
  for (const o of observations) {
    if (o.field !== 'rating_event') continue;
    const v = parseValue(o.value) as { stars?: unknown; date?: unknown; has_text?: unknown };
    if (typeof v?.stars !== 'number') continue;
    const atMs = typeof v.date === 'string' && !Number.isNaN(toIsoMs(v.date)) ? toIsoMs(v.date) : toIsoMs(o.observed_at);
    events.push({ stars: v.stars, hasText: v.has_text === true, atMs });
  }

  const recent = events.filter((e) => nowMs - e.atMs <= RATING_WINDOW_DAYS * DAY_MS && nowMs - e.atMs >= 0);
  const mean = (list: typeof events) =>
    list.length >= RATING_MIN_EVENTS ? list.reduce((s, e) => s + e.stars, 0) / list.length : null;

  const withText = events.filter((e) => e.hasText).length;
  const ratingsToReviews = withText > 0 ? events.length / withText : null;

  return {
    ratingRecent: mean(recent),
    ratingAllTime: mean(events),
    ratingsToReviews,
  };
}

function computeDiscLossRisk(fields: Record<string, unknown>): DiscLossRisk | null {
  const waterHoles = asInt(fields['water_holes']);
  const rough = fields['rough_density'];
  const isWooded = fields['isWooded'] === true;

  // Heuristic placeholder (thresholds not specified in the handoff) — confirm
  // with Buzz before exposing in the UI.
  let score = 0;
  if (isWooded) score += 1;
  if (rough === 'medium') score += 1;
  if (rough === 'high') score += 2;
  if (waterHoles !== null) {
    if (waterHoles >= 2) score += 1;
    if (waterHoles >= 4) score += 1;
  }

  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

function asInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
