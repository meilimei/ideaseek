// Improved Idea detail page inspired by IdeaBrowser "Idea of the Day".
// This page consumes the extended idea model (with monetization, risks, etc.)
// and presents a rich opportunity report broken down into clear sections
// such as scores, business fit, offer, why now, proof & signals, market gap,
// execution plan, and framework fit. If a field is missing it is simply
// omitted from the output.

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

type Idea = {
  id: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  difficulty: number | null;
  market_size: string | null;
  source_type: string | null;
  demand_strength: string | null;
  pain_points: string[] | null;
  target_users: string | null;
  market_stage: string | null;
  competition: string | null;
  monetization: string[] | null;
  key_risks: string[] | null;
  next_steps: string | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function IdeaDetailPage({ params }: Props) {
  const { id } = use(params);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIdea() {
      try {
        const res = await fetch(`/api/ideas/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch idea');
        }
        const json = await res.json();
        setIdea(json.item);
      } catch (err: any) {
        setError(err.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchIdea();
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading idea...</div>;
  }
  if (error || !idea) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Link
          href="/ideas/database"
          className="text-sm text-indigo-600 underline"
        >
          ← Back to database
        </Link>
        <div className="mt-4 text-red-500">
          Failed to load idea: {error ?? 'Not found'}
        </div>
      </div>
    );
  }

  // Helper to compute revenue potential from market size.
  function revenueRange(size: string | null): string {
    switch (size) {
      case 'S':
      case 'Small':
        return '$100k–$1M ARR potential';
      case 'M':
      case 'Medium':
        return '$1M–$10M ARR potential';
      case 'L':
      case 'Large':
        return '$10M+ ARR potential';
      default:
        return 'N/A';
    }
  }

  // Helper to label difficulty.
  function difficultyLabel(num: number | null): string {
    if (num == null) return '';
    if (num <= 2) return 'Easy';
    if (num <= 4) return 'Moderate';
    if (num <= 6) return 'Challenging';
    if (num <= 8) return 'Hard';
    return 'Very hard';
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Navigation */}
      <Link
        href="/ideas/database"
        className="text-sm text-indigo-600 underline"
      >
        ← Back to database
      </Link>

      {/* Overview */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold">{idea.title}</h1>
        {idea.one_liner && (
          <p className="text-lg text-gray-700">{idea.one_liner}</p>
        )}
        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
          {idea.tags?.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full border text-xs"
            >
              {tag}
            </span>
          ))}
          {idea.market_size && (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs">
              Market: {idea.market_size}
            </span>
          )}
          {idea.difficulty != null && (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs">
              Difficulty: {idea.difficulty} / 10&nbsp;({difficultyLabel(idea.difficulty)})
            </span>
          )}
          {idea.demand_strength && (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs">
              Demand: {idea.demand_strength}
            </span>
          )}
          {idea.source_type && (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs">
              Source: {idea.source_type}
            </span>
          )}
        </div>
      </section>

      {/* Idea narrative */}
      {idea.description && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Idea Summary</h2>
          <p className="text-gray-800 whitespace-pre-line">
            {idea.description}
          </p>
        </section>
      )}

      {/* Scores section: Opportunity, Problem, Feasibility, Why Now */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Scores & Signals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Opportunity - derived from demand_strength or default */}
          <div className="p-4 border rounded-xl text-center">
            <h3 className="text-lg font-medium mb-1">Opportunity</h3>
            <div className="text-3xl font-bold">
              {idea.demand_strength === 'strong'
                ? '9'
                : idea.demand_strength === 'medium'
                ? '7'
                : '5'}
            </div>
            <p className="text-sm text-gray-600">
              {idea.demand_strength === 'strong'
                ? 'Exceptional'
                : idea.demand_strength === 'medium'
                ? 'Good'
                : 'Moderate'}
            </p>
          </div>
          {/* Problem - number of pain points */}
          <div className="p-4 border rounded-xl text-center">
            <h3 className="text-lg font-medium mb-1">Problem</h3>
            <div className="text-3xl font-bold">
              {idea.pain_points && idea.pain_points.length > 0
                ? Math.min(9, idea.pain_points.length + 4)
                : '5'}
            </div>
            <p className="text-sm text-gray-600">
              {idea.pain_points && idea.pain_points.length > 0
                ? 'Severe Pain'
                : 'Moderate Pain'}
            </p>
          </div>
          {/* Feasibility - based on difficulty */}
          <div className="p-4 border rounded-xl text-center">
            <h3 className="text-lg font-medium mb-1">Feasibility</h3>
            <div className="text-3xl font-bold">
              {idea.difficulty != null ? 10 - idea.difficulty : '7'}
            </div>
            <p className="text-sm text-gray-600">
              {idea.difficulty != null
                ? difficultyLabel(idea.difficulty)
                : 'Moderate'}
            </p>
          </div>
          {/* Why Now - simply reuse demand strength */}
          <div className="p-4 border rounded-xl text-center">
            <h3 className="text-lg font-medium mb-1">Why Now</h3>
            <div className="text-3xl font-bold">
              {idea.demand_strength === 'strong'
                ? '9'
                : idea.demand_strength === 'medium'
                ? '7'
                : '5'}
            </div>
            <p className="text-sm text-gray-600">
              {idea.demand_strength === 'strong'
                ? 'Perfect Timing'
                : idea.demand_strength === 'medium'
                ? 'Good Timing'
                : 'Fair Timing'}
            </p>
          </div>
        </div>
      </section>

      {/* Business Fit */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">Business Fit</h2>
        <p className="text-gray-800">
          <strong>Revenue Potential:</strong> {revenueRange(idea.market_size)}
        </p>
        {idea.difficulty != null && (
          <p className="text-gray-800">
            <strong>Execution Difficulty:</strong> {idea.difficulty}/10 ({difficultyLabel(idea.difficulty)})
          </p>
        )}
        <p className="text-gray-800">
          <strong>Go‑To‑Market:</strong>{' '}
          The combination of {idea.demand_strength ?? 'moderate demand'} and a{' '}
          {idea.market_size ?? 'N/A'} market stage suggests a promising go‑to‑market plan.
        </p>
      </section>

      {/* Offer section */}
      {idea.monetization && idea.monetization.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Offer</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-800">
            {idea.monetization.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Why Now section */}
      {idea.demand_strength && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Why Now?</h2>
          <p className="text-gray-800">
            {idea.demand_strength === 'strong'
              ? 'Explosive growth in the space makes this the perfect time to enter.'
              : idea.demand_strength === 'medium'
              ? 'There is steady interest in the market which could translate into solid demand.'
              : 'Opportunities exist but require creative positioning and timing.'}
          </p>
        </section>
      )}

      {/* Proof & Signals */}
      {idea.pain_points && idea.pain_points.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Proof & Signals</h2>
          <p className="text-gray-800">
            The following pain points were derived from real discussions and market signals:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-800">
            {idea.pain_points.map((p, idx) => (
              <li key={idx}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Market Gap */}
      {idea.target_users && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Market Gap</h2>
          <p className="text-gray-800">
            This idea targets {idea.target_users}. The current market fails to meet these users’ needs,
            leaving a gap that this solution can fill.
          </p>
          {idea.competition && (
            <p className="text-gray-800">
              {idea.competition}
            </p>
          )}
        </section>
      )}

      {/* Execution Plan */}
      {(idea.next_steps || (idea.key_risks && idea.key_risks.length > 0)) && (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">Execution Plan</h2>
          {idea.next_steps && (
            <p className="text-gray-800 whitespace-pre-line">
              {idea.next_steps}
            </p>
          )}
          {idea.key_risks && idea.key_risks.length > 0 && (
            <>
              <h3 className="text-lg font-medium">Key Risks</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-800">
                {idea.key_risks.map((risk, idx) => (
                  <li key={idx}>{risk}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Framework Fit – placeholder text */}
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">Framework Fit</h2>
        <p className="text-gray-800">
          Evaluate this opportunity using popular frameworks like the Value Equation,
          Market Matrix, or A.C.P Framework to determine its positioning. Currently this
          section acts as a placeholder for future analytical charts and frameworks.
        </p>
      </section>
    </div>
  );
}
