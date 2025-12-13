import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export default async function AdminTrendsPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">Trends</h1>
      <p className="text-sm text-gray-600">Inspect trends and enrichment (coming soon).</p>
    </div>
  );
}
