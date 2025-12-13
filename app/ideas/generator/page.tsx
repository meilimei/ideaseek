'use client';

import Link from 'next/link';
import { useState } from 'react';

type GeneratedIdea = {
  localId: string;
  savedIdeaId?: string;
  title: string;
  one_liner?: string;
  description?: string;
  tags?: string[];
  difficulty?: number;
  market_size?: string;
  demand_strength?: string;
};

const initialForm = {
  background: '',
  interests: '',
  skills: '',
  constraints: '',
};

export default function IdeaGeneratorPage() {
  const [form, setForm] = useState(initialForm);
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  void savingId;
  void setSavingId;

  const handleChange = (
    field: keyof typeof initialForm,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setIdeas([]);
    setLoading(true);
    try {
      const res = await fetch('/api/ideas/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to generate ideas');
      }
      const ideasWithIds: GeneratedIdea[] = (Array.isArray(json.ideas)
        ? json.ideas
        : []
      ).map((idea, index: number) => ({
        ...idea,
        localId:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `idea-${Date.now()}-${index}`,
        savedIdeaId: undefined,
      }));
      setIdeas(ideasWithIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate ideas';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (idea: GeneratedIdea) => {
    try {
      setError(null);
      setSavingId(idea.localId);

      const res = await fetch('/api/ideas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, userId: 'local-dev' }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to save idea');
        return;
      }

      setIdeas((prev) =>
        prev.map((it) =>
          it.localId === idea.localId ? { ...it, savedIdeaId: json.id } : it,
        ),
      );
    } catch (err) {
      console.error(err);
      setError('Failed to save idea');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Idea Generator</h1>
        <p className="text-gray-600">
          Get startup ideas tailored to your background and interests.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleGenerate}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your background &amp; experience
          </label>
          <textarea
            required
            value={form.background}
            onChange={(e) => handleChange('background', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[90px]"
            placeholder="Summarize your work history, domains, and roles..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Industries / problems you&apos;re interested in (optional)
          </label>
          <textarea
            value={form.interests}
            onChange={(e) => handleChange('interests', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[80px]"
            placeholder="e.g., fintech, SMB tools, climate, education"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your core skills (e.g., coding, design, marketing) (optional)
          </label>
          <textarea
            value={form.skills}
            onChange={(e) => handleChange('skills', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[80px]"
            placeholder="List relevant skills, tools, or strengths..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Constraints (time, budget, geography, etc.) (optional)
          </label>
          <textarea
            value={form.constraints}
            onChange={(e) => handleChange('constraints', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[80px]"
            placeholder="Any limits to consider (e.g., 5 hrs/wk, $1k/mo, remote-only)"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate ideas'}
          </button>
          {error && (
            <span className="text-sm text-red-500 self-center">
              {error}
            </span>
          )}
        </div>
      </form>

      {loading && !ideas.length && (
        <div className="text-sm text-gray-600">Generating...</div>
      )}

      {ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea, idx) => (
            <div
              key={`${idea.title}-${idx}`}
              className="border rounded-lg p-4 shadow-sm bg-white"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-lg font-semibold">{idea.title}</h3>
              </div>
              {idea.one_liner && (
                <p className="text-gray-700 mt-1">{idea.one_liner}</p>
              )}
              {idea.description && (
                <p className="text-gray-700 mt-2 line-clamp-4">
                  {idea.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-600">
                {idea.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full border text-xs"
                  >
                    {tag}
                  </span>
                ))}
                {(idea.difficulty != null ||
                  idea.market_size ||
                  idea.demand_strength) && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                    {idea.difficulty != null
                      ? `Difficulty: ${idea.difficulty}`
                      : null}
                    {idea.market_size ? ` · Market: ${idea.market_size}` : ''}
                    {idea.demand_strength
                      ? ` · Demand: ${idea.demand_strength}`
                      : ''}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {idea.savedIdeaId ? (
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1 rounded-lg border text-xs bg-gray-100 text-gray-600 cursor-default"
                    >
                      Saved
                    </button>
                    <Link
                      href={`/ideas/${idea.savedIdeaId}`}
                      className="px-3 py-1 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
                    >
                      View full report
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSave(idea)}
                    disabled={savingId === idea.localId}
                    className="px-4 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-60"
                  >
                    {savingId === idea.localId ? 'Saving...' : 'Save to library'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
