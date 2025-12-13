import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export default async function AdminRawPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">Raw Data</h1>
      <p className="text-sm text-gray-600">Inspect raw ingestions (coming soon).</p>
    </div>
  );
}
