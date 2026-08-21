import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getEnv } from '@/lib/config/env';
import { AppHeader } from '@/components/AppHeader';
import { addDepartmentAction, addMeetingAction, addPaperTypeAction } from '@/app/admin/actions';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Corporate Secretary is the Admin ("ensures deadlines are created") — client requirement, see
  // docs/mvp-directors-portal-plan.md#A18.
  if (
    !user.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN' || r.roleCode === 'REVIEWER_SECRETARIAT')
  )
    redirect('/');

  const env = getEnv();
  const [departments, meetings, paperTypes, recentAuditEvents] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.meeting.findMany({
      orderBy: { meetingDate: 'desc' },
      take: 10,
      include: { deadline: true },
    }),
    prisma.paperType.findMany({ orderBy: { name: 'asc' } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return (
    <>
      <AppHeader user={user} active="admin" />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold text-nicta-teal-dark">Administration</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            Active providers — Auth: <strong>{env.AUTH_PROVIDER}</strong>, Documents:{' '}
            <strong>{env.DOCUMENT_STORAGE_PROVIDER}</strong>, AI: <strong>{env.AI_PROVIDER}</strong>
            , Notifications: <strong>{env.NOTIFICATION_PROVIDER}</strong>.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link
              href="/admin/templates"
              className="inline-block text-sm text-nicta-teal hover:underline"
            >
              Manage Templates →
            </Link>
            <Link
              href="/admin/users"
              className="inline-block text-sm text-nicta-teal hover:underline"
            >
              Manage Users →
            </Link>
          </div>
        </div>

        <Section title="Departments">
          <ul className="space-y-1 text-sm">
            {departments.map((d) => (
              <li key={d.id}>
                <strong>{d.code}</strong> — {d.name}
              </li>
            ))}
          </ul>
          <form action={addDepartmentAction} className="mt-4 flex flex-wrap items-end gap-3">
            <LabeledInput name="code" label="Code" placeholder="e.g. FINANCE" />
            <LabeledInput name="name" label="Name" placeholder="e.g. Finance Department" />
            <SubmitButton label="Add Department" />
          </form>
        </Section>

        <Section title="SMC Meetings &amp; Deadlines">
          <ul className="space-y-1 text-sm">
            {meetings.map((m) => (
              <li key={m.id}>
                <strong>{m.meetingNumber}</strong> — {m.title} ({m.meetingDate.toLocaleDateString()}
                ) — {m.status}
                {m.deadline && (
                  <span className="text-nicta-neutral-700">
                    {' '}
                    · Submission deadline: {m.deadline.normalCloseAt.toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form action={addMeetingAction} className="mt-4 flex flex-wrap items-end gap-3">
            <LabeledInput
              name="meetingNumber"
              label="Meeting Number"
              placeholder="e.g. SMC-2026-04"
            />
            <LabeledInput name="title" label="Title" placeholder="e.g. SMC Meeting — April 2026" />
            <label className="text-sm">
              <span className="block font-medium text-nicta-neutral-900">Meeting Date</span>
              <input type="date" name="meetingDate" required className="input mt-1" />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-nicta-neutral-900">Submission Deadline</span>
              <input type="datetime-local" name="submissionDeadline" className="input mt-1" />
            </label>
            <SubmitButton label="Add Meeting" />
          </form>
        </Section>

        <Section title="Paper Types">
          <ul className="space-y-1 text-sm">
            {paperTypes.map((pt) => (
              <li key={pt.id}>
                {pt.name} {pt.requiresRecommendation ? '(requires recommendation)' : ''}{' '}
                {pt.isActive ? '' : '(inactive)'}
              </li>
            ))}
          </ul>
          <form action={addPaperTypeAction} className="mt-4 flex flex-wrap items-end gap-3">
            <LabeledInput name="name" label="Name" placeholder="e.g. Board Information Paper" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requiresRecommendation" />
              Requires recommendation &amp; decision
            </label>
            <SubmitButton label="Add Paper Type" />
          </form>
        </Section>

        <Section title="Recent Audit Events">
          <p className="mb-2 text-xs text-nicta-neutral-700">
            All providers run in mock mode, so there are no live integration failures to show — this
            list will surface them here once a real Entra/SharePoint/AI connection is configured.
          </p>
          <table className="w-full border-collapse overflow-hidden rounded-md border border-nicta-neutral-200 bg-white text-xs">
            <thead className="bg-nicta-neutral-100 text-left text-nicta-neutral-700">
              <tr>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditEvents.map((e) => (
                <tr key={e.id} className="border-t border-nicta-neutral-200">
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2 text-nicta-neutral-700">
                    {e.entityType} {e.entityId ?? ''}
                  </td>
                  <td className="px-3 py-2 text-nicta-neutral-700">
                    {e.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-nicta-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-nicta-neutral-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LabeledInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block font-medium text-nicta-neutral-900">{label}</span>
      <input name={name} placeholder={placeholder} required className="input mt-1" />
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-nicta-teal px-4 py-2 text-sm font-medium text-white hover:bg-nicta-teal-dark"
    >
      {label}
    </button>
  );
}
