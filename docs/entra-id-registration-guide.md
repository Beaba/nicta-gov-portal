# Entra ID (Azure AD) App Registration Guide

How to register the Executive Management Reporting and Board Submissions Portal as an app in NICTA's own Microsoft 365
tenant, and wire the resulting values into this app so staff can sign in with their real
`@nicta.gov.pg` Microsoft accounts. See `docs/assumptions-and-decisions.md#A3` for why this exists
as a provider behind `AUTH_PROVIDER`, and `docs/known-limitations.md` for the msal-node dependency
note.

This is a two-part job:

- **Part A** (steps 1–6) is done once by a NICTA Microsoft 365 administrator, entirely inside the
  Azure/Entra portal. It produces four values.
- **Part B** (steps 7–8) is done by a developer, inside this repository, using the four values from
  Part A. It does not require Azure access.

Registering the app (Part A) is necessary but **not sufficient** for someone to sign in — read
step 8 before telling anyone to try.

## Prerequisites

- A person with **Global Administrator**, **Application Administrator**, or **Cloud Application
  Administrator** role in NICTA's Microsoft 365 tenant. Regular user accounts cannot create app
  registrations.
- Access to either https://portal.azure.com (Azure Portal → "Microsoft Entra ID" in the left nav)
  or https://entra.microsoft.com directly. Both reach the same "App registrations" blade — this
  guide refers to it by that name regardless of which URL you start from.
- Know in advance which URL(s) the app will be reachable at, since the exact URL is needed for step
  3 (redirect URI). For this project: local dev is `http://localhost:3001` (see the note under step
  3 for why it's 3001, not 3000) and production is the real public HTTPS URL, e.g.
  `https://portal.nicta.gov.pg`.

## Part A — App registration (Microsoft 365 admin)

### 1. Create the app registration

1. Go to **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name**: `Executive Management Reporting and Board Submissions Portal` (or similar — this is just a display name, it
   doesn't get read by the app).
3. **Supported account types**: select **Accounts in this organizational directory only (NICTA
   only — Single tenant)**. This is a single-tenant, single-organization internal portal; do not
   select the multitenant or personal-Microsoft-account options.
4. **Redirect URI**: platform type **Web**, value from step 3 below. You can also leave this blank
   here and add it under Authentication in step 3 — either order works.
5. Click **Register**.

### 2. Note the IDs on the Overview page

Immediately after registration, the app's **Overview** page shows two values needed later:

- **Application (client) ID** → this becomes `AZURE_AD_CLIENT_ID`.
- **Directory (tenant) ID** → this becomes `AZURE_AD_TENANT_ID`.

Copy both somewhere safe now; you'll hand them to the developer wiring up the app in Part B.

### 3. Configure the redirect URI

Go to **Authentication** in the left nav of the app registration.

- Under **Web** → **Redirect URIs**, add the exact callback URL(s) the app will use. The value
  must **exactly match** `AZURE_AD_REDIRECT_URI` in the app's environment configuration — including
  scheme, host, port, and path — or sign-in will fail with `AADSTS50011` (see Troubleshooting).
  - **Local dev on this machine**: `http://localhost:3001/api/auth/entra/callback`. Note the
    non-default port: this dev machine already runs an unrelated project on port 3000, so this app
    runs on **3001** locally. If you're setting this up on a different machine where port 3000 is
    free, use `http://localhost:3000/api/auth/entra/callback` instead (matching `.env.example`'s
    default) and adjust `APP_BASE_URL`/`AZURE_AD_REDIRECT_URI` accordingly.
  - **Production**: the real HTTPS URL, e.g.
    `https://portal.nicta.gov.pg/api/auth/entra/callback`.
  - You can register **multiple redirect URIs on the same app** — there's no need for separate app
    registrations per environment. Add both the local-dev and production URLs here if you want one
    registration to serve both; each environment's `.env` then just points at whichever one
    matches how it's actually being accessed.
- Leave **ID tokens** / **Access tokens** checkboxes under "Implicit grant and hybrid flows"
  unchecked — this app uses the standard authorization code flow (`@azure/msal-node`,
  `ConfidentialClientApplication`), not the implicit flow.
- Save.

### 4. Create a client secret

1. Go to **Certificates & secrets** → **Client secrets** tab → **New client secret**.
2. Give it a description (e.g. `portal-prod-2026` or `portal-local-dev`) and pick an expiry.
   Microsoft's presets are typically 3 months, 6 months, 12 months, 18 months, or a custom date up
   to 24 months — there's no "never expires" option. Pick the longest option your organization's
   security policy allows; shorter-lived secrets mean more frequent rotation (see step 10).
3. Click **Add**. The secret **value** is shown exactly once, immediately after creation — copy it
   now. If you navigate away without copying it, it's gone permanently and you'll need to create a
   new secret (the old one still shows its _ID_ and expiry in the list, but never its value again).
4. This value becomes `AZURE_AD_CLIENT_SECRET`.

### 5. Confirm API permissions

Go to **API permissions**. You should see **Microsoft Graph → User.Read** already listed under
**Delegated permissions** — this is added automatically to every new app registration and is what
the app requests via `ENTRA_LOGIN_SCOPES` (`src/lib/auth/msalClient.ts`:
`['openid', 'profile', 'email', 'User.Read']`).

- If `User.Read` is missing, add it: **Add a permission** → **Microsoft Graph** → **Delegated
  permissions** → search `User.Read` → **Add permissions**.
- `User.Read` is a low-privilege permission (read the signed-in user's own profile) and in most
  tenants does **not** require explicit admin consent — each user consents for themselves on first
  sign-in. If your tenant has "user consent" locked down by policy, click **Grant admin consent for
  [tenant]** on this page once, so every user is pre-consented and doesn't hit a consent prompt (or
  a block) on first login.
- `openid`, `profile`, and `email` are standard OpenID Connect scopes and don't need to be added
  here explicitly — they're implicit in any OIDC sign-in request and not a Graph permission.

### 6. Hand off the four values

At this point you should have, ready to hand to the developer configuring the app:

| Value                   | Where it came from                                        |
| ----------------------- | --------------------------------------------------------- |
| Directory (tenant) ID   | Overview page (step 2)                                    |
| Application (client) ID | Overview page (step 2)                                    |
| Client secret value     | Certificates & secrets (step 4) — copied at creation time |
| Redirect URI            | Whatever you registered in step 3                         |

Send the secret value through a secure channel (password manager share, not plain email/chat) —
it's equivalent to a password for this app registration.

## Part B — Wiring it into the app (developer)

### 7. Set environment variables

These four variables map directly to the values from step 6 (`src/lib/config/env.ts` is the only
place that reads them; `.env.example` documents them with this same guide referenced inline):

In `.env` (never `.env.example` — that file stays a template with empty values):

```
AUTH_PROVIDER="entra"
AZURE_AD_TENANT_ID="<Directory (tenant) ID from step 2>"
AZURE_AD_CLIENT_ID="<Application (client) ID from step 2>"
AZURE_AD_CLIENT_SECRET="<client secret value from step 4>"
AZURE_AD_REDIRECT_URI="http://localhost:3001/api/auth/entra/callback"
```

For production, `AZURE_AD_REDIRECT_URI` should instead be the real HTTPS URL, e.g.
`https://portal.nicta.gov.pg/api/auth/entra/callback`, matching whichever redirect URI you
registered for that environment in step 3.

`AUTH_PROVIDER=entra` is what switches the app from `MockAuthProvider` to `EntraAuthProvider`
(`src/lib/auth/index.ts`). If `AUTH_PROVIDER` is left at its default (`mock`), none of these Entra
variables are read at all and the app runs in demo mode regardless of what's in them.

`createMsalClient()` (`src/lib/auth/msalClient.ts`) only validates
`AZURE_AD_TENANT_ID`/`AZURE_AD_CLIENT_ID`/`AZURE_AD_CLIENT_SECRET` at the moment someone actually
hits the sign-in route — not at app startup or import time — so a misconfigured or incomplete
`.env` won't crash the app; it'll just throw a clear error ("`AUTH_PROVIDER=entra` requires
AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID and AZURE_AD_CLIENT_SECRET...") the first time someone
clicks "Sign in."

Restart the dev server (or redeploy) after editing `.env` — it's read once at process start.

The two routes involved, for reference:

- `src/app/api/auth/entra/login/route.ts` — builds the Microsoft authorization URL and redirects
  to it.
- `src/app/api/auth/entra/callback/route.ts` — receives the authorization code Microsoft redirects
  back with, exchanges it for tokens, and either starts a session or redirects to
  `/login?error=not_provisioned` (see step 8).

### 8. Provision the first real user (required before anyone can sign in)

Registering the Entra app makes Microsoft _authenticate_ someone — it does not make the portal
_authorize_ them. `completeEntraSignIn()` (`src/lib/auth/entraProvider.ts`) looks up the signed-in
Microsoft account against this app's own `User` table, first by `entraObjectId`, then by `email`.
**If neither matches an existing row, sign-in is rejected** — the callback redirects to
`/login?error=not_provisioned` — even though the person's Microsoft credentials were completely
valid. The app deliberately never auto-creates a `User` row from a successful Entra sign-in; role
and department access are only ever granted through this app's own data, never trusted from
whatever claims Microsoft's token happens to carry.

So before anyone tries to sign in with their real Microsoft account, an administrator must add (or
confirm the existence of) a matching `User` row with their **exact email address** and appropriate
role/department:

- **Preferred**: the `/admin/users` screen (being built alongside this guide as part of the same
  Entra rollout effort — if it isn't live yet in your build, use the seed-script fallback below and
  revisit this screen once it ships). It lets an admin add a user by email, name, department, and
  role without touching the database directly.
- **Fallback**: `prisma/seed.ts` is the existing pattern for creating `User` + `UserRole` rows
  (see its `upsertUser()` helper) — a developer with database access can add a one-off row the same
  way, or extend the seed script, and run `npm run db:seed`. This is a stopgap for before
  `/admin/users` exists or if it's temporarily unavailable; it is not the intended long-term
  workflow for onboarding real staff.

The email in the `User` row must match the person's actual Microsoft 365 sign-in email exactly
(the lookup is a plain equality match, not case-insensitive or fuzzy). On their first successful
sign-in, the app backfills that `User` row's `entraObjectId` automatically — after that, lookups
resolve by `entraObjectId` even if their email later changes in Microsoft 365.

### 9. Troubleshooting

**Common `AADSTS` errors from Microsoft's sign-in page:**

- **`AADSTS50011` — redirect URI mismatch.** The URI the app sent doesn't exactly match one
  registered in step 3. Check `AZURE_AD_REDIRECT_URI` in `.env` character-for-character against
  the Authentication blade — a trailing slash, `http` vs `https`, or wrong port (3000 vs 3001, see
  step 3) is enough to trigger this.
- **`AADSTS65001` — admin consent required.** The tenant has user consent locked down and nobody's
  granted admin consent yet for the requested permissions. Go back to step 5 and click **Grant
  admin consent**.
- **`AADSTS50020` — user account from an external/personal tenant, or doesn't exist in this
  directory.** The person signed in with an account that isn't a member of NICTA's tenant (a
  personal Microsoft account, or a guest/work account from a different organization). Confirm
  they're using their real `@nicta.gov.pg` NICTA-issued account.

**The app's own `not_provisioned` redirect** (`/login?error=not_provisioned`): this means the
Entra sign-in itself worked — Microsoft correctly authenticated the person — but no matching `User`
row exists in this app's database yet. This is not an Entra/Azure problem and nothing in the app
registration needs to change. See step 8: add a `User` row for that exact email address, then have
them try signing in again.

### 10. Client secret rotation

Client secrets expire (step 4 — max ~24 months, often shorter). Before a secret expires:

1. Create a new client secret (step 4) — the old one can stay valid alongside it during the
   transition, so there's no forced downtime.
2. Update `AZURE_AD_CLIENT_SECRET` in `.env` (or the production secret store) to the new value and
   redeploy/restart.
3. Once confirmed working, delete the old secret from **Certificates & secrets** to reduce the
   number of live credentials.

Set a calendar reminder ahead of the expiry date shown in **Certificates & secrets** — an expired
secret makes every Entra sign-in fail with an authentication error at token-exchange time (not a
redirect-URI or consent error, so it can look different from the errors above).

If something breaks and you need to fall back to demo mode quickly, unsetting or removing
`AUTH_PROVIDER` (or setting it back to `mock`) from the environment is safe and non-destructive —
`AUTH_PROVIDER` defaults to `mock` if absent (`src/lib/config/env.ts`), and the four
`AZURE_AD_*` variables are simply ignored in that mode. This doesn't require touching the Entra app
registration itself.
