'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

type GeneratedIdea = {
  title: string;
  one_liner: string;
  tags?: string[];
  difficulty?: number;
  market_size?: string;
  description?: string;
  demand_strength?: string;
  pain_points?: string[];
  target_users?: string;
  market_stage?: string;
  competition?: string;
  monetization?: string[];
  key_risks?: string[];
  next_steps?: string;
};

export default function IdeaGeneratorPage() {
  const [userProfile, setUserProfile] = useState('');
  const [preferences, setPreferences] = useState('');
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIdeas([]);
    setSavedIds({});
    setSavingIndex(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ideas/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          preferences,
          count: 5,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Failed to generate ideas');
      }

      const json = await res.json();
      setIdeas(json.ideas ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(index: number, idea: GeneratedIdea) {
    setError(null);
    setSavingIndex(index);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...idea,
          source_type: 'generated',
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Failed to save idea');
      }

      const json = await res.json();
      if (!json?.id) {
        throw new Error('Failed to save idea');
      }

      setSavedIds((prev) => ({ ...prev, [index]: json.id }));
    } catch (err: any) {
      setError(err.message ?? 'Failed to save idea');
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/ideas/database"
          className="text-sm text-indigo-600 underline"
        >
          ← Back to database
        </Link>
        <h1 className="text-2xl font-semibold">Idea Generator</h1>
      </div>

      {/* 表单 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 border rounded-xl p-4 bg-white/60"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Your profile（必填）
          </label>
          <textarea
            value={userProfile}
            onChange={(e) => setUserProfile(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring focus:ring-indigo-100"
            placeholder="例如：5 年前端开发经验，会 Next.js / React，对 SaaS、开发者工具、出海有兴趣，希望 1–2 人就能做起来……"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Preferences（可选）
          </label>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring focus:ring-indigo-100"
            placeholder="例如：偏 B2B / 偏订阅制 / 不做监管太重行业 / 希望先做英文出海……"
          />
        </div>

        {error && (
          <div className="text-sm text-red-500">
            Error: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !userProfile.trim()}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate ideas'}
        </button>
      </form>

      {/* 结果列表 */}
      {ideas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Generated opportunities ({ideas.length})
          </h2>

          {ideas.map((idea, idx) => (
            <div
              key={idx}
              className="border rounded-xl p-4 bg-white/60 space-y-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-medium mb-1">
                    {idea.title}
                  </h3>
                  <p className="text-gray-700">{idea.one_liner}</p>
                </div>
                <div className="text-xs text-gray-600 space-y-1 text-right">
                  {idea.difficulty != null && (
                    <div>Difficulty: {idea.difficulty}/5</div>
                  )}
                  {idea.market_size && (
                    <div>Market: {idea.market_size}</div>
                  )}
                  {idea.demand_strength && (
                    <div>Demand: {idea.demand_strength}</div>
                  )}
                </div>
              </div>

              {idea.tags && idea.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  {idea.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {idea.description && (
                <p className="text-gray-800">
                  {idea.description}
                </p>
              )}

              {idea.pain_points && idea.pain_points.length > 0 && (
                <div className="text-sm text-gray-800">
                  <div className="font-medium">Pain points:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {idea.pain_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {idea.monetization && idea.monetization.length > 0 && (
                <div className="text-sm text-gray-800">
                  <div className="font-medium">Monetization:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {idea.monetization.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {idea.next_steps && (
                <div className="text-sm text-gray-800">
                  <div className="font-medium">Next steps:</div>
                  <p>{idea.next_steps}</p>
                </div>
              )}

              <div className="flex justify-end">
                {!savedIds[idx] ? (
                  <button
                    type="button"
                    onClick={() => handleSave(idx, idea)}
                    disabled={savingIndex === idx}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingIndex === idx ? 'Saving…' : 'Save to database'}
                  </button>
                ) : (
                  <Link
                    href={`/ideas/${savedIds[idx]}`}
                    className="text-sm text-indigo-600 underline"
                  >
                    View full report →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
