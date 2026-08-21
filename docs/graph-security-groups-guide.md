# NICTA Portal Security Groups — Microsoft Graph Provisioning Guide

How to create the 4 NICTA-Portal-* Microsoft Entra ID (Azure AD) security groups in NICTA's own
Microsoft 365 tenant, and run `scripts/provision-graph-security-groups.ts` against Microsoft Graph
to create them automatically instead of by hand. See `docs/assumptions-and-decisions.md#A4` for why
this app's actual authorization is entirely database-driven and does not depend on these groups —
read that section before assuming group membership controls anything inside the portal.

This is a two-part job, same split as `docs/entra-id-registration-guide.md`:

- **Part A** is done once by a NICTA Microsoft 365 administrator, entirely inside the Azure/Entra
  portal. It produces an app registration with permission to create groups.
- **Part B** is done by a developer, inside this repository, using the values from Part A. It does
  not require Azure access.

## Current status in this environment

No real Microsoft 365/Entra tenant credentials exist in this environment (per `CLAUDE.md`: the app
must run end-to-end in mock mode with zero tenant credentials). `scripts/provision-graph-security-
groups.ts` is written and ready, but:

- It has never been run against a real tenant, so it cannot actually create these groups today.
- Running it now (`npm run provision:graph-groups`) will exit immediately with an error explaining
  that `GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET`/`GRAPH_TENANT_ID` are not set — that is expected,
  correct behavior, not a bug.
- Even once those are set, the script's actual Microsoft Graph `POST /groups` call is deliberately
  left as a documented stub (see the header comment in the script) rather than a call chain that
  was never exercised against a live tenant — it throws a clear "not implemented against a live
  tenant in this build" message instead of pretending to have created anything. This is the same
  pattern already used by `src/lib/providers/documentStorage/sharepointProvider.ts` and
  `src/lib/providers/notifications/graphProvider.ts` for the same underlying reason.

Until a NICTA Microsoft 365 admin completes Part A, **create the 4 groups by hand** in the
Azure/Entra portal (Groups blade → New group) using the table below — there's no functional
dependency on the script; it only saves re-typing the same 4 groups by hand later or across
multiple tenants (e.g. a test tenant then production).

## The 4 groups

| Group name (exact, tenant-facing)     | Purpose                                                      | Portal role code       | Portal role display name |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------------------ |
| `NICTA-Portal-Directors`              | Submit papers and view status/resolutions                    | `SUBMITTER`            | Director                 |
| `NICTA-Portal-Corporate-Secretariate` | Reviews papers and templates, pushes out notifications       | `REVIEWER_SECRETARIAT` | Corporate Secretary      |
| `NICTA-Portal-CEO`                    | Views papers, makes comments                                 | `EXECUTIVE_VIEWER`     | CEO / Executive Viewer   |
| `NICTA-Portal-Administrators`         | Administrators add users to groups and update templates etc. | `SYSTEM_ADMIN`         | System Administrator     |

Note the spelling of the second group: **`Corporate-Secretariate`**, not the more standard
"Secretariat". This is the client's own naming for this external-facing Microsoft 365 identifier,
kept verbatim — it does not need to (and does not) match this app's own display copy, which
correctly spells the role "Corporate Secretary" / "Secretariat" (`src/lib/config/roles.ts`'s
`SEED_ROLES[1].name`, per `docs/assumptions-and-decisions.md#A18`). Do not "fix" the group name's
spelling if you're provisioning it by hand or editing the script — the mismatch is intentional.

All 4 groups: `mailEnabled: false`, `securityEnabled: true` (a pure security group, not a
Microsoft 365/mail-enabled group — no shared mailbox or Outlook group behavior is wanted here).

## What these groups are — and are not — for

**They do not drive in-app authorization.** This app's RBAC is entirely database-driven: a user's
permissions come from their `UserRole` rows joining to the `Role` table, checked by the stable
`Role.code` values above (`src/lib/auth/rbac.ts`), independent of any Microsoft 365 group. See
`docs/assumptions-and-decisions.md#A4` for the full reasoning — in short, `Role`/`Department` are
admin-editable reference data rather than hardcoded enums specifically so this app never needs a
live Microsoft Graph call in the request path just to answer "can this user do X." Nothing in this
codebase reads Entra group membership to make an authorization decision, and that shouldn't change
without a new, explicit design decision (record it in `docs/assumptions-and-decisions.md` if it
ever does).

**What they're for instead**: NICTA's own Microsoft 365 tenant-side visibility and management —
the organization's own admins being able to see "who's a Director" or "who's a Corporate
Secretary" in Outlook address lists, SharePoint site/library permissions, Microsoft 365 admin
center people-management screens, and similar tooling that only understands Entra ID groups, not
this app's database. Think of them as a **parallel, tenant-side mirror** of the 4 portal roles
those groups correspond to — not a second source of truth and not a replacement for the
`Role`/`UserRole` tables. Whoever manages the two should keep membership roughly in sync by hand
(or by process) — this script does not, and is not intended to, read this app's database and sync
group membership automatically.

## Prerequisites

- A person with **Global Administrator**, **Application Administrator**, or **Cloud Application
  Administrator** role in NICTA's Microsoft 365 tenant — same requirement as
  `docs/entra-id-registration-guide.md`'s Part A. Regular user accounts cannot create app
  registrations or grant admin consent for application permissions.
- Access to https://portal.azure.com ("Microsoft Entra ID" in the left nav) or
  https://entra.microsoft.com directly.

## Part A — Grant an app registration permission to create groups (Microsoft 365 admin)

### 1. Decide which app registration to use

If NICTA already has a Graph app registration for another server-side capability in this app —
`DOCUMENT_STORAGE_PROVIDER=sharepoint` or `KANBAN_PROVIDER=microsoft-lists`, both of which also
read `GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET`/`GRAPH_TENANT_ID` — **reuse that same app
registration**. Adding one more application permission to an existing registration is simpler and
means one fewer client secret to track and rotate. Skip to step 2.

Otherwise, register a new one:

1. **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name**: something identifiable, e.g. `NICTA Portal — Microsoft Graph (server-side)`.
3. **Supported account types**: **Accounts in this organizational directory only (NICTA only —
   Single tenant)** — same reasoning as `docs/entra-id-registration-guide.md` step 1.
4. **Redirect URI**: leave blank. This app registration is only ever used for unattended,
   app-only (client credentials) calls — there is no interactive sign-in involved, so no redirect
   URI is needed.
5. Click **Register**, then note the **Application (client) ID** and **Directory (tenant) ID** from
   the Overview page — these become `GRAPH_CLIENT_ID` and `GRAPH_TENANT_ID` in Part B.

### 2. Add the Group.ReadWrite.All application permission

1. Open the app registration (new or reused) → **API permissions** → **Add a permission**.
2. **Microsoft Graph** → **Application permissions** (not Delegated — this script runs unattended,
   with no signed-in user, so it authenticates as the app itself).
3. Search for and select **`Group.ReadWrite.All`**, then **Add permissions**.
4. Click **Grant admin consent for [tenant]**. This step is mandatory for application permissions
   — unlike some delegated permissions, they can never be self-consented by an end user, and
   `POST /groups` will fail with `Authorization_RequestDenied` until this is done.

If NICTA's security policy prefers a narrower permission than `Group.ReadWrite.All` (which also
allows reading and modifying _any_ group in the tenant, not just these 4), that's a reasonable
thing to tighten later — Microsoft Graph does not currently offer a permission scoped to "create
groups only," so `Group.ReadWrite.All` is the minimal built-in option for this specific operation.

### 3. Create (or reuse) a client secret

If you reused an existing app registration in step 1 that already has a live client secret, you
can reuse that same secret value — skip to Part B. Otherwise: **Certificates & secrets** →
**Client secrets** → **New client secret**, same process as
`docs/entra-id-registration-guide.md` step 4. Copy the secret value immediately — it's shown only
once. This becomes `GRAPH_CLIENT_SECRET`.

### 4. Hand off the three values

| Value                   | Where it came from              |
| ----------------------- | ------------------------------- |
| Directory (tenant) ID   | Overview page (step 1)          |
| Application (client) ID | Overview page (step 1)          |
| Client secret value     | Certificates & secrets (step 3) |

Send the secret value through a secure channel (password manager share), not plain email/chat.

## Part B — Running the script (developer)

### 5. Set environment variables

In `.env` (never `.env.example`):

```
GRAPH_CLIENT_ID="<Application (client) ID from step 1>"
GRAPH_CLIENT_SECRET="<client secret value from step 3>"
GRAPH_TENANT_ID="<Directory (tenant) ID from step 1>"
```

These are the same three variables `.env.example` already documents for
`DOCUMENT_STORAGE_PROVIDER=sharepoint` / `KANBAN_PROVIDER=microsoft-lists` — there is deliberately
no separate `GRAPH_GROUPS_*` set of variables. If those are already set for one of those other
capabilities and the app registration they point at was granted `Group.ReadWrite.All` in Part A,
nothing further needs adding to `.env`.

### 6. Run the script

```
npm run provision:graph-groups
```

(equivalently: `npx tsx scripts/provision-graph-security-groups.ts`).

- **If the three variables above are not set**, the script exits immediately with an error naming
  exactly which ones are missing and pointing back at this guide. It does not attempt any network
  call in this case.
- **If they are set**, the script logs the 4 groups it would create (name, derived `mailNickname`,
  and which portal role each corresponds to), then attempts the actual Microsoft Graph call — which
  currently always fails with a "not implemented against a live tenant in this build" message (see
  `scripts/provision-graph-security-groups.ts`'s header comment for exactly what a finished
  implementation would send). Wiring up the real `POST /groups` call, once there's an actual tenant
  to verify it against, means replacing the body of that script's `createSecurityGroup()` function
  with the request already fully documented in its header comment — the request shape shouldn't
  need to change, only actually issuing it.
- The script is **not idempotent**: it doesn't check whether a group already exists before
  creating one. Re-running it against a tenant that already has these 4 groups (once the real call
  is wired up) will attempt to create duplicates. Check the Groups blade first, or add a
  `GET /groups?$filter=displayName eq '...'` existence check before extending this script.

### 7. Confirm in the Entra/Azure portal

**Microsoft Entra ID** → **Groups** should show all 4 `NICTA-Portal-*` groups, each
`Security` type, mail-disabled. Membership itself is managed by NICTA's own admins from here (or
from the app registration's `Group.ReadWrite.All` permission, for anyone automating it further) —
this app has no UI for managing Entra group membership and does not need one, per the "what these
groups are not for" section above.

## Troubleshooting

- **`Authorization_RequestDenied`** — admin consent wasn't granted for `Group.ReadWrite.All` (Part
  A, step 2), or the wrong app registration's credentials are in `.env`. Confirm in **API
  permissions** that `Group.ReadWrite.All` shows a green "Granted for [tenant]" status.
- **`Request_BadRequest` mentioning `mailNickname`** — a group with that `mailNickname` (or
  `displayName`) already exists. Expected if the script (once wired up) is run twice, or if one of
  the 4 groups was already created by hand per the "Current status" section above; check the
  Groups blade before re-running.
- **The script exits immediately with a "missing GRAPH_CLIENT_ID..." message** even though `.env`
  looks correct — `tsx` (which runs this script) loads `.env` automatically the same way
  `npm run db:seed` does; confirm there's no typo in the variable name and that `.env` (not just
  `.env.example`) actually has the values, then re-run.
