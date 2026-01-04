'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AdminInput,
  AdminSelect,
  CardBody,
  CardHeading,
  GlassCard,
} from '@/components/admin/primitives';
import { createStrategy } from './actions';

const DEFAULT_CRON = '0 */6 * * *';
const DEFAULT_CONFIG = '{}';
const EXAMPLE_CONFIGS: Record<'reddit' | 'youtube' | 'google_trends', Record<string, unknown>> = {
  reddit: {
    sort: 'top',
    limit: 80,
    subreddits: ['Entrepreneur', 'IndieHackers'],
    keywords: ['pain point', 'workflow', 'tool'],
    minScore: 5,
  },
  youtube: {
    topics: ['ai tools', 'creator workflows'],
    maxVideosPerTopic: 40,
    language: 'en',
    minViews: 1000,
  },
  google_trends: {
    keywords: ['ai code review', 'agentic workflows'],
    geo: 'US',
    timeframe: 'today 12-m',
  },
};

export default function CreateStrategyCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [source, setSource] = useState<'reddit' | 'youtube' | 'google_trends'>('reddit');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [cronExpr, setCronExpr] = useState(DEFAULT_CRON);
  const [configText, setConfigText] = useState(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setSource('reddit');
    setDescription('');
    setIsActive(true);
    setCronExpr(DEFAULT_CRON);
    setConfigText(DEFAULT_CONFIG);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setToast(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    try {
      const trimmedConfig = configText.trim();
      if (trimmedConfig) {
        JSON.parse(trimmedConfig);
      }
    } catch (err) {
        setError(`Config JSON error: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
      return;
    }

    startTransition(async () => {
      const result = await createStrategy({
        name: trimmedName,
        source,
        description,
        isActive,
        cronExpr,
        configText,
      });

      if (!result || !result.ok) {
        setError(result?.error || 'Failed to create strategy');
        return;
      }

      resetForm();
      setToast('Strategy created');
      router.refresh();
    });
  };

  return (
    <GlassCard>
      <CardHeading
        title="Create strategy"
        description="Add a new ingestion strategy using a JSON config."
      />
      <CardBody className="pt-0">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="text-muted-foreground">Name</label>
            <AdminInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. reddit-saas-painpoints"
            />
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-muted-foreground">Source</label>
            <AdminSelect
              value={source}
              onChange={(event) =>
                setSource(event.target.value as 'reddit' | 'youtube' | 'google_trends')
              }
            >
              <option value="reddit">Reddit</option>
              <option value="youtube">YouTube</option>
              <option value="google_trends">Trends</option>
            </AdminSelect>
          </div>
          <div className="space-y-2 text-sm md:col-span-2">
            <label className="text-muted-foreground">Description (optional)</label>
            <AdminInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short note about this strategy"
            />
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-muted-foreground">Cron expression</label>
            <AdminInput
              value={cronExpr}
              onChange={(event) => setCronExpr(event.target.value)}
              placeholder={DEFAULT_CRON}
            />
          </div>
          <div className="space-y-2 text-sm md:flex md:items-end">
            <Checkbox
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              label="Active"
            />
          </div>
          <div className="space-y-2 text-sm md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-muted-foreground">Config (JSON)</label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setConfigText(JSON.stringify(EXAMPLE_CONFIGS[source], null, 2))
                }
              >
                Use example config
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Tip: click "Use example config" to fill a working config.
            </div>
            <textarea
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 font-mono text-xs text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create strategy'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {toast && <span className="text-sm text-emerald-400">{toast}</span>}
          </div>
        </form>
      </CardBody>
    </GlassCard>
  );
}
