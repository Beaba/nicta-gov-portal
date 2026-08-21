// Standalone script — not part of the Next.js app — that provisions the 4 NICTA Portal Microsoft
// Entra ID / SharePoint security groups via Microsoft Graph's `POST /groups` endpoint. Run with:
//
//   npx tsx scripts/provision-graph-security-groups.ts
//
// (same invocation style `package.json`'s "db:seed" uses for `tsx prisma/seed.ts`; also wired up
// as `npm run provision:graph-groups`.)
//
// Production target, not implemented against a real tenant (none is available in this
// environment) — throws a clear, actionable error naming exactly what's missing if actually
// invoked without configuration, and throws again (a fixed "not implemented" message) if
// configuration IS present, since the real Graph call chain was never wired up against a live
// tenant to verify it. This is the same "honest, credential-gated stub" idiom used elsewhere in
// this codebase for real-tenant-dependent features — see
// src/lib/providers/documentStorage/sharepointProvider.ts's `assertConfigured()` +
// "not implemented against a live tenant in this build" and
// src/lib/providers/notifications/graphProvider.ts (identical shape, one Graph capability each).
//
// See docs/graph-security-groups-guide.md for full context: what these 4 groups are for, why
// they do NOT drive in-app authorization (that's entirely DB-driven — see
// docs/assumptions-and-decisions.md#A4), and the manual (Azure/Entra portal) fallback for
// provisioning them before this script can be run for real.
//
// --- Intended Microsoft Graph call, once configured -------------------------------------------
//
// Once GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID are set (see .env.example and
// docs/entra-id-registration-guide.md for how an app registration with the Group.ReadWrite.All
// application permission is produced), a real implementation would, once per group:
//
//   1. Acquire an app-only (client credentials) token — no interactive user involved:
//        const msal = new ConfidentialClientApplication({
//          auth: {
//            clientId: GRAPH_CLIENT_ID,
//            clientSecret: GRAPH_CLIENT_SECRET,
//            authority: `https://login.microsoftonline.com/${GRAPH_TENANT_ID}`,
//          },
//        });
//        const { accessToken } = await msal.acquireTokenByClientCredential({
//          scopes: ['https://graph.microsoft.com/.default'],
//        });
//
//   2. POST https://graph.microsoft.com/v1.0/groups
//        Authorization: Bearer <accessToken>
//        Content-Type: application/json
//
//        {
//          "displayName": "NICTA-Portal-Directors",
//          "mailNickname": "NICTA-Portal-Directors",
//          "mailEnabled": false,
//          "securityEnabled": true,
//          "description": "<one-line purpose — see GROUP_DEFINITIONS below>"
//        }
//
//   3. On 201 Created, log the returned `id` (GUID) against the group's displayName so the admin
//      running this has a durable record of what was created.
//   4. On failure for one group (e.g. 400 Request_BadRequest because a group with the same
//      mailNickname already exists), log the error and continue to the remaining groups rather
//      than aborting the whole run — this script does NOT check for an existing group first (no
//      GET /groups?$filter=... idempotency check), so re-running it against a tenant that already
//      has these groups will attempt to create duplicates. Add that check before running it twice
//      against the same real tenant.
//
// -------------------------------------------------------------------------------------------

import { SEED_ROLES, type RoleCode } from '../src/lib/config/roles';

// Deliberately read directly from process.env rather than through src/lib/config/env.ts's
// getEnv(): this script provisions Entra ID groups and has nothing to do with the app's DB/session
// configuration that getEnv() also validates (DATABASE_URL, SESSION_SECRET) — coupling this
// script's "are my Graph credentials set" check to those unrelated required vars would surface a
// confusing first error about the database when someone is only trying to check Graph readiness.
// Matches prisma/seed.ts's own precedent of a standalone script reading what it needs directly.
// tsx loads .env automatically (same as it does for `npm run db:seed` -> `tsx prisma/seed.ts`), so
// this still picks up real values the same way the rest of local dev does.
interface GraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

function assertConfigured(): GraphCredentials {
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const tenantId = process.env.GRAPH_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    const missing = [
      !clientId ? 'GRAPH_CLIENT_ID' : null,
      !clientSecret ? 'GRAPH_CLIENT_SECRET' : null,
      !tenantId ? 'GRAPH_TENANT_ID' : null,
    ].filter((name): name is string => name !== null);

    throw new Error(
      `Cannot provision Entra ID security groups: missing ${missing.join(', ')}. This is expected ` +
        'until a NICTA Microsoft 365 admin has registered (or reused) a Graph app registration with ' +
        'the Group.ReadWrite.All application permission granted, and a developer has set these ' +
        'values in .env (never .env.example, which stays a template). ' +
        'See docs/graph-security-groups-guide.md for the full walkthrough, and ' +
        'docs/entra-id-registration-guide.md for the general app-registration steps it builds on.',
    );
  }

  return { clientId, clientSecret, tenantId };
}

interface GroupDefinition {
  /** Exact display name for the Microsoft 365 tenant — an external-facing identifier, so this is
   *  the client's literal spelling (including "Secretariate"), not a corrected one. */
  displayName: string;
  /** One-line purpose, becomes the Graph group's `description`. */
  description: string;
  /** Cross-reference only — see src/lib/config/roles.ts's SEED_ROLES. Graph group membership does
   *  not drive in-app authorization (docs/assumptions-and-decisions.md#A4); this is purely so this
   *  script's output states which portal role each group mirrors. */
  roleCode: RoleCode;
}

// The 4 groups requested for NICTA's own Microsoft 365 tenant. See
// docs/graph-security-groups-guide.md for the full role-mapping table and rationale.
const GROUP_DEFINITIONS: GroupDefinition[] = [
  {
    displayName: 'NICTA-Portal-Directors',
    description: 'NICTA Portal Directors: submit papers and view status/resolutions.',
    roleCode: 'SUBMITTER',
  },
  {
    displayName: 'NICTA-Portal-Corporate-Secretariate',
    description:
      'NICTA Portal Corporate Secretariat: reviews papers and templates, pushes out notifications.',
    roleCode: 'REVIEWER_SECRETARIAT',
  },
  {
    displayName: 'NICTA-Portal-CEO',
    description: 'NICTA Portal CEO: views papers, makes comments.',
    roleCode: 'EXECUTIVE_VIEWER',
  },
  {
    displayName: 'NICTA-Portal-Administrators',
    description: 'NICTA Portal Administrators: add users to groups and update templates etc.',
    roleCode: 'SYSTEM_ADMIN',
  },
];

interface GraphGroupPayload {
  displayName: string;
  mailNickname: string;
  mailEnabled: false;
  securityEnabled: true;
  description: string;
}

// Graph's mailNickname must be unique tenant-wide, <= 64 characters, and must not contain
// @()\[\]";:<>, or spaces. These 4 display names are already clean (letters/digits/hyphens only),
// so this is an identity transform in practice — written as a real function rather than reused
// verbatim so a future group whose display name doesn't fit those rules is still handled
// correctly instead of silently POSTed with an invalid value.
function toMailNickname(displayName: string): string {
  return displayName.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
}

function toGraphGroupPayload(def: GroupDefinition): GraphGroupPayload {
  return {
    displayName: def.displayName,
    mailNickname: toMailNickname(def.displayName),
    mailEnabled: false,
    securityEnabled: true,
    description: def.description,
  };
}

// The actual Microsoft Graph call. Not implemented against a live tenant in this build — see the
// header comment for the exact intended request. Always throws, same idiom as
// SharePointDocumentStorageProvider's methods and GraphNotificationProvider.notify() (both throw
// unconditionally past their own config check, for the same reason: nothing here has ever been
// run against a real Microsoft 365 tenant, and pretending otherwise would be worse than an honest
// stub).
async function createSecurityGroup(
  _credentials: GraphCredentials,
  _payload: GraphGroupPayload,
): Promise<{ id: string }> {
  throw new Error(
    'createSecurityGroup() is not implemented against a live Microsoft Graph tenant in this build ' +
      '— see the header comment in this file for the exact intended request, and ' +
      'docs/graph-security-groups-guide.md for how to create the 4 groups manually in the Azure/' +
      'Entra portal (Groups blade) in the interim.',
  );
}

async function main(): Promise<void> {
  const credentials = assertConfigured();

  console.log(
    `GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID are configured. Provisioning ` +
      `${GROUP_DEFINITIONS.length} Entra ID security groups via Microsoft Graph...\n`,
  );

  const results: { displayName: string; ok: boolean; id?: string; error?: string }[] = [];

  for (const def of GROUP_DEFINITIONS) {
    const payload = toGraphGroupPayload(def);
    const role = SEED_ROLES.find((r) => r.code === def.roleCode);
    console.log(
      `- ${payload.displayName} (mailNickname: ${payload.mailNickname}) -> role ${def.roleCode}` +
        (role ? ` ("${role.name}")` : ''),
    );
    try {
      const created = await createSecurityGroup(credentials, payload);
      results.push({ displayName: payload.displayName, ok: true, id: created.id });
    } catch (err) {
      results.push({
        displayName: payload.displayName,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('\nSummary:');
  for (const r of results) {
    const detail = r.ok ? `id: ${r.id}` : r.error;
    console.log(
      `  ${r.ok ? 'created' : 'FAILED'}: ${r.displayName}${detail ? ` — ${detail}` : ''}`,
    );
  }

  if (results.some((r) => !r.ok)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
