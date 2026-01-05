'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertPlan, getUserPlan } from '@/lib/plan';

const DEFAULT_CRON = '0 */6 * * *';
const SOURCE_OPTIONS = new Set(['reddit', 'youtube', 'google_trends', 'trends']);

function normalizeSource(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'trends') return 'google_trends';
  if (SOURCE_OPTIONS.has(normalized)) return normalized;
  return null;
}

function parseConfig(raw: string) {
  const input = raw.trim();
  if (!input) return { ok: true as const, value: {} };
  try {
    return { ok: true as const, value: JSON.parse(input) };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
}

type StrategyUpdatePatch = {
  name?: string;
  description?: string | null;
  cronExpr?: string;
  cron?: string;
  isActive?: boolean;
  source?: string;
  config?: unknown;
  configText?: string;
};

export async function createStrategy(input: {
  name: string;
  source: string;
  description?: string | null;
  isActive: boolean;
  cronExpr?: string;
  configText: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy create:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  try {
    assertPlan(plan, 'pro', 'Upgrade to Pro to create strategies.');
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Plan denied' };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: 'Name is required' };
  }

  const source = normalizeSource(input.source);
  if (!source) {
    return { ok: false, error: 'Invalid source' };
  }

  const parsedConfig = parseConfig(input.configText);
  if (!parsedConfig.ok) {
    return { ok: false, error: `Config JSON error: ${parsedConfig.error}` };
  }

  const cronExpr = input.cronExpr?.trim() || DEFAULT_CRON;

  const { error } = await supabase
    .from('ingest_strategies')
    .insert({
      name,
      source,
      description: input.description?.trim() || null,
      is_active: input.isActive,
      cron_expr: cronExpr,
      config: parsedConfig.value,
      created_by: user.id,
    });

  if (error) {
    console.error('Failed to create strategy:', error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/strategies');
  return { ok: true };
}

export async function updateStrategy(strategyId: string, patch: StrategyUpdatePatch) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy update:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const update: Record<string, unknown> = {};

  if (typeof patch.name === 'string') {
    const name = patch.name.trim();
    if (!name) {
      return { ok: false, error: 'Name is required' };
    }
    update.name = name;
  }

  if (patch.description !== undefined) {
    if (patch.description === null) {
      update.description = null;
    } else {
      const description = patch.description.trim();
      update.description = description ? description : null;
    }
  }

  const cronExpr = (patch.cronExpr ?? patch.cron)?.trim();
  if (cronExpr !== undefined) {
    if (!cronExpr) {
      return { ok: false, error: 'Cron expression is required' };
    }
    update.cron_expr = cronExpr;
  }

  if (typeof patch.isActive === 'boolean') {
    update.is_active = patch.isActive;
  }

  if (typeof patch.source === 'string') {
    const source = normalizeSource(patch.source);
    if (!source) {
      return { ok: false, error: 'Invalid source' };
    }
    update.source = source;
  }

  if (patch.config !== undefined || typeof patch.configText === 'string') {
    if (patch.config !== undefined) {
      update.config = patch.config;
    } else if (typeof patch.configText === 'string') {
      const parsed = parseConfig(patch.configText);
      if (!parsed.ok) {
        return { ok: false, error: `Config JSON error: ${parsed.error}` };
      }
      update.config = parsed.value;
    }
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: 'No updates provided' };
  }

  const { error } = await supabase
    .from('ingest_strategies')
    .update(update)
    .eq('id', strategyId)
    .eq('created_by', user.id);

  if (error) {
    console.error('Failed to update strategy:', error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/strategies');
  return { ok: true };
}

export async function toggleStrategyActive(id: string, currentActive: boolean | null) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy toggle:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const nextActive = !Boolean(currentActive);

  const { error } = await supabase
    .from('ingest_strategies')
    .update({ is_active: nextActive })
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) {
    console.error('Failed to toggle strategy active:', error.message);
  }

  revalidatePath('/dashboard/strategies');
}

export async function deleteStrategy(strategyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy delete:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { error } = await supabase
    .from('ingest_strategies')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', strategyId)
    .eq('created_by', user.id);

  if (error) {
    console.error('Failed to delete strategy:', error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/strategies');
  return { ok: true };
}
