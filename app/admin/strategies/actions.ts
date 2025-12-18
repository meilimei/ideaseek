'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import {
  createStrategy,
  getStrategyById,
  updateStrategy,
  type IngestStrategySource,
} from '@/lib/server/adminStrategies';

type ActionState = { error?: string; success?: boolean };

const SOURCE_OPTIONS: IngestStrategySource[] = [
  'reddit',
  'youtube',
  'google_trends',
];

function parseConfig(raw: FormDataEntryValue | null): { ok: true; value: any } | { ok: false; error: string } {
  const str = typeof raw === 'string' ? raw.trim() : '';
  if (!str) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(str) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
}

export async function createStrategyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    return { error: 'Not authorized' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim() as IngestStrategySource;
  const description = formData.get('description');
  const isActive = formData.get('is_active') === 'on';
  const cronExpr = formData.get('cron_expr');
  const parsedConfig = parseConfig(formData.get('config'));

  if (!name) return { error: 'Name is required' };
  if (!SOURCE_OPTIONS.includes(source)) return { error: 'Invalid source' };
  if (!parsedConfig.ok) return { error: `Config JSON error: ${parsedConfig.error}` };

  try {
    await createStrategy({
      name,
      source,
      description: description ? String(description) : undefined,
      is_active: isActive,
      config: parsedConfig.value,
      cron_expr: cronExpr ? String(cronExpr) : undefined,
      created_by: auth.user.id,
    });
    revalidatePath('/admin/strategies');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create strategy' };
  }
}

export async function updateStrategyAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    return { error: 'Not authorized' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim() as IngestStrategySource;
  const description = formData.get('description');
  const isActive = formData.get('is_active') === 'on';
  const cronExpr = formData.get('cron_expr');
  const parsedConfig = parseConfig(formData.get('config'));

  if (!name) return { error: 'Name is required' };
  if (!SOURCE_OPTIONS.includes(source)) return { error: 'Invalid source' };
  if (!parsedConfig.ok) return { error: `Config JSON error: ${parsedConfig.error}` };

  try {
    await updateStrategy(id, {
      name,
      source,
      description: description ? String(description) : '',
      is_active: isActive,
      config: parsedConfig.value,
      cron_expr: cronExpr ? String(cronExpr) : '',
    });
    revalidatePath('/admin/strategies');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update strategy' };
  }
}

export async function toggleStrategyActiveAction(
  id: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    return { error: 'Not authorized' };
  }

  try {
    const strategy = await getStrategyById(id);
    if (!strategy) return { error: 'Strategy not found' };
    await updateStrategy(id, { is_active: !strategy.is_active });
    revalidatePath('/admin/strategies');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to toggle active' };
  }
}
