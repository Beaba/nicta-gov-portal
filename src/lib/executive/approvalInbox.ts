import { prisma } from '@/lib/db/prisma';
import { requireAnyRole } from '@/lib/auth/rbac';
import { listSubmissionsAwaitingCeoReview } from '@/lib/submissions/review';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import { listMemosForCeo } from '@/lib/memos/memos';
import { listSemcReportsForCeoReview } from '@/lib/submissions/semcReview';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export type ApprovalInboxCategory = 'MEMO_BAU' | 'FINANCIAL_DELEGATION' | 'SEMC_PAPER' | 'BOARD_MATTER';

export interface ApprovalInboxItem {
  id: string;
  referenceNumber: string;
  title: string;
  documentType: string;
  category: ApprovalInboxCategory;
  originatingDepartment: string;
  submittedByName: string;
  amount: number | null;
  urgency: string;
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

  const [awaitingCeo, boardPapers, semcReports, memos] = await Promise.all([
    listSubmissionsAwaitingCeoReview(actingUser),
    prisma.submission.findMany({
      where: { submissionCategory: 'BOARD', boardOutcome: null },
      include: { department: true, createdBy: true },
    }),
    listSemcReportsForCeoReview(actingUser),
    listMemosForCeo(actingUser),
  ]);

  // #A32 — the client's mockup treats "SMC Submissions"/legacy CEO Board-vetting review as
  // already covered by /executive-dashboard's own "Awaiting Your Review" panel; the unified inbox
  // adds the 3 categories that had no CEO queue before this pass (Memos & BAU, SEMC pre-meeting
  // review, and — via boardPapers below — Board Matters), matching Screen 3's 4 summary-card
  // categories (Memos & BAU / Financial Delegations / SEMC Papers / Board Matters).
  const fromSmc: ApprovalInboxItem[] = awaitingCeo.map((s) => ({
    id: s.id,
    referenceNumber: s.referenceNumber,
    title: s.title,
    documentType: s.paperType,
    category: 'SEMC_PAPER',
    originatingDepartment: s.department.name,
    submittedByName: '—',
    amount: null,
    urgency: 'MEDIUM',
    dueDate: null,
    workflowStage: s.workflowStatus,
    status: 'Awaiting CEO review',
    requiredAction: 'Vet for Board or mark not vetted',
    linkUrl: `/executive-dashboard?selected=${s.id}`,
  }));

  const fromSemc: ApprovalInboxItem[] = semcReports.map((s) => ({
    id: s.id,
    referenceNumber: s.referenceNumber,
    title: s.title,
    documentType: s.paperType,
    category: 'SEMC_PAPER',
    originatingDepartment: s.department.name,
    submittedByName: s.createdBy.name,
    amount: null,
    urgency: 'MEDIUM',
    dueDate: null,
    workflowStage: s.ceoAgendaStatus ?? 'AWAITING_CEO_REVIEW',
    status: 'Awaiting CEO agenda review',
    requiredAction: 'Accept for agenda, return, or request more information',
    linkUrl: `/executive-dashboard/semc?selected=${s.id}`,
  }));

  const fromBoard: ApprovalInboxItem[] = boardPapers
    .filter((p) => isDecisionPaper(p.paperType))
    .map((p) => ({
      id: p.id,
      referenceNumber: p.referenceNumber,
      title: p.title,
      documentType: p.paperType,
      category: 'BOARD_MATTER',
      originatingDepartment: p.department.name,
      submittedByName: p.createdBy.name,
      amount: null,
      urgency: 'MEDIUM',
      dueDate: null,
      workflowStage: p.workflowStatus,
      status: 'Awaiting Board decision',
      requiredAction: 'Review Board decision progress',
      linkUrl: `/submissions/${p.id}`,
    }));

  const fromMemos: ApprovalInboxItem[] = memos.map((m) => ({
    id: m.id,
    referenceNumber: m.referenceNumber,
    title: m.subject,
    documentType: m.category,
    category: m.financialValue ? 'FINANCIAL_DELEGATION' : 'MEMO_BAU',
    originatingDepartment: m.departmentName,
    submittedByName: m.originatingDirectorName,
    amount: m.financialValue ? Number(m.financialValue) : null,
    urgency: m.priority,
    dueDate: m.dueDate,
    workflowStage: m.status,
    status: 'Awaiting CEO approval',
    requiredAction: 'Approve, return, or reject',
    linkUrl: `/executive-dashboard/approvals?selected=${m.id}`,
  }));

  return [...fromMemos, ...fromSemc, ...fromBoard, ...fromSmc];
}
