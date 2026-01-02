export type QuotaPlan = 'free' | 'pro' | 'admin';
export type QuotaEventType = 'ingest' | 'enrich';

export const QUOTAS = {
  free: { ingestPerDay: 0, enrichPerDay: 0 },
  pro: { ingestPerDay: 30, enrichPerDay: 100 },
  admin: { ingestPerDay: Infinity, enrichPerDay: Infinity },
} as const;

export function startOfUtcDayIso(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
}

export async function getDailyUsageCount(
  supabase: any,
  userId: string,
  eventType: QuotaEventType,
  now = new Date(),
): Promise<number> {
  const since = startOfUtcDayIso(now);
  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', since);
  if (error) throw error;
  return count ?? 0;
}

export function assertDailyQuota(
  plan: QuotaPlan,
  eventType: QuotaEventType,
  usedCount: number,
): void {
  const quota =
    eventType === 'ingest' ? QUOTAS[plan].ingestPerDay : QUOTAS[plan].enrichPerDay;
  if (quota === Infinity) return;
  if (usedCount >= quota) {
    const err = new Error('quota_exceeded');
    (err as any).code = 'quota_exceeded';
    (err as any).meta = { plan, eventType, usedCount, quota };
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
