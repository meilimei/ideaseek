'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import type { IngestStrategy } from '@/lib/server/adminStrategies';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, GlassCard, CardBody, CardHeading } from '@/components/admin/primitives';
import {
  createStrategyAction,
  toggleStrategyActiveAction,
  updateStrategyAction,
} from './actions';

type StrategiesClientProps = {
  strategies: IngestStrategy[];
};

const SOURCE_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  youtube: 'YouTube',
  google_trends: 'Google Trends',
};

const SUBREDDIT_SUGGESTIONS = [
  {
    group: 'Indie SaaS',
    items: [
      'SaaS',
      'startups',
      'Entrepreneur',
      'IndieHackers',
      'SideProject',
      'smallbusiness',
    ],
  },
  {
    group: 'AI Builders',
    items: [
      'OpenAI',
      'ChatGPT',
      'MachineLearning',
      'LocalLLaMA',
      'artificial',
      'singularity',
    ],
  },
  {
    group: 'Dev Tools',
    items: ['webdev', 'programming', 'javascript', 'reactjs', 'nextjs', 'devops'],
  },
  {
    group: 'Marketing',
    items: ['marketing', 'SEO', 'socialmedia', 'growthhacking', 'content_marketing'],
  },
  {
    group: 'Ecommerce',
    items: ['ecommerce', 'shopify', 'amazonFBA', 'Etsy'],
  },
];

const POPULAR_SUBREDDITS = ['SaaS', 'startups', 'Entrepreneur', 'IndieHackers', 'webdev', 'marketing'];

const SCHEDULE_OPTIONS = [
  { label: 'Every 1 hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily', value: '0 0 * * *' },
  { label: 'Weekly', value: '0 0 * * 1' },
];

type StrategyMode = 'basic' | 'advanced';
type StrategySource = 'reddit' | 'youtube' | 'google_trends';
type SubredditSearchItem = {
  name: string;
  title?: string;
  subscribers?: number;
  over18?: boolean;
};

const inputClass =
  'w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';
const textareaClass = `${inputClass} rounded-2xl`;

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeSubredditName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.toLowerCase().startsWith('r/')
    ? trimmed.slice(2)
    : trimmed;
  return withoutPrefix.replace(/^\/+|\/+$/g, '').trim();
}

function parseSubredditInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of value.split('\n')) {
    const normalized = normalizeSubredditName(line);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function formatSubredditInput(value: string[]): string {
  return value.join('\n');
}

function formatSubscriberCount(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toLocaleString();
}

type BasicFormState = {
  redditSubreddits: string[];
  redditSort: 'top' | 'hot' | 'new';
  redditTimeWindow: 'day' | 'week' | 'month';
  redditLimit: number;
  redditMinScore: number;
  redditKeywords: string[];
  youtubeTopics: string[];
  youtubeVideosPerTopic: number;
  youtubeKeywords: string[];
  trendsGeo: string;
  trendsCategory: string;
  trendsKeywords: string[];
};

function buildConfig(source: StrategySource, state: BasicFormState) {
  if (source === 'reddit') {
    const config: Record<string, unknown> = {
      subreddits: state.redditSubreddits,
      sort: state.redditSort,
      time_window: state.redditTimeWindow,
      limit: state.redditLimit,
      minScore: state.redditMinScore,
    };
    if (state.redditKeywords.length > 0) {
      config.keywords = state.redditKeywords;
    }
    return config;
  }

  if (source === 'youtube') {
    const config: Record<string, unknown> = {
      queries: state.youtubeTopics,
      videosPerTopic: state.youtubeVideosPerTopic,
    };
    if (state.youtubeKeywords.length > 0) {
      config.keywords = state.youtubeKeywords;
    }
    return config;
  }

  const config: Record<string, unknown> = {
    keywords: state.trendsKeywords,
    geo: state.trendsGeo.trim() || 'US',
  };
  const category = state.trendsCategory.trim();
  if (category) {
    const parsed = Number(category);
    if (!Number.isNaN(parsed)) {
      config.category = parsed;
    }
  }
  return config;
}

function exampleConfig(source: string): string {
  switch (source) {
    case 'reddit':
      return JSON.stringify(
        { subreddits: ['Entrepreneur'], minScore: 5, keywords: ['idea'] },
        null,
        2,
      );
    case 'youtube':
      return JSON.stringify(
        { queries: ['ai tools'], regionCode: 'US', minViews: 1000 },
        null,
        2,
      );
    case 'google_trends':
      return JSON.stringify(
        { keywords: ['ai tools'], geo: 'US', timeframe: 'today 12-m' },
        null,
        2,
      );
    default:
      return '{}';
  }
}

function formatDate(value: string | Date | null): string {
  if (!value) return 'Never';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function StrategyRow({ strategy }: { strategy: IngestStrategy }) {
  const [editOpen, setEditOpen] = useState(false);
  const initial = { error: undefined, success: false };
  const [updateState, updateAction] = useActionState(
    updateStrategyAction.bind(null, strategy.id),
    initial,
  );
  const [toggleState, toggleAction] = useActionState(
    toggleStrategyActiveAction.bind(null, strategy.id),
    initial,
  );
  const router = useRouter();
  const [runState, setRunState] = useState<{
    loading: boolean;
    error: string | null;
    jobId: string | null;
  }>({ loading: false, error: null, jobId: null });

  const runStrategyOnce = async () => {
    setRunState({ loading: true, error: null, jobId: null });
    try {
      const res = await fetch(`/api/admin/strategies/${strategy.id}/run`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create job');
      }
      setRunState({ loading: false, error: null, jobId: json.jobId ?? null });
      if (json.jobId) {
        router.prefetch(`/admin/jobs/${json.jobId}`);
      }
    } catch (err) {
      setRunState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        jobId: null,
      });
    }
  };

  return (
    <tr className="align-top transition hover:bg-secondary/8">
      <td className="px-3 py-3">
        <div className="font-semibold text-foreground">{strategy.name}</div>
        <div className="text-xs text-muted-foreground">
          {strategy.description || '—'}
        </div>
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {SOURCE_LABELS[strategy.source] ?? strategy.source}
      </td>
      <td className="px-3 py-3 align-top">
        <Badge
          className={
            strategy.is_active
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
              : 'bg-secondary/40 text-muted-foreground border-border/60'
          }
        >
          {strategy.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {strategy.cron_expr || '—'}
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {formatDate(strategy.last_run_at)}
      </td>
      <td className="px-3 py-3 align-top text-sm">
        <span
          className={
            strategy.last_run_status === 'error'
              ? 'text-destructive'
              : 'text-foreground'
          }
        >
          {strategy.last_run_status || '—'}
        </span>
        {strategy.last_error && (
          <div className="text-xs text-destructive">{strategy.last_error}</div>
        )}
      </td>
      <td className="px-3 py-3 align-top space-y-2 text-right">
        <form action={toggleAction} className="inline">
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="rounded-full px-3"
          >
            {strategy.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </form>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full px-3 text-primary"
          onClick={() => setEditOpen((v) => !v)}
        >
          {editOpen ? 'Close' : 'Edit'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full px-3"
          onClick={runStrategyOnce}
          disabled={runState.loading}
        >
          {runState.loading ? 'Queuing…' : 'Run now'}
        </Button>
        {runState.error && (
          <div className="text-xs text-destructive">{runState.error}</div>
        )}
        {runState.jobId && (
          <div className="text-xs text-muted-foreground">
            Job queued:{' '}
            <Link
              href={`/admin/jobs/${runState.jobId}`}
              className="text-primary hover:underline"
            >
              View job
            </Link>{' '}
            or{' '}
            <Link href="/admin/jobs" className="text-primary hover:underline">
              go to jobs
            </Link>
          </div>
        )}
        {toggleState.error && (
          <div className="text-xs text-destructive">{toggleState.error}</div>
        )}
        {editOpen && (
          <div className="mt-2 rounded-2xl border border-border/50 bg-card/70 p-4 text-left shadow-soft">
            <form action={updateAction} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={strategy.name}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Source
                </label>
                <select
                  name="source"
                  defaultValue={strategy.source}
                  className={inputClass}
                  required
                >
                  <option value="reddit">Reddit</option>
                  <option value="youtube">YouTube</option>
                  <option value="google_trends">Google Trends</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={strategy.description ?? ''}
                  className={textareaClass}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id={`is_active_${strategy.id}`}
                  type="checkbox"
                  name="is_active"
                  defaultChecked={strategy.is_active}
                />
                <label
                  htmlFor={`is_active_${strategy.id}`}
                  className="text-sm text-foreground/80"
                >
                  Active
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cron expression
                </label>
                <input
                  name="cron_expr"
                  defaultValue={strategy.cron_expr ?? ''}
                  className={inputClass}
                  placeholder="e.g. */10 * * * *"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Config (JSON)
                </label>
                <textarea
                  name="config"
                  defaultValue={JSON.stringify(strategy.config ?? {}, null, 2)}
                  className={`${textareaClass} font-mono text-xs`}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Example:{' '}
                  <code className="rounded bg-secondary/30 px-1 py-0.5">
                    {exampleConfig(strategy.source)}
                  </code>
                </p>
              </div>
              {updateState.error && (
                <div className="text-xs text-destructive">{updateState.error}</div>
              )}
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function StrategiesClient({ strategies }: StrategiesClientProps) {
  const initial = { error: undefined, success: false };
  const [createState, createAction] = useActionState(createStrategyAction, initial);
  const [mode, setMode] = useState<StrategyMode>('basic');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSource, setNewSource] = useState<StrategySource>('reddit');
  const [newIsActive, setNewIsActive] = useState(true);
  const [cronExpr, setCronExpr] = useState(SCHEDULE_OPTIONS[0].value);
  const [configText, setConfigText] = useState(exampleConfig('reddit'));
  const [configTouched, setConfigTouched] = useState(false);

  const [redditSubreddits, setRedditSubreddits] = useState('');
  const [redditSort, setRedditSort] = useState<'top' | 'hot' | 'new'>('top');
  const [redditTimeWindow, setRedditTimeWindow] = useState<'day' | 'week' | 'month'>(
    'day',
  );
  const [redditLimit, setRedditLimit] = useState(25);
  const [redditMinScore, setRedditMinScore] = useState(5);
  const [redditKeywords, setRedditKeywords] = useState('');
  const [subredditQuery, setSubredditQuery] = useState('');
  const [subredditResults, setSubredditResults] = useState<SubredditSearchItem[]>(
    [],
  );
  const [subredditLoading, setSubredditLoading] = useState(false);
  const [subredditSearchError, setSubredditSearchError] = useState<string | null>(
    null,
  );

  const [youtubeTopics, setYoutubeTopics] = useState('');
  const [youtubeVideosPerTopic, setYoutubeVideosPerTopic] = useState(10);
  const [youtubeKeywords, setYoutubeKeywords] = useState('');

  const [trendsGeo, setTrendsGeo] = useState('US');
  const [trendsCategory, setTrendsCategory] = useState('');
  const [trendsKeywords, setTrendsKeywords] = useState('');

  const redditSubredditList = useMemo(
    () => parseSubredditInput(redditSubreddits),
    [redditSubreddits],
  );
  const redditKeywordList = useMemo(() => splitLines(redditKeywords), [redditKeywords]);
  const youtubeTopicList = useMemo(() => splitLines(youtubeTopics), [youtubeTopics]);
  const youtubeKeywordList = useMemo(() => splitLines(youtubeKeywords), [youtubeKeywords]);
  const trendsKeywordList = useMemo(() => splitLines(trendsKeywords), [trendsKeywords]);

  const selectedSubredditSet = useMemo(() => {
    return new Set(redditSubredditList.map((item) => item.toLowerCase()));
  }, [redditSubredditList]);

  const subredditGroups = useMemo(() => {
    return SUBREDDIT_SUGGESTIONS;
  }, []);

  const popularSubreddits = useMemo(() => {
    if (subredditQuery.trim().length >= 2) return [];
    return POPULAR_SUBREDDITS.filter(
      (item) => !selectedSubredditSet.has(item.toLowerCase()),
    );
  }, [subredditQuery, selectedSubredditSet]);

  useEffect(() => {
    const query = subredditQuery.trim();
    if (query.length < 2) {
      setSubredditResults([]);
      setSubredditLoading(false);
      setSubredditSearchError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    const timeout = setTimeout(async () => {
      setSubredditLoading(true);
      setSubredditSearchError(null);
      try {
        const res = await fetch(
          `/api/admin/reddit/subreddits?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'reddit_search_failed');
        }
        const items = Array.isArray(json?.items) ? json.items : [];
        if (!isActive) return;
        setSubredditResults(items);
        setSubredditSearchError(json?.error ?? null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (!isActive) return;
        setSubredditResults([]);
        setSubredditSearchError('reddit_search_failed');
      } finally {
        if (isActive) {
          setSubredditLoading(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [subredditQuery]);

  const basicConfig = useMemo(
    () =>
      buildConfig(newSource, {
        redditSubreddits: redditSubredditList,
        redditSort,
        redditTimeWindow,
        redditLimit,
        redditMinScore,
        redditKeywords: redditKeywordList,
        youtubeTopics: youtubeTopicList,
        youtubeVideosPerTopic,
        youtubeKeywords: youtubeKeywordList,
        trendsGeo,
        trendsCategory,
        trendsKeywords: trendsKeywordList,
      }),
    [
      newSource,
      redditSubredditList,
      redditSort,
      redditTimeWindow,
      redditLimit,
      redditMinScore,
      redditKeywordList,
      youtubeTopicList,
      youtubeVideosPerTopic,
      youtubeKeywordList,
      trendsGeo,
      trendsCategory,
      trendsKeywordList,
    ],
  );

  const basicConfigText = useMemo(
    () => JSON.stringify(basicConfig, null, 2),
    [basicConfig],
  );

  useEffect(() => {
    if (mode !== 'basic') return;
    if (!SCHEDULE_OPTIONS.some((option) => option.value === cronExpr)) {
      setCronExpr(SCHEDULE_OPTIONS[0].value);
    }
  }, [mode, cronExpr]);

  useEffect(() => {
    if (mode !== 'advanced' || configTouched) return;
    setConfigText(basicConfigText);
  }, [mode, configTouched, basicConfigText]);

  const nameError = newName.trim() ? null : 'Name is required';
  const scheduleError = cronExpr.trim() ? null : 'Schedule is required';
  const requiredListError =
    newSource === 'reddit'
      ? redditSubredditList.length > 0
        ? null
        : 'Add at least one subreddit.'
      : newSource === 'youtube'
        ? youtubeTopicList.length > 0
          ? null
          : 'Add at least one topic.'
        : trendsKeywordList.length > 0
          ? null
          : 'Add at least one keyword.';

  const configJsonError = useMemo(() => {
    if (mode !== 'advanced') return null;
    if (!configText.trim()) return null;
    try {
      JSON.parse(configText);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid JSON';
    }
  }, [mode, configText]);

  const isBasicValid = !nameError && !scheduleError && !requiredListError;
  const isAdvancedValid = !nameError && !scheduleError && !configJsonError;
  const createDisabled = mode === 'basic' ? !isBasicValid : !isAdvancedValid;

  const handleAddSubreddit = (value: string) => {
    const normalized = normalizeSubredditName(value);
    if (!normalized) return;
    setRedditSubreddits((prev) => {
      const list = parseSubredditInput(prev);
      const exists = list.some((item) => item.toLowerCase() === normalized.toLowerCase());
      if (!exists) list.push(normalized);
      return formatSubredditInput(list);
    });
  };

  const handleRemoveSubreddit = (value: string) => {
    const normalized = normalizeSubredditName(value);
    if (!normalized) return;
    setRedditSubreddits((prev) => {
      const list = parseSubredditInput(prev).filter(
        (item) => item.toLowerCase() !== normalized.toLowerCase(),
      );
      return formatSubredditInput(list);
    });
  };

  const sorted = useMemo(
    () => [...strategies].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [strategies],
  );

  return (
    <div className="space-y-6">
      <GlassCard>
        <CardHeading
          title="New strategy"
          description="Add a new ingestion strategy. Basic mode builds the config for you."
        />
        <CardBody className="pt-0">
          <form action={createAction} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
              <div className="inline-flex rounded-full border border-border/60 bg-secondary/30 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('basic')}
                  className={
                    mode === 'basic'
                      ? 'rounded-full bg-background px-3 py-1 text-foreground shadow-soft'
                      : 'rounded-full px-3 py-1 text-muted-foreground hover:text-foreground'
                  }
                >
                  Basic
                </button>
                <button
                  type="button"
                  onClick={() => setMode('advanced')}
                  className={
                    mode === 'advanced'
                      ? 'rounded-full bg-background px-3 py-1 text-foreground shadow-soft'
                      : 'rounded-full px-3 py-1 text-muted-foreground hover:text-foreground'
                  }
                >
                  Advanced (JSON)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <input
                name="name"
                className={inputClass}
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. r/Entrepreneur scraping"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Source</label>
              <select
                name="source"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as StrategySource)}
                className={inputClass}
                required
              >
                <option value="reddit">Reddit</option>
                <option value="youtube">YouTube</option>
                <option value="google_trends">Google Trends</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                className={textareaClass}
                rows={2}
                placeholder="Optional description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                id="new_is_active"
                type="checkbox"
                name="is_active"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
              />
              <label htmlFor="new_is_active" className="text-sm text-foreground/80">
                Active
              </label>
            </div>

            {mode === 'basic' ? (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Schedule
                </label>
                <select
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  className={inputClass}
                  required
                >
                  {SCHEDULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="cron_expr" value={cronExpr} />
                <p className="text-xs text-muted-foreground">
                  Cron preview:{' '}
                  <code className="rounded bg-secondary/30 px-1 py-0.5">
                    {cronExpr || '—'}
                  </code>
                </p>
                {scheduleError && (
                  <p className="text-xs text-destructive">{scheduleError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cron expression
                </label>
                <input
                  name="cron_expr"
                  className={inputClass}
                  placeholder="e.g. */10 * * * *"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                />
                {scheduleError && (
                  <p className="text-xs text-destructive">{scheduleError}</p>
                )}
              </div>
            )}

            {mode === 'basic' && newSource === 'reddit' && (
              <div className="space-y-4 md:col-span-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Search subreddits
                  </label>
                  <input
                    value={subredditQuery}
                    onChange={(e) => setSubredditQuery(e.target.value)}
                    className={inputClass}
                    placeholder="Search subreddits..."
                  />
                </div>
                {subredditQuery.trim().length >= 2 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Search results</span>
                      {subredditLoading && (
                        <span className="text-[11px] text-muted-foreground">
                          Searching...
                        </span>
                      )}
                    </div>
                    {subredditResults.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {subredditResults.map((item) => {
                          const subscriberLabel = formatSubscriberCount(item.subscribers);
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => handleAddSubreddit(item.name)}
                              className={badgeVariants({
                                variant: 'outline',
                                className: 'flex items-center gap-2',
                              })}
                              aria-label={`Add ${item.name}`}
                            >
                              <span className="font-medium">{item.name}</span>
                              {item.title && (
                                <span className="text-[10px] text-muted-foreground">
                                  {item.title}
                                </span>
                              )}
                              {subscriberLabel && (
                                <span className="text-[10px] text-muted-foreground">
                                  {subscriberLabel} subs
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!subredditLoading && subredditResults.length === 0 && (
                      <div className="text-xs text-muted-foreground">
                        No matches found.
                      </div>
                    )}
                    {subredditSearchError && (
                      <div className="text-xs text-muted-foreground">
                        Search unavailable (Reddit blocked). Try suggestions or manual input.
                      </div>
                    )}
                  </div>
                )}
                {subredditQuery.trim().length < 2 && popularSubreddits.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Popular
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {popularSubreddits.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleAddSubreddit(item)}
                          className={badgeVariants({ variant: 'outline' })}
                          aria-label={`Add ${item}`}
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {subredditQuery.trim().length < 2 && subredditGroups.length > 0 && (
                  <div className="space-y-3">
                    {subredditGroups.map((group) => (
                      <div key={group.group} className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">
                          {group.group}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item) => {
                            const isSelected = selectedSubredditSet.has(item.toLowerCase());
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => handleAddSubreddit(item)}
                                disabled={isSelected}
                                className={badgeVariants({
                                  variant: isSelected ? 'secondary' : 'outline',
                                  className: isSelected
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer',
                                })}
                                aria-label={`Add ${item}`}
                              >
                                {isSelected ? item : `+ ${item}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Selected
                  </div>
                  {redditSubredditList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {redditSubredditList.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleRemoveSubreddit(item)}
                          className={badgeVariants({
                            variant: 'secondary',
                            className: 'cursor-pointer',
                          })}
                          aria-label={`Remove ${item}`}
                        >
                          {item} <span className="text-[10px] text-muted-foreground">x</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No subreddits selected.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Subreddits (one per line)
                  </label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    placeholder="Entrepreneur\nIndieHackers\nSaaS"
                    value={redditSubreddits}
                    onChange={(e) => setRedditSubreddits(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: paste one subreddit per line. Click suggestions to add quickly.
                  </p>
                  {requiredListError && (
                    <p className="text-xs text-destructive">{requiredListError}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Sort
                    </label>
                    <select
                      value={redditSort}
                      onChange={(e) =>
                        setRedditSort(e.target.value as 'top' | 'hot' | 'new')
                      }
                      className={inputClass}
                    >
                      <option value="top">Top</option>
                      <option value="hot">Hot</option>
                      <option value="new">New</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Time window
                    </label>
                    <select
                      value={redditTimeWindow}
                      onChange={(e) =>
                        setRedditTimeWindow(e.target.value as 'day' | 'week' | 'month')
                      }
                      className={inputClass}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={redditLimit}
                      onChange={(e) => setRedditLimit(Number(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      minScore
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={redditMinScore}
                      onChange={(e) => setRedditMinScore(Number(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Keywords (one per line)
                    </label>
                    <textarea
                      className={textareaClass}
                      rows={2}
                      placeholder="ai tool\nworkflow\npricing"
                      value={redditKeywords}
                      onChange={(e) => setRedditKeywords(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'basic' && newSource === 'youtube' && (
              <div className="space-y-4 md:col-span-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Topics (one per line)
                  </label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    placeholder="ai tools\ncreator workflows\nsaas growth"
                    value={youtubeTopics}
                    onChange={(e) => setYoutubeTopics(e.target.value)}
                  />
                  {requiredListError && (
                    <p className="text-xs text-destructive">{requiredListError}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Videos per topic
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={youtubeVideosPerTopic}
                      onChange={(e) =>
                        setYoutubeVideosPerTopic(Number(e.target.value) || 0)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Keywords (one per line)
                    </label>
                    <textarea
                      className={textareaClass}
                      rows={2}
                      placeholder="automation\ncontent pipeline"
                      value={youtubeKeywords}
                      onChange={(e) => setYoutubeKeywords(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'basic' && newSource === 'google_trends' && (
              <div className="space-y-4 md:col-span-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Geo
                    </label>
                    <input
                      value={trendsGeo}
                      onChange={(e) => setTrendsGeo(e.target.value)}
                      className={inputClass}
                      placeholder="US"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Category
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={trendsCategory}
                      onChange={(e) => setTrendsCategory(e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Keywords (one per line)
                  </label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    placeholder="ai code review\nagentic workflows"
                    value={trendsKeywords}
                    onChange={(e) => setTrendsKeywords(e.target.value)}
                  />
                  {requiredListError && (
                    <p className="text-xs text-destructive">{requiredListError}</p>
                  )}
                </div>
              </div>
            )}

            {mode === 'basic' && (
              <div className="space-y-2 md:col-span-2">
                <details className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                    Config preview (JSON)
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    {basicConfigText}
                  </pre>
                </details>
                <input type="hidden" name="config" value={basicConfigText} />
              </div>
            )}

            {mode === 'advanced' && (
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Config (JSON)</span>
                  <span className="text-[11px] text-muted-foreground/80">
                    Advanced: directly edit JSON config.
                  </span>
                </label>
                <textarea
                  name="config"
                  value={configText}
                  onChange={(e) => {
                    setConfigText(e.target.value);
                    setConfigTouched(true);
                  }}
                  className={`${textareaClass} font-mono text-xs`}
                  rows={6}
                />
                {configJsonError && (
                  <p className="text-xs text-destructive">{configJsonError}</p>
                )}
              </div>
            )}

            {createState.error && (
              <div className="md:col-span-2 text-sm text-destructive">
                {createState.error}
              </div>
            )}
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={createDisabled}>
                Create strategy
              </Button>
            </div>
          </form>
        </CardBody>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Existing strategies"
          description="Manage schedules and run ad-hoc ingests."
        />
        <CardBody className="overflow-x-auto pt-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Cron</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 font-medium">Last status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((strategy) => (
                <StrategyRow key={strategy.id} strategy={strategy} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={7}>
                    No strategies found.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </GlassCard>
    </div>
  );
}
