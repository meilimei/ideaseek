'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type EvidenceItem = {
  quote?: string | null;
  url?: string | null;
  author?: string | null;
  created_at?: string | null;
};

type ClusterInfo = {
  id: string;
  score_total: number | null;
  last_seen_at: string | null;
  signal_count: number | null;
  last_30d_signal_count: number | null;
  evidence: EvidenceItem[] | null;
};

type BriefRow = {
  id: string;
  title: string | null;
  one_liner: string | null;
  markdown: string | null;
  brief: Record<string, unknown> | null;
  cluster: ClusterInfo | null;
};

function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (!evidence.length) {
    return <div className="text-sm text-muted-foreground">No evidence yet.</div>;
  }
  return (
    <div className="space-y-3">
      {evidence.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-border/40 bg-card/60 p-3">
          <div className="text-sm text-foreground">
            {item.quote || '—'}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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

export default function OpportunitiesClient({ briefs }: { briefs: BriefRow[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const sendFeedback = async (briefId: string, action: string) => {
    setBusy(briefId);
    setMessage(null);
    try {
      const res = await fetch('/api/opportunities/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to send feedback');
      setMessage('Feedback saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Summaries generated from vetted signal clusters. Expand to review evidence and leave feedback.
        </p>
      </div>

      <div className="space-y-4">
        {briefs.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No opportunities yet</CardTitle>
              <CardDescription>Check back after new clusters are generated.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {briefs.map((brief) => {
          const cluster = brief.cluster;
          const evidence = cluster?.evidence ?? [];
          const isOpen = Boolean(expanded[brief.id]);
          return (
            <Card key={brief.id} className="overflow-hidden">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{brief.title || 'Untitled opportunity'}</CardTitle>
                  {cluster?.score_total != null && (
                    <Badge variant="secondary">Score {cluster.score_total.toFixed(2)}</Badge>
                  )}
                  {cluster?.last_seen_at && (
                    <Badge variant="outline">Last seen {cluster.last_seen_at}</Badge>
                  )}
                </div>
                {brief.one_liner && (
                  <CardDescription className="text-base text-foreground">
                    {brief.one_liner}
                  </CardDescription>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {cluster?.signal_count != null && <span>{cluster.signal_count} signals</span>}
                  {cluster?.last_30d_signal_count != null && (
                    <span>{cluster.last_30d_signal_count} in last 30d</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {brief.markdown ? (
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                    {brief.markdown.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No summary yet.</div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => sendFeedback(brief.id, 'useful')}
                    disabled={busy === brief.id}
                  >
                    Useful
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => sendFeedback(brief.id, 'not_relevant')}
                    disabled={busy === brief.id}
                  >
                    Not relevant
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle(brief.id)}
                  >
                    {isOpen ? 'Hide evidence' : 'Show evidence'}
                  </Button>
                  {message && <span className="text-xs text-muted-foreground">{message}</span>}
                </div>

                {isOpen && (
                  <div className="rounded-2xl border border-border/40 bg-card/50 p-4">
                    <div className="mb-3 text-sm font-semibold text-foreground">Evidence</div>
                    <EvidenceList evidence={evidence as EvidenceItem[]} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
