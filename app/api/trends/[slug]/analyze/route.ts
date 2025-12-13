import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';
import { deepseek } from '@/lib/deepseekClient';

type Body = { founderProfile?: string };

export async function POST(
  request: Request,
  context: { params: { slug: string } },
) {
  try {
    const slug = context.params.slug;
    const body: Body = await request.json().catch(() => ({}));
    const founderProfile = body.founderProfile ?? '';

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
      .order('date', { ascending: true })
      .limit(24);

    if (tsError) {
      console.error('Failed to load trend timeseries:', tsError);
    }

    const recentSeries =
      timeseries?.map((pt) => `${pt.date}:${pt.value}`).join(', ') ?? '';

    const prompt = `
You are a startup opportunity analyst. Analyze the trend below and return ONLY a valid JSON object.

TREND:
- Title: ${trend.title}
- Summary: ${trend.summary ?? 'N/A'}
- Description: ${trend.description ?? 'N/A'}
- Categories: ${(trend.categories ?? []).join(', ')}
- Target users: ${trend.target_users ?? 'N/A'}
- Source: ${trend.source_primary}
- Metrics: volume_score=${trend.volume_score ?? 'N/A'}, growth_rate=${trend.growth_rate ?? 'N/A'}, difficulty=${trend.difficulty ?? 'N/A'}, competition_level=${trend.competition_level ?? 'N/A'}, monetization_potential=${trend.monetization_potential ?? 'N/A'}
- Time window: ${trend.time_window ?? 'N/A'}
- First seen: ${trend.first_seen ?? 'N/A'}, Last seen: ${trend.last_seen ?? 'N/A'}
- Timeseries (date:value, recent first): ${recentSeries || 'N/A'}

FOUNDER PROFILE (optional):
${founderProfile || 'N/A'}

Return ONLY this JSON object:
{
  "summary": "...",
  "problem_space": "...",
  "demand_drivers": "...",
  "current_solutions": "...",
  "gaps": "...",
  "risks": "...",
  "founder_fit": "...",
  "action_plan_30d": "..."
}
`;

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a startup opportunity analyst. You always output strictly valid JSON objects and nothing else.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1600,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    let parsed: {
      summary?: string;
      problem_space?: string;
      demand_drivers?: string;
      current_solutions?: string;
      gaps?: string;
      risks?: string;
      founder_fit?: string;
      action_plan_30d?: string;
      [key: string]: unknown;
    };
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse AI response:', err, content);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 },
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.summary !== 'string' ||
      typeof parsed.problem_space !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseService
      .from('trend_analysis')
      .upsert(
        {
          trend_id: trend.id,
          summary: parsed.summary,
          problem_space: parsed.problem_space,
          demand_drivers: parsed.demand_drivers,
          current_solutions: parsed.current_solutions,
          gaps: parsed.gaps,
          risks: parsed.risks,
          founder_fit: parsed.founder_fit,
          action_plan_30d: parsed.action_plan_30d,
          raw_json: parsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'trend_id' },
      )
      .select(
        'summary, problem_space, demand_drivers, current_solutions, gaps, risks, founder_fit, action_plan_30d, updated_at',
      )
      .single();

    if (error || !data) {
      console.error('Failed to save analysis:', error);
      return NextResponse.json(
        { error: 'Failed to save analysis' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      summary: data.summary,
      problem_space: data.problem_space,
      demand_drivers: data.demand_drivers,
      current_solutions: data.current_solutions,
      gaps: data.gaps,
      risks: data.risks,
      founder_fit: data.founder_fit,
      action_plan_30d: data.action_plan_30d,
      last_updated: data.updated_at,
    });
  } catch (err) {
    console.error('Failed to analyze trend:', err);
    return NextResponse.json(
      { error: 'Failed to analyze trend' },
      { status: 500 },
    );
  }
}
