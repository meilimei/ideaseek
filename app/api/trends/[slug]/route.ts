import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';

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
        source_primary,
        volume_score,
        volume_display,
        growth_rate,
        growth_display,
        growth_label,
        time_window,
        first_seen,
        last_seen,
        summary,
        description,
        categories,
        target_users,
        difficulty,
        competition_level,
        monetization_potential,
        overall_score
      `,
    )
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (trendError || !trend) {
    return NextResponse.json({ error: 'Trend not found' }, { status: 404 });
  }

  const { data: timeseries, error: tsError } = await supabaseService
    .from('trend_timeseries')
    .select('date, value')
    .eq('trend_id', trend.id)
    .order('date', { ascending: true });

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

  const { data: relatedIdeas, error: ideasError } = await supabaseService
    .from('ideas')
    .select(
      'id, title, one_liner, difficulty, demand_strength, score_overall, source_type',
    )
    .eq('primary_trend_id', trend.id)
    .order('score_overall', { ascending: false })
    .limit(10);

  if (ideasError) {
    console.error('Failed to load related ideas:', ideasError);
  }

  return NextResponse.json({
    trend: {
      ...trend,
      categories: trend.categories ?? [],
    },
    timeseries: timeseries ?? [],
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
