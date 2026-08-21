import { prisma } from '@/lib/db/prisma';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import type { DocumentPlacementMetadata } from '@/lib/providers/documentStorage/interface';
import { transitionSubmission } from '@/lib/submissions/workflow';
import type { Submission } from '@prisma/client';

async function buildPlacement(submission: Submission): Promise<DocumentPlacementMetadata> {
  const [department, meeting] = await Promise.all([
    prisma.department.findUnique({ where: { id: submission.departmentId } }),
    submission.meetingId
      ? prisma.meeting.findUnique({ where: { id: submission.meetingId } })
      : Promise.resolve(null),
  ]);
  // TODO: a submission is always expected to have a linked meeting by the time it reaches
  // ACCEPTED/ROUTED, but fall back to createdAt rather than throw if that's ever not the case —
  // see docs/known-limitations.md.
  const meetingDate = (meeting?.meetingDate ?? submission.createdAt).toISOString();
  const fileName = submission.mainDocumentFileName ?? 'document';

  if (submission.submissionCategory === 'BOARD') {
    // Board Paper folder/file names are slugged from the *source* SMC submission's title (see
    // submitBoardPaper in review.ts), not this row's own "Board Paper: ..." title — resolve it
    // the same way here so the preview always matches where the file actually lives.
    const source = submission.smcSourceSubmissionId
      ? await prisma.submission.findUnique({ where: { id: submission.smcSourceSubmissionId } })
      : null;
    return {
      kind: 'BOARD_MAIN',
      referenceNumber: submission.referenceNumber,
      title: source?.title ?? submission.title,
      meetingDate,
      fileName,
    };
  }

  return {
    kind: 'SMC_MAIN',
    referenceNumber: submission.referenceNumber,
    title: submission.title,
    departmentName: department?.name ?? 'Unfiled',
    meetingDate,
    isLate: submission.isLate,
    fileName,
  };
}

/** Preview of where an accepted submission would be filed — used by the review screen so a
 * reviewer can "confirm or correct the proposed document destination" before routing happens. */
export async function previewRoutingDestination(submission: Submission): Promise<string> {
  const storage = getDocumentStorageProvider();
  const placement = await buildPlacement(submission);
  return storage.describeDestination(placement);
}

/**
 * Client requirement: "trigger final routing after acceptance ... record the final destination
 * and document identifiers." Confirms the destination (see docs/assumptions-and-decisions.md#A14
 * for why this doesn't physically move files — the storage provider already placed them correctly
 * by metadata at upload time) and advances ACCEPTED -> ROUTED.
 */
export async function routeAcceptedSubmission(
  submission: Submission,
  performedById: string,
): Promise<Submission> {
  const folderKey = await previewRoutingDestination(submission);
  const storage = getDocumentStorageProvider();

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: { routingFolderKey: folderKey, routedAt: new Date() },
  });

  return transitionSubmission({
    submission: updated,
    toState: 'ROUTED',
    performedById,
    comment: `Routed to ${storage.providerName} destination: ${folderKey}`,
  });
}
