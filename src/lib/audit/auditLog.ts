import { prisma } from '@/lib/db/prisma';

// The only place code should write to AuditEvent. Append-only by convention: no other module
// should call prisma.auditEvent.update/delete. Covers section 21's audit requirements — every
// governance-relevant write (workflow transitions, decisions, late-submission approvals, document
// uploads) should route through here rather than being reconstructed after the fact from other
// tables.
export interface AuditEventInput {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: unknown;
  newState?: unknown;
  correlationRef?: string;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState: input.previousState !== undefined ? JSON.stringify(input.previousState) : null,
      newState: input.newState !== undefined ? JSON.stringify(input.newState) : null,
      correlationRef: input.correlationRef,
    },
  });
}
