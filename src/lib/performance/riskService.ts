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
  return computeStatusForPercent(
    (snapshot.kpiPercent + snapshot.kraPercent) / 2,
    thresholds,
  );
}

// #A32 — the same reusable calculation, generalized to any single progress percentage (not just a
// department's averaged KPI/KRA pair) so Milestones, Weekly Manager Reports and anything else with
// a progress percentage all compute their traffic light through this one service, per the client's
// explicit "implement thresholds through a configurable performance service; do not calculate them
// separately inside UI components." `hasData` lets a caller distinguish "0% progress" from "no
// update at all" (NO_DATA / Grey), matching computeDepartmentStatus's own null-snapshot handling.
export function computeStatusForPercent(
  percent: number | null | undefined,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): DepartmentRiskStatus {
  if (percent === null || percent === undefined) return 'NO_DATA';
  if (percent >= thresholds.onTrackMinPercent) return 'ON_TRACK';
  if (percent >= thresholds.atRiskMinPercent) return 'AT_RISK';
  return 'CRITICAL';
}

// #A32 — colour + text + icon token for every traffic-light rendering, per the client's explicit
// "Do not rely on colour alone" requirement. `icon` is a tiny inline glyph (not an SVG component
// import, to keep this a pure, framework-free data module) that TrafficLight.tsx maps to the real
// icon component.
export const RISK_STATUS_ICON: Record<DepartmentRiskStatus, 'check' | 'warning' | 'alert' | 'dash'> = {
  ON_TRACK: 'check',
  AT_RISK: 'warning',
  CRITICAL: 'alert',
  NO_DATA: 'dash',
};
