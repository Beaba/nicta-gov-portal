import { prisma } from '@/lib/db/prisma';
import { computeDepartmentStatus, type DepartmentRiskStatus } from '@/lib/performance/riskService';

export interface DepartmentPerformanceRow {
  departmentId: string;
  departmentName: string;
  kpiPercent: number | null;
  kraPercent: number | null;
  overdueActivities: number;
  criticalRisks: number;
  lastReportedAt: Date | null;
  status: DepartmentRiskStatus;
}

/** One row per active department, using each department's own latest snapshot (not necessarily
 * the same reporting period for every department — a department that hasn't reported this month
 * still shows its last real figures, with `lastReportedAt` making the staleness visible). */
export async function listLatestDepartmentPerformance(): Promise<DepartmentPerformanceRow[]> {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return Promise.all(
    departments.map(async (dept) => {
      const snapshot = await prisma.departmentPerformance.findFirst({
        where: { departmentId: dept.id },
        orderBy: { reportingPeriod: { endDate: 'desc' } },
      });
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        kpiPercent: snapshot?.kpiPercent ?? null,
        kraPercent: snapshot?.kraPercent ?? null,
        overdueActivities: snapshot?.overdueActivities ?? 0,
        criticalRisks: snapshot?.criticalRisks ?? 0,
        lastReportedAt: snapshot?.lastReportedAt ?? null,
        status: computeDepartmentStatus(snapshot),
      };
    }),
  );
}

export interface OrganisationalTrendPoint {
  periodLabel: string;
  periodCode: string;
  kpiAveragePercent: number;
  kraAveragePercent: number;
}

/** Organisation-wide KPI/KRA trend — the average across every department with a snapshot for that
 * period, one point per ReportingPeriod that has at least one snapshot. Backs the CEO Dashboard's
 * trend chart; computed from the same DepartmentPerformance rows the department table reads, not
 * a separately-maintained figure. */
export async function listOrganisationalTrend(): Promise<OrganisationalTrendPoint[]> {
  const periods = await prisma.reportingPeriod.findMany({
    where: { isActive: true, periodType: 'Monthly' },
    orderBy: { startDate: 'asc' },
    include: { departmentPerformance: true },
  });

  return periods
    .filter((p) => p.departmentPerformance.length > 0)
    .map((p) => {
      const kpiAveragePercent = Math.round(
        p.departmentPerformance.reduce((sum, s) => sum + s.kpiPercent, 0) /
          p.departmentPerformance.length,
      );
      const kraAveragePercent = Math.round(
        p.departmentPerformance.reduce((sum, s) => sum + s.kraPercent, 0) /
          p.departmentPerformance.length,
      );
      return { periodLabel: p.label, periodCode: p.code, kpiAveragePercent, kraAveragePercent };
    });
}

export interface OrganisationalSummary {
  organisationalKpiPercent: number | null;
  kraProgressPercent: number | null;
  departmentsAtRisk: number;
  departmentsCritical: number;
  totalOverdueActivities: number;
}

export async function getOrganisationalSummary(): Promise<OrganisationalSummary> {
  const rows = await listLatestDepartmentPerformance();
  const withData = rows.filter((r) => r.kpiPercent !== null && r.kraPercent !== null);

  const organisationalKpiPercent = withData.length
    ? Math.round(withData.reduce((sum, r) => sum + (r.kpiPercent ?? 0), 0) / withData.length)
    : null;
  const kraProgressPercent = withData.length
    ? Math.round(withData.reduce((sum, r) => sum + (r.kraPercent ?? 0), 0) / withData.length)
    : null;

  return {
    organisationalKpiPercent,
    kraProgressPercent,
    departmentsAtRisk: rows.filter((r) => r.status === 'AT_RISK').length,
    departmentsCritical: rows.filter((r) => r.status === 'CRITICAL').length,
    totalOverdueActivities: rows.reduce((sum, r) => sum + r.overdueActivities, 0),
  };
}
