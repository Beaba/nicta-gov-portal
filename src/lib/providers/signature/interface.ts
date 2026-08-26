// #A31 — Digital Signature Provider interface. Explicitly a future module: "Do not implement fake
// signatures. Do not paste signature images onto documents. Do not claim a document is digitally
// signed unless cryptographic signing and identity verification have occurred." There is
// deliberately no mock provider that pretends to succeed (unlike every other provider interface in
// this codebase) — src/lib/providers/signature/unavailableProvider.ts is the only implementation,
// and every method throws. This interface exists so the shape is agreed now and a real
// implementation (e.g. Azure Trusted Signing, DocuSign, Adobe Sign) can be dropped in later without
// touching any caller.

export type SignerRole = 'CEO' | 'DIRECTOR' | 'MANAGER' | 'BOARD_MEMBER';

export interface SignatureRequest {
  documentStorageKey: string;
  documentVersion: number;
  signerUserId: string;
  signerRole: SignerRole;
  /** SHA-256 (or equivalent) hash of the exact bytes being signed, computed by the caller before
   * requesting a signature, so the provider can never sign different bytes than what was shown to
   * the signer. */
  documentHash: string;
}

export type SignatureValidationStatus = 'VALID' | 'INVALID' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export interface SignatureRecord {
  id: string;
  documentStorageKey: string;
  documentVersion: number;
  signerUserId: string;
  signerRole: SignerRole;
  signedAt: Date;
  /** The signing certificate's identifier/thumbprint, not the certificate bytes themselves. */
  certificateReference: string;
  documentHash: string;
  validationStatus: SignatureValidationStatus;
}

export interface DigitalSignatureProvider {
  readonly providerName: 'unavailable' | 'azure-trusted-signing' | 'docusign' | 'adobe-sign';
  readonly isAvailable: boolean;
  requestSignature(input: SignatureRequest): Promise<SignatureRecord>;
  getSignatureStatus(signatureId: string): Promise<SignatureRecord | null>;
  validateSignature(signatureId: string): Promise<SignatureValidationStatus>;
}

export class DigitalSignatureUnavailableError extends Error {
  constructor() {
    super('Digital signature is not yet available — coming in a future milestone.');
    this.name = 'DigitalSignatureUnavailableError';
  }
}
