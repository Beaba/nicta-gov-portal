# Directors Submission Portal — First MVP

Status: IN PROGRESS. Authoritative plan for the visible portal. Narrowed from `docs/milestone-1-plan.md`
per the client's approved mock-up (`#A16`/`#A17`), then the governance workflow itself was
deepened per the client's own description of how Director/CEO/Corporate Secretary actually work
together (`#A18`). Nothing from Milestone 1 was discarded.

## Visible scope

Only these are reachable from navigation:

- Sign in (mock demo-user picker or Entra) — "Executive Management Reporting and Board Submissions
  Portal" (renamed from "NICTA Reporting and Governance Portal"; login page redesigned from a
  client mockup — see `#A19`)
- SMC Submissions (`/submissions`) — register table + an "Upload completed paper" modal
  (title, paper description, approved template, main document, optional annexures — one "Submit
  to SMC" action) that creates, uploads, and submits in a single step. `/submissions/[id]` is the
  detail view for both SMC papers and Board Papers (also handles Return-for-Correction
  resubmission, and — once SEMC endorses — the "Submit Board Paper" action).
- AI Template Review (`/submissions/[id]/ai-review`) — advisory findings display, SMC papers only
- Review Queue (`/review-queue`, `/review-queue/[id]`) — Corporate Secretary's three SEMC
  deliberation outcomes: Note, Endorse for Board, Return for Correction
- Board Papers (`/board-papers`) — the Director's submitted Board Papers, each with its own
  `BP-26-020` reference and a link back to the source SMC paper's `SMC-26-042` reference
- Executive Dashboard (`/executive-dashboard`) — CEO's org-wide read view of both registers
- Administration (`/admin`, `/admin/templates`) — Corporate Secretary and System Admin: departments,
  SMC meetings + submission deadlines, paper types, templates

Action Items (description + due date) can be added to any SMC paper or Board Paper by the CEO or
Corporate Secretary directly from its detail page.

The other Milestone 1 future-module placeholder routes (`/my-workplan`, `/department-dashboard`,
`/smc/dashboard`, `/board/dashboard`) are unchanged — still exist, still role-checked, not linked.

## Roles

Reuses the existing `SUBMITTER` / `REVIEWER_SECRETARIAT` / `EXECUTIVE_VIEWER` permission codes and
all their rbac/domain logic — only the seeded **display names** changed for the first two, which
is safe because authorization always keys off `code`, never `name` (`#A4`):

- `SUBMITTER` → **Director** — submits SMC papers and, once endorsed, Board Papers
- `REVIEWER_SECRETARIAT` → **Corporate Secretary** (superseding `#A16`'s "Corporate Services
  Director" — see `#A18`) — reviews SMC papers, is also the portal Admin, ensures deadlines exist
- `EXECUTIVE_VIEWER` → **CEO / Executive Viewer** (unchanged name) — org-wide read access, adds
  action items

The pre-existing `DIRECTOR` role code (department workplan oversight, a later module) is
disambiguated in reference-data listings as "Department Director (Workplans)" so admins don't read
it as the same role.

## Flow

`Director signs in → New SMC Submission → paper description + approved Template (drives paperType)

- main document + optional annexures → Submit to SMC (runs the AI template check, lands in the
  Review Queue) → Corporate Secretary deliberates: Note (stays at SMC level) / Endorse for Board
  (unlocks the next step) / Return for Correction → if endorsed, Director submits a Board Paper
  (a board summary "based on SEMC's comments" + document) → appears under Board Papers with its own
  BP reference → CEO and Corporate Secretary can add Action Items to either paper at any point.`

`routeSubmission`/`closeSubmission` (ACCEPTED → ROUTED → CLOSED, the SharePoint/mock document
routing foundation) are preserved exactly as built and still fully callable — see
`src/lib/submissions/review.ts` — but their buttons are not shown on the Review Submission screen,
since Endorse-for-Board is what this MVP's flow actually requires. `endorsedForBoard` is a flag on
the SMC submission (not the Board Paper itself, and not a competing workflow state) — it only
requires ACCEPTED (or ROUTED) status, so it never conflicts with the routing chain if a later
milestone re-exposes it.

## Template selection replaces paper-type selection

Creating a submission now asks for an **Approved Template** (`Template.isActive = true`), not a
bare paper-type string — `Submission.paperType` and `Submission.templateId` are both derived from
the selected template. `PaperType` reference data and its admin/config helpers are unchanged and
still back the Templates admin screen's paper-type dropdown.

## Branding

Pixel-matched to a client-provided reference build (`docs/assumptions-and-decisions.md#A17`) —
colour tokens in `tailwind.config.ts` were measured (computed CSS), not approximated, and the PNG
national emblem / NICTA logo were downloaded from that reference into `public/`. See
`docs/known-limitations.md` for what a production deployment should still verify (asset
provenance, vector originals).

## What's mocked vs. what a live deployment needs

Unchanged from Milestone 1 (`docs/assumptions-and-decisions.md#A3, A7, A8`): mock auth, local
filesystem document storage, mock AI template review all run with zero external credentials.
`AUTH_PROVIDER=entra`, `DOCUMENT_STORAGE_PROVIDER=sharepoint`, `AI_PROVIDER=internal` remain
env-gated stubs that fail loudly (not silently) if selected without credentials.
