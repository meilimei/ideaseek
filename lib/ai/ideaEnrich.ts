import { z } from 'zod';
import { deepseek } from '@/lib/deepseekClient';

export type IdeaEnrichInput = {
  idea: any;
  evidence: any[];
};

export type IdeaEnrichOutput = {
  tags: string[];
  score_overall: number;
  score_detail: Record<string, any>;
};

const dimensionSchema = z.object({
  score: z.number().min(0).max(10),
  reason: z.string().min(1),
  evidence_ids: z.array(z.string()),
});

const scoreDetailSchema = z.object({
  dimensions: z.object({
    market: dimensionSchema,
    pain: dimensionSchema,
    competition: dimensionSchema,
    differentiation: dimensionSchema,
    monetization: dimensionSchema,
    distribution: dimensionSchema,
  }),
  notes: z.array(z.string().min(1)).optional(),
  confidence: z.number().min(0).max(1),
});

const enrichSchema = z.object({
  tags: z
    .array(z.string().min(1).max(24))
    .min(5)
    .max(12)
    .refine((tags) => new Set(tags).size === tags.length, 'Tags must be unique')
    .refine((tags) => tags.every((tag) => tag === tag.toLowerCase()), 'Tags must be lowercase'),
  score_overall: z.number().int().min(0).max(100),
  score_detail: scoreDetailSchema,
});

export async function ideaEnrich(
  input: IdeaEnrichInput,
): Promise<IdeaEnrichOutput> {
  const prompt = buildPrompt(input);

  const completion = await deepseek.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          'You are a strict information extraction engine. Output ONLY valid JSON. Do not fabricate facts.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1200,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseJsonContent(content);
  const normalized = normalizeTags(parsed);

  const result = enrichSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Invalid enrich JSON: ${result.error.message}`);
  }

  return result.data;
}

function buildPrompt({ idea, evidence }: IdeaEnrichInput) {
  const ideaSummary = {
    id: idea?.id ?? null,
    title: idea?.title ?? null,
    summary: idea?.summary ?? null,
    description: idea?.description ?? null,
    one_liner: idea?.one_liner ?? null,
    source_type: idea?.source_type ?? null,
    status: idea?.status ?? null,
  };

  const evidenceList = (evidence ?? []).map((row) => ({
    id: row?.id ?? null,
    source_type: row?.source_type ?? row?.source ?? null,
    title: row?.title ?? null,
    url: row?.url ?? null,
    excerpt: row?.excerpt ?? row?.snippet ?? null,
  }));

  return `
You are a strict information extraction engine. Output ONLY valid JSON. Do not fabricate facts; if insufficient info, be conservative and say so in reasons.

Idea:
${JSON.stringify(ideaSummary, null, 2)}

Evidence list:
${JSON.stringify(evidenceList, null, 2)}

Return JSON with this exact schema:
{
  "tags": ["..."],
  "score_overall": 0,
  "score_detail": {
    "dimensions": {
      "market": {"score":0,"reason":"...","evidence_ids":["..."]},
      "pain": {"score":0,"reason":"...","evidence_ids":["..."]},
      "competition": {"score":0,"reason":"...","evidence_ids":["..."]},
      "differentiation": {"score":0,"reason":"...","evidence_ids":["..."]},
      "monetization": {"score":0,"reason":"...","evidence_ids":["..."]},
      "distribution": {"score":0,"reason":"...","evidence_ids":["..."]}
    },
    "notes": ["..."],
    "confidence": 0
  }
}

Rules:
- tags: 5-12 lowercase tags, no duplicates, max 24 chars each.
- score_overall: integer 0-100.
- dimension scores: integer 0-10 with brief reason; evidence_ids are IDs from the evidence list.
- confidence: 0-1.
- Return ONLY JSON, no markdown.
`;
}

function parseJsonContent(raw: string): unknown {
  const trimmed = raw.trim();
  const stripped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;

  try {
    return JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Invalid enrich JSON: ${(err as Error).message}`);
  }
}

function normalizeTags(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(obj.tags)) {
    const normalized = obj.tags
      .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : null))
      .filter((tag): tag is string => Boolean(tag));
    obj.tags = Array.from(new Set(normalized)).slice(0, 12);
  }
  return obj;
}
