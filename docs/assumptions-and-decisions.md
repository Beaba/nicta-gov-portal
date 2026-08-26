# Assumptions and Decisions Log

Running log, most recent last. Each entry: what was decided, why, and what it means for a future
change.

## A1 — Repository start state

The target folder existed as a 0-byte file, not a directory. Replaced with a real directory before
any code was written. No prior conventions existed to inherit.

## A2 — Package manager and local database

pnpm + PostgreSQL via Docker Compose (`docker-compose.yml`, service `db`). Matches section 18's
stack recommendation exactly and keeps local dev "one `docker compose up` away" without requiring
a cloud database for the MVP.

## A3 — Auth behind a provider interface

`AuthProvider` (`src/lib/auth/types.ts`) exposes `getCurrentUser`, `signIn`, `signOut`. Two
implementations:

- `MockAuthProvider` — a "sign in as" demo-user picker. Session is a signed, encrypted cookie
  (`iron-session`) holding only the user id; role/department are re-read from the database on every
  request rather than trusted from the cookie, so a tampered cookie cannot grant elevated access.
- `EntraAuthProvider` — implemented against `@azure/msal-node` (authorization code flow). Requires
  `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_REDIRECT_URI`.
  Without them, `AUTH_PROVIDER` env var stays `mock` and the app runs fully in demo mode.

Selection is a single factory (`src/lib/auth/index.ts`) reading `AUTH_PROVIDER`. No route or page
imports a concrete provider directly.

## A4 — Role/department are reference data, not enums

`Role` and `Department` are Prisma models seeded at startup, not hardcoded enums, per the explicit
instruction in sections 2 and 3. Application code refers to roles by a stable `code` (e.g.
`MANAGER`, `DIRECTOR`) rather than by database id, so seed data can be renamed without breaking
authorization logic.

## A5 — Kanban stages and workflow states as enums, not reference data

Unlike departments/roles, Kanban stages (section 5) and SMC/Board workflow states (sections 10–11)
are modeled as Prisma enums / a code-level state machine, not admin-editable reference data. These
are backed by permission and transition logic (who may move what, in what order) that reference
data cannot express — changing them is a code change, which is appropriate for a governance
workflow that must stay auditable and consistent.

## A6 — "Secondary actor" fields are plain user-id strings, not FK relations

Fields like `ActivityUpdate.reviewedById`, `Decision.recordedById`, `WorkflowTransition.performedById`,
`SubmissionReview.reviewerId`, `ActionItem.ownerId` are stored as plain string user IDs without a
Prisma relation. The "primary" ownership relations that drive dashboards and access control
(Workplan.director/manager, Activity.responsibleOfficer, Submission.sponsoringDirector/
responsibleManager, Department, Meeting) are full FK relations. This keeps the schema navigable
at MVP scope; the application layer validates these ids against `User` at write time. Revisit if a
future phase needs to join/report on these fields directly in SQL.

## A7 — Kanban board data source

Section 6 requires Microsoft Lists as the canonical Kanban/workplan data source, but also requires
the app to run without a tenant. Resolution: the application's own PostgreSQL tables are the
concrete MVP data store, accessed only through a `KanbanRepository` interface
(`src/lib/providers/kanban/interface.ts`). A `MicrosoftListsKanbanRepository` stub documents the
Graph `/sites/{id}/lists` shape it would implement. Per section 6's own fallback language ("If
Planner integration is added, Microsoft Lists or the application database must remain the
authoritative reporting source unless a documented architectural decision establishes otherwise"),
this is recorded as the documented decision: **the application database is authoritative for the
MVP**; wiring the real Lists repository is next-phase work once a tenant exists (see
`docs/known-limitations.md`).

## A8 — DOCX template

No official NICTA Word template or logo was available. A placeholder `.docx` template with
NICTA-style heading placeholders and a field-mapping table is generated at
`templates/management-report-template-placeholder.docx`, documented in
`docs/word-template-mapping-guide.md`. Swapping in the real template only requires updating the
mapping doc's bookmark names to match, per that guide.

## A9 — Reporting periods and permitted paper types stored as JSON strings

`Deadline.permittedPaperTypes` / `requiredReviewers` are stored as JSON-encoded text columns rather
than a normalized join table, to keep the meeting-configuration schema simple for MVP scope. The
admin UI reads/writes them through a typed helper (`src/lib/config/deadlines.ts`) so callers never
touch raw JSON.

## A10 — Malware scanning

No real anti-malware engine is available in this environment. `src/lib/providers/documentStorage/malwareScan.ts`
defines the scan interface and ships a mock scanner that rejects a small deny-list of test
signatures (e.g. the EICAR test string) and otherwise marks files `CLEAN`, so the "scan before
SharePoint push" control point exists and is exercised by tests even though it is not a production
scanner.

## A11 — Time and deadline evaluation

All deadline comparisons happen server-side using the server's UTC clock converted to
`Pacific/Port_Moresby` via `luxon`. The client never determines whether a submission window is
open; the server route re-checks on every write, per section 12's explicit instruction not to trust
client time.

## A12 — Milestone 1 scope redirect (2026-08-20)

The client redirected delivery order: build strictly to a **Milestone 1** MVP (submission →
closed-AI template review → human secretariat review → accept/return → SharePoint/mock document
routing → closed, with Submitter / Reviewer-Secretariat / Administrator roles only) before any of
the workplan/Kanban/SMC-Board-governance/dashboard work the original brief and Phases 4–8 above
describe. Those phases are **not abandoned** — the schema, provider interfaces, and docs already
built for them (Kanban repository, executive-summary AI provider, department/role reference data,
audit log, deadline timezone handling) are explicitly preserved as foundations for later modules
per the client's instruction: "preserve any foundations already created for these future
capabilities, but do not allow them to delay the first working release." `docs/milestone-1-plan.md`
is the authoritative plan for this phase of work; `docs/00-implementation-plan.md` phases 4–8 remain
the roadmap for what comes after Milestone 1 ships.

## A13 — Modular monolith stays on Next.js, not a separate NestJS service

The client's suggested stack lists a NestJS backend alongside the Next.js frontend (mirroring an
unrelated project, DroPi). The client's own instructions take precedence when they conflict: "Follow
the existing repository stack and conventions if they are already established. Do not replace
working technology simply to match this list" and "Do not restart or unnecessarily redesign the
project." Next.js (App Router, route handlers, server actions) is already a working, established
foundation with real auth/provider code in it. Standing up a second NestJS process would (a)
duplicate the auth/session/provider-factory work already done, (b) require a second deployable and
an internal API contract between the two for no functional gain at this scope, and (c) constitute
exactly the "unnecessary redesign" the client warned against. **Decision:** the "modular monolith"
requirement is satisfied within the single Next.js application by organizing `src/lib` into
clearly separated domain modules (`identity` = existing `auth/`, `submissions/`, `templates/`,
`aiReview/`, `humanReview` folded into `submissions/` review actions, `documentRouting` =
`providers/documentStorage/` + `submissions/routing.ts`, `audit/`, `notifications/`, `msGraph` =
existing `auth/msalClient.ts` + Graph-based provider stubs) — one deployable, internally modular,
each module only reachable through its own `index.ts`/exported functions. Revisit only if a real
scaling need for an independently deployable service emerges post-MVP.

## A14 — Reference numbering, Template versioning, and AI review result modelling

- Reference numbers use a dedicated `SequenceCounter` table (`scope` e.g. `"SMC-2026"`, atomic
  `UPDATE ... SET value = value + 1 RETURNING value` via a transaction) rather than
  `COUNT(*) + 1`, which is race-prone under concurrent submissions. Format is a small template
  function (`src/lib/submissions/referenceNumber.ts`) so `SMC-2026-0001` can become a different
  pattern (e.g. per-department) without touching call sites.
- `Template` gained `paperType`, `isActive`, `effectiveDate`, and a `supersedesId` self-relation
  (mirroring the existing `ActivityUpdate` versioning pattern) so uploading a new template for a
  paper type never overwrites the previous approved file in place — it creates a new row and
  deactivates the old one, per the client's explicit "do not silently overwrite" instruction.
- AI template-review output is modelled as a new `AIReviewResult` table, not folded into the
  existing `AIGenerationRecord` (which is free-text, summary-shaped, for the future
  executive-summary module). Template review is structured (missing sections, warnings, suggested
  corrections as JSON arrays, a human-review status) and reused by a different provider interface
  (`src/lib/providers/aiReview/`) — forcing it through `AIGenerationRecord`'s shape would mean
  JSON-stringifying structured data into a field designed for prose.
- "Document routing" is not a new storage mechanism: `DocumentStorageProvider` (local/SharePoint,
  see A7) already computes the section-13 folder layout from `DocumentPlacementMetadata` at upload
  time. Routing for Milestone 1 means confirming/recording that computed destination on the
  `Submission` row (`routingFolderKey`, `routedAt`) when a reviewer accepts and triggers routing —
  not physically moving files after the fact. See `docs/milestone-1-plan.md` for the full state
  machine.

## A15 — Package manager is npm, not pnpm; Next.js patched to 14.2.35

`docs/assumptions-and-decisions.md#A2` originally chose pnpm, but no lockfile had actually been
committed and `node_modules` was empty at the start of this session — nothing pnpm-specific existed
to preserve. `npm install` was run (needed to actually fetch dependencies at all) and completed
successfully with a committed `package-lock.json`; redoing that as a pnpm install would have meant
repeating a ~6-minute, network-heavy install for no functional difference (package manager choice
doesn't affect application behavior). Kept npm. Separately, `npm install` surfaced that the
previously-pinned `next@14.2.18` has a disclosed security vulnerability
(https://nextjs.org/blog/security-update-2025-12-11); bumped to `14.2.35` (latest 14.2.x patch,
same major — not a framework upgrade) and `eslint-config-next` to match.

## A17 — Pixel-accurate redesign from a client-provided reference (2026-08-20)

The client shared a live reference build (`https://nicta-governance-portal.robertson-asari.chatgpt.site`)
as "how the website should look." Treated as the authoritative visual AND structural source for
the two screens it showed (SMC Submissions, Board Papers) plus the "Upload completed paper" modal
— not just a colour-palette hint — since it's an interactive prototype embodying the same flow the
client had already described in text. Concretely:

- **Colours were measured, not eyeballed**: extracted via Playwright's `getComputedStyle` against
  the live reference (exact hex/rgb values), not approximated from a screenshot. See
  `tailwind.config.ts`'s header comment for the full token table. The earlier `#A16` palette
  approximation is superseded by these exact values.
- **Logo/emblem**: the reference serves real files at `/png-emblem.png` and `/nicta-logo.png` on
  its own domain; downloaded directly into `public/`. This is different from `#A16`'s "no logo
  available" position — the client's reference is the source of the actual approved assets, not an
  invented placeholder. A production deployment should still confirm these are NICTA's
  brand-kit-authoritative files before shipping publicly.
- **Reference number format changed** to match the reference exactly: `SMC-26-042` (2-digit year,
  3-digit sequence), not `#A14`'s original `SMC-2026-0001` guess. `nextReferenceNumber()` also now
  takes a plain string scope (not the `SubmissionCategory` enum) so the same allocator backs Board
  Paper references (`BP-26-020`) — see `Submission.boardReferenceNumber` — which the reference
  shows as a genuinely separate register/sequence from the SMC reference, not just a filtered view.
- **Submission creation collapsed into one modal** (title + approved template + file → "Submit to
  SMC"), replacing the earlier full-page form (`#A16`'s six-field version, now deleted — this is
  in-scope-feature restructuring, not the "hide future modules" case `#A16` was protecting). No
  meeting picker is shown; `getCurrentSmcMeeting()` auto-assigns the nearest open SMC meeting,
  matching the register's "Current meeting" pill. `createAndSubmitPaper()` orchestrates the
  existing `createDraftSubmission`/`uploadMainDocument`/`submitSubmission` functions unchanged, per
  "preserve working foundations."
- **AI review severity softened**: since the modal no longer collects typed
  purpose/recommendation/proposed-decision fields, `MockAIReviewProvider` no longer treats their
  absence as `missingSections` (which forced FAIL) — it downgrades to a warning asking a human to
  confirm, because the mock has no document-text parser and must not claim to have verified content
  it never read. See `docs/known-limitations.md`.
- **Client Component boundary bug caught by typecheck**: an initial implementation passed a
  render-prop function (`trigger: (open) => ReactNode`) from a Server Component into
  `NewSubmissionModal` (`'use client'`) — functions aren't serializable across that boundary.
  Fixed by having the modal accept a plain `variant: 'button' | 'banner'` string and render its own
  trigger internally.

Also: this npm version enforces an install-script allowlist (`npm warn allow-scripts` /
`npm approve-scripts`) — `package.json`'s `allowScripts` block records the packages whose
postinstall scripts were reviewed and approved (`@prisma/client`, `@prisma/engines`, `prisma`,
`esbuild`, `unrs-resolver` — all standard build-tool postinstall steps, not application
dependencies). Re-approval is required if any of these packages' versions change.

## A16 — Directors Submission Portal first MVP (2026-08-20)

The client narrowed scope again, this time to a specific approved mock-up: only sign-in, SMC
Submissions (template selection, upload, AI review, submit), Corporate Services Director review,
"Vetted for Board" status, and a Board Papers view are visible. See `docs/mvp-directors-portal-plan.md`
for the full plan — summarized here are the decisions with the broadest blast radius:

- **No new role codes.** `SUBMITTER`/`REVIEWER_SECRETARIAT` are relabeled "Director" /
  "Corporate Services Director" in `SEED_ROLES` (`name` only — `code` is what rbac checks, per
  #A4) rather than introducing new codes, so every existing permission check, domain function, and
  test assumption keeps working unchanged. The pre-existing `DIRECTOR` code (future workplan
  module) is relabeled "Department Director (Workplans)" in listings to disambiguate.
- **Template selection replaces paper-type selection** on the create-submission form —
  `Submission.paperType` and `.templateId` are both derived server-side from the chosen
  `Template` row (`src/lib/submissions/submissions.ts`'s `createDraftSubmission`).
  `PaperType` reference data is untouched and still backs the Templates admin screen.
- **"Vetted for Board" is a flag, not a competing workflow state** —
  `Submission.vettedForBoard`/`vettedForBoardAt`/`vettedForBoardById`, set by
  `markVettedForBoard()` (`src/lib/submissions/review.ts`), requires ACCEPTED or ROUTED status
  but doesn't consume or replace either. The Review Submission screen's primary action,
  `acceptAndVetForBoard()`, does Accept + Vet in one click to match the client's one-step "reviews
  ... marks Vetted for Board" narrative, while `acceptSubmission` itself (usable standalone) is
  untouched.
- **Nothing was deleted.** `/admin`, `/admin/templates`, `routeSubmission`/`closeSubmission`
  (ACCEPTED → ROUTED → CLOSED), and every Milestone 1 workplan/SMC/Board placeholder route still
  exist, still enforce their role checks, and are still reachable by direct URL — only
  `src/components/AppHeader.tsx`'s nav list was trimmed.
- **Branding**: `tailwind.config.ts`'s colour tokens were renamed/re-valued from a blue scheme to
  approximate teal/turquoise/charcoal/white/restrained-orange (a global `nicta-blue` → `nicta-teal`
  rename across `src/`, plus new `nicta-turquoise`/`nicta-charcoal`/`status-accent` tokens). No
  logo or national emblem asset is bundled — none was available and fabricating one would
  misrepresent an official government emblem; see `docs/known-limitations.md`.
- A new `CORPORATE_SERVICES` department was added to `SEED_DEPARTMENTS` so the Corporate Services
  Director persona has a real department to belong to.

## A18 — Governance workflow expanded: Board Papers, Action Items, CEO, deadlines (2026-08-21)

The client described the full governance loop in prose (roles' real responsibilities, the
SEMC→Board handoff, action items, deadlines) rather than a visual reference — synthesized into
concrete changes:

- **Role naming**: `REVIEWER_SECRETARIAT` relabeled "Corporate Secretary" (superseding `#A16`'s
  "Corporate Services Director" — same code, just the client's later and more specific wording;
  matches a standard governance-officer title and fits "ensures deadlines are created"). No role
  codes changed — see `#A4`/`#A16` for why renaming `name` is always safe.
- **Board Paper is a real second submission, not a status flip.** Re-reading the client's own
  words — "after deliberation you are to submit a board paper... you would submit a board summary
  based on the comments" — the earlier `#A16`/`#A17` design (a `vettedForBoard` flag that just
  relabels the same SMC submission) was too shallow. Renamed to `endorsedForBoard` (SEMC's
  decision that a Board Paper _should_ be prepared) and reused the original brief's
  `smcSourceSubmissionId`/`boardSubmission` self-relation (dormant since the very first schema —
  see `#A6`) for the actual Board Paper: a distinct `Submission` row, `submissionCategory: BOARD`,
  its own `BP-26-020` reference, authored by the Director via `submitBoardPaper()`. It skips AI
  template review and the SECRETARIAT_REVIEW queue on purpose — the client's AI-vetting
  requirement is specific to "the SEMC Paper," and SEMC has already reviewed the underlying
  content — landing directly at a visible SUBMITTED status.
- **SEMC review is now three outcomes**, not two: Note (stays at SMC level — the old "Accept"),
  Endorse for Board (unlocks the Board Paper), Return for Correction (unchanged). No new schema —
  "Note" is just `acceptSubmission()` without also calling `markEndorsedForBoard()`.
- **Action Items reuse the existing `ActionItem`/`Decision` models** (in the schema since the
  first pass, unused until now — see `#A6`) but with a new direct `ActionItem.submissionId`,
  because the client's ask ("CEO and Corporate Secretary... put action items... on your paper")
  is direct and immediate, not gated behind first recording a formal `Decision`. `decisionId`
  stays available for a future pass that does want the fuller formal-decision flow.
- **CEO gets real read access**, not just a landing page: `listAllSubmissions()` (org-wide, no
  department/ownership scoping) backs a new `/executive-dashboard`, and
  `assertCanAccessSubmission()` grants `EXECUTIVE_VIEWER` read access to any individual submission
  — "reviews and reads," per the client.
- **Deadlines**: the original brief's `Deadline` model (`#A9`) gets its first real caller —
  creating an SMC meeting in `/admin` now optionally creates a linked `Deadline`
  (`normalCloseAt` = `lateCloseAt`, no separate late-submission window in this MVP). `/admin` and
  `/admin/templates` are now reachable by `REVIEWER_SECRETARIAT` as well as `SYSTEM_ADMIN` —
  "Corporate Secretariat is the Admin," stated directly.
- **Login page rebrand**: "NICTA Reporting and Governance Portal," matching the client's exact
  wording, replacing the earlier "NICTA Submission & Review Portal" placeholder title.

## A19 — Portal renamed; login page redesigned from a client-supplied mockup (2026-08-21)

The client supplied a login-page mockup (dark teal hero with a cream wave panel, gold accents, a
sign-in card) and asked to rename the portal to "Executive Management Reporting and Board
Submissions Portal," superseding `#A18`'s "NICTA Reporting and Governance Portal."

- **Rename applied everywhere a portal name appears**: `<title>`/metadata (`layout.tsx`), the login
  page headline, `AppHeader`'s secondary label (shortened to "Executive Reporting & Board
  Submissions" for header width), the Entra `not_provisioned` error copy, and this doc set. Role
  codes and DB content are unaffected — this is display text only, same pattern as `#A4`/`#A16`.
- **Login page rebuilt to match the mockup's layout**: a full-bleed dark teal hero (`nicta-teal-dark`)
  with a hand-drawn cream wave panel top-left (`LoginSwoosh`, carrying just the NICTA logo — the
  mockup omits the separate PNG national emblem shown elsewhere in the app), a gold vertical
  timeline rule, gold eyebrow/divider/footer text, faint concentric-ring decoration on the dark
  area (`LoginPatternRings` — abstract, not a reproduction of any specific cultural design, same
  rule as the removed `PatternBackdrop`), and a white sign-in card on the right.
- **The mockup's Email/Password/"Remember me"/"Forgot password" fields were not implemented.**
  This app has no local-password auth — only the `mock` demo-picker and real Entra ID (Microsoft
  OAuth) providers exist (see `CLAUDE.md`'s provider-interface convention and `#A3`). A form that
  visually accepts a password but doesn't check one would be misleading, not just non-functional.
  The card keeps the mockup's chrome (shield/lock icon, heading, divider, "Authorised NICTA
  personnel only" footer) but the actionable control is the real one for whichever provider is
  active: the Microsoft sign-in button (`entra`) or the scrollable demo-account list (`mock`).
- **Superseded/removed**: `PatternBackdrop.tsx` and its full-page tiled pattern (from the earlier
  login pass) — replaced by `LoginPatternRings` + `LoginSwoosh`, which match the new mockup
  instead.

## A20 — Mock sign-in switched from an account picker to an email/password form (2026-08-21)

Immediately after `#A19`, the client asked for the mockup's actual Email/Password fields instead of
the "Sign in as <name>" picker list, giving a specific test credential (`rasari@nicta.gov.pg` /
`12345`) to verify it with.

- **No local password store was added.** Per `CLAUDE.md`'s provider-interface convention, only
  `mock` and real Entra ID exist — there is still no password to check. `signInWithEmail()`
  (`src/app/login/actions.ts`) looks up the typed email against provisioned `User` rows exactly the
  way `completeEntraSignIn()` already does for real Entra callbacks (`#A3`) — unrecognized email ->
  the same "ask your Administrator" copy as the real `not_provisioned` error, reusing that pattern
  rather than inventing a second one. The password field is present (with a show/hide toggle,
  `PasswordField.tsx`) and required non-empty, but not cryptographically verified — the card copy
  says so plainly ("any password is accepted for an account your Administrator has already added").
- `signInAsDemoUser` and the primary/other-roles account-list UI were deleted outright (client:
  "no need to list the names") rather than kept behind a flag — nothing else referenced them.
- Verified against the live dev DB with the client's own test credential, landing correctly on
  `/submissions` as the Director persona provisioned earlier in the session.

## A21 — Real NICTA roster replaces per-department demo Directors/Secretariat (2026-08-21)

The client provided the actual departments, security-group structure, and named staff (five
department Directors, a Corporate Secretary, and a Senior Governance Officer, all with real
`@nicta.gov.pg` addresses) to provision for real, plus a SharePoint folder-provisioning spec (see
the document-storage rework, logged separately once that work lands).

- **Department names updated** (`src/lib/config/departments.ts`, re-applied to the live DB via
  `db:seed`'s idempotent upsert): `ECON_LICENSING` "Economics and Licensing" -> "Economics and
  **Licencing**" (client's exact spelling), `COMPLIANCE` "Compliance Department" -> "Compliance and
  Enforcement Department". The other four department names were already correct. Application code
  reads department names from the DB, never hardcodes them (`#A4`), so this was a pure data change.
- **Five real Directors provisioned** (`rasari@nicta.gov.pg` Robertson Asari/Digital Transformation,
  `sanda@nicta.gov.pg` Steven Anda/Engineering, `ckerua@nicta.gov.pg` Charles Kerua/Economics and
  Licencing, `plume@nicta.gov.pg` Polume Lume — "Acting Oversight" — /Compliance and Enforcement,
  `janania@nicta.gov.pg` Jonathan Anania/Corporate Services), each with **both** `SUBMITTER` (the
  role code `src/lib/auth/rbac.ts` actually checks before letting someone create/submit a paper —
  its display name is "Director", easy to confuse with the separate `DIRECTOR` role code) and
  `DIRECTOR` (the pre-existing, not-yet-built-out department-oversight role code, kept for
  forward-compatibility). Assigning only `DIRECTOR` would have silently left them unable to submit
  anything — the client's own group description ("Directors submit papers...") makes `SUBMITTER`
  load-bearing here, not optional.
- **Corporate Secretariat provisioned** (`ltol@nicta.gov.pg` Lilah Tol, Corporate Secretary;
  `bkuman@nicta.gov.pg` Britany Kuman, Senior Governance Officer), both `REVIEWER_SECRETARIAT`,
  Corporate Services department.
- **Superseded demo personas deactivated** (`isActive: false`, never deleted — any demo submissions/
  audit history they authored stays intact and visible), not recreated on future `db:seed` runs: the
  five demo directors for departments now covered by a real one, plus `submitter.demo@nicta.gov.pg`
  (Rachel Kaupa, the original primary demo Director persona) and `reviewer.demo@nicta.gov.pg`
  (Thomas Iga, the original demo Corporate Secretary). OCEO's demo director is untouched — no real
  OCEO Director was given, the CEO persona already covers that department.
- **`rasari@nicta.gov.pg` already existed** (provisioned via the admin UI earlier in the session, in
  Economics and Licencing) before this roster placed them in Digital Transformation instead. Seed
  upserts only ever _add_ a missing role/department assignment, never remove a stale one, so the
  seed script explicitly deletes any `SUBMITTER`/`DIRECTOR` `UserRole` row for these five directors
  that doesn't match their roster department, once, as part of seeding — otherwise re-running
  `db:seed` would have left Robertson Asari with submit rights in two departments.

## A22 — Document file names carry Department/Date/Sitting-number; Board Members can now sign in (2026-08-21)

The client described the end-to-end workflow again in prose and added two concrete requirements not
previously captured: a specific file-naming convention, and Board Member access to Board Papers.

- **File naming**: "documents are named based on the Department Name, SMC Date, SMC Board Sitting
  number." Read as a requirement on the destination _file_ name specifically (the folder path,
  built in the same pass that landed `#A21`'s sibling work, already encodes department/date/
  on-time-vs-late its own way and wasn't asked to change). `pathBuilder.ts`'s
  `documentFileNamePrefix()` prepends `{DepartmentFolder}_{meetingDate:YYYY-MM-DD}_{meetingNumber}_`
  to every SMC/Board document's file name, ahead of the existing `{referenceNumber}_{titleSlug}`
  (kept, not replaced — department+date+sitting-number alone would collide for every paper filed to
  the same department at the same meeting, and reference numbers are the schema's actual uniqueness
  guarantee). Applies to Board Paper files too, using the Board Paper's own department (inherited
  from its SMC source) — not just SMC ones. `meetingNumber` (the client's "sitting number") is a new
  field threaded onto `DocumentPlacementMetadata` alongside the pre-existing `meetingDate`, sourced
  from the same already-fetched `Meeting` row at every call site; falls back to the literal string
  `"NO-MEETING"` in the same rare no-linked-meeting case `meetingDate` already falls back to
  `createdAt` for (see `#A21`'s note in `docs/known-limitations.md`).
- **`BOARD_MEMBER` role added** — "This is another login that has to be made so the board can now
  access the papers." Not a new authentication system: the exact same email-lookup sign-in
  (`#A20`) every other role uses, just a new role code with its own scope. Read-only, and
  deliberately narrower than `EXECUTIVE_VIEWER`: `assertCanAccessSubmission()`
  (`src/lib/submissions/submissions.ts`) grants a `BOARD_MEMBER` access to a submission only when
  `submissionCategory === 'BOARD'` — never SMC papers, which the client was explicit stay internal
  to Directors/Corporate Secretary/CEO. Reuses the existing `/board-papers` register page (added to
  its role gate) rather than building a new screen — it already lists every Board Paper org-wide via
  `listBoardPapers()`. No real Board Member names were given, so two placeholder demo accounts were
  seeded (`board.member1.demo@nicta.gov.pg`, `board.member2.demo@nicta.gov.pg`), the same pattern as
  the still-placeholder CEO/Admin demo accounts.
- **Verified**: re-checked the `/api/documents/local/[...key]` download route end-to-end with an
  authenticated session (`#A21`'s CEO-document-retrieval concern) — it already worked correctly
  (Next.js decodes catch-all route params before this app's own code sees them, so the earlier
  suspicion of a double-encoding bug was unfounded), no fix needed there. Separately ran the full
  client-described workflow live through the real UI end to end (Director submits → Corporate
  Secretary endorses for Board → Director submits the Board Paper → CEO and a Board Member both view
  it via `/board-papers`) — everything worked, including seeing the new file-naming convention
  render correctly in the submission detail page's own "Document Destination" preview. Caught and
  fixed one small display bug this surfaced: `AppHeader`'s role-name label didn't recognize
  `BOARD_MEMBER`, showing "Portal user" instead of "Board Member" — added to the same allow-list
  `SUBMITTER`/`REVIEWER_SECRETARIAT`/`EXECUTIVE_VIEWER` already use.

## A23 — Deployment-readiness audit (2026-08-21)

"Ensure all is ready for deployment" — read as an audit-and-document pass, not an instruction to
actually provision or push anywhere (no real hosting/Postgres/Microsoft 365 credentials exist in
this environment to deploy against).

- **`npm run build` (a real production build, not just `tsc`/dev mode) verified clean** — this is a
  meaningfully different check than typecheck/lint/dev-mode, since production builds apply stricter
  checks. All 20 routes compiled with no errors. One operational note for future sessions: running a
  production build while the dev server is also running writes into the same `.next/` the dev server
  uses for its cache and leaves it serving 500s afterward — not a code bug, just restart the dev
  server (kill both `node.exe` processes matching `nicta-gov-portal`, same as the existing
  EPERM-on-`prisma generate` workaround) after building.
- **Security headers added** (`next.config.mjs`): `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
  `Strict-Transport-Security` (no `preload` — that's a separate, effectively-irreversible browser
  opt-in, deliberately left for a real decision later). No Content-Security-Policy added — building
  one against this app's actual script/style sources and smoke-testing it is real work that
  shouldn't happen as a guess during an audit pass; `docs/deployment-guide.md` says so explicitly for
  whoever adds one.
- **`docs/deployment-guide.md` written** — was a dangling reference (`.env.example`'s header comment
  already pointed at it) that never existed. Covers target hosting shape (a long-running Node
  process — Server Actions rule out static/pure-edge hosting), the local-filesystem document-storage
  constraint (`.data/documents/` needs a persistent volume, or switch to
  `DOCUMENT_STORAGE_PROVIDER=sharepoint`, for any host with an ephemeral filesystem), the
  HTTPS-required-for-session-cookies constraint, real-Postgres + `migrate deploy` (not `migrate dev`)
  - a deliberate one-time `db:seed` decision, the full env var checklist, and a pre-deploy checklist.
    Points at `docs/known-limitations.md` for current mock/stub status rather than duplicating it.
- **Confirmed, not fixed**: `.env.example` and a few provider files reference
  `docs/graph-permissions-guide.md`, `docs/sharepoint-provisioning-guide.md`, and
  `docs/ai-integration-contract.md` — none exist yet. Pre-existing gap from earlier in the project,
  not introduced by this pass; noted rather than authored on spec, since a real integration contract
  doc needs the actual internal AI service's real request/response shape, not a guess.

## A24 — Login page rebuilt from a second, highly prescriptive client mockup (2026-08-22)

A second login mockup arrived with an unusually detailed written spec ("do not deviate," an
explicit acceptance checklist) — implemented close to literally, with two deliberate, disclosed
departures.

- **Headline text changed to "NICTA Board Submission Portal"**, exactly as specified — this
  supersedes `#A19`'s "Executive Management Reporting and Board Submissions Portal" **on the login
  page only**. The spec explicitly scoped the work to "only this login frontend" / "limit your work
  to the login screen," so the app's `<title>`, `AppHeader`'s label, and the Entra error copy's
  portal name were deliberately left alone rather than expanding scope — the portal now has two
  names in two places until the client says which one is authoritative everywhere.
- **No separate "official header image" file was actually supplied.** The spec insists (at length)
  on using one pre-combined header graphic and never redrawing/recreating the logo. Only one image
  ever reached this session — the full login-page mockup — not a standalone header asset. Rather
  than fabricate a combined file or silently claim to have used one, `LoginOfficialHeader.tsx`
  composites the two real, already-sourced brand PNGs already in `public/`
  (`png-emblem.png`/`nicta-logo.png`, from `#A17`) in the exact required order (crest, divider,
  logo) — same assets, same visual result, just not literally one file. If NICTA supplies a real
  combined header graphic later, swap it in directly.
- **New white `LoginOfficialHeader` bar above the hero** (crest/divider/logo/agency
  name/tagline, ~100–110px, thin teal top line) — a real structural change from `#A19`'s version,
  where the logo lived inside the cream swoosh. The swoosh (`LoginSwoosh.tsx`) is now purely
  decorative background with no logo in it.
- **Card gained Email/Password field icons, a "Remember me" checkbox, and a "Forgot password?"
  disclosure** (`<details>`/`<summary>`, no JS) — the checkbox is a real form field but **not**
  wired to session duration; the spec's own scope protection says "do not change the backend
  authentication architecture as part of this frontend task," so `signInWithEmail` is unchanged.
  "Forgot password?" doesn't pretend a reset flow exists — it reveals an honest one-line note
  ("access is managed by your Administrator, not a self-service password") rather than a dead link
  or a fake form, consistent with `#A20`'s reasoning about not building misleading UI.
- **Desktop must not scroll** (explicit requirement) — verified at 1440×900, 1440×800, and
  1280×800 via Playwright (`document.documentElement.scrollHeight` vs `clientHeight`); the outer
  layout is `h-screen overflow-hidden` at the `lg` breakpoint only, natural/scrollable below it
  where the spec permits stacking.
- **Animation** kept to exactly what section 10 of the spec permits (a ~140s orbit-line drift, a
  soft glow-point pulse, a one-time card entrance), all no-ops under `prefers-reduced-motion` — the
  same message's own casual "more animated and glossy" aside was resolved in favor of the detailed
  spec's explicit restraint list and its "avoid glass effects" instruction, since the detailed spec
  states it is the authoritative direction.
- **Bug caught and fixed during verification**: the swoosh curve initially dipped down across the
  headline text on mobile widths (the same class of stacking/sizing bug as `#A19`'s first pass,
  different cause — a percentage-based height that stayed proportionally tall on narrow viewports).
  Fixed with fixed pixel heights below `lg` instead of a percentage.

## A25 — Department names corrected again, one day after `#A21` (2026-08-22)

The client sent a "controlled correction" explicitly scoped to organisational-area names only
("do not reconsider, redesign or otherwise modify the previous specification... the only correction
is the official list") — superseding `#A21`'s names, which turned out not to be final:

| Code                     | `#A21` name (2026-08-21)                  | Corrected name (2026-08-22)                             |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| `OCEO`                   | Office of the CEO                         | _unchanged_                                             |
| `ECON_LICENSING`         | Economics and **Licencing**               | Economics and **Licensing** (back to standard spelling) |
| `DIGITAL_TRANSFORMATION` | Digital Transformation **Department**     | Digital Transformation (no suffix)                      |
| `ENGINEERING`            | Engineering **Department**                | Engineering (no suffix)                                 |
| `COMPLIANCE`             | **Compliance and Enforcement** Department | **Enforcement and Compliance** (reordered, no suffix)   |
| `CORPORATE_SERVICES`     | Corporate Services **Department**         | Corporate Services (no suffix)                          |

Codes unchanged throughout — renaming `name` is always safe (`#A4`). Applied in exactly one place,
`src/lib/config/departments.ts`, then `db:seed` (idempotent) propagated it to the live DB — every
other touchpoint the client listed (Director/CEO/Corporate Secretariat dashboards, submission
forms/tables, filters, notifications, audit records, and the SharePoint folder **and file name**
derivation from `#A22`) already reads `Department.name` live rather than hardcoding it, so nothing
else needed a code change. Verified directly: queried the live DB for all six names and the real
roster's department assignments (unchanged — only the string changed, not who belongs where), and
created-then-deleted one real submission to confirm the folder path and file name both picked up
`Economics_and_Licensing` with no further code changes. No automated tests exist yet to update
(`tests/unit/**` is empty — `#A23`).

- **Not implemented — flagged instead of guessed at**: the same message included three dashboard
  screenshots (CEO, Corporate Secretariat, Director) showing a materially different app shell than
  what exists — a dark teal left sidebar nav instead of the current top `AppHeader`, a warm-cream
  content background instead of `bg-nicta-neutral-50`, and specific per-role dashboard card/table
  layouts that don't exist yet. The message's own text says "do not redesign... every other
  requirement remains unchanged" and separately claims a "supplied working prototype and source
  files" as the reference — but only three static images reached this session, no source files or
  URL. Building that shell would be a large, separate change directly contradicting the "only
  correction is names" framing in the same message, so it was left undone and raised with the
  client rather than either silently skipped or silently attempted from images alone.

## A26 — Dashboard shell rebuilt (sidebar + 3 role dashboards) from client mockups (2026-08-22)

The client confirmed (after `#A25` raised it) that the dashboard screenshots should be built for
real: a dark-teal left sidebar + white top header replacing the old top-nav-only `AppHeader`, and
full rebuilds of the CEO/Corporate Secretariat/Director landing pages. Built as one foundational
pass plus 4 parallel agents, per the client's own "break up the agents" request.

- **Foundation (built directly, not delegated)**: `PortalShell`/`PortalHeader`/`PortalSidebar`
  (new shared shell), `DashboardStatCard`/`DashboardMeetingBar` (shared dashboard widgets),
  `getCurrentSmcMeetingWithDeadline()` (new export, `meetings.ts`), and `department: true` added to
  `listAllSubmissions`/`listReviewQueue`/`listMySubmissions`'s existing queries so every dashboard
  agent had department data without touching `submissions.ts`/`review.ts` themselves. Verified
  live end-to-end on `board-papers/page.tsx` (migrated by hand as the reference example) before
  handing the pattern to any agent.
- **Sidebar is deliberately 2 items regardless of role** ("SMC Submissions", "Board Papers"),
  matching the reference exactly — every role's actual primary page (Director -> `/submissions`,
  Corporate Secretary -> `/review-queue`, CEO -> `/executive-dashboard`, System Admin -> `/admin`)
  sits behind "SMC Submissions" via `ROLE_LANDING_PAGE`/`PRIORITY` (the same lookup the post-login
  redirect already uses), rather than a third hardcoded mapping. Administration has no standalone
  nav item, matching the reference — it's reachable from the Corporate Secretariat dashboard's own
  "Set SMC Deadline"/"Manage Approved Templates" buttons instead (both plain links to the existing
  `/admin` and `/admin/templates` pages — no new admin UI was built).
- **4 parallel agents**, file-scoped to avoid collisions: mechanical `AppHeader` -> `PortalShell`
  migration across 8 otherwise-unchanged pages; CEO dashboard (`executive-dashboard/page.tsx`);
  Corporate Secretariat dashboard (`review-queue/page.tsx`), including a `?selected={id}`
  query-param master-detail panel (same route, no sub-navigation) reusing the 3 existing
  `review-queue/[id]/actions.ts` server actions unchanged, just relabeled ("Accept for SMC" /
  "Vetted for Board" — same `noteSubmissionAction`/`endorseForBoardAction` calls as before); Director
  dashboard (`submissions/page.tsx`). All four verified their own work live via Playwright against
  real seed data before reporting back, and all four reports were independently re-verified (code
  read, not just the agent's summary) before integrating.
- **Bug found and fixed during integration**: the Corporate Secretariat panel's 3 actions now share
  one comment `<textarea>` (the reference shows one compact panel, not three separate forms), but
  only `returnSubmissionForCorrection` requires a non-empty comment
  (`src/lib/submissions/review.ts`) — the old separate-forms page enforced that with a plain
  `required` attribute on its own textarea, which isn't possible on a field shared with two actions
  that don't need a comment. An empty-comment Return would have thrown a raw
  `SubmissionValidationError` past the UI as an unstyled Next.js error overlay. Fixed with a small
  client component, `ReviewActionForm.tsx`, that intercepts only the Return button's click to check
  the comment client-side; the other two buttons submit normally.
- **`AppHeader.tsx` deleted** — `ComingSoonPage.tsx` (backs the still-unbuilt `/my-workplan`,
  `/department-dashboard`, `/smc/dashboard`, `/board/dashboard` future-module placeholders) was its
  last caller; migrated onto `PortalShell` too so the whole authenticated app now shares one shell
  consistently, rather than leaving 4 routes on a different, older header/nav.
- **Mistake made and disclosed, not hidden**: while manually verifying the `ReviewActionForm` fix
  against live seed data (submission `SMC-26-009`), a cleanup script meant to revert the one test
  transition it created used a `WHERE entityId = ... AND action = 'SUBMISSION_TRANSITION'` filter
  that was too broad — it deleted 4 matching `AuditEvent` rows, not the 1 the test had actually
  created, because this submission (pre-existing, not seed-script-generated — its title has a human
  typo, "Baord Paper") already had its own prior transition-audit history from whenever it was
  originally created through the real app flow. The submission's functional state (`workflowStatus`,
  the `SubmissionReview`/`WorkflowTransition`/`Notification` rows the test itself created) was fully
  and correctly reverted; the 3 extra deleted `AuditEvent` rows were **not** recoverable (no soft-
  delete in this schema) and were **not** reconstructed with fabricated timestamps/content. Net
  effect: `SMC-26-009`'s audit-history view is missing 3 historical entries; nothing about its actual
  submission data or current behavior is wrong. A full `prisma migrate reset` would restore pristine
  seed data but risks discarding anything the client did in the app interactively, so it was not run
  without asking first.

## A27 — CEO/Corporate Secretariat authority split, late-submission enforcement, portal rename (2026-08-22)

The client's large expansion prompt (rename, role/department clarifications, explicit CEO-vs-
Secretariat authority separation, Manager weekly reporting, full Board paper state machine,
SharePoint archive routing, 17 acceptance scenarios) was scoped into increments rather than
attempted in one pass — this is **Increment 1**: the single correctness-critical piece (only the
CEO may mark "Vetted for Board") plus two well-bounded, no-migration-needed pieces already latent
in the schema. Manager reporting, the full Board paper state machine, and archive/paper-type
SharePoint routing are **not** in this pass — see the recommended-next-milestones list delivered
to the client alongside this entry.

- **CEO-only Board-vetting gate**: `markEndorsedForBoard` (`src/lib/submissions/review.ts`) was
  gated on `REVIEWER_ROLES` (Corporate Secretariat) — the client's own instruction is explicit that
  only the CEO may make this call, with the Secretariat limited to a completeness/pack check. Regated
  to a new `CEO_ROLES` (`EXECUTIVE_VIEWER`, `SYSTEM_ADMIN`) constant; comment became required
  (previously optional) since the client requires the CEO's reasoning to be stored and emailed to the
  Director either way. Added a parallel `markNotVettedForBoard` for the CEO's other outcome, recorded
  as an `AuditEvent` (`SUBMISSION_NOT_VETTED_FOR_BOARD`) rather than a new `workflowStatus` — the
  submission stays `ACCEPTED`/`ROUTED` either way; a Director can act on the CEO's comment and
  resubmit through the same completeness check. No schema migration: `workflowStatus` is a free-text
  `String` column (`#A1`-era decision), so this is a new literal value plus a new audit-event `action`
  string, not a new enum member.
- **Corporate Secretariat's UI lost its 3rd button.** `ReviewActionForm.tsx`, `review-queue/page.tsx`,
  `review-queue/[id]/page.tsx` all previously offered "Vetted for Board" alongside the completeness-
  check actions (an artifact of `#A26`'s dashboard rebuild, which relabeled but didn't move the
  power). Now strictly 2 actions (Return for Correction / Accept for SMC); both surfaces gained a
  one-line note that the Board decision is the CEO's, made separately from the Executive Dashboard.
  `executive-dashboard/page.tsx` gained a new master-detail "Awaiting Your Review" section (same
  `?selected={id}` pattern as `#A26`'s review-queue panel) backed by a new
  `listSubmissionsAwaitingCeoReview` query (`ACCEPTED`/`ROUTED` SMC submissions, not yet
  `endorsedForBoard`, excluding anything already declined via the new audit-event) and a new
  `CeoVettingForm` component (both buttons require a comment, unlike the Secretariat's form where
  only Return does).
- **Late-submission enforcement wired onto already-existing, previously-unused schema fields**
  (`Submission.isLate`, `Submission.lateJustification` existed in the schema but nothing read or
  wrote them before this pass). `submitSubmission` (`src/lib/submissions/submissions.ts`) now compares
  `new Date()` against `Deadline.normalCloseAt` for the submission's meeting; past the deadline, a
  submission is blocked without a non-empty `lateJustification`, and blocked submissions never reach
  `SUBMITTED`. **Fails open**: if no `Deadline` row exists yet for the meeting (the admin hasn't set
  one), nothing is ever late — there is nothing to enforce against, matching this MVP's existing
  "a meeting can exist without a Deadline" contract (`#A17`/`getCurrentSmcMeetingWithDeadline`).
  `NewSubmissionModal.tsx` gained an optional "Late submission justification" field, always visible
  (client-side, the app can't cheaply know in advance whether _this_ attempt will land past the
  deadline) but only enforced server-side. The client's other two visibility requirements — "visible
  Late marking" and "original deadline vs actual submission date" — were **not** in the original
  pasted prompt's file-level detail, but are explicit acceptance criteria, so were added in the same
  pass: `StatusBadge.tsx` now renders a small red "Late" pill alongside the status pill wherever it's
  used (5 call sites, all already had `isLate` on the object passed in — no query changes needed), and
  both `submissions/[id]/page.tsx` and `review-queue/[id]/page.tsx` gained a late-submission banner
  showing the original deadline, actual submission timestamp, and the Director's justification text.
- **Portal renamed** to "NICTA Internal Executive and Board Portal" at its 3 remaining string sites
  (`src/app/layout.tsx` `<title>`, `src/app/login/page.tsx`'s `not_provisioned` error copy and hero
  headline). The login hero's font size was stepped down one Tailwind size (`text-3xl`/`sm:text-4xl`
  -> `text-2xl`/`sm:text-3xl`) to keep the longer two-line headline inside the existing no-desktop-
  scroll layout (`#A24`).
- **Verified live**, not just typechecked: a throwaway Playwright script (`.tmp-verify-a27.mjs`,
  deleted after the run — not committed) drove the real dev server against real seed accounts
  (`rasari@nicta.gov.pg` as Submitter/Director, `ltol@nicta.gov.pg` as Corporate Secretariat,
  `ceo.demo@nicta.gov.pg` as CEO — not `submitter.demo`/`reviewer.demo`, which turned out to already
  be deactivated by an earlier real-roster migration) through: late submission blocked without
  justification; late submission accepted with justification and shown with a "Late" badge; Secretariat
  panel confirmed to expose only 2 actions; CEO "Awaiting Your Review" showing both accepted test
  submissions; one vetted for Board, one not-vetted; both correctly dropping off the awaiting list
  afterward (confirmed directly against the DB — `endorsedForBoard` true on one, false on the other).
  All 4 test submissions, their `WorkflowTransition`/`AuditEvent`/`SubmissionReview`/`AIReviewResult`/
  `Notification` rows, their uploaded `.data/documents/...` files, and the temporary past-due
  `Deadline` row created to exercise the late path were deleted afterward — nothing test-induced was
  left in the dev DB or local document store.
- **Typecheck/lint clean throughout** (`npx tsc --noEmit`, `npx next lint`), Prettier-formatted.

## A28 — Full sidebar nav rebuilt from a client-supplied Director Dashboard screenshot (2026-08-23)

The client pasted a screenshot of a Director Dashboard with a much fuller left sidebar than
`#A26`'s deliberately-2-item nav (SMC Submissions / Board Papers) and asked for it "exactly" —
explicitly noting the extra items are "for the future", matching the original big spec's own
instruction that future modules must stay "visible only as disabled... placeholders" rather than
hidden. `PortalSidebar.tsx` is now grouped (Overview / Submissions / Directors Tasks / Department
Managers / Settings) with 5 real links (My Dashboard, Notifications, SMC, Board, Sign Out — all
either `ROLE_LANDING_PAGE` or an existing route) and 8 disabled placeholders (CEO's Approval,
Circular Approval, Archive, Executive Delegations, Managers Delegations, Reports, Requests,
Account) rendered as non-clickable, muted, "Soon"-tagged `<span>`s rather than the older
`ComingSoonPage` pattern (a clickable link to a real stub route) — a deliberate change: the client's
own wording is "disabled", and none of these 8 have any backing data model or route today, so a
clickable stub would overclaim more than a greyed-out nav item does. Rendered identically for
every role (same simplicity rule as `#A26`), verified via screenshot on Director, CEO, and
Corporate Secretariat.

- **`PortalSidebar` became an async Server Component** (needs the signed-in user's department name
  for the new bottom profile strip — same one-off `prisma` call pattern `PortalHeader` already uses
  for its notification count). The one interactive piece (the collapsible "New Submissions" group)
  had to move into its own tiny client component, `SidebarExpandableGroup.tsx` — a Server Component
  cannot pass a function prop (an icon component reference) across to a Client Component, only
  serializable props/rendered JSX; hit this as a live runtime error first (`next dev`'s overlay:
  "Functions cannot be passed directly to Client Components"), not caught by `tsc`, and fixed by
  passing a rendered `<Icon className=.../>` node instead of the component reference.
- **Director Dashboard's header row** (`submissions/page.tsx`) now shows a "Portal / Directors"
  breadcrumb instead of the department name (which moved to the sidebar's new bottom profile strip,
  so it wasn't lost, just relocated) — matches the screenshot exactly. "Approved NICTA Templates"
  changed from a flex-wrap row of single-line pills to a 3-column grid of taller bordered cards; no
  data change needed, since the seeded template `name`s already read
  `"Management Report (placeholder template)"` etc. and simply wrap onto a second line at the
  narrower card width.
- 8 new icons added to `icons.tsx` for the new nav items (home, people, person-check, refresh,
  archive, chart, inbox, user) — same inline-SVG-with-`currentColor` convention as the existing set,
  no icon library dependency added.

## A29 — CEO -> Director delegation workflow, role-specific CEO/Secretariat navigation (2026-08-25)

The client's second large spec (roles/departments/portal-name revalidation, a full KPI/KRA model,
CEO delegations, weekly summaries, WhatsApp notifications, distinct CEO/Secretariat sidebars, 16
acceptance tests) was scoped the same way as the first one (`#A27`): revalidate first, then
implement the single best-bounded, highest-value slice for real rather than attempt everything at
once. **This pass**: (1) confirmed roles/departments/portal-name already satisfy the spec exactly —
no changes needed, verified directly against the live DB, not assumed; (2) built distinct CEO and
Corporate Secretariat sidebars, superseding `#A28`'s "one nav for everyone" rule for those two
roles only, per the client's explicit "do not use one generic sidebar for all roles"; (3) built the
CEO -> Director delegation workflow end-to-end (schema, 10-state machine, both roles' UI,
notifications, audit trail) — the one "current priority" item in the client's list (KPI/KRA, weekly
summaries, WhatsApp) that is fully self-contained and has a complete field/state spec, unlike the
other three which each need their own schema hierarchy or external-provider work. **Not built this
pass** — see the closing report delivered alongside this entry and `docs/known-limitations.md`:
the KPI/KRA model (Corporate Strategy -> Plan -> Org KPI -> Dept KPI -> Activity -> Update ->
Evidence -> Report, a 5-6-model hierarchy of its own), weekly summary generation, and the WhatsApp
notification provider.

- **Delegation is a new top-level model**, not bolted onto `Activity`/`Workplan` — a CEO delegation
  has its own lifecycle, actors, and evidence, and conflating it with the Kanban/workplan module
  (itself still mostly unbuilt UI, per `#A12`) would couple two separately-scoped features. Schema
  additions are purely additive: a new `Delegation` model/table, a new `DelegationPriority` enum, and
  3 nullable FK columns added to already-generic tables (`WorkflowTransition.delegationId`,
  `Evidence.delegationId`) — no existing column was changed, matching the "don't edit an existing
  migration" rule (`20260824224041_add_ceo_delegations`).
- **`Delegation.status` is a free-text `String`, not a Prisma enum** — same reasoning as
  `Submission.workflowStatus` (`#A1`): new states can be added without a migration. The state graph
  itself (`src/lib/delegations/workflow.ts`) is a small table-driven graph copied from
  `submissions/workflow.ts`'s exact shape (`transitionDelegation` mirrors `transitionSubmission`
  field-for-field: validates the edge, updates the row, writes one `WorkflowTransition`, writes one
  `AuditEvent`), not a generic workflow engine — consistent with the client's original instruction
  against one, still in force.
- **`OVERDUE` is a derived flag, not a stored state**, even though the client's own state list names
  it as one of 11. No cron/scheduler infrastructure exists anywhere in this codebase to drive an
  automatic `dueDate`-passed transition, and building one for a single field would be a
  disproportionate addition. `isOverdue()` computes it at read time from `dueDate` and `status` —
  identical reasoning and identical "fail open" precedent to `Submission.isLate` (`#A27`). It renders
  as an "Overdue" pill next to the real status everywhere a delegation is shown, so the functional
  requirement (visibility) is met without the stored-state machinery.
- **"CEO comments" and "Director response" are not separate fields** — every comment, on either
  side, is logged as a `WorkflowTransition` row (self-loop `fromState === toState` when the action
  doesn't itself change status — a progress update, an extension request, a plain CEO comment), the
  same pattern `SubmissionReview.comments`/`WorkflowTransition.comment` already establish for
  Submissions. This satisfies "every important action must record... previous state, new state,
  comment" even for actions that don't move the state, and keeps one single chronological history
  per delegation instead of splitting comments across multiple fields/tables.
- **Director-side actions gate on `SUBMITTER`** (the role already carrying the "Director" display
  name and driving `/submissions`), not the separate `DIRECTOR` role code (display name "Department
  Director (Workplans)", `#A4`'s comment on why the two exist). Every real, currently-staffed
  Director account already holds both role codes (confirmed directly against the DB —
  e.g. `rasari@nicta.gov.pg` has both `SUBMITTER` and `DIRECTOR`), so this is a no-op in practice
  today; `SUBMITTER` was chosen because it is the code every other Director-facing authorization
  check in this codebase already uses (`submissions.ts`, `review.ts`), keeping delegations
  consistent with that rather than introducing a second convention.
- **CEO and Corporate Secretariat sidebars are the client's own list, verbatim**, split into logical
  section groups (grouping is a legibility choice, not in the client's literal instruction, but the
  instruction doesn't forbid it and a 28-item flat list is hard to scan). Items with a real, already-
  built destination are live links (7 for the CEO: CEO Dashboard, Notifications, SMC Submissions,
  Board Papers, CEO Delegations, Delegation Tracking, Sign Out; 7 for the Secretariat: Secretariat
  Dashboard, Notifications, SMC Submission Queue, Board Paper Register, Deadlines and Submission
  Windows, Approved Templates, Sign Out) — CEO Delegations and Delegation Tracking both point at the
  same `/delegations` list rather than inventing a second "tracking" view, since tracking is that
  list's own purpose. Everything else (21 items on each) renders as the same disabled "Soon" pattern
  `#A28` established, not a clickable stub — no route was created for them, honestly reflecting that
  no backing feature exists yet, not just no page.
- **Verified live**, not just typechecked: a throwaway Playwright script drove the real dev server
  through the full lifecycle on real seed accounts (`ceo.demo@nicta.gov.pg` creating and issuing a
  delegation to `rasari@nicta.gov.pg`, who acknowledged it, started work, logged a progress update,
  and submitted it for review; the CEO then marked it Completed and Closed with a closure decision)
  — 11/11 checks passed, including the closure-decision text and an in-portal notification reaching
  the Director. A second script confirmed least-privilege directly: a _different_ Director
  (`sanda@nicta.gov.pg`) navigating straight to the first Director's delegation URL was redirected
  away with no delegation content rendered — `getDelegationForUser`'s ownership check holds. All
  test-created `Delegation`/`WorkflowTransition`/`AuditEvent`/`Notification` rows were deleted
  afterward; confirmed zero remaining via a direct DB count.
- **Typecheck/lint clean throughout** (`npx tsc --noEmit`, `npx next lint`), production build
  succeeds (`next build`), Prettier-formatted.

## A30 — Board Dashboard module: meetings, decisions, comments, resolutions, minutes, actions (2026-08-26)

The client's Board Dashboard spec was implemented as a real, integrated module rather than a
planning document — it reuses the existing `Submission`/`Meeting`/`Decision`/`Resolution`/
`ActionItem` models (extended, not replaced) and the existing provider/audit/RBAC patterns
throughout, per the client's own "inspect the existing codebase and integrate" instruction.
Excluded per the client's own explicit list: advanced analytics, CEO delegation workflows (already
built separately, `#A29`), WhatsApp, e-signatures, video conferencing — none of this pass touches
those.

- **Schema is additive only** (`prisma/migrations/20260826004809_add_board_dashboard`): new models
  `MeetingAgendaItem`, `MeetingAttendance`, `MeetingMinutes`, `Comment` (a polymorphic
  `entityType`/`entityId` thread — same generalization pattern `AuditEvent` already established,
  reused rather than inventing a comments table per commentable model); extended `Meeting` (new
  `venue` field, 5 new `MeetingStatus` enum values — `DRAFT`/`PUBLISHED`/`IN_PROGRESS`/`COMPLETED`/
  `ARCHIVED` — added alongside the original 6 SMC-meeting values, not replacing them, since
  `MeetingStatus` is shared by both meeting types); extended `Decision` (`conditions`,
  `submissionVersion`) to also carry individual Board Members' votes on Decision Papers, not just
  the original formal SMC/Board registry entry it was designed for; extended `Resolution`
  (`decisionId` now nullable, plus `meetingId`/`agendaItemId`/`subject`/`status`/
  `responsiblePersonId`/`responsibleDepartmentId`/`dueDate`/`submissionId`/`followUpNotes`) so a
  resolution can be created directly from an agenda item without first recording a formal Decision,
  per the client's own instruction; extended `ActionItem` (`resolutionId`, `sourceMeetingId`,
  `departmentId`, `progressUpdate`, `evidenceStorageKey`, `completionComment`, `updatedAt`) and
  `ActionItemStatus` (added `NOT_STARTED`/`AT_RISK`/`COMPLETED`/`CLOSED` alongside the original
  `OPEN`/`IN_PROGRESS`/`DONE`/`OVERDUE`, which stay in use by the pre-existing, unrelated
  `addActionItem` call site in `review.ts`); extended `Submission` with `boardOutcome`/-`At`/-`ById`
  (the Board's own final outcome on a Decision Paper — same shape as the existing
  `endorsedForBoard`/-`At`/-`ById` triple, deliberately kept distinct from it: `endorsedForBoard` is
  the CEO's earlier "send to Board" call, `boardOutcome` is the Board's own decision once it gets
  there). One migration hiccup: `ActionItem.updatedAt` couldn't be added as a required column
  against the one pre-existing row without a default — fixed by hand-editing the generated
  migration to add `DEFAULT CURRENT_TIMESTAMP` for the backfill, the standard resolution for this
  situation (Prisma's own `@updatedAt` columns get this automatically when created against an empty
  table; this one wasn't empty).
- **Decision is now dual-purpose**: it already existed as a single formal SMC/Board registry entry
  (`decisionType: Noted | Endorsed | ...`); this pass reuses the same table for individual Board
  Members' votes (`decisionType: Approve | Reject | Defer | RequestFurtherInformation |
ApproveSubjectToConditions | Abstain | DeclareConflictOfInterest`) rather than adding a parallel
  `BoardVote` model — both are "a recorded decision, by someone, on a submission, at a meeting,"
  and multiple rows per (submissionId, recordedById) are allowed by design: a changed vote is a new
  row, not an edit, matching this codebase's append-only convention (`#A6`/`#A27`) — the _latest_
  row per user is what `approvalRules.ts` and the UI treat as authoritative, older rows stay as
  history.
- **No automatic quorum/majority computation.** The client's spec explicitly says "keep the
  approval rules configurable so quorum and voting logic can be expanded later," and this codebase
  has no Board-membership-roster/quorum-size concept anywhere to compute real quorum against.
  `src/lib/board/approvalRules.ts`'s `evaluateBoardOutcome()` is a deliberately simple, isolated,
  clearly-labeled placeholder rule (any Reject blocks; else any Defer; else any
  RequestFurtherInformation; else any Approve/ApproveSubjectToConditions passes) that only ever
  _suggests_ an outcome — the Board Secretariat still manually finalizes via
  `finalizeBoardOutcome()`, which is never auto-invoked. Swapping in real quorum/majority math later
  is a one-file change.
- **Access control tightened, and one real gap found and fixed while live-verifying**:
  `assertCanAccessSubmission` (`src/lib/submissions/submissions.ts`) previously let _any_ Board
  Member view _any_ Board Paper regardless of its meeting's status — this pass gates that on the
  linked meeting being `PUBLISHED` or later, matching "View published Board meetings." While
  verifying the CEO-comment/decision/finalize flow live, discovered `BOARD_SECRETARIAT` had **no**
  access path at all to view a Board Paper (the function only recognized `REVIEWER_SECRETARIAT`/
  `SYSTEM_ADMIN`/`EXECUTIVE_VIEWER`/`BOARD_MEMBER` — `BOARD_SECRETARIAT` is a distinct role from
  `REVIEWER_SECRETARIAT` and had been missed entirely) — fixed by adding a Board-Secretariat access
  class scoped to `BOARD` submissions (not published-gated, since the Secretariat prepares the
  meeting before it's published). The same missing role was also fixed on `/board-papers`'s page
  guard and `listBoardPapers()`'s visibility filter.
- **CEO comments surfaced on Board Papers without a new field**: there is no dedicated column for
  the CEO's Board-vetting comment (`#A27` only ever recorded it inside an `AuditEvent`'s JSON
  `newState`); `getCeoCommentForBoardPaper()` reads it back out via the source SMC submission's
  `SUBMISSION_ENDORSED_FOR_BOARD`/`SUBMISSION_NOT_VETTED_FOR_BOARD` audit events. "Corporate
  Secretariat status" (a separate client field request) is satisfied by the pre-existing link to
  the source SMC submission — its own completeness-check outcome/comment is visible there — rather
  than duplicating it onto the Board Paper.
- **Board paper types seeded but not yet selectable.** The client's exact 5 names (Information/
  Decision/Discussion Paper, Management Report, Confidential Paper) are seeded as `category: BOARD`
  `PaperType` rows (`prisma/seed.ts`), satisfying "support these paper types" as configured
  reference data. `submitBoardPaper()` (`review.ts`) still inherits `paperType` from the source SMC
  submission rather than offering a picker — extending that Director-facing flow was judged
  out of scope for a Board-Member/Secretariat-focused module; see known-limitations.md.
- **Comments are a new generic model**, reused across Board Papers (`Submission`), `Resolution`,
  and `MeetingMinutes` in this pass (`ActionItem` and `MeetingAgendaItem` are supported by the
  model/service layer already but have no comment UI wired up yet — a small follow-up, not a schema
  change). `visibility: BOARD_ONLY` is enforced at read time in `listComments`/`CommentThread`, not
  by restricting who can create it — any Board-role user can mark their own comment Board-only.
  `CommentThread.tsx` is a Server Component, not a Client Component: every reply box renders always-
  visible rather than toggled open specifically so it never needs to pass a function prop across a
  Server/Client boundary (the exact mistake hit and fixed live during `#A28`).
- **New Board nav is one shared list for both Board roles** (`BoardNav` in `PortalSidebar.tsx`),
  not two distinct navs the way `#A29` built for CEO/Secretariat — the client's Board Dashboard spec
  describes different _dashboard content and actions_ per role (which `/board/dashboard` and every
  Board page already branch on), not a different _navigation structure_, so `#A29`'s "don't use one
  generic sidebar" instruction doesn't apply the same way here. Every item in `BoardNav` is a real,
  working link — no disabled placeholders were needed for this module's own scope.
- **Mistake made during test-data cleanup, disclosed not hidden** (matching the `#A26` precedent):
  while removing test-created rows after live verification, a cleanup query against
  `WorkflowTransition` used an insufficiently-scoped condition (`delegationId IS NULL AND
submissionId IS NULL AND activityId IS NULL`, intended to catch orphaned rows with none of the
  three FKs set) without first previewing it with a `SELECT`. It matched and deleted **17
  pre-existing rows**, not the 0 expected — no code path in this codebase (checked
  `submissions/workflow.ts`, `delegations/workflow.ts`, `seed.ts`) creates a `WorkflowTransition`
  row with all three FKs null, so what these rows represented could not be determined after the
  fact, and they are **not recoverable** (no soft-delete in this schema). Confirmed no functional
  data was affected — `WorkflowTransition` is a pure audit/history table, every `Submission`'s
  current `workflowStatus` and all other live data were verified intact immediately after — but
  this is a genuine, disclosed loss of historical audit-trail rows, contrary to this project's
  explicit append-only convention. No mitigation beyond disclosure and the discipline going forward
  of always previewing a delete's match set with `SELECT` before running it.
- **Verified live**: two throwaway Playwright scripts (deleted after the run) drove the real dev
  server through the full lifecycle on real seed accounts — Secretariat creating and publishing a
  meeting, a Board Member seeing it on their dashboard, Secretariat creating a resolution and an
  action from the meeting, a Board Member browsing the resolutions/actions/archive registers; a
  second pass (against a manually-inserted test Decision Paper, since no seeded Board paper was
  linked to a published meeting) verified a Board Member recording a decision and posting a
  comment, then the Secretariat seeing the suggested outcome and finalizing it — 12/12 and 6/6
  checks passed respectively. All test-created rows confirmed deleted afterward via direct DB
  counts.
- **Automated tests**: `tests/unit/board/boardDashboard.test.ts`, 21 integration-style tests
  (real Postgres, no mocking — this project's first committed automated test file) covering the
  client's own acceptance-criterion categories: permissions, paper/meeting visibility, approvals,
  comments (including reply-threading and `BOARD_ONLY` visibility filtering), resolutions (status
  transition validity), and audit history. `vitest.config.ts` needed a `loadEnv` addition — Vitest
  doesn't load `.env` automatically the way Next.js does, so `DATABASE_URL` was previously unset for
  any test run (there were no test files before this pass to notice).
- **Typecheck/lint/tests/production build all clean** before this entry was written — `npx tsc
--noEmit`, `npx next lint`, `npm test` (21/21), `next build`, per the client's own closing
  requirement.

## A31 — CEO and Board Dashboards rebuilt from approved mockups; the "18 modules" and "one shared

## workflow engine" architecture requests (2026-08-26)

The client's third large spec supplied two approved visual mockups (CEO Executive Dashboard, Board
Member Dashboard) as the "visual source of truth" and asked for an 18-named-module architecture
plus one shared workflow engine reused across every document type. This entry records the gap
assessment done first (per the client's own "Implementation Sequence" step 1-3) and the scope
decisions that followed it — most consequentially, **not** building a single generic workflow
engine, for reasons explained below.

### Gap assessment (existing vs. reusable vs. new)

The client's 18 requested modules already exist in this codebase, just not literally organized
into 18 folders named after the client's list — remapping working code into a folder structure
with no functional difference would be pure churn, contrary to CLAUDE.md's "preserve existing
structure" instruction, so this pass did not do that. What already existed and was reused as-is:
Identity/Access (`lib/auth`), Organisation/Departments (`Department` model, `#A4`), Users/Roles
(`Role`/`UserRole`, `#A4`), Submissions/Papers (`lib/submissions`), Documents/Templates
(`lib/templates`, `lib/providers/documentStorage`), Workflow/Status (table-driven state machines
per domain — see below), Approvals/Decisions (`lib/submissions/review.ts`'s CEO vetting, `#A27`;
`lib/board/decisions.ts`, `#A30`), Comments/Responses (`lib/board/comments.ts`, `#A30`, extended
this pass), Meetings/Agendas (`lib/board/meetings.ts`, `#A30`), Minutes/Resolutions
(`lib/board/minutes.ts`/`resolutions.ts`, `#A30`), Tasks/Delegations (`lib/delegations`, `#A29`),
Notifications (`lib/providers/notifications`), Audit (`lib/audit/auditLog.ts`), SharePoint routing
(`lib/providers/documentStorage`), Administration (`app/admin`). Two modules from the client's list
had no real implementation anywhere: KPI/KRA and Performance Reporting (built this pass, see
below), and Digital Signature (built this pass as an interface-only future module, see below).

### Why this pass does not build "one shared workflow engine"

The client's spec: "Use the same workflow engine for [every document type]... Do not create
separate hard-coded workflow engines for each document type." This directly contradicts a decision
already made and repeatedly reaffirmed in this exact codebase across three prior increments
(`#A1`, and explicitly restated in `#A27`, `#A29`, `#A30`): "a small table-driven graph, not a
generic workflow engine, per the client's explicit instruction not to introduce one." That original
instruction came from this same client, earlier in the project. Rather than silently pick one
contradictory instruction over the other, this is flagged as the single assumption in this pass
most needing NICTA's explicit confirmation (see the closing report). In the meantime: **every
domain's state machine already follows the identical pattern** — `SUBMISSION_STATES`/`TRANSITIONS`
(`submissions/workflow.ts`), `DELEGATION_STATES`/`TRANSITIONS` (`delegations/workflow.ts`),
`BOARD_MEETING_STATES`/`TRANSITIONS` (`board/meetings.ts`), `RESOLUTION_STATUSES`/`TRANSITIONS`
(`board/resolutions.ts`) — a states array, a `Record<State, State[]>` transitions table, and a
`transitionX()` function that validates the edge, writes the entity, writes a `WorkflowTransition`
row, and writes an `AuditEvent`. This is "one workflow engine" in every sense except literally
being one importable class/module — extracting that identical shape into a single generic
`src/lib/workflow/engine.ts` (a `defineWorkflow(states, transitions)` factory each domain module
calls) is a real, bounded refactor a future pass could do safely now that four domains have proven
the pattern is genuinely identical — but doing it _this_ pass, on top of everything else requested,
would mean touching four already-tested, already-shipped state machines' call sites (dozens of
`requireAnyRole`/notification/audit call sites per domain) purely for architectural tidiness, with
real regression risk and no new user-facing capability. Deferred, not abandoned — see
known-limitations.md.

### KPI/KRA and Performance Reporting — built this pass, deliberately minimal

`#A29`'s known-limitations entry already flagged the full client-described hierarchy (Corporate
Strategy -> Corporate Plan -> Org KPI -> Dept KPI -> Activity -> Weekly Update -> Evidence ->
Executive Report) as a 5-6-model pipeline out of scope for a single pass. This pass builds only
what the CEO Dashboard mockup actually needs to show real, non-hardcoded numbers: one new model,
`DepartmentPerformance` (departmentId + reportingPeriodId + kpiPercent/kraPercent/
overdueActivities/criticalRisks/lastReportedAt), reusing the _existing_ `ReportingPeriod` model
(previously only quarterly rows; 6 new monthly rows added to match the mockup's Jan-Jun trend) —
and `src/lib/performance/riskService.ts`, a single pure function (`computeDepartmentStatus`) the
client's spec explicitly asked for: "traffic-light calculations must come from a reusable
service... thresholds configurable... clearly identify them as configurable rather than official
NICTA policy" (the UI states this on both the dashboard and the Departments page, verbatim). This
is the _destination_ a real weekly-reporting pipeline would eventually write into — not a
substitute for one. All current figures are seed/demo data (`prisma/seed.ts`'s
`seedDepartmentPerformance`), clearly commented as fictional.

### CEO Approval Inbox — an aggregation, not a new approval engine

The mockup's Approval Inbox lists 4 document types with a rich action set (Approve/Approve with
Conditions/Return with Comment/Request Further Information/Decline/Delegate Review). This pass
builds `src/lib/executive/approvalInbox.ts` as a **read aggregation** over what already exists and
already works (SMC submissions awaiting CEO review, `#A27`'s `listSubmissionsAwaitingCeoReview`;
Board Decision Papers with no `boardOutcome` yet) — each row links through to its real, tested
action panel (the CEO vetting form on `/executive-dashboard`, or the Board decision panel on
`/submissions/[id]`) rather than presenting a client-side "Approve with Conditions"/"Decline"/
"Delegate Review" button with no server-side action behind it. CEO Memos (a document type shown
once in the mockup's inbox, `CEO-MEMO-2026-014`) has no backing model anywhere in this codebase — a
full Memo module (its own ~10-state lifecycle) was judged out of scope for this pass and is not
built; the inbox surfaces the 3 document types that already exist (SMC submissions, Board
Information/Decision Papers) rather than fabricating memo data. See known-limitations.md.

### CEO Delegated Tasks — reused, not duplicated

The mockup's "CEO Delegated Tasks" (states: Assigned/Acknowledged/In Progress/Awaiting Update/
Submitted/Completed/Overdue/Closed) describes the exact same concept `#A29` already built in full
(CEO -> Director delegations, its own 10-state machine, full UI). Rather than build a second,
parallel "delegated task" model with a differently-worded state list for the same real-world
action, the CEO sidebar's "Delegated Tasks" item links straight to the existing `/delegations` —
per the client's own "do not create duplicate models or services where reusable ones already
exist" instruction. The two state vocabularies differ in wording (e.g. "Awaiting Update" vs.
`#A29`'s `RETURNED_FOR_MORE_WORK`) but not in the underlying lifecycle shape; reconciling the exact
labels is a display-layer decision for a future pass, not a reason to fork the model.

### Two new future-module provider interfaces

**Digital Signature** (`src/lib/providers/signature/`): interface + fields the client's spec asks
for (signer identity, timestamp, certificate reference, document hash, validation status)
verbatim, but — per explicit instruction — **no mock that pretends to succeed**. The only
implementation, `UnavailableSignatureProvider`, throws on every method. This is a deliberate
difference from every other provider interface in this codebase (which all ship a working mock for
zero-credential local dev) — signing is the one capability where "looks like it worked" would be
actively dangerous to fake. Surfaced as `<ComingSoonBadge>` ("Digital signature — Coming Soon")
next to the two real approval actions it would eventually attach to (CEO vetting, Board decisions).

**WhatsApp** (`src/lib/providers/notifications/whatsappProvider.ts`): added as a third
`NOTIFICATION_PROVIDER` option, mirroring `GraphNotificationProvider`'s exact shape (in-app record
always written first, then throws without live credentials) rather than a separate, unused-today
interface with speculative methods (delivery/read receipts, template approval, expiring tokens) —
those all belong on this same interface once a real WhatsApp Business API integration is
undertaken, not invented as unused scaffolding now. Surfaced as `<ComingSoonBadge>` on
`/notifications`.

### Document read/download audit and a real access-control gap fixed live

The client's "Document Read and Download Audit" requirement is satisfied by one addition to the
existing local-document API route (`src/app/api/documents/local/[...key]/route.ts`): a
`DOCUMENT_VIEWED` `AuditEvent` on every successful fetch, via the same `recordAuditEvent` every
other action already uses — no new model. While making this change, the route's _access check_
was found to be a second, independently-maintained, narrower copy of `assertCanAccessSubmission`'s
logic (owner-or-`REVIEWER_SECRETARIAT`/`SYSTEM_ADMIN` only) that had silently drifted out of sync:
it never recognized `BOARD_MEMBER`, `BOARD_SECRETARIAT`, or `EXECUTIVE_VIEWER` at all, so a Board
Member, the CEO, or the Board Secretariat opening a Board Paper's actual document got a 403 even
though the page around it rendered fine. Fixed by deleting the duplicated check and calling
`getSubmissionForUser` directly — the one already-correct, already-tested authority. Confirmed live
(and now regression-tested — `tests/unit/executive/executiveDashboard.test.ts`) that Board
Secretariat, CEO, and a Board Member on a published meeting can all download; an unrelated Director
still cannot.

### Sidebar: mockups supersede `#A29`'s placeholder-heavy version for these two roles

The CEO and Board mockups each show one flat, ungrouped list with **no** "Soon"-tagged items —
every single item has a real destination. This supersedes `#A29`'s more elaborate, mostly-
placeholder CEO/Board navs for exactly these two roles (Director/Secretariat/Manager/Admin navs
are unchanged). Sidebar badge counts (matching the mockups' small numeral badges on "Approval
Inbox") are computed by two small counting queries in `PortalSidebar.tsx` itself, not by calling
the fuller `listCeoApprovalInbox`/`listMyBoardApprovals` service functions (which redundantly
re-check a role the sidebar already knows).

### Verification

**34 automated tests** (`npm test`), up from 21: the original Board Dashboard suite unchanged, plus
`tests/unit/performance/riskService.test.ts` (5 pure unit tests, thresholds/boundaries) and
`tests/unit/executive/executiveDashboard.test.ts` (8 integration tests — permissions, the Approval
Inbox aggregation, and 4 regression tests for the document-access fix above, including the
negative case). Live-verified via Playwright: all 8 new routes load without error for both roles;
the document-access fix confirmed with a real uploaded file (Board Secretariat/CEO/Board Member
200, unrelated Director 403); existing Director/Secretariat/Delegations pages confirmed unbroken.
Two screenshot comparisons against the approved mockups (CEO dashboard, Departments page) showed
strong structural and visual fidelity — real chart data, real traffic-light colours matching the
seeded pattern, matching sidebar/card layout. All test-created rows and the one uploaded test file
were deleted afterward; confirmed via direct DB counts.

- **Typecheck/lint/tests/production build all clean** — `npx tsc --noEmit`, `npx next lint`,
  `npm test` (34/34), `next build`, per the client's own closing requirement.
