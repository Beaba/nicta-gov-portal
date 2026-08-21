import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LANDING_PAGE, ROLE_LANDING_PRIORITY } from '@/lib/config/roles';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const primaryRole = ROLE_LANDING_PRIORITY.find((role) =>
    user.roles.some((r) => r.roleCode === role),
  );
  redirect(primaryRole ? ROLE_LANDING_PAGE[primaryRole] : '/login');
}
