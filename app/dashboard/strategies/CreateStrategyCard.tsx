'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
import { STRATEGY_TRACKS } from '@/lib/strategyTracks';

const DEFAULT_CRON = '0 */6 * * *';
const DEFAULT_CONFIG = '{}';
const DEFAULT_SUBREDDITS = [
  'SaaS',
  'Entrepreneur',
  'startups',
  'IndieHackers',
  'productivity',
  'smallbusiness',
];
const DEFAULT_KEYWORDS_TEXT = [
  'How do you... / What tool do you use for...',
  'Is there a tool that... / I wish there was...',
  'X software is terrible / alternative to X',
  "I'm spending hours doing...",
  'We keep messing up...',
].join('\n');
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
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleSubreddits, setSimpleSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);
  const [simpleKeywordsText, setSimpleKeywordsText] = useState(DEFAULT_KEYWORDS_TEXT);
  const [simpleSort, setSimpleSort] = useState<'top' | 'hot' | 'new'>('top');
  const [simpleTimeRange, setSimpleTimeRange] = useState<'day' | 'week' | 'month'>('day');
  const [simpleLimit, setSimpleLimit] = useState<number>(25);
  const [simpleNotes, setSimpleNotes] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [trackId, setTrackId] = useState<string>(
    STRATEGY_TRACKS[0]?.id ?? 'personal_finance',
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const normalizeSubreddit = (value: string) =>
    value.trim().replace(/^r\//i, '').replace(/\s+/g, '');

  const addSubreddit = (value: string) => {
    const normalized = normalizeSubreddit(value);
    if (!normalized) return;
    const exists = simpleSubreddits.some(
      (subreddit) => subreddit.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return;
    setSimpleSubreddits((prev) => [...prev, normalized]);
  };

  const removeSubreddit = (value: string) => {
    const normalized = value.toLowerCase();
    setSimpleSubreddits((prev) =>
      prev.filter((subreddit) => subreddit.toLowerCase() !== normalized),
    );
  };

  const recommendedSubreddits = selectedTrack?.reddit?.subreddits ?? [];
  const selectedSet = new Set(simpleSubreddits.map((subreddit) => subreddit.toLowerCase()));
  const recFilterLower = recFilter.trim().toLowerCase();
  const recommendedList = recommendedSubreddits
    .map((subreddit) => normalizeSubreddit(subreddit))
    .filter(Boolean)
    .filter((subreddit, index, arr) => arr.indexOf(subreddit) === index)
    .sort((a, b) => {
      const aSelected = selectedSet.has(a.toLowerCase());
      const bSelected = selectedSet.has(b.toLowerCase());
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.localeCompare(b);
    })
    .filter((subreddit) =>
      recFilterLower ? subreddit.toLowerCase().includes(recFilterLower) : true,
    );

  const simpleKeywords = simpleKeywordsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const selectedTrack =
    STRATEGY_TRACKS.find((track) => track.id === trackId) ?? STRATEGY_TRACKS[0];

  const simpleConfig = {
    track: trackId,
    subreddits: simpleSubreddits,
    keywords: simpleKeywords,
    sort: simpleSort,
    timeRange: simpleTimeRange,
    limit: simpleLimit,
  };

  const resetForm = () => {
    setName('');
    setSource('reddit');
    setDescription('');
    setIsActive(true);
    setCronExpr(DEFAULT_CRON);
    setConfigText(DEFAULT_CONFIG);
    setSimpleSubreddits(DEFAULT_SUBREDDITS);
    setSimpleKeywordsText(DEFAULT_KEYWORDS_TEXT);
    setSimpleSort('top');
    setSimpleTimeRange('day');
    setSimpleLimit(25);
    setSimpleNotes('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setToast(null);
    setConfigError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    let configPayloadText = configText;
    if (mode === 'advanced') {
      try {
        const trimmedConfig = configText.trim();
        if (trimmedConfig) {
          JSON.parse(trimmedConfig);
        }
      } catch {
        setConfigError('Invalid JSON');
        return;
      }
    } else {
      if (source !== 'reddit') {
        setConfigError('Simple mode currently supports Reddit only. Switch to Advanced for others.');
        return;
      }
      configPayloadText = JSON.stringify(simpleConfig);
    }

    startTransition(async () => {
      const result = await createStrategy({
        name: trimmedName,
        source,
        description,
        isActive,
        cronExpr,
        configText: configPayloadText,
      });

      if (!result || !result.ok) {
        setError(result?.error || 'Failed to create strategy');
        return;
      }

      setConfigError(null);
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'simple' ? 'secondary' : 'ghost'}
                onClick={() => setMode('simple')}
              >
                Simple
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'advanced' ? 'secondary' : 'ghost'}
                onClick={() => setMode('advanced')}
              >
                Advanced
              </Button>
            </div>
            {mode === 'advanced' ? (
              <>
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
              </>
            ) : source === 'reddit' ? (
              <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Track</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminSelect
                      value={trackId}
                      onChange={(event) => setTrackId(event.target.value)}
                    >
                      {STRATEGY_TRACKS.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title_zh} · {track.title}
                        </option>
                      ))}
                    </AdminSelect>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSimpleSubreddits(selectedTrack.reddit.subreddits);
                        setSimpleKeywordsText(selectedTrack.reddit.keywordsText);
                      }}
                    >
                      Use track defaults
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This will replace your current subreddits and keywords.
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Subreddits</label>
                  <div className="text-xs text-muted-foreground">
                    Add and press Enter (without r/)
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/60 p-3">
                    {simpleSubreddits.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No subreddits yet.
                      </span>
                    ) : (
                      simpleSubreddits.map((subreddit) => (
                        <Badge key={subreddit} variant="secondary" className="gap-1 pr-1">
                          <span>{subreddit}</span>
                          <button
                            type="button"
                            onClick={() => removeSubreddit(subreddit)}
                            className="rounded-full px-1 text-[10px] text-muted-foreground hover:text-foreground"
                            aria-label={`Remove ${subreddit}`}
                          >
                            ×
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminInput
                      value={newSubreddit}
                      onChange={(event) => setNewSubreddit(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        addSubreddit(newSubreddit);
                        setNewSubreddit('');
                      }}
                      placeholder="Add subreddit (e.g. startups) and press Enter"
                    />
                    {simpleSubreddits.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSimpleSubreddits([])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Recommended
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Click to toggle. Selected ones are highlighted.
                    </div>
                    <AdminInput
                      value={recFilter}
                      onChange={(event) => setRecFilter(event.target.value)}
                      placeholder="Search recommended…"
                      className="h-8"
                    />
                    <div className="flex flex-wrap gap-2">
                      {recommendedList.map((subreddit) => {
                        const isSelected = simpleSubreddits.some(
                          (item) => item.toLowerCase() === subreddit.toLowerCase(),
                        );
                        return (
                          <Badge
                            key={subreddit}
                            variant={isSelected ? 'secondary' : 'outline'}
                            className="cursor-pointer"
                            onClick={() =>
                              isSelected ? removeSubreddit(subreddit) : addSubreddit(subreddit)
                            }
                          >
                            {subreddit}
                          </Badge>
                        );
                      })}
                      {recommendedList.length === 0 && (
                        <span className="text-xs text-muted-foreground">No matches.</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Keywords / title patterns
                  </label>
                  <div className="text-xs text-muted-foreground">One per line</div>
                  <textarea
                    value={simpleKeywordsText}
                    onChange={(event) => setSimpleKeywordsText(event.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-xs text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Sort</label>
                    <AdminSelect
                      value={simpleSort}
                      onChange={(event) =>
                        setSimpleSort(event.target.value as 'top' | 'hot' | 'new')
                      }
                    >
                      <option value="top">Top</option>
                      <option value="hot">Hot</option>
                      <option value="new">New</option>
                    </AdminSelect>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Time range
                    </label>
                    <AdminSelect
                      value={simpleTimeRange}
                      onChange={(event) =>
                        setSimpleTimeRange(event.target.value as 'day' | 'week' | 'month')
                      }
                      disabled={simpleSort !== 'top'}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                    </AdminSelect>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Limit</label>
                    <AdminInput
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={simpleLimit}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next)) setSimpleLimit(next);
                      }}
                      onBlur={() =>
                        setSimpleLimit((prev) => Math.min(100, Math.max(10, prev || 10)))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Notes</label>
                    <AdminInput
                      value={simpleNotes}
                      onChange={(event) => setSimpleNotes(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Config preview
                  </label>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-border/50 bg-card/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(simpleConfig, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                Simple mode is available for Reddit strategies.
              </div>
            )}
            {configError && <p className="text-sm text-destructive">{configError}</p>}
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
