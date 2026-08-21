# Implementation Plan — NICTA Internal Management and Board Submission Portal

Status: IN PROGRESS. This file is updated as phases complete.

**2026-08-20 redirect:** delivery order changed to build a Milestone 1 submission/review MVP first
— see `docs/milestone-1-plan.md` (authoritative for current work) and
`docs/assumptions-and-decisions.md#A12`. The phases below are not abandoned; they resume after
Milestone 1 ships.

## Approach

Repository started empty (a stray 0-byte placeholder file existed at the target path and was
replaced with a real directory before any code was written). No existing conventions to inherit,
so the stack chosen is the one recommended in the brief (section 18), scoped to what a single
engineer can deliver as a working MVP.

## Phases

1. **Scaffold** — Next.js 14 (App Router) + TypeScript, Tailwind, Prisma, Docker Compose for local
   Postgres, tooling (ESLint, Prettier, Vitest, Playwright).
2. **Data model** — Prisma schema covering all 24 entities in section 19, with Department and Role
   as configurable reference data (not enums/hardcoded).
3. **Provider interfaces** — every Microsoft 365 / AI / notification / document-storage dependency
   sits behind an interface with a mock (dev) implementation and a documented production adapter
   (Entra ID, Microsoft Graph/SharePoint, Microsoft Lists, internal AI). The app must run with zero
   tenant credentials.
4. **Core domain** — workplans, activities, Kanban stage transitions with permission checks,
   progress updates with append-only versioning.
5. **Reporting** — DOCX generation from a placeholder NICTA template + field-mapping doc, mock AI
   executive summary with full source traceability.
6. **Governance workflow** — SMC submission state machine, deadline engine (server-side, timezone
   `Pacific/Port_Moresby`), late-submission exception path, SMC→Board conversion preserving links.
7. **Dashboards, notifications, audit** — role-specific dashboards, append-only audit log covering
   section 21, mock notification provider.
8. **Seed data** — fictional demo data for all 5 departments and the full section 22 list.
9. **Tests** — Vitest unit tests for the deadline engine and workflow state machine (the two things
   most likely to have off-by-one/security bugs), Playwright for the critical manager→director
   path.
10. **Documentation** — all sections 24 deliverables.

## Key assumptions (see `docs/assumptions-and-decisions.md` for the full log)

- Package manager: pnpm. Local DB: PostgreSQL via Docker Compose (matches section 18 exactly).
- Auth: custom `AuthProvider` interface; `MockAuthProvider` (demo-user picker, signed session
  cookie via `iron-session`) ships fully working; `EntraAuthProvider` is implemented against
  `@azure/msal-node` but requires tenant env vars to activate — falls back to mock when absent.
- Document storage: `LocalDocumentStorageProvider` (filesystem under `.data/documents`) is fully
  working; `SharePointDocumentStorageProvider` is a documented stub using Graph API shapes, gated
  on env vars.
- AI: `MockAIProvider` produces deterministic, source-cited text from real DB records (no
  invention). `InternalAIProvider` stub documents the contract for NICTA's closed AI service.
- Kanban board data lives in the application's own Postgres tables (source of truth) behind a
  `KanbanRepository` interface; a `MicrosoftListsKanbanRepository` stub documents the Graph/SharePoint
  Lists integration path per section 6. This keeps the MVP runnable without a tenant while
  preserving the swap-in path.
