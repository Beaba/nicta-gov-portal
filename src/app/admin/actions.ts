'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireAnyRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';

// Client requirement: "Corporate Secretariat is the Admin, and ensures deadlines are created" —
// see docs/mvp-directors-portal-plan.md#A18. REVIEWER_SECRETARIAT (displayed "Corporate
// Secretary") therefore has full admin access here alongside SYSTEM_ADMIN, not just deadlines.
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  requireAnyRole(user, ['SYSTEM_ADMIN', 'REVIEWER_SECRETARIAT']);
  return user;
}

export async function addDepartmentAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  if (!code || !name) throw new Error('Code and name are required.');

  const dept = await prisma.department.create({ data: { code, name } });
  await recordAuditEvent({
    userId: user.id,
    action: 'DEPARTMENT_CREATED',
    entityType: 'Department',
    entityId: dept.id,
    newState: { code, name },
  });
  revalidatePath('/admin');
}

// Client requirement: Corporate Secretary "ensures deadlines are created." A submission deadline
// is created alongside the meeting (not a separate admin step) — the Deadline model already
// existed for the fuller governance module (docs/assumptions-and-decisions.md#A9); this is its
// first real caller. `submissionDeadline` becomes both normalCloseAt and lateCloseAt (no separate
// late-submission window in this MVP; see docs/known-limitations.md).
export async function addMeetingAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const title = String(formData.get('title') ?? '').trim();
  const meetingNumber = String(formData.get('meetingNumber') ?? '').trim();
  const meetingDate = String(formData.get('meetingDate') ?? '');
  const submissionDeadline = String(formData.get('submissionDeadline') ?? '');
  if (!title || !meetingNumber || !meetingDate)
    throw new Error('Title, meeting number and date are required.');

  const meeting = await prisma.meeting.create({
    data: {
      meetingType: 'SMC',
      title,
      meetingNumber,
      meetingDate: new Date(meetingDate),
      status: 'SCHEDULED',
    },
  });

  if (submissionDeadline) {
    const activePaperTypes = await prisma.paperType.findMany({
      where: { isActive: true, category: 'SMC' },
    });
    await prisma.deadline.create({
      data: {
        meetingId: meeting.id,
        submissionOpenAt: new Date(),
        normalCloseAt: new Date(submissionDeadline),
        lateCloseAt: new Date(submissionDeadline),
        permittedPaperTypes: JSON.stringify(activePaperTypes.map((pt) => pt.name)),
      },
    });
  }

  await recordAuditEvent({
    userId: user.id,
    action: 'MEETING_CREATED',
    entityType: 'Meeting',
    entityId: meeting.id,
    newState: { title, meetingNumber, submissionDeadline: submissionDeadline || null },
  });
  revalidatePath('/admin');
}

export async function addPaperTypeAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const requiresRecommendation = formData.get('requiresRecommendation') === 'on';
  if (!name) throw new Error('Name is required.');

  const paperType = await prisma.paperType.create({
    data: { code, name, category: 'SMC', requiresRecommendation },
  });
  await recordAuditEvent({
    userId: user.id,
    action: 'PAPER_TYPE_CREATED',
    entityType: 'PaperType',
    entityId: paperType.id,
    newState: { code, name },
  });
  revalidatePath('/admin');
}
