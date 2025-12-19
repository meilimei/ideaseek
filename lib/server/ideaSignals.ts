const TAG_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: 'AI', pattern: /(ai|gpt|llm|model)/i },
  { tag: 'Developer Tools', pattern: /(code|dev|api|sdk|review|assistant|ide)/i },
  { tag: 'Creators', pattern: /(creator|content|youtube|video|voice|edit)/i },
  { tag: 'B2B', pattern: /(crm|b2b|team|workflow|sales)/i },
  { tag: 'Marketing', pattern: /(seo|ads|marketing|growth|newsletter)/i },
  { tag: 'Analytics', pattern: /(dashboard|metrics|analytics|bi)/i },
  { tag: 'Productivity', pattern: /(automate|productivity|task|note|schedule)/i },
  { tag: 'Ecommerce', pattern: /(shopify|ecommerce|store|product)/i },
  { tag: 'Finance', pattern: /(trading|investing|finance|budget)/i },
];

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'you',
  'your',
  'idea',
  'tool',
  'app',
  'new',
  'for',
  'a',
  'an',
  'of',
  'in',
  'on',
  'to',
  'at',
  'by',
  'as',
  'it',
  'is',
  'be',
  'are',
]);

function computeTags(text: string): string[] {
  const tags: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(text) && !tags.includes(rule.tag)) {
      tags.push(rule.tag);
      if (tags.length >= 3) break;
    }
  }
  return tags;
}

function computeScore(input: {
  demand_strength?: string | null;
  market_size?: string | null;
  difficulty?: number | null;
}): number | null {
  const hasSignals =
    input.demand_strength != null ||
    input.market_size != null ||
    input.difficulty != null;
  if (!hasSignals) return null;

  let score = 2.0;

  const demand = (input.demand_strength || '').toLowerCase();
  if (demand === 'medium') score += 0.6;
  else if (demand === 'strong') score += 1.2;

  const market = (input.market_size || '').toUpperCase();
  if (market === 'S') score += 0.2;
  else if (market === 'M') score += 0.6;
  else if (market === 'L') score += 1.0;

  if (typeof input.difficulty === 'number') {
    const diffBonus = Math.max(0, Math.min(10, 10 - input.difficulty));
    score += (diffBonus / 10) * 0.8;
  }

  const clamped = Math.max(0, Math.min(5, score));
  return Math.round(clamped * 10) / 10;
}

function computeStatus(score: number | null): { status: string | null; reason: string | null } {
  if (score == null) return { status: null, reason: null };
  let status: string;
  if (score >= 4.2) status = 'Top';
  else if (score >= 3.5) status = 'Promising';
  else if (score >= 2.7) status = 'Average';
  else status = 'Weak';
  return { status, reason: null };
}

function computeStatusReason(input: {
  demand_strength?: string | null;
  market_size?: string | null;
  difficulty?: number | null;
}): string | null {
  const parts: string[] = [];
  if (input.demand_strength) parts.push(`demand ${input.demand_strength}`);
  if (input.market_size) parts.push(`market ${input.market_size}`);
  if (typeof input.difficulty === 'number')
    parts.push(`difficulty ${input.difficulty}`);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

function extractKeywords(title: string, one_liner?: string | null): string[] {
  const text = `${title} ${one_liner ?? ''}`.toLowerCase();
  const tokens = text.split(/[^a-z]+/i).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      keywords.push(token);
      if (keywords.length >= 8) break;
    }
  }
  return keywords;
}

export function computeIdeaSignals(input: {
  title: string;
  one_liner?: string | null;
  description?: string | null;
  tags?: string[] | null;
  demand_strength?: string | null;
  market_size?: string | null;
  difficulty?: number | null;
  source_type?: string | null;
}) {
  const text = `${input.title} ${input.one_liner ?? ''} ${input.description ?? ''} ${input.source_type ?? ''}`;
  const derivedTags = computeTags(text);
  const mergedTags: string[] = [];
  (input.tags ?? []).forEach((t) => {
    if (t && !mergedTags.includes(t)) mergedTags.push(t);
  });
  derivedTags.forEach((t) => {
    if (!mergedTags.includes(t) && mergedTags.length < 3) mergedTags.push(t);
  });

  const score = computeScore({
    demand_strength: input.demand_strength,
    market_size: input.market_size,
    difficulty: input.difficulty,
  });
  const { status, reason } = computeStatus(score);
  const statusReason = reason ?? computeStatusReason({
    demand_strength: input.demand_strength,
    market_size: input.market_size,
    difficulty: input.difficulty,
  });
  const keywords = extractKeywords(input.title, input.one_liner);

  return {
    tags: mergedTags,
    score,
    status,
    status_reason: statusReason,
    keywords,
  };
}
