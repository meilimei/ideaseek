import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { listStrategies } from '@/lib/server/adminStrategies';
import StrategiesClient from './StrategiesClient';

export const dynamic = 'force-dynamic';

export default async function AdminStrategiesPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  const strategies = await listStrategies({ source: 'all', includeInactive: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Strategies</h1>
          <p className="text-sm text-gray-600">
            Configure ingestion strategies for Reddit, YouTube, and Google Trends without touching code.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <StrategiesClient strategies={strategies} />
    </div>
  );
}
