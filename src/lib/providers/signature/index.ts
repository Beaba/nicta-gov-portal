import { UnavailableSignatureProvider } from '@/lib/providers/signature/unavailableProvider';
import type { DigitalSignatureProvider } from '@/lib/providers/signature/interface';

let provider: DigitalSignatureProvider | undefined;

// No env-var switch yet (unlike the other provider factories) — there is exactly one
// implementation until a real signing provider is selected and configured.
export function getDigitalSignatureProvider(): DigitalSignatureProvider {
  if (provider) return provider;
  provider = new UnavailableSignatureProvider();
  return provider;
}

export type {
  DigitalSignatureProvider,
  SignatureRequest,
  SignatureRecord,
  SignatureValidationStatus,
  SignerRole,
} from '@/lib/providers/signature/interface';
export { DigitalSignatureUnavailableError } from '@/lib/providers/signature/interface';
