// Matches AIGenerationRecord.purpose / sourceType in prisma/schema.prisma — every generation is
// persisted there with its source ids for traceability, regardless of which provider produced it.
export type AIGenerationPurpose =
  'ExecutiveSummary' | 'BoardPaperSummary' | 'CompletenessCheck' | 'AchievementGrouping';

export type AISourceType = 'Workplan' | 'Activity' | 'ManagementReport' | 'Submission';

// One cited fact-bearing record the generator may draw from. `facts` is a flat, already-stringified
// view of the fields relevant to the requested purpose (e.g. an Activity's title, percentComplete,
// latestAchievement, risksIssues) — deliberately not the raw Prisma row, so a provider can never
// pull in a field nobody intended to expose to the model.
export interface AISourceRecord {
  id: string;
  citation: string; // human-readable reference shown next to generated claims, e.g. an activity's referenceNumber
  facts: Record<string, string>;
}

export interface AIGenerationInput {
  purpose: AIGenerationPurpose;
  sourceType: AISourceType;
  sourceRecords: AISourceRecord[];
}

export interface AIGenerationOutput {
  generatedText: string;
  /** Ids of every AISourceRecord actually referenced — persisted as AIGenerationRecord.sourceIds. */
  sourceIds: string[];
}

export interface AIProvider {
  readonly providerName: 'mock' | 'internal';
  generate(input: AIGenerationInput): Promise<AIGenerationOutput>;
}
