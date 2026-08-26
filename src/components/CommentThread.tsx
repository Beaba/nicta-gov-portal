import { prisma } from '@/lib/db/prisma';
import { listComments, type CommentableEntityType } from '@/lib/board/comments';
import { addCommentAction, resolveCommentAction } from '@/app/board/commentActions';
import type { AuthenticatedUser } from '@/lib/auth/types';

// Server-rendered comment thread shared by Board Papers, Resolutions, Action Items and Minutes
// (#A30). Deliberately not a client component: every reply box is always visible rather than
// toggled open, so this never needs to pass a function across the Server/Client boundary (the
// mistake caught live in #A28 — see that decision log entry) and needs no client-side state at all.
export async function CommentThread({
  entityType,
  entityId,
  redirectPath,
  actingUser,
}: {
  entityType: CommentableEntityType;
  entityId: string;
  redirectPath: string;
  actingUser: AuthenticatedUser;
}) {
  const comments = await listComments(entityType, entityId, actingUser);
  const authorIds = Array.from(new Set(comments.map((c) => c.authorId)));
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } } })
    : [];
  const nameById = new Map(authors.map((a) => [a.id, a.name]));

  const isSecretariat = actingUser.roles.some(
    (r) => r.roleCode === 'BOARD_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const boundAdd = addCommentAction.bind(null, entityType, entityId, redirectPath);
  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }

  return (
    <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-nicta-neutral-900">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      {roots.length === 0 ? (
        <p className="mt-2 text-sm text-nicta-neutral-700">No comments yet.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {roots.map((c) => (
            <li key={c.id} className="rounded-md border border-nicta-neutral-200 p-3">
              <CommentRow
                comment={c}
                authorName={nameById.get(c.authorId) ?? 'Unknown'}
                isSecretariat={isSecretariat}
                redirectPath={redirectPath}
              />
              {(repliesByParent.get(c.id) ?? []).length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-nicta-neutral-200 pl-4">
                  {(repliesByParent.get(c.id) ?? []).map((r) => (
                    <li key={r.id}>
                      <CommentRow
                        comment={r}
                        authorName={nameById.get(r.authorId) ?? 'Unknown'}
                        isSecretariat={isSecretariat}
                        redirectPath={redirectPath}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <form action={boundAdd} className="mt-3 flex items-start gap-2">
                <input type="hidden" name="parentId" value={c.id} />
                <input name="body" placeholder="Reply…" className="input flex-1 text-sm" required />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-md border border-nicta-neutral-200 px-3 py-2 text-xs font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100"
                >
                  Reply
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={boundAdd} className="mt-4 space-y-2 border-t border-nicta-neutral-200 pt-4">
        <textarea name="body" rows={2} required placeholder="Add a comment" className="input" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-nicta-neutral-700">
            <select
              name="visibility"
              defaultValue="BOARD_AND_SECRETARIAT"
              className="input text-xs"
            >
              <option value="BOARD_AND_SECRETARIAT">Visible to Board &amp; Secretariat</option>
              <option value="BOARD_ONLY">Board-only</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Post Comment
          </button>
        </div>
      </form>
    </section>
  );
}

function CommentRow({
  comment,
  authorName,
  isSecretariat,
  redirectPath,
}: {
  comment: { id: string; body: string; createdAt: Date; isResolved: boolean; visibility: string };
  authorName: string;
  isSecretariat: boolean;
  redirectPath: string;
}) {
  const boundResolve = resolveCommentAction.bind(null, comment.id, redirectPath);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-nicta-teal-dark">{authorName}</p>
        <div className="flex items-center gap-2">
          {comment.visibility === 'BOARD_ONLY' && (
            <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold uppercase text-status-warning">
              Board-only
            </span>
          )}
          {comment.isResolved && (
            <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-bold uppercase text-status-success">
              Resolved
            </span>
          )}
          <span className="text-xs text-nicta-neutral-700">
            {comment.createdAt.toLocaleString()}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-nicta-neutral-700">{comment.body}</p>
      {isSecretariat && !comment.isResolved && (
        <form action={boundResolve} className="mt-1">
          <button type="submit" className="text-xs font-semibold text-nicta-teal hover:underline">
            Mark resolved
          </button>
        </form>
      )}
    </div>
  );
}
