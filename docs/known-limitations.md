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
