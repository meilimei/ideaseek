import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export default async function AdminTrendsPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Trends"
        description="Inspect trends and enrichment (coming soon)."
      />
    </div>
  );
}
