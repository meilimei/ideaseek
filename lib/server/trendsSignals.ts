type TrendSignalInput = {
  keyword: string;
  title?: string | null;
  growth_pct?: number | null;
  latest_value?: number | null;
  sparkline?: number[] | null;
  peak_value?: number | null;
  avg_value?: number | null;
};

export type TrendSignals = {
  tags: string[];
  score: number | null;
  status: string | null;
  status_reason: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function deriveTags(keyword: string, title?: string | null): string[] {
  const text = `${keyword} ${title ?? ''}`.toLowerCase();
  const tags: string[] = [];
  const add = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 3) tags.push(tag);
  };

  if (/(ai|gpt|llm|model)/.test(text)) add('AI');
  if (/(code|dev|api|review|assistant|ide)/.test(text)) add('Developer Tools');
  if (/(creator|content|youtube|video|voice|clone|edit)/.test(text))
    add('Creators');
  if (/(crm|dashboard|analytics|scheduler|software|platform)/.test(text))
    add('B2B');

  return tags;
}

function computeScore(input: TrendSignalInput): number | null {
  const { growth_pct, latest_value, sparkline } = input;
  const hasAny =
    growth_pct != null || latest_value != null || (sparkline?.length ?? 0) > 1;
  if (!hasAny) return null;

  const growthPctPercent =
    typeof growth_pct === 'number' ? growth_pct * 100 : null;

  let score = 2.0;

  if (growthPctPercent != null) {
    const mapped = clamp((growthPctPercent + 50) / 250, 0, 1) * 2; // -50..200 -> 0..2
    score += mapped;
  }

  if (typeof latest_value === 'number') {
    const latestMapped = clamp(latest_value / 100, 0, 1); // up to 100 interest
    score += latestMapped;
  }

  if (sparkline && sparkline.length >= 2) {
    const recent = sparkline.slice(-6);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const slope = (last - first) / Math.max(1, Math.abs(first));
      const slopeMapped = clamp((slope + 1) / 3, 0, 1); // slope -1..2 -> 0..1
      score += slopeMapped;
    }
  }

  return Math.round(clamp(score, 0, 5) * 10) / 10;
}

function computeStatus(input: TrendSignalInput) {
  if (input.growth_pct == null) return { status: null, reason: null };
  const pct = input.growth_pct * 100;
  const latest = input.latest_value ?? null;

  let status: string | null = null;
  if (pct >= 100 && (latest ?? 0) >= 40) status = 'Exploding';
  else if (pct >= 30 && (latest ?? 0) >= 25) status = 'Growing';
  else if (pct <= -20) status = 'Cooling';
  else status = 'Stable';

  const pctStr = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
  const reason =
    latest != null ? `growth ${pctStr}, latest ${Math.round(latest)}` : `growth ${pctStr}`;

  return { status, reason };
}

export function computeTrendSignals(input: TrendSignalInput): TrendSignals {
  const tags = deriveTags(input.keyword, input.title);
  const score = computeScore(input);
  const { status, reason } = computeStatus(input);

  return {
    tags,
    score,
    status,
    status_reason: reason,
  };
}
