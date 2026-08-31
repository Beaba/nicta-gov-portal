import { prisma } from '@/lib/db/prisma';
import { requireAnyRole } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class FinancialRoutingValidationError extends Error {}

const ADMIN_ROLES = ['SYSTEM_ADMIN'] as const;

// #A32 — the client's 4 initial routing tiers, seeded as configuration rows
// (FinancialApprovalRule), never read as hard-coded numbers by application code — the client's own
// explicit "Do not treat the K50,000 and K1 million values as permanently hard-coded policy" /
// "These must be configuration values, not permanent hard-coded constants." `approvalStageSequence`
// is the ordered role-code chain a request must pass through.
export const INITIAL_FINANCIAL_APPROVAL_RULES = [
  {
    label: 'Up to K50,000',
    minAmount: 0,
    maxAmount: 50000,
    approvalStageSequence: ['SUBMITTER'],
  },
  {
    label: 'Above K50,000 up to K1,000,000',
    minAmount: 50000.01,
    maxAmount: 1000000,
    approvalStageSequence: ['SUBMITTER', 'EXECUTIVE_VIEWER'],
  },
  {
    label: 'Above K1,000,000',
    minAmount: 1000000.01,
    maxAmount: null,
    approvalStageSequence: ['SUBMITTER', 'EXECUTIVE_VIEWER', 'BOARD_SECRETARIAT'],
  },
] as const;

export interface RoutingResolution {
  rule: { id: string; label: string; approvalStageSequence: string[] } | null;
  requiresBoardApproval: boolean;
  requiresCeoApproval: boolean;
}

/** Resolves which approval stages a financial amount must pass through, reading the
 * *configuration table*, never the raw thresholds — see the module comment above. Returns `rule:
 * null` (fails closed, not open — an unconfigured financial amount must not silently skip
 * approval) if no active rule covers the amount, which the caller should treat as "portal-only,
 * escalate to admin to configure a rule." */
export async function resolveFinancialRouting(amount: number): Promise<RoutingResolution> {
  const rules = await prisma.financialApprovalRule.findMany({
    where: { isActive: true },
    orderBy: { minAmount: 'asc' },
  });

  const match = rules.find((r) => {
    const min = Number(r.minAmount);
    const max = r.maxAmount === null ? Infinity : Number(r.maxAmount);
    return amount >= min && amount <= max;
  });

  if (!match) {
    return { rule: null, requiresBoardApproval: false, requiresCeoApproval: false };
  }

  const stages: string[] = JSON.parse(match.approvalStageSequence);
  return {
    rule: { id: match.id, label: match.label, approvalStageSequence: stages },
    requiresBoardApproval: stages.includes('BOARD_SECRETARIAT'),
    requiresCeoApproval: stages.includes('EXECUTIVE_VIEWER'),
  };
}

export async function listFinancialApprovalRules(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, ADMIN_ROLES);
  return prisma.financialApprovalRule.findMany({ orderBy: { minAmount: 'asc' } });
}

export interface UpsertFinancialRuleInput {
  id?: string;
  label: string;
  minAmount: number;
  maxAmount: number | null;
  approvalStageSequence: string[];
}

/** Admin-configurable — the whole point of not hard-coding the thresholds. */
export async function upsertFinancialApprovalRule(
  input: UpsertFinancialRuleInput,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, ADMIN_ROLES);
  if (!input.label.trim()) throw new FinancialRoutingValidationError('Enter a label.');
  if (input.maxAmount !== null && input.maxAmount < input.minAmount) {
    throw new FinancialRoutingValidationError('Maximum amount must be greater than the minimum.');
  }

  const data = {
    label: input.label,
    minAmount: input.minAmount,
    maxAmount: input.maxAmount,
    approvalStageSequence: JSON.stringify(input.approvalStageSequence),
  };

  return input.id
    ? prisma.financialApprovalRule.update({ where: { id: input.id }, data })
    : prisma.financialApprovalRule.create({ data });
}

export async function setFinancialApprovalRuleActive(
  id: string,
  isActive: boolean,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, ADMIN_ROLES);
  return prisma.financialApprovalRule.update({ where: { id }, data: { isActive } });
}
