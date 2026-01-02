export type QuotaPlan = 'free' | 'pro' | 'admin';
export type QuotaEventType = 'ingest' | 'enrich';

export const QUOTAS = {
  free: { ingestPerDay: 0, enrichPerDay: 0, ingestPerMonth: 0, enrichPerMonth: 0 },
  pro: {
    ingestPerDay: 30,
    enrichPerDay: 100,
    ingestPerMonth: 300,
    enrichPerMonth: 2000,
  },
  admin: {
    ingestPerDay: Infinity,
    enrichPerDay: Infinity,
    ingestPerMonth: Infinity,
    enrichPerMonth: Infinity,
  },
} as const;

export function startOfUtcDayIso(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
}

export function startOfUtcMonthIso(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
}

async function getUsageCountSince(
  supabase: any,
  userId: string,
  eventType: QuotaEventType,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function getDailyUsageCount(
  supabase: any,
  userId: string,
  eventType: QuotaEventType,
  now = new Date(),
): Promise<number> {
  return getUsageCountSince(
    supabase,
    userId,
    eventType,
    startOfUtcDayIso(now),
  );
}

export async function getMonthlyUsageCount(
  supabase: any,
  userId: string,
  eventType: QuotaEventType,
  now = new Date(),
): Promise<number> {
  return getUsageCountSince(
    supabase,
    userId,
    eventType,
    startOfUtcMonthIso(now),
  );
}

export function assertQuota(
  plan: QuotaPlan,
  eventType: QuotaEventType,
  usedDaily: number,
  usedMonthly: number,
): void {
  const dailyLimit =
    eventType === 'ingest' ? QUOTAS[plan].ingestPerDay : QUOTAS[plan].enrichPerDay;
  const monthlyLimit =
    eventType === 'ingest'
      ? QUOTAS[plan].ingestPerMonth
      : QUOTAS[plan].enrichPerMonth;

  if (dailyLimit !== Infinity && usedDaily >= dailyLimit) {
    const err = new Error('quota_exceeded_daily');
    (err as any).code = 'quota_exceeded_daily';
    (err as any).meta = { plan, eventType, usedDaily, dailyLimit };
    throw err;
  }
  if (monthlyLimit !== Infinity && usedMonthly >= monthlyLimit) {
    const err = new Error('quota_exceeded_monthly');
    (err as any).code = 'quota_exceeded_monthly';
    (err as any).meta = { plan, eventType, usedMonthly, monthlyLimit };
    throw err;
  }
}

export async function recordUsageEvent(
  supabase: any,
  args: { userId: string; eventType: QuotaEventType; jobId?: number | null; meta?: any },
): Promise<void> {
  const { error } = await supabase.from('usage_events').insert({
    user_id: args.userId,
    event_type: args.eventType,
    job_id: args.jobId ?? null,
    meta: args.meta ?? {},
  });
  if (error) throw error;
}
