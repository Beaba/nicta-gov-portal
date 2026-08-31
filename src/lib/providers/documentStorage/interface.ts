export interface StoredDocumentMetadata {
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** The placement this file was filed under — kept alongside the storage key so callers can see
   * how the destination was derived without recomputing it. */
  metadata: DocumentPlacementMetadata;
}

/**
 * Which slot in the NICTA Governance Portal folder hierarchy a file belongs to. Drives both the
 * folder path AND the canonical destination file name computed by
 * src/lib/providers/documentStorage/pathBuilder.ts — callers never construct paths themselves,
 * they just describe *what* the file is via DocumentPlacementMetadata below.
 *
 *   TEMPLATE            Approved NICTA Templates/{01_SMC_Templates|02_Board_Templates}/{fileName}
 *   SMC_MAIN            Governance Papers/01_SMC_Submissions/.../{ref}_{slug}/01_Submitted_Paper/
 *                          {DeptFolder}_{meetingDate}_{meetingNumber}_{ref}_{slug}.ext
 *   SMC_ANNEXURE        .../{ref}_{slug}/02_Annexures/
 *                          {DeptFolder}_{meetingDate}_{meetingNumber}_{ref}_ANNEX-{A,B,...}.ext
 *   SMC_REVIEWED_OUTPUT .../{ref}_{slug}/03_Reviewed_Output/   (AI-generated/reviewer output)
 *                          {DeptFolder}_{meetingDate}_{meetingNumber}_{ref}_Reviewed.ext
 *   BOARD_MAIN          Governance Papers/02_Board_Papers/.../{ref}_{slug}/01_Board_Paper/
 *                          {DeptFolder}_{meetingDate}_{meetingNumber}_{ref}_{slug}.ext
 *   BOARD_ANNEXURE      .../{ref}_{slug}/02_Annexures/          (carried over from the SMC source)
 *                          {DeptFolder}_{meetingDate}_{meetingNumber}_{ref}_ANNEX-{A,B,...}.ext
 *   BOARD_SMC_SOURCE    .../{ref}_{slug}/03_SMC_Source/Source-Reference.txt (fixed name, verbatim)
 *   BOARD_MINUTES       Governance Papers/02_Board_Papers/{year}/BOARD_{meetingDate}/02_Minutes/
 *                          {DeptFolder-less: meetingNumber}_{meetingDate}_Minutes_v{n}.ext (#A30)
 *
 * The {DeptFolder}_{meetingDate}_{meetingNumber}_ file-name prefix (department name, SMC/Board
 * meeting date, and "sitting number" — the client's own file-naming requirement) is distinct from
 * the *folder* path above, which already encodes department/date/on-time-vs-late its own way;
 * {ref}_{slug} stays as the folder name for readability and to guarantee no two submissions'
 * folders collide. See docs/assumptions-and-decisions.md#A22.
 */
export type DocumentPlacementKind =
  | 'TEMPLATE'
  | 'SMC_MAIN'
  | 'SMC_ANNEXURE'
  | 'SMC_REVIEWED_OUTPUT'
  | 'BOARD_MAIN'
  | 'BOARD_ANNEXURE'
  | 'BOARD_SMC_SOURCE'
  | 'BOARD_MINUTES'
  | 'SEMC_MINUTES';

/**
 * Provider-agnostic description of where one file belongs — both DocumentStorageProvider
 * implementations (local and SharePoint) consume this exact same shape and compute the identical
 * logical folder path from it (see pathBuilder.ts's buildDocumentPathSegments). Deliberately a
 * plain interface rather than a discriminated union: only the fields relevant to `kind` need to be
 * set (see the per-kind list on DocumentPlacementKind above); pathBuilder.ts validates at runtime
 * that the fields a given kind needs are actually present.
 */
export interface DocumentPlacementMetadata {
  kind: DocumentPlacementKind;

  /** Submission.referenceNumber, or the Board Paper's own referenceNumber (e.g. "SMC-26-042",
   * "BP-26-020") — read verbatim, whatever format referenceNumber.ts currently produces. Required
   * for every kind except TEMPLATE. */
  referenceNumber?: string;
  /** Submission.title (the *source* SMC submission's title for Board-Paper kinds — see
   * submitBoardPaper in review.ts) — slugified via pathBuilder's slugifyTitle() into the folder
   * and file name. Required for every kind except TEMPLATE. */
  title?: string;
  /** Department.name, read live from the DB (never a hardcoded name -> folder table) — spaces
   * become underscores. Drives the {DepartmentFolder} *folder* segment for SMC_* kinds only
   * (Board Papers file directly under the meeting with no department subfolder, per the client's
   * exact hierarchy) — but drives the destination *file* name prefix for every kind except
   * TEMPLATE/BOARD_SMC_SOURCE, including BOARD_MAIN/BOARD_ANNEXURE (the client: "documents are
   * named based on the Department Name, SMC Date, SMC Board Sitting number"), via the Board
   * Paper's own department (inherited from its source SMC submission). Required for every kind
   * except TEMPLATE and BOARD_SMC_SOURCE. */
  departmentName?: string;
  /** The linked Meeting.meetingDate as an ISO string — drives the {year} and {meetingDate}
   * folder segments. Required for every kind except TEMPLATE. When a submission has no linked
   * meeting yet, call sites fall back to another date (e.g. submission.createdAt.toISOString()) —
   * see the TODOs at each call site and docs/known-limitations.md. */
  meetingDate?: string;
  /** The linked Meeting.meetingNumber (e.g. "SMC-2026-03") — the client's "SMC/Board Sitting
   * number." Folded into the destination FILE name (not the folder path, which already encodes
   * department/date) alongside departmentName and meetingDate — see pathBuilder's
   * documentFileNamePrefix. Required for every kind except TEMPLATE. */
  meetingNumber?: string;
  /** Submission.isLate — only consulted for SMC_* kinds, to choose 01_On_Time vs
   * 02_Late_Submissions. Defaults to false (on-time) if omitted. */
  isLate?: boolean;
  /** Which Approved NICTA Templates subfolder to file into — only used by kind: 'TEMPLATE'.
   * Defaults to 'SMC' if omitted. */
  templateCategory?: 'SMC' | 'BOARD';
  /** 0-based upload order within the submission's/board paper's annexure set, converted to a
   * letter (0 -> A, 1 -> B, ...) for the "_ANNEX-{letter}" file name suffix. Only used by
   * SMC_ANNEXURE/BOARD_ANNEXURE. */
  annexureOrder?: number;
  /** MeetingMinutes.version — folded into the destination file name so re-uploaded draft/final
   * versions never collide. Only used by BOARD_MINUTES; defaults to 1 if omitted. */
  version?: number;
  /** The file being filed. Its extension is preserved into the computed canonical destination
   * name for every kind except TEMPLATE and BOARD_SMC_SOURCE, which use this value verbatim as
   * the destination file name (the template's own approved file name, or "Source-Reference.txt"
   * respectively). Always required. */
  fileName: string;
}

export interface DocumentStorageProvider {
  readonly providerName: 'local' | 'sharepoint';
  upload(input: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    placement: DocumentPlacementMetadata;
  }): Promise<StoredDocumentMetadata>;
  getDownloadUrl(storageKey: string): Promise<string>;
  delete(storageKey: string): Promise<void>;
  /**
   * Computes the folder path/identifier a set of files with this placement would be filed under,
   * without uploading anything. Pure and synchronous by contract — never requires live credentials
   * — so a reviewer can see and confirm "where this will go" (Milestone 1 document-routing
   * requirement) before routing actually happens, even in mock mode.
   */
  describeDestination(placement: DocumentPlacementMetadata): string;
}
