# Deployment Guide

How to take this codebase from local/mock-mode dev to a running deployment. This is the practical
"what does _this_ app specifically need" guide — for generic Next.js hosting concepts, see the
Next.js docs. Read `CLAUDE.md` first if you haven't; this guide assumes the provider-interface
convention it describes (`AUTH_PROVIDER`, `DOCUMENT_STORAGE_PROVIDER`, `KANBAN_PROVIDER`,
`AI_PROVIDER`, `NOTIFICATION_PROVIDER`).

## 1. Target shape

This app needs a **long-running Node.js process**, not a static host or a pure edge/serverless
platform:

- It uses **Server Actions** throughout (form submissions, workflow transitions) — these require a
  Node.js server runtime handling the request, not a CDN/static export. Nothing in the app declares
  `export const runtime = 'edge'`, so it's implicitly Node-runtime everywhere; there's no
  `middleware.ts` either, so there's no edge-compatibility concern to design around.
- The default `DOCUMENT_STORAGE_PROVIDER=local` implementation
  (`src/lib/providers/documentStorage/localProvider.ts`) writes uploaded documents to
  `.data/documents/` **relative to the process's working directory, on local disk**. This is fine
  for a conventional VM/container host with a persistent volume, but it is **incompatible with any
  platform that gives you an ephemeral or read-only filesystem** (most serverless/edge platforms,
  and any container host that doesn't mount a persistent volume for `.data/`) — uploaded files
  would silently vanish on the next redeploy/restart/cold-start. **For a real production rollout,
  set `DOCUMENT_STORAGE_PROVIDER=sharepoint`** (see §4) instead of relying on local-disk storage, or
  ensure `.data/` is a genuinely persistent, writable volume if you deliberately keep the local
  provider.
- The production command is `next build && next start` (`npm run build && npm run start`). By
  default `next start` listens on port 3000; override with `-p <port>` or the `PORT` env var. If
  you introduce a reverse proxy (nginx, a load balancer, etc.) for TLS termination, that's a normal
  infrastructure choice this guide doesn't prescribe — but see the HTTPS note below, it's not
  optional.
- **HTTPS is required in production, not just recommended.** The session cookie
  (`src/lib/auth/session.ts`) sets `secure: process.env.NODE_ENV === 'production'` — i.e. as soon as
  `next start` runs in production mode, the session cookie is marked `Secure` and browsers will
  refuse to send/store it over plain HTTP. Serve the app over HTTPS (directly or via a
  TLS-terminating proxy in front of it) or sign-in will appear to silently fail.

## 2. Database

- A **real, reachable PostgreSQL instance is required.** The Postgres in `docker-compose.yml` is a
  local dev convenience only (bound to host port 5433 for a reason specific to this dev machine —
  see `docs/known-limitations.md`) and is not internet-reachable; it is not a deployment target.
  Provision a real Postgres instance (managed service or self-hosted) and point `DATABASE_URL` at
  it.
- Apply the schema with **`npx prisma migrate deploy`** — not `npm run db:migrate`
  (`prisma migrate dev`), which is a dev-only command that can create new migrations and touches a
  shadow database. `migrate deploy` just applies `prisma/migrations/` in order and is what
  production/CI should run.
- Run **`npm run db:seed` once** after the first `migrate deploy`. Read `prisma/seed.ts`'s header
  comment before doing this: it is explicitly **fictional demo data** — reference data (departments,
  roles) plus demo users for every role/department and a few demo submissions. The reference-data
  and user upserts are idempotent (safe to re-run), but decide deliberately whether seeding
  fictional demo users/submissions is appropriate for this environment (e.g. a staging tenant vs. a
  real production database that will hold real board submissions) before running it — this guide
  follows the standard "migrate then seed once" sequence, but "once" should mean a considered
  choice, not a reflex.
- `npx prisma generate` must have run against `prisma/schema.prisma` before `next build` (the app
  imports `@prisma/client`, which is generated, not shipped pre-built). Run `npm run db:generate`
  explicitly as part of your build step — don't assume `npm install` alone regenerates it if the
  schema changed.

## 3. Environment variables

`src/lib/config/env.ts` is the single place `process.env` is read (validated with `zod`) and
`.env.example` is the authoritative, fully-commented template — copy it to `.env` and fill in real
values for whatever you're enabling. This section is a checklist, not a replacement for those
comments.

**Always required:**

| Variable         | Notes                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Real Postgres connection string (§2), not the docker-compose one.                                                                                                                                                         |
| `SESSION_SECRET` | **Must be a real random 32+ char value — generate a fresh one with `openssl rand -base64 32`.** Do not deploy with `.env.example`'s literal placeholder string; that placeholder is not a secret (it's committed to git). |

**Recommended for every real deployment:**

| Variable       | Notes                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL` | Defaults to `http://localhost:3000` — set to the real public HTTPS URL. Used to build the Entra OAuth redirect URI when `AZURE_AD_REDIRECT_URI` isn't set, and for absolute links in notifications. |

**Provider selection — set deliberately per environment, don't leave on mock defaults for a real
rollout:**

| Variable                    | Default    | Values                                                   |
| --------------------------- | ---------- | -------------------------------------------------------- |
| `AUTH_PROVIDER`             | `mock`     | `mock` \| `entra`                                        |
| `DOCUMENT_STORAGE_PROVIDER` | `local`    | `local` \| `sharepoint` (see §1's filesystem constraint) |
| `KANBAN_PROVIDER`           | `database` | `database` \| `microsoft-lists`                          |
| `AI_PROVIDER`               | `mock`     | `mock` \| `internal`                                     |
| `NOTIFICATION_PROVIDER`     | `mock`     | `mock` \| `graph`                                        |

Each non-`mock`/non-`database`/non-`local` value requires its own credential group below — the
providers throw a clear configuration error at startup if selected without the matching credentials
(they don't silently fall back to mock behavior). Full step-by-step setup for each lives in a
dedicated doc; this guide doesn't repeat them:

- **Entra (`AUTH_PROVIDER=entra`)**: `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`,
  `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI` — see
  `docs/entra-id-registration-guide.md` for registering the app in NICTA's tenant end to end.
  The redirect URI must exactly match what's registered in Entra for your real deployment URL.
- **SharePoint / Microsoft Lists / Graph notifications** (`DOCUMENT_STORAGE_PROVIDER=sharepoint`,
  `KANBAN_PROVIDER=microsoft-lists`, `NOTIFICATION_PROVIDER=graph`): `GRAPH_CLIENT_ID`,
  `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID`, plus `SHAREPOINT_SITE_ID`/`SHAREPOINT_DRIVE_ID` and/or
  `MICROSOFT_LISTS_WORKPLAN_LIST_ID`/`MICROSOFT_LISTS_ACTIVITY_LIST_ID` as applicable. The
  Entra/Graph app registration side of this overlaps with the security-groups provisioning app —
  see `docs/graph-security-groups-guide.md` (also explains why group membership itself doesn't
  drive authorization in this app — that's entirely database-driven).
- **Internal AI (`AI_PROVIDER=internal`)**: `INTERNAL_AI_ENDPOINT`, `INTERNAL_AI_MODEL_NAME`,
  `INTERNAL_AI_API_KEY`. `.env.example` points to `docs/ai-integration-contract.md` for the
  request/response contract — that file doesn't exist in the repo yet; anyone standing up a real
  internal AI endpoint will need to write it (or get the contract from whoever owns that service)
  before this is usable.
- `DEFAULT_TIMEZONE` (default `Pacific/Port_Moresby`) — only change this if NICTA's deadline logic
  should evaluate against a different timezone; almost certainly leave as-is.

## 4. Pre-deploy checklist

- [ ] `npm run build` succeeds against the target Node version (verified locally with Next.js
      14.2.35 — see below).
- [ ] `npx prisma migrate deploy` applied cleanly against the real database.
- [ ] `npm run db:seed` run exactly once, deliberately (§2's caveat on fictional demo data).
- [ ] `SESSION_SECRET` is a freshly generated random value, not the `.env.example` placeholder.
- [ ] `AUTH_PROVIDER`, `DOCUMENT_STORAGE_PROVIDER`, `AI_PROVIDER`, `KANBAN_PROVIDER`,
      `NOTIFICATION_PROVIDER` are each set deliberately for this environment — don't leave
      production on mock/local defaults unintentionally; conversely, mock defaults are fine and
      expected for a staging/demo deployment that isn't meant to touch real NICTA systems yet.
- [ ] `APP_BASE_URL` (and `AZURE_AD_REDIRECT_URI`, if using Entra) point at the real deployment URL,
      not `localhost`.
- [ ] The app is served over HTTPS (§1 — the session cookie won't work otherwise once
      `NODE_ENV=production`).
- [ ] If `DOCUMENT_STORAGE_PROVIDER=local` is a deliberate choice rather than an oversight, confirm
      `.data/` sits on a persistent, writable volume that survives redeploys.

## 5. What's still mock/stub after "deployment"

Deploying this codebase does not, by itself, make every capability real — several providers are
implemented against documented contracts but have never been exercised against a live Microsoft
tenant or NICTA's internal AI service, and there are a handful of by-design functional gaps (e.g.
Board Papers file under their source SMC meeting's date, not a distinct Board meeting date; no
document text extraction in the mock AI reviewer). Rather than duplicate that list here where it
can drift out of date, see **`docs/known-limitations.md`**'s "Functional gaps (by design, not
oversight)" section for the authoritative, current list, and its "Security / dependency posture"
section for the current `npm audit` / dependency situation.

## 6. Security headers

`next.config.mjs` sets a conservative baseline (`X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
and `Strict-Transport-Security`) on every response. It deliberately does **not** set a
Content-Security-Policy — a real CSP needs to be built against this app's actual script/style
sources and verified with a `next build && next start` smoke test before shipping, not guessed at.
If you add one, smoke-test it the same way this guide's headers were verified: build, `next start`
on a scratch port, `curl -D -` a few routes, confirm nothing breaks.
