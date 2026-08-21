// Input is a deliberately narrow, already-validated view of a submission's fields — never the raw
// Prisma row and never the uploaded file's bytes reinterpreted as fact — so a provider can only
// ever report on what the submitter actually entered or attached. This is what keeps the "AI must
// not invent facts, figures, decisions or recommendations" and "must not transmit documents to
// public AI services" constraints structurally true rather than just documented.
export interface AIReviewInput {
  submissionId: string;
  paperType: string;
  title: string;
  purpose: string | null;
  recommendation: string | null;
  proposedDecision: string | null;
  executiveSummary: string | null;
  mainDocumentFileName: string;
  mainDocumentContentType: string;
  templateName: string | null;
}

export type AIReviewOverallResult = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface AIReviewOutput {
  overallResult: AIReviewOverallResult;
  missingSections: string[];
  warnings: string[];
  suggestedCorrections: string[];
  sourceReferences: string[];
  modelIdentifier: string | null;
}

export interface GeneratedDraft {
  buffer: Buffer;
  fileName: string;
}

export interface AIReviewProvider {
  readonly providerName: 'mock' | 'internal';
  /** Advisory only — never approves/rejects. The caller persists this as an AIReviewResult row
   * and always still routes the submission to human secretariat review regardless of the result. */
  review(input: AIReviewInput): Promise<AIReviewOutput>;
  /**
   * Optional templated draft assembled only from fields present on `input`. Returns null when the
   * provider has no draft-generation capability or there is not enough source content to build
   * one — never fabricates content to fill the gap. The original uploaded file is never touched or
   * replaced by this; callers must store the result as a distinctly-marked additional file.
   */
  generateTemplatedDraft(input: AIReviewInput): Promise<GeneratedDraft | null>;
}
