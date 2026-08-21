import { prisma } from '@/lib/db/prisma';
import type { PaperType, SubmissionCategory } from '@prisma/client';

// Future-phase full lists (workplan/SMC/Board governance modules — not seeded for Milestone 1).
// Kept for reference so expanding the live PaperType table later doesn't require re-deriving this
// list — see docs/milestone-1-plan.md and docs/assumptions-and-decisions.md#A12.
export const SMC_PAPER_TYPES = [
  'Departmental Management Report',
  'SMC Information Paper',
  'SMC Decision Paper',
  'Policy or Regulatory Paper',
  'Financial or Procurement Paper',
  'Project or Program Update',
  'Risk or Compliance Paper',
] as const;

export const BOARD_PAPER_TYPES = [
  'Board Information Paper',
  'Board Decision Paper',
  'Board Policy Paper',
  'Financial or Procurement Paper',
  'Progress or Implementation Report',
  'Risk or Compliance Paper',
  'Circular Resolution',
] as const;

export type SmcPaperType = (typeof SMC_PAPER_TYPES)[number];
export type BoardPaperType = (typeof BOARD_PAPER_TYPES)[number];

// Board Decision Papers must carry a proposed resolution before submission (section 11, future
// SMC/Board governance module).
export function requiresProposedResolution(paperType: string): boolean {
  return paperType === 'Board Decision Paper';
}

// General pattern match (not a fixed pair of literals) so an admin-added future paper type named
// e.g. "Regional Decision Paper" is still caught by the AI review's recommendation/decision check
// without a code change — see src/lib/providers/aiReview/mockProvider.ts.
export function isDecisionPaper(paperType: string): boolean {
  return /decision paper/i.test(paperType);
}

// Milestone 1 configurable reference data (docs/milestone-1-plan.md) — never hardcode this list in
// UI or validation; always read the live PaperType table.
export async function listActivePaperTypes(category?: SubmissionCategory): Promise<PaperType[]> {
  return prisma.paperType.findMany({
    where: { isActive: true, ...(category ? { category } : {}) },
    orderBy: { name: 'asc' },
  });
}

export async function getPaperTypeByName(name: string): Promise<PaperType | null> {
  return prisma.paperType.findFirst({ where: { name, isActive: true } });
}
