import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import IdeasClient from './IdeasClient';

export const dynamic = 'force-dynamic';

export default async function AdminIdeasPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ideas (Data)"
        description="Manage ideas, publishing, and deletion."
      />
      <IdeasClient />
    </div>
  );
}
