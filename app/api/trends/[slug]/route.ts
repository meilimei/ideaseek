import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';
import { getRelatedIdeasForTrend } from '@/lib/server/relatedIdeas';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const { data: trend, error: trendError } = await supabaseService
    .from('trends')
    .select(
      `
        id,
        slug,
        title,
        keyword,
        summary,
        geo,
        timeframe,
        latest_value,
        peak_value,
        avg_value,
        growth_pct,
        updated_at,
        source_primary,
        volume_score,
        volume_display,
        growth_rate,
        growth_display,
        growth_label,
        time_window,
        first_seen,
        last_seen,
        description,
        categories,
        target_users,
        difficulty,
        competition_level,
        monetization_potential,
        overall_score,
        tags
      `,
    )
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (trendError || !trend) {
    return NextResponse.json({ error: 'Trend not found' }, { status: 404 });
  }

  const { data: timeseriesRows, error: tsError } = await supabaseService
    .from('trend_points')
    .select('point_date, value')
    .eq('trend_id', trend.id)
    .order('point_date', { ascending: true });

  if (tsError) {
    console.error('Failed to load trend timeseries:', tsError);
  }

  const { data: analysis, error: anError } = await supabaseService
    .from('trend_analysis')
    .select(
      'summary, problem_space, demand_drivers, current_solutions, gaps, risks, founder_fit, action_plan_30d, updated_at',
    )
    .eq('trend_id', trend.id)
    .maybeSingle();

  if (anError) {
    console.error('Failed to load trend analysis:', anError);
  }

  const relatedIdeas = await getRelatedIdeasForTrend({
    supabase: supabaseService,
    trendKeyword: (trend.keyword as string) ?? trend.title,
    trendTags: (trend.tags as string[] | null) ?? null,
    limit: 6,
  });

  return NextResponse.json({
    trend: {
      ...trend,
      categories: trend.categories ?? [],
    },
    timeseries:
      timeseriesRows?.map((row) => ({
        date: row.point_date as string,
        value: row.value as number,
      })) ?? [],
    analysis: analysis
      ? {
          summary: analysis.summary,
          problem_space: analysis.problem_space,
          demand_drivers: analysis.demand_drivers,
          current_solutions: analysis.current_solutions,
          gaps: analysis.gaps,
          risks: analysis.risks,
          founder_fit: analysis.founder_fit,
          action_plan_30d: analysis.action_plan_30d,
          last_updated: analysis.updated_at,
        }
      : null,
    relatedIdeas: relatedIdeas ?? [],
  });
}
