# NICTA Internal Management and Board Submission Portal

What this is: an internal Next.js portal for NICTA departments to manage workplans/activities on a
Kanban board, submit board papers through an SMC → Board review workflow, and generate DOCX
reports — with deadline enforcement in the `Pacific/Port_Moresby` timezone and an append-only
audit log. Currently Milestone 1 (submission/review MVP) — see `docs/milestone-1-plan.md`
(authoritative for current work) and `docs/00-implementation-plan.md` for the full phased plan.

## Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format check: `npm run format:check` (fix: `npm run format`)
- Unit tests: `npm test` (watch: `npm run test:watch`)
- E2E tests: `npm run test:e2e` (Playwright)
- DB: `npm run db:generate` / `npm run db:migrate` / `npm run db:seed` / `npm run db:reset`
- Local Postgres: `docker-compose up -d` (exposes on host port **5433**, not 5432 — see
  `docs/known-limitations.md`)

## Layout

- `src/app/` — Next.js App Router pages and API routes (`src/app/api/`), grouped by feature:
  `admin/`, `board/`, `board-papers/`, `department-dashboard/`, `executive-dashboard/`, `login/`,
  `my-workplan/`, `notifications/`, `review-queue/`, `smc/`, `submissions/`
- `src/components/` — shared React components
- `src/lib/auth/` — session handling (`iron-session`) and RBAC; `entraProvider.ts` (production) vs
  `mockProvider.ts` (dev) behind `src/lib/auth/index.ts`
- `src/lib/providers/` — every external dependency (AI, AI review, document storage, Kanban,
  notifications) behind an interface, each with a mock and a real (Graph/SharePoint/internal-AI)
  implementation
- `src/lib/db/`, `src/lib/audit/`, `src/lib/submissions/`, `src/lib/templates/` — data access,
  audit logging, submission workflow logic, DOCX template/report generation
- `prisma/schema.prisma`, `prisma/migrations/` — data model and migration history
- `docs/` — living project docs: implementation plan, milestone plans, assumptions/decisions log,
  known limitations. Read `docs/assumptions-and-decisions.md` before making a design call that
  isn't obvious from the code.

## Conventions

- Every external integration (auth, document storage, Kanban, AI, notifications) sits behind a
  provider interface, selected by env var (`AUTH_PROVIDER`, `DOCUMENT_STORAGE_PROVIDER`,
  `KANBAN_PROVIDER`, `AI_PROVIDER`, `NOTIFICATION_PROVIDER`). The app must run end-to-end in mock
  mode with **zero** tenant credentials — don't add a code path that requires real Microsoft
  365/Entra/AI credentials just to run locally or in tests.
- Department and Role are configurable reference data in the DB, not hardcoded enums.
- Progress updates and audit records are append-only — never mutate or delete history rows to
  "correct" them; add a new record.
- Deadline logic is server-side and timezone-aware (`Pacific/Port_Moresby` via `luxon`) — never
  compare dates in the client's local timezone.
- TypeScript strict mode; Prettier/ESLint config is the source of truth for formatting, don't
  hand-format against it.
- Session secret and DB URL are the only required env vars for local/mock-mode dev — see
  `.env.example` for what each optional var unlocks and which doc explains it.

## Don't touch

- `prisma/migrations/` — hand-reviewed migration history; don't edit an existing migration file,
  generate a new one.
- `.env` (never commit; `.env.example` is the template to update instead)
- Generated/build output: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`
- `test-annex.docx`, `test-main.docx`, `v4-*.png` — fixtures/artifacts from manual verification,
  not part of the app
