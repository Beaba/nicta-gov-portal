import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import type {
  AIReviewProvider,
  AIReviewInput,
  AIReviewOutput,
  GeneratedDraft,
} from '@/lib/providers/aiReview/interface';

const WORD_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// Deterministic, rule-based checker — no external call, no invented findings. The reference
// design's submission flow (docs/mvp-directors-portal-plan.md) collects only a title, an approved
// template, and the uploaded file — no separate typed purpose/recommendation/proposed-decision
// fields — so this mock has no document text to inspect (no parser is wired up; see
// docs/known-limitations.md) and must not claim to have checked something it didn't. Where a real
// internal AI service would read the uploaded document's actual content, this mock can only verify
// what's mechanically checkable (file type, template selection, title) and reports the rest as
// warnings asking a human to confirm, never as a false "missing" claim about content it never saw.
// See docs/ai-integration-contract.md for the contract InternalAIProvider must satisfy to be a
// drop-in replacement with a real closed AI service that *can* read the document.
export class MockAIReviewProvider implements AIReviewProvider {
  readonly providerName = 'mock' as const;

  async review(input: AIReviewInput): Promise<AIReviewOutput> {
    const missingSections: string[] = [];
    const warnings: string[] = [];
    const suggestedCorrections: string[] = [];
    const sourceReferences: string[] = [];

    if (!WORD_CONTENT_TYPES.has(input.mainDocumentContentType)) {
      missingSections.push('Valid Word document');
      suggestedCorrections.push(
        `Main document "${input.mainDocumentFileName}" is not a Word document (.docx/.doc) — upload the paper in the approved format.`,
      );
    } else {
      sourceReferences.push(`Document format: ${input.mainDocumentFileName}`);
    }

    if (input.templateName) {
      sourceReferences.push(`Checked against approved template: ${input.templateName}`);
    }

    if (/\[.*?\]|TBD|TO BE (CONFIRMED|ADVISED)|XXX/i.test(input.title)) {
      warnings.push(`Title "${input.title}" appears to contain an unresolved placeholder.`);
    }

    const typedFields: { label: string; value: string | null }[] = [
      { label: 'Purpose / Description', value: input.purpose },
      { label: 'Executive Summary', value: input.executiveSummary },
      ...(isDecisionPaper(input.paperType)
        ? [
            { label: 'Recommendation', value: input.recommendation },
            { label: 'Proposed Decision', value: input.proposedDecision },
          ]
        : []),
    ];
    for (const field of typedFields) {
      if (field.value && field.value.trim().length > 0) {
        sourceReferences.push(field.label);
      } else {
        warnings.push(
          `${field.label} was not provided as structured text — mock review mode cannot inspect the uploaded document's contents, so a reviewer should manually confirm this section is present.`,
        );
      }
    }

    const overallResult: AIReviewOutput['overallResult'] =
      missingSections.length > 0 ? 'FAIL' : warnings.length > 0 ? 'PASS_WITH_WARNINGS' : 'PASS';

    return {
      overallResult,
      missingSections,
      warnings,
      suggestedCorrections,
      sourceReferences,
      modelIdentifier: null,
    };
  }

  async generateTemplatedDraft(input: AIReviewInput): Promise<GeneratedDraft | null> {
    const sections: { heading: string; content: string | null }[] = [
      { heading: 'Purpose', content: input.purpose },
      { heading: 'Executive Summary', content: input.executiveSummary },
      ...(isDecisionPaper(input.paperType)
        ? [
            { heading: 'Recommendation', content: input.recommendation },
            { heading: 'Proposed Decision', content: input.proposedDecision },
          ]
        : []),
    ];

    // Nothing to assemble a draft from — return null rather than emitting an empty shell.
    if (sections.every((s) => !s.content)) return null;

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `AI-GENERATED DRAFT — assembled only from the submitter's own text (mock AI mode). Not the source document. Requires human review before use.`,
                  italics: true,
                }),
              ],
            }),
            ...sections.flatMap((s) => [
              new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: s.content ?? '[Not provided in source submission]' }),
            ]),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return { buffer, fileName: `${input.submissionId}-generated-draft.docx` };
  }
}
