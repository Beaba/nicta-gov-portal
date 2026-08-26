# Known Limitations

Running list of things a real deployment or a future session should know about. Referenced from
code comments (`docker-compose.yml`, `.env.example`) rather than duplicated there.

## Local environment

- **Postgres runs on host port 5433, not 5432.** This dev machine already runs an unrelated
  project's Postgres container bound to `127.0.0.1:5432`. `docker-compose.yml` maps `5433:5432`
  and `.env`/`.env.example`'s `DATABASE_URL` match. If you run this on a machine without that
  collision, port 5432 works fine — just change both.
- **`prisma generate` can EPERM on Windows while `next dev` is running**, because the running dev
  server has the generated query-engine `.dll.node` file open. Stop the dev server (or just ignore
  the error if the schema didn't actually change since the last successful generate — the existing
  generated client is still valid).
- **Package manager is npm, not pnpm** — see `docs/assumptions-and-decisions.md#A15`.

## Security / dependency posture

- `next@14.2.35` is the latest patch on the 14.x line (bumped from `14.2.18`, which had a
  disclosed CVE — see `#A15`). `npm audit` still reports a long list of Next.js advisories that
  only a major-version upgrade to Next 16 would clear; most concern features this app doesn't use
  (Image Optimization, custom Middleware, i18n Pages Router rewrites, custom servers). A Next 16
  migration is a deliberate future decision, not something to force via `npm audit fix --force`.
- `@azure/msal-node`'s transitive `uuid` dependency has a moderate advisory; a fix requires a
  msal-node major bump. Not exercised in mock auth mode (`AUTH_PROVIDER=mock`); revisit before
  actually enabling `AUTH_PROVIDER=entra` in production.
- Malware scanning (`src/lib/providers/documentStorage/malwareScan.ts`) is a mock signature check
  (EICAR test string only), not a real AV engine — see `docs/assumptions-and-decisions.md#A10`.

## Branding

Superseded by `docs/assumptions-and-decisions.md#A17`: the client later shared a reference build
with real logo/emblem PNGs and measurable colour values, now used directly (`public/png-emblem.png`,
`public/nicta-logo.png`, `tailwind.config.ts`'s measured token table). Two things a production
deployment should still do: (1) confirm these PNGs — pulled from a third-party reference site, not
NICTA's own asset library — are pixel-identical to NICTA's actual brand kit, and swap in vector
(SVG) originals if available for crisper rendering at large sizes; (2) the "Portal view" role
switcher in `AppHeader` is currently a static label, not a working multi-role switcher — fine while
every demo user has exactly one Milestone-1 role, but needs real switching logic before a user with
both Director and Corporate Services Director roles could use it.

## Functional gaps (by design, not oversight)

- **No document text extraction.** `MockAIReviewProvider` cannot read the contents of an uploaded
  `.docx` — no parser (e.g. `mammoth`) is wired up. It checks what's mechanically verifiable (file
  type, template selection, title placeholders) and downgrades everything else (missing
  purpose/recommendation/proposed-decision) to a warning asking a human to confirm, rather than
  falsely claiming to have inspected content it never read. See
  `src/lib/providers/aiReview/mockProvider.ts`'s header comment and `#A17`.
- Document routing (`ACCEPTED → ROUTED`) computes and records a destination folder key but never
  physically moves files — the storage provider already places files correctly by metadata at
  upload time. See `docs/assumptions-and-decisions.md#A14`.
- `DOCUMENT_STORAGE_PROVIDER=sharepoint`, `AUTH_PROVIDER=entra`, `AI_PROVIDER=internal`,
  `KANBAN_PROVIDER=microsoft-lists` are all implemented against documented contracts but not a
  live Microsoft tenant or NICTA's internal AI service — they throw a clear configuration error if
  selected without credentials, rather than silently falling back to mock behavior. See
  `docs/mvp-directors-portal-plan.md`'s "What's mocked" section for the full list per capability.
- **Document folder placement falls back to `createdAt` when a submission has no linked meeting.**
  The exact NICTA Governance Portal hierarchy (`src/lib/providers/documentStorage/pathBuilder.ts`)
  files everything under `{year}/SMC_{meetingDate}` or `BOARD_{meetingDate}`, derived from the
  linked `Meeting.meetingDate`. Every call site that builds a `DocumentPlacementMetadata`
  (`submissions.ts`, `review.ts`, `routing.ts`) falls back to the submission's `createdAt` if
  `meetingId` is null, rather than throwing — marked with a `// TODO` at each call site. In
  practice every submission is expected to have a meeting by upload time (`createDraftSubmission`
  requires one), so this fallback is a defensive backstop, not an expected path.
- **SMC annexures are not yet carried over to Board Papers.** `SubmissionAnnexure.carriedFromSubmissionId`
  exists in the schema for exactly this purpose (and the folder hierarchy has a
  `02_Annexures` slot under Board Papers for it — see `DocumentPlacementKind.BOARD_ANNEXURE` in
  `src/lib/providers/documentStorage/interface.ts`), but `submitBoardPaper()` in
  `src/lib/submissions/review.ts` only files the Board Paper's own main document today; nothing
  currently reads `carriedFromSubmissionId` or produces a `BOARD_ANNEXURE` placement. Building that
  carry-over would also need a way to read a previously-uploaded file's bytes back out of
  `DocumentStorageProvider` (only `upload`/`getDownloadUrl`/`delete` exist today) — a bigger change
  than the folder-placement redesign this was scoped under.
- **Board Papers file under the source SMC meeting's date, not a distinct Board meeting date.**
  `submitBoardPaper()` (`src/lib/submissions/review.ts`) sets the new Board Paper's `meetingId` to
  `source.meetingId` — the _SMC_ meeting the original paper was submitted to — because there is no
  Board-meeting scheduling or selection step anywhere in the app yet (`Meeting.meetingType` already
  supports a `BOARD` value, but nothing ever creates or offers one to pick). The client's own example
  hierarchy shows an SMC meeting and a Board meeting on different dates in the same year
  (`SMC_2026-09-15` vs `BOARD_2026-10-20`) — today's folders will instead show the SMC date for
  both, since that's the only meeting a Board Paper is ever linked to. Fixing this needs a real
  Board-meeting-scheduling feature (an admin screen to create `MeetingType: BOARD` meetings, plus a
  picker in the Board Paper submission flow), which is a separate scope of work from the
  folder-placement redesign this was found during.
- **CEO comments are not emailed.** `#A27` wired the CEO's Vetted/Not-Vetted decision to the
  existing in-app `NotificationProvider` (the Director sees it on next login/refresh), matching the
  client's own fallback instruction ("if email credentials are not available, implement an
  email-provider interface... without blocking the portal workflow"). No `EmailProvider` interface
  exists yet — `src/lib/providers/notifications/graphProvider.ts` is an unimplemented stub (throws)
  behind `NOTIFICATION_PROVIDER=graph`, never wired to a real Graph/SMTP send. Real email delivery
  needs that provider built and `NOTIFICATION_PROVIDER` switched in a deployment's `.env`.
- **Manager weekly reporting is not implemented.** The client's spec describes a dedicated Manager
  role workflow (reporting week, KPI/KRA, progress, risks, support requested, etc.) with strict
  visibility boundaries (a Manager sees only their own submissions) that Directors then combine into
  SMC submissions. `MANAGER` exists as a seeded role/department assignment (see `prisma/seed.ts`)
  but has no dedicated pages, forms, or data model beyond the generic `Submission` — flagged as a
  next-milestone recommendation in `#A27` rather than attempted in that pass.
- **The Board paper state machine is still the original ~3-state simplified one** (`DRAFT` ->
  `SUBMITTED` -> `CLOSED`, see `BOARD_STATUS_LABELS` in `src/components/StatusBadge.tsx`), not the
  client's fuller ~10-state design (Board Secretariat pack-check, Board meeting stages, decision
  recording, minute-out, archive). `#A27` scoped this out as Increment 2 work.
- **SharePoint/archive routing doesn't yet carry paper-type or final/archive-status as distinct
  folder dimensions.** The existing hierarchy (see the "SMC annexures" and "Board Papers file under"
  entries above) already routes by year/meeting/on-time-vs-late/department; the client's fuller spec
  additionally wants submission stage, paper type, and a distinct final/archive folder as explicit
  dimensions — not built yet.
- **No KPI/KRA model exists.** `#A29`'s spec describes a full hierarchy (Corporate Strategy ->
  Corporate Plan -> Organisational KPI/KRA -> Department KPI/KRA -> Workplan Activity -> Weekly
  Update -> Evidence -> Executive Report) with RAG status, baselines/targets, and dashboards scoped
  per role (Manager/Director/CEO/Secretariat). `StrategicObjective` and `Activity` already exist in
  the schema (`#A5`/`#A7`-era foundations for a later workplan module) but there is no `KPI`/`KRA`
  model, no RAG computation, and no dashboard reading them — this is a 5-6-model schema addition and
  the single largest deferred item from `#A29`, recommended as the next milestone.
- **No weekly summary generation.** `#A29`'s spec asks for configurable start/mid/end-of-week
  summaries (CEO -> Director, Director -> Manager) generated "from actual portal records only" and
  shown both in-portal and via notification. No scheduling/cron infrastructure exists in this
  codebase to generate them on a cadence; building this needs (a) a job runner or scheduled route,
  and (b) query logic to assemble each summary from `Submission`/`Delegation`/(future) KPI records.
- **No WhatsApp notification provider.** `NotificationProvider` (`src/lib/providers/notifications/`)
  already has the exact shape `#A29`'s spec asks for (a provider interface, a mock implementation,
  delivery recorded) — extending it with a `WhatsAppNotificationProvider` (real: Business API behind
  `NOTIFICATION_PROVIDER=whatsapp`; mock: logs to the existing outbox pattern) is additive, no new
  architecture needed. Not built this pass since it's an external integration with no available
  credentials, matching the client's own fallback instruction to keep the workflow testable without
  one — deferred, not blocking.
- **CEO delegations are CEO -> Director only** (`#A29`), matching the client's own explicit scope
  line ("Do not fully implement... Executive Delegations beyond the CEO-to-Director workflow").
  There is no Director -> Manager delegation chain, no delegation evidence upload UI yet (the schema
  supports it — `Evidence.delegationId` — but no upload form calls it), and no automatic `OVERDUE`
  transition (computed at read time instead — see `#A29`'s decision log entry for why).
- **No real quorum/majority calculation for Board decisions** (`#A30`). No Board-membership-roster/
  quorum-size concept exists anywhere in this codebase; `src/lib/board/approvalRules.ts`'s
  `evaluateBoardOutcome()` is a deliberately simple placeholder (any Reject blocks, else any Defer,
  else any RequestFurtherInformation, else any Approve passes) that only ever suggests an outcome —
  the Board Secretariat always finalizes manually. Real quorum/majority logic is a one-file change
  to that module once the client specifies the actual voting rules.
- **Board Paper types are seeded but not selectable.** `#A30` seeded the client's exact 5 Board
  paper type names as `category: BOARD` `PaperType` rows, but `submitBoardPaper()`
  (`src/lib/submissions/review.ts`) still inherits `paperType` from the source SMC submission — a
  Director-facing picker for these 5 types was judged out of scope for a Board-Member/Secretariat-
  focused module and wasn't built.
- **Comment UI isn't wired up on every commentable entity yet.** The `Comment` model and
  `listComments`/`addComment` (`src/lib/board/comments.ts`) already support `MeetingAgendaItem` and
  `ActionItem` as `entityType` values, but only `Submission` (Board Papers), `Resolution`, and
  `MeetingMinutes` have a `<CommentThread>` actually rendered on their pages — adding it to agenda
  items and action items is a small follow-up, not a schema or service-layer change.
- **No email delivery for Board notifications**, same gap as `#A27`'s CEO comments — every Board
  event (meeting published, minutes ready for review, decision required, resolution assigned)
  fires through the existing in-app `NotificationProvider` only; the mock provider is what's wired
  up locally. Real email needs the same `NOTIFICATION_PROVIDER=graph` deployment step already
  documented above, nothing Board-specific to add.
- **No session-timeout or former-Board-Member-specific access control beyond the existing
  `User.isActive` gate.** A deactivated Board Member's account already can't sign in (the same
  `isActive` check every account in this app goes through — `#A3`), which satisfies "restricted
  access for inactive or former Board Members" at the account level; there is no additional
  Board-specific session-timeout policy beyond `iron-session`'s existing cookie expiry.
- **Document read/download tracking is recorded but not yet browsable.** `#A31` added a
  `DOCUMENT_VIEWED` `AuditEvent` on every successful document fetch
  (`src/app/api/documents/local/[...key]/route.ts`), satisfying "read and download tracking" at the
  data layer — the events exist and are queryable — but there is no dedicated admin/Secretariat UI
  page to browse them yet, only the raw `AuditEvent` table.
- **No unified generic workflow engine** (`#A31`'s spec explicitly asked for one; this codebase's
  earlier, client-given instruction was the opposite — see `#A31`'s decision log entry, the single
  assumption most needing NICTA's explicit confirmation). Every domain (`Submission`, `Delegation`,
  Board `Meeting`, `Resolution`) already uses the identical table-driven-graph _pattern_, just as
  separate modules rather than one shared class — extracting that into
  `src/lib/workflow/engine.ts` is a bounded, low-risk refactor now that the pattern has been proven
  four times, recommended as a future milestone once the client confirms which instruction should
  win.
- **No KPI/KRA collection pipeline** — `#A31` built `DepartmentPerformance` (a snapshot table) and
  the risk/traffic-light service the CEO Dashboard reads from, but there is still no real
  Manager-weekly-update-to-department-KPI pipeline feeding it; every figure in the app today is
  seed/demo data (`prisma/seed.ts`'s `seedDepartmentPerformance`), not derived from any actual
  reporting workflow.
- **CEO Approval Inbox is a read aggregation, not a new approval action set.** The approved mockup
  shows CEO actions (Approve with Conditions/Decline/Delegate Review) that don't exist as
  server-side operations on SMC submissions today — the inbox links each item through to its real,
  existing action panel (CEO vetting, Board decisions) rather than presenting buttons with no
  backing workflow. CEO Memos (one row type in the mockup) has no model anywhere in this codebase
  and isn't built — see `#A31`.
- **CEO Delegated Tasks reuses `#A29`'s Delegation feature** rather than a second parallel model —
  the mockup's state _labels_ (Assigned/Acknowledged/In Progress/Awaiting Update/Submitted/
  Completed/Overdue/Closed) differ in wording from the existing Delegation state machine's labels;
  reconciling the exact display text is a small follow-up, not a data-model change.
- **Digital signature and WhatsApp remain interface-only future modules** (`#A31`) — see their own
  provider files (`src/lib/providers/signature/`, `src/lib/providers/notifications/
whatsappProvider.ts`) for what a real implementation would need to supply.
