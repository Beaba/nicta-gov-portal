# Solution Proposal — Executive Management Reporting and Board Submissions Portal

Status: DRAFT for presentation to the NICTA Executive and Board (2026-08-31).

A presentation-facing summary of what the portal is, what it already does, how it is built, what a
live deployment still needs, and the decisions NICTA has to make. It is derived entirely from the
working build and the existing docs — `docs/mvp-directors-portal-plan.md`,
`docs/assumptions-and-decisions.md`, `docs/known-limitations.md`, `docs/deployment-guide.md` — and
adds no new commitments. Where those docs and this one disagree, they win; this file is the
narrative, not the specification.

## 1. The case for change

Board and SMC papers move today through email, shared drives, and hand delivery.

- **No single register** of every paper submitted to a sitting, its department, its status, and
  where its documents live.
- **Deadlines are advisory** — nothing systematically separates a paper filed inside the submission
  window from one filed after it, or records why a late paper was accepted.
- **Authority is implied, not enforced** — the line between the Corporate Secretariat's completeness
  check and the CEO's decision to send a paper to the Board is convention, not a control.
- **History is reconstructed, not recorded** — who returned a paper, on what comment, against which
  version, is answerable only by searching mailboxes.
- **Filing is manual** — the archive is only as consistent as the last person to touch it.

## 2. What is proposed

One internal portal, built to NICTA's governance process rather than configured out of a generic
workflow product. Four capabilities, one system of record:

- **Submit** — a Director uploads a completed paper against an approved template, with annexures, in
  a single step. The portal mints the reference (`SMC-26-042`) and files the documents itself.
- **Review** — an automated template check reports what is mechanically verifiable and never
  approves or rejects. The Secretariat's completeness check and the CEO's decision are human calls,
  recorded as such.
- **Decide** — an endorsed paper becomes a distinct Board Paper with its own `BP-26-020` reference
  that still links back to its SMC source. Board Members see Board Papers only.
- **Follow through** — decisions become resolutions, resolutions become action items with an owner,
  a department and a due date.

## 3. The journey of a paper

```
Director submits ──▶ Template check (advisory) ──▶ Corporate Secretariat completeness check
                                                     │
                       ┌── Returned for correction ◀─┤ (new version on resubmission)
                       │                             ▼
                       └──────────────────▶  CEO: endorse for Board (sole authority)
                                                     │
                                                     ▼
                                          Director prepares the Board Paper
                                                     │
                                                     ▼
                             Board: decisions, minutes, resolutions, action items
```

Submission windows are evaluated server-side in `Pacific/Port_Moresby`; past the deadline a
submission is blocked without a written justification, and is flagged as late everywhere it appears
alongside the original deadline and the actual submission time.

Separating the Secretariat's pack check from the CEO's Board-endorsement authority is the single
most consequential control in the design (`#A27`).

**What the system deliberately will not do.** The template check is advisory. It reports file type,
template selection and title placeholders, and asks a human to confirm anything it has not read; it
never blocks a paper, and every finding cites its source (`#A14`, `docs/known-limitations.md`).

## 4. Who sees what

Access is checked on every request against the account's role and department, re-read from the
database rather than trusted from the session cookie (`#A3`).

| Role                 | Can do                                                                                                                                 | Cannot do                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Director             | Submit SMC papers for their department, correct and resubmit returns, prepare the Board Paper once endorsed, act on delegations        | See another department's drafts; endorse for the Board |
| Corporate Secretary  | Review every SMC paper, accept or return with a mandatory comment, manage meetings/deadlines/templates/departments, raise action items | Decide that a paper goes to the Board                  |
| Chief Executive      | Read every paper org-wide, endorse or decline for the Board with a recorded reason, delegate to Directors, raise action items          | Bypass the Secretariat's completeness check            |
| Board Member         | Read Board Papers for published meetings, record a decision, comment                                                                   | See SMC papers at any stage                            |
| Board Secretariat    | Prepare meetings and agendas, record attendance, draft minutes, finalise the Board outcome, assign resolutions                         | Cast a Board decision                                  |
| System Administrator | Provision accounts, roles, departments, reference data                                                                                 | —                                                      |

Departments and roles are configurable reference data, not hardcoded enums (`#A4`) — renaming a
department or reassigning a Director is a data change, not a release.

## 5. What is already built

| Capability                    | State          | Note                                                                                               |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Sign-in, roles, departments   | Working        | Real NICTA roster provisioned (`#A21`, `#A25`); Entra implemented, awaiting tenant credentials     |
| SMC submission and register   | Working        | Upload, annexures, reference numbering, versioned resubmission                                     |
| Deadline and late enforcement | Working        | Server-side, Port Moresby time; blocked without justification, flagged everywhere (`#A27`)         |
| Template check                | Partial        | Advisory findings only; cannot yet read document text                                              |
| Secretariat review queue      | Working        | Accept for SMC or return for correction; comment mandatory on return                               |
| CEO vetting and dashboard     | Working        | Sole Board-endorsement authority, org-wide read, approval inbox, delegations (`#A27`, `#A29`)      |
| Board Papers and Board module | Working        | Meetings, agendas, attendance, decisions, comments, resolutions, minutes, action items (`#A30`)    |
| Document filing               | Partial        | Automatic naming/placement by department, meeting date, sitting number; SharePoint adapter unwired |
| Audit trail                   | Working        | Append-only across state changes, decisions, comments, document views                              |
| Notifications                 | Partial        | In-portal only; email and WhatsApp are interfaces awaiting credentials                             |
| Manager weekly reporting      | Next milestone | Role exists; the dedicated workflow does not                                                       |
| KPI / KRA pipeline            | Next milestone | `DepartmentPerformance` snapshot exists; no live collection pipeline (`#A31`)                      |
| Digital signature             | Not started    | Interface-only, pending a signing-service decision                                                 |

Every figure currently on the executive dashboards is seeded demonstration data, marked as
fictional in `prisma/seed.ts`. The dashboards are real; the numbers become real when the reporting
pipeline in section 9 is built.

## 6. How it is built

One Next.js application, one PostgreSQL database, one deployment (`#A13`). Identity, submissions,
templates, review, delegations, board, notifications and audit are separate modules reached only
through their own exported functions — clean seams without the operational cost of several
services.

Every external dependency sits behind an interface with a credential-free local implementation and
a production one, selected by environment variable:

| Dependency       | Runs today as                                  | Production target                          |
| ---------------- | ---------------------------------------------- | ------------------------------------------ |
| Authentication   | Email lookup against provisioned accounts      | Microsoft Entra ID SSO                     |
| Document storage | Server filesystem, correctly foldered          | SharePoint via Microsoft Graph             |
| Template review  | Deterministic local checks, fully source-cited | NICTA's internal closed AI service         |
| Notifications    | In-portal inbox                                | Microsoft Graph email, optionally WhatsApp |
| Workplan board   | Application database (authoritative, `#A7`)    | Microsoft Lists, if NICTA chooses          |

Selecting a production integration without its credentials fails loudly rather than silently
degrading to mock behaviour.

## 7. Governance controls

- **Append-only history** — records are added, never edited or deleted. A corrected paper is a new
  version; a changed vote is a new decision.
- **One authoritative clock** — deadlines evaluated server-side in `Pacific/Port_Moresby` (`#A11`).
- **Access checked per request** — role and department re-read from the database; Board Members are
  scoped to Board Papers of published meetings (`#A30`).
- **Filing without human error** — documents named by department, meeting date and sitting number
  (`#A22`), placed in the governance hierarchy automatically, every download logged.

Two controls need NICTA before go-live: the placeholder malware scanner must be replaced with the
organisation's real engine (`#A10`), and a Content-Security-Policy should be written and smoke-tested
against the deployed site rather than guessed at (`docs/deployment-guide.md`).

## 8. Getting it live

What NICTA supplies:

1. A long-running Node host and a managed PostgreSQL instance (plus a persistent volume if documents
   stay on the filesystem rather than SharePoint).
2. Entra ID app registration — tenant/client/secret and the security groups mapping to portal roles
   (`docs/entra-id-registration-guide.md`, `docs/graph-security-groups-guide.md`).
3. A SharePoint site and folder root, with Graph write permissions.
4. The internal AI service's real request/response contract.
5. Brand assets — vector originals of the logo and national emblem, and the approved Word template.

Then, in order: **provision and pilot** (connect Entra and SharePoint, load the real roster, run one
full SMC sitting in parallel with the existing process) → **cut over the SMC cycle** → **bring the
Board on** for the first meeting published through the portal.

## 9. What comes after

Ordered by value, not by ease. Each has foundations already in the schema; all are drawn from
`docs/known-limitations.md`.

| Milestone                                | Why it matters                                                                            | Size                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| Manager weekly reporting + KPI/KRA chain | Turns dashboard figures from demonstration data into live, rolled-up performance data     | Largest — new model plus two workflows |
| Email and WhatsApp delivery              | Decisions and returns reach Directors without waiting for the next sign-in                | Small — interface exists               |
| Full Board paper lifecycle               | Pack-check, meeting stages, minute-out, archive as enforced states, not the current three | Medium                                 |
| Board meeting scheduling                 | Board Papers currently inherit the SMC sitting's date for filing                          | Medium                                 |
| Quorum and voting rules                  | Replaces the labelled placeholder with NICTA's real rules                                 | Small — one isolated module            |
| Document text extraction                 | Lets the template check read contents, still advisory                                     | Medium                                 |
| Digital signature                        | Signed minutes and resolutions                                                            | Medium — needs a vendor decision first |

## 10. Decisions needed from NICTA

1. **One workflow engine, or the pattern we have?** An earlier client instruction was explicit — do
   not introduce a generic workflow engine; a later one asked for a single shared engine across
   every document type. Today every domain uses the identical table-driven pattern in its own
   module; consolidating is a bounded, low-risk refactor with no new user-facing capability. This is
   the single assumption most needing explicit confirmation (`#A31`).
2. **The Board's real quorum and majority rules** — the current rule is a labelled placeholder that
   only suggests an outcome; the Secretariat always finalises manually (`#A30`).
3. **Is SharePoint the archive, or the portal?** The application database is authoritative today
   (`#A7`); connecting SharePoint changes where the documents of record live.
4. **Who may raise action items, and against whom?** Currently CEO and Corporate Secretary, on any
   paper; delegation runs CEO → Director only (`#A29`).
5. **What does the internal AI service actually return?** Without its real contract the review
   provider stays a documented stub and the template check stays structural.

**Recommendation.** Proceed to a parallel-run pilot on the next SMC sitting, on the build as it
stands with Entra and SharePoint connected. It converts the questions above into answers grounded in
a real cycle, at the cost of one sitting of duplicated effort rather than a quarter of further
specification.
