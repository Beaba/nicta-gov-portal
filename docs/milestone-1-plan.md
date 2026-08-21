# Milestone 1 Implementation Plan — Submission & Review Portal

Status: IN PROGRESS. Authoritative plan for this phase of work — see
`docs/assumptions-and-decisions.md#A12` for why this supersedes phase ordering in
`docs/00-implementation-plan.md` for now (that file's phases 4-8 remain the roadmap for what comes
after Milestone 1 ships; nothing in them is discarded).

## Scope

A working web portal (Next.js only — no mobile app, no second backend service; see `#A13`) that
takes a paper from draft through closed-AI template review, human secretariat review, and
accept/return, to a recorded (mock or real SharePoint) filing location. Workplans, Kanban, SMC/Board
meeting management, board conversion, deadlines/late-exception handling, and dashboards are
explicitly out of scope for this milestone — their schema/provider foundations already built are
preserved untouched.

## Roles (Milestone 1 subset of the full role list)

Reuses the existing `Role`/`UserRole` reference data (`docs/assumptions-and-decisions.md#A4`) — no
new role model needed. Three role codes are active this milestone:

- `SUBMITTER` — create/edit own submissions, upload main paper + annexures, view AI findings, fix
  and resubmit a returned paper, track status.
- `REVIEWER_SECRETARIAT` — queue of submitted papers, view AI findings + documents, accept or
  return with mandatory comments, confirm routing destination, trigger routing.
- `SYSTEM_ADMIN` — already exists; scope extended to manage departments, meetings, paper types, and
  templates for this milestone (users/role mapping was already implicit admin territory).

`SEED_ROLES` in `src/lib/config/roles.ts` gains `SUBMITTER` and `REVIEWER_SECRETARIAT`. The other
five existing codes (MANAGER, DIRECTOR, SMC_MEMBER, BOARD_SECRETARIAT, EXECUTIVE_VIEWER) are
untouched, reserved for later modules.

## Workflow state machine

```
DRAFT -> SUBMITTED -> AI_REVIEWED -> SECRETARIAT_REVIEW -> RETURNED -> SUBMITTED (resubmit loop)
                                                          -> ACCEPTED -> ROUTED -> CLOSED
```

- `DRAFT -> SUBMITTED`: submitter action; requires main document uploaded, department, paper type,
  meeting selected; stamps `submittedAt`, assigns `referenceNumber`.
- `SUBMITTED -> AI_REVIEWED`: system-triggered immediately after submit (synchronous call to the AI
  review provider); always succeeds even if findings are negative — AI review is advisory, never
  blocking (client instruction: "AI must not approve or reject a submission").
- `AI_REVIEWED -> SECRETARIAT_REVIEW`: system-triggered immediately after AI review completes —
  there is no separate manual step here in Milestone 1, it lands directly in the reviewer queue.
- `SECRETARIAT_REVIEW -> RETURNED`: reviewer action, comment required.
- `SECRETARIAT_REVIEW -> ACCEPTED`: reviewer action.
- `RETURNED -> SUBMITTED`: submitter action (re-upload corrected main document; bumps
  `SubmissionVersion`).
- `ACCEPTED -> ROUTED`: reviewer action ("trigger final routing"); calls the document storage
  provider, stamps `routingFolderKey` + `routedAt`.
- `ROUTED -> CLOSED`: reviewer action, terminal.

Implemented as a small table-driven state machine (`src/lib/submissions/workflow.ts`), not a
generic engine, per the client's explicit "do not introduce a complex workflow engine" instruction.
Every transition writes one `WorkflowTransition` row (`entityType: "Submission"`) and one
`AuditEvent` via `src/lib/audit/auditLog.ts` (already built) — previous status, new status, user,
timestamp, comment, and the submission's version number at the time of transition.

## Data model additions (see `docs/assumptions-and-decisions.md#A14`)

- `Role`: seed `SUBMITTER`, `REVIEWER_SECRETARIAT`.
- `Submission`: `mainDocumentStorageKey`, `mainDocumentFileName`, `generatedDraftStorageKey`,
  `routingFolderKey`, `routedAt` added. `workflowStatus` values constrained to the state machine
  above for this milestone (still a plain string column — see `#A5`'s reasoning for why workflow
  state is code-level, not reference data).
- `Template`: `paperType`, `isActive`, `effectiveDate`, `supersedesId` self-relation added.
- New `AIReviewResult` model (see `#A14`).
- New `SequenceCounter` model backing reference-number allocation.
- `Evidence`: `role` field added (`MAIN_PAPER | ANNEXURE | GENERATED_DRAFT | AI_REVIEW_REPORT |
HUMAN_REVIEW_RECORD`) so a submission's routed document set (client requirement: "Final main
  paper, Original source paper, Approved annexures, AI review report, Human-review record") can be
  queried directly instead of re-derived.

## Module boundaries inside the single Next.js app (`#A13`)

| Client's suggested module | Where it lives in this repo                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Identity and Access       | `src/lib/auth/` (already built)                                                                                     |
| Submissions               | `src/lib/submissions/` (new: CRUD, reference numbering, versioning)                                                 |
| Template Management       | `src/lib/templates/` (new)                                                                                          |
| AI Document Review        | `src/lib/providers/aiReview/` (new: interface + Mock + Internal stub)                                               |
| Human Review              | `src/lib/submissions/review.ts` (accept/return actions, part of Submissions module)                                 |
| Document Routing          | `src/lib/providers/documentStorage/` (existing) + `src/lib/submissions/routing.ts` (new)                            |
| Audit and Notifications   | `src/lib/audit/` + `src/lib/providers/notifications/` (already built)                                               |
| Microsoft 365 Integration | `src/lib/auth/msalClient.ts` (existing) + `src/lib/providers/documentStorage/sharepointProvider.ts` (existing stub) |

Each module is reached only through its own exported functions (no route handler reaches into
another module's internals or another module's Prisma models directly) — this is what keeps the
monolith "modular" without paying for a second deployable.

## Screens (App Router routes)

`/login`, `/submissions` (My Submissions), `/submissions/new`, `/submissions/[id]`,
`/submissions/[id]/ai-review`, `/review-queue` (Secretariat), `/review-queue/[id]` (Review
Submission), `/admin/templates`, `/admin` (basic administration: departments, meetings, paper
types), `/submissions/[id]/audit` (Audit History).

## What is mocked vs. requires real NICTA/Microsoft credentials

Unchanged from the existing provider pattern (`docs/assumptions-and-decisions.md#A3, A7, A8`):
mock auth, local filesystem document storage, mock AI review — all fully functional without any
tenant. `AUTH_PROVIDER=entra`, `DOCUMENT_STORAGE_PROVIDER=sharepoint`, `AI_PROVIDER=internal` are
documented, env-gated, and throw a clear configuration error if selected without credentials rather
than silently degrading.
