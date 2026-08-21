import { prisma } from '@/lib/db/prisma';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { scanUpload } from '@/lib/providers/documentStorage/malwareScan';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import type { Template } from '@prisma/client';

/**
 * Template.category is free text (e.g. "SMCPaper", "BoardPaper", "ManagementReport" — see the
 * field's comment in schema.prisma), but the Approved NICTA Templates library only has two
 * subfolders (01_SMC_Templates / 02_Board_Templates per the client's exact hierarchy). Anything
 * not explicitly a Board category — including "ManagementReport", per the spec's own example of
 * SMC_Management_Report.docx living under 01_SMC_Templates — files under SMC.
 */
function toTemplatePlacementCategory(category: string): 'SMC' | 'BOARD' {
  return category.toUpperCase().includes('BOARD') ? 'BOARD' : 'SMC';
}

export async function listTemplates(): Promise<Template[]> {
  return prisma.template.findMany({ orderBy: [{ paperType: 'asc' }, { uploadedAt: 'desc' }] });
}

/** The Directors Submission Portal MVP's "Approved NICTA template selection" picker reads only
 * this — see docs/mvp-directors-portal-plan.md. */
export async function listActiveTemplates(): Promise<Template[]> {
  return prisma.template.findMany({ where: { isActive: true }, orderBy: { paperType: 'asc' } });
}

export async function getActiveTemplateForPaperType(paperType: string): Promise<Template | null> {
  return prisma.template.findFirst({ where: { paperType, isActive: true } });
}

/**
 * Registers a new approved template version for a paper type. Never overwrites the previous
 * approved file in place (client requirement): the prior active row for the same paperType is
 * deactivated and linked via `supersedesId`, mirroring the ActivityUpdate versioning pattern
 * already used elsewhere in this codebase — see docs/assumptions-and-decisions.md#A14.
 */
export async function uploadTemplateVersion(input: {
  code: string;
  name: string;
  description?: string;
  category: string;
  paperType: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
  uploadedById: string;
}): Promise<Template> {
  const scan = await scanUpload({
    buffer: input.buffer,
    contentType: input.contentType,
    sizeBytes: input.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new Error(
      `Template upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`,
    );
  }

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: input.buffer,
    fileName: input.fileName,
    contentType: input.contentType,
    placement: {
      kind: 'TEMPLATE',
      templateCategory: toTemplatePlacementCategory(input.category),
      fileName: input.fileName,
    },
  });

  const previousActive = await prisma.template.findFirst({
    where: { paperType: input.paperType, isActive: true },
  });

  const created = await prisma.template.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      category: input.category,
      paperType: input.paperType,
      filePath: stored.storageKey,
      isPlaceholder: false,
      isActive: true,
      version: (previousActive?.version ?? 0) + 1,
      uploadedById: input.uploadedById,
      supersedesId: previousActive?.id,
    },
  });

  if (previousActive) {
    await prisma.template.update({ where: { id: previousActive.id }, data: { isActive: false } });
  }

  await recordAuditEvent({
    userId: input.uploadedById,
    action: 'TEMPLATE_VERSION_UPLOADED',
    entityType: 'Template',
    entityId: created.id,
    previousState: previousActive
      ? { id: previousActive.id, version: previousActive.version }
      : null,
    newState: { id: created.id, version: created.version, paperType: created.paperType },
  });

  return created;
}
