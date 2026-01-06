import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function EditStrategyPage({
  params,
}: {
  params: { id: string };
}) {
  const strategyId = params?.id ?? '';
  redirect(
    `/dashboard/strategies/edit/step-1?mode=edit&strategyId=${encodeURIComponent(
      strategyId,
    )}`,
  );
}
