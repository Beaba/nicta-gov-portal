import type {
  AIProvider,
  AIGenerationInput,
  AIGenerationOutput,
  AISourceRecord,
} from '@/lib/providers/ai/interface';

// Deterministic, template-based generator: every sentence is assembled directly from a source
// record's `facts` and cites that record's reference — nothing is invented. This is what section
// 15/16's "AI-generated content must always be traceable to source data" means in practice for an
// environment with no access to NICTA's closed internal AI service. See
// docs/assumptions-and-decisions.md and docs/ai-integration-contract.md (the contract
// InternalAIProvider must satisfy to be a drop-in replacement).
export class MockAIProvider implements AIProvider {
  readonly providerName = 'mock' as const;

  async generate(input: AIGenerationInput): Promise<AIGenerationOutput> {
    if (input.sourceRecords.length === 0) {
      return {
        generatedText: 'No source data was available to generate this summary.',
        sourceIds: [],
      };
    }

    const paragraphs = input.sourceRecords.map((record) =>
      this.describeRecord(input.purpose, record),
    );

    const heading = HEADINGS[input.purpose];
    const generatedText = [heading, '', ...paragraphs].join('\n');

    return { generatedText, sourceIds: input.sourceRecords.map((r) => r.id) };
  }

  private describeRecord(purpose: AIGenerationInput['purpose'], record: AISourceRecord): string {
    const factLine = Object.entries(record.facts)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${splitCamelCase(key)}: ${value}`)
      .join('; ');

    const prefix = purpose === 'CompletenessCheck' ? 'Checked' : 'Reported';
    return `- ${prefix} for ${record.citation} — ${factLine || 'no populated fields'}. [Source: ${record.citation}]`;
  }
}

const HEADINGS: Record<AIGenerationInput['purpose'], string> = {
  ExecutiveSummary: 'Executive Summary (auto-generated from source records, mock AI mode)',
  BoardPaperSummary: 'Board Paper Summary (auto-generated from source records, mock AI mode)',
  CompletenessCheck: 'Completeness Check (auto-generated from source records, mock AI mode)',
  AchievementGrouping: 'Key Achievements (auto-generated from source records, mock AI mode)',
};

function splitCamelCase(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
