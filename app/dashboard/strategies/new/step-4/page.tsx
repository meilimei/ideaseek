'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminInput, AdminSelect } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { createStrategy } from '../../actions';
import { useDraft } from '../_draft/context';
import SummaryCard from '../_components/SummaryCard';
import WizardShell from '../_components/WizardShell';

export default function StrategyStep4Page() {
  const router = useRouter();
  const { draft, updateDraft, resetDraft } = useDraft();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const weeklyCron = '0 0 * * 0';
  const scheduleOptions = [
    { id: 'weekly', label: 'Weekly', cron: weeklyCron },
    { id: 'daily', label: 'Daily', cron: '0 0 * * *' },
    { id: 'every_6_hours', label: 'Every 6 hours', cron: '0 */6 * * *' },
    { id: 'every_hour', label: 'Every hour', cron: '0 * * * *' },
    { id: 'monthly', label: 'Monthly', cron: '0 0 1 * *' },
    { id: 'manual', label: 'Manual', cron: '' },
  ];

  const [schedule, setSchedule] = useState(() => {
    const cron = draft.cron ?? '';
    const matched = scheduleOptions.find((option) => option.cron === cron);
    return matched?.id ?? 'weekly';
  });

  useEffect(() => {
    if (!draft.cron) {
      updateDraft({ cron: weeklyCron });
      setSchedule('weekly');
    }
    if (draft.active === undefined) {
      updateDraft({ active: true });
    }
  }, [draft.active, draft.cron, updateDraft, weeklyCron]);

  const handleScheduleChange = (next: string) => {
    setSchedule(next);
    const preset = scheduleOptions.find((option) => option.id === next);
    if (preset && preset.cron) {
      updateDraft({ cron: preset.cron });
    }
  };

  const configPayload = useMemo(() => {
    return {
      ...(draft.track ? { track: draft.track } : {}),
      ...(draft.subreddits?.length ? { subreddits: draft.subreddits } : {}),
      ...(draft.keywords?.length ? { keywords: draft.keywords } : {}),
      sort: draft.sort ?? 'top',
      timeRange: draft.timeRange ?? 'day',
      limit: typeof draft.limit === 'number' ? draft.limit : 25,
      signals: {
        minUpvotes: draft.signals?.minUpvotes ?? 10,
        minComments: draft.signals?.minComments ?? 5,
        maxAgeDays: draft.signals?.maxAgeDays ?? 7,
      },
    };
  }, [draft]);

  const configText = useMemo(() => JSON.stringify(configPayload, null, 2), [configPayload]);

  const handleCreate = () => {
    setError(null);
    const trimmedName = draft.name?.trim() ?? '';
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (!draft.source) {
      setError('Source is required.');
      return;
    }

    const cronExpr = draft.cron?.trim() || weeklyCron;

    startTransition(async () => {
      const result = await createStrategy({
        name: trimmedName,
        source: draft.source,
        description: draft.description?.trim() || null,
        isActive: draft.active ?? true,
        cronExpr,
        configText,
      });

      if (!result || !result.ok) {
        setError(result?.error || 'Failed to create strategy.');
        return;
      }

      resetDraft();
      router.push('/dashboard/strategies');
      router.refresh();
    });
  };

  return (
    <WizardShell
      title="Create Strategy"
      step={4}
      backHref="/dashboard/strategies/new/step-3"
      disableNext
      rightSlot={<SummaryCard />}
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <label className="text-muted-foreground">Schedule</label>
            <AdminSelect
              value={schedule}
              onChange={(event) => handleScheduleChange(event.target.value)}
            >
              {scheduleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            {schedule === 'manual' && (
              <AdminInput
                value={draft.cron ?? ''}
                onChange={(event) => updateDraft({ cron: event.target.value })}
                placeholder={weeklyCron}
              />
            )}
          </div>
          <div className="text-sm">
            <Checkbox
              checked={draft.active ?? true}
              onChange={(event) => updateDraft({ active: event.target.checked })}
              label="Active"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Config preview
          </label>
          <pre className="max-h-72 overflow-auto rounded-xl border border-border/50 bg-card/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {configText}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create strategy'}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>
    </WizardShell>
  );
}
