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

  const candidates = ['id', 'user_id', 'uid'] as const;

  for (const column of candidates) {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq(column as any, userId)
      .maybeSingle();

    if (error) {
      const message =
        typeof (error as any)?.message === 'string' ? (error as any).message : '';
      if (
        message.includes(`column profiles.${column} does not exist`) ||
        message.includes('does not exist')
      ) {
        continue;
      }
      throw error;
    }

    if (!data) {
      continue;
    }

    const rawPlan = typeof data.plan === 'string' ? data.plan.toLowerCase().trim() : '';
    if (PLAN_VALUES.has(rawPlan as Plan)) {
      return rawPlan as Plan;
    }
    return 'free';
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
