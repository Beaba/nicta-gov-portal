import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listSemcOutcomesForUser } from '@/lib/semc/outcomes';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';

export default async function SemcOutcomesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const outcomes = await listSemcOutcomesForUser(user);

  return (
    <PortalShell user={user} active="semc-outcomes">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">SEMC Decisions &amp; Actions</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Every recorded SEMC outcome, with the decision wording, SEMC/CEO comments, responsible
        Director, and any assigned actions.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      {outcomes.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-sm">
          <EmptyState title="No SEMC outcomes recorded yet." />
        </div>
      ) : (
        <section className="mt-6 space-y-3">
          {outcomes.map((o) => (
            <div key={o.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-nicta-teal">{o.submission.referenceNumber}</p>
                  <p className="font-semibold text-nicta-teal-dark">{o.submission.title}</p>
                  <p className="text-xs text-nicta-neutral-700">{o.submission.department.name}</p>
                </div>
                <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                  {o.decisionType.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
              {o.notes && <p className="mt-2 text-sm text-nicta-neutral-700">{o.notes}</p>}
              {o.conditions && (
                <p className="mt-1 text-xs text-nicta-neutral-700">
                  <strong>SEMC comments:</strong> {o.conditions}
                </p>
              )}
              <p className="mt-2 text-[11px] text-nicta-neutral-700">
                Recorded {o.decisionDate.toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      )}
    </PortalShell>
  );
}
