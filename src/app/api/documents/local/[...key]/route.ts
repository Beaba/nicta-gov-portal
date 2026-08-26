import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { AuthorizationError } from '@/lib/auth/rbac';

const ROOT = path.join(process.cwd(), '.data', 'documents');

// Local-dev stand-in for a SharePoint pre-authenticated download link. Every request re-checks the
// caller's access — client requirement: "Role and department authorization is enforced on the
// server." #A31: reuses getSubmissionForUser's full access logic (owner / oversight roles / Board
// Member on a published meeting / Board Secretariat) instead of its own narrower, duplicated
// owner-or-secretariat-only check — that older check silently 403'd Board Members, the CEO, and
// Board Secretariat trying to open a Board Paper's document, a real gap fixed here. Also records a
// DOCUMENT_VIEWED audit event on every successful access — the client's "read and download
// tracking" requirement — via the same append-only AuditEvent table every other action already
// uses, not a new model.
export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const storageKey = params.key.map(decodeURIComponent).join('/');

  const evidence = await prisma.evidence.findFirst({ where: { storageKey } });
  if (evidence?.submissionId) {
    try {
      await getSubmissionForUser(evidence.submissionId, user);
    } catch (err) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      throw err;
    }
  }

  const absolutePath = path.join(ROOT, storageKey.split('/').join(path.sep));
  if (!absolutePath.startsWith(ROOT)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const buffer = await readFile(absolutePath);
    if (evidence?.submissionId) {
      await recordAuditEvent({
        userId: user.id,
        action: 'DOCUMENT_VIEWED',
        entityType: 'Submission',
        entityId: evidence.submissionId,
        newState: { fileName: evidence.fileName, storageKey },
      });
    }
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': evidence?.contentType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${evidence?.fileName ?? path.basename(absolutePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
