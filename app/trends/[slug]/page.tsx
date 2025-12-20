import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import TrendSparkline from './TrendSparkline';
import TrendAnalysisSection from './TrendAnalysisSection';
import TrendBookmarkButton from '../TrendBookmarkButton';
import { ShareButtons } from '@/components/site/ShareButtons';

type Trend = {
  id: string;
  slug: string;
  title: string;
  source_primary: string;
  volume_score: number | null;
  volume_display: string | null;
  growth_rate: number | null;
  growth_display: string | null;
  growth_label: string | null;
  time_window: string | null;
  first_seen: string | null;
  last_seen: string | null;
  summary: string | null;
  description: string | null;
  categories: string[];
  target_users: string | null;
  difficulty: number | null;
  competition_level: number | null;
  monetization_potential: number | null;
  overall_score: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  score?: number | null;
  status?: string | null;
};

type SparkPoint = { date: string; value: number };

type TrendAnalysis = {
  summary: string | null;
  problem_space: string | null;
  demand_drivers: string | null;
  current_solutions: string | null;
  gaps: string | null;
  risks: string | null;
  founder_fit: string | null;
  action_plan_30d: string | null;
  last_updated: string | null;
};

type RelatedIdea = {
  id: string;
  title: string;
  one_liner: string | null;
  difficulty: number | null;
  demand_strength: number | null;
  score: number | null;
  status: string | null;
  source_type: string | null;
};

async function fetchTrend(slug: string) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${base}/api/trends/${slug}`, { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

const metricLabel = (label: string, value: string | number | null) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/90 p-3 shadow-sm">
    <div className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </div>
    <div className="mt-1 text-base font-semibold text-white">
      {value ?? '—'}
    </div>
  </div>
);

const difficultyLabel = (d: number | null) => {
  if (d == null) return '—';
  if (d <= 2) return 'Easy';
  if (d <= 3) return 'Moderate';
  if (d <= 4) return 'Hard';
  return 'Very hard';
};

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const base = siteUrl();
  const data = await fetchTrend(slug);
  if (!data || !data.trend) {
    return {
      title: 'Trend not found',
      description: 'This trend could not be found.',
    };
  }
  const trend = data.trend as Trend;
  const title = trend.seo_title ?? `${trend.keyword ?? trend.title} trend`;
  const desc =
    trend.seo_description ??
    trend.summary ??
    (trend.status
      ? `${trend.status}${trend.score != null ? ` · score ${trend.score.toFixed(1)}/5` : ''}`
      : 'Trend overview and stats');
  const url = `${base}/trends/${slug}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: 'IdeaSignal',
      type: 'article',
      images: [`${url.replace(`/trends/${slug}`, '')}/api/og/trend?slug=${slug}`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [`${url.replace(`/trends/${slug}`, '')}/api/og/trend?slug=${slug}`],
    },
  };
}

export default async function TrendDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchTrend(slug);
  if (!data) {
    return notFound();
  }

  const { trend, timeseries, analysis, relatedIdeas } = data as {
    trend: Trend;
    timeseries: SparkPoint[];
    analysis: TrendAnalysis | null;
    relatedIdeas?: RelatedIdea[];
  };

  if (!trend) {
    return notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8 text-slate-100">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--primary)]">
            Trend
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {trend.title}
          </h1>
          <ShareButtons title={trend.title} />
          {trend.summary && (
            <p className="text-slate-300 text-sm md:text-base">
              {trend.summary}
            </p>
          )}
        </div>
        <TrendBookmarkButton
          slug={trend.slug}
          trendId={trend.id}
          initialBookmarked={false}
        />
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <TrendSparkline points={timeseries as SparkPoint[]} className="h-32" />
          {trend.description && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 text-sm text-slate-200">
              {trend.description}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {metricLabel('Volume', trend.volume_display)}
            {metricLabel(
              'Growth',
              trend.growth_display
                ? `${trend.growth_display}${trend.growth_label ? ` (${trend.growth_label})` : ''}`
                : '—',
            )}
            {metricLabel(
              'Difficulty',
              trend.difficulty != null
                ? `${trend.difficulty} (${difficultyLabel(trend.difficulty)})`
                : '—',
            )}
            {metricLabel(
              'Competition',
              trend.competition_level != null ? trend.competition_level : '—',
            )}
            {metricLabel(
              'Monetization',
              trend.monetization_potential != null
                ? trend.monetization_potential
                : '—',
            )}
            {metricLabel(
              'Score',
              trend.overall_score != null ? `${trend.overall_score} / 5` : '—',
            )}
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            {trend.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trend.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-xs text-slate-200"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
            {trend.source_primary && (
              <div>Source: {trend.source_primary}</div>
            )}
            {trend.time_window && <div>Window: {trend.time_window}</div>}
            {trend.first_seen && <div>First seen: {trend.first_seen}</div>}
            {trend.last_seen && <div>Last seen: {trend.last_seen}</div>}
          </div>
        </aside>
      </section>

      <section>
        <TrendAnalysisSection
          slug={trend.slug}
          initialAnalysis={
            analysis
              ? {
                  summary: analysis.summary,
                  problem_space: analysis.problem_space,
                  demand_drivers: analysis.demand_drivers,
                  current_solutions: analysis.current_solutions,
                  gaps: analysis.gaps,
                  risks: analysis.risks,
                  founder_fit: analysis.founder_fit,
                  action_plan_30d: analysis.action_plan_30d,
                  last_updated: analysis.last_updated,
                }
              : null
          }
        />
      </section>

      <section className="mt-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Related Ideas
          </h2>
        </div>

        {!relatedIdeas || relatedIdeas.length === 0 ? (
          <p className="text-sm text-slate-400">
            No related ideas yet. Generate ideas from this trend or link existing ideas to it.
          </p>
        ) : (
          <div className="space-y-3">
            {relatedIdeas.map((idea: RelatedIdea) => (
              <Link
                key={idea.id}
                href={`/ideas/${idea.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-3 transition-transform hover:-translate-y-[1px] hover:border-[var(--primary)]/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {idea.title}
                    </h3>
                    {idea.one_liner && (
                      <p className="mt-1 text-xs text-slate-300">
                        {idea.one_liner}
                      </p>
                    )}
                  </div>
                  {idea.score != null && (
                    <div className="text-right text-xs text-amber-200">
                      Score
                      <div className="font-semibold">
                        {idea.score.toFixed(1)} / 5
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {idea.source_type && (
                    <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-slate-200">
                      Source: {idea.source_type}
                    </span>
                  )}
                  {idea.difficulty != null && (
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      Difficulty: {idea.difficulty}
                    </span>
                  )}
                  {idea.demand_strength != null && (
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      Demand: {idea.demand_strength}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
