import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CardBody, CardHeading, GlassCard } from '@/components/admin/primitives';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const cards = [
  { href: '/admin/jobs', title: 'Jobs', description: 'Manage background jobs and ingestion runs.' },
  { href: '/admin/ideas', title: 'Ideas', description: 'Review, approve, or edit ideas.' },
  { href: '/admin/trends', title: 'Trends', description: 'Inspect trend enrichment and metrics.' },
  { href: '/admin/raw', title: 'Raw Data', description: 'Debug raw ingestions and snapshots.' },
];

export default async function AdminHomePage() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Dashboard"
        description="Internal tools for managing jobs, ideas, trends, and raw data."
        hideBackLink
      />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group h-full">
            <GlassCard className="h-full border-border/50 bg-card/70 transition hover:-translate-y-0.5 hover:border-border/80 hover:shadow-lg">
              <CardHeading title={card.title} description={card.description} />
              <CardBody className="pt-0 text-sm text-primary group-hover:text-primary/90">
                Open →
              </CardBody>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
