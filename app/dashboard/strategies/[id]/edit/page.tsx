import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import CreateStrategyCard from '../../CreateStrategyCard';

export const dynamic = 'force-dynamic';

type StrategyRow = {
  id: string;
  name: string;
  source: string | null;
  description: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  config: Record<string, unknown> | null;
};

export default async function EditStrategyPage({
  params,
}: {
  params: { id: string };
}) {
  const strategyId = params?.id;
  const isUuid =
    typeof strategyId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      strategyId,
    );
  if (!isUuid) {
    return notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy edit:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('id, name, source, description, is_active, cron_expr, config')
    .eq('id', strategyId)
    .eq('created_by', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to load strategy for edit:', error.message);
  }

  if (!data) {
    return notFound();
  }

  const strategy = data as StrategyRow;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/strategies">Back to Strategies</Link>
        </Button>
      </div>
      <CreateStrategyCard mode="edit" initialStrategy={strategy} />
    </div>
  );
}
