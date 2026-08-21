import { ConfidentialClientApplication, type Configuration } from '@azure/msal-node';
import { getEnv } from '@/lib/config/env';

// See docs/entra-id-registration-guide.md for the app registration steps that produce these
// values. Throws only when actually invoked (i.e. AUTH_PROVIDER=entra) — never at import time —
// so the mock-mode app never pays for or fails on missing Entra config.
export function createMsalClient(): ConfidentialClientApplication {
  const env = getEnv();
  if (!env.AZURE_AD_TENANT_ID || !env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET) {
    throw new Error(
      'AUTH_PROVIDER=entra requires AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID and AZURE_AD_CLIENT_SECRET. ' +
        'See docs/entra-id-registration-guide.md.',
    );
  }

  const config: Configuration = {
    auth: {
      clientId: env.AZURE_AD_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}`,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
    },
  };

  return new ConfidentialClientApplication(config);
}

export const ENTRA_LOGIN_SCOPES = ['openid', 'profile', 'email', 'User.Read'];
