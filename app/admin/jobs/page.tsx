import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import AdminJobsClient from './AdminJobsClient';

export const dynamic = 'force-dynamic';

export default async function AdminJobsPage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Jobs</h1>
          <p className="text-sm text-gray-600">
            Trigger ingestion pipelines and review recent runs.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <AdminJobsClient />
    </div>
  );
}
