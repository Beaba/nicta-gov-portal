import type {
  AIProvider,
  AIGenerationInput,
  AIGenerationOutput,
} from '@/lib/providers/ai/interface';
import { getEnv } from '@/lib/config/env';

// Production target: NICTA's closed internal AI service. No endpoint is reachable from this
// environment, so this class only documents the contract (see docs/ai-integration-contract.md)
// and fails loudly if actually invoked without configuration, rather than silently degrading to
// mock output under a provider name that claims otherwise.
//
// Intended request: POST {INTERNAL_AI_ENDPOINT} with { model: INTERNAL_AI_MODEL_NAME, purpose,
// sourceType, sourceRecords } and an Authorization header carrying INTERNAL_AI_API_KEY; expected
// response: { generatedText: string, citedSourceIds: string[] }. The citedSourceIds contract
// matters as much as the text — section 15/16 traceability requires the app to persist exactly
// which source records the model says it used, not merely which ones it was given.
export class InternalAIProvider implements AIProvider {
  readonly providerName = 'internal' as const;

  async generate(_input: AIGenerationInput): Promise<AIGenerationOutput> {
    const env = getEnv();
    if (!env.INTERNAL_AI_ENDPOINT || !env.INTERNAL_AI_API_KEY) {
      throw new Error(
        'AI_PROVIDER=internal requires INTERNAL_AI_ENDPOINT, INTERNAL_AI_MODEL_NAME and ' +
          'INTERNAL_AI_API_KEY. See docs/ai-integration-contract.md.',
      );
    }
    throw new Error('InternalAIProvider is not implemented against a live endpoint in this build.');
  }
}
