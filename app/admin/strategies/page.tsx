import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { listStrategies, type IngestStrategy } from '@/lib/server/adminStrategies';
import StrategiesClient from './StrategiesClient';

export const dynamic = 'force-dynamic';

export default async function AdminStrategiesPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  let strategies: IngestStrategy[] = [];
  let loadError: string | null = null;

  try {
    strategies = await listStrategies({ source: 'all', includeInactive: true });
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Strategies"
        description="Configure ingestion strategies for Reddit, YouTube, and Google Trends without touching code."
      />
      {loadError && (
        <div className="text-sm text-muted-foreground">
          Unable to load strategies right now. Try refreshing.
        </div>
      )}
      <StrategiesClient strategies={strategies} />
    </div>
  );
}
