import { getEnv } from '@/lib/config/env';
import { MockAIReviewProvider } from '@/lib/providers/aiReview/mockProvider';
import { InternalAIReviewProvider } from '@/lib/providers/aiReview/internalProvider';
import type { AIReviewProvider } from '@/lib/providers/aiReview/interface';

// Reuses the AI_PROVIDER env switch already defined for the executive-summary AI provider
// (src/lib/providers/ai) — one "mock vs internal NICTA AI" decision for the whole app.
let provider: AIReviewProvider | undefined;

export function getAIReviewProvider(): AIReviewProvider {
  if (provider) return provider;
  const env = getEnv();
  provider =
    env.AI_PROVIDER === 'internal' ? new InternalAIReviewProvider() : new MockAIReviewProvider();
  return provider;
}

export type {
  AIReviewProvider,
  AIReviewInput,
  AIReviewOutput,
  AIReviewOverallResult,
  GeneratedDraft,
} from '@/lib/providers/aiReview/interface';
