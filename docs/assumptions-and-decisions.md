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
