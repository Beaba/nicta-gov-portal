import { getEnv } from '@/lib/config/env';
import { MockAIProvider } from '@/lib/providers/ai/mockProvider';
import { InternalAIProvider } from '@/lib/providers/ai/internalProvider';
import type { AIProvider } from '@/lib/providers/ai/interface';

let provider: AIProvider | undefined;

export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const env = getEnv();
  provider = env.AI_PROVIDER === 'internal' ? new InternalAIProvider() : new MockAIProvider();
  return provider;
}

export type {
  AIProvider,
  AIGenerationInput,
  AIGenerationOutput,
  AISourceRecord,
  AIGenerationPurpose,
  AISourceType,
} from '@/lib/providers/ai/interface';
