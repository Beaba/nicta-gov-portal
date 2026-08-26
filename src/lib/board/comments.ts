import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { requireAnyRole, hasAnyRole } from '@/lib/auth/rbac';
import { BOARD_ANY_ROLES, BOARD_SECRETARIAT_ROLES } from '@/lib/board/roles';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Comment } from '@prisma/client';

export class CommentValidationError extends Error {}

export type CommentableEntityType = 'Submission' | 'Resolution' | 'ActionItem' | 'MeetingMinutes';

// #A30 — generic comment thread, reused across every Board-commentable entity. Visibility is
// enforced at read time in listComments, not by hiding rows from the DB — a BOARD_ONLY comment
// exists so a Board Member can flag something without it reaching the Secretariat's inbox; there is
// no "hide from other Board Members" concept in the client's spec, so every Board Member sees every
// comment regardless of visibility, only Corporate Secretariat's own view filters BOARD_ONLY out.
export async function addComment(
  entityType: CommentableEntityType,
  entityId: string,
  actingUser: AuthenticatedUser,
  input: { body: string; parentId?: string; visibility?: 'BOARD_ONLY' | 'BOARD_AND_SECRETARIAT' },
): Promise<Comment> {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  if (!input.body.trim()) {
    throw new CommentValidationError('Enter a comment.');
  }

  const comment = await prisma.comment.create({
    data: {
      entityType,
      entityId,
      authorId: actingUser.id,
      parentId: input.parentId,
      body: input.body.trim(),
      visibility: input.visibility ?? 'BOARD_AND_SECRETARIAT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_COMMENT_ADDED',
    entityType,
    entityId,
    newState: { commentId: comment.id, parentId: input.parentId ?? null },
  });

  return comment;
}

export async function resolveComment(
  commentId: string,
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const comment = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
  await prisma.comment.update({ where: { id: commentId }, data: { isResolved: true } });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_COMMENT_RESOLVED',
    entityType: comment.entityType,
    entityId: comment.entityId,
    previousState: { commentId, isResolved: false },
    newState: { commentId, isResolved: true },
  });
}

/** Ordered as a flat list (parent then its replies immediately after) — every comment on the
 * entity, filtered by visibility for the acting user's role. */
export async function listComments(
  entityType: CommentableEntityType,
  entityId: string,
  actingUser: AuthenticatedUser,
): Promise<Comment[]> {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  const isSecretariat =
    hasAnyRole(actingUser, BOARD_SECRETARIAT_ROLES) && !hasAnyRole(actingUser, ['BOARD_MEMBER']);

  const all = await prisma.comment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
  });

  const visible = isSecretariat ? all.filter((c) => c.visibility !== 'BOARD_ONLY') : all;

  const roots = visible.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of visible) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  const ordered: Comment[] = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(...(repliesByParent.get(root.id) ?? []));
  }
  return ordered;
}

/** #A31 — a flat, most-recent-first feed across every Board-commentable entity, for the "Comments"
 * nav page. Same BOARD_ONLY visibility filtering as listComments. */
export async function listRecentBoardComments(
  actingUser: AuthenticatedUser,
  take = 50,
): Promise<Comment[]> {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  const isSecretariat =
    hasAnyRole(actingUser, BOARD_SECRETARIAT_ROLES) && !hasAnyRole(actingUser, ['BOARD_MEMBER']);

  const comments = await prisma.comment.findMany({
    where: {
      entityType: { in: ['Submission', 'Resolution', 'MeetingMinutes'] },
      ...(isSecretariat ? { visibility: { not: 'BOARD_ONLY' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return comments;
}
