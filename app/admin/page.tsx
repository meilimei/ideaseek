import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const cards = [
  { href: '/admin/jobs', title: 'Jobs', description: 'Manage background jobs and ingestion runs.' },
  { href: '/admin/ideas', title: 'Ideas', description: 'Review, approve, or edit ideas.' },
  { href: '/admin/trends', title: 'Trends', description: 'Inspect trend enrichment and metrics.' },
  { href: '/admin/raw', title: 'Raw Data', description: 'Debug raw ingestions and snapshots.' },
];

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">
          Internal tools for managing jobs, ideas, trends, and raw data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{card.description}</p>
            <div className="mt-3 text-sm text-indigo-600">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
