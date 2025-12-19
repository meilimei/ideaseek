import Link from 'next/link';
import { notFound } from 'next/navigation';
import TrendSparkline from './TrendSparkline';
import TrendAnalysisSection from './TrendAnalysisSection';
import TrendBookmarkButton from '../TrendBookmarkButton';

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
  score_overall: number | null;
  source_type: string | null;
  tags: string[] | null;
  slug?: string | null;
  published?: boolean | null;
  pinned?: boolean | null;
  featured?: boolean | null;
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
  <div className="rounded-xl border bg-white p-3 shadow-sm">
    <div className="text-xs uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="text-base font-semibold text-gray-900 mt-1">
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
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-indigo-600">
            Trend
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{trend.title}</h1>
          {trend.summary && (
            <p className="text-gray-700 text-sm md:text-base">
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
            <div className="rounded-2xl border bg-white/60 p-4 text-sm text-gray-700">
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
          <div className="text-xs text-gray-600 space-y-1">
            {trend.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trend.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border px-2 py-0.5 text-xs"
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
          <h2 className="text-lg font-semibold tracking-tight">
            Related Ideas
          </h2>
          <Link
            href={`/ideas/database?q=${encodeURIComponent(trend.title)}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Search all ideas for &quot;{trend.title}&quot;
          </Link>
        </div>

        {!relatedIdeas || relatedIdeas.length === 0 ? (
          <p className="text-sm text-gray-500">
            No related ideas yet. Generate ideas from this trend or link existing ideas to it.
          </p>
        ) : (
          <div className="space-y-3">
            {relatedIdeas.map((idea: RelatedIdea) => (
              <Link
                key={idea.id}
                href={idea.slug ? `/ideas/${idea.slug}` : `/ideas/${idea.id}`}
                className="block rounded-2xl border bg-white/60 p-3 transition-colors hover:bg-indigo-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {idea.title}
                    </h3>
                    {idea.one_liner && (
                      <p className="mt-1 text-xs text-gray-600">
                        {idea.one_liner}
                      </p>
                    )}
                  </div>
                  {idea.score_overall != null && (
                    <div className="text-right text-xs text-amber-700">
                      Score
                      <div className="font-semibold">
                        {idea.score_overall.toFixed(1)} / 5
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                  {idea.source_type && (
                    <span className="rounded-full border px-2 py-0.5">
                      Source: {idea.source_type}
                    </span>
                  )}
                  {idea.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                  {idea.difficulty != null && (
                    <span className="rounded-full border px-2 py-0.5">
                      Difficulty: {idea.difficulty}
                    </span>
                  )}
                  {idea.demand_strength != null && (
                    <span className="rounded-full border px-2 py-0.5">
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
