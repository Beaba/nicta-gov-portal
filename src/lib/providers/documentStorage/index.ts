import { getEnv } from '@/lib/config/env';
import { LocalDocumentStorageProvider } from '@/lib/providers/documentStorage/localProvider';
import { SharePointDocumentStorageProvider } from '@/lib/providers/documentStorage/sharepointProvider';
import type { DocumentStorageProvider } from '@/lib/providers/documentStorage/interface';

// The one place a concrete provider is chosen. Route handlers and domain code import
// getDocumentStorageProvider() from here, never a concrete provider class.
let provider: DocumentStorageProvider | undefined;

export function getDocumentStorageProvider(): DocumentStorageProvider {
  if (provider) return provider;
  const env = getEnv();
  provider =
    env.DOCUMENT_STORAGE_PROVIDER === 'sharepoint'
      ? new SharePointDocumentStorageProvider()
      : new LocalDocumentStorageProvider();
  return provider;
}

export type {
  DocumentStorageProvider,
  DocumentPlacementMetadata,
  StoredDocumentMetadata,
} from '@/lib/providers/documentStorage/interface';
