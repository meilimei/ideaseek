'use client';

import { useState } from 'react';

type TrendAnalysis = {
  summary: string | null;
  problem_space: string | null;
  demand_drivers: string | null;
  current_solutions: string | null;
  gaps: string | null;
  risks: string | null;
  founder_fit: string | null;
  action_plan_30d: string | null;
  last_updated: string | null;
};

type TrendAnalysisSectionProps = {
  slug: string;
  initialAnalysis: TrendAnalysis | null;
};

export default function TrendAnalysisSection({
  slug,
  initialAnalysis,
}: TrendAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(
    initialAnalysis,
  );
  const [founderProfile, setFounderProfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/trends/${slug}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founderProfile }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to analyze trend');
      }
      setAnalysis(json as TrendAnalysis);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to analyze trend';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-white p-4 md:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Trend Analysis</h2>
        <p className="text-sm text-gray-600">
          Generate a structured analysis for this trend. Add your background for a founder-fit angle (optional).
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Founder profile (optional)
        </label>
        <textarea
          value={founderProfile}
          onChange={(e) => setFounderProfile(e.target.value)}
          placeholder="Describe your background so we can assess founder fit (optional)..."
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[100px]"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-60"
        >
          {loading
            ? 'Analyzing...'
            : analysis
            ? 'Regenerate analysis'
            : 'Generate analysis'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
        {analysis?.last_updated && (
          <span className="text-xs text-gray-500">
            Last updated: {new Date(analysis.last_updated).toLocaleString()}
          </span>
        )}
      </div>

      {analysis && (
        <div className="space-y-3">
          {analysis.summary && (
            <Section title="Summary" body={analysis.summary} />
          )}
          {analysis.problem_space && (
            <Section title="Problem Space" body={analysis.problem_space} />
          )}
          {analysis.demand_drivers && (
            <Section title="Demand Drivers" body={analysis.demand_drivers} />
          )}
          {analysis.current_solutions && (
            <Section
              title="Current Solutions & Gaps"
              body={`${analysis.current_solutions}${
                analysis.gaps ? `\n\nGaps: ${analysis.gaps}` : ''
              }`}
            />
          )}
          {analysis.risks && <Section title="Risks" body={analysis.risks} />}
          {analysis.founder_fit && (
            <Section title="Founder Fit" body={analysis.founder_fit} />
          )}
          {analysis.action_plan_30d && (
            <Section title="30-day Action Plan" body={analysis.action_plan_30d} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-700 whitespace-pre-line">{body}</p>
    </div>
  );
}
