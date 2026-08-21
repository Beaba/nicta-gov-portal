import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

const ROOT = path.join(process.cwd(), '.data', 'documents');

// Local-dev stand-in for a SharePoint pre-authenticated download link. Every request re-checks
// the caller's access the same way the app layer does (submission owner, reviewer/secretariat, or
// admin) — client requirement: "Role and department authorization is enforced on the server."
export async function GET(_request: Request, { params }: { params: { key: string[] } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const storageKey = params.key.map(decodeURIComponent).join('/');

  const evidence = await prisma.evidence.findFirst({ where: { storageKey } });
  if (evidence?.submissionId) {
    const submission = await prisma.submission.findUnique({ where: { id: evidence.submissionId } });
    const isOwner = submission?.createdById === user.id;
    const isReviewer = user.roles.some(
      (r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
    );
    if (submission && !isOwner && !isReviewer) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  const absolutePath = path.join(ROOT, storageKey.split('/').join(path.sep));
  if (!absolutePath.startsWith(ROOT)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const buffer = await readFile(absolutePath);
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
