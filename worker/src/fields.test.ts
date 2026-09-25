import { describe, it, expect } from 'vitest';
import { validateObservation } from './fields';

describe('validateObservation', () => {
  it('accepts valid scalar and enum fields', () => {
    expect(validateObservation('holes', 18)).toBeNull();
    expect(validateObservation('status', 'active')).toBeNull();
    expect(validateObservation('rough_density', 'high')).toBeNull();
    expect(validateObservation('location.lat', 45.5)).toBeNull();
    expect(validateObservation('greenFee', '$5')).toBeNull();
  });

  it('accepts amenity and per-hole fields with letter suffixes', () => {
    expect(validateObservation('amenities.dogFriendly', true)).toBeNull();
    expect(validateObservation('holeData.6A.distance', 300)).toBeNull();
    expect(validateObservation('holeData.8B.par', 4)).toBeNull();
  });

  it('rejects unknown fields and wrong value types', () => {
    expect(validateObservation('nonsense', 1)).toMatch(/unknown field/);
    expect(validateObservation('holes', 'eighteen')).toMatch(/integer/);
    expect(validateObservation('amenities.bogus', true)).toMatch(/unknown amenity/);
    expect(validateObservation('status', 'closed')).toMatch(/expected/);
  });
});
