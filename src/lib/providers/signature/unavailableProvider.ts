import {
  DigitalSignatureUnavailableError,
  type DigitalSignatureProvider,
} from '@/lib/providers/signature/interface';

// The only implementation of DigitalSignatureProvider today. Every method throws — see
// interface.ts's header comment for why there is no mock that pretends to succeed.
export class UnavailableSignatureProvider implements DigitalSignatureProvider {
  readonly providerName = 'unavailable' as const;
  readonly isAvailable = false;

  async requestSignature(): Promise<never> {
    throw new DigitalSignatureUnavailableError();
  }

  async getSignatureStatus(): Promise<never> {
    throw new DigitalSignatureUnavailableError();
  }

  async validateSignature(): Promise<never> {
    throw new DigitalSignatureUnavailableError();
  }
}
