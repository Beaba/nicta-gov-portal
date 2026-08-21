import { getEnv } from '@/lib/config/env';
import type {
  AIReviewProvider,
  AIReviewInput,
  AIReviewOutput,
  GeneratedDraft,
} from '@/lib/providers/aiReview/interface';

// Production target: NICTA's closed internal AI service, restricted to the controlled
// document-review functions listed in docs/milestone-1-plan.md (template conformance, missing
// mandatory sections, decision-paper recommendation/decision presence, placeholder detection,
// structure comparison, optional templated-draft assembly). No endpoint is reachable from this
// environment — see docs/ai-integration-contract.md for the request/response contract this must
// implement to be a drop-in replacement for MockAIReviewProvider. Fails loudly rather than
// silently degrading to mock output under a provider name that claims otherwise.
export class InternalAIReviewProvider implements AIReviewProvider {
  readonly providerName = 'internal' as const;

  private assertConfigured(): void {
    const env = getEnv();
    if (!env.INTERNAL_AI_ENDPOINT || !env.INTERNAL_AI_API_KEY) {
      throw new Error(
        'AI_PROVIDER=internal requires INTERNAL_AI_ENDPOINT, INTERNAL_AI_MODEL_NAME and ' +
          'INTERNAL_AI_API_KEY. See docs/ai-integration-contract.md.',
      );
    }
  }

  async review(_input: AIReviewInput): Promise<AIReviewOutput> {
    this.assertConfigured();
    throw new Error(
      'InternalAIReviewProvider is not implemented against a live endpoint in this build.',
    );
  }

  async generateTemplatedDraft(_input: AIReviewInput): Promise<GeneratedDraft | null> {
    this.assertConfigured();
    throw new Error(
      'InternalAIReviewProvider is not implemented against a live endpoint in this build.',
    );
  }
}
