import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type EvidenceItem = {
  quote?: string | null;
  url?: string | null;
  author?: string | null;
  created_at?: string | null;
};

type ClusterRow = {
  id: string;
  title: string | null;
  summary: string | null;
  signal_count: number | null;
  unique_authors: number | null;
  top_keywords: string[] | null;
  evidence: EvidenceItem[] | null;
  gate_passed: boolean | null;
  status: string | null;
  repeat_score: number | null;
  paid_intent_score: number | null;
  buyer_clarity_score: number | null;
  reachability_score: number | null;
  score_total: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type BriefRow = {
  id: string;
  cluster_id: string | null;
  title: string | null;
  one_liner: string | null;
  markdown: string | null;
  brief: Record<string, unknown> | null;
  model: string | null;
  prompt_version: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type BriefDetails = {
  problem_definition?: {
    who?: string;
    task?: string;
    obstacle?: string;
  };
  pain_points?: string[];
  personas?: string[];
  existing_solutions?: string[];
  monetization_reasons?: string[];
  wedge?: string;
  mvp_features?: string[];
  channels?: string[];
  validation?: {
    interview_questions?: string[];
    landing_page_test?: string;
  };
  evidence?: {
    signal_count?: number;
    last_30d_signal_count?: number;
    trend_summary?: string;
    quotes?: EvidenceItem[];
  };
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function toDetails(input: Record<string, unknown> | null): BriefDetails | null {
  if (!input || typeof input !== 'object') return null;
  return input as BriefDetails;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asEvidenceList(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        quote: typeof record.quote === 'string' ? record.quote : null,
        url: typeof record.url === 'string' ? record.url : null,
        author: typeof record.author === 'string' ? record.author : null,
        created_at: typeof record.created_at === 'string' ? record.created_at : null,
      };
    })
    .filter((item): item is EvidenceItem => Boolean(item && item.quote));
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground">No data yet.</div>;
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`}>{item}</li>
      ))}
    </ul>
  );
}

function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground">No evidence yet.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={`${item.url ?? 'quote'}-${idx}`} className="rounded-xl border border-border/40 bg-card/60 p-3">
          <div className="text-sm text-foreground">{item.quote ?? '—'}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.author && <span>{item.author}</span>}
            {item.created_at && <span>{item.created_at}</span>}
            {item.url && (
              <Link
                href={item.url}
                className="text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Source
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    return notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for opportunity detail:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data: briefData, error: briefError } = await supabase
    .from('opportunity_briefs')
    .select(
      'id, cluster_id, title, one_liner, markdown, brief, model, prompt_version, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (briefError || !briefData) {
    return notFound();
  }

  const brief = briefData as BriefRow;
  const { data: clusterData, error: clusterError } = brief.cluster_id
    ? await supabase
        .from('signal_clusters')
        .select(
          'id, title, summary, signal_count, unique_authors, top_keywords, evidence, gate_passed, status, repeat_score, paid_intent_score, buyer_clarity_score, reachability_score, score_total, first_seen_at, last_seen_at',
        )
        .eq('id', brief.cluster_id)
        .maybeSingle()
    : { data: null, error: null };

  if (clusterError) {
    console.error('Failed to load signal cluster for opportunity:', clusterError.message);
  }

  const cluster = (clusterData ?? null) as ClusterRow | null;
  const details = toDetails(brief.brief ?? null);
  const problem = details?.problem_definition;
  const painPoints = asStringArray(details?.pain_points);
  const personas = asStringArray(details?.personas);
  const alternatives = asStringArray(details?.existing_solutions);
  const monetization = asStringArray(details?.monetization_reasons);
  const wedge = typeof details?.wedge === 'string' ? details.wedge : null;
  const mvp = asStringArray(details?.mvp_features);
  const channels = asStringArray(details?.channels);
  const questions = asStringArray(details?.validation?.interview_questions);
  const landingPageTest =
    typeof details?.validation?.landing_page_test === 'string'
      ? details.validation.landing_page_test.trim()
      : '';
  const clusterEvidence = asEvidenceList(cluster?.evidence);
  const evidenceQuotes = clusterEvidence.length > 0
    ? clusterEvidence
    : asEvidenceList(details?.evidence?.quotes);
  const gatePassed = cluster?.gate_passed ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/opportunities">Back to Opportunities</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Created: {formatDate(brief.created_at)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {brief.title || 'Opportunity brief'}
          </h1>
          <Badge variant={gatePassed ? 'secondary' : 'outline'}>
            {gatePassed === null ? 'Unknown' : gatePassed ? 'Passed' : 'Failed'}
          </Badge>
        </div>
        {brief.one_liner && (
          <p className="text-sm text-muted-foreground">{brief.one_liner}</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Cluster stats</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signals</div>
            <div className="text-foreground">
              {cluster?.signal_count ?? details?.evidence?.signal_count ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Gate</div>
            <div className="text-foreground">
              {gatePassed === null ? 'Unknown' : gatePassed ? 'Passed' : 'Failed'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Score</div>
            <div className="text-foreground">
              {cluster?.score_total != null ? cluster.score_total.toFixed(2) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last seen</div>
            <div className="text-foreground">
              {formatDate(cluster?.last_seen_at ?? brief.created_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Problem definition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Who</div>
              <div className="text-foreground">{problem?.who ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Task</div>
              <div className="text-foreground">{problem?.task ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Obstacle</div>
              <div className="text-foreground">{problem?.obstacle ?? '—'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Personas</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={personas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pain points</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={painPoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Alternatives</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={alternatives} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Monetization reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={monetization} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Wedge</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {wedge ?? '—'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>MVP list</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={mvp} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={channels} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Validation script</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Interview questions
            </div>
            <div className="mt-2">
              <BulletList items={questions} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Landing page test
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {landingPageTest || '—'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          {details?.evidence?.trend_summary && (
            <p className="mb-3 text-sm text-muted-foreground">
              {details.evidence.trend_summary}
            </p>
          )}
          <EvidenceList items={evidenceQuotes} />
        </CardContent>
      </Card>

      {brief.markdown && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
              {brief.markdown}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
