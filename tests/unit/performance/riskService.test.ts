import { describe, it, expect } from 'vitest';
import { computeDepartmentStatus, DEFAULT_RISK_THRESHOLDS } from '@/lib/performance/riskService';

// #A31 acceptance criterion 4: "Department traffic lights are calculated by a reusable service."
// Pure unit tests (no DB) — the function is deliberately side-effect-free.
describe('performance/riskService — computeDepartmentStatus', () => {
  it('returns NO_DATA when there is no snapshot', () => {
    expect(computeDepartmentStatus(null)).toBe('NO_DATA');
    expect(computeDepartmentStatus(undefined)).toBe('NO_DATA');
  });

  it('returns ON_TRACK when the average is at or above the on-track threshold', () => {
    expect(
      computeDepartmentStatus({ kpiPercent: 90, kraPercent: 86 }, DEFAULT_RISK_THRESHOLDS),
    ).toBe('ON_TRACK');
    // Exactly at the boundary
    expect(
      computeDepartmentStatus(
        { kpiPercent: 75, kraPercent: 75 },
        { onTrackMinPercent: 75, atRiskMinPercent: 50 },
      ),
    ).toBe('ON_TRACK');
  });

  it('returns AT_RISK when the average is between the two thresholds', () => {
    expect(
      computeDepartmentStatus({ kpiPercent: 68, kraPercent: 60 }, DEFAULT_RISK_THRESHOLDS),
    ).toBe('AT_RISK');
  });

  it('returns CRITICAL when the average is below the at-risk threshold', () => {
    expect(
      computeDepartmentStatus({ kpiPercent: 48, kraPercent: 42 }, DEFAULT_RISK_THRESHOLDS),
    ).toBe('CRITICAL');
  });

  it('thresholds are configurable, not hardcoded into the calculation', () => {
    const snapshot = { kpiPercent: 60, kraPercent: 60 };
    expect(computeDepartmentStatus(snapshot, { onTrackMinPercent: 75, atRiskMinPercent: 50 })).toBe(
      'AT_RISK',
    );
    expect(computeDepartmentStatus(snapshot, { onTrackMinPercent: 55, atRiskMinPercent: 40 })).toBe(
      'ON_TRACK',
    );
  });
});
