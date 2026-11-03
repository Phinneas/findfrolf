/**
 * Playable month rule — SINGLE SOURCE OF TRUTH for the hub's thresholds.
 *
 * The owner can tune the numbers below; bump RULE_VERSION on every change so
 * records in the committed JSON stay attributable to the rule that made them.
 * The hub page renders these thresholds from the built JSON.
 */

export const RULE_VERSION = '1.0';

export interface RuleThresholds {
  /** playable requires normal max temp >= this (°F) */
  tmaxMinF: number;
  /** playable requires normal min temp >= this (°F) */
  tminMinF: number;
  /** playable requires rain days (>= 0.10 in) <= this */
  rainDaysMax: number;
}

export const RULE: RuleThresholds = {
  tmaxMinF: 50,
  tminMinF: 28,
  rainDaysMax: 10,
};

export type MonthStatus = 'playable' | 'marginal' | 'off-season';

export interface MonthClimate {
  tmaxF: number;
  tminF: number;
  rainDays: number;
}

export function classifyMonth(m: MonthClimate, rule: RuleThresholds = RULE): MonthStatus {
  const failures = [
    m.tmaxF < rule.tmaxMinF,
    m.tminF < rule.tminMinF,
    m.rainDays > rule.rainDaysMax,
  ].filter(Boolean).length;
  if (failures === 0) return 'playable';
  if (failures === 1) return 'marginal';
  return 'off-season';
}
