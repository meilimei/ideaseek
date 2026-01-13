'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/icons';

const selectBaseClass =
  'flex h-11 w-full rounded-[calc(var(--radius)-2px)] border border-border/60 bg-card/60 px-3 text-sm text-foreground shadow-soft transition-colors focus-visible:outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40';

const selectCompactClass =
  'flex h-9 w-full rounded-[calc(var(--radius)-2px)] border border-border/60 bg-card/60 px-3 text-sm text-foreground shadow-soft transition-colors focus-visible:outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40';

type EvidenceItem = {
  quote?: string | null;
  url?: string | null;
  author?: string | null;
  created_at?: string | null;
};

type ClusterBrief = {
  id: string;
  title: string | null;
  one_liner: string | null;
  markdown: string | null;
  brief: Record<string, unknown> | null;
};

type NeedCluster = {
  id: string;
  score_total: number | null;
  last_seen_at: string | null;
  signal_count: number | null;
  last_30d_signal_count: number | null;
  evidence: EvidenceItem[] | null;
  meta: Record<string, unknown> | null;
  brief: ClusterBrief | null;
};

type SignalItem = {
  id: string;
  content: string | null;
  url: string | null;
  author: string | null;
  signal_created_at: string | null;
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
  evidence?: {
    signal_count?: number;
    trend_summary?: string;
    quotes?: EvidenceItem[];
  };
};

type SaveTarget = {
  destination: 'profile' | 'project';
  projectName: string;
};

type SavedPackage = SaveTarget & { savedAt: string };

function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (!evidence.length) {
    return <div className="text-sm text-muted-foreground">No evidence yet.</div>;
  }
  return (
    <div className="space-y-3">
      {evidence.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-border/40 bg-card/60 p-3">
          <div className="text-sm text-foreground">{item.quote || '—'}</div>
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

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
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

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function coerceEvidence(value: unknown): EvidenceItem[] {
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
    .filter((item): item is EvidenceItem =>
      Boolean(item && (item.quote || item.url || item.author || item.created_at)),
    );
}

function truncateText(value: string | null | undefined, max = 160) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '—';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getClusterName(cluster: NeedCluster) {
  if (cluster.brief?.title) return cluster.brief.title;
  const meta = cluster.meta ?? {};
  const name = typeof meta.name === 'string' ? meta.name : null;
  const label = typeof meta.label === 'string' ? meta.label : null;
  const topic = typeof meta.topic === 'string' ? meta.topic : null;
  return name || label || topic || `Need cluster ${cluster.id.slice(0, 6)}`;
}

function getBriefDetails(brief: ClusterBrief | null): BriefDetails | null {
  if (!brief?.brief || typeof brief.brief !== 'object') return null;
  return brief.brief as BriefDetails;
}

function getTargetUsers(details: BriefDetails | null): string[] {
  const personas = coerceStringArray(details?.personas);
  const who =
    typeof details?.problem_definition?.who === 'string'
      ? details.problem_definition.who.trim()
      : '';
  const combined = who ? [who, ...personas] : personas;
  return Array.from(new Set(combined.filter(Boolean)));
}

export default function OpportunitiesClient({
  clusters,
  signals,
}: {
  clusters: NeedCluster[];
  signals: SignalItem[];
}) {
  const [mode, setMode] = useState<'fast' | 'cluster'>('cluster');
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'collecting' | 'generated'>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [destinationFilter, setDestinationFilter] = useState<'all' | 'profile' | 'project'>('all');
  const [minSignals, setMinSignals] = useState(0);
  const [saveTargets, setSaveTargets] = useState<Record<string, SaveTarget>>({});
  const [savedPackages, setSavedPackages] = useState<Record<string, SavedPackage>>({});
  const [feedbackState, setFeedbackState] = useState<
    Record<string, { busy: boolean; message?: string }>
  >({});

  const pipelineSteps = useMemo(
    () => [
      { id: 'fetch', label: 'Fetching signals', done: signals.length > 0 },
      { id: 'cluster', label: 'Clustering signals', done: clusters.length > 0 },
      {
        id: 'brief',
        label: 'Generating opportunity packages',
        done: clusters.some((cluster) => Boolean(cluster.brief)),
      },
    ],
    [signals.length, clusters],
  );

  const pipelineProgress = Math.round(
    (pipelineSteps.filter((step) => step.done).length / pipelineSteps.length) * 100,
  );

  const fastIdeas = useMemo(
    () => clusters.filter((cluster) => cluster.brief).slice(0, 6),
    [clusters],
  );

  const filteredClusters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clusters.filter((cluster) => {
      const status = cluster.brief ? 'generated' : 'collecting';
      if (statusFilter !== 'all' && statusFilter !== status) return false;

      const signalCount = cluster.signal_count ?? 0;
      if (minSignals > 0 && signalCount < minSignals) return false;

      const saved = savedPackages[cluster.id];
      if (savedOnly && !saved) return false;
      if (destinationFilter !== 'all' && saved?.destination !== destinationFilter) return false;

      if (query) {
        const name = getClusterName(cluster).toLowerCase();
        const oneLiner = cluster.brief?.one_liner?.toLowerCase() ?? '';
        if (!name.includes(query) && !oneLiner.includes(query)) return false;
      }
      return true;
    });
  }, [clusters, destinationFilter, minSignals, savedOnly, savedPackages, search, statusFilter]);

  const togglePackage = (id: string) =>
    setExpandedPackages((prev) => ({ ...prev, [id]: !prev[id] }));

  const updateSaveTarget = (id: string, patch: Partial<SaveTarget>) => {
    setSaveTargets((prev) => {
      const current = prev[id] ?? { destination: 'profile', projectName: '' };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const savePackage = (id: string) => {
    const target = saveTargets[id] ?? { destination: 'profile', projectName: '' };
    const normalized = {
      destination: target.destination,
      projectName:
        target.destination === 'project'
          ? target.projectName.trim() || 'Untitled project'
          : '',
    };
    setSavedPackages((prev) => ({
      ...prev,
      [id]: { ...normalized, savedAt: new Date().toISOString() },
    }));
    setSaveTargets((prev) => ({ ...prev, [id]: normalized }));
  };

  const removeSave = (id: string) => {
    setSavedPackages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setFeedback = (briefId: string, patch: { busy?: boolean; message?: string }) => {
    setFeedbackState((prev) => ({
      ...prev,
      [briefId]: { ...prev[briefId], ...patch },
    }));
  };

  const sendFeedback = async (briefId: string, action: string) => {
    setFeedback(briefId, { busy: true, message: undefined });
    try {
      const res = await fetch('/api/opportunities/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to send feedback');
      setFeedback(briefId, { message: 'Feedback saved' });
    } catch (err) {
      setFeedback(briefId, {
        message: err instanceof Error ? err.message : 'Failed to send feedback',
      });
    } finally {
      setFeedback(briefId, { busy: false });
    }
  };

  const openPackage = (clusterId: string) => {
    setMode('cluster');
    setSearch('');
    setStatusFilter('all');
    setSavedOnly(false);
    setDestinationFilter('all');
    setExpandedPackages((prev) => ({ ...prev, [clusterId]: true }));
    setTimeout(() => {
      const target = document.getElementById(`cluster-${clusterId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Switch between fast signal scanning and clustered opportunity packages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-border/60 bg-card/40 p-1 shadow-soft">
            <Button
              type="button"
              size="sm"
              variant={mode === 'fast' ? 'pill' : 'ghostPill'}
              onClick={() => setMode('fast')}
            >
              Fast Mode
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'cluster' ? 'pill' : 'ghostPill'}
              onClick={() => setMode('cluster')}
            >
              Cluster Mode
            </Button>
          </div>
          <Badge variant="secondary">{clusters.length} need clusters</Badge>
          <Badge variant="outline">{signals.length} recent signals</Badge>
        </div>
      </div>

      <Card className="border-border/40">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Pipeline status</CardTitle>
          <CardDescription>
            Tracking data fetching, clustering, and opportunity package generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {pipelineSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                {step.done ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <span>{step.label}</span>
              </div>
            ))}
            <Badge variant="secondary">{pipelineProgress}% complete</Badge>
          </div>
          <div className="h-2 w-full rounded-full bg-border/40">
            <div
              className="h-2 rounded-full bg-emerald-400/80 transition-all"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {mode === 'fast' ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Reddit signals</CardTitle>
              <CardDescription>Quick scan of the latest pain points.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {signals.length === 0 && (
                <div className="text-sm text-muted-foreground">No signals yet.</div>
              )}
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-xl border border-border/40 bg-card/60 p-3"
                >
                  <div className="text-sm text-foreground">
                    {truncateText(signal.content)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {signal.author && <span>{signal.author}</span>}
                    {signal.signal_created_at && (
                      <span>{formatDate(signal.signal_created_at)}</span>
                    )}
                    {signal.url && (
                      <Link
                        href={signal.url}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open thread
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Idea snapshots</CardTitle>
              <CardDescription>Generated from high-signal clusters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fastIdeas.length === 0 && (
                <div className="text-sm text-muted-foreground">No ideas yet.</div>
              )}
              {fastIdeas.map((cluster) => (
                <div
                  key={cluster.id}
                  className="rounded-xl border border-border/40 bg-card/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">
                      {getClusterName(cluster)}
                    </div>
                    {cluster.signal_count != null && (
                      <Badge variant="secondary">{cluster.signal_count} signals</Badge>
                    )}
                  </div>
                  {cluster.brief?.one_liner && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {cluster.brief.one_liner}
                    </p>
                  )}
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openPackage(cluster.id)}
                    >
                      View opportunity package
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter packages</CardTitle>
              <CardDescription>Find the right cluster to explore or save.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="cluster-search">Search clusters</Label>
                <Input
                  id="cluster-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by cluster or value prop"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  className={selectBaseClass}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | 'collecting' | 'generated')
                  }
                >
                  <option value="all">All</option>
                  <option value="collecting">Collecting</option>
                  <option value="generated">Generated brief</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-signals">Min signals</Label>
                <Input
                  id="min-signals"
                  type="number"
                  min={0}
                  value={minSignals}
                  onChange={(event) => setMinSignals(Number(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination-filter">Saved to</Label>
                <select
                  id="destination-filter"
                  className={selectBaseClass}
                  value={destinationFilter}
                  onChange={(event) =>
                    setDestinationFilter(event.target.value as 'all' | 'profile' | 'project')
                  }
                >
                  <option value="all">Any destination</option>
                  <option value="profile">Profile</option>
                  <option value="project">Project</option>
                </select>
                <div className="pt-2">
                  <Checkbox
                    checked={savedOnly}
                    onChange={(event) => setSavedOnly(event.target.checked)}
                    label="Saved only"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Need clusters</h2>
              <p className="text-xs text-muted-foreground">
                Recurring pain points grouped from Reddit signals.
              </p>
            </div>
            <Badge variant="secondary">{filteredClusters.length} clusters</Badge>
          </div>

          {filteredClusters.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No clusters match</CardTitle>
                <CardDescription>Try adjusting filters or clearing search.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {filteredClusters.map((cluster) => {
            const isOpen = Boolean(expandedPackages[cluster.id]);
            const status = cluster.brief ? 'generated' : 'collecting';
            const statusLabel =
              status === 'generated' ? 'Generated opportunity brief' : 'Collecting';
            const signalCount = cluster.signal_count ?? 0;
            const saved = savedPackages[cluster.id];
            const saveTarget = saveTargets[cluster.id] ?? {
              destination: 'profile',
              projectName: '',
            };
            const details = getBriefDetails(cluster.brief);
            const painPoints = coerceStringArray(details?.pain_points);
            const targetUsers = getTargetUsers(details);
            const competitors = coerceStringArray(details?.existing_solutions);
            const paidReasons = coerceStringArray(details?.monetization_reasons);
            const briefEvidence = coerceEvidence(details?.evidence?.quotes);
            const evidence = briefEvidence.length > 0 ? briefEvidence : cluster.evidence ?? [];
            const feedback = cluster.brief ? feedbackState[cluster.brief.id] : undefined;
            const markdown = cluster.brief?.markdown?.trim();

            return (
              <Card key={cluster.id} id={`cluster-${cluster.id}`} className="overflow-hidden">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl">{getClusterName(cluster)}</CardTitle>
                    <Badge variant={status === 'generated' ? 'secondary' : 'outline'}>
                      {statusLabel}
                    </Badge>
                    {cluster.score_total != null && (
                      <Badge variant="secondary">Score {cluster.score_total.toFixed(2)}</Badge>
                    )}
                    {cluster.last_seen_at && (
                      <Badge variant="outline">Last seen {cluster.last_seen_at}</Badge>
                    )}
                  </div>
                  {cluster.brief?.one_liner && (
                    <CardDescription className="text-base text-foreground">
                      {cluster.brief.one_liner}
                    </CardDescription>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{signalCount} signals</span>
                    {cluster.last_30d_signal_count != null && (
                      <span>{cluster.last_30d_signal_count} in last 30d</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => togglePackage(cluster.id)}
                    >
                      {isOpen ? 'Hide opportunity package' : 'View opportunity package'}
                    </Button>
                    {cluster.brief && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => sendFeedback(cluster.brief.id, 'useful')}
                          disabled={Boolean(feedback?.busy)}
                        >
                          Useful
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => sendFeedback(cluster.brief.id, 'not_relevant')}
                          disabled={Boolean(feedback?.busy)}
                        >
                          Not relevant
                        </Button>
                        {feedback?.message && (
                          <span className="text-xs text-muted-foreground">
                            {feedback.message}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/50 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold text-foreground">Save package</div>
                      {saved && (
                        <Badge variant="secondary">
                          Saved to {saved.destination}
                          {saved.destination === 'project' && saved.projectName
                            ? `: ${saved.projectName}`
                            : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="w-full sm:w-40">
                        <select
                          className={selectCompactClass}
                          value={saveTarget.destination}
                          onChange={(event) =>
                            updateSaveTarget(cluster.id, {
                              destination: event.target.value as 'profile' | 'project',
                            })
                          }
                        >
                          <option value="profile">Profile</option>
                          <option value="project">Project</option>
                        </select>
                      </div>
                      {saveTarget.destination === 'project' && (
                        <div className="w-full sm:flex-1">
                          <Input
                            placeholder="Project name"
                            value={saveTarget.projectName}
                            onChange={(event) =>
                              updateSaveTarget(cluster.id, {
                                projectName: event.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => savePackage(cluster.id)}>
                          Save package
                        </Button>
                        {saved && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSave(cluster.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="rounded-2xl border border-border/40 bg-card/50 p-4">
                      {!cluster.brief && (
                        <div className="text-sm text-muted-foreground">
                          Opportunity package is still being generated. Check back after the
                          cluster passes gating.
                        </div>
                      )}
                      {cluster.brief && (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Target users
                              </div>
                              <div className="mt-2">
                                <BulletList items={targetUsers} />
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Pain points
                              </div>
                              <div className="mt-2">
                                <BulletList items={painPoints} />
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Competitors
                              </div>
                              <div className="mt-2">
                                <BulletList items={competitors} />
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Paid reason
                              </div>
                              <div className="mt-2">
                                <BulletList items={paidReasons} />
                              </div>
                            </div>
                          </div>

                          {markdown && (
                            <div className="rounded-xl border border-border/40 bg-card/60 p-3">
                              <div className="mb-2 text-sm font-semibold text-foreground">
                                Brief summary
                              </div>
                              <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                                {markdown.split('\n').map((line, idx) => (
                                  <p key={idx}>{line}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="rounded-xl border border-border/40 bg-card/60 p-3">
                            <div className="mb-3 text-sm font-semibold text-foreground">Evidence</div>
                            <EvidenceList evidence={evidence} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
