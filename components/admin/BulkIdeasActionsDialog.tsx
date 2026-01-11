'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PreviewResponse = {
  userId: string;
  email: string;
  ideaCount: number;
  adminJobIdeas: number;
  ideaEvidence: number;
  savedIdeas: number;
  rawRedditPosts: number;
};

type ActionResponse = {
  ok: true;
  mode: 'archive' | 'delete';
  email: string;
  archivedIdeas?: number;
  deletedIdeas?: number;
  unlinkedRawPosts?: number;
};

export default function BulkIdeasActionsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'archive' | 'delete'>('archive');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canPreview = Boolean(email.trim());
  const needsConfirm = mode === 'delete';
  const canExecute = useMemo(() => {
    if (!email.trim()) return false;
    if (!needsConfirm) return true;
    return confirmDelete.trim() === 'DELETE' && confirmEmail.trim().length > 0;
  }, [confirmDelete, confirmEmail, email, needsConfirm]);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const handlePreview = async () => {
    resetFeedback();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ideas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', email: email.trim() }),
      });
      const json = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to preview');
      }
      setPreview(json);
      setSuccess('Preview loaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    resetFeedback();
    setLoading(true);
    try {
      const payload = {
        mode,
        email: email.trim(),
        confirmDelete: confirmDelete.trim(),
        confirmEmail: confirmEmail.trim(),
      };
      const res = await fetch('/api/admin/ideas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ActionResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to execute');
      }
      const message =
        mode === 'archive'
          ? `Archived ${json.archivedIdeas ?? 0} ideas.`
          : `Deleted ${json.deletedIdeas ?? 0} ideas; unlinked ${json.unlinkedRawPosts ?? 0} posts.`;
      setSuccess(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    resetFeedback();
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Bulk actions
      </Button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={close}
            aria-hidden="true"
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-background/95 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-foreground">Bulk actions</div>
                <div className="text-xs text-muted-foreground">
                  Archive or permanently delete ideas by user email.
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                Close
              </Button>
            </div>

            <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  User email
                </label>
                <Input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="user@example.com"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handlePreview}
                    disabled={!canPreview || loading}
                  >
                    {loading ? 'Working…' : 'Preview'}
                  </Button>
                  {preview && (
                    <span className="text-xs text-muted-foreground">
                      User ID: {preview.userId}
                    </span>
                  )}
                </div>
              </div>

              {preview && (
                <div className="rounded-xl border border-border/50 bg-card/60 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview counts
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Ideas</span>
                      <span className="text-foreground">{preview.ideaCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Admin job ideas</span>
                      <span className="text-foreground">{preview.adminJobIdeas}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Idea evidence</span>
                      <span className="text-foreground">{preview.ideaEvidence}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Saved ideas</span>
                      <span className="text-foreground">{preview.savedIdeas}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Raw Reddit posts</span>
                      <span className="text-foreground">{preview.rawRedditPosts}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Action
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'archive' ? 'secondary' : 'ghost'}
                    onClick={() => setMode('archive')}
                  >
                    Archive (safe)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'delete' ? 'destructive' : 'ghost'}
                    onClick={() => setMode('delete')}
                  >
                    Delete permanently
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Permanent delete unlinks raw_reddit_posts.promoted_idea_id first and
                  cascades related rows.
                </p>
              </div>

              {mode === 'delete' && (
                <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-xs font-semibold text-destructive">
                    Confirm permanent delete
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Type DELETE</label>
                    <Input
                      value={confirmDelete}
                      onChange={(event) => setConfirmDelete(event.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">
                      Re-type the email
                    </label>
                    <Input
                      value={confirmEmail}
                      onChange={(event) => setConfirmEmail(event.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'delete' ? 'destructive' : 'secondary'}
                  onClick={handleExecute}
                  disabled={!canExecute || loading}
                >
                  {loading
                    ? 'Working…'
                    : mode === 'archive'
                      ? 'Archive ideas'
                      : 'Delete permanently'}
                </Button>
                {error && <span className="text-xs text-destructive">{error}</span>}
                {success && <span className="text-xs text-emerald-500">{success}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
