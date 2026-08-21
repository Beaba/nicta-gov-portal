import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  DocumentStorageProvider,
  DocumentPlacementMetadata,
  StoredDocumentMetadata,
} from '@/lib/providers/documentStorage/interface';
import { buildDocumentPathSegments } from '@/lib/providers/documentStorage/pathBuilder';

// Filesystem-backed implementation used for local development and demos, storing files under
// .data/documents/ (git-ignored) — e.g. .data/documents/Governance Papers/01_SMC_Submissions/2026/
// SMC_2026-03-15/01_On_Time/Digital_Transformation_Department/SMC-26-042_Digital-Economy-Update/
// 01_Submitted_Paper/SMC-26-042_Digital-Economy-Update.docx. The layout is computed by
// pathBuilder.ts's buildDocumentPathSegments — the exact same logic SharePointDocumentStorageProvider
// uses for describeDestination — so switching DOCUMENT_STORAGE_PROVIDER never changes where things
// "live" conceptually. The real target is SharePointDocumentStorageProvider.
const ROOT = path.join(process.cwd(), '.data', 'documents');

export class LocalDocumentStorageProvider implements DocumentStorageProvider {
  readonly providerName = 'local' as const;

  async upload(input: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    placement: DocumentPlacementMetadata;
  }): Promise<StoredDocumentMetadata> {
    const segments = buildDocumentPathSegments(input.placement);
    const storageKey = segments.join('/');

    // buildDocumentPathSegments always returns at least [library, subfolder, fileName] — the
    // `?? input.fileName` fallback only exists to satisfy noUncheckedIndexedAccess.
    const destinationFileName = segments[segments.length - 1] ?? input.fileName;
    const dir = path.join(ROOT, ...segments.slice(0, -1));
    await mkdir(dir, { recursive: true });
    const absolutePath = path.join(dir, destinationFileName);
    // A deterministic path (no random suffix) is intentional: re-uploading a main paper on
    // resubmission, or re-approving a template, replaces the file at its one canonical slot,
    // matching the client's exact hierarchy — full history is already preserved separately via
    // SubmissionVersion/Evidence rows and Template's supersedesId chain (see #A14).
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.buffer.byteLength,
      metadata: input.placement,
    };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `/api/documents/local/${encodeURIComponent(storageKey)}`;
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = path.join(ROOT, storageKey.split('/').join(path.sep));
    await unlink(absolutePath).catch(() => undefined);
  }

  describeDestination(placement: DocumentPlacementMetadata): string {
    return buildDocumentPathSegments(placement).join('/');
  }
}
