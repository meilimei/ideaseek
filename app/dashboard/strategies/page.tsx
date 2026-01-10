import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import StrategiesClient from './StrategiesClient';

export const dynamic = 'force-dynamic';

type StrategyRow = {
  id: string;
  name: string | null;
  source: string | null;
  description: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
  ideas_visibility: string | null;
};

async function fetchStrategies(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ingest_strategies')
    .select(
      'id, name, source, description, is_active, cron_expr, created_at, updated_at, last_run_at, last_run_status, last_error, ideas_visibility',
    )
    .eq('created_by', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load user strategies:', error.message);
  }

  return (data ?? []) as StrategyRow[];
}

export default async function StrategiesPage({
  searchParams,
}: {
  searchParams?:
    | { [key: string]: string | string[] | undefined }
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard strategies:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const strategies = await fetchStrategies(user.id);
  const toast =
    typeof resolvedSearchParams?.toast === 'string' ? resolvedSearchParams.toast : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Strategy Center</h1>
          <p className="text-sm text-muted-foreground">
            Build and manage ingestion strategies for your workspace.
          </p>
          {toast === 'updated' && (
            <span className="text-sm text-emerald-400">Changes saved.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/strategies/new/step-1">
              Create New Strategy (Guided)
            </Link>
          </Button>
        </div>
      </div>

      <StrategiesClient strategies={strategies} />
    </div>
  );
}
