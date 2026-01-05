'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AdminInput,
  AdminSelect,
  CardBody,
  CardHeading,
  GlassCard,
} from '@/components/admin/primitives';
import { createStrategy, updateStrategy } from './actions';
import { STRATEGY_TRACKS } from '@/lib/strategyTracks';

const DEFAULT_CRON = '0 0 * * 0';
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

const SCHEDULE_OPTIONS = [
  { id: 'weekly', label: 'Weekly', cron: '0 0 * * 0' },
  { id: 'daily', label: 'Daily', cron: '0 0 * * *' },
  { id: 'every_6_hours', label: 'Every 6 hours', cron: '0 */6 * * *' },
  { id: 'every_hour', label: 'Every hour', cron: '0 * * * *' },
  { id: 'monthly', label: 'Monthly', cron: '0 0 1 * *' },
  { id: 'custom', label: 'Custom', cron: '' },
];

const SOURCE_OPTIONS = ['reddit', 'youtube', 'google_trends'] as const;
type StrategySource = (typeof SOURCE_OPTIONS)[number];

type StrategyFormMode = 'create' | 'edit';

type StrategyFormDefaults = {
  id: string;
  name: string;
  source: string | null;
  description: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  config: Record<string, unknown> | null;
};

type CreateStrategyCardProps = {
  mode?: StrategyFormMode;
  initialStrategy?: StrategyFormDefaults | null;
};

function normalizeSubredditInput(value: string) {
  return value.trim().replace(/^r\//i, '').replace(/\s+/g, '');
}

function normalizeKeywordInput(value: string) {
  return value.trim();
}

function resolveSource(value: string | null | undefined): StrategySource {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'trends') return 'google_trends';
  if (normalized && SOURCE_OPTIONS.includes(normalized as StrategySource)) {
    return normalized as StrategySource;
  }
  return 'reddit';
}

function coerceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function coerceStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function coerceNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveSchedule(cronExpr: string) {
  const match = SCHEDULE_OPTIONS.find((option) => option.cron === cronExpr);
  return match?.id ?? 'custom';
}

export default function CreateStrategyCard({
  mode: formMode = 'create',
  initialStrategy = null,
}: CreateStrategyCardProps) {
  const router = useRouter();
  const isEdit = formMode === 'edit';
  const initialConfig = coerceRecord(initialStrategy?.config);
  const initialSource = resolveSource(initialStrategy?.source);
  const initialCron = initialStrategy?.cron_expr?.trim() || DEFAULT_CRON;
  const initialSchedule = resolveSchedule(initialCron);
  const initialTrack =
    typeof initialConfig.track === 'string' && initialConfig.track.trim()
      ? initialConfig.track.trim()
      : STRATEGY_TRACKS[0]?.title ?? 'Personal Finance';
  const initialSubreddits = coerceStringArray(
    initialConfig.subreddits,
    DEFAULT_SUBREDDITS,
  )
    .map((subreddit) => normalizeSubredditInput(subreddit))
    .filter(Boolean);
  const initialKeywords = coerceStringArray(
    initialConfig.keywords,
    DEFAULT_KEYWORDS_TEXT.split('\n').map((line) => line.trim()).filter(Boolean),
  )
    .map((keyword) => normalizeKeywordInput(keyword))
    .filter(Boolean);
  const initialSort = ['top', 'hot', 'new'].includes(String(initialConfig.sort))
    ? (initialConfig.sort as 'top' | 'hot' | 'new')
    : 'top';
  const initialTimeRange = ['day', 'week', 'month'].includes(
    String(initialConfig.timeRange),
  )
    ? (initialConfig.timeRange as 'day' | 'week' | 'month')
    : 'day';
  const initialLimit = clampNumber(
    coerceNumber(initialConfig.limit, 25),
    10,
    100,
  );
  const initialSignals = coerceRecord(initialConfig.signals);
  const initialMinUpvotes = clampNumber(
    coerceNumber(initialSignals.minUpvotes, 10),
    0,
    5000,
  );
  const initialMinComments = clampNumber(
    coerceNumber(initialSignals.minComments, 5),
    0,
    5000,
  );
  const initialMaxAgeDays = clampNumber(
    coerceNumber(initialSignals.maxAgeDays, 7),
    1,
    30,
  );
  const initialConfigText = isEdit
    ? JSON.stringify(initialConfig, null, 2)
    : DEFAULT_CONFIG;
  const initialMode = isEdit ? (initialSource === 'reddit' ? 'simple' : 'advanced') : 'simple';
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialStrategy?.name ?? '');
  const [source, setSource] = useState<StrategySource>(initialSource);
  const [description, setDescription] = useState(initialStrategy?.description ?? '');
  const [isActive, setIsActive] = useState(initialStrategy?.is_active ?? true);
  const [cronExpr, setCronExpr] = useState(initialCron);
  const [schedule, setSchedule] = useState<string>(initialSchedule);
  const [configText, setConfigText] = useState(initialConfigText);
  const [mode, setMode] = useState<'simple' | 'advanced'>(initialMode);
  const [simpleSubreddits, setSimpleSubreddits] = useState<string[]>(
    initialSubreddits,
  );
  const [simpleKeywords, setSimpleKeywords] = useState<string[]>(initialKeywords);
  const [simpleSort, setSimpleSort] = useState<'top' | 'hot' | 'new'>(initialSort);
  const [simpleTimeRange, setSimpleTimeRange] = useState<'day' | 'week' | 'month'>(
    initialTimeRange,
  );
  const [simpleLimit, setSimpleLimit] = useState<number>(initialLimit);
  const [minUpvotes, setMinUpvotes] = useState<number>(initialMinUpvotes);
  const [minComments, setMinComments] = useState<number>(initialMinComments);
  const [maxAgeDays, setMaxAgeDays] = useState<number>(initialMaxAgeDays);
  const [simpleNotes, setSimpleNotes] = useState('');
  const [newSubreddit, setNewSubreddit] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [trackId, setTrackId] = useState<string>(initialTrack);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const normalizeSubreddit = normalizeSubredditInput;

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

  const normalizeKeyword = normalizeKeywordInput;

  const mergeUnique = (current: string[], incoming: string[], keyFn: (value: string) => string) => {
    const seen = new Set(current.map((value) => keyFn(value).toLowerCase()));
    const result = [...current];
    for (const value of incoming) {
      const key = keyFn(value).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  };

  const selectedTrack = STRATEGY_TRACKS.find(
    (track) =>
      track.id.toLowerCase() === trackId.toLowerCase() ||
      track.title.toLowerCase() === trackId.toLowerCase(),
  );
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

  const normalizedSimpleKeywords = simpleKeywords
    .map((line) => line.trim())
    .filter(Boolean);

  const coreKeywordTemplates = DEFAULT_KEYWORDS_TEXT.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const coreKeywordSet = new Set(coreKeywordTemplates.map((line) => line.toLowerCase()));
  const trackKeywordTemplates = (selectedTrack?.reddit?.keywordsText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !coreKeywordSet.has(line.toLowerCase()));

  const trackDefaultSubreddits = (selectedTrack?.reddit?.subreddits ?? [])
    .map((subreddit) => normalizeSubreddit(subreddit))
    .filter(Boolean);
  const trackDefaultKeywords = (selectedTrack?.reddit?.keywordsText ?? '')
    .split('\n')
    .map((line) => normalizeKeyword(line))
    .filter(Boolean);

  const simpleConfig = {
    track: trackId,
    subreddits: simpleSubreddits,
    keywords: normalizedSimpleKeywords,
    sort: simpleSort,
    timeRange: simpleTimeRange,
    limit: simpleLimit,
    signals: {
      minUpvotes,
      minComments,
      maxAgeDays,
    },
  };
  const previewJson = JSON.stringify(simpleConfig, null, 2);
  const headingTitle = isEdit ? 'Edit strategy' : 'Create strategy';
  const headingDescription = isEdit
    ? 'Update your strategy details and schedule.'
    : 'Add a new ingestion strategy using a JSON config.';

  const resetForm = () => {
    setName('');
    setSource('reddit');
    setDescription('');
    setIsActive(true);
    setCronExpr(DEFAULT_CRON);
    setSchedule('weekly');
    setConfigText(DEFAULT_CONFIG);
    setSimpleSubreddits(DEFAULT_SUBREDDITS);
    setSimpleKeywords(
      DEFAULT_KEYWORDS_TEXT.split('\n').map((line) => line.trim()).filter(Boolean),
    );
    setSimpleSort('top');
    setSimpleTimeRange('day');
    setSimpleLimit(25);
    setMinUpvotes(10);
    setMinComments(5);
    setMaxAgeDays(7);
    setSimpleNotes('');
    setNewSubreddit('');
    setNewKeyword('');
    setRecFilter('');
    setTrackId(STRATEGY_TRACKS[0]?.title ?? 'Personal Finance');
    setPreviewOpen(false);
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
    if (isEdit && !initialStrategy?.id) {
      setError('Strategy ID is missing');
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
      const result = isEdit
        ? await updateStrategy(initialStrategy?.id ?? '', {
            name: trimmedName,
            source,
            description,
            isActive,
            cronExpr,
            configText: configPayloadText,
          })
        : await createStrategy({
            name: trimmedName,
            source,
            description,
            isActive,
            cronExpr,
            configText: configPayloadText,
          });

      if (!result || !result.ok) {
        setError(
          result?.error || (isEdit ? 'Failed to update strategy' : 'Failed to create strategy'),
        );
        return;
      }

      setConfigError(null);
      if (isEdit) {
        router.push('/dashboard/strategies?toast=updated');
        return;
      }

      resetForm();
      setToast('Strategy created');
      router.refresh();
    });
  };

  return (
    <GlassCard>
      <CardHeading title={headingTitle} description={headingDescription} />
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
          <div className="grid gap-4 md:col-span-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Schedule</label>
              <AdminSelect
                value={schedule}
                onChange={(event) => {
                  const next = event.target.value;
                  setSchedule(next);
                  const preset = SCHEDULE_OPTIONS.find((option) => option.id === next);
                  if (preset && preset.cron) {
                    setCronExpr(preset.cron);
                  }
                }}
              >
                {SCHEDULE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              {schedule === 'custom' && (
                <AdminInput
                  value={cronExpr}
                  onChange={(event) => setCronExpr(event.target.value)}
                  placeholder="0 0 * * 0"
                />
              )}
            </div>
            <div className="text-sm">
              <Checkbox
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                label="Active"
              />
            </div>
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
                    <AdminInput
                      value={trackId}
                      onChange={(event) => setTrackId(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        setTrackId(event.currentTarget.value);
                      }}
                      placeholder="Enter or choose a track"
                      list="strategy-track-options"
                      className="min-w-[220px] flex-1"
                    />
                    <datalist id="strategy-track-options">
                      {STRATEGY_TRACKS.map((track) => (
                        <option key={track.id} value={track.title} />
                      ))}
                    </datalist>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSimpleSubreddits(trackDefaultSubreddits);
                        setSimpleKeywords(trackDefaultKeywords);
                      }}
                      disabled={!selectedTrack}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSimpleSubreddits((prev) =>
                          mergeUnique(prev, trackDefaultSubreddits, normalizeSubreddit),
                        );
                        setSimpleKeywords((prev) =>
                          mergeUnique(prev, trackDefaultKeywords, normalizeKeyword),
                        );
                      }}
                      disabled={!selectedTrack}
                    >
                      Append
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Type to search or enter your own track.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Replace overwrites your edits. Append keeps your edits and adds track templates.
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
                  <div className="text-xs text-muted-foreground">
                    Click templates or add your own patterns.
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/60 p-3">
                    {normalizedSimpleKeywords.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No keywords yet.
                      </span>
                    ) : (
                      normalizedSimpleKeywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                          <span>{keyword}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSimpleKeywords((prev) =>
                                prev.filter(
                                  (item) => item.toLowerCase() !== keyword.toLowerCase(),
                                ),
                              )
                            }
                            className="rounded-full px-1 text-[10px] text-muted-foreground hover:text-foreground"
                            aria-label={`Remove ${keyword}`}
                          >
                            ×
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminInput
                      value={newKeyword}
                      onChange={(event) => setNewKeyword(event.target.value)}
                      placeholder="Add keyword pattern and press Enter"
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        const trimmed = newKeyword.trim();
                        if (!trimmed) return;
                        const exists = normalizedSimpleKeywords.some(
                          (item) => item.toLowerCase() === trimmed.toLowerCase(),
                        );
                        if (!exists) {
                          setSimpleKeywords((prev) => [...prev, trimmed]);
                        }
                        setNewKeyword('');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Templates</div>
                    <div className="flex flex-wrap gap-2">
                      {coreKeywordTemplates.map((template) => {
                        const isSelected = normalizedSimpleKeywords.some(
                          (item) => item.toLowerCase() === template.toLowerCase(),
                        );
                        return (
                          <Badge
                            key={template}
                            variant={isSelected ? 'secondary' : 'outline'}
                            className="cursor-pointer"
                            onClick={() =>
                              isSelected
                                ? setSimpleKeywords((prev) =>
                                    prev.filter(
                                      (item) => item.toLowerCase() !== template.toLowerCase(),
                                    ),
                                  )
                                : setSimpleKeywords((prev) => [...prev, template])
                            }
                          >
                            {template}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Track templates
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trackKeywordTemplates.map((template) => {
                        const isSelected = normalizedSimpleKeywords.some(
                          (item) => item.toLowerCase() === template.toLowerCase(),
                        );
                        return (
                          <Badge
                            key={template}
                            variant={isSelected ? 'secondary' : 'outline'}
                            className="cursor-pointer"
                            onClick={() =>
                              isSelected
                                ? setSimpleKeywords((prev) =>
                                    prev.filter(
                                      (item) => item.toLowerCase() !== template.toLowerCase(),
                                    ),
                                  )
                                : setSimpleKeywords((prev) => [...prev, template])
                            }
                          >
                            {template}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
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
                  <div className="text-xs font-semibold text-muted-foreground">
                    Signals (quality filters)
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Min upvotes</label>
                      <AdminInput
                        type="number"
                        min={0}
                        max={5000}
                        value={minUpvotes}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) setMinUpvotes(next);
                        }}
                        onBlur={() =>
                          setMinUpvotes((prev) => Math.min(5000, Math.max(0, prev || 0)))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Min comments</label>
                      <AdminInput
                        type="number"
                        min={0}
                        max={5000}
                        value={minComments}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) setMinComments(next);
                        }}
                        onBlur={() =>
                          setMinComments((prev) => Math.min(5000, Math.max(0, prev || 0)))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Recency (days)</label>
                      <AdminInput
                        type="number"
                        min={1}
                        max={30}
                        value={maxAgeDays}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) setMaxAgeDays(next);
                        }}
                        onBlur={() =>
                          setMaxAgeDays((prev) => Math.min(30, Math.max(1, prev || 1)))
                        }
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    These filters reduce noise and focus on high-signal pain points.
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Config preview
                    </span>
                    <div className="flex items-center gap-2">
                      <CopyButton text={previewJson} label="Copy JSON" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewOpen((prev) => !prev)}
                      >
                        {previewOpen ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>
                  {previewOpen && (
                    <pre className="max-h-64 overflow-auto rounded-xl border border-border/50 bg-card/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {previewJson}
                    </pre>
                  )}
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
              {isPending
                ? isEdit
                  ? 'Saving...'
                  : 'Creating...'
                : isEdit
                  ? 'Save changes'
                  : 'Create strategy'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {toast && <span className="text-sm text-emerald-400">{toast}</span>}
          </div>
        </form>
      </CardBody>
    </GlassCard>
  );
}
