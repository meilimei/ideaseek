import { z } from 'zod';
import { aiClient } from './ai';
import { supabaseServiceClient as supabase } from '../supabaseServiceClient';

const scoreDetailSchema = z.object({
  demand: z.number().min(0).max(100),
  timing: z.number().min(0).max(100),
  moat: z.number().min(0).max(100),
  competition: z.number().min(0).max(100),
  founder_fit: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
});

const enrichmentSchema = z.object({
  tags: z.array(z.string().trim().min(1)).min(5).max(12),
  score_overall: z.number().min(0).max(100),
  score_detail: scoreDetailSchema,
  suggested_status: z.literal('draft'),
});

type EnrichmentResult = z.infer<typeof enrichmentSchema>;

export async function enrichIdea(ideaId: string): Promise<EnrichmentResult> {
  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select(
      'id, title, one_liner, summary, source_type, created_at, status, tags, score_overall, score_detail',
    )
    .eq('id', ideaId)
    .single();

  if (ideaError || !idea) {
    throw new Error(`Failed to load idea ${ideaId}: ${ideaError?.message ?? 'not found'}`);
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from('idea_evidence')
    .select(
      'source, source_type, source_ref_id, title, url, excerpt, metrics, raw_json, created_at',
    )
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });

  if (evidenceError) {
    throw new Error(`Failed to load evidence for idea ${ideaId}: ${evidenceError.message}`);
  }

  const prompt = buildPrompt(idea, evidence ?? []);

  const completion = await aiClient.chat.completions.create({
    model: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a precise JSON generator that summarizes only from provided content. Do not invent facts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 800,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (err) {
    throw new Error(`Failed to parse enrichment JSON: ${(err as Error).message}`);
  }

  const result = enrichmentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid enrichment result: ${result.error.message}`);
  }

  const payload: Record<string, unknown> = {
    tags: result.data.tags,
    score_overall: result.data.score_overall,
    score_detail: result.data.score_detail,
    enriched_at: new Date().toISOString(),
  };

  if (idea.status !== 'published') {
    payload.status = 'draft';
  }

  const { error: updateError } = await supabase
    .from('ideas')
    .update(payload)
    .eq('id', ideaId);

  if (updateError) {
    throw new Error(`Failed to update idea ${ideaId}: ${updateError.message}`);
  }

  return result.data;
}

function buildPrompt(
  idea: {
    title: string | null;
    one_liner: string | null;
    summary?: string | null;
    source_type: string | null;
    created_at: string | null;
    status?: string | null;
    tags?: string[] | null;
    score_overall?: number | null;
    score_detail?: any;
  },
  evidence: any[],
) {
  const evidenceList = evidence
    .map((item, idx) => {
      const lines = [
        `#${idx + 1} source=${item.source ?? 'unknown'} type=${item.source_type ?? 'unknown'}`,
        item.title ? `title: ${item.title}` : '',
        item.excerpt ? `excerpt: ${item.excerpt}` : '',
        item.url ? `url: ${item.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return lines;
    })
    .join('\n\n');

  return `
You are enriching an idea strictly from provided evidence. Do NOT invent facts or numbers not present.

Idea:
- Title: ${idea.title ?? '(untitled)'}
- One-liner: ${idea.one_liner ?? '(none)'}
- Summary: ${idea.summary ?? '(none)'}
- Source type: ${idea.source_type ?? 'unknown'}
- Created at: ${idea.created_at ?? 'unknown'}
- Existing tags: ${(idea.tags ?? []).join(', ') || '(none)'}
- Existing score_overall: ${idea.score_overall ?? 'none'}

Evidence (chronological):
${evidenceList || '(no evidence)'}

Output strict JSON:
{
  "tags": ["short tag 1", "... 5-12 total"],
  "score_overall": 0-100,
  "score_detail": {
    "demand": 0-100,
    "timing": 0-100,
    "moat": 0-100,
    "competition": 0-100,
    "founder_fit": 0-100,
    "confidence": 0-100
  },
  "suggested_status": "draft"
}

Rules:
- Use only info from idea/evidence; no outside knowledge.
- Tags: 5-12 concise English tags.
- Scores: integers 0-100; if unknown, set 0.
- suggested_status must be "draft".
- Return ONLY JSON.
`;
}
