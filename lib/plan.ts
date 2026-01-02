export type Plan = 'free' | 'pro' | 'admin';

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  admin: 2,
};

const PLAN_VALUES = new Set<Plan>(['free', 'pro', 'admin']);

export async function getUserPlan(opts: {
  supabase: any;
  userId: string;
}): Promise<Plan> {
  const { supabase, userId } = opts;

  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error || !data) {
    return 'free';
  }

  const rawPlan = typeof data.plan === 'string' ? data.plan.toLowerCase().trim() : '';
  if (PLAN_VALUES.has(rawPlan as Plan)) {
    return rawPlan as Plan;
  }

  return 'free';
}

export function assertPlan(plan: Plan, required: Plan, message?: string): void {
  if (PLAN_RANK[plan] < PLAN_RANK[required]) {
    throw new Error(message ?? `Requires ${required} plan`);
  }
}

export function planDeniedResponse(message: string) {
  return new Response(JSON.stringify({ error: 'plan_denied', message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}
