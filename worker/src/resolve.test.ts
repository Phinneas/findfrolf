import { describe, it, expect } from 'vitest';
import { resolve, type Observation, type Source } from './resolve';

const NOW = '2026-09-24T00:00:00Z';
const COURSE = 'TX-1140';

const SOURCES: Source[] = [
  { id: 'content_file', type: 'content_file', trust: 0.8 },
  { id: 'onsite', type: 'onsite', trust: 0.9 },
  { id: 'pdga', type: 'pdga', trust: 0.7 },
  { id: 'review', type: 'review', trust: 0.5 },
  { id: 'user_report', type: 'user_report', trust: 0.6 },
];

let seq = 0;
function obs(partial: Partial<Observation> & Pick<Observation, 'field' | 'value' | 'observed_at'>): Observation {
  seq += 1;
  return {
    id: `obs-${seq}`,
    course_id: COURSE,
    source_id: 'content_file',
    locked: 0,
    ...partial,
  };
}

function snap(observations: Observation[]) {
  return resolve(observations, SOURCES, NOW).find((s) => s.code === COURSE)!;
}

/** Course base: holes + a fresh content_file verification so it starts active. */
function baseObs() {
  return [
    obs({ field: 'holes', value: '18', observed_at: '2026-09-01T00:00:00Z' }),
    obs({ field: 'par', value: '54', observed_at: '2026-09-01T00:00:00Z' }),
  ];
}

describe('resolve — field resolution', () => {
  it('locked wins over a newer, higher-trust unlocked observation', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'holes', value: '12', observed_at: '2026-01-01T00:00:00Z', source_id: 'content_file', locked: 1 }),
      obs({ field: 'holes', value: '18', observed_at: '2026-08-01T00:00:00Z', source_id: 'onsite', locked: 0 }),
    ]);
    expect(s.fields['holes']).toBe(12);
  });

  it('recency decay lets a recent low-trust source beat an old high-trust source', () => {
    // trust 0.9 at ~500 days ≈ 0.056 weight; trust 0.5 at 5 days ≈ 0.486 weight.
    const s = snap([
      ...baseObs(),
      obs({ field: 'totalFeet', value: '7000', observed_at: '2025-05-01T00:00:00Z', source_id: 'onsite', locked: 0 }),
      obs({ field: 'totalFeet', value: '6500', observed_at: '2026-09-19T00:00:00Z', source_id: 'review', locked: 0 }),
    ]);
    expect(s.fields['totalFeet']).toBe(6500);
  });

  it('detects a conflict when two distinct values are both credible and recent', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'par', value: '54', observed_at: '2026-09-01T00:00:00Z', source_id: 'content_file', locked: 0 }),
      obs({ field: 'par', value: '56', observed_at: '2026-09-10T00:00:00Z', source_id: 'pdga', locked: 0 }),
    ]);
    expect(s.conflicts).toContain('par');
    expect(s.flags).toContain('needs_review');
  });

  it('handles hole numbers with letter suffixes (e.g. 6A)', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'holeData.6A.distance', value: '300', observed_at: '2026-09-01T00:00:00Z' }),
      obs({ field: 'holeData.6A.par', value: '3', observed_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(s.fields['holeData.6A.distance']).toBe(300);
    expect(s.fields['holeData.6A.par']).toBe(3);
  });
});

describe('resolve — status branches', () => {
  it('active when verified recently and layout is complete', () => {
    const s = snap(baseObs());
    expect(s.status).toBe('active');
  });

  it('partial when holes_playable < holes', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'holes_playable', value: '15', observed_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(s.status).toBe('partial');
  });

  it('unplayable from 2+ recent review signals, flagged for review', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'review_signal', value: JSON.stringify({ keyword: 'baskets gone', date: '2026-08-01', source_url: 'https://example.com/1' }), observed_at: '2026-08-01T00:00:00Z', source_id: 'review' }),
      obs({ field: 'review_signal', value: JSON.stringify({ keyword: 'overgrown', date: '2026-08-15', source_url: 'https://example.com/2' }), observed_at: '2026-08-15T00:00:00Z', source_id: 'review' }),
    ]);
    expect(s.status).toBe('unplayable');
    expect(s.flags).toContain('needs_review');
  });

  it('unverified when last verification is older than 180 days', () => {
    const s = snap([
      obs({ field: 'holes', value: '18', observed_at: '2025-01-01T00:00:00Z' }),
    ]);
    expect(s.status).toBe('unverified');
  });

  it('removed only via a locked status observation', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'status', value: JSON.stringify('removed'), observed_at: '2026-09-01T00:00:00Z', locked: 1 }),
    ]);
    expect(s.status).toBe('removed');
  });
});

describe('resolve — ratings', () => {
  function ratingObs(stars: number, hasText: boolean, date: string) {
    return obs({
      field: 'rating_event',
      value: JSON.stringify({ stars, date, has_text: hasText }),
      observed_at: date,
      source_id: 'review',
    });
  }

  it('ratingRecent is null with fewer than 5 recent events', () => {
    const s = snap([
      ...baseObs(),
      ratingObs(4.5, true, '2026-08-01'),
      ratingObs(4.0, true, '2026-08-02'),
      ratingObs(3.5, true, '2026-08-03'),
    ]);
    expect(s.ratingRecent).toBeNull();
  });

  it('ratingRecent is the mean of recent events once 5+ exist', () => {
    const s = snap([
      ...baseObs(),
      ratingObs(4.0, true, '2026-08-01'),
      ratingObs(4.2, true, '2026-08-02'),
      ratingObs(4.4, true, '2026-08-03'),
      ratingObs(4.6, true, '2026-08-04'),
      ratingObs(4.8, true, '2026-08-05'),
    ]);
    expect(s.ratingRecent).toBeCloseTo(4.4, 5);
  });

  it('flags thin_reviews when ratings far outnumber reviews with text', () => {
    const many = Array.from({ length: 22 }, (_, i) => ratingObs(4.0, false, `2026-08-${String(i + 1).padStart(2, '0')}`));
    const s = snap([...baseObs(), ...many, ratingObs(4.0, true, '2026-08-20')]);
    expect(s.ratingsToReviews).toBe(23);
    expect(s.flags).toContain('thin_reviews');
  });
});

describe('resolve — derived fields', () => {
  it('lastVerified comes from the newest trusted source', () => {
    const s = snap([
      ...baseObs(),
      obs({ field: 'greenFee', value: '"$5"', observed_at: '2026-06-01T00:00:00Z', source_id: 'onsite' }),
    ]);
    expect(s.lastVerified).toBe('2026-09-01T00:00:00Z');
    expect(s.freshnessDays).toBe(23);
  });

  it('groups observations by course and returns one snapshot per course', () => {
    const s = resolve(
      [
        ...baseObs(),
        { ...obs({ field: 'holes', value: '9', observed_at: '2026-09-01T00:00:00Z' }), course_id: 'CO-0002' },
      ],
      SOURCES,
      NOW,
    );
    expect(s.map((x) => x.code)).toEqual(['CO-0002', 'TX-1140']);
  });
});
