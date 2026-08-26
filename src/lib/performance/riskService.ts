// #A31 — the single, reusable place a department's traffic-light status is computed. The client's
// spec: "Traffic-light calculations must come from a reusable performance/risk service. They must
// not be manually coded into the dashboard... Make thresholds configurable. Provide sensible demo
// thresholds but clearly identify them as configurable rather than official NICTA policy." No
// official NICTA thresholds have been supplied — DEFAULT_RISK_THRESHOLDS below is exactly that: a
// clearly-labelled placeholder, not policy. Every caller that shows a status pill must also show
// (or link to) that these are demo thresholds — see DashboardStatCard usage in the CEO dashboard.

export interface RiskThresholds {
  /** Average of kpiPercent/kraPercent at or above this is ON_TRACK. */
  onTrackMinPercent: number;
  /** Average at or above this (but below onTrackMinPercent) is AT_RISK; below this is CRITICAL. */
  atRiskMinPercent: number;
}

// Demo-only placeholder — see this module's header comment. Not official NICTA policy.
export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  onTrackMinPercent: 75,
  atRiskMinPercent: 50,
};

export type DepartmentRiskStatus = 'ON_TRACK' | 'AT_RISK' | 'CRITICAL' | 'NO_DATA';

export const RISK_STATUS_LABEL: Record<DepartmentRiskStatus, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  CRITICAL: 'Critical',
  NO_DATA: 'No Current Data',
};

/**
 * Computes the traffic-light status for one department's latest performance snapshot. Returns
 * NO_DATA when there is no snapshot at all — a department that has never reported is not silently
 * shown as "on track" (fail-closed, unlike this codebase's usual "fail open" convention for
 * display-only lateness/overdue flags — a missing traffic light is itself informative here, per
 * the client's explicit "Grey — No Current Data" state).
 */
export function computeDepartmentStatus(
  snapshot: { kpiPercent: number; kraPercent: number } | null | undefined,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): DepartmentRiskStatus {
  if (!snapshot) return 'NO_DATA';
  const average = (snapshot.kpiPercent + snapshot.kraPercent) / 2;
  if (average >= thresholds.onTrackMinPercent) return 'ON_TRACK';
  if (average >= thresholds.atRiskMinPercent) return 'AT_RISK';
  return 'CRITICAL';
}
