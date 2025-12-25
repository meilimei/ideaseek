import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
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
      <AdminPageHeader
        title="Strategies"
        description="Configure ingestion strategies for Reddit, YouTube, and Google Trends without touching code."
      />
      <StrategiesClient strategies={strategies} />
    </div>
  );
}
