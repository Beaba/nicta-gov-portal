import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { addUserAction } from '@/app/admin/users/actions';

export default async function UsersAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN' || r.roleCode === 'REVIEWER_SECRETARIAT')
  )
    redirect('/');

  // Role and Department are DB-backed reference data, never hardcoded enums — see
  // docs/assumptions-and-decisions.md#A4. SEED_ROLES is only the seed list, so the selectable
  // options here come from the database.
  const [users, departments, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: { department: true, roles: { include: { role: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <PortalShell user={user} active="admin">
      <Link href="/admin" className="text-sm text-nicta-teal hover:underline">
        ← Back to Administration
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-nicta-teal-dark">Users</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Microsoft sign-in never creates accounts on its own — a person can only sign in once their
        account exists here (docs/assumptions-and-decisions.md#A3). Real accounts must therefore be
        added with the person&rsquo;s actual Entra ID / Microsoft 365 email address: that address is
        what matches them at sign-in once <code>AUTH_PROVIDER=entra</code> is configured (see{' '}
        <code>docs/entra-id-registration-guide.md</code>). An address that doesn&rsquo;t match their
        Microsoft account will be rejected as not provisioned.
      </p>

      <table className="mt-6 w-full border-collapse overflow-hidden rounded-md border border-nicta-neutral-200 bg-white text-sm">
        <thead className="bg-nicta-neutral-100 text-left text-nicta-neutral-700">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Department</th>
            <th className="px-4 py-2">Roles</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-nicta-neutral-200">
              <td className="px-4 py-2">{u.name}</td>
              <td className="px-4 py-2 text-nicta-neutral-700">{u.email}</td>
              <td className="px-4 py-2">{u.department?.name ?? 'Organisation-wide'}</td>
              <td className="px-4 py-2">{u.roles.map((r) => r.role.name).join(', ') || '—'}</td>
              <td className="px-4 py-2">{u.isActive ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        action={addUserAction}
        className="mt-8 space-y-4 rounded-md border border-nicta-neutral-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Add User</h2>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">
            Email (Entra ID / Microsoft 365 address)
          </span>
          <input
            type="email"
            name="email"
            required
            className="input mt-1"
            placeholder="e.g. jane.doe@nicta.gov.pg"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Full Name</span>
          <input name="name" required className="input mt-1" placeholder="e.g. Jane Doe" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Job Title</span>
          <input
            name="jobTitle"
            className="input mt-1"
            placeholder="Optional — e.g. Director, Licensing"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Department</span>
          <select name="departmentId" className="input mt-1">
            <option value="">Organisation-wide</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Role</span>
          <select name="roleId" required className="input mt-1">
            <option value="">Select…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-nicta-teal px-4 py-2 text-sm font-medium text-white hover:bg-nicta-teal-dark"
        >
          Add User
        </button>
      </form>
    </PortalShell>
  );
}
