import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listTemplates } from '@/lib/templates/templates';
import { listActivePaperTypes } from '@/lib/config/paperTypes';
import { PortalShell } from '@/components/PortalShell';
import { uploadTemplateVersionAction } from '@/app/admin/templates/actions';

export default async function TemplatesAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN' || r.roleCode === 'REVIEWER_SECRETARIAT')
  )
    redirect('/');

  const [templates, paperTypes] = await Promise.all([listTemplates(), listActivePaperTypes('SMC')]);

  return (
    <PortalShell user={user} active="admin">
      <Link href="/admin" className="text-sm text-nicta-teal hover:underline">
        ← Back to Administration
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-nicta-teal-dark">Templates</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Uploading a new version never overwrites the previous approved file — the prior version is
        kept and marked superseded.
      </p>

      <table className="mt-6 w-full border-collapse overflow-hidden rounded-md border border-nicta-neutral-200 bg-white text-sm">
        <thead className="bg-nicta-neutral-100 text-left text-nicta-neutral-700">
          <tr>
            <th className="px-4 py-2">Paper Type</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-nicta-neutral-200">
              <td className="px-4 py-2">{t.paperType ?? '—'}</td>
              <td className="px-4 py-2">{t.name}</td>
              <td className="px-4 py-2">v{t.version}</td>
              <td className="px-4 py-2">
                {t.isActive ? 'Active' : 'Superseded'}
                {t.isPlaceholder ? ' · Placeholder' : ''}
              </td>
              <td className="px-4 py-2 text-nicta-neutral-700">
                {t.uploadedAt.toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        action={uploadTemplateVersionAction}
        className="mt-8 space-y-4 rounded-md border border-nicta-neutral-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-nicta-neutral-900">
          Upload New Template Version
        </h2>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Paper Type</span>
          <select name="paperType" required className="input mt-1">
            <option value="">Select…</option>
            {paperTypes.map((pt) => (
              <option key={pt.id} value={pt.name}>
                {pt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">Template Name</span>
          <input
            name="name"
            required
            className="input mt-1"
            placeholder="e.g. SMC Decision Paper Template v2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-nicta-neutral-900">File (.docx)</span>
          <input type="file" name="file" required accept=".docx,.doc" className="mt-1 text-sm" />
        </label>
        <button
          type="submit"
          className="rounded-md bg-nicta-teal px-4 py-2 text-sm font-medium text-white hover:bg-nicta-teal-dark"
        >
          Upload
        </button>
      </form>
    </PortalShell>
  );
}
