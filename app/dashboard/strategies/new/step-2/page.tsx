'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AdminInput } from '@/components/admin/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STRATEGY_TRACKS } from '@/lib/strategyTracks';
import { useDraft } from '../_draft/context';
import SummaryCard from '../_components/SummaryCard';
import WizardShell from '../_components/WizardShell';

export default function StrategyStep2Page() {
  const { draft, updateDraft } = useDraft();
  const [newSubreddit, setNewSubreddit] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const subreddits = draft.subreddits ?? [];
  const keywords = draft.keywords ?? [];
  const trackInput = draft.track ?? '';
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { backHref, nextHref } = useMemo(() => {
    const mode = searchParams.get('mode') || '';
    const strategyId = searchParams.get('strategyId') || '';
    const isEdit =
      mode === 'edit' || (pathname ? pathname.startsWith('/dashboard/strategies/edit') : false);
    const basePath = isEdit ? '/dashboard/strategies/edit' : '/dashboard/strategies/new';
    const qp = new URLSearchParams();
    if (mode) qp.set('mode', mode);
    if (strategyId) qp.set('strategyId', strategyId);
    const query = qp.toString();
    return {
      backHref: `${basePath}/step-1${query ? `?${query}` : ''}`,
      nextHref: `${basePath}/step-3${query ? `?${query}` : ''}`,
    };
  }, [pathname, searchParams]);

  const normalizeSubreddit = (value: string) =>
    value.trim().replace(/^r\//i, '').replace(/\s+/g, '');
  const normalizeKeyword = (value: string) => value.trim();

  const addSubreddit = (value: string) => {
    const normalized = normalizeSubreddit(value);
    if (!normalized) return;
    const exists = subreddits.some(
      (item) => item.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return;
    updateDraft({ subreddits: [...subreddits, normalized] });
  };

  const removeSubreddit = (value: string) => {
    const normalized = value.toLowerCase();
    updateDraft({
      subreddits: subreddits.filter((item) => item.toLowerCase() !== normalized),
    });
  };

  const addKeyword = (value: string) => {
    const trimmed = normalizeKeyword(value);
    if (!trimmed) return;
    const exists = keywords.some((item) => item.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    updateDraft({ keywords: [...keywords, trimmed] });
  };

  const removeKeyword = (value: string) => {
    const normalized = value.toLowerCase();
    updateDraft({
      keywords: keywords.filter((item) => item.toLowerCase() !== normalized),
    });
  };

  const selectedTrack = STRATEGY_TRACKS.find(
    (track) =>
      track.id.toLowerCase() === trackInput.toLowerCase() ||
      track.title.toLowerCase() === trackInput.toLowerCase(),
  );

  const recommendedSubreddits = (selectedTrack?.reddit?.subreddits ?? [])
    .map((subreddit) => normalizeSubreddit(subreddit))
    .filter(Boolean)
    .filter((subreddit, index, arr) => arr.indexOf(subreddit) === index)
    .sort((a, b) => {
      const aSelected = subreddits.some((item) => item.toLowerCase() === a.toLowerCase());
      const bSelected = subreddits.some((item) => item.toLowerCase() === b.toLowerCase());
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.localeCompare(b);
    });

  const coreTemplates = [
    'How do you... / What tool do you use for...',
    'Is there a tool that... / I wish there was...',
    'X software is terrible / alternative to X',
    "I'm spending hours doing...",
    'We keep messing up...',
  ];
  const coreTemplateSet = new Set(coreTemplates.map((template) => template.toLowerCase()));
  const trackTemplates = (selectedTrack?.reddit?.keywordsText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !coreTemplateSet.has(line.toLowerCase()));

  const showWarning = subreddits.length === 0 && keywords.length === 0;

  return (
    <WizardShell
      title="Create Strategy"
      step={2}
      backHref={backHref}
      nextHref={nextHref}
      rightSlot={<SummaryCard />}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">Subreddits</div>
          <div className="text-xs text-muted-foreground">
            Add and press Enter (without r/).
          </div>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/60 p-3">
            {subreddits.length === 0 ? (
              <span className="text-xs text-muted-foreground">No subreddits yet.</span>
            ) : (
              subreddits.map((subreddit) => (
                <Badge key={subreddit} variant="secondary" className="gap-1 pr-1">
                  <span>{subreddit}</span>
                  <button
                    type="button"
                    onClick={() => removeSubreddit(subreddit)}
                    className="rounded-full px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${subreddit}`}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminInput
              value={newSubreddit}
              onChange={(event) => setNewSubreddit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addSubreddit(newSubreddit);
                setNewSubreddit('');
              }}
              placeholder="Add subreddit (e.g. startups) and press Enter"
            />
            {subreddits.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => updateDraft({ subreddits: [] })}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Recommended</div>
            <div className="flex flex-wrap gap-2">
              {recommendedSubreddits.map((subreddit) => {
                const isSelected = subreddits.some(
                  (item) => item.toLowerCase() === subreddit.toLowerCase(),
                );
                return (
                  <Badge
                    key={subreddit}
                    variant={isSelected ? 'secondary' : 'outline'}
                    className="cursor-pointer"
                    onClick={() =>
                      isSelected ? removeSubreddit(subreddit) : addSubreddit(subreddit)
                    }
                  >
                    {subreddit}
                  </Badge>
                );
              })}
              {recommendedSubreddits.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No recommendations for this track yet.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">Keywords / title patterns</div>
          <div className="text-xs text-muted-foreground">
            Patterns help match pain points in titles and descriptions.
          </div>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/60 p-3">
            {keywords.length === 0 ? (
              <span className="text-xs text-muted-foreground">No keywords yet.</span>
            ) : (
              keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                  <span>{keyword}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="rounded-full px-1 text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${keyword}`}
                  >
                    ×
                  </button>
                </Badge>
              ))
            )}
          </div>
          <AdminInput
            value={newKeyword}
            onChange={(event) => setNewKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addKeyword(newKeyword);
              setNewKeyword('');
            }}
            placeholder="Add keyword pattern and press Enter"
          />
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Templates</div>
            <div className="flex flex-wrap gap-2">
              {coreTemplates.map((template) => {
                const isSelected = keywords.some(
                  (item) => item.toLowerCase() === template.toLowerCase(),
                );
                return (
                  <Badge
                    key={template}
                    variant={isSelected ? 'secondary' : 'outline'}
                    className="cursor-pointer"
                    onClick={() =>
                      isSelected ? removeKeyword(template) : addKeyword(template)
                    }
                  >
                    {template}
                  </Badge>
                );
              })}
            </div>
          </div>
          {trackTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Track templates
              </div>
              <div className="flex flex-wrap gap-2">
                {trackTemplates.map((template) => {
                  const isSelected = keywords.some(
                    (item) => item.toLowerCase() === template.toLowerCase(),
                  );
                  return (
                    <Badge
                      key={template}
                      variant={isSelected ? 'secondary' : 'outline'}
                      className="cursor-pointer"
                      onClick={() =>
                        isSelected ? removeKeyword(template) : addKeyword(template)
                      }
                    >
                      {template}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showWarning && (
          <div className="text-sm text-amber-400">
            Add at least one subreddit or keyword to improve results.
          </div>
        )}
      </div>
    </WizardShell>
  );
}
