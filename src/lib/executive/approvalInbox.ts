import { prisma } from '@/lib/db/prisma';
import { requireAnyRole } from '@/lib/auth/rbac';
import { listSubmissionsAwaitingCeoReview } from '@/lib/submissions/review';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export interface ApprovalInboxItem {
  id: string;
  referenceNumber: string;
  title: string;
  documentType: string;
  originatingDepartment: string;
  submittedByName: string;
  dueDate: Date | null;
  workflowStage: string;
  status: string;
  requiredAction: string;
  linkUrl: string;
}

/**
 * #A31's unified CEO Approval Inbox — aggregates every item genuinely awaiting a CEO decision
 * today: SMC submissions not yet vetted either way (#A27's listSubmissionsAwaitingCeoReview,
 * reused as-is), and published Board Decision Papers with no Board outcome recorded yet (the CEO
 * has org-wide read/oversight on these — #A18 — even though the *decision* is a Board Member
 * action, the CEO can see what's still open). Does not invent a parallel "Approve/Approve with
 * Conditions/Decline/Delegate Review" action set for SMC submissions — that would be new workflow
 * semantics this pass didn't build server-side; the inbox links through to each item's real,
 * already-working action surface (the CEO vetting panel on /executive-dashboard, or the Board
 * decision panel on /submissions/[id]) rather than presenting actions that don't actually exist
 * yet. See docs/known-limitations.md.
 */
export async function listCeoApprovalInbox(
  actingUser: AuthenticatedUser,
): Promise<ApprovalInboxItem[]> {
  requireAnyRole(actingUser, CEO_ROLES);

  const [awaitingCeo, boardPapers] = await Promise.all([
    listSubmissionsAwaitingCeoReview(actingUser),
    prisma.submission.findMany({
      where: { submissionCategory: 'BOARD', boardOutcome: null },
      include: { department: true, createdBy: true },
    }),
  ]);

  const fromSmc: ApprovalInboxItem[] = awaitingCeo.map((s) => ({
    id: s.id,
    referenceNumber: s.referenceNumber,
    title: s.title,
    documentType: s.paperType,
    originatingDepartment: s.department.name,
    submittedByName: '—',
    dueDate: null,
    workflowStage: s.workflowStatus,
    status: 'Awaiting CEO review',
    requiredAction: 'Vet for Board or mark not vetted',
    linkUrl: `/executive-dashboard?selected=${s.id}`,
  }));

  const fromBoard: ApprovalInboxItem[] = boardPapers
    .filter((p) => isDecisionPaper(p.paperType))
    .map((p) => ({
      id: p.id,
      referenceNumber: p.referenceNumber,
      title: p.title,
      documentType: p.paperType,
      originatingDepartment: p.department.name,
      submittedByName: p.createdBy.name,
      dueDate: null,
      workflowStage: p.workflowStatus,
      status: 'Awaiting Board decision',
      requiredAction: 'Review Board decision progress',
      linkUrl: `/submissions/${p.id}`,
    }));

  return [...fromSmc, ...fromBoard];
}
