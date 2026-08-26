import { prisma } from '@/lib/db/prisma';
import { requireAnyRole } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export type CeoCommentSource = 'SMC_VETTING' | 'DELEGATION' | 'BOARD_PAPER';

export interface CeoCommentItem {
  id: string;
  source: CeoCommentSource;
  body: string;
  createdAt: Date;
  relatedTitle: string;
  linkUrl: string;
}

/**
 * #A31's "CEO Comments" feed — a read view over comments the CEO has already made through three
 * different existing actions (there is no single "CEO comment" table): SMC vetting comments
 * (#A27, stored in AuditEvent.newState JSON), Delegation comments (#A29's addCeoComment, stored as
 * a self-loop WorkflowTransition), and Board Paper comments (#A30's generic Comment model, filtered
 * to this CEO's own authorId). Read-only aggregation — replying happens on each item's own page.
 */
export async function listCeoComments(actingUser: AuthenticatedUser): Promise<CeoCommentItem[]> {
  requireAnyRole(actingUser, CEO_ROLES);

  const [auditEvents, delegationNotes, boardComments] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        userId: actingUser.id,
        entityType: 'Submission',
        action: { in: ['SUBMISSION_ENDORSED_FOR_BOARD', 'SUBMISSION_NOT_VETTED_FOR_BOARD'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workflowTransition.findMany({
      where: { entityType: 'Delegation', performedById: actingUser.id, comment: { not: null } },
      include: { delegation: true },
      orderBy: { performedAt: 'desc' },
    }),
    prisma.comment.findMany({
      where: { entityType: 'Submission', authorId: actingUser.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const smcIds = auditEvents.map((e) => e.entityId).filter((id): id is string => Boolean(id));
  const smcSubmissions = smcIds.length
    ? await prisma.submission.findMany({ where: { id: { in: smcIds } } })
    : [];
  const smcById = new Map(smcSubmissions.map((s) => [s.id, s]));

  const boardIds = boardComments.map((c) => c.entityId);
  const boardSubmissions = boardIds.length
    ? await prisma.submission.findMany({ where: { id: { in: boardIds } } })
    : [];
  const boardById = new Map(boardSubmissions.map((s) => [s.id, s]));

  const fromSmc: CeoCommentItem[] = auditEvents
    .map((e): CeoCommentItem | null => {
      if (!e.entityId) return null;
      const submission = smcById.get(e.entityId);
      if (!submission || !e.newState) return null;
      let body = '';
      try {
        body = (JSON.parse(e.newState) as { comment?: string }).comment ?? '';
      } catch {
        return null;
      }
      if (!body) return null;
      return {
        id: e.id,
        source: 'SMC_VETTING',
        body,
        createdAt: e.createdAt,
        relatedTitle: `${submission.referenceNumber} — ${submission.title}`,
        linkUrl: `/submissions/${submission.id}`,
      };
    })
    .filter((x): x is CeoCommentItem => x !== null);

  const fromDelegations: CeoCommentItem[] = delegationNotes
    .filter((t) => t.comment)
    .map((t): CeoCommentItem => ({
      id: t.id,
      source: 'DELEGATION',
      body: t.comment ?? '',
      createdAt: t.performedAt,
      relatedTitle: t.delegation?.title ?? 'Delegation',
      linkUrl: `/delegations/${t.delegationId}`,
    }));

  const fromBoard: CeoCommentItem[] = boardComments
    .map((c): CeoCommentItem | null => {
      const submission = boardById.get(c.entityId);
      if (!submission) return null;
      return {
        id: c.id,
        source: 'BOARD_PAPER',
        body: c.body,
        createdAt: c.createdAt,
        relatedTitle: `${submission.referenceNumber} — ${submission.title}`,
        linkUrl: `/submissions/${submission.id}`,
      };
    })
    .filter((x): x is CeoCommentItem => x !== null);

  return [...fromSmc, ...fromDelegations, ...fromBoard].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
