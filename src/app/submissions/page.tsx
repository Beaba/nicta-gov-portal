import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listActiveTemplates } from '@/lib/templates/templates';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { getCurrentSmcMeetingWithDeadline } from '@/lib/submissions/meetings';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DashboardMeetingBar } from '@/components/DashboardMeetingBar';
import { StatusBadge } from '@/components/StatusBadge';
import { NewSubmissionModal } from '@/components/NewSubmissionModal';
import { DocumentIcon, PaperPlaneIcon, ShieldCheckIcon } from '@/components/icons';

// Dates are formatted in Pacific/Port_Moresby, never the server or browser's local zone — same
// rule as every date shown in this app (CLAUDE.md, docs/assumptions-and-decisions.md#A11).
const formatDate = (d: Date) =>
  DateTime.fromJSDate(d).setZone('Pacific/Port_Moresby').toFormat('d MMMM yyyy');

export default async function MySubmissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'SUBMITTER')) redirect('/');

  const [submissions, templates, meeting] = await Promise.all([
    prisma.submission.findMany({
      where: { createdById: user.id },
      include: { department: true, meeting: true },
      orderBy: { createdAt: 'desc' },
    }),
    listActiveTemplates(),
    getCurrentSmcMeetingWithDeadline(),
  ]);

  const storage = getDocumentStorageProvider();
  const templateDownloads = await Promise.all(
    templates.map(async (t) => ({ ...t, downloadUrl: await storage.getDownloadUrl(t.filePath) })),
  );

  const draftCount = submissions.filter((s) => s.workflowStatus === 'DRAFT').length;
  const submittedCount = submissions.filter((s) => s.workflowStatus !== 'DRAFT').length;
  const vettedCount = submissions.filter((s) => s.endorsedForBoard).length;

  return (
    <PortalShell user={user} active="submissions">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nicta-teal-dark">Director Dashboard</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">Portal / Directors</p>
          <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
        </div>
        <NewSubmissionModal templates={templates} variant="button" />
      </div>

      <NewSubmissionModal templates={templates} variant="banner" />

      <DashboardMeetingBar
        meetingDate={meeting?.meetingDate ?? null}
        submissionsCloseAt={meeting?.deadline?.normalCloseAt ?? null}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardStatCard label="Drafts" value={draftCount} icon={DocumentIcon} />
        <DashboardStatCard label="Submitted" value={submittedCount} icon={PaperPlaneIcon} />
        <DashboardStatCard label="Vetted for Board" value={vettedCount} icon={ShieldCheckIcon} />
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">My SMC Submissions</h2>

        {submissions.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
            You have not created any submissions yet. Use &ldquo;Start submission&rdquo; above.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Paper title</th>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Updated</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{s.referenceNumber}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-nicta-teal-dark">{s.title}</p>
                    <p className="text-xs text-nicta-neutral-700">{s.department.name}</p>
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {s.meeting ? formatDate(s.meeting.meetingDate) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge submission={s} />
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{formatDate(s.updatedAt)}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/submissions/${s.id}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      {s.workflowStatus === 'DRAFT'
                        ? 'Continue'
                        : s.workflowStatus === 'RETURNED'
                          ? 'Correct'
                          : 'View'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-nicta-teal-dark">Approved NICTA Templates</h2>

        {templateDownloads.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">
            No templates have been approved yet.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templateDownloads.map((t) => (
              <a
                key={t.id}
                href={t.downloadUrl}
                className="rounded-md border border-nicta-neutral-200 p-4 text-sm hover:bg-nicta-neutral-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nicta-teal-light text-nicta-teal-dark">
                  <DocumentIcon className="h-4 w-4" />
                </span>
                <span className="mt-3 block font-medium text-nicta-teal-dark">{t.name}</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
