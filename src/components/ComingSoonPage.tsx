import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppHeader } from '@/components/AppHeader';

// Future-module landing pages (workplans, SMC/Board dashboards, executive view — see
// docs/milestone-1-plan.md) route here so demo users seeded for those roles get a real page
// instead of a 404, without pulling those modules' UI into Milestone 1 scope.
export async function ComingSoonPage({ moduleName }: { moduleName: string }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-nicta-teal-dark">{moduleName}</h1>
        <p className="mt-3 text-sm text-nicta-neutral-700">
          This module is planned for a later phase and is not part of the Milestone 1 submission
          &amp; review portal. Its data model and provider foundations are already in place — see
          docs/milestone-1-plan.md.
        </p>
      </main>
    </>
  );
}
