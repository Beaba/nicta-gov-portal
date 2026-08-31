# CEO Portal Functional Requirements Review (2026-08-26)

Assessment-only review of the current implementation against the confirmed CEO Portal functional
requirements. No source code, database models, migrations, seed data, dependencies, or environment
variables were changed while producing this report. All findings are backed by direct code reading
plus `npx tsc --noEmit` (clean) and `npx next lint` (clean); `npm test` was **not** run against a
live database as part of this review — see §9 for what that means for test-evidence confidence.

---

## 1. Executive Summary

**Overall alignment: Partially aligned.**

The portal has a real, working governance backbone — SMC/Board submission workflow, Board meetings,
decisions, resolutions, minutes, CEO↔Director delegations, department KPI/KRA snapshots with a
reusable traffic-light service, and an append-only audit trail — and that backbone is genuinely
wired end-to-end (permissions → service → persistence → audit → UI), not just visual. Departments
match the required list exactly. Role codes exist for every governance persona named in the
requirements.

But measured against *this specific* SEMC-shaped spec, three structural gaps keep it from
"Substantially aligned":

1. **There is no SEMC.** The codebase's governance loop is named and modelled entirely as **"SMC"**
   throughout (models, routes, role names, UI copy) — a zero-result search for "SEMC" across `src/`
   confirms this is not a labelling nuance. More importantly, the *meeting-centred* machinery built
   for governance meetings (agenda items, attendance, minutes, resolutions, decisions-with-votes) was
   built **only for Board meetings** (`Meeting.meetingType: BOARD`, §3/§4). SMC meetings only ever
   carry a submission-window `Deadline` — no agenda, no recorded deliberation, no minutes, no
   resolutions. The CEO cannot chair, deliberate in, or receive minutes/resolutions/actions from an
   SEMC meeting today, because that meeting workspace doesn't exist.
2. **Six entire required capability areas have no backing model at all**: Weekly Manager Reporting,
   Milestones, Director/Department narrative Summaries, CEO Memos & BAU Approvals, Financial
   Delegation Routing, and Appointments/Invitations. These aren't partially built — grep confirms
   zero models, zero routes, zero service functions for any of them (§2, §4, §8 in the matrix).
3. **The required CEO sidebar is roughly 40% present.** Of the ~23 named items, 9 map to a real,
   working page; the rest — Milestones, Director Summaries, Weekly Management Overview, the five
   distinct SEMC surfaces, Memos & BAU Approvals, Manager Delegations, Appointments & Invitations,
   Account — do not exist as nav items or routes (§2, §7).

Set against that, what *is* built is built well: the traffic-light logic is a genuine reusable
service with admin-adjustable-in-principle thresholds (not hardcoded per-component, though not yet
DB-configurable either); the CEO Approval Inbox is an honest read-aggregation over real, working
approval surfaces rather than fake buttons; digital signature and WhatsApp are correctly represented
as interface-only "Coming Soon" features that throw rather than pretending to succeed; and two real
access-control gaps (Board Secretariat document access, a duplicated/drifted document-route
permission check) were found and fixed in the increment immediately preceding this review. The
project's own `docs/known-limitations.md` already discloses most of the gaps this review
independently confirms — this is a codebase that has been honest about its own gaps as it grew, which
is why "Partially aligned" rather than "Minimally aligned" is the right call: the missing pieces are
large but well-understood, not hidden landmines.

---

## 2. Requirements Traceability Matrix

Status values used: **Implemented**, **Partially Implemented**, **UI Only**, **Model Only**,
**Placeholder**, **Missing**, **Conflicting**, **Not Verifiable**.

### 2.1 CEO KPI, KRA and Milestone Monitoring

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| KPI-1 | Org KPI/KRA progress shown to CEO | Implemented | `src/lib/performance/departmentPerformance.ts:85-103` `getOrganisationalSummary()`; rendered `src/app/executive-dashboard/page.tsx:130-141` | Figures are seed data only (`prisma/seed.ts`'s `seedDepartmentPerformance`), not derived from any reporting pipeline | Medium — dashboard numbers are fictional in any real deployment until a pipeline feeds them | Build the Manager→Department KPI collection pipeline; keep `DepartmentPerformance` as the write target | Required before pilot |
| KPI-2 | Milestone progress (set milestones, targets, due dates, assign Directors) | Missing | No `Milestone` model in `prisma/schema.prisma`; zero matches for "Milestone" as a data concept outside UI copy/nav labels | No milestone concept exists anywhere in the schema or services | High — named explicitly in the required dashboard and sidebar | New model + CEO-facing CRUD + Director assignment/progress workflow | Required before pilot |
| KPI-3 | Department performance shown, per-department traffic light | Implemented | `listLatestDepartmentPerformance()` (`departmentPerformance.ts:18-42`); `src/app/executive-dashboard/departments/page.tsx` | Same seed-data caveat as KPI-1 | Medium | Same as KPI-1 | Required before pilot |
| KPI-4 | Traffic-light calc via reusable backend service, not hardcoded in UI | Implemented | `src/lib/performance/riskService.ts:38-47` `computeDepartmentStatus()`, called from `departmentPerformance.ts:38`, not duplicated in any component | None — this is done correctly | — | — | — |
| KPI-5 | Thresholds administratively configurable | Partially Implemented | `DEFAULT_RISK_THRESHOLDS` is an exported `const` (`riskService.ts:17-20`), a TS-code value, not DB-backed/admin-editable | No admin UI or DB row to change thresholds without a code change | Low–Medium | Add an `AdminSetting`/config row the service reads at call time | Future enhancement |
| KPI-6 | Threshold values: Green 80–100 / Amber 60–79 / Red <60 / Grey no data | Conflicting | Code uses `onTrackMinPercent: 75`, `atRiskMinPercent: 50` (`riskService.ts:17-20`), explicitly labelled "demo, not policy" | Actual cut points differ from the requirement's stated standard values | Low — both sides already agree these should be configurable | Confirm NICTA's real thresholds, set as the default | Required before pilot |
| KPI-7 | CEO can review evidence, validate Director updates, return for clarification, add corrective instructions | Missing | `ActivityUpdate.directorReviewStatus`/`directorReviewComment`/`reviewedById` exist in schema (`schema.prisma:279-307`) but zero call sites anywhere in `src/app` or `src/lib` (confirmed by grep) | The one schema field shaped like this is Director-level (reviewing a Manager), not CEO-level, and is itself unused by any route/action | High | Build CEO-facing validation workflow against `DepartmentPerformance` or a real KPI model | Required before pilot |
| KPI-8 | Validation statuses: Submitted / Awaiting CEO Validation / Validated / Returned for Clarification | Missing | Closest existing analog, `ReviewStatus` enum (`PENDING\|APPROVED\|RETURNED`, `schema.prisma:273-277`), is unused (see KPI-7) and uses different labels at a different level | No CEO-facing status vocabulary exists at all | Medium | Define alongside a real KPI/milestone model | Required before pilot |
| KPI-9 | Approved-target changes require reason/authority/previous/new/user/timestamp/audit | Missing | No "target" concept exists to change — `DepartmentPerformance` rows are flat seed facts with no CEO-facing edit path | N/A until KPI-2/KPI-7 exist | Medium | Build as part of KPI-2 | Required before pilot |
| KPI-10 | Historical performance/trend view | Implemented | `listOrganisationalTrend()` (`departmentPerformance.ts:55-75`); `TrendLineChart` on `/executive-dashboard` and `/executive-dashboard/performance` | Same seed-data caveat as KPI-1 | Low | — | — |

### 2.2 Weekly Manager Reporting & Director Oversight

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| WMR-1 | Manager weekly report (week/dept/manager/activity/category/KPI-KRA/progress/etc., 14 fields) | Missing | No model resembling this; `ActivityUpdate` (`schema.prisma:279-307`) covers ~8 of the 14 fields but has zero UI/service usage anywhere (confirmed: grep `directorReviewStatus`, `ActivityUpdate` → no real call sites, only a comment) | Entire feature absent, both data shape and UI | High — explicitly named as MVP-shaping in the spec | Build Manager role UI + weekly-report model | Critical for MVP |
| WMR-2 | Friday 5pm PGT deadline enforcement (window close, overdue marking, late route, mandatory explanation, Director notified, audited, compliance stats) | Missing | No cadence/deadline logic tied to `ActivityUpdate` or any Manager-report concept. (The *existing* Friday-agnostic `Deadline`/`isLate` machinery is SMC-submission-specific — `submissions.ts`, `#A27` — and has no weekly recurrence) | N/A — depends on WMR-1 existing first | High | Build alongside WMR-1, reusing the existing `luxon`/`Pacific/Port_Moresby` deadline pattern from `submissions.ts` | Critical for MVP |
| WMR-3 | Required report statuses (Draft…Closed, 8 values) | Missing | No matching status vocabulary anywhere | N/A — depends on WMR-1 | Medium | Define with WMR-1 | Critical for MVP |
| WMR-4 | Manager report visibility limited to Manager/Director/authorised reviewers; CEO sees only consolidated summaries by default | Not Verifiable | No report model exists to test visibility against | Cannot verify a control on a feature that doesn't exist | — | Design object/department-scoped visibility when building WMR-1 | Critical for MVP |
| WMR-5 | "Forward to CEO" (object-specific read grant, audited, version-pinned) | Missing | Grep for `forward\|Forward\|grantAccess\|shareWith` across `src/` returns zero matches. `assertCanAccessSubmission` (`submissions.ts:29-71`) has exactly 4 access branches (owner / org-wide-oversight role / Board-Secretariat-on-Board-paper / Board-Member-on-published-Board-paper) — **no per-object, per-user grant mechanism exists anywhere in this codebase**, for submissions or anything else | The permission model has no primitive for "grant this one user read access to this one object" | High — named as a specific thing to check ("does the permission model support this level of object-specific access") | Add an access-grant table (`entityType`/`entityId`/`grantedToUserId`/`reason`/`grantedById`) — a bounded, generalizable addition | Required before pilot |
| WMR-6 | Director: view dept reports, review, comment, request clarification, return, validate, identify risks, convert to actions, link to KPI/KRA, consolidate into Director Summary, recommend to CEO/SEMC | Missing (mostly) | `ActivityUpdate.directorReviewStatus` exists in schema but is never read/written by any route or service (grep confirmed). `addActionItem` (`review.ts:453-484`) is a real "convert issue to action" primitive, but not connected to `ActivityUpdate` | The one schema-level hook for this entire capability area is inert | High | Build with WMR-1 | Critical for MVP |
| WMR-7 | Director Summary (achievements/KPI-KRA/milestones/critical activities/delays/risks/decisions/priorities/last-reporting-date) | Missing | Grep `Summary\|consolidat` across `src/lib` finds exactly one real aggregator, `getOrganisationalSummary()` (`departmentPerformance.ts:77-103`) — numeric KPI/KRA averages only, no achievements/milestones/risks/decisions/narrative fields. A separate `AIGenerationPurpose` type (`providers/ai/interface.ts`) lists `'ExecutiveSummary'` as a planned purpose but `getAIProvider()` has zero callers anywhere in `src` | No narrative consolidation function exists at any level | High | Build as part of WMR-1/KPI-2 | Critical for MVP |
| WMR-8 | CEO comments requiring a response become tracked actions if unresolved | Missing | `listCeoComments()` (`ceoComments.ts`) is read-only aggregation with no "requires response"/"resolved" state; `Comment.isResolved` exists on the Board `Comment` model (`schema.prisma:483`) but is manually toggled, not linked to any action-creation logic | No auto-conversion of an unresolved comment into a tracked action | Low–Medium | Small follow-up once WMR-1 exists | Future enhancement |

### 2.3 SEMC Reporting Window, Workflow, Outcomes, Minutes

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| SEMC-1 | Committee is named/modelled as SEMC | Conflicting | Zero matches for "SEMC" anywhere in `src/` (grep). Everything is `SMC`: `Meeting.meetingType: 'SMC'`, role `SMC_SECRETARIAT`/`SMC_MEMBER`, routes `/review-queue`, `/smc/dashboard` | Pure naming mismatch at minimum; functionally the "SMC" pipeline covers *part* of what SEMC is meant to do (see SEMC-4) but the CEO-chaired deliberation meeting itself does not exist (SEMC-5) | Medium — could be a rename, or could reveal a missing meeting concept depending on NICTA's intent | Confirm with NICTA whether "SMC"→"SEMC" is a pure rename or whether SEMC needs its own meeting workspace distinct from the Board's | Required before pilot |
| SEMC-2 | Corporate Secretariat = SEMC Secretariat | Implemented (by role, not by SEMC naming) | `REVIEWER_SECRETARIAT` role, display name "Corporate Secretary" (`roles.ts:24-27`), is the same role that vets SMC submissions | Same naming caveat as SEMC-1 | Low | — | — |
| SEMC-3 | Reporting window: opening date/deadline/meeting date/template/late rules/required depts/annexures, set by Secretariat | Partially Implemented | `Deadline` model (`schema.prisma:487-498`) has `submissionOpenAt`/`normalCloseAt`/`lateCloseAt`/`permittedPaperTypes`/`requiredReviewers`, created via `/admin`; linked 1:1 to a `Meeting` | No "required departments" or "required annexures" fields; no distinct "reporting window" object separate from the deadline-on-a-meeting | Medium | Extend `Deadline` or add a window-config layer | Required before pilot |
| SEMC-4 | Late submission handling (close, late route, mandatory explanation, Secretariat+CEO notified, audited) | Implemented (SMC-submission level) | `submitSubmission` (`submissions.ts`), `Submission.isLate`/`lateJustification` (`#A27`); `StatusBadge`'s "Late" pill; audited via standard `WorkflowTransition`/`AuditEvent` | "CEO Office notified" specifically not confirmed as a distinct notification path (only the Director/Secretariat are the typical notify targets in `#A27`'s implementation) | Low | Confirm notification targets match spec exactly | Future enhancement |
| SEMC-5 | Director submits one consolidated dept report + annexures; revisions before deadline; post-vetting revision creates new version | Partially Implemented | `SubmissionVersion`/`SubmissionAnnexure` models exist and are used (`submissions.ts`); versioning is real | "One consolidated report" is really "however many individual `Submission` rows a Director creates" — there's no concept of one consolidated per-department-per-window report | Low–Medium | Clarify with NICTA whether multiple SMC papers per department per window is intended or whether true consolidation is required | Required before pilot |
| SEMC-6 | Full SEMC workflow (Director→Secretariat vet→CEO pre-meeting review→agenda→SEMC deliberates→decisions/comments recorded→CEO Chairperson comments→actions assigned→Board escalation recommended→CEO confirms→archive) | Partially Implemented | The **paper-review** half is real: `SUBMISSION_STATES` (`workflow.ts:10-32`, 8 states) → `markEndorsedForBoard`/`markNotVettedForBoard` (`review.ts:162-243`). The **meeting** half does not exist for SMC: `MeetingAgendaItem`/`MeetingMinutes`/`Resolution`/`Decision`-as-vote were all built exclusively for `Meeting.meetingType: 'BOARD'` (`#A30`) — an SMC `Meeting` only ever gets a `Deadline` row, no agenda, no recorded deliberation, no minutes | The CEO cannot open an SEMC meeting's agenda, record deliberation, or receive SEMC minutes — that workspace was built for the Board only | High | Decide whether SEMC needs its own meeting workspace (reusing the Board's `MeetingAgendaItem`/`MeetingMinutes`/`Resolution` models, since `meetingType` already discriminates) or whether "SEMC" is meant to be the existing SMC paper-review pipeline renamed | Required before pilot |
| SEMC-7 | CEO pre-meeting actions: Accept for agenda / Return to Director / Request more info / Preliminary comments / Reject / Close | Conflicting | The 4 of these 6 verbs that exist in code (`acceptSubmission`, `returnSubmissionForCorrection`, `routeSubmission`, `closeSubmission` — `review.ts:36-148`) are gated to `REVIEWER_ROLES` (Corporate Secretariat), **not** `CEO_ROLES`. The CEO's actual action set is a different, narrower pair: `markEndorsedForBoard`/`markNotVettedForBoard` (`review.ts:162-243`) | The spec assigns these 6 actions to the CEO; the code assigns 4 of them to the Secretariat instead, and gives the CEO a different binary decision | High — a real authority-model conflict, not just a gap | Confirm with NICTA which role should hold Accept/Return/Request-info/Reject/Close | Required before pilot |
| SEMC-8 | SEMC outcomes: Approved / Approved with Conditions / Noted / Information Only / Returned / Deferred / Rejected / Escalated to Board | Conflicting | `SubmissionReview.outcome` schema comment lists 10 possible values, but code only ever writes 2: `'Accepted'` and `'Returned'` (`review.ts:56,95`; confirmed by grep — no other literal is ever written). Board `Decision.decisionType` (`decisions.ts:11-19`) is a *different*, non-overlapping 7-value vocabulary (`Approve\|Reject\|Defer\|RequestFurtherInformation\|ApproveSubjectToConditions\|Abstain\|DeclareConflictOfInterest`) for individual Board Member votes, not SEMC paper outcomes | Neither vocabulary matches the required 8-value SEMC outcome list; the schema comment itself overclaims what's implemented | Medium | Define the real outcome vocabulary against whichever meeting model results from SEMC-6 | Required before pilot |
| SEMC-9 | "Escalated to Board" as a distinct recorded outcome | Missing | Grep `escalat` (case-insensitive) across `src/` — only prose/comments describing `endorsedForBoard`, nothing distinct. `endorsedForBoard` (boolean, `Submission`) is the only mechanism, and it's the CEO's own decision, not a recorded SEMC recommendation *followed by* CEO confirmation as two separate steps | Spec wants "SEMC recommends → CEO confirms" as two distinct recorded events; code has one CEO decision only | Medium | Add an SEMC-recommendation field/step ahead of `endorsedForBoard` if the two-step model is confirmed as required | Required before pilot |
| SEMC-10 | Minutes: upload draft, link to agenda items, record deliberations/decisions/CEO comments, assign actions, publish, archive | Partially Implemented (Board only) | `minutes.ts` has real `uploadMinutes`/`submitMinutesForReview`/`publishMinutes`/`listMinutesForUser`/`listAllMinutesForUser` (versioned, real workflow) — but only for Board meetings. No function links a minutes row to agenda items, records deliberations/decisions/CEO-comments *within* the minutes record, or assigns actions from minutes; no `archiveMinutes`/archived-status transition on `MeetingMinutes` exists (only `Meeting.status` has `ARCHIVED`) | Half the required minutes capabilities are absent even for Board; all of it is absent for SEMC (see SEMC-6) | Medium–High | Extend `minutes.ts` with agenda-item linkage and an archive transition; then apply to SEMC meetings per SEMC-6's decision | Required before pilot |
| SEMC-11 | Each outcome carries meeting ref/agenda item/decision wording/SEMC+CEO comments/responsible Director/actions/due dates/papers/Board-escalation status/minute ref | Not Verifiable | Depends on SEMC-8/SEMC-9/SEMC-6 existing in real form first | — | — | Design with SEMC-6 | Required before pilot |
| SEMC-12 | Meeting management: SMC calendar item in Secretariat sidebar | Placeholder | `DisabledSidebarLink label="SMC Calendar"` (`PortalSidebar.tsx:353`) — visible, non-clickable, "Soon"-tagged | No backing feature | Low | — | Future enhancement |

### 2.4 CEO Memos & BAU Approvals, Financial Delegation Routing

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| MEMO-1 | Unified CEO approval queue across 13 memo/document types | Partially Implemented | `listCeoApprovalInbox()` (`approvalInbox.ts:35-79`) aggregates exactly 2 real types (SMC submissions awaiting review, Board Decision Papers) into one queue, linking to real action panels | 11 of the 13 named types (Financial Delegations, Expenditure/Activity/Travel/Procurement/Administrative/Document/Director-Request/CEO-Office-Request/Information memos, General BAU) have no backing model — the inbox is honest about this (doesn't fabricate rows) but doesn't cover them | High | Build a `Memo` model with its own lifecycle once NICTA confirms scope; extend the inbox aggregation | Required before pilot |
| MEMO-2 | Memo fields (18 fields: reference, category, subject, originating Director, etc.) | Missing | No `Memo` model exists | N/A | High | With MEMO-1 | Required before pilot |
| MEMO-3 | Memo statuses (12 values, Draft→Archived) | Missing | No `Memo` model exists | N/A | High | With MEMO-1 | Required before pilot |
| MEMO-4 | CEO actions: Approve / Approve with Conditions / Reject / Return with Comments / Request Further Info / Delegate Review / Open Supporting Docs | Missing (as a memo action set) | Only 2 real CEO decision actions exist in the whole codebase (`markEndorsedForBoard`/`markNotVettedForBoard`); nothing resembling "Delegate Review" or "Approve with Conditions" as a callable action | N/A — depends on MEMO-1 | High | With MEMO-1 | Required before pilot |
| CEOOFC-1 | CEO Office / EO / PA queue-management role (view/organise/prep/urgency/reminders/draft comments) without approve/reject/sign authority unless delegated | Missing | No EO/PA-specific role code exists (only `SUBMITTER`, `REVIEWER_SECRETARIAT`, `MANAGER`, `DIRECTOR`, `SMC_SECRETARIAT`, `SMC_MEMBER`, `BOARD_SECRETARIAT`, `BOARD_MEMBER`, `EXECUTIVE_VIEWER`, `SYSTEM_ADMIN` — `roles.ts:22-44`); no delegated-review record type distinct from the existing CEO→Director `Delegation` | N/A — depends on MEMO-1 for there to be a queue to manage | Medium | Add role + scope the delegation model to memo review once MEMO-1 exists | Required before pilot |
| FIN-1 | Threshold-based routing (≤K50k / K50k–K1m / >K1m / CEO-Office submission) | Missing | Grep for `financial\|budget\|cost.?centre\|K50,?000\|K1\s?million\|approval.?matrix` across `src/` returns only unrelated matches (a `quorum` comment in `approvalRules.ts`, paper-type config) — no financial-threshold routing logic anywhere | Entire capability absent | High | Build once NICTA confirms this sits on top of MEMO-1 or is a distinct model | Critical for MVP if financial approvals are in scope for the CEO Portal specifically |
| FIN-2 | Configurable approval-matrix rules (not hardcoded thresholds) | Missing | Same as FIN-1 — nothing to be configurable yet | N/A | High | With FIN-1 | Required before pilot |
| FIN-3 | Financial value / budget / cost-centre fields on the routed item | Missing | No such fields on `Submission`, `Delegation`, or any model | N/A | High | With FIN-1/MEMO-2 | Required before pilot |
| FIN-4 | Board escalation for >K1m, full audit history | Not Verifiable | Depends on FIN-1 existing | — | — | With FIN-1 | Required before pilot |

### 2.5 CEO Delegations and Tasks

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| DEL-1 | CEO delegates to: one Director / several Directors with accountable lead / a Manager (Director notified) / Director-later-assigns-to-Manager | Partially Implemented | `Delegation.responsibleDirectorId` is a single required FK (`schema.prisma:765-766`) — always exactly one Director. `supportingManagerId` exists as an optional field (`schema.prisma:769-770`, accepted by `createDelegation`, `delegations.ts:33,73`) but **no workflow function ever transitions, notifies, or grants access based on it** — grep of `delegations.ts`/`workflow.ts` shows it's write-only, never read by any permission check or notification | Only "one Director" is a real, working path; multi-Director, CEO→Manager-direct, and Director→Manager-reassignment are all unimplemented despite one field suggesting otherwise | Medium — this is the CEO Portal's most-built feature, but doesn't cover the full addressing model the spec asks for | Add real handling for `supportingManagerId` (notification + access) as the smallest next step; multi-Director needs a schema change (join table) | Required before pilot |
| DEL-2 | Delegation categories (10 values: Task, Work Activity, Event Attendance, …) | Missing | No `category` field on `Delegation` (`schema.prisma:760-791`); not present in `NewDelegationModal.tsx`'s form fields either | Entire categorisation absent | Low–Medium | Add a `category` enum/reference-data field | Required before pilot |
| DEL-3 | Director actions: Accept / Request clarification / Nominate alternate with comments / Assign to Manager / Submit progress / Complete with evidence | Partially Implemented | Real: Acknowledge (`acknowledgeDelegation`), Start Work, Add Update, Flag/Clear Risk, Request Extension, Submit for Review (`delegations/[id]/page.tsx:174-244`, all backed by real service functions). Missing: "Nominate an alternate," "Assign to Manager" as callable actions (no UI, no service function despite the `supportingManagerId` field existing) | 2 of 6 required Director actions have no implementation | Medium | Add both actions | Required before pilot |
| DEL-4 | Completed delegation requires evidence, comment, or report | Partially Implemented | `submitDelegationForReview`/`completeDelegation` accept an optional free-text comment (`delegations.ts:195-218,263-285`) but nothing enforces evidence/comment/report presence — `comment` is optional at the type level, and no `Evidence` row is required despite `Evidence.delegationId` existing in the schema | The requirement is "must include," code allows an empty completion | Low–Medium | Make the review-submission comment (or an evidence upload) mandatory in `submitDelegationForReview` | Required before pilot |
| DEL-5 | Delegation statuses (8: Assigned…Closed) | Partially Implemented (different vocabulary) | Real 10-state machine exists (`DELEGATION_STATES`, `workflow.ts:9-20`: `DRAFT,ISSUED,ACKNOWLEDGED,IN_PROGRESS,AT_RISK,SUBMITTED_FOR_REVIEW,RETURNED_FOR_MORE_WORK,COMPLETED,CLOSED,CANCELLED`) but the exact labels differ from the spec's list (`Assigned` vs `ISSUED`, no `Awaiting Response` equivalent, `OVERDUE` is a derived display flag not a stored state — `isOverdue()`, `workflow.ts:49-55`) | Same underlying lifecycle shape, different words — a display-layer reconciliation, not a missing feature | Low | Relabel display strings to match spec if literal wording matters to NICTA | Future enhancement |
| DEL-6 | Notifications to assigned Director/Manager/responsible-Director-when-CEO-assigns-to-Manager/accountable-lead | Partially Implemented | Every real transition fires a `getNotificationProvider().notify()` call to the Director (`delegations.ts`, throughout) — but since Manager/multi-Director addressing (DEL-1) isn't implemented, those specific notification paths can't fire either | Depends on DEL-1 | Medium | With DEL-1 | Required before pilot |

### 2.6 Appointments and Invitations

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| APPT-1 | Appointment scheduling, Outlook/Teams readiness, agenda attachment, reschedule/cancel/reminders/notes | Missing | Grep `Appointment\|Outlook\|Teams meeting` across `src/` returns zero real hits (only an unrelated code comment mentioning "Outlook/SharePoint permissions" in a role-provisioning doc comment, `roles.ts:19`) — no model, route, or provider stub exists at all, not even an interface-only placeholder | Entire capability absent — not even scaffolded the way Digital Signature/WhatsApp are | Medium | Build `Appointment` model + provider-interface pattern (mirroring the signature/WhatsApp precedent — ship an "unavailable" implementation, not a fake one) | Future enhancement (Microsoft 365 integration dependent) |
| APPT-2 | Director accept/decline/clarify/nominate-alternate/post-event report on forwarded invitations | Missing | N/A — depends on APPT-1 | — | — | With APPT-1 | Future enhancement |
| APPT-3 | Appointment reports linkable to executive reporting | Missing | N/A | — | — | With APPT-1 | Future enhancement |

### 2.7 Notifications (Portal / Email / WhatsApp)

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| NOTIF-1 | In-portal notifications | Implemented | `Notification` model, `MockNotificationProvider`, bell icon with unread count (`PortalHeader.tsx:10-12,64-76`), `/notifications` page | None | — | — | — |
| NOTIF-2 | Email notifications | Placeholder | `NOTIFICATION_PROVIDER` env supports `'graph'` (`env.ts:31`); `graphProvider.ts` exists as an interface stub — per `known-limitations.md`, it throws without live Graph credentials, no real send path implemented | Real email delivery not implemented | Medium | Wire real Graph/SMTP send once tenant credentials exist | Required before production |
| NOTIF-3 | WhatsApp notifications | Placeholder (honestly represented) | `WhatsAppNotificationProvider` (`whatsappProvider.ts:15-38`) always writes the in-app `Notification` row first, then throws — deliberately no fake-success mock, matching the explicit "never implement fake approval" instruction. Surfaced in UI as `<ComingSoonBadge label="WhatsApp notifications" />` (`notifications/page.tsx:27`) | Real delivery, phone-mapping, and the entire WhatsApp-approval command/verification model (§2.8) are unbuilt | Medium | Build once Business API credentials + phone-mapping data exist | Future enhancement |
| NOTIF-4 | Delegation notifications reach assigned Director/Manager/responsible-Director/accountable-lead per addressing rules | Partially Implemented | Director-only notifications fire correctly on every real transition (`delegations.ts`); Manager/multi-Director paths can't fire because DEL-1 isn't implemented | Same root cause as DEL-1/DEL-6 | Medium | With DEL-1 | Required before pilot |
| NOTIF-5 | Provider interface pattern (so a real channel can be dropped in without touching callers) | Implemented | `NotificationProvider` interface (`interface.ts:11-14`), 3 implementations (mock/graph/whatsapp) selected via `getNotificationProvider()` factory | None — this is a genuinely reusable, well-formed interface | — | — | — |

### 2.8 WhatsApp Approval Requirements (specific, if WhatsApp is scoped in)

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| WA-1 | APPROVE/REJECT/COMMENT/REVIEW/MORE INFORMATION commands | Missing | `WhatsAppNotificationProvider` only implements outbound `notify()`; no inbound command parser exists | Entire inbound-command surface absent | Medium | Design once real WhatsApp Business API integration is scoped | Future enhancement |
| WA-2 | WhatsApp summary content (reference/title/Director/dept/purpose/decision/urgency/due date/portal link) | Missing | No message-templating logic exists beyond the generic `NotificationInput.message` free-text field | Same root cause | Medium | With WA-1 | Future enhancement |
| WA-3 | Portal-only carve-outs (>K50k, substantial docs, SEMC/Board decisions, high-risk, signature-pending) | Not Verifiable | No approval-via-WhatsApp path exists to scope at all | — | — | Design with WA-1, cross-reference FIN-1 | Future enhancement |
| WA-4 | Phone-mapping, exact reference+version, expiring confirmation, replay protection, audit | Missing | None of this exists; correctly, the current code makes no attempt to fake it (`DigitalSignatureUnavailableError`-style honesty, §2.9) | Full security model for WhatsApp approval is unbuilt | Medium (would be High if faked — it isn't) | Build only alongside real Business API integration; do not approximate | Future enhancement |

### 2.9 Digital Signature Readiness

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| SIG-1 | No fake signatures / pasted images / false "signed" claims | Implemented (as a negative requirement) | `DigitalSignatureProvider` interface + `UnavailableSignatureProvider` — every method throws `DigitalSignatureUnavailableError` (`signature/interface.ts:46-51`); zero mock that pretends success, deliberately unlike every other provider in this codebase | None | — | — | — |
| SIG-2 | Interface shape (signer identity, timestamp, cert reference, doc hash, validation status) | Implemented | `SignatureRequest`/`SignatureRecord` (`signature/interface.ts:12-36`) carry exactly these fields | None — ready for a real provider to be dropped in | — | — | — |
| SIG-3 | Surfaced as "Coming Soon," not hidden | Implemented | `<ComingSoonBadge label="Digital signature" />` next to CEO vetting (`executive-dashboard/page.tsx:398`) and Board decisions (`submissions/[id]/page.tsx`) | None | — | — | — |

### 2.10 Role Permissions and Audit

See §5 for the full role-by-role review; matrix rows below cover cross-cutting audit/permission mechanics.

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| RBAC-1 | Every sensitive action produces an audit record (append-only) | Implemented | `recordAuditEvent()` (`audit/auditLog.ts`) called from every workflow transition (`transitionSubmission`, `transitionDelegation`, board transitions) and from the document-download route (`DOCUMENT_VIEWED`, `#A31`) | One disclosed historical loss: 17 pre-existing `WorkflowTransition` rows deleted by an over-broad test-cleanup query during `#A30` (documented in `assumptions-and-decisions.md#A30`, not hidden) — not a code defect, a one-time operational mistake already disclosed | Low (already disclosed, already mitigated by "preview deletes with SELECT first" discipline going forward) | None needed beyond what's already documented | — |
| RBAC-2 | Administrators must not automatically get governance-content access | Partially Implemented (built, then orphaned) | `canReadGovernanceContent()`/`GOVERNANCE_CONTENT_ROLES` (`rbac.ts:33-43`) implement exactly this rule correctly — but have **zero call sites anywhere in `src/`** outside their own definition (confirmed by grep). The actual enforced rule instead lives redundantly inside `assertCanAccessSubmission`'s `hasOversight` check, which *does* include `SYSTEM_ADMIN` unconditionally (`submissions.ts:36-41`) — i.e., the code that's actually wired up **contradicts** the dead function's intent | A correctly-designed guard exists but isn't used; the guard that *is* used grants `SYSTEM_ADMIN` broader access than the unused one intends | Medium — a real, if narrow, security-design inconsistency | Either wire `canReadGovernanceContent` into `assertCanAccessSubmission` (tightening `SYSTEM_ADMIN`) or delete the dead code and document the actual intended rule | Required before pilot |
| RBAC-3 | Object-level access control for forwarded reports | Missing | Same finding as WMR-5 | — | — | — | Required before pilot |
| RBAC-4 | Role granularity matches the 10 named personas (CEO/EO/PA/Secretariat/Directors/Managers/SEMC Members/Board Secretariat/Board Members/Admin) | Partially Implemented | 8 of 10 exist as role codes with at least a landing page; `SMC_MEMBER`("SEMC Member" equivalent)/`SMC_SECRETARIAT` are seeded but land on a `ComingSoonPage` stub and gate nothing anywhere in `src/` outside their own definitions (confirmed by grep — no `requireAnyRole`/`hasAnyRole` call site references either code). No EO/PA role exists at all | 2 roles are vestigial (seeded, unused); 1 role (EO/PA) doesn't exist | Medium | See §5 for the full breakdown | Required before pilot |

### 2.11 Modular Reuse

See §6 and §8 for full detail; summary rows:

| ID | Requirement | Status | Evidence | Gap | Risk | Recommended action | Milestone |
|---|---|---|---|---|---|---|---|
| MOD-1 | One shared workflow engine across document types | Conflicting (deliberate, disclosed) | 4 independent table-driven state machines (`submissions/workflow.ts`, `delegations/workflow.ts`, `board/meetings.ts`, `board/resolutions.ts`) share an identical *pattern* (states array + transitions table + a `transitionX()` that writes entity+`WorkflowTransition`+`AuditEvent`) but are not one importable engine | This directly contradicts the spec's explicit instruction, but the codebase's own history shows an *earlier* client instruction said the opposite ("do not build a generic workflow engine") — flagged, not silently resolved, in `assumptions-and-decisions.md#A31` | Medium — needs NICTA's explicit call | Confirm which instruction should win; if "one engine," extract `src/lib/workflow/engine.ts` as a bounded refactor now that 4 domains prove the pattern | Required before pilot (pending confirmation) |
| MOD-2 | Provider-interface pattern for every external integration | Implemented | Auth, document storage, Kanban, AI, notifications (mock/graph/whatsapp), digital signature — all behind interfaces with a factory selected by env var (`docs/assumptions-and-decisions.md#A3,A7,A13`) | None | — | — | — |
| MOD-3 | Business logic not embedded in UI components / not hardcoded by role or doc type | Mostly Implemented, with named exceptions | Traffic-light logic is correctly centralised (KPI-4). Counter-examples: `PortalSidebar.tsx:571-602`'s two approval-count queries duplicate filter logic that also exists in `approvalInbox.ts`/`decisions.ts` (a deliberate, documented "redundant re-check avoided" tradeoff, `#A31` decision log) — small but real duplication | One documented, bounded instance of duplicated business logic | Low | Low priority — the duplication is between two already-tested code paths | Future enhancement |
| MOD-4 | Orphaned/dead authorization code | Conflicting | `canReadGovernanceContent`, `departmentScopeForRole`, `requireDepartmentAccess` (`rbac.ts`) all have zero callers anywhere in `src/` (confirmed by grep) | Dead code that looks load-bearing (it's exported from the central `rbac.ts`) is a real maintainability/audit risk — a future developer could reasonably assume it's enforced somewhere | Medium | Wire it in or remove it — see RBAC-2 | Required before pilot |

---

## 3. Current Workflow (as implemented, not as intended)

**SMC submission path** (`src/lib/submissions/workflow.ts:10-32`):

```
DRAFT → SUBMITTED → AI_REVIEWED → SECRETARIAT_REVIEW → { RETURNED → SUBMITTED (loop) | ACCEPTED } → ROUTED → CLOSED
```

Layered on top, independent of `workflowStatus`: `endorsedForBoard` (CEO's binary decision,
`markEndorsedForBoard`/`markNotVettedForBoard`, `review.ts:162-243`, requires `ACCEPTED`/`ROUTED`)
unlocks the Director's ability to author a **second, separate** `Submission` (category `BOARD`) via
`submitBoardPaper()`.

**Board Paper path**: a Board `Submission` only ever occupies `DRAFT`/`SUBMITTED`/`CLOSED`
(`StatusBadge.tsx:19-24`; confirmed no code path drives it through `SECRETARIAT_REVIEW`/`ACCEPTED`/
`ROUTED`). Once `SUBMITTED` and linked to a `PUBLISHED`+ `Meeting`, Board Members record individual
votes as `Decision` rows (`decisionType` ∈ 7 literals, `decisions.ts:11-19`); `evaluateBoardOutcome()`
(`approvalRules.ts:30-45`) suggests an outcome (any Reject wins, else Defer, else
RequestFurtherInformation, else Approve) with **no quorum/majority/roster logic**; Secretariat
manually finalizes onto `Submission.boardOutcome`.

**Board meeting lifecycle** (`board/meetings.ts:15-32`):
`DRAFT → PUBLISHED → IN_PROGRESS → COMPLETED → ARCHIVED` (plus `CANCELLED` from `DRAFT`/`PUBLISHED`).
Only meetings with `meetingType: BOARD` ever get agenda items, minutes, resolutions, or
decisions-with-votes — **SMC meetings never do**.

**Delegation path** (`src/lib/delegations/workflow.ts:9-20`):
`DRAFT → ISSUED → ACKNOWLEDGED → IN_PROGRESS ⇄ AT_RISK → SUBMITTED_FOR_REVIEW → { RETURNED_FOR_MORE_WORK → IN_PROGRESS (loop) | COMPLETED → CLOSED }`,
CEO↔Director only, single Director per delegation.

**What does not exist as a workflow at all** (confirmed by exhaustive grep, not assumed): Weekly
Manager reporting, Milestone tracking, Memo/BAU approval, financial delegation routing, appointment
scheduling, SEMC-as-a-meeting deliberation. These have no state machine because they have no model.

---

## 4. Required Workflow Comparison

| Area | Required | Actual | Verdict |
|---|---|---|---|
| Weekly Manager reporting | Manager submits weekly → Director reviews/validates/returns → consolidated into Director Summary → CEO sees only summaries | Does not exist — `ActivityUpdate`'s matching fields are schema-only, zero UI/service touches them | Not implemented |
| Director validation | Director validates progress, links to KPI/KRA, converts issues to actions | `addActionItem` is real but disconnected from `ActivityUpdate`; the review-status fields are dead | Not implemented |
| CEO summaries | CEO sees consolidated dept summaries, not raw reports, with a Forward-to-CEO override for specific reports | CEO gets org-wide raw access to *every* `Submission` via `hasOversight` in `assertCanAccessSubmission` (`submissions.ts:36-41`) — the opposite of the required default (summary-only, opt-in detail) | Implemented in the wrong direction — a real design conflict, not a gap |
| SEMC workflow | Director→Secretariat vet→CEO pre-meeting review (6 actions)→agenda→deliberate→decisions+CEO comments→actions→Board escalation recommended→CEO confirms→archive | Paper-vetting half real (Secretariat 4 actions + CEO binary endorse/not-vet); meeting-deliberation half (agenda/minutes/decisions/actions at an SEMC meeting) does not exist | Partially implemented, and the CEO's 6 pre-meeting actions don't match what's actually CEO-gated (SEMC-7) |
| Memo approval | Unified queue, 13 doc types, rich CEO action set, memo lifecycle | Queue exists and is real but only spans 2 of 13 types; no Memo model, no rich action set | Not implemented (memos), partially implemented (queue mechanism) |
| Financial routing | 4-tier threshold routing with Board escalation | Does not exist anywhere | Not implemented |
| Delegations | CEO→(one/many Directors, or Manager directly, or Director-then-Manager), 10 categories, 6 Director actions, 8 statuses | Real, tested-in-spirit (live-verified per decision log) CEO→single-Director workflow; Manager addressing is a write-only unused field; no categories; 4 of 6 Director actions implemented | Substantially implemented for the single-Director case; the multi-target addressing model is not |
| Appointments | Scheduling, Outlook/Teams readiness, accept/decline/report | Does not exist, not even as an interface stub | Not implemented |
| Notifications | Portal (real) + Email (real) + WhatsApp (real, with strict approval controls) | Portal real; Email is an unimplemented stub behind a real interface; WhatsApp is an honest unimplemented stub behind a real interface, correctly labelled "Coming Soon" | Partially implemented — architecturally ready, not functionally live for 2 of 3 channels |

---

## 5. Role and Permission Review

| Role (spec) | Codebase role code | Landing page | Real permission logic found | Assessment |
|---|---|---|---|---|
| CEO | `EXECUTIVE_VIEWER` | `/executive-dashboard` (real) | `CEO_ROLES` gates used consistently across `submissions.ts`, `delegations.ts`, `approvalInbox.ts`, `ceoComments.ts`, `criticalTasks.ts` | Implemented |
| Executive Officer / PA | **none** | — | No role code, no delegated-review model | Missing (§2.4 CEOOFC-1) |
| Corporate Secretariat (= SEMC Secretariat) | `REVIEWER_SECRETARIAT` | `/review-queue` (real) | `REVIEWER_ROLES` gates `acceptSubmission`/`returnSubmissionForCorrection`/`routeSubmission`/`closeSubmission` | Implemented (as SMC Secretariat; SEMC-naming gap per SEMC-1) |
| Directors | `SUBMITTER` (does the submitting), `DIRECTOR` (separate code, "Department Director (Workplans)") | `/submissions` (real) / `/department-dashboard` (**`ComingSoonPage` stub**) | `SUBMITTER` is the code every Director-facing check actually uses; `DIRECTOR` gates almost nothing live | `SUBMITTER` implemented; `DIRECTOR` vestigial |
| Managers | `MANAGER` | `/my-workplan` (**`ComingSoonPage` stub**) | Only real usage: one branch of `canAccessDepartment` (`rbac.ts:48-51`), which itself has no callers anywhere in `src/` | Role exists, gates nothing real anywhere |
| SEMC Members | `SMC_MEMBER` | `/smc/dashboard` (**`ComingSoonPage` stub**) | Zero call sites outside `roles.ts`/`rbac.ts` definitions (confirmed by grep) | Seeded, entirely unwired |
| Board Secretariat | `BOARD_SECRETARIAT` | `/board/dashboard` (real) | Real, and recently fixed: previously had **no** access path to Board Papers at all until `#A30` found and fixed the gap | Implemented |
| Board Members | `BOARD_MEMBER` | `/board/dashboard` (real) | Real, fail-closed meeting-status gating (`submissions.ts:56-67`) | Implemented |
| System Administrator | `SYSTEM_ADMIN` | `/admin` (real) | Broad: included in nearly every `*_ROLES` array as an emergency-override precedent, including `hasOversight` on submissions — i.e. **does** get governance-content access today, contrary to the requirement (RBAC-2) | Implemented, but over-scoped relative to the stated requirement |

**Cross-cutting finding**: `canReadGovernanceContent()` was written specifically to implement "Admins
must not automatically get governance content access" but is dead code (RBAC-2/MOD-4) — the actual
enforced behavior contradicts the documented intent of that unused function.

---

## 6. Data Model Review

**Existing reusable models directly relevant to this spec**: `Department`, `Role`/`UserRole`,
`ReportingPeriod`, `Submission`/`SubmissionVersion`/`SubmissionAnnexure`, `Meeting`/
`MeetingAgendaItem`/`MeetingMinutes`/`MeetingAttendance`, `Decision`, `Resolution`, `ActionItem`,
`Delegation`, `Comment` (polymorphic `entityType`/`entityId`), `WorkflowTransition`, `AuditEvent`,
`Notification`, `DepartmentPerformance`.

**Models needing extension** (not new models, additive columns/enums only):
- `Delegation`: add `category` (DEL-2), consider a join table for multi-Director addressing (DEL-1),
  make evidence/comment mandatory at completion (DEL-4).
- `Deadline`/reporting-window: add required-departments/required-annexures (SEMC-3).
- `MeetingMinutes`: add agenda-item linkage and an archive transition (SEMC-10).
- `Comment`: already generalized; extending its `entityType` coverage to `MeetingAgendaItem`/
  `ActionItem` UI is a small follow-up, not a schema change (per `known-limitations.md`).

**Missing relationships / new models required** (not extensions — genuinely new):
- A weekly `ManagerReport` (or repurposed `ActivityUpdate`) model wired to real UI (WMR-1).
- A `Milestone` model with CEO-set targets and an approval/change-audit trail (KPI-2/KPI-9).
- A `Memo` model with its own ~10-state lifecycle (MEMO-2/MEMO-3).
- A financial-routing concept — either fields on `Memo` or a distinct `FinancialApproval` model, plus
  a configurable threshold/matrix table (FIN-1/FIN-2).
- An `Appointment` model (APPT-1).
- An object-level access-grant model for "Forward to CEO" (`entityType`/`entityId`/`grantedToUserId`)
  (WMR-5/RBAC-3).
- If SEMC needs its own deliberation workspace distinct from Board meetings (pending NICTA
  confirmation, SEMC-6): no new models needed — `MeetingAgendaItem`/`MeetingMinutes`/`Resolution`
  already generalize over `Meeting.meetingType`; only new UI/service wiring for the `SMC` meeting type
  is required.

**Duplicate concepts found**:
- `Decision.decisionType` serves two different purposes (a formal SMC/Board registry entry historically,
  and individual Board Member votes since `#A30`) via the same free-text column — functional, but a
  naming trap for a future reader (`assumptions-and-decisions.md#A30` documents this explicitly).
- `endorsedForBoard` (CEO's "send to Board" call) vs. `boardOutcome` (Board's own final decision) are
  correctly kept distinct despite similar shape — not a duplicate, flagging only because they're easy
  to confuse by name.

**Status inconsistencies found**:
- `SubmissionReview.outcome`'s schema comment lists 10 values; only 2 are ever written (SEMC-8) — the
  comment should be corrected to match reality, or the other 8 should be implemented.
- `ActionItemStatus` enum carries two overlapping vocabularies (`OPEN/IN_PROGRESS/DONE/OVERDUE` for the
  original non-Board call site, `NOT_STARTED/AT_RISK/COMPLETED/CLOSED` for Board actions) in the same
  enum, by design (`schema.prisma:706-719`, documented) — worth flagging to NICTA as a display-layer
  inconsistency even though it's intentional.

**Migration implications** (not created — described only, per instructions): every "needing extension"
item above is additive (new nullable columns/enum values), consistent with this codebase's existing
migration discipline (never edit an existing migration). Every "new model" item is a standalone
`CREATE TABLE`. None require backfilling a required column against non-empty data *except* if a
`Milestone`/`Memo`/`ManagerReport` model is later given a required FK back onto existing `Submission`
or `Department` rows — that would need the same `DEFAULT`-value migration-editing pattern already used
twice in this project's history (`#A30` twice, for `ActionItem.updatedAt`).

---

## 7. UI/UX Review

**Required CEO sidebar vs. actual `CeoNav`** (`src/components/PortalSidebar.tsx:231-320`):

| Required section | Required item | Actual |
|---|---|---|
| Executive Overview | CEO Dashboard | ✅ "Executive Overview" → `/executive-dashboard` |
| | Approval Inbox | ✅ with live badge count |
| | Notifications | ✅ |
| Performance and Monitoring | Organisational KPIs & KRAs | ✅ "Performance & KPIs" |
| | Milestones | ❌ Missing |
| | Department Performance | ✅ "Departments" |
| | Director Summaries | ❌ Missing |
| | Weekly Management Overview | ❌ Missing |
| | Critical Risks | ⚠️ Only as a dashboard panel ("Critical Tasks & Escalations"), not a nav item |
| Executive Reporting | SEMC Reporting Window | ❌ Missing |
| | SEMC Reports & Papers | ⚠️ "SMC Submissions" exists but is the Director-authoring view, not an SEMC-scoped reports register |
| | SEMC Meetings & Deliberations | ❌ Missing |
| | SEMC Decisions & Actions | ❌ Missing |
| | Board Escalations | ❌ Missing |
| | SEMC Minutes & Archive | ❌ Missing ("Archive" that exists is `/board/archive`, Board-only) |
| Executive Management | Memos & BAU Approvals | ❌ Missing |
| | Director Delegations & Tasks | ✅ "Delegated Tasks" |
| | Manager Delegations | ❌ Missing |
| | Appointments & Invitations | ❌ Missing |
| | CEO Comments | ✅ |
| Settings | Account | ❌ Missing (only present as a *disabled* placeholder in the unrelated `DefaultNav`, not in `CeoNav` at all) |
| | Sign Out | ✅ |

**Extra items present but not in the required list**: "Board Papers" and "Archive" (Board-scoped) — not
harmful, just outside spec scope.

**Result: 9 of 23 required items map to a real page; 0 are disabled placeholders (the CEO nav uses
no "Soon" pattern at all, unlike other roles' navs); the remaining ~14 simply don't exist as routes.**
This matters for the "disabled placeholder" distinction the review method asks for: the CEO sidebar
doesn't signal these as "coming later" the way `DefaultNav`/`SecretariatNav` do for their own
not-yet-built items (`DisabledSidebarLink`, `PortalSidebar.tsx:649-673`) — a user with only the CEO
role has no in-app signal that Milestones/Director Summaries/SEMC Meetings/etc. are planned rather than
simply absent.

**Dashboard cards** (`/executive-dashboard`): 6 stat cards present (Org KPI, KRA Progress, Papers
Awaiting Approval, Overdue Activities, Board-Ready Papers, Departments At Risk) against the spec's 15
named metrics — roughly 6 of 15 are shown; missing from the dashboard specifically: Milestone progress,
Weekly reporting compliance, Director summaries, Memos awaiting approval, Financial approvals, Board
escalations, Upcoming appointments (all Missing per §2, so absence here is consistent, not a separate
bug).

**Graphs**: `TrendLineChart` (hand-rolled inline SVG, no external chart library) renders real KPI/KRA
trend data — implemented and reusable (used on both `/executive-dashboard` and
`/executive-dashboard/performance`).

**Traffic lights**: implemented via `RiskStatusPill`, consistently styled, backed by the reusable
service (KPI-4).

**Empty states**: present and consistent — `EmptyState` component used for trend/critical-tasks/
delegations/approval-inbox/submissions-by-department (`executive-dashboard/page.tsx`); "Nothing is
currently awaiting your decision" pattern repeated across `/executive-dashboard/approvals`,
`/board/approvals`.

**Loading and error states**: **absent**. `Glob` for `src/app/**/loading.tsx` and `src/app/**/error.tsx`
returns zero files anywhere in the app — every page relies on Next.js's default (blank-until-ready,
generic error overlay) rather than a designed loading/error UI. This applies portal-wide, not just to
the CEO/Board dashboards.

**Responsive behaviour**: Tailwind responsive classes (`sm:`, `lg:`, `xl:`, `2xl:`) are used throughout
the dashboard grids (e.g. `executive-dashboard/page.tsx:129`, `:170`, `:236`) — a real responsive
design intent, not fixed-width markup; not independently verified at specific breakpoints as part of
this (non-mutating, no dev-server-driven) review.

---

## 8. Integration Review

| Integration | Readiness | Evidence |
|---|---|---|
| Microsoft Entra ID | Implemented against contract, not live | `EntraAuthProvider` (`@azure/msal-node`), selected via `AUTH_PROVIDER=entra`; requires 4 env vars; falls back to `mock` (zero-credential) otherwise — `docs/assumptions-and-decisions.md#A3` |
| SharePoint | Implemented against contract, not live | `DOCUMENT_STORAGE_PROVIDER=sharepoint`, throws a clear config error without credentials (`known-limitations.md`) |
| Outlook | Not started | No provider interface exists at all (unlike SharePoint/Entra/AI/Notifications/Signature, which all at least have a stub) |
| Teams | Not started | Same as Outlook |
| Email | Interface exists, not implemented | `graphProvider.ts` under `NOTIFICATION_PROVIDER=graph`, throws without live credentials, no real send logic written yet |
| WhatsApp | Interface exists, not implemented, honestly labelled | `whatsappProvider.ts` (NOTIF-3) |
| Future digital signatures | Interface exists, deliberately non-functional (correctly) | `signature/` (SIG-1/SIG-2/SIG-3) |

**Assessment**: the codebase's provider-interface discipline (MOD-2) means every *scoped* integration
has a clean seam ready for real credentials. Outlook/Teams are the exception — they were never even
scaffolded, which tracks with Appointments (APPT-1) not existing as a feature to integrate them with.

---

## 9. Security and Audit Review

| Area | Finding |
|---|---|
| Object-level report visibility | **Not implemented.** `assertCanAccessSubmission` is role/ownership/meeting-status based only — no per-object grant primitive exists anywhere in the codebase (WMR-5). This is the most consequential security gap relative to the spec, since "CEO must not automatically receive every detailed Manager report" is a stated requirement and the current `hasOversight` branch does the opposite for `Submission` (CEO/Secretariat/Admin get unconditional org-wide read) — by design for submissions specifically, but there's no *Manager report* to test since WMR-1 doesn't exist yet. |
| Forward-to-CEO access | **Not implemented** — zero matches for the concept anywhere (WMR-5). |
| Financial approval authority | **Not implemented** — no financial model exists to have an authority model over (FIN-1). |
| WhatsApp verification | **Not implemented, correctly not faked** — `WhatsAppNotificationProvider` throws rather than pretending to deliver/verify (NOTIF-3, WA-4). |
| Stale document approval | **Not applicable yet** — no approval-with-versioning flow exists outside `SubmissionVersion` (used for edit history, not approval-staleness checking); Decision votes do snapshot `submissionVersion` at record time (`Decision.submissionVersion`, `schema.prisma:673`), which is a real, if narrow, defence against voting on a stale version — worth confirming this is actually read/enforced anywhere it's displayed (not independently traced in this pass). |
| Duplicate approval | Board votes are explicitly append-only-by-design ("a changed vote is a new row, not an edit," `#A30` decision log) with only the *latest* row per user treated as authoritative by `approvalRules.ts`/UI — this correctly prevents a stale duplicate from being double-counted, though it means the vote history itself isn't literally "one vote per person" at the row level (by design, matches the append-only convention). |
| Audit completeness | **Mostly complete, one disclosed loss.** Every real workflow transition is audited (RBAC-1); the 17-row loss during `#A30` test cleanup is disclosed in the decision log, confirmed not to affect any live functional state, and not recoverable (no soft-delete in this schema). |
| Soft deletion | **Does not exist anywhere in this schema** — every "delete" in this codebase's history has been either (a) a deliberate `isActive: false` deactivation pattern (`User`, `Department`, `Template`) or (b) an irreversible hard delete during test cleanup (disclosed above). No entity in scope for this review has a genuine soft-delete/undo path. |
| Historical record preservation | Append-only convention is real and consistently followed for `WorkflowTransition`/`AuditEvent`/`SubmissionVersion`/`ActivityUpdate` versioning/`MeetingMinutes` versioning — the one exception is the disclosed 17-row loss above, which was an operational mistake, not a design gap. |

**Note on test evidence**: this review did not start the Postgres container or run `npm test`
(per the explicit "do not start the database... unless explicitly authorised" instruction). The
codebase's own `docs/assumptions-and-decisions.md#A31` states 34/34 tests passed as of the last
commit before this review — that claim is **Not independently re-verified** here; it is carried
forward as documented prior evidence, not confirmed live. `npx tsc --noEmit` and `npx next lint` were
run live during this review and are clean (no output / "No ESLint warnings or errors").

**Test coverage inventory** (3 files total, confirmed by direct read): `boardDashboard.test.ts` (Board
permissions, paper/meeting visibility, approvals, comments, resolutions, audit — 21 tests per prior
documentation), `executiveDashboard.test.ts` (CEO-role gating, Approval Inbox aggregation, the
document-access regression fix — 8 tests), `riskService.test.ts` (traffic-light threshold boundaries —
5 tests). **No automated test exists for**: the Delegations feature (`#A29` — verified only via a
throwaway, since-deleted Playwright script per its own decision log, not an automated suite),
`approvalRules.ts`'s `evaluateBoardOutcome` specifically, `minutes.ts`, `actionItems.ts`, or any of the
requirement areas confirmed Missing in §2 (they have no code to test).

---

## 10. Prioritised Gap List

**Critical for MVP**
- Weekly Manager Reporting (WMR-1 through WMR-8) — named explicitly as MVP-shaping in the spec, and
  currently has zero implementation surface (schema field exists, nothing else does).

**Required before pilot**
- Milestone tracking + CEO validation workflow (KPI-2, KPI-7, KPI-8, KPI-9)
- Forward-to-CEO / object-level access grant primitive (WMR-5, RBAC-3)
- SEMC meeting workspace decision + build (SEMC-6, SEMC-7, SEMC-9, SEMC-10) — the single largest
  architectural question in this review; needs NICTA's confirmation before scoping
- CEO Memos & BAU Approvals model (MEMO-1 through MEMO-4, CEOOFC-1)
- Financial delegation routing (FIN-1 through FIN-4)
- Delegation gaps: categories (DEL-2), Nominate-alternate/Assign-to-Manager actions (DEL-3), mandatory
  completion evidence (DEL-4), multi-Director/direct-to-Manager addressing (DEL-1)
- Dead-code reconciliation: `canReadGovernanceContent`/`departmentScopeForRole` (RBAC-2, MOD-4)
- Workflow-engine architecture decision (MOD-1) — confirm which of two contradictory prior
  instructions governs
- Threshold values reconciliation (KPI-6) and admin-configurability (KPI-5)

**Required before production**
- Real email delivery (NOTIF-2)
- Loading/error states across the app (§7)
- SharePoint/Entra credentials and live-tenant verification (§8, already scaffolded)

**Future enhancement**
- Appointments/Outlook/Teams (APPT-1 through APPT-3) — no scaffolding exists yet, largest single
  build-from-zero item but lowest urgency per the spec's own "Coming Soon" framing for M365 features
- WhatsApp real delivery + approval command model (NOTIF-3, WA-1 through WA-4)
- Digital signature real provider (already correctly deferred, SIG-1/SIG-2/SIG-3)
- Delegation status-label reconciliation (DEL-5)
- CEO-comment-to-tracked-action auto-conversion (WMR-8)

---

## 11. Recommended Implementation Milestones (proposed, not implemented)

1. **Decisions milestone (no code)**: NICTA confirms (a) SMC→SEMC naming/rename vs. distinct SEMC
   meeting workspace (SEMC-1/SEMC-6), (b) the workflow-engine question (MOD-1), (c) which role holds
   the 6 pre-meeting actions — CEO or Secretariat (SEMC-7), (d) real traffic-light threshold values
   (KPI-6), (e) whether financial routing is in scope for this portal or a separate finance system
   (FIN-1).
2. **Weekly Manager Reporting** (Critical for MVP): model, Manager UI, Friday-5pm-PGT deadline
   enforcement, Director review/validate/return workflow, Director Summary consolidation, CEO
   summary-only default view.
3. **Object-level access grants**: generalized "forward to user" primitive, applied first to
   Manager reports (once milestone 2 exists) and retrofittable to Submissions/Delegations later.
4. **SEMC meeting workspace**: apply the Board module's already-generalized `MeetingAgendaItem`/
   `MeetingMinutes`/`Resolution`/`Decision` models to `meetingType: SMC`, per milestone 1's decision.
5. **Milestones + CEO validation workflow**: new model, target-change audit trail, CEO
   review/validate/return actions.
6. **CEO Memos & BAU Approvals**: new model, lifecycle, CEO action set, Approval Inbox extension,
   EO/PA role + scoped delegated-review.
7. **Financial delegation routing**: threshold/matrix config, applied on top of milestone 6's Memo
   model.
8. **Delegation completeness**: categories, Nominate-alternate/Assign-to-Manager actions, mandatory
   completion evidence, multi-Director addressing.
9. **Appointments**: new model, provider-interface scaffold (Outlook/Teams, mirroring the
   signature/WhatsApp "unavailable until configured" pattern), Director accept/decline/report flow.
10. **Production-readiness pass**: real email provider, loading/error states, live-tenant
    verification of Entra/SharePoint, dead-code reconciliation (RBAC-2/MOD-4).

---

## 12. Questions and Assumptions

1. **Is "SEMC" a rename of the existing "SMC" concept, or does it require its own meeting-deliberation
   workspace distinct from Board meetings?** This is the single most consequential open question — it
   determines whether SEMC-6/SEMC-7/SEMC-9/SEMC-10 are a large build or a labelling exercise.
2. **Which of the two contradictory prior instructions on a shared workflow engine should govern?**
   (MOD-1 — already flagged once before, in `#A31`'s own decision log, still unresolved.)
3. **Should `SYSTEM_ADMIN` retain unconditional governance-content access**, or should the already-written
   but unused `canReadGovernanceContent()` restriction actually be enforced? (RBAC-2)
4. **Is financial delegation routing meant to live inside this portal**, or is it a routing/notification
   layer in front of a separate finance system this portal only surfaces status from? The spec's wording
   ("the current portal-routing thresholds") suggests the former, but no finance-system integration
   exists to confirm against.
5. **What are NICTA's real KPI/KRA traffic-light thresholds** (vs. the current 75%/50% demo values)?
6. **Should Delegation categories and the Manager-addressing paths (DEL-1/DEL-2) be built as an
   extension of the existing CEO→Director `Delegation` model, or does "Manager Delegations" in the
   required sidebar imply a structurally separate feature** (a Director→Manager chain, distinct from
   CEO→Director)? The current schema's `supportingManagerId` field suggests the former was intended but
   never finished.
7. **Does "Executive Officer" and "PA" need to be modelled as distinct roles**, or is one combined
   "CEO Office staff" role sufficient, given both share the same "manage the queue, cannot approve"
   authority profile in the spec?

---

*No source files, database models, migrations, seed data, dependencies, or environment variables were
modified in the course of this review. `npx tsc --noEmit` and `npx next lint` were run live and are
clean; the Postgres container was confirmed already running (`nicta-gov-portal-db-1`) but `npm test`
was not run as part of this review.*
